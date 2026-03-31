import { v } from "convex/values";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Doc, Id } from "./_generated/dataModel";
import {
  canReadAssessment,
  requireUserId,
  requireWorkspaceMember,
} from "./lib/access";
import {
  DEFAULT_ROS_COL_AXIS,
  DEFAULT_ROS_COL_LABELS,
  DEFAULT_ROS_ROW_AXIS,
  DEFAULT_ROS_ROW_LABELS,
  emptyMatrix,
} from "../lib/ros-defaults";

const MIN_DIM = 2;
const MAX_DIM = 12;

function trimLabels(labels: string[]): string[] {
  return labels.map((s) => s.trim()).filter(Boolean);
}

function validateLabelArrays(rows: string[], cols: string[]) {
  if (rows.length < MIN_DIM || rows.length > MAX_DIM) {
    throw new Error(
      `Rader må være mellom ${MIN_DIM} og ${MAX_DIM} (ikke tomme etiketter).`,
    );
  }
  if (cols.length < MIN_DIM || cols.length > MAX_DIM) {
    throw new Error(
      `Kolonner må være mellom ${MIN_DIM} og ${MAX_DIM} (ikke tomme etiketter).`,
    );
  }
}

function assertMatrixShape(
  values: number[][],
  rowCount: number,
  colCount: number,
) {
  if (values.length !== rowCount) {
    throw new Error("Matrisen matcher ikke antall rader.");
  }
  for (const row of values) {
    if (row.length !== colCount) {
      throw new Error("Matrisen matcher ikke antall kolonner.");
    }
    for (const c of row) {
      if (!Number.isInteger(c) || c < 0 || c > 5) {
        throw new Error("Hver celle må være et heltall 0–5.");
      }
    }
  }
}

function clampRosPriority(p: number | undefined): number {
  if (p === undefined) return 3;
  return Math.min(5, Math.max(1, Math.round(p)));
}

async function requireRosAnalysisRead(
  ctx: QueryCtx | MutationCtx,
  analysisId: Id<"rosAnalyses">,
  userId: Id<"users">,
): Promise<Doc<"rosAnalyses">> {
  const row = await ctx.db.get(analysisId);
  if (!row) {
    throw new Error("ROS-analyse finnes ikke.");
  }
  await requireWorkspaceMember(ctx, row.workspaceId, userId, "viewer");
  return row;
}

async function requireRosAnalysisEdit(
  ctx: MutationCtx,
  analysisId: Id<"rosAnalyses">,
  userId: Id<"users">,
): Promise<Doc<"rosAnalyses">> {
  const row = await ctx.db.get(analysisId);
  if (!row) {
    throw new Error("ROS-analyse finnes ikke.");
  }
  await requireWorkspaceMember(ctx, row.workspaceId, userId, "member");
  return row;
}

async function enrichRosTask(
  ctx: QueryCtx,
  row: Doc<"rosTasks">,
) {
  const assignee = row.assigneeUserId
    ? await ctx.db.get(row.assigneeUserId)
    : null;
  const creator = await ctx.db.get(row.createdByUserId);
  return {
    ...row,
    assigneeName: assignee?.name ?? assignee?.email ?? null,
    creatorName: creator?.name ?? creator?.email ?? null,
  };
}

export const listTemplates = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }
    await requireWorkspaceMember(ctx, args.workspaceId, userId, "viewer");
    return await ctx.db
      .query("rosTemplates")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
  },
});

export const listAnalyses = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }
    await requireWorkspaceMember(ctx, args.workspaceId, userId, "viewer");
    const rows = await ctx.db
      .query("rosAnalyses")
      .withIndex("by_workspace_updated", (q) =>
        q.eq("workspaceId", args.workspaceId),
      )
      .order("desc")
      .collect();
    const out = [];
    for (const r of rows) {
      const cand = await ctx.db.get(r.candidateId);
      out.push({
        ...r,
        candidateName: cand?.name ?? "—",
        candidateCode: cand?.code ?? "",
      });
    }
    return out;
  },
});

