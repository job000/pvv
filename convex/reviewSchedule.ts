import { v } from "convex/values";
import { query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";
import { canReadAssessment, requireWorkspaceMember } from "./lib/access";

export const listWorkspaceReviewItems = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }
    await requireWorkspaceMember(ctx, args.workspaceId, userId, "viewer");

    const assessments = await ctx.db
      .query("assessments")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    const pvv: Array<{
      kind: "pvv";
      assessmentId: Id<"assessments">;
      title: string;
      dueAt: number;
      notes: string | null;
    }> = [];

    for (const a of assessments) {
      if (a.nextRosPvvReviewAt == null) continue;
      if (!(await canReadAssessment(ctx, a, userId))) continue;
      pvv.push({
        kind: "pvv",
        assessmentId: a._id,
        title: a.title,
        dueAt: a.nextRosPvvReviewAt,
        notes: a.rosPvvReviewRoutineNotes?.trim() || null,
      });
    }

    const rosRows = await ctx.db
      .query("rosAnalyses")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    const candidates = await ctx.db
      .query("candidates")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    const candById = new Map(candidates.map((c) => [c._id, c] as const));

    const ros: Array<{
      kind: "ros";
      analysisId: Id<"rosAnalyses">;
      title: string;
      dueAt: number;
      notes: string | null;
      candidateCode: string;
    }> = [];

    for (const r of rosRows) {
      if (r.nextReviewAt == null) continue;
      const cand = r.candidateId ? candById.get(r.candidateId) : undefined;
      ros.push({
        kind: "ros",
        analysisId: r._id,
        title: r.title,
        dueAt: r.nextReviewAt,
        notes: r.reviewRoutineNotes?.trim() || null,
        candidateCode: cand?.code ?? "",
      });
    }

    const items = [...pvv, ...ros].sort((a, b) => a.dueAt - b.dueAt);
    return { items };
  },
});
