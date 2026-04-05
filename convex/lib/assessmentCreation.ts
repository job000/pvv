import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { AssessmentPayload } from "../schema";
import { sanitizeAssessmentProcessTextFields } from "../../lib/assessment-process-profile";
import { normalizePipelineStatus, type PipelineStatus } from "../../lib/assessment-pipeline";
import { payloadToSnapshot } from "./payloadSnapshot";
import { computeAllResults } from "./rpaScoring";

export function defaultAssessmentPayload(): AssessmentPayload {
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
    valuePainPointIds: [],
    valueGainIds: [],
  };
}

export function mergeCandidateIntoAssessmentPayload(
  payload: AssessmentPayload,
  cand: Doc<"candidates">,
): AssessmentPayload {
  return {
    ...payload,
    processName: cand.name,
    candidateId: cand.code,
    processDescription: cand.notes?.trim() || payload.processDescription,
    processActors: cand.linkHintBusinessOwner?.trim() || payload.processActors,
    processSystems: cand.linkHintSystems?.trim() || payload.processSystems,
    hfSecurityInformationNotes:
      cand.linkHintComplianceNotes?.trim() || payload.hfSecurityInformationNotes,
  };
}

export async function nextAssessmentKanbanRank(
  ctx: MutationCtx,
  workspaceId: Id<"workspaces">,
  status: PipelineStatus,
): Promise<number> {
  const rows = await ctx.db
    .query("assessments")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
    .collect();
  let max = 0;
  for (const row of rows) {
    const rowStatus = normalizePipelineStatus(row.pipelineStatus);
    if (rowStatus !== status) {
      continue;
    }
    max = Math.max(max, row.kanbanRank ?? 0);
  }
  return max + 1;
}

export async function createAssessmentWithPayload(
  ctx: MutationCtx,
  args: {
    workspaceId: Id<"workspaces">;
    userId: Id<"users">;
    title: string;
    shareWithWorkspace: boolean;
    payload: AssessmentPayload;
    orgUnitId?: Id<"orgUnits">;
    /** Satt ved godkjenning av inntak — styrer veiviser (beslutningsspørsmål kun under Resultat). */
    sourcedFromIntake?: boolean;
  },
) {
  const now = Date.now();
  const payload = sanitizeAssessmentProcessTextFields(
    args.payload as unknown as Record<string, unknown>,
  ) as AssessmentPayload;
  const computed = computeAllResults(
    payloadToSnapshot(payload as unknown as Record<string, unknown>),
  );
  const pipelineStatus: PipelineStatus = "not_assessed";
  const assessmentId = await ctx.db.insert("assessments", {
    workspaceId: args.workspaceId,
    title: args.title.trim() || "Ny vurdering",
    createdByUserId: args.userId,
    updatedAt: now,
    shareWithWorkspace: args.shareWithWorkspace,
    sourcedFromIntake: args.sourcedFromIntake === true ? true : undefined,
    pipelineStatus,
    cachedPriorityScore: computed.priorityScore,
    cachedAp: computed.ap,
    cachedCriticality: computed.criticality,
    cachedEase: computed.ease,
    cachedEaseLabel: computed.easeLabel,
    kanbanRank: await nextAssessmentKanbanRank(
      ctx,
      args.workspaceId,
      pipelineStatus,
    ),
    orgUnitId: args.orgUnitId,
  });
  await ctx.db.insert("assessmentCollaborators", {
    assessmentId,
    userId: args.userId,
    role: "owner",
    addedAt: now,
  });
  await ctx.db.insert("assessmentDrafts", {
    assessmentId,
    payload,
    updatedAt: now,
    updatedByUserId: args.userId,
    revision: 1,
  });
  return assessmentId;
}