export const getAnalysis = query({
  args: { analysisId: v.id("rosAnalyses") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }
    const row = await ctx.db.get(args.analysisId);
    if (!row) {
      return null;
    }
    await requireWorkspaceMember(ctx, row.workspaceId, userId, "viewer");
    const cand = await ctx.db.get(row.candidateId);
    const links = await ctx.db
      .query("rosAnalysisAssessments")
      .withIndex("by_ros_analysis", (q) =>
        q.eq("rosAnalysisId", args.analysisId),
      )
      .collect();
    const linkedAssessments: Array<{
      linkId: Id<"rosAnalysisAssessments">;
      assessmentId: Id<"assessments">;
      title: string;
      note: string | undefined;
    }> = [];
    for (const l of links) {
      const a = await ctx.db.get(l.assessmentId);
      if (!a || !(await canReadAssessment(ctx, a, userId))) {
        continue;
      }
      linkedAssessments.push({
        linkId: l._id,
        assessmentId: l.assessmentId,
        title: a.title,
        note: l.note,
      });
    }
    let legacyAssessmentTitle: string | null = null;
    if (row.assessmentId) {
      const a = await ctx.db.get(row.assessmentId);
      legacyAssessmentTitle = a?.title ?? null;
    }
    return {
      ...row,
      candidateName: cand?.name ?? "—",
      candidateCode: cand?.code ?? "",
      linkedAssessments,
      legacyAssessmentId: row.assessmentId ?? null,
      legacyAssessmentTitle,
    };
  },
});

/** PVV-vurderinger som matcher kandidatens kode (for kobling til ROS). */
export const listMatchingAssessments = query({
  args: {
    workspaceId: v.id("workspaces"),
    candidateId: v.id("candidates"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }
    const cand = await ctx.db.get(args.candidateId);
    if (!cand || cand.workspaceId !== args.workspaceId) {
      return [];
    }
    await requireWorkspaceMember(ctx, args.workspaceId, userId, "viewer");
    const code = cand.code;
    const assessments = await ctx.db
      .query("assessments")
      .withIndex("by_workspace", (q) =>
        q.eq("workspaceId", args.workspaceId),
      )
      .collect();
    const out: Array<{ _id: Id<"assessments">; title: string }> = [];
    for (const a of assessments) {
      if (!(await canReadAssessment(ctx, a, userId))) {
        continue;
      }
      const draft = await ctx.db
        .query("assessmentDrafts")
        .withIndex("by_assessment", (q) => q.eq("assessmentId", a._id))
        .unique();
      const ref = draft
        ? String((draft.payload as Record<string, unknown>).candidateId ?? "")
        : "";
      if (ref === code) {
        out.push({ _id: a._id, title: a.title });
      }
    }
    out.sort((x, y) => y.title.localeCompare(x.title));
    return out;
  },
});

/** Alle PVV-vurderinger i arbeidsområdet du kan lese — for kobling til ROS (mange-til-mange). */
export const listAssessmentsForWorkspace = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }
    await requireWorkspaceMember(ctx, args.workspaceId, userId, "viewer");
    const assessments = await ctx.db
      .query("assessments")
      .withIndex("by_workspace", (q) =>
        q.eq("workspaceId", args.workspaceId),
      )
      .collect();
    const out: Array<{ _id: Id<"assessments">; title: string }> = [];
    for (const a of assessments) {
      if (!(await canReadAssessment(ctx, a, userId))) {
        continue;
      }
      out.push({ _id: a._id, title: a.title });
    }
    out.sort((x, y) => x.title.localeCompare(y.title));
    return out;
  },
});

