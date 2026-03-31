import { v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import {
  assessmentPayloadValidator,
  complianceStatusValidator,
  pipelineStatusValidator,
  type AssessmentPayload,
} from "./schema";
import type { Doc, Id } from "./_generated/dataModel";
import {
  nextStepHint,
  normalizePipelineStatus,
  readinessLabel,
  type PipelineStatus,
} from "../lib/assessment-pipeline";
import {
  canEditAssessment,
  canReadAssessment,
  getAssessmentCollaborator,
  getWorkspaceMembership,
  requireAssessmentEdit,
  requireAssessmentRead,
  requireUserId,
  requireWorkspaceMember,
} from "./lib/access";
import { sanitizeAssessmentProcessTextFields } from "../lib/assessment-process-profile";
import { payloadToSnapshot } from "./lib/payloadSnapshot";
import { computeAllResults } from "./lib/rpaScoring";

async function refreshCachedPriority(
  ctx: MutationCtx,
  assessmentId: Id<"assessments">,
) {
  const draft = await ctx.db
    .query("assessmentDrafts")
    .withIndex("by_assessment", (q) => q.eq("assessmentId", assessmentId))
    .unique();
  if (!draft) {
    return;
  }
  const computed = computeAllResults(
    payloadToSnapshot(draft.payload as Record<string, unknown>),
  );
  await ctx.db.patch(assessmentId, {
    cachedPriorityScore: computed.priorityScore,
    cachedAp: computed.ap,
    cachedCriticality: computed.criticality,
  });
}

async function nextKanbanRank(
  ctx: MutationCtx,
  workspaceId: Id<"workspaces">,
  status: PipelineStatus,
): Promise<number> {
  const rows = await ctx.db
    .query("assessments")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
    .collect();
  let max = 0;
  for (const a of rows) {
    const s = normalizePipelineStatus(a.pipelineStatus);
    if (s !== status) {
      continue;
    }
    max = Math.max(max, a.kanbanRank ?? 0);
  }
  return max + 1;
}

async function requireOrgUnitInWorkspace(
  ctx: MutationCtx,
  workspaceId: Id<"workspaces">,
  orgUnitId: Id<"orgUnits">,
) {
  const u = await ctx.db.get(orgUnitId);
  if (!u || u.workspaceId !== workspaceId) {
    throw new Error("Ugyldig organisasjonsenhet.");
  }
}

function defaultPayload(): AssessmentPayload {
  return {
    processName: "",
    candidateId: "",
    processDescription: "",
    processGoal: "",
    processActors: "",
    processSystems: "",
    processFlowSummary: "",
    processVolumeNotes: "",
    processConstraints: "",
    processFollowUp: "",
    processScope: "unsure",
    processStability: 3,
    applicationStability: 3,
    structuredInput: 3,
    processVariability: 3,
    digitization: 3,
    processLength: 3,
    applicationCount: 3,
    ocrRequired: false,
    thinClientPercent: 30,
    baselineHours: 800,
    reworkHours: 50,
    auditHours: 40,
    avgCostPerYear: 850000,
    workingDays: 230,
    workingHoursPerDay: 7.5,
    employees: 3,
    criticalityBusinessImpact: 3,
    criticalityRegulatoryRisk: 3,
    hfOperationsSupportLevel: "unsure",
    hfSecurityInformationNotes: "",
    hfOrganizationalBreadthNotes: "",
    hfEconomicRationaleNotes: "",
    hfCriticalManualGapNotes: "",
    hfOperationsSupportNotes: "",
  };
}

export const listByWorkspace = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }
    await requireWorkspaceMember(ctx, args.workspaceId, userId, "viewer");
    const rows = await ctx.db
      .query("assessments")
      .withIndex("by_workspace_updated", (q) =>
        q.eq("workspaceId", args.workspaceId),
      )
      .order("desc")
      .collect();
    const out = [];
    for (const a of rows) {
      if (await canReadAssessment(ctx, a, userId)) {
        out.push(a);
      }
    }
    return out;
  },
});

