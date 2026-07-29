import { v } from "convex/values";
import { buildRosAiContextDocument } from "../lib/ros-ai-context";
import { normalizeCellItems } from "../lib/ros-cell-items";
import type { AssessmentPayload } from "./schema";
import { internalQuery } from "./_generated/server";
import { canReadAssessment, requireWorkspaceMember } from "./lib/access";

/** Intern kontekst for AI-forslag — assessment-utkast + prosessdesign. */
export const getRosAiContextInternal = internalQuery({
  args: { analysisId: v.id("rosAnalyses"), userId: v.id("users") },
  returns: v.union(
    v.object({
      workspaceId: v.id("workspaces"),
      contextText: v.string(),
      rowCount: v.number(),
      colCount: v.number(),
      hasLinkedSources: v.boolean(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.analysisId);
    if (!row) return null;
    try {
      await requireWorkspaceMember(
        ctx,
        row.workspaceId,
        args.userId,
        "viewer",
      );
    } catch {
      return null;
    }

    const cand = row.candidateId ? await ctx.db.get(row.candidateId) : null;
    const links = await ctx.db
      .query("rosAnalysisAssessments")
      .withIndex("by_ros_analysis", (q) =>
        q.eq("rosAnalysisId", args.analysisId),
      )
      .collect();

    const assessmentIds: Array<(typeof links)[number]["assessmentId"]> = [];
    const seenAssessment = new Set<string>();
    for (const l of links) {
      if (seenAssessment.has(String(l.assessmentId))) continue;
      seenAssessment.add(String(l.assessmentId));
      assessmentIds.push(l.assessmentId);
    }
    if (row.assessmentId && !seenAssessment.has(String(row.assessmentId))) {
      assessmentIds.push(row.assessmentId);
    }

    const assessments: Array<{
      title: string;
      payload: AssessmentPayload | null;
    }> = [];
    for (const assessmentId of assessmentIds) {
      const a = await ctx.db.get(assessmentId);
      if (!a || !(await canReadAssessment(ctx, a, args.userId))) continue;
      const draft = await ctx.db
        .query("assessmentDrafts")
        .withIndex("by_assessment", (q) => q.eq("assessmentId", a._id))
        .unique();
      assessments.push({
        title: a.title,
        payload: (draft?.payload as AssessmentPayload | undefined) ?? null,
      });
    }

    const pdds: Array<{
      processTitle?: string;
      shortDescription?: string;
      executiveSummary?: string;
      purpose?: string;
      asIsProcessName?: string;
      asIsShortDescription?: string;
      asIsRoles?: string;
      asIsApplications?: Array<{ name?: string }>;
      inScope?: string;
      outOfScope?: string;
      businessExceptionsKnown?: Array<{ name?: string; action?: string }>;
      appErrorsKnown?: Array<{ name?: string; action?: string }>;
      otherObservations?: string;
    }> = [];
    const seenPdd = new Set<string>();
    for (const assessmentId of assessmentIds) {
      const a = await ctx.db.get(assessmentId);
      if (!a || !(await canReadAssessment(ctx, a, args.userId))) continue;
      const doc = await ctx.db
        .query("processDesignDocuments")
        .withIndex("by_assessment", (q) => q.eq("assessmentId", assessmentId))
        .unique();
      if (!doc || seenPdd.has(String(doc._id))) continue;
      seenPdd.add(String(doc._id));
      const p = doc.payload;
      pdds.push({
        processTitle: p.processTitle,
        shortDescription: p.shortDescription,
        executiveSummary: p.executiveSummary,
        purpose: p.purpose,
        asIsProcessName: p.asIsProcessName,
        asIsShortDescription: p.asIsShortDescription,
        asIsRoles: p.asIsRoles,
        asIsApplications: p.asIsApplications?.map((x) => ({ name: x.name })),
        inScope: p.inScope,
        outOfScope: p.outOfScope,
        businessExceptionsKnown: p.businessExceptionsKnown?.map((x) => ({
          name: x.name,
          action: x.action,
        })),
        appErrorsKnown: p.appErrorsKnown?.map((x) => ({
          name: x.name,
          action: x.action,
        })),
        otherObservations: p.otherObservations,
      });
    }

    const cellItems = normalizeCellItems(
      row.matrixValues,
      row.cellNotes,
      row.cellItems,
    );
    const existingRiskTexts: string[] = [];
    for (const r of cellItems) {
      for (const c of r) {
        for (const it of c) {
          if (it.text.trim()) existingRiskTexts.push(it.text.trim());
        }
      }
    }
    for (const pool of row.riskPoolBefore ?? []) {
      if (pool.text.trim()) existingRiskTexts.push(pool.text.trim());
    }

    const contextText = buildRosAiContextDocument({
      rosTitle: row.title,
      candidateName: cand?.name,
      candidateCode: cand?.code,
      rowLabels: row.rowLabels,
      colLabels: row.colLabels,
      existingRiskTexts,
      assessments: assessments.map((a) => ({
        title: a.title,
        processName: a.payload?.processName,
        processDescription: a.payload?.processDescription,
        processGoal: a.payload?.processGoal,
        processActors: a.payload?.processActors,
        processSystems: a.payload?.processSystems,
        processFlowSummary: a.payload?.processFlowSummary,
        processConstraints: a.payload?.processConstraints,
        processFollowUp: a.payload?.processFollowUp,
        hfSecurityInformationNotes: a.payload?.hfSecurityInformationNotes,
        hfOrganizationalBreadthNotes: a.payload?.hfOrganizationalBreadthNotes,
        hfCriticalManualGapNotes: a.payload?.hfCriticalManualGapNotes,
        rpaBarrierNotes: a.payload?.rpaBarrierNotes,
        rpaManualFallbackWhenRobotFails:
          a.payload?.rpaManualFallbackWhenRobotFails,
        rpaBenefitKindsAndOperationsNotes:
          a.payload?.rpaBenefitKindsAndOperationsNotes,
        valuePainPointIds: a.payload?.valuePainPointIds,
        valueGainIds: a.payload?.valueGainIds,
      })),
      pdds,
    });

    return {
      workspaceId: row.workspaceId,
      contextText,
      rowCount: row.rowLabels.length,
      colCount: row.colLabels.length,
      hasLinkedSources: assessments.length > 0 || pdds.length > 0,
    };
  },
});