export const createTemplate = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.string(),
    description: v.optional(v.string()),
    rowAxisTitle: v.optional(v.string()),
    colAxisTitle: v.optional(v.string()),
    rowLabels: v.optional(v.array(v.string())),
    colLabels: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireWorkspaceMember(ctx, args.workspaceId, userId, "member");
    const name = args.name.trim();
    if (!name) {
      throw new Error("Navn på mal er påkrevd.");
    }
    const rowLabels = trimLabels(
      args.rowLabels ?? [...DEFAULT_ROS_ROW_LABELS],
    );
    const colLabels = trimLabels(
      args.colLabels ?? [...DEFAULT_ROS_COL_LABELS],
    );
    validateLabelArrays(rowLabels, colLabels);
    const now = Date.now();
    return await ctx.db.insert("rosTemplates", {
      workspaceId: args.workspaceId,
      name,
      description: args.description?.trim() || undefined,
      rowAxisTitle: (args.rowAxisTitle ?? DEFAULT_ROS_ROW_AXIS).trim(),
      colAxisTitle: (args.colAxisTitle ?? DEFAULT_ROS_COL_AXIS).trim(),
      rowLabels,
      colLabels,
      createdByUserId: userId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateTemplate = mutation({
  args: {
    templateId: v.id("rosTemplates"),
    name: v.optional(v.string()),
    description: v.optional(v.union(v.string(), v.null())),
    rowAxisTitle: v.optional(v.string()),
    colAxisTitle: v.optional(v.string()),
    rowLabels: v.optional(v.array(v.string())),
    colLabels: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const row = await ctx.db.get(args.templateId);
    if (!row) {
      throw new Error("Mal finnes ikke.");
    }
    await requireWorkspaceMember(ctx, row.workspaceId, userId, "member");
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.name !== undefined) {
      const n = args.name.trim();
      if (!n) throw new Error("Navn kan ikke være tomt.");
      patch.name = n;
    }
    if (args.description !== undefined) {
      patch.description =
        args.description === null ? undefined : args.description.trim() || undefined;
    }
    if (args.rowAxisTitle !== undefined) {
      patch.rowAxisTitle = args.rowAxisTitle.trim();
    }
    if (args.colAxisTitle !== undefined) {
      patch.colAxisTitle = args.colAxisTitle.trim();
    }
    if (args.rowLabels !== undefined || args.colLabels !== undefined) {
      const rl =
        args.rowLabels !== undefined ? trimLabels(args.rowLabels) : row.rowLabels;
      const cl =
        args.colLabels !== undefined ? trimLabels(args.colLabels) : row.colLabels;
      validateLabelArrays(rl, cl);
      patch.rowLabels = rl;
      patch.colLabels = cl;
    }
    await ctx.db.patch(args.templateId, patch);
    return null;
  },
});

export const removeTemplate = mutation({
  args: { templateId: v.id("rosTemplates") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const row = await ctx.db.get(args.templateId);
    if (!row) {
      throw new Error("Mal finnes ikke.");
    }
    await requireWorkspaceMember(ctx, row.workspaceId, userId, "member");
    await ctx.db.delete(args.templateId);
    return null;
  },
});

export const createAnalysis = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    templateId: v.id("rosTemplates"),
    candidateId: v.id("candidates"),
    title: v.string(),
    /** Én eldre enkeltkobling (valgfritt); bruk assessmentIds for flere PVV */
    assessmentId: v.optional(v.id("assessments")),
    assessmentIds: v.optional(v.array(v.id("assessments"))),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireWorkspaceMember(ctx, args.workspaceId, userId, "member");
    const cand = await ctx.db.get(args.candidateId);
    if (!cand || cand.workspaceId !== args.workspaceId) {
      throw new Error("Ugyldig kandidat.");
    }
    const tpl = await ctx.db.get(args.templateId);
    if (!tpl || tpl.workspaceId !== args.workspaceId) {
      throw new Error("Ugyldig mal.");
    }
    const title = args.title.trim();
    if (!title) {
      throw new Error("Tittel er påkrevd.");
    }
    const idSet = new Set<string>();
    const addIds = [...(args.assessmentIds ?? [])];
    if (args.assessmentId) {
      addIds.push(args.assessmentId);
    }
    for (const aid of addIds) {
      idSet.add(aid);
    }
    for (const aid of idSet) {
      const a = await ctx.db.get(aid as Id<"assessments">);
      if (!a || a.workspaceId !== args.workspaceId) {
        throw new Error("Ugyldig vurdering.");
      }
      if (!(await canReadAssessment(ctx, a, userId))) {
        throw new Error("Ingen tilgang til vurderingen.");
      }
    }
    const matrixValues = emptyMatrix(
      tpl.rowLabels.length,
      tpl.colLabels.length,
    );
    const now = Date.now();
    const analysisId = await ctx.db.insert("rosAnalyses", {
      workspaceId: args.workspaceId,
      templateId: args.templateId,
      title,
      rowAxisTitle: tpl.rowAxisTitle,
      colAxisTitle: tpl.colAxisTitle,
      rowLabels: [...tpl.rowLabels],
      colLabels: [...tpl.colLabels],
      matrixValues,
      candidateId: args.candidateId,
      assessmentId: undefined,
      notes: args.notes?.trim() || undefined,
      createdByUserId: userId,
      createdAt: now,
      updatedAt: now,
    });
    for (const aid of idSet) {
      const existing = await ctx.db
        .query("rosAnalysisAssessments")
        .withIndex("by_ros_and_assessment", (q) =>
          q.eq("rosAnalysisId", analysisId).eq("assessmentId", aid as Id<"assessments">),
        )
        .unique();
      if (existing) {
        continue;
      }
      await ctx.db.insert("rosAnalysisAssessments", {
        workspaceId: args.workspaceId,
        rosAnalysisId: analysisId,
        assessmentId: aid as Id<"assessments">,
        createdByUserId: userId,
        createdAt: now,
      });
    }
    return analysisId;
  },
});

