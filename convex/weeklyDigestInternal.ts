import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  type QueryCtx,
} from "./_generated/server";
import type { Id } from "./_generated/dataModel";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_ASSESSMENTS = 2000;

function isOpenAssessment(pipelineStatus: string | undefined): boolean {
  return (pipelineStatus ?? "not_assessed") !== "done";
}

async function ownerUserIdForAssessment(
  ctx: QueryCtx,
  assessmentId: Id<"assessments">,
  createdByUserId: Id<"users">,
): Promise<Id<"users">> {
  const collabs = await ctx.db
    .query("assessmentCollaborators")
    .withIndex("by_assessment", (q) => q.eq("assessmentId", assessmentId))
    .collect();
  const owner = collabs.find((c) => c.role === "owner");
  return owner?.userId ?? createdByUserId;
}

export type WeeklyDigestRow = {
  userId: Id<"users">;
  email: string;
  items: Array<{
    assessmentId: Id<"assessments">;
    workspaceId: Id<"workspaces">;
    title: string;
  }>;
};

export const listWeeklyDraftDigestTargets = internalQuery({
  args: { now: v.number() },
  handler: async (ctx, args): Promise<WeeklyDigestRow[]> => {
    const { now } = args;
    const assessments = await ctx.db.query("assessments").take(MAX_ASSESSMENTS);

    const byUser = new Map<
      Id<"users">,
      { email: string; items: WeeklyDigestRow["items"] }
    >();

    for (const a of assessments) {
      if (!isOpenAssessment(a.pipelineStatus)) {
        continue;
      }
      const ownerId = await ownerUserIdForAssessment(
        ctx,
        a._id,
        a.createdByUserId,
      );
      const user = await ctx.db.get(ownerId);
      const email = user?.email?.trim();
      if (!email) {
        continue;
      }
      const prev = byUser.get(ownerId);
      const item = {
        assessmentId: a._id,
        workspaceId: a.workspaceId,
        title: a.title,
      };
      if (prev) {
        prev.items.push(item);
      } else {
        byUser.set(ownerId, { email, items: [item] });
      }
    }

    const out: WeeklyDigestRow[] = [];
    for (const [userId, { email, items }] of byUser) {
      if (items.length === 0) {
        continue;
      }
      const settings = await ctx.db
        .query("userSettings")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .unique();
      if (settings?.notifyEmailDraftSummaryWeekly === false) {
        continue;
      }
      const last = settings?.lastWeeklyDraftDigestSentAt;
      if (last !== undefined && now - last < WEEK_MS) {
        continue;
      }
      out.push({ userId, email, items });
    }
    return out;
  },
});

export const markWeeklyDigestSent = internalMutation({
  args: {
    userId: v.id("users"),
    sentAt: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        lastWeeklyDraftDigestSentAt: args.sentAt,
      });
    } else {
      await ctx.db.insert("userSettings", {
        userId: args.userId,
        lastWeeklyDraftDigestSentAt: args.sentAt,
      });
    }
  },
});
