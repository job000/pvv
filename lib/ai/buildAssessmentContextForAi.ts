import { OPERATIONS_SUPPORT_LEVEL_LABELS } from "@/lib/helsesector-labels";
import {
  RPA_BARRIER_SELF_ASSESSMENT_LABELS_NB,
  RPA_SIMILAR_AUTOMATION_LABELS_NB,
} from "@/lib/rpa-portfolio-labels";

/**
 * Bygger én tekstblokk som kan sendes til KI for sortering, oppsummering eller
 * klassifisering — uten å eksponere rå databasefelter utenfor appen.
 */
export function buildAssessmentContextForAi(args: {
  title: string;
  processName: string;
  candidateId: string;
  processDescription?: string;
  processGoal?: string;
  processActors?: string;
  processSystems?: string;
  processFlowSummary?: string;
  processVolumeNotes?: string;
  processConstraints?: string;
  processFollowUp?: string;
  processScope?: "single" | "multi" | "unsure";
  priorityScore?: number;
  pipelineLabel?: string;
  hfOperationsSupportLevel?: "unsure" | "l1" | "l2" | "l3" | "mixed";
  hfSecurityInformationNotes?: string;
  hfOrganizationalBreadthNotes?: string;
  hfEconomicRationaleNotes?: string;
  hfCriticalManualGapNotes?: string;
  hfOperationsSupportNotes?: string;
  rpaExpectedBenefitVsEffort?: number;
  rpaQuickWinPotential?: number;
  rpaProcessSpecificity?: number;
  rpaBarrierSelfAssessment?:
    | "none"
    | "low_payback"
    | "not_rpa_suitable"
    | "integration_preferred"
    | "organizational_block"
    | "unsure";
  rpaBarrierNotes?: string;
  rpaSimilarAutomationExists?:
    | "unsure"
    | "yes_here"
    | "yes_elsewhere_or_similar"
    | "no";
  rpaImplementationDifficulty?: number;
  rpaLifecycleContact?: string;
  rpaManualFallbackWhenRobotFails?: string;
  rpaBenefitKindsAndOperationsNotes?: string;
}): string {
  const scopeLine =
    args.processScope === "single"
      ? "Organisatorisk omfang: én hovedenhet / avklart område."
      : args.processScope === "multi"
        ? "Organisatorisk omfang: spenner flere enheter eller er delt på tvers."
        : "Organisatorisk omfang: ikke avklart ennå.";

  const parts = [
    `Tittel: ${args.title}`,
    `Prosessnavn: ${args.processName || "—"}`,
    `Referanse: ${args.candidateId || "—"}`,
    scopeLine,
  ];

  const pushIf = (heading: string, text: string | undefined) => {
    const t = text?.trim();
    if (t) parts.push(`${heading}:\n${t}`);
  };

  pushIf("Helhetlig beskrivelse", args.processDescription);
  pushIf("Mål og verdi", args.processGoal);
  pushIf("Flyt og hovedtrinn", args.processFlowSummary);
  pushIf("Roller og ansvar", args.processActors);
  pushIf("Systemer og data", args.processSystems);
  pushIf("Volum og mønster", args.processVolumeNotes);
  pushIf("Begrensninger og risiko", args.processConstraints);
  pushIf("Videre og oppfølging", args.processFollowUp);

  const lvl = args.hfOperationsSupportLevel;
  if (lvl && lvl !== "unsure") {
    parts.push(
      `Forventet tjenestenivå (1./2./3. linje): ${OPERATIONS_SUPPORT_LEVEL_LABELS[lvl]}`,
    );
  }
  pushIf("Sikkerhet og informasjon", args.hfSecurityInformationNotes);
  pushIf("Organisasjonsbredde og samordning", args.hfOrganizationalBreadthNotes);
  pushIf("Besparelse og økonomisk gevinst", args.hfEconomicRationaleNotes);
  pushIf("Kritisk gap (ikke gjøres i dag)", args.hfCriticalManualGapNotes);
  pushIf("Krav til utvikling og drift", args.hfOperationsSupportNotes);

  const b = args.rpaBarrierSelfAssessment;
  if (b && b !== "none") {
    parts.push(
      `Beslutningsgrunnlag — hindring eller annen løsning: ${RPA_BARRIER_SELF_ASSESSMENT_LABELS_NB[b]}`,
    );
  }
  pushIf("Beslutningsgrunnlag — kort forklaring (hindring)", args.rpaBarrierNotes);
  if (args.rpaExpectedBenefitVsEffort !== undefined) {
    parts.push(
      `Beslutningsgrunnlag — nok å hente sammenlignet med innsats (1–5): ${args.rpaExpectedBenefitVsEffort}`,
    );
  }
  if (args.rpaQuickWinPotential !== undefined) {
    parts.push(
      `Beslutningsgrunnlag — rask effekt (1–5): ${args.rpaQuickWinPotential}`,
    );
  }
  if (args.rpaImplementationDifficulty !== undefined) {
    parts.push(
      `Beslutningsgrunnlag — krevende å få i drift (1–5, 5 = mest krevende): ${args.rpaImplementationDifficulty}`,
    );
  }
  if (args.rpaSimilarAutomationExists) {
    parts.push(
      `Lignende automatisering fra før: ${RPA_SIMILAR_AUTOMATION_LABELS_NB[args.rpaSimilarAutomationExists]}`,
    );
  }
  if (args.rpaProcessSpecificity !== undefined) {
    parts.push(
      `Beslutningsgrunnlag — spesifikk vs. lignende mange steder (1–5): ${args.rpaProcessSpecificity}`,
    );
  }
  pushIf("Kontaktperson til produksjon", args.rpaLifecycleContact);
  pushIf("Manuell reserve ved robotfeil", args.rpaManualFallbackWhenRobotFails);
  pushIf("Gevinst, tid, ventetid, robot vs. manuelt", args.rpaBenefitKindsAndOperationsNotes);

  if (args.priorityScore !== undefined) {
    parts.push(`Foreslått prioritet (modell): ${args.priorityScore.toFixed(1)}`);
  }
  if (args.pipelineLabel) {
    parts.push(`Pipelinestatus: ${args.pipelineLabel}`);
  }
  return parts.join("\n\n");
}
