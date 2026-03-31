import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Doc, Id } from "./_generated/dataModel";
import {
  requireUserId,
  requireWorkspaceMember,
} from "./lib/access";

export const getCandidateForGithub = internalQuery({
  args: { candidateId: v.id("candidates") },
  handler: async (ctx, args) => {
    const candidate = await ctx.db.get(args.candidateId);
    if (!candidate) {
      return null;
    }
    const workspace = await ctx.db.get(candidate.workspaceId);
    return { candidate, workspace };
  },
});

export const assertMemberForWorkspace = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await requireWorkspaceMember(ctx, args.workspaceId, args.userId, "member");
    return true;
  },
});

/** Data til rik Markdown for GitHub-prosjekt-utkast (PVV + ROS + notater). */
export const getCandidateGithubSyncContext = internalQuery({
  args: { candidateId: v.id("candidates") },
  handler: async (ctx, args) => {
    const candidate = await ctx.db.get(args.candidateId);
    if (!candidate) {
      return null;
    }
    const workspace = await ctx.db.get(candidate.workspaceId);
    if (!workspace) {
      return null;
    }
    let orgUnitName: string | null = null;
    if (candidate.orgUnitId) {
      const ou = await ctx.db.get(candidate.orgUnitId);
      orgUnitName = ou?.name ?? null;
    }
    const assessments = await ctx.db
      .query("assessments")
      .withIndex("by_workspace", (q) =>
        q.eq("workspaceId", candidate.workspaceId),
      )
      .collect();
    const linkedAssessments: Array<{
      assessmentId: Id<"assessments">;
      title: string;
      pipelineStatus: string | undefined;
      rosStatus: string | undefined;
      rosNotes: string | undefined;
      rosUrl: string | undefined;
      processDescriptionShort: string | undefined;
      notes: Array<{ body: string; createdAt: number; authorLabel: string }>;
    }> = [];
    for (const a of assessments) {
      const draft = await ctx.db
        .query("assessmentDrafts")
        .withIndex("by_assessment", (q) => q.eq("assessmentId", a._id))
        .first();
      if (draft?.payload?.candidateId !== candidate.code) {
        continue;
      }
      const pd = draft.payload.processDescription?.trim();
      const noteRows = await ctx.db
        .query("assessmentNotes")
        .withIndex("by_assessment", (q) => q.eq("assessmentId", a._id))
        .collect();
      noteRows.sort((x, y) => y.createdAt - x.createdAt);
      const notes: Array<{
        body: string;
        createdAt: number;
        authorLabel: string;
      }> = [];
      for (const n of noteRows.slice(0, 15)) {
        const u = await ctx.db.get(n.authorUserId);
        notes.push({
          body: n.body,
          createdAt: n.createdAt,
          authorLabel: u?.name ?? u?.email ?? "Bruker",
        });
      }
      linkedAssessments.push({
        assessmentId: a._id,
        title: a.title,
        pipelineStatus: a.pipelineStatus,
        rosStatus: a.rosStatus,
        rosNotes: a.rosNotes,
        rosUrl: a.rosUrl,
        processDescriptionShort:
          pd && pd.length > 0 ? pd.slice(0, 2000) : undefined,
        notes,
      });
    }
    const rosAnalyses = await ctx.db
      .query("rosAnalyses")
      .withIndex("by_candidate", (q) => q.eq("candidateId", args.candidateId))
      .collect();
    const rosOut = rosAnalyses.map((r: Doc<"rosAnalyses">) => ({
      _id: r._id,
      notes: r.notes,
      methodologyStatement: r.methodologyStatement,
      contextSummary: r.contextSummary,
      scopeAndCriteria: r.scopeAndCriteria,
      updatedAt: r.updatedAt,
    }));
    return {
      candidate,
      workspaceName: workspace.name,
      workspaceId: candidate.workspaceId,
      orgUnitName,
      linkedAssessments,
      rosAnalyses: rosOut,
    };
  },
});

export const setGithubProjectItem = internalMutation({
  args: {
    candidateId: v.id("candidates"),
    itemNodeId: v.union(v.string(), v.null()),
    statusOptionId: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    if (args.itemNodeId === null) {
      await ctx.db.patch(args.candidateId, {
        githubProjectItemNodeId: undefined,
        githubProjectStatusOptionId: undefined,
        updatedAt: now,
      });
      return;
    }
    await ctx.db.patch(args.candidateId, {
      githubProjectItemNodeId: args.itemNodeId,
      updatedAt: now,
      ...(args.statusOptionId !== undefined
        ? {
            githubProjectStatusOptionId:
              args.statusOptionId === null ? undefined : args.statusOptionId,
          }
        : {}),
    });
  },
});