export const create = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    title: v.string(),
    shareWithWorkspace: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireWorkspaceMember(ctx, args.workspaceId, userId, "member");
    const now = Date.now();
    const payload = defaultPayload();
    const computed = computeAllResults(
      payloadToSnapshot(payload as unknown as Record<string, unknown>),
    );
    const aid = await ctx.db.insert("assessments", {
      workspaceId: args.workspaceId,
      title: args.title.trim() || "Ny vurdering",
      createdByUserId: userId,
      updatedAt: now,
      shareWithWorkspace: args.shareWithWorkspace,
      pipelineStatus: "not_assessed",
      cachedPriorityScore: computed.priorityScore,
      cachedAp: computed.ap,
      cachedCriticality: computed.criticality,
      kanbanRank: now,
    });
    await ctx.db.insert("assessmentCollaborators", {
      assessmentId: aid,
      userId,
      role: "owner",
      addedAt: now,
    });
    await ctx.db.insert("assessmentDrafts", {
      assessmentId: aid,
      payload,
      updatedAt: now,
      updatedByUserId: userId,
    });
    return aid;
  },
});

export const getDraft = query({
  args: { assessmentId: v.id("assessments") },
  handler: async (ctx, args) => {
    const { assessment } = await requireAssessmentRead(ctx, args.assessmentId);
    const draft = await ctx.db
      .query("assessmentDrafts")
      .withIndex("by_assessment", (q) => q.eq("assessmentId", args.assessmentId))
      .unique();
    if (!draft) {
      return null;
    }
    const computed = computeAllResults(
      payloadToSnapshot(draft.payload as Record<string, unknown>),
    );
    return { assessment, draft, computed };
  },
});

export const saveDraft = mutation({
  args: {
    assessmentId: v.id("assessments"),
    payload: assessmentPayloadValidator,
  },
  handler: async (ctx, args) => {
    const { assessment, userId } = await requireAssessmentEdit(
      ctx,
      args.assessmentId,
    );
    const now = Date.now();
    const payload = sanitizeAssessmentProcessTextFields(
      args.payload as unknown as Record<string, unknown>,
    ) as AssessmentPayload;
    const existing = await ctx.db
      .query("assessmentDrafts")
      .withIndex("by_assessment", (q) =>
        q.eq("assessmentId", args.assessmentId),
      )
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        payload,
        updatedAt: now,
        updatedByUserId: userId,
      });
    } else {
      await ctx.db.insert("assessmentDrafts", {
        assessmentId: args.assessmentId,
        payload,
        updatedAt: now,
        updatedByUserId: userId,
      });
    }
    await ctx.db.patch(assessment._id, { updatedAt: now });
    await refreshCachedPriority(ctx, args.assessmentId);
    return null;
  },
});

export const createVersion = mutation({
  args: {
    assessmentId: v.id("assessments"),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { assessment, userId } = await requireAssessmentEdit(
      ctx,
      args.assessmentId,
    );
    const draft = await ctx.db
      .query("assessmentDrafts")
      .withIndex("by_assessment", (q) =>
        q.eq("assessmentId", args.assessmentId),
      )
      .unique();
    if (!draft) {
      throw new Error("Ingen utkast å lagre.");
    }
    const payload = draft.payload as Record<string, unknown>;
    const snapshot = payloadToSnapshot(payload);
    const computed = computeAllResults(snapshot);
    const last = await ctx.db
      .query("assessmentVersions")
      .withIndex("by_assessment", (q) =>
        q.eq("assessmentId", args.assessmentId),
      )
      .order("desc")
      .first();
    const nextVersion = (last?.version ?? 0) + 1;
    const now = Date.now();
    await ctx.db.insert("assessmentVersions", {
      assessmentId: args.assessmentId,
      version: nextVersion,
      note: args.note,
      payload: draft.payload,
      computed,
      createdByUserId: userId,
      createdAt: now,
    });
    await ctx.db.patch(assessment._id, {
      updatedAt: now,
      cachedPriorityScore: computed.priorityScore,
      cachedAp: computed.ap,
      cachedCriticality: computed.criticality,
    });
    return nextVersion;
  },
});

