import { OPERATIONS_SUPPORT_LEVEL_LABELS } from "@/lib/helsesector-labels";

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

  if (args.priorityScore !== undefined) {
    parts.push(`Foreslått prioritet (modell): ${args.priorityScore.toFixed(1)}`);
  }
  if (args.pipelineLabel) {
    parts.push(`Leveransestatus: ${args.pipelineLabel}`);
  }
  return parts.join("\n\n");
}
