/**
 * Bygger kompakt tekstkontekst til LLM for ROS-forslag.
 * Holder seg under typiske token-budsjett ved å kutte lange felt.
 */

function clamp(text: string | undefined | null, max: number): string {
  const t = (text ?? "").trim();
  if (!t) return "";
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

function section(title: string, body: string): string {
  const b = body.trim();
  if (!b) return "";
  return `## ${title}\n${b}`;
}

export type RosAiAssessmentSlice = {
  title: string;
  processName?: string;
  processDescription?: string;
  processGoal?: string;
  processActors?: string;
  processSystems?: string;
  processFlowSummary?: string;
  processConstraints?: string;
  processFollowUp?: string;
  hfSecurityInformationNotes?: string;
  hfOrganizationalBreadthNotes?: string;
  hfCriticalManualGapNotes?: string;
  rpaBarrierNotes?: string;
  rpaManualFallbackWhenRobotFails?: string;
  rpaBenefitKindsAndOperationsNotes?: string;
  valuePainPointIds?: string[];
  valueGainIds?: string[];
};

export type RosAiPddSlice = {
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
};

export function buildRosAiContextDocument(input: {
  rosTitle: string;
  candidateName?: string | null;
  candidateCode?: string | null;
  rowLabels: string[];
  colLabels: string[];
  existingRiskTexts: string[];
  assessments: RosAiAssessmentSlice[];
  pdds: RosAiPddSlice[];
}): string {
  const parts: string[] = [];

  parts.push(
    section(
      "ROS-analyse",
      [
        `Tittel: ${clamp(input.rosTitle, 200)}`,
        input.candidateName
          ? `Prosess: ${clamp(input.candidateName, 200)}${
              input.candidateCode ? ` (${input.candidateCode})` : ""
            }`
          : "",
        `Sannsynlighetsakse (rader, indeks 0…): ${input.rowLabels
          .map((l, i) => `[${i}] ${l}`)
          .join(" | ")}`,
        `Konsekvensakse (kolonner, indeks 0…): ${input.colLabels
          .map((l, i) => `[${i}] ${l}`)
          .join(" | ")}`,
      ]
        .filter(Boolean)
        .join("\n"),
    ),
  );

  if (input.existingRiskTexts.length > 0) {
    parts.push(
      section(
        "Eksisterende risikoer (unngå duplikater)",
        input.existingRiskTexts
          .slice(0, 40)
          .map((t, i) => `${i + 1}. ${clamp(t, 280)}`)
          .join("\n"),
      ),
    );
  }

  input.assessments.forEach((a, idx) => {
    const body = [
      `Tittel: ${clamp(a.title, 200)}`,
      a.processName ? `Prosessnavn: ${clamp(a.processName, 200)}` : "",
      a.processDescription
        ? `Beskrivelse: ${clamp(a.processDescription, 1200)}`
        : "",
      a.processGoal ? `Mål: ${clamp(a.processGoal, 600)}` : "",
      a.processActors ? `Aktører: ${clamp(a.processActors, 600)}` : "",
      a.processSystems ? `Systemer: ${clamp(a.processSystems, 600)}` : "",
      a.processFlowSummary
        ? `Flyt: ${clamp(a.processFlowSummary, 800)}`
        : "",
      a.processConstraints
        ? `Begrensninger/risiko: ${clamp(a.processConstraints, 800)}`
        : "",
      a.processFollowUp
        ? `Oppfølging: ${clamp(a.processFollowUp, 400)}`
        : "",
      a.hfSecurityInformationNotes
        ? `Sikkerhet/personvern: ${clamp(a.hfSecurityInformationNotes, 800)}`
        : "",
      a.hfOrganizationalBreadthNotes
        ? `Organisasjon: ${clamp(a.hfOrganizationalBreadthNotes, 600)}`
        : "",
      a.hfCriticalManualGapNotes
        ? `Kritisk manuelt gap: ${clamp(a.hfCriticalManualGapNotes, 600)}`
        : "",
      a.rpaBarrierNotes
        ? `Barrierer: ${clamp(a.rpaBarrierNotes, 600)}`
        : "",
      a.rpaManualFallbackWhenRobotFails
        ? `Fallback ved feil: ${clamp(a.rpaManualFallbackWhenRobotFails, 400)}`
        : "",
      a.rpaBenefitKindsAndOperationsNotes
        ? `Gevinst/drift: ${clamp(a.rpaBenefitKindsAndOperationsNotes, 600)}`
        : "",
      a.valuePainPointIds?.length
        ? `Problemer i dag: ${a.valuePainPointIds.slice(0, 16).join(", ")}`
        : "",
      a.valueGainIds?.length
        ? `Forventet gevinst: ${a.valueGainIds.slice(0, 16).join(", ")}`
        : "",
    ]
      .filter(Boolean)
      .join("\n");
    parts.push(section(`Vurdering ${idx + 1}`, body));
  });

  input.pdds.forEach((p, idx) => {
    const apps = (p.asIsApplications ?? [])
      .map((x) => x.name?.trim())
      .filter(Boolean)
      .slice(0, 15)
      .join(", ");
    const bizEx = (p.businessExceptionsKnown ?? [])
      .map((x) => {
        const name = x.name?.trim() ?? "";
        const action = x.action?.trim() ?? "";
        if (!name && !action) return "";
        return action ? `${name}: ${action}` : name;
      })
      .filter(Boolean)
      .slice(0, 10)
      .map((t, i) => `${i + 1}. ${clamp(t, 200)}`)
      .join("\n");
    const appEx = (p.appErrorsKnown ?? [])
      .map((x) => {
        const name = x.name?.trim() ?? "";
        const action = x.action?.trim() ?? "";
        if (!name && !action) return "";
        return action ? `${name}: ${action}` : name;
      })
      .filter(Boolean)
      .slice(0, 10)
      .map((t, i) => `${i + 1}. ${clamp(t, 200)}`)
      .join("\n");

    const body = [
      p.processTitle ? `PDD-tittel: ${clamp(p.processTitle, 200)}` : "",
      p.shortDescription
        ? `Kort beskrivelse: ${clamp(p.shortDescription, 800)}`
        : "",
      p.executiveSummary
        ? `Sammendrag: ${clamp(p.executiveSummary, 1200)}`
        : "",
      p.purpose ? `Formål: ${clamp(p.purpose, 600)}` : "",
      p.asIsProcessName
        ? `As-Is prosess: ${clamp(p.asIsProcessName, 200)}`
        : "",
      p.asIsShortDescription
        ? `As-Is: ${clamp(p.asIsShortDescription, 800)}`
        : "",
      p.asIsRoles ? `Roller: ${clamp(p.asIsRoles, 600)}` : "",
      apps ? `Applikasjoner: ${apps}` : "",
      p.inScope ? `Innenfor scope: ${clamp(p.inScope, 600)}` : "",
      p.outOfScope ? `Utenfor scope: ${clamp(p.outOfScope, 600)}` : "",
      bizEx ? `Kjente forretningsunntak:\n${bizEx}` : "",
      appEx ? `Kjente app-feil:\n${appEx}` : "",
      p.otherObservations
        ? `Andre observasjoner: ${clamp(p.otherObservations, 800)}`
        : "",
    ]
      .filter(Boolean)
      .join("\n");
    parts.push(section(`Prosessdesign ${idx + 1}`, body));
  });

  return parts.filter(Boolean).join("\n\n").slice(0, 28_000);
}