/** Gjenopprett utkast fra en lagret versjon (utkastet overskrives; historikk beholdes). */
export const restoreDraftFromVersion = mutation({
  args: {
    assessmentId: v.id("assessments"),
    version: v.number(),
  },
  handler: async (ctx, args) => {
    const { assessment, userId } = await requireAssessmentEdit(
      ctx,
      args.assessmentId,
    );
    if (args.version < 1 || !Number.isInteger(args.version)) {
      throw new Error("Ugyldig versjonsnummer.");
    }
    const ver = await ctx.db
      .query("assessmentVersions")
      .withIndex("by_assessment_version", (q) =>
        q.eq("assessmentId", args.assessmentId).eq("version", args.version),
      )
      .unique();
    if (!ver) {
      throw new Error("Fant ikke denne versjonen.");
    }
    const now = Date.now();
    const existing = await ctx.db
      .query("assessmentDrafts")
      .withIndex("by_assessment", (q) =>
        q.eq("assessmentId", args.assessmentId),
      )
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        payload: ver.payload,
        updatedAt: now,
        updatedByUserId: userId,
      });
    } else {
      await ctx.db.insert("assessmentDrafts", {
        assessmentId: args.assessmentId,
        payload: ver.payload,
        updatedAt: now,
        updatedByUserId: userId,
      });
    }
    await ctx.db.patch(assessment._id, { updatedAt: now });
    await refreshCachedPriority(ctx, args.assessmentId);
    return null;
  },
});

export const listPipelineBoard = query({
  args: {
    workspaceId: v.id("workspaces"),
    sprintFilter: v.optional(v.union(v.id("sprints"), v.literal("all"))),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }
    await requireWorkspaceMember(ctx, args.workspaceId, userId, "viewer");
    const rows = await ctx.db
      .query("assessments")
      .withIndex("by_workspace_updated", (q) =>
        q.eq("workspaceId", args.workspaceId),
      )
      .order("desc")
      .collect();
    const sprintFilter = args.sprintFilter ?? "all";
    const out: Array<{
      assessment: (typeof rows)[0];
      priorityScore: number;
      effectivePriority: number;
      pipelineStatus: PipelineStatus;
      nextStepHint: string;
      readinessLabel: string;
      sprintName: string | null;
      versionCount: number;
      latestVersionNumber: number;
    }> = [];
    for (const a of rows) {
      if (!(await canReadAssessment(ctx, a, userId))) {
        continue;
      }
      if (sprintFilter !== "all" && a.sprintId !== sprintFilter) {
        continue;
      }
      const draft = await ctx.db
        .query("assessmentDrafts")
        .withIndex("by_assessment", (q) => q.eq("assessmentId", a._id))
        .unique();
      const snapshot = draft
        ? payloadToSnapshot(draft.payload as Record<string, unknown>)
        : payloadToSnapshot(defaultPayload() as unknown as Record<string, unknown>);
      const computed = computeAllResults(snapshot);
      const status = normalizePipelineStatus(a.pipelineStatus);
      const base = computed.priorityScore;
      const effective =
        a.manualPriorityOverride !== undefined && a.manualPriorityOverride !== null
          ? a.manualPriorityOverride
          : base;
      let sprintName: string | null = null;
      if (a.sprintId) {
        const sp = await ctx.db.get(a.sprintId);
        sprintName = sp?.name ?? null;
      }
      const versionRows = await ctx.db
        .query("assessmentVersions")
        .withIndex("by_assessment", (q) => q.eq("assessmentId", a._id))
        .collect();
      const versionCount = versionRows.length;
      const latestVersionNumber =
        versionCount === 0
          ? 0
          : Math.max(...versionRows.map((x) => x.version));
      out.push({
        assessment: a,
        priorityScore: base,
        effectivePriority: effective,
        pipelineStatus: status,
        nextStepHint: nextStepHint(status),
        readinessLabel: readinessLabel(status),
        sprintName,
        versionCount,
        latestVersionNumber,
      });
    }
    out.sort((x, y) => {
      const rx = x.assessment.kanbanRank ?? 0;
      const ry = y.assessment.kanbanRank ?? 0;
      if (y.effectivePriority !== x.effectivePriority) {
        return y.effectivePriority - x.effectivePriority;
      }
      return ry - rx;
    });
    return out;
  },
});