export const updateAnalysis = mutation({
  args: {
    analysisId: v.id("rosAnalyses"),
    matrixValues: v.optional(v.array(v.array(v.number()))),
    title: v.optional(v.string()),
    notes: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const row = await requireRosAnalysisEdit(ctx, args.analysisId, userId);
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.matrixValues !== undefined) {
      assertMatrixShape(
        args.matrixValues,
        row.rowLabels.length,
        row.colLabels.length,
      );
      patch.matrixValues = args.matrixValues;
    }
    if (args.title !== undefined) {
      const t = args.title.trim();
      if (!t) throw new Error("Tittel kan ikke være tom.");
      patch.title = t;
    }
    if (args.notes !== undefined) {
      patch.notes =
        args.notes === null ? undefined : args.notes.trim() || undefined;
    }
    await ctx.db.patch(args.analysisId, patch);
    return null;
  },
});

export const removeAnalysis = mutation({
  args: { analysisId: v.id("rosAnalyses") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const row = await requireRosAnalysisEdit(ctx, args.analysisId, userId);
    const links = await ctx.db
      .query("rosAnalysisAssessments")
      .withIndex("by_ros_analysis", (q) =>
        q.eq("rosAnalysisId", args.analysisId),
      )
      .collect();
    for (const l of links) {
      await ctx.db.delete(l._id);
    }
    const versions = await ctx.db
      .query("rosAnalysisVersions")
      .withIndex("by_ros_analysis", (q) =>
        q.eq("rosAnalysisId", args.analysisId),
      )
      .collect();
    for (const v of versions) {
      await ctx.db.delete(v._id);
    }
    const tasks = await ctx.db
      .query("rosTasks")
      .withIndex("by_ros_analysis", (q) =>
        q.eq("rosAnalysisId", args.analysisId),
      )
      .collect();
    for (const t of tasks) {
      await ctx.db.delete(t._id);
    }
    await ctx.db.delete(row._id);
    return null;
  },
});

export const linkAssessment = mutation({
  args: {
    analysisId: v.id("rosAnalyses"),
    assessmentId: v.id("assessments"),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const analysis = await requireRosAnalysisEdit(ctx, args.analysisId, userId);
    const a = await ctx.db.get(args.assessmentId);
    if (!a || a.workspaceId !== analysis.workspaceId) {
      throw new Error("Ugyldig vurdering.");
    }
    if (!(await canReadAssessment(ctx, a, userId))) {
      throw new Error("Ingen tilgang til vurderingen.");
    }
    const existing = await ctx.db
      .query("rosAnalysisAssessments")
      .withIndex("by_ros_and_assessment", (q) =>
        q
          .eq("rosAnalysisId", args.analysisId)
          .eq("assessmentId", args.assessmentId),
      )
      .unique();
    if (existing) {
      throw new Error("Denne PVV-vurderingen er allerede koblet.");
    }
    const now = Date.now();
    return await ctx.db.insert("rosAnalysisAssessments", {
      workspaceId: analysis.workspaceId,
      rosAnalysisId: args.analysisId,
      assessmentId: args.assessmentId,
      note: args.note?.trim() || undefined,
      createdByUserId: userId,
      createdAt: now,
    });
  },
});

