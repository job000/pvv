import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

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

export const listComplianceReminderTargets = internalQuery({
  args: { now: v.number() },
  handler: async (ctx, args): Promise<ComplianceReminderTarget[]> => {
    const { now } = args;
    const rows = await ctx.db.query("assessments").take(800);
    const out: ComplianceReminderTarget[] = [];

    for (const a of rows) {
      if (!complianceIncomplete(a)) continue;
      if (
        a.lastComplianceReminderAt !== undefined &&
        now - a.lastComplianceReminderAt < COOLDOWN_MS
      ) {
        continue;
      }
      const collabs = await ctx.db
        .query("assessmentCollaborators")
        .withIndex("by_assessment", (q) => q.eq("assessmentId", a._id))
        .collect();
      const owner = collabs.find((c) => c.role === "owner");
      const uid = owner?.userId ?? a.createdByUserId;
      const u = await ctx.db.get(uid);
      const email = u?.email?.trim();
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