export const listPriorityHighlights = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }
    const cap = Math.min(24, Math.max(1, args.limit ?? 12));
    const memberships = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const out: Array<{
      assessment: Doc<"assessments">;
      workspaceId: Id<"workspaces">;
      workspaceName: string;
      priorityScore: number;
      effectivePriority: number;
      pipelineStatus: PipelineStatus;
      nextStepHint: string;
      readinessLabel: string;
    }> = [];
    for (const m of memberships) {
      const ws = await ctx.db.get(m.workspaceId);
      if (!ws) {
        continue;
      }
      const assessments = await ctx.db
        .query("assessments")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", m.workspaceId))
        .collect();
      for (const a of assessments) {
        if (!(await canReadAssessment(ctx, a, userId))) {
          continue;
        }
        const draft = await ctx.db
          .query("assessmentDrafts")
          .withIndex("by_assessment", (q) => q.eq("assessmentId", a._id))
          .unique();
        const snapshot = draft
          ? payloadToSnapshot(draft.payload as Record<string, unknown>)
          : payloadToSnapshot(defaultPayload() as unknown as Record<string, unknown>);
        const computed = computeAllResults(snapshot);
        const status = normalizePipelineStatus(a.pipelineStatus);
        const base = computed.priorityScore;
        const effective =
          a.manualPriorityOverride !== undefined && a.manualPriorityOverride !== null
            ? a.manualPriorityOverride
            : base;
        out.push({
          assessment: a,
          workspaceId: m.workspaceId,
          workspaceName: ws.name,
          priorityScore: base,
          effectivePriority: effective,
          pipelineStatus: status,
          nextStepHint: nextStepHint(status),
          readinessLabel: readinessLabel(status),
        });
      }
    }
    out.sort((x, y) => y.effectivePriority - x.effectivePriority);
    return out.slice(0, cap);
  },
});

export const setPipelineStatus = mutation({
  args: {
    assessmentId: v.id("assessments"),
    status: pipelineStatusValidator,
  },
  handler: async (ctx, args) => {
    const { assessment } = await requireAssessmentEdit(ctx, args.assessmentId);
    const status = args.status as PipelineStatus;
    const rank = await nextKanbanRank(ctx, assessment.workspaceId, status);
    await ctx.db.patch(args.assessmentId, {
      pipelineStatus: args.status,
      kanbanRank: rank,
      updatedAt: Date.now(),
    });
  },
});

export const setManualPriorityOverride = mutation({
  args: {
    assessmentId: v.id("assessments"),
    manualPriorityOverride: v.union(v.number(), v.null()),
  },
  handler: async (ctx, args) => {
    await requireAssessmentEdit(ctx, args.assessmentId);
    if (args.manualPriorityOverride !== null) {
      const v0 = args.manualPriorityOverride;
      if (Number.isNaN(v0) || v0 < 0 || v0 > 100) {
        throw new Error("Manuell prioritet må være mellom 0 og 100.");
      }
    }
    await ctx.db.patch(args.assessmentId, {
      manualPriorityOverride:
        args.manualPriorityOverride === null ? undefined : args.manualPriorityOverride,
      updatedAt: Date.now(),
    });
  },
});

export const setAssessmentSprint = mutation({
  args: {
    assessmentId: v.id("assessments"),
    sprintId: v.union(v.id("sprints"), v.null()),
  },
  handler: async (ctx, args) => {
    const { assessment } = await requireAssessmentEdit(ctx, args.assessmentId);
    if (args.sprintId !== null) {
      const sprint = await ctx.db.get(args.sprintId);
      if (!sprint || sprint.workspaceId !== assessment.workspaceId) {
        throw new Error("Ugyldig sprint for dette arbeidsområdet.");
      }
    }
    await ctx.db.patch(args.assessmentId, {
      sprintId: args.sprintId === null ? undefined : args.sprintId,
      updatedAt: Date.now(),
    });
  },
});

export const setAssessmentOrgUnit = mutation({
  args: {
    assessmentId: v.id("assessments"),
    orgUnitId: v.union(v.id("orgUnits"), v.null()),
  },
  handler: async (ctx, args) => {
    const { assessment } = await requireAssessmentEdit(ctx, args.assessmentId);
    if (args.orgUnitId !== null) {
      await requireOrgUnitInWorkspace(
        ctx,
        assessment.workspaceId,
        args.orgUnitId,
      );
    }
    await ctx.db.patch(args.assessmentId, {
      orgUnitId: args.orgUnitId === null ? undefined : args.orgUnitId,
      updatedAt: Date.now(),
    });
  },
});

