import type { AssessmentPayload } from "@/lib/assessment-types";
import { derivedBaselineHoursFromPayload } from "@/lib/assessment-workload-sync";
import type { ProcessDesignDocumentPayload } from "@/lib/process-design-doc-types";
import type { RosPddDigest } from "@/lib/ros-pdd-digest";
import type { RosSummary } from "@/lib/ros-summary";

type IntakeAnswerLike =
  | { questionId: string; kind: "text"; value: string }
  | { questionId: string; kind: "number"; value: number }
  | {
      questionId: string;
      kind: "multiple_choice";
      optionId: string;
      label: string;
    }
  | { questionId: string; kind: "scale"; value: number }
  | { questionId: string; kind: "yes_no"; value: boolean };

type IntakeRosRisk = {
  id: string;
  title: string;
  description: string;
  severity: number;
};

function formatIntakeAnswers(answers: IntakeAnswerLike[]): string {
  const lines: string[] = [];
  for (const a of answers) {
    if (a.kind === "text" && a.value.trim()) {
      lines.push(`• (${a.questionId}) ${a.value.trim()}`);
    } else if (a.kind === "number") {
      lines.push(`• (${a.questionId}) ${a.value}`);
    } else if (a.kind === "multiple_choice") {
      lines.push(`• (${a.questionId}) ${a.label}`);
    } else if (a.kind === "scale") {
      lines.push(`• (${a.questionId}) skala ${a.value}`);
    } else if (a.kind === "yes_no") {
      lines.push(`• (${a.questionId}) ${a.value ? "Ja" : "Nei"}`);
    }
  }
  return lines.join("\n");
}

function formatCaseVolume(payload: AssessmentPayload): string | undefined {
  if (
    typeof payload.caseVolumeValue === "number" &&
    payload.caseVolumeValue > 0
  ) {
    const unit =
      payload.caseVolumeUnit === "day"
        ? "per dag"
        : payload.caseVolumeUnit === "month"
          ? "per måned"
          : "per uke";
    return `${payload.caseVolumeValue} saker ${unit}`;
  }
  if (typeof payload.casesPerWeek === "number" && payload.casesPerWeek > 0) {
    return `${payload.casesPerWeek} saker per uke`;
  }
  if (typeof payload.casesPerMonth === "number" && payload.casesPerMonth > 0) {
    return `${payload.casesPerMonth} saker per måned`;
  }
  return undefined;
}

function formatProcessScope(
  scope: AssessmentPayload["processScope"],
): string | undefined {
  if (scope === "single") return "Avgrenset til ett team / én enhet";
  if (scope === "multi") return "På tvers av flere team / enheter";
  if (scope === "unsure") return "Omfang må avklares nærmere";
  return undefined;
}

function formatOpsSupportLevel(
  level: AssessmentPayload["hfOperationsSupportLevel"],
): string | undefined {
  if (level === "l1") return "L1 / førstelinje";
  if (level === "l2") return "L2 / applikasjonsnær drift";
  if (level === "l3") return "L3 / spesialiststøtte";
  if (level === "mixed") return "Kombinert støttebehov";
  if (level === "unsure") return "Driftsnivå må avklares";
  return undefined;
}

function formatBarrierLabel(
  barrier: AssessmentPayload["rpaBarrierSelfAssessment"],
): string | undefined {
  if (barrier === "low_payback") return "Lav forventet lønnsomhet";
  if (barrier === "not_rpa_suitable") return "Vurderes som lite egnet for RPA";
  if (barrier === "integration_preferred") return "Bør heller løses som integrasjon";
  if (barrier === "organizational_block") return "Organisatoriske hindre må avklares";
  if (barrier === "unsure") return "Egnethet for RPA er usikker";
  return undefined;
}

function formatExistingAutomation(
  value: AssessmentPayload["rpaSimilarAutomationExists"],
): string | undefined {
  if (value === "yes_here") return "Lignende automatisering finnes allerede internt";
  if (value === "yes_elsewhere_or_similar")
    return "Lignende automatisering finnes i annen enhet / lignende prosess";
  if (value === "no") return "Ingen kjent lignende automatisering";
  if (value === "unsure") return "Må avklares om lignende automatisering finnes";
  return undefined;
}