export const unlinkAssessment = mutation({
  args: { linkId: v.id("rosAnalysisAssessments") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const link = await ctx.db.get(args.linkId);
    if (!link) {
      throw new Error("Kobling finnes ikke.");
    }
    await requireRosAnalysisEdit(ctx, link.rosAnalysisId, userId);
    await ctx.db.delete(args.linkId);
    return null;
  },
});

export const clearLegacyAssessment = mutation({
  args: { analysisId: v.id("rosAnalyses") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireRosAnalysisEdit(ctx, args.analysisId, userId);
    await ctx.db.patch(args.analysisId, { assessmentId: undefined });
    return null;
  },
});

export const migrateLegacyAssessmentToLinks = mutation({
  args: { analysisId: v.id("rosAnalyses") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const analysis = await requireRosAnalysisEdit(ctx, args.analysisId, userId);
    if (!analysis.assessmentId) {
      return null;
    }
    const aid = analysis.assessmentId;
    const existing = await ctx.db
      .query("rosAnalysisAssessments")
      .withIndex("by_ros_and_assessment", (q) =>
        q.eq("rosAnalysisId", args.analysisId).eq("assessmentId", aid),
      )
      .unique();
    const now = Date.now();
    if (!existing) {
      await ctx.db.insert("rosAnalysisAssessments", {
        workspaceId: analysis.workspaceId,
        rosAnalysisId: args.analysisId,
        assessmentId: aid,
        createdByUserId: userId,
        createdAt: now,
      });
    }
    await ctx.db.patch(args.analysisId, { assessmentId: undefined });
    return null;
  },
});

export const listVersions = query({
  args: { analysisId: v.id("rosAnalyses") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }
    await requireRosAnalysisRead(ctx, args.analysisId, userId);
    const rows = await ctx.db
      .query("rosAnalysisVersions")
      .withIndex("by_ros_version", (q) =>
        q.eq("rosAnalysisId", args.analysisId),
      )
      .order("desc")
      .collect();
    return rows;
  },
});

export const createVersion = mutation({
  args: {
    analysisId: v.id("rosAnalyses"),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const analysis = await requireRosAnalysisEdit(ctx, args.analysisId, userId);
    const last = await ctx.db
      .query("rosAnalysisVersions")
      .withIndex("by_ros_version", (q) =>
        q.eq("rosAnalysisId", args.analysisId),
      )
      .order("desc")
      .first();
    const next = (last?.version ?? 0) + 1;
    const now = Date.now();
    return await ctx.db.insert("rosAnalysisVersions", {
      workspaceId: analysis.workspaceId,
      rosAnalysisId: args.analysisId,
      version: next,
      note: args.note?.trim() || undefined,
      rowAxisTitle: analysis.rowAxisTitle,
      colAxisTitle: analysis.colAxisTitle,
      rowLabels: [...analysis.rowLabels],
      colLabels: [...analysis.colLabels],
      matrixValues: analysis.matrixValues.map((r) => [...r]),
      notes: analysis.notes,
      createdByUserId: userId,
      createdAt: now,
    });
  },
});

export const restoreVersion = mutation({
  args: {
    analysisId: v.id("rosAnalyses"),
    version: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireRosAnalysisEdit(ctx, args.analysisId, userId);
    const ver = await ctx.db
      .query("rosAnalysisVersions")
      .withIndex("by_ros_version", (q) =>
        q.eq("rosAnalysisId", args.analysisId).eq("version", args.version),
      )
      .unique();
    if (!ver) {
      throw new Error("Fant ikke denne versjonen.");
    }
    const now = Date.now();
    await ctx.db.patch(args.analysisId, {
      rowAxisTitle: ver.rowAxisTitle,
      colAxisTitle: ver.colAxisTitle,
      rowLabels: [...ver.rowLabels],
      colLabels: [...ver.colLabels],
      matrixValues: ver.matrixValues.map((r) => [...r]),
      notes: ver.notes,
      updatedAt: now,
    });
    return null;
  },
});