export const updateAssessmentCompliance = mutation({
  args: {
    assessmentId: v.id("assessments"),
    rosStatus: v.optional(complianceStatusValidator),
    rosUrl: v.optional(v.union(v.string(), v.null())),
    rosNotes: v.optional(v.union(v.string(), v.null())),
    rosCompletedAt: v.optional(v.union(v.number(), v.null())),
    pddStatus: v.optional(complianceStatusValidator),
    pddUrl: v.optional(v.union(v.string(), v.null())),
    pddNotes: v.optional(v.union(v.string(), v.null())),
    pddCompletedAt: v.optional(v.union(v.number(), v.null())),
  },
  handler: async (ctx, args) => {
    await requireAssessmentEdit(ctx, args.assessmentId);
    const now = Date.now();
    const patch: {
      updatedAt: number;
      rosStatus?: typeof args.rosStatus;
      rosUrl?: string;
      rosNotes?: string;
      rosCompletedAt?: number;
      pddStatus?: typeof args.pddStatus;
      pddUrl?: string;
      pddNotes?: string;
      pddCompletedAt?: number;
    } = { updatedAt: now };
    const strOrClear = (val: string | null | undefined) => {
      if (val == null) {
        return undefined;
      }
      const t = val.trim();
      return t || undefined;
    };
    if (args.rosStatus !== undefined) {
      patch.rosStatus = args.rosStatus;
    }
    if (args.rosUrl !== undefined) {
      patch.rosUrl = strOrClear(args.rosUrl);
    }
    if (args.rosNotes !== undefined) {
      patch.rosNotes = strOrClear(args.rosNotes);
    }
    if (args.rosCompletedAt !== undefined) {
      patch.rosCompletedAt =
        args.rosCompletedAt === null ? undefined : args.rosCompletedAt;
    } else if (args.rosStatus === "completed") {
      patch.rosCompletedAt = now;
    }
    if (args.pddStatus !== undefined) {
      patch.pddStatus = args.pddStatus;
    }
    if (args.pddUrl !== undefined) {
      patch.pddUrl = strOrClear(args.pddUrl);
    }
    if (args.pddNotes !== undefined) {
      patch.pddNotes = strOrClear(args.pddNotes);
    }
    if (args.pddCompletedAt !== undefined) {
      patch.pddCompletedAt =
        args.pddCompletedAt === null ? undefined : args.pddCompletedAt;
    } else if (args.pddStatus === "completed") {
      patch.pddCompletedAt = now;
    }
    await ctx.db.patch(args.assessmentId, patch);
  },
});

export const listVersions = query({
  args: { assessmentId: v.id("assessments") },
  handler: async (ctx, args) => {
    await requireAssessmentRead(ctx, args.assessmentId);
    return await ctx.db
      .query("assessmentVersions")
      .withIndex("by_assessment", (q) =>
        q.eq("assessmentId", args.assessmentId),
      )
      .order("desc")
      .collect();
  },
});

export const listCollaborators = query({
  args: { assessmentId: v.id("assessments") },
  handler: async (ctx, args) => {
    await requireAssessmentRead(ctx, args.assessmentId);
    const rows = await ctx.db
      .query("assessmentCollaborators")
      .withIndex("by_assessment", (q) =>
        q.eq("assessmentId", args.assessmentId),
      )
      .collect();
    const enriched = [];
    for (const r of rows) {
      const u = await ctx.db.get(r.userId);
      enriched.push({
        ...r,
        email: u?.email ?? null,
        name: u?.name ?? null,
      });
    }
    return enriched;
  },
});

