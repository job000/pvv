import type { QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

/**
 * Godkjente skjemainnsendinger → opprettet vurdering og ev. ROS (for merking i UI).
 */
export async function loadIntakeApprovedDerivedIds(
  ctx: QueryCtx,
  workspaceId: Id<"workspaces">,
): Promise<{
  assessmentIds: Set<Id<"assessments">>;
  rosAnalysisIds: Set<Id<"rosAnalyses">>;
}> {
  const rows = await ctx.db
    .query("intakeSubmissions")
    .withIndex("by_workspace_and_status_and_submitted_at", (q) =>
      q.eq("workspaceId", workspaceId).eq("status", "approved"),
    )
    .order("desc")
    .take(500);
  const assessmentIds = new Set<Id<"assessments">>();
  const rosAnalysisIds = new Set<Id<"rosAnalyses">>();
  for (const r of rows) {
    if (r.approvedAssessmentId) {
      assessmentIds.add(r.approvedAssessmentId);
    }
    if (r.approvedRosAnalysisId) {
      rosAnalysisIds.add(r.approvedRosAnalysisId);
    }
  }
  return { assessmentIds, rosAnalysisIds };
}