export const listTasksByRosAnalysis = query({
  args: { analysisId: v.id("rosAnalyses") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }
    await requireRosAnalysisRead(ctx, args.analysisId, userId);
    const rows = await ctx.db
      .query("rosTasks")
      .withIndex("by_ros_analysis", (q) =>
        q.eq("rosAnalysisId", args.analysisId),
      )
      .collect();
    rows.sort((a, b) => {
      if (a.status !== b.status) {
        return a.status === "open" ? -1 : 1;
      }
      const pa = clampRosPriority(a.priority);
      const pb = clampRosPriority(b.priority);
      if (pa !== pb) return pa - pb;
      return (a.dashboardRank ?? a.createdAt) - (b.dashboardRank ?? b.createdAt);
    });
    const out = [];
    for (const r of rows) {
      out.push(await enrichRosTask(ctx, r));
    }
    return out;
  },
});

export const createRosTask = mutation({
  args: {
    analysisId: v.id("rosAnalyses"),
    title: v.string(),
    description: v.optional(v.string()),
    assigneeUserId: v.optional(v.id("users")),
    priority: v.optional(v.number()),
    dueAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const analysis = await requireRosAnalysisEdit(ctx, args.analysisId, userId);
    const title = args.title.trim();
    if (!title) {
      throw new Error("Oppgavetekst mangler.");
    }
    const now = Date.now();
    return await ctx.db.insert("rosTasks", {
      workspaceId: analysis.workspaceId,
      rosAnalysisId: args.analysisId,
      title,
      description: args.description?.trim() || undefined,
      assigneeUserId: args.assigneeUserId,
      createdByUserId: userId,
      status: "open",
      priority: clampRosPriority(args.priority),
      dueAt: args.dueAt,
      dashboardRank: now,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateRosTask = mutation({
  args: {
    taskId: v.id("rosTasks"),
    title: v.optional(v.string()),
    description: v.optional(v.union(v.string(), v.null())),
    assigneeUserId: v.optional(v.union(v.id("users"), v.null())),
    priority: v.optional(v.number()),
    dueAt: v.optional(v.union(v.number(), v.null())),
    status: v.optional(v.union(v.literal("open"), v.literal("done"))),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const row = await ctx.db.get(args.taskId);
    if (!row) {
      throw new Error("Fant ikke oppgaven.");
    }
    await requireRosAnalysisEdit(ctx, row.rosAnalysisId, userId);
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.title !== undefined) {
      const t = args.title.trim();
      if (!t) throw new Error("Tittel kan ikke være tom.");
      patch.title = t;
    }
    if (args.description !== undefined) {
      patch.description =
        args.description === null ? undefined : args.description.trim() || undefined;
    }
    if (args.assigneeUserId !== undefined) {
      patch.assigneeUserId =
        args.assigneeUserId === null ? undefined : args.assigneeUserId;
    }
    if (args.priority !== undefined) {
      patch.priority = clampRosPriority(args.priority);
    }
    if (args.dueAt !== undefined) {
      patch.dueAt = args.dueAt === null ? undefined : args.dueAt;
    }
    if (args.status !== undefined) {
      patch.status = args.status;
    }
    await ctx.db.patch(args.taskId, patch);
    return null;
  },
});

export const removeRosTask = mutation({
  args: { taskId: v.id("rosTasks") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const row = await ctx.db.get(args.taskId);
    if (!row) {
      throw new Error("Fant ikke oppgaven.");
    }
    await requireRosAnalysisEdit(ctx, row.rosAnalysisId, userId);
    await ctx.db.delete(args.taskId);
    return null;
  },
});

export const setRosTaskStatus = mutation({
  args: {
    taskId: v.id("rosTasks"),
    status: v.union(v.literal("open"), v.literal("done")),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const row = await ctx.db.get(args.taskId);
    if (!row) {
      throw new Error("Fant ikke oppgaven.");
    }
    await requireRosAnalysisEdit(ctx, row.rosAnalysisId, userId);
    await ctx.db.patch(args.taskId, {
      status: args.status,
      updatedAt: Date.now(),
    });
    return null;
  },
});
