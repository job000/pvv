import type { Doc } from "@/convex/_generated/dataModel";
import type { AssessmentPdfInput } from "@/lib/assessment-pdf";
import {
  PIPELINE_STATUS_LABELS,
  normalizePipelineStatus,
} from "@/lib/assessment-pipeline";
import type { AssessmentPayload } from "@/lib/assessment-types";
import {
  COMPLIANCE_STATUS_LABELS,
  type ComplianceStatusKey,
} from "@/lib/helsesector-labels";
import { computeAllResults } from "@/lib/rpa-assessment/scoring";

type DraftBundle = {
  assessment: Doc<"assessments">;
  draft: { payload: unknown };
  computed: ReturnType<typeof computeAllResults>;
};

/** Bygger PDF-inndata fra samme kilde som eksportpanelet (utkast + beregninger). */
export function buildAssessmentPdfInputFromDraft(
  bundle: DraftBundle,
  workspaceName: string | null,
): AssessmentPdfInput | null {
  const { assessment, draft, computed } = bundle;
  const pl =
    PIPELINE_STATUS_LABELS[normalizePipelineStatus(assessment.pipelineStatus)];
  const p = draft.payload as AssessmentPayload;
  const ros = (assessment.rosStatus ?? "not_started") as ComplianceStatusKey;
  const pdd = (assessment.pddStatus ?? "not_started") as ComplianceStatusKey;
  return {
    title: assessment.title,
    workspaceName,
    processName: p.processName ?? "",
    candidateId: p.candidateId ?? "",
    processDescription: p.processDescription,
    processGoal: p.processGoal,
    processActors: p.processActors,
    processSystems: p.processSystems,
    processFlowSummary: p.processFlowSummary,
    processVolumeNotes: p.processVolumeNotes,
    processConstraints: p.processConstraints,
    processFollowUp: p.processFollowUp,
    hfOperationsSupportLevel: p.hfOperationsSupportLevel,
    hfSecurityInformationNotes: p.hfSecurityInformationNotes,
    hfOrganizationalBreadthNotes: p.hfOrganizationalBreadthNotes,
    hfEconomicRationaleNotes: p.hfEconomicRationaleNotes,
    hfCriticalManualGapNotes: p.hfCriticalManualGapNotes,
    hfOperationsSupportNotes: p.hfOperationsSupportNotes,
    rpaExpectedBenefitVsEffort: p.rpaExpectedBenefitVsEffort,
    rpaQuickWinPotential: p.rpaQuickWinPotential,
    rpaProcessSpecificity: p.rpaProcessSpecificity,
    rpaBarrierSelfAssessment: p.rpaBarrierSelfAssessment,
    rpaBarrierNotes: p.rpaBarrierNotes,
    rpaSimilarAutomationExists: p.rpaSimilarAutomationExists,
    rpaImplementationDifficulty: p.rpaImplementationDifficulty,
    rpaLifecycleContact: p.rpaLifecycleContact,
    rpaManualFallbackWhenRobotFails: p.rpaManualFallbackWhenRobotFails,
    implementationBuildCost: p.implementationBuildCost,
    annualRunCost: p.annualRunCost,
    rpaBenefitKindsAndOperationsNotes: p.rpaBenefitKindsAndOperationsNotes,
    pipelineLabel: pl,
    rosLabel: COMPLIANCE_STATUS_LABELS[ros],
    pddLabel: COMPLIANCE_STATUS_LABELS[pdd],
    computed: {
      ap: computed.ap,
      criticality: computed.criticality,
      priorityScore: computed.priorityScore,
      feasible: computed.feasible,
      ease: computed.ease,
      easeLabel: computed.easeLabel,
      deliveryConfidence: computed.deliveryConfidence,
      economicCaseScore: computed.economicCaseScore,
      readinessScore: computed.readinessScore,
      benH: computed.benH,
      benC: computed.benC,
      benFte: computed.benFte,
      annualRunCost: computed.annualRunCost,
      buildCost: computed.buildCost,
      netBenefitAnnual: computed.netBenefitAnnual,
      paybackMonths: computed.paybackMonths,
    },
    generatedAt: new Date(),
  };
}
