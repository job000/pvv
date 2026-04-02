import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

/**
 * Sletter vurdering og tilhørende rader i PVV (samme som `assessments.deleteAssessment`).
 * Kaller ikke GitHub.
 */
export async function cascadeDeleteAssessmentData(
  ctx: MutationCtx,
  assessmentId: Id<"assessments">,
): Promise<void> {
  const drafts = await ctx.db
    .query("assessmentDrafts")
    .withIndex("by_assessment", (q) => q.eq("assessmentId", assessmentId))
    .collect();
  for (const d of drafts) await ctx.db.delete(d._id);

  const versions = await ctx.db
    .query("assessmentVersions")
    .withIndex("by_assessment", (q) => q.eq("assessmentId", assessmentId))
    .collect();
  for (const v of versions) await ctx.db.delete(v._id);

  const collabs = await ctx.db
    .query("assessmentCollaborators")
    .withIndex("by_assessment", (q) => q.eq("assessmentId", assessmentId))
    .collect();
  for (const c of collabs) await ctx.db.delete(c._id);

  const tasks = await ctx.db
    .query("assessmentTasks")
    .withIndex("by_assessment", (q) => q.eq("assessmentId", assessmentId))
    .collect();
  for (const t of tasks) await ctx.db.delete(t._id);

  const notes = await ctx.db
    .query("assessmentNotes")
    .withIndex("by_assessment", (q) => q.eq("assessmentId", assessmentId))
    .collect();
  for (const n of notes) await ctx.db.delete(n._id);

  const shareLinks = await ctx.db
    .query("assessmentShareLinks")
    .withIndex("by_assessment", (q) => q.eq("assessmentId", assessmentId))
    .collect();
  for (const s of shareLinks) await ctx.db.delete(s._id);

  const invites = await ctx.db
    .query("assessmentInvites")
    .withIndex("by_assessment", (q) => q.eq("assessmentId", assessmentId))
    .collect();
  for (const inv of invites) await ctx.db.delete(inv._id);

  const rosLinks = await ctx.db
    .query("rosAnalysisAssessments")
    .withIndex("by_assessment", (q) => q.eq("assessmentId", assessmentId))
    .collect();
  for (const rl of rosLinks) await ctx.db.delete(rl._id);

  await ctx.db.delete(assessmentId);
}

/**
 * Sletter ROS-analyse og tilhørende rader (samme som `ros.removeAnalysis`).
 * Kaller ikke GitHub.
 */
export async function cascadeDeleteRosAnalysisData(
  ctx: MutationCtx,
  analysisId: Id<"rosAnalyses">,
): Promise<void> {
  const row = await ctx.db.get(analysisId);
  if (!row) {
    return;
  }
  const links = await ctx.db
    .query("rosAnalysisAssessments")
    .withIndex("by_ros_analysis", (q) => q.eq("rosAnalysisId", analysisId))
    .collect();
  for (const l of links) {
    await ctx.db.delete(l._id);
  }
  const versions = await ctx.db
    .query("rosAnalysisVersions")
    .withIndex("by_ros_analysis", (q) => q.eq("rosAnalysisId", analysisId))
    .collect();
  for (const v of versions) {
    await ctx.db.delete(v._id);
  }
  const tasks = await ctx.db
    .query("rosTasks")
    .withIndex("by_ros_analysis", (q) => q.eq("rosAnalysisId", analysisId))
    .collect();
  for (const t of tasks) {
    await ctx.db.delete(t._id);
  }
  const journalRows = await ctx.db
    .query("rosAnalysisJournalEntries")
    .withIndex("by_ros_analysis", (q) => q.eq("rosAnalysisId", analysisId))
    .collect();
  for (const j of journalRows) {
    await ctx.db.delete(j._id);
  }
  await ctx.db.delete(row._id);
}
