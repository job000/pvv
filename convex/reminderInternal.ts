import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  type QueryCtx,
} from "./_generated/server";
import type { Id } from "./_generated/dataModel";

const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
const REVIEW_COOLDOWN_MS = COOLDOWN_MS;

function complianceIncomplete(a: {
  rosStatus?: string | null;
  pddStatus?: string | null;
}): boolean {
  const ros = a.rosStatus ?? "not_started";
  const pdd = a.pddStatus ?? "not_started";
  const rOk = ros === "completed" || ros === "not_applicable";
  const pOk = pdd === "completed" || pdd === "not_applicable";
  return !(rOk && pOk);
}

export type ComplianceReminderTarget = {
  assessmentId: Id<"assessments">;
  workspaceId: Id<"workspaces">;
  title: string;
  toEmail: string;
};

async function emailForAssessmentOwner(
  ctx: QueryCtx,
  assessmentId: Id<"assessments">,
  createdByUserId: Id<"users">,
): Promise<string | null> {
  const collabs = await ctx.db
    .query("assessmentCollaborators")
    .withIndex("by_assessment", (q) => q.eq("assessmentId", assessmentId))
    .collect();
  const owner = collabs.find((c) => c.role === "owner");
  const uid = owner?.userId ?? createdByUserId;
  const u = await ctx.db.get(uid);
  const email = u?.email?.trim();
  return email || null;
}

export const listComplianceReminderTargets = internalQuery({
  args: { now: v.number() },
  handler: async (ctx, args): Promise<ComplianceReminderTarget[]> => {
    const { now } = args;
    const out: ComplianceReminderTarget[] = [];

    const rows = await ctx.db
      .query("assessments")
      .withIndex("by_workspace_updated")
      .order("desc")
      .take(800);

    for (const a of rows) {
      if (!complianceIncomplete(a)) continue;
      if (
        a.lastComplianceReminderAt !== undefined &&
        now - a.lastComplianceReminderAt < COOLDOWN_MS
      ) {
        continue;
      }
      const email = await emailForAssessmentOwner(
        ctx,
        a._id,
        a.createdByUserId,
      );
      if (!email) continue;
      out.push({
        assessmentId: a._id,
        workspaceId: a.workspaceId,
        title: a.title,
        toEmail: email,
      });
    }
    return out;
  },
});

export const markComplianceReminderSent = internalMutation({
  args: { assessmentId: v.id("assessments") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.assessmentId, {
      lastComplianceReminderAt: Date.now(),
    });
  },
});

export type ReviewDueReminderTarget =
  | {
      kind: "assessment";
      assessmentId: Id<"assessments">;
      workspaceId: Id<"workspaces">;
      title: string;
      toEmail: string;
    }
  | {
      kind: "ros";
      rosAnalysisId: Id<"rosAnalyses">;
      workspaceId: Id<"workspaces">;
      title: string;
      toEmail: string;
    };

export const listReviewDueReminderTargets = internalQuery({
  args: { now: v.number() },
  handler: async (ctx, args): Promise<ReviewDueReminderTarget[]> => {
    const { now } = args;
    const out: ReviewDueReminderTarget[] = [];

    const assessments = await ctx.db
      .query("assessments")
      .withIndex("by_workspace_updated")
      .order("desc")
      .take(800);
    for (const a of assessments) {
      if (a.nextRosPvvReviewAt == null || a.nextRosPvvReviewAt > now) {
        continue;
      }
      if (
        a.lastReviewDueReminderAt !== undefined &&
        now - a.lastReviewDueReminderAt < REVIEW_COOLDOWN_MS
      ) {
        continue;
      }
      const email = await emailForAssessmentOwner(
        ctx,
        a._id,
        a.createdByUserId,
      );
      if (!email) continue;
      out.push({
        kind: "assessment",
        assessmentId: a._id,
        workspaceId: a.workspaceId,
        title: a.title,
        toEmail: email,
      });
    }

    const rosRows = await ctx.db
      .query("rosAnalyses")
      .withIndex("by_workspace_updated")
      .order("desc")
      .take(800);
    for (const r of rosRows) {
      if (r.nextReviewAt == null || r.nextReviewAt > now) {
        continue;
      }
      if (
        r.lastReviewDueReminderAt !== undefined &&
        now - r.lastReviewDueReminderAt < REVIEW_COOLDOWN_MS
      ) {
        continue;
      }
      const u = await ctx.db.get(r.createdByUserId);
      const email = u?.email?.trim();
      if (!email) continue;
      out.push({
        kind: "ros",
        rosAnalysisId: r._id,
        workspaceId: r.workspaceId,
        title: r.title,
        toEmail: email,
      });
    }

    return out;
  },
});

export const markReviewReminderSent = internalMutation({
  args: {
    kind: v.union(v.literal("assessment"), v.literal("ros")),
    assessmentId: v.optional(v.id("assessments")),
    rosAnalysisId: v.optional(v.id("rosAnalyses")),
  },
  handler: async (ctx, args) => {
    const t = Date.now();
    if (args.kind === "assessment") {
      if (!args.assessmentId) {
        throw new Error("assessmentId mangler.");
      }
      await ctx.db.patch(args.assessmentId, {
        lastReviewDueReminderAt: t,
      });
    } else {
      if (!args.rosAnalysisId) {
        throw new Error("rosAnalysisId mangler.");
      }
      await ctx.db.patch(args.rosAnalysisId, {
        lastReviewDueReminderAt: t,
      });
    }
  },
});
