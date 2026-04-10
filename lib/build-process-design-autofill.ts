import type { AssessmentPayload } from "@/lib/assessment-types";
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
  const prerequisites = prerequisitesParts.join("\n");

  const asIsDepartment =
    args.candidate?.linked && args.candidate.orgUnitName?.trim()
      ? args.candidate.orgUnitName.trim()
      : undefined;

  const asIsShortParts: string[] = [];
  if (p.processFlowSummary?.trim()) {
    asIsShortParts.push(p.processFlowSummary.trim());
  }
  if (p.processVolumeNotes?.trim()) {
    asIsShortParts.push(`Volum / frekvens: ${p.processVolumeNotes.trim()}`);
  }
  const asIsShortDescription = asIsShortParts.join("\n\n");

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
  ]
    .filter(Boolean)
    .join("\n\n");

  const reporting =
    "• Kjøringer / transaksjoner: logges i RPA-plattform\n• Avvik: hendelsesflyt til ansvarlig (se kontakter)\n• Periodisk gjennomgang sammen med forretning";

  const asIsProcessNameFromRegister =
    args.candidate?.linked === true ? args.candidate.name : undefined;

  const processTitle = asIsProcessNameFromRegister ?? p.processName ?? args.assessmentTitle;
  const shortDescription = p.processDescription?.trim()
    ? p.processDescription.trim().split("\n")[0]?.slice(0, 200)
    : undefined;

  return {
    processTitle,
    shortDescription,
    executiveSummary,
    purpose,
    objectives,
    keyContacts: keyContacts.length ? keyContacts : undefined,
    prerequisites,
    asIsProcessName: asIsProcessNameFromRegister ?? p.processName ?? args.assessmentTitle,
    asIsDepartment,
    asIsShortDescription: asIsShortDescription || undefined,
    asIsRoles: p.processActors?.trim() || undefined,
    asIsVolume: p.processVolumeNotes?.trim() || undefined,
    asIsHandleTime:
      p.timePerCaseValue != null
        ? `Ca. ${p.timePerCaseValue} ${p.timePerCaseUnit === "hours" ? "timer" : "minutter"} per sak`
        : undefined,
    asIsFte:
      p.manualFteEstimate != null
        ? `Omtrent ${p.manualFteEstimate} årsverk (estimat fra vurdering)`
        : undefined,
    asIsInputData: "Avklares med forretning — beskriv data som roboten mottar",
    asIsOutputData: "Avklares med forretning — beskriv leveranser og lagring",
    asIsApplications:
      asIsApplications.length > 0 ? asIsApplications : undefined,
    asIsSteps: asIsSteps.length > 0 ? asIsSteps : undefined,
    toBeSteps:
      "• Utfyll To-Be-trinn etter løsningsdesign (RPA- flyt, systemgrenser, manuelle håndtrykk).\n" +
      "• Koble til testplan og godkjenning før produksjon.",
    inScope: p.processFlowSummary?.trim()
      ? `Automatisering av hovedforløp som beskrevet i As-Is, innenfor avtalt datagrunnlag og tilganger.\n\n${p.processFlowSummary.trim().slice(0, 3000)}`
      : "Kjerneprosess som beskrevet i As-Is og avtalt med prosesseier.",
    outOfScope:
      "Prosesser utenfor avtalt grensesnitt, manuelle vurderinger som krever skjønn, og endringer i kildesystemer uten eget prosjekt.",
    businessExceptionsKnown:
      businessExceptionsKnown.length > 0 ? businessExceptionsKnown : undefined,
    appErrorsKnown: appErrorsKnown.length > 0 ? appErrorsKnown : undefined,
    reporting,
    otherObservations: otherObservations || undefined,
    additionalSources: additionalSources || undefined,
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