export const listByWorkspace = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }
    await requireWorkspaceMember(ctx, args.workspaceId, userId, "viewer");
    return await ctx.db
      .query("candidates")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
  },
});

function trimOpt(s: string | undefined): string | undefined {
  if (s === undefined) return undefined;
  const t = s.trim();
  return t || undefined;
}

export const create = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.string(),
    code: v.string(),
    notes: v.optional(v.string()),
    linkHintBusinessOwner: v.optional(v.string()),
    linkHintSystems: v.optional(v.string()),
    linkHintComplianceNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireWorkspaceMember(ctx, args.workspaceId, userId, "member");
    const name = args.name.trim();
    const code = args.code.trim().toUpperCase().replace(/\s+/g, "-");
    if (!name || !code) {
      throw new Error("Navn og kode er påkrevd.");
    }
    const clash = await ctx.db
      .query("candidates")
      .withIndex("by_workspace_code", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("code", code),
      )
      .unique();
    if (clash) {
      throw new Error("Koden er allerede i bruk i dette arbeidsområdet.");
    }
    const now = Date.now();
    return await ctx.db.insert("candidates", {
      workspaceId: args.workspaceId,
      name,
      code,
      notes: args.notes?.trim() || undefined,
      linkHintBusinessOwner: trimOpt(args.linkHintBusinessOwner),
      linkHintSystems: trimOpt(args.linkHintSystems),
      linkHintComplianceNotes: trimOpt(args.linkHintComplianceNotes),
      createdByUserId: userId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    candidateId: v.id("candidates"),
    name: v.optional(v.string()),
    code: v.optional(v.string()),
    notes: v.optional(v.union(v.string(), v.null())),
    orgUnitId: v.optional(v.union(v.id("orgUnits"), v.null())),
    linkHintBusinessOwner: v.optional(v.union(v.string(), v.null())),
    linkHintSystems: v.optional(v.union(v.string(), v.null())),
    linkHintComplianceNotes: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const row = await ctx.db.get(args.candidateId);
    if (!row) {
      throw new Error("Kandidat finnes ikke.");
    }
    await requireWorkspaceMember(ctx, row.workspaceId, userId, "member");
    if (args.orgUnitId !== undefined && args.orgUnitId !== null) {
      const ou = await ctx.db.get(args.orgUnitId);
      if (!ou || ou.workspaceId !== row.workspaceId) {
        throw new Error("Ugyldig organisasjonsenhet.");
      }
    }
    const patch: {
      name?: string;
      code?: string;
      notes?: string;
      orgUnitId?: Id<"orgUnits">;
      linkHintBusinessOwner?: string;
      linkHintSystems?: string;
      linkHintComplianceNotes?: string;
      updatedAt: number;
    } = { updatedAt: Date.now() };
    if (args.name !== undefined) {
      patch.name = args.name.trim();
      if (!patch.name) {
        throw new Error("Navn kan ikke være tomt.");
      }
    }
    if (args.code !== undefined) {
      const code = args.code.trim().toUpperCase().replace(/\s+/g, "-");
      if (!code) {
        throw new Error("Kode kan ikke være tom.");
      }
      const clash = await ctx.db
        .query("candidates")
        .withIndex("by_workspace_code", (q) =>
          q.eq("workspaceId", row.workspaceId).eq("code", code),
        )
        .unique();
      if (clash && clash._id !== args.candidateId) {
        throw new Error("Koden er allerede i bruk.");
      }
      patch.code = code;
    }
    if (args.notes !== undefined) {
      patch.notes = args.notes === null ? undefined : args.notes.trim();
    }
    if (args.orgUnitId !== undefined) {
      patch.orgUnitId = args.orgUnitId === null ? undefined : args.orgUnitId;
    }
    if (args.linkHintBusinessOwner !== undefined) {
      patch.linkHintBusinessOwner =
        args.linkHintBusinessOwner === null
          ? undefined
          : trimOpt(args.linkHintBusinessOwner);
    }
    if (args.linkHintSystems !== undefined) {
      patch.linkHintSystems =
        args.linkHintSystems === null ? undefined : trimOpt(args.linkHintSystems);
    }
    if (args.linkHintComplianceNotes !== undefined) {
      patch.linkHintComplianceNotes =
        args.linkHintComplianceNotes === null
          ? undefined
          : trimOpt(args.linkHintComplianceNotes);
    }
    await ctx.db.patch(args.candidateId, patch);
    return null;
  },
});

export const remove = mutation({
  args: { candidateId: v.id("candidates") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const row = await ctx.db.get(args.candidateId);
    if (!row) {
      throw new Error("Kandidat finnes ikke.");
    }
    await requireWorkspaceMember(ctx, row.workspaceId, userId, "admin");
    await ctx.db.delete(args.candidateId);
    return null;
  },
});