export const inviteCollaborator = mutation({
  args: {
    assessmentId: v.id("assessments"),
    email: v.string(),
    role: v.union(
      v.literal("editor"),
      v.literal("reviewer"),
      v.literal("viewer"),
    ),
  },
  handler: async (ctx, args) => {
    const { assessment, userId } = await requireAssessmentEdit(
      ctx,
      args.assessmentId,
    );
    const email = args.email.trim().toLowerCase();
    if (!email) {
      throw new Error("E-post mangler.");
    }
    const foundUser = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .unique();
    if (foundUser) {
      const existing = await ctx.db
        .query("assessmentCollaborators")
        .withIndex("by_user_assessment", (q) =>
          q.eq("userId", foundUser._id).eq("assessmentId", args.assessmentId),
        )
        .unique();
      if (!existing) {
        const wm = await getWorkspaceMembership(
          ctx,
          assessment.workspaceId,
          foundUser._id,
        );
        if (!wm) {
          await ctx.db.insert("workspaceMembers", {
            workspaceId: assessment.workspaceId,
            userId: foundUser._id,
            role: "viewer",
            joinedAt: Date.now(),
          });
        }
        await ctx.db.insert("assessmentCollaborators", {
          assessmentId: args.assessmentId,
          userId: foundUser._id,
          role: args.role,
          addedAt: Date.now(),
        });
      }
      return { kind: "linked" as const };
    }
    const token = `inv_${Date.now()}_${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
    await ctx.db.insert("assessmentInvites", {
      assessmentId: args.assessmentId,
      email,
      role: args.role,
      token,
      invitedByUserId: userId,
      createdAt: Date.now(),
    });
    return { kind: "pending" as const, token };
  },
});

export const acceptInvitesForEmail = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const user = await ctx.db.get(userId);
    const email = user?.email?.trim().toLowerCase();
    if (!email) {
      return 0;
    }
    const invites = await ctx.db
      .query("assessmentInvites")
      .withIndex("by_email", (q) => q.eq("email", email))
      .collect();
    let n = 0;
    for (const inv of invites) {
      const assessment = await ctx.db.get(inv.assessmentId);
      if (!assessment) {
        await ctx.db.delete(inv._id);
        continue;
      }
      const wm = await getWorkspaceMembership(
        ctx,
        assessment.workspaceId,
        userId,
      );
      if (!wm) {
        await ctx.db.insert("workspaceMembers", {
          workspaceId: assessment.workspaceId,
          userId,
          role: "viewer",
          joinedAt: Date.now(),
        });
      }
      const exists = await ctx.db
        .query("assessmentCollaborators")
        .withIndex("by_user_assessment", (q) =>
          q.eq("userId", userId).eq("assessmentId", inv.assessmentId),
        )
        .unique();
      if (!exists) {
        await ctx.db.insert("assessmentCollaborators", {
          assessmentId: inv.assessmentId,
          userId,
          role: inv.role,
          addedAt: Date.now(),
        });
        n++;
      }
      await ctx.db.delete(inv._id);
    }
    return n;
  },
});

export const setShareWithWorkspace = mutation({
  args: {
    assessmentId: v.id("assessments"),
    shareWithWorkspace: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { assessment, userId } = await requireAssessmentEdit(
      ctx,
      args.assessmentId,
    );
    const collab = await getAssessmentCollaborator(ctx, args.assessmentId, userId);
    const canOwnerEditor =
      collab?.role === "owner" || collab?.role === "editor";
    if (!canOwnerEditor) {
      await requireWorkspaceMember(
        ctx,
        assessment.workspaceId,
        userId,
        "admin",
      );
    }
    await ctx.db.patch(args.assessmentId, {
      shareWithWorkspace: args.shareWithWorkspace,
      updatedAt: Date.now(),
    });
  },
});

export const getMyAccess = query({
  args: { assessmentId: v.id("assessments") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }
    const assessment = await ctx.db.get(args.assessmentId);
    if (!assessment) {
      return null;
    }
    const read = await canReadAssessment(ctx, assessment, userId);
    if (!read) {
      return null;
    }
    const edit = await canEditAssessment(ctx, assessment, userId);
    const collab = await getAssessmentCollaborator(ctx, args.assessmentId, userId);
    const wm = await getWorkspaceMembership(ctx, assessment.workspaceId, userId);
    return {
      canEdit: edit,
      collaboratorRole: collab?.role ?? null,
      workspaceRole: wm?.role ?? null,
      shareWithWorkspace: assessment.shareWithWorkspace,
    };
  },
});

export const listMineAcrossWorkspaces = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }
    const collabs = await ctx.db
      .query("assessmentCollaborators")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const out = [];
    for (const c of collabs) {
      const a = await ctx.db.get(c.assessmentId);
      if (a && (await canReadAssessment(ctx, a, userId))) {
        out.push({ assessment: a, role: c.role });
      }
    }
    return out;
  },
});