/**
 * Forslagsinnhold til RPA prosessdesign-dokument fra vurdering, ROS og inntak.
 * Slås sammen i UI (f.eks. bare inn i tomme felt).
 */
export function buildProcessDesignAutofill(args: {
  workspaceName: string | null;
  assessmentTitle: string;
  payload: AssessmentPayload;
  rosContexts: Array<{
    title: string;
    rosSummary: RosSummary;
    pvvLinkNote?: string;
    note?: string;
    pddDigest?: RosPddDigest;
  }>;
  /** Prosess i registeret koblet via vurderingens prosess-ID */
  candidate?: {
    linked: true;
    code: string;
    name: string;
    notes?: string;
    linkHintBusinessOwner?: string;
    linkHintSystems?: string;
    linkHintComplianceNotes?: string;
    orgUnitName?: string;
  } | { linked: false };
  intake?: {
    formTitle: string | null;
    submitterMeta?: { name?: string; email?: string };
    answers: IntakeAnswerLike[];
    generatedRosSuggestion?: {
      summary?: string;
      risks: IntakeRosRisk[];
    };
  } | null;
}): ProcessDesignDocumentPayload {
  const p = args.payload;
  const derivedBaselineHours = derivedBaselineHoursFromPayload(p);
  const caseVolumeText = formatCaseVolume(p);
  const processScopeText = formatProcessScope(p.processScope);
  const opsSupportLevelText = formatOpsSupportLevel(p.hfOperationsSupportLevel);
  const barrierText = formatBarrierLabel(p.rpaBarrierSelfAssessment);
  const similarAutomationText = formatExistingAutomation(
    p.rpaSimilarAutomationExists,
  );

  const execParts: string[] = [];
  const procLine =
    args.candidate?.linked === true
      ? `Prosess (register): ${args.candidate.code} — ${args.candidate.name}. Vurdering: ${args.assessmentTitle}.`
      : `Prosess: ${p.processName || args.assessmentTitle}. Referanse i utkast: ${p.candidateId || "—"}.`;
  execParts.push(procLine);
  if (p.processDescription?.trim()) {
    execParts.push(`Kontekst: ${p.processDescription.trim()}`);
  }
  if (p.processGoal?.trim()) {
    execParts.push(`Forretningsmål / forventet effekt: ${p.processGoal.trim()}`);
  }
  if (p.rpaBenefitKindsAndOperationsNotes?.trim()) {
    execParts.push(`Gevinst og drift: ${p.rpaBenefitKindsAndOperationsNotes.trim()}`);
  }
  if (p.hfCriticalManualGapNotes?.trim()) {
    execParts.push(`Kritiske manuelle gap: ${p.hfCriticalManualGapNotes.trim()}`);
  }
  const executiveSummary = execParts.join("\n\n");

  const purpose =
    "Dette dokumentet beskriver nåsituasjon (As-Is), målbilde etter automatisering (To-Be), " +
    "omfang, unntak og feilhåndtering i tråd med god praksis for RPA-leveranser (prosessdesign / PDD).";

  const objectivesLines: string[] = [];
  if (p.processGoal?.trim()) objectivesLines.push(`• ${p.processGoal.trim()}`);
  objectivesLines.push("• Redusere manuell behandlingstid og tastefeil");
  objectivesLines.push("• Tydelig logging og sporbarhet i driftsmiljø");
  if (p.hfEconomicRationaleNotes?.trim()) {
    objectivesLines.push(`• Økonomi / begrunnelse: ${p.hfEconomicRationaleNotes.trim()}`);
  }
  if (typeof p.rpaExpectedBenefitVsEffort === "number") {
    objectivesLines.push(
      `• Forventet gevinst vs. innsats: ${p.rpaExpectedBenefitVsEffort}/5`,
    );
  }
  if (typeof p.rpaQuickWinPotential === "number") {
    objectivesLines.push(`• Quick win-potensial: ${p.rpaQuickWinPotential}/5`);
  }
  const objectives = objectivesLines.join("\n");

  const keyContacts: NonNullable<ProcessDesignDocumentPayload["keyContacts"]> =
    [];
  if (p.rpaLifecycleContact?.trim()) {
    keyContacts.push({
      role: "Kontakt livssyklus / oppdrag",
      name: p.rpaLifecycleContact.trim(),
      contact: "",
      notes: "Fra PVV-vurdering",
    });
  }
  if (args.candidate?.linked && args.candidate.linkHintBusinessOwner?.trim()) {
    keyContacts.push({
      role: "Prosesseier / forretning (fra prosessregister)",
      name: args.candidate.linkHintBusinessOwner.trim().slice(0, 200),
      contact: "",
      notes: "Hint fra prosesskort — verifiser mot organisasjonen",
    });
  }
  if (p.processActors?.trim()) {
    keyContacts.push({
      role: "Roller i prosessen",
      name: "Se beskrivelse",
      contact: "",
      notes: p.processActors.trim().slice(0, 2000),
    });
  }
  if (args.intake?.submitterMeta?.name?.trim()) {
    keyContacts.push({
      role: "Innsender av behov / skjema",
      name: args.intake.submitterMeta.name.trim().slice(0, 200),
      contact: args.intake.submitterMeta.email?.trim().slice(0, 400) ?? "",
      notes: "Fra skjema / inntak",
    });
  }

  const prerequisitesParts: string[] = [
    "• Signert / godkjent prosessdesign og avklart omfang",
    "• Testdata og tilganger til relevante systemer",
    "• Avklarte robotkontoer, hemmeligheter og sikkerhetskrav",
  ];
  if (p.hfSecurityInformationNotes?.trim()) {
    prerequisitesParts.push(
      `• Sikkerhet / tilgang (fra vurdering): ${p.hfSecurityInformationNotes.trim()}`,
    );
  }
  if (p.processConstraints?.trim()) {
    prerequisitesParts.push(
      `• Forutsetninger og begrensninger: ${p.processConstraints.trim()}`,
    );
  }
  if (args.candidate?.linked && args.candidate.linkHintComplianceNotes?.trim()) {
    prerequisitesParts.push(
      `• Samsvar / compliance (hint fra prosessregister): ${args.candidate.linkHintComplianceNotes.trim()}`,
    );
  }
  if (p.hfOperationsSupportNotes?.trim()) {
    prerequisitesParts.push(
      `• Drift / supportkrav: ${p.hfOperationsSupportNotes.trim()}`,
    );
  }
  const prerequisites = prerequisitesParts.join("\n");

  const asIsDepartment =
    args.candidate?.linked && args.candidate.orgUnitName?.trim()
      ? args.candidate.orgUnitName.trim()
      : undefined;
  const asIsProcessArea = [
    processScopeText,
    p.hfOrganizationalBreadthNotes?.trim()
      ? `Organisatorisk bredde: ${p.hfOrganizationalBreadthNotes.trim()}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const asIsShortParts: string[] = [];
  if (p.processFlowSummary?.trim()) {
    asIsShortParts.push(p.processFlowSummary.trim());
  }
  if (p.processVolumeNotes?.trim()) {
    asIsShortParts.push(`Volum / frekvens: ${p.processVolumeNotes.trim()}`);
  }
  const asIsShortDescription = asIsShortParts.join("\n\n");
  const asIsScheduleParts = [
    `Arbeidsår: ca. ${p.workingDays} dager × ${p.workingHoursPerDay} timer`,
    caseVolumeText ? `Volum: ${caseVolumeText}` : "",
    typeof p.employees === "number" && p.employees > 0
      ? `Involverte medarbeidere: ${p.employees}`
      : "",
  ].filter(Boolean);
  const asIsSchedule = asIsScheduleParts.join("\n");
  const asIsExecutionTime = [
    derivedBaselineHours != null
      ? `Manuelt hovedarbeid: ca. ${derivedBaselineHours} timer per år`
      : "",
    p.reworkHours > 0 ? `Re-arbeid: ca. ${p.reworkHours} timer per år` : "",
    p.auditHours > 0 ? `Kontroll / revisjon: ca. ${p.auditHours} timer per år` : "",
  ]
    .filter(Boolean)
    .join("\n");
  const asIsPeak = [
    caseVolumeText ? `Registrert volum: ${caseVolumeText}` : "",
    p.processVolumeNotes?.trim() ? p.processVolumeNotes.trim() : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  const asIsInputData = [
    typeof p.structuredInput === "number"
      ? `Grad av strukturert inndata: ${p.structuredInput}/5`
      : "",
    p.ocrRequired ? "OCR er markert som nødvendig i vurderingen." : "",
    "Beskriv skjermbilder, filer, e-poster eller API/data som roboten mottar.",
  ]
    .filter(Boolean)
    .join("\n");
  const asIsOutputData =
    "Beskriv resultat, registreringer, kvitteringer, logger og videreflyt som prosessen produserer.";

  const asIsApplications: NonNullable<
    ProcessDesignDocumentPayload["asIsApplications"]
  > = [];
  if (p.processSystems?.trim()) {
    const chunks = p.processSystems
      .split(/[,;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    for (const name of chunks.slice(0, 40)) {
      asIsApplications.push({
        name,
        type: "System / applikasjon",
        env: "Avklares",
        comments: "Fra PVV — detaljer utfylles i samarbeid med drift",
        phase: "As-Is / To-Be",
      });
    }
  }
  if (args.candidate?.linked && args.candidate.linkHintSystems?.trim()) {
    const hintChunks = args.candidate.linkHintSystems
      .split(/[,;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    for (const name of hintChunks.slice(0, 20)) {
      asIsApplications.push({
        name,
        type: "System (hint fra prosessregister)",
        env: "Avklares",
        comments: "Fra prosesskort — bekreft miljø og versjon",
        phase: "As-Is / To-Be",
      });
    }
  }

  const asIsSteps: NonNullable<ProcessDesignDocumentPayload["asIsSteps"]> = [];
  if (p.processFlowSummary?.trim()) {
    const roughSteps = p.processFlowSummary
      .split(/\n+/)
      .map((s) => s.replace(/^[-*•\d.)]+\s*/, "").trim())
      .filter(Boolean);
    let i = 1;
    for (const line of roughSteps.slice(0, 60)) {
      asIsSteps.push({
        stepNo: String(i++),
        description: line,
        input: "",
        details: "",
        exception: "",
        actions: "",
        rules: "",
      });
    }
  }

  const rosTextBlocks: string[] = [];
  const rosDetailBlocks: string[] = [];
  for (const r of args.rosContexts) {
    const lines = [
      `**${r.title}**`,
      ...r.rosSummary.summaryLines,
      r.pvvLinkNote?.trim() ? `Koblingsnotat: ${r.pvvLinkNote.trim()}` : "",
      r.note?.trim() ? `Notat: ${r.note.trim()}` : "",
    ].filter(Boolean);
    rosTextBlocks.push(lines.join("\n"));

    const d = r.pddDigest;
    if (d) {
      const sub: string[] = [`**${r.title} — detaljer til PDD**`];
      if (d.methodologyStatement?.trim()) {
        sub.push(`Metode / rammeverk:\n${d.methodologyStatement.trim()}`);
      }
      if (d.contextSummary?.trim()) {
        sub.push(`Kontekst:\n${d.contextSummary.trim()}`);
      }
      if (d.scopeAndCriteria?.trim()) {
        sub.push(`Omfang og kriterier:\n${d.scopeAndCriteria.trim()}`);
      }
      if (d.axisScaleNotes?.trim()) {
        sub.push(`Akseskala / tolkning:\n${d.axisScaleNotes.trim()}`);
      }
      if (d.analysisNotes?.trim()) {
        sub.push(`Notat på analysen:\n${d.analysisNotes.trim()}`);
      }
      if (d.riskSnippets.length > 0) {
        sub.push(
          `Utvalgte risikopunkter (matrise / kortlager):\n${d.riskSnippets.map((x) => `• ${x}`).join("\n")}`,
        );
      }
      if (sub.length > 1) {
        rosDetailBlocks.push(sub.join("\n\n"));
      }
    }
  }
  const rosBlock = rosTextBlocks.join("\n\n—\n\n");
  const rosDetailsBlock = rosDetailBlocks.join("\n\n—\n\n");

  const businessExceptionsKnown: NonNullable<
    ProcessDesignDocumentPayload["businessExceptionsKnown"]
  > = [];
  const appErrorsKnown: NonNullable<
    ProcessDesignDocumentPayload["appErrorsKnown"]
  > = [];

  if (rosBlock) {
    businessExceptionsKnown.push({
      name: "Oppsummert fra koblet ROS-analyse",
      step: "—",
      params: "Matrise / risikonivåer",
      action:
        "Følg tiltak og aksept i ROS. Ved avvik: eskalér i henhold til intern rutine.",
    });
  }
  if (p.hfCriticalManualGapNotes?.trim()) {
    businessExceptionsKnown.push({
      name: "Kritiske manuelle gap / kontrollpunkter",
      step: "Forretning",
      params: "Fra vurdering",
      action: p.hfCriticalManualGapNotes.trim(),
    });
  }

  if (p.rpaManualFallbackWhenRobotFails?.trim()) {
    appErrorsKnown.push({
      name: "Manuell fallback ved robotfeil",
      step: "Drift",
      params: "—",
      action: p.rpaManualFallbackWhenRobotFails.trim(),
    });
  }
  if (p.rpaBarrierNotes?.trim()) {
    appErrorsKnown.push({
      name: "Kjente barrierer / forbehold (RPA)",
      step: "—",
      params: "—",
      action: p.rpaBarrierNotes.trim(),
    });
  }
  if (barrierText) {
    appErrorsKnown.push({
      name: "RPA-egnethet / barriere",
      step: "Design",
      params: "Egenvurdering",
      action: barrierText,
    });
  }

  const intakeRisks = args.intake?.generatedRosSuggestion?.risks ?? [];
  for (const risk of intakeRisks.slice(0, 40)) {
    businessExceptionsKnown.push({
      name: risk.title,
      step: "—",
      params: `Alvorlighet (inntak): ${risk.severity}`,
      action: risk.description,
    });
  }

  let additionalSources = "";
  if (args.candidate?.linked && args.candidate.notes?.trim()) {
    additionalSources = `Prosessregister — notat på «${args.candidate.code}»:\n${args.candidate.notes.trim()}`;
  }
  if (args.intake) {
    const meta = args.intake.submitterMeta;
    const who =
      [meta?.name, meta?.email].filter(Boolean).join(" · ") || "Ukjent innsender";
    const head = `Inntaksskjema: ${args.intake.formTitle ?? "Uten tittel"} (${who})`;
    const body = formatIntakeAnswers(args.intake.answers);
    const sug = args.intake.generatedRosSuggestion?.summary?.trim();
    const intakeBlock = [head, body, sug ? `ROS-forslag (inntak): ${sug}` : ""]
      .filter(Boolean)
      .join("\n\n");
    additionalSources = additionalSources
      ? `${additionalSources}\n\n---\n\n${intakeBlock}`
      : intakeBlock;
  }

  const otherObservations = [
    rosBlock ? `**Risiko (ROS) — oppsummering**\n${rosBlock}` : "",
    rosDetailsBlock ? `**Risiko (ROS) — utdyping til prosessdesign**\n${rosDetailsBlock}` : "",
    p.processFollowUp?.trim()
      ? `**Oppfølging fra vurdering**\n${p.processFollowUp.trim()}`
      : "",
    p.hfOperationsSupportNotes?.trim()
      ? `**Drift / tjenestenivå**\n${p.hfOperationsSupportNotes.trim()}`
      : "",
    similarAutomationText
      ? `**Lignende automatisering**\n${similarAutomationText}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const reportingParts = [
    "• Kjøringer / transaksjoner: logges i RPA-plattform",
    "• Avvik: hendelsesflyt til ansvarlig (se kontakter)",
    "• Periodisk gjennomgang sammen med forretning",
    opsSupportLevelText ? `• Forventet driftsnivå: ${opsSupportLevelText}` : "",
    p.hfSecurityInformationNotes?.trim()
      ? `• Sikkerhet / informasjon: ${p.hfSecurityInformationNotes.trim()}`
      : "",
  ].filter(Boolean);
  const reporting = reportingParts.join("\n");

  const asIsProcessNameFromRegister =
    args.candidate?.linked === true ? args.candidate.name : undefined;

  const processTitle = asIsProcessNameFromRegister ?? p.processName ?? args.assessmentTitle;
  const shortDescription = p.processDescription?.trim()
    ? p.processDescription.trim().split("\n")[0]?.slice(0, 200)
    : undefined;
  const orgPrimaryUnit =
    args.candidate?.linked && args.candidate.orgUnitName?.trim()
      ? args.candidate.orgUnitName.trim()
      : args.workspaceName?.trim() || undefined;
  const orgOperatingUnits = [
    processScopeText ? `Prosessen vurderes som ${processScopeText.toLowerCase()}.` : "",
    p.hfOrganizationalBreadthNotes?.trim()
      ? p.hfOrganizationalBreadthNotes.trim()
      : "",
    similarAutomationText
      ? `Eksisterende eller lignende automasjon: ${similarAutomationText}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  const orgRosCoverage = args.rosContexts.length
    ? args.rosContexts
        .map((r) => {
          const parts = [
            `• ${r.title}`,
            r.pddDigest?.contextSummary?.trim()
              ? `Kontekst: ${r.pddDigest.contextSummary.trim()}`
              : "",
            r.pddDigest?.scopeAndCriteria?.trim()
              ? `Omfang: ${r.pddDigest.scopeAndCriteria.trim()}`
              : "",
          ].filter(Boolean);
          return parts.join("\n");
        })
        .join("\n\n")
    : undefined;
  const inScopeParts = [
    p.processFlowSummary?.trim()
      ? `Automatisering av hovedforløp som beskrevet i As-Is, innenfor avtalt datagrunnlag og tilganger.\n\n${p.processFlowSummary.trim().slice(0, 3000)}`
      : "Kjerneprosess som beskrevet i As-Is og avtalt med prosesseier.",
    processScopeText ? `Omfang: ${processScopeText}` : "",
    p.rpaBenefitKindsAndOperationsNotes?.trim()
      ? `Drifts- og gevinstperspektiv: ${p.rpaBenefitKindsAndOperationsNotes.trim()}`
      : "",
  ].filter(Boolean);
  const outOfScopeParts = [
    "Prosesser utenfor avtalt grensesnitt, manuelle vurderinger som krever skjønn, og endringer i kildesystemer uten eget prosjekt.",
    barrierText ? `Avklaringspunkt før videre design: ${barrierText}.` : "",
    similarAutomationText ? similarAutomationText : "",
  ].filter(Boolean);
  const parallelInitiatives = [
    similarAutomationText ? `• ${similarAutomationText}` : "",
    p.hfOrganizationalBreadthNotes?.trim()
      ? `• Organisatorisk bredde / avhengigheter: ${p.hfOrganizationalBreadthNotes.trim()}`
      : "",
    p.processConstraints?.trim()
      ? `• Begrensninger / avhengigheter: ${p.processConstraints.trim()}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
  const targetTimeline = [
    typeof p.rpaImplementationDifficulty === "number"
      ? `Vanskelighetsgrad vurdert til ${p.rpaImplementationDifficulty}/5.`
      : "",
    typeof p.rpaQuickWinPotential === "number"
      ? `Quick win-potensial vurdert til ${p.rpaQuickWinPotential}/5.`
      : "",
    typeof p.implementationBuildCost === "number"
      ? `Anslått etableringskostnad: ${p.implementationBuildCost} NOK.`
      : "",
    typeof p.annualRunCost === "number"
      ? `Anslått årlig driftskostnad: ${p.annualRunCost} NOK.`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
  const businessExceptionsUnknown =
    "Ukjente forretningsunntak stoppes og sendes til prosesseier eller saksansvarlig for manuell vurdering.";
  const appErrorsUnknown =
    "Ukjente tekniske feil logges, varsles og settes til manuell fallback eller ny behandling etter avklart driftsrutine.";

  return {
    processTitle,
    shortDescription,
    executiveSummary,
    purpose,
    objectives,
    keyContacts: keyContacts.length ? keyContacts : undefined,
    prerequisites,
    orgPrimaryUnit,
    orgOperatingUnits: orgOperatingUnits || undefined,
    orgRosCoverage,
    asIsProcessName: asIsProcessNameFromRegister ?? p.processName ?? args.assessmentTitle,
    asIsProcessArea: asIsProcessArea || undefined,
    asIsDepartment,
    asIsShortDescription: asIsShortDescription || undefined,
    asIsRoles: p.processActors?.trim() || undefined,
    asIsSchedule: asIsSchedule || undefined,
    asIsVolume: p.processVolumeNotes?.trim() || undefined,
    asIsHandleTime:
      p.timePerCaseValue != null
        ? `Ca. ${p.timePerCaseValue} ${p.timePerCaseUnit === "hours" ? "timer" : "minutter"} per sak`
        : undefined,
    asIsExecutionTime: asIsExecutionTime || undefined,
    asIsPeak: asIsPeak || undefined,
    asIsFte:
      p.manualFteEstimate != null
        ? `Omtrent ${p.manualFteEstimate} årsverk (estimat fra vurdering)`
        : undefined,
    asIsInputData,
    asIsOutputData,
    asIsApplications:
      asIsApplications.length > 0 ? asIsApplications : undefined,
    asIsSteps: asIsSteps.length > 0 ? asIsSteps : undefined,
    toBeSteps:
      "• Utfyll To-Be-trinn etter løsningsdesign (RPA- flyt, systemgrenser, manuelle håndtrykk).\n" +
      "• Koble til testplan og godkjenning før produksjon.",
    parallelInitiatives: parallelInitiatives || undefined,
    inScope: inScopeParts.join("\n\n"),
    outOfScope: outOfScopeParts.join("\n\n"),
    businessExceptionsKnown:
      businessExceptionsKnown.length > 0 ? businessExceptionsKnown : undefined,
    businessExceptionsUnknown,
    appErrorsKnown: appErrorsKnown.length > 0 ? appErrorsKnown : undefined,
    appErrorsUnknown,
    reporting,
    otherObservations: otherObservations || undefined,
    additionalSources: additionalSources || undefined,
    targetTimeline: targetTimeline || undefined,
  };
}

/** Virksomhetslinje til dokumentets forside (lagres på dokumentraden, ikke i payload). */
export function suggestedOrganizationLine(
  workspaceName: string | null,
): string | undefined {
  const t = workspaceName?.trim();
  return t || undefined;
}

/** Slår inn forslag kun der målfelt er tomme (streng eller tom liste). */
export function mergeAutofillEmptyOnly(
  current: ProcessDesignDocumentPayload,
  suggestion: ProcessDesignDocumentPayload,
): ProcessDesignDocumentPayload {
  const out: ProcessDesignDocumentPayload = { ...current };
  const strKeys = [
    "processTitle",
    "shortDescription",
    "executiveSummary",
    "purpose",
    "objectives",
    "prerequisites",
    "orgPrimaryUnit",
    "orgOperatingUnits",
    "orgRolloutNotes",
    "orgRosCoverage",
    "asIsProcessName",
    "asIsProcessArea",
    "asIsDepartment",
    "asIsShortDescription",
    "asIsRoles",
    "asIsSchedule",
    "asIsVolume",
    "asIsHandleTime",
    "asIsExecutionTime",
    "asIsPeak",
    "asIsFte",
    "asIsInputData",
    "asIsOutputData",
    "asIsProcessMap",
    "asIsDiagramSnapshot",
    "toBeMap",
    "toBeDiagramSnapshot",
    "toBeSteps",
    "parallelInitiatives",
    "inScope",
    "outOfScope",
    "businessExceptionsUnknown",
    "appErrorsUnknown",
    "reporting",
    "otherObservations",
    "additionalSources",
    "targetTimeline",
    "appendix",
  ] as const;

  for (const k of strKeys) {
    const cur = out[k];
    const sug = suggestion[k];
    if (typeof sug === "string" && sug.trim()) {
      if (cur === undefined || (typeof cur === "string" && !cur.trim())) {
        (out as Record<string, unknown>)[k] = sug;
      }
    }
  }

  const mergeArr = <T>(
    ck: keyof ProcessDesignDocumentPayload,
    merge: (a: T[], b: T[]) => T[],
  ) => {
    const cur = out[ck] as T[] | undefined;
    const sug = suggestion[ck] as T[] | undefined;
    if (!sug?.length) return;
    if (!cur?.length) {
      (out as Record<string, unknown>)[ck as string] = sug;
      return;
    }
    (out as Record<string, unknown>)[ck as string] = merge(cur, sug);
  };

  mergeArr("keyContacts", (a, b) => [...a, ...b]);
  mergeArr("asIsApplications", (a, b) => [...a, ...b]);
  mergeArr("asIsSteps", (a, b) => [...a, ...b]);
  mergeArr("hukiRows", (a, b) => [...a, ...b]);
  mergeArr("businessExceptionsKnown", (a, b) => [...a, ...b]);
  mergeArr("appErrorsKnown", (a, b) => [...a, ...b]);
  mergeArr("documentHistory", (a, b) => [...b, ...a]);
  mergeArr("approvalRows", (a, b) => [...a, ...b]);

  return out;
}
