import type { AssessmentPdfInput } from "@/lib/assessment-pdf";
import type { ProcessDesignDocumentPayload } from "@/lib/process-design-doc-types";
import type { ProcessDesignPdfInput } from "@/lib/process-design-pdf";
import type { RosPdfInput } from "@/lib/ros-pdf";

const DEMO_GENERATED_AT = new Date("2026-04-01T12:00:00+02:00");

/** Statisk eksempeldata for dokumentasjon / PDF-forhåndsvisning (ikke ekte saker). */
export function sampleDocumentationRosPdfInput(): RosPdfInput {
  const rowLabels = ["Innsamling", "Behandling", "Lagring", "Deling"];
  const colLabels = [
    "Konfidensialitet",
    "Integritet",
    "Tilgjengelighet",
    "Personvern",
  ];
  const emptyNotes = () =>
    rowLabels.map(() => colLabels.map(() => ""));
  const notes = emptyNotes();
  notes[1]![2] = "Manuell kontroll ved avvik; logging ikke samlet.";
  notes[2]![0] = "Tilgang styrt via AD-grupper; årlig recertification.";

  const matrixValues = [
    [2, 2, 1, 3],
    [3, 3, 4, 3],
    [2, 2, 2, 4],
    [3, 2, 2, 3],
  ];
  const matrixValuesAfter = [
    [2, 2, 1, 2],
    [2, 3, 3, 2],
    [2, 2, 2, 3],
    [2, 2, 2, 2],
  ];

  return {
    title: "Eksempel: ROS for kundesaksbehandling",
    workspaceName: "Eksempel AS",
    candidateName: "Kundeservice — saksflyt",
    candidateCode: "PROC-1042",
    rowAxisTitle: "Faser i prosessen",
    colAxisTitle: "Sikkerhets- og personverndimensjoner",
    rowLabels,
    colLabels,
    matrixValues,
    cellNotes: notes,
    matrixValuesAfter,
    cellNotesAfter: emptyNotes(),
    afterRowLabels: rowLabels,
    afterColLabels: colLabels,
    afterRowAxisTitle: "Faser i prosessen",
    afterColAxisTitle: "Sikkerhets- og personverndimensjoner",
    afterSeparateLayout: false,
    analysisNotes:
      "Dette er et illustrasjonsdokument. Tall og vurderinger er fiktive og viser hvordan en full ROS-PDF kan se ut i FRO.",
    summaryLines: [
      "Før tiltak: én celle i høyeste risikobånd (tilgjengelighet under behandling).",
      "Etter tiltak: redusert samlet eksponering; gjenstående oppfølging på tilgangsstyring.",
    ],
    methodologyStatement:
      "Vurderingen følger intern mal basert på ISO 31000-prinsipper og er tilpasset virksomhetens kontekst.",
    contextSummary:
      "Prosessen håndterer rutinemessig personopplysninger. Eksempelet viser struktur, ikke faktisk risiko for deres virksomhet.",
    scopeAndCriteria:
      "Omfatter forretningsprosess fra mottak til arkivering. Utenfor omfang: underleverandørers egne systemer.",
    riskCriteriaVersion: "Intern skala 1–5 (veiledende)",
    axisScaleNotes: "Akser og nivåer er konfigurerbare i produktet.",
    complianceScopeTagIds: ["gdpr", "iso27005"],
    requirementRefLines: [
      "GDPR · art. 32 · Tekniske og organisatoriske tiltak",
      "ISO/IEC 27005 · Risikovurderingsprosess",
    ],
    reviewSchedule: {
      nextReview: "2026-10-01",
      routine: "Halvårlig gjennomgang ved endring i system eller lovkrav.",
    },
    taskLinesAll: [
      {
        line: "Kartlegg logging for behandlingssteget",
        statusLabel: "Åpen",
        assigneeName: "K. Eksempel",
        riskTreatmentLabel: "Reduser",
      },
      {
        line: "Oppdatere tilgangsmatrise",
        statusLabel: "Fullført",
        assigneeName: "A. Demo",
      },
    ],
    identifiedRisks: [
      {
        text: "Mangelfull sporbarhet ved manuelle avvik i behandlingssteget.",
        beforeRowLabel: "Behandling",
        beforeColLabel: "Tilgjengelighet",
        afterRowLabel: "Behandling",
        afterColLabel: "Tilgjengelighet",
        beforeLevel: 4,
        afterLevel: 3,
        hasTiltak: true,
        hasFølg: true,
        afterChangeNote: "Innført felles avviksmal og ukentlig oppfølging.",
      },
    ],
    sectorPackLabel: "Tjenesteyting (eksempel)",
    riskPoolBeforeLines: ["Uklassifisert avvikstype «annen» — nærmere vurdering"],
    riskPoolAfterLines: [],
    linkedPvvTitles: ["Eksempel: PVV for samme prosess"],
    pvvLinksDetailed: [
      {
        title: "Eksempel: PVV for samme prosess",
        pddLabel: "PDD vedlagt",
        linkNote: "Kobling brukt til sporbarhet mellom ROS og portefølje.",
        pvvLinkNote: "Prioritet medium i eksempeldata.",
        flagsText: "Personvern: ja · Dokumentasjon: delvis",
        highlightForPvv: true,
        requirementRefLines: ["GDPR · art. 5 · Prinsipper"],
      },
    ],
    journalEntries: [
      {
        body: "Gjennomført gjennomgang av behandlingssteget etter intern hendelse (eksempel).",
        authorName: "R. Risiko",
        createdAt: DEMO_GENERATED_AT.getTime() - 86400000 * 3,
        linkedRow: 1,
        linkedCol: 2,
        matrixPhase: "before",
      },
      {
        body: "Oppdatert rest-risiko etter tiltak; neste steg er verifisering i drift.",
        authorName: "R. Risiko",
        createdAt: DEMO_GENERATED_AT.getTime() - 86400000,
        matrixPhase: "after",
      },
    ],
    generatedAt: DEMO_GENERATED_AT,
    metadata: {
      revision: 2,
      createdAtMs: DEMO_GENERATED_AT.getTime() - 86400000 * 30,
      updatedAtMs: DEMO_GENERATED_AT.getTime() - 3600000,
      templateName: "Standard ROS-mal (eksempel)",
    },
    versionSnapshots: [
      { version: 1, note: "Første lagring", createdAt: DEMO_GENERATED_AT.getTime() - 86400000 * 14 },
      { version: 2, note: "Etter workshop", createdAt: DEMO_GENERATED_AT.getTime() - 86400000 * 7 },
    ],
  };
}

export function sampleDocumentationAssessmentPdfInput(): AssessmentPdfInput {
  return {
    title: "Eksempel: PVV for fakturamottak",
    workspaceName: "Eksempel AS",
    processName: "Mottak og kontering av leverandørfakturaer",
    candidateId: "CAND-8821",
    processDescription:
      "Leverandørfakturaer mottas på e-post, kontrolleres mot innkjøpsordre og bokføres i økonomisystem. Dette eksempelet viser layout og felter i PVV-PDF — ikke en faktisk vurdering.",
    processGoal: "Korrekt og tidsriktig betaling med intern kontroll.",
    processActors: "Innkjøp, økonomi, evt. godkjenner.",
    processSystems: "E-post, økonomisystem, evt. RPA-robot (planlagt).",
    processFlowSummary:
      "1) Mottak → 2) Match mot ordre → 3) Kontering → 4) Betaling.",
    processVolumeNotes: "Ca. 1 200 fakturaer per måned (eksempeltall).",
    processConstraints: "Må følge delegasjonsregler og bilagskrav.",
    processFollowUp: "Kvartalsvis gjennomgang av avvik og ledetid.",
    hfOperationsSupportLevel: "l2",
    hfSecurityInformationNotes: "Tilgang til fakturaer begrenset til økonomiroller.",
    hfOrganizationalBreadthNotes: "Berører to avdelinger; enkel forankring.",
    hfEconomicRationaleNotes: "RPA vurderes for repeterende match-steg.",
    hfCriticalManualGapNotes: "Manuell vurdering ved avvikende beløp.",
    hfOperationsSupportNotes: "Drift har kapasitet til overvåkning av kjøring.",
    rpaExpectedBenefitVsEffort: 3,
    rpaQuickWinPotential: 4,
    rpaProcessSpecificity: 4,
    rpaBarrierSelfAssessment: "none",
    rpaBarrierNotes: "",
    rpaSimilarAutomationExists: "yes_elsewhere_or_similar",
    rpaImplementationDifficulty: 2,
    rpaLifecycleContact: "prosess.eier@eksempel.no",
    rpaManualFallbackWhenRobotFails: "Manuell behandling i samme kø.",
    implementationBuildCost: 180000,
    annualRunCost: 42000,
    rpaBenefitKindsAndOperationsNotes:
      "Forventet reduksjon i manuelle minutter per faktura (illustrasjon).",
    pipelineLabel: "Vurdering",
    rosLabel: "Pågår — eksempel",
    pddLabel: "Planlagt",
    computed: {
      ap: 62,
      criticality: 48,
      priorityScore: 55,
      feasible: true,
      ease: 72,
      easeLabel: "Overvei",
      deliveryConfidence: 68,
      economicCaseScore: 58,
      readinessScore: 64,
      benH: 120,
      benC: 85,
      benFte: 0.35,
      annualRunCost: 42000,
      buildCost: 180000,
      netBenefitAnnual: 95000,
      paybackMonths: 23,
    },
    generatedAt: DEMO_GENERATED_AT,
  };
}

function samplePddPayload(): ProcessDesignDocumentPayload {
  return {
    processTitle: "Leverandørfaktura — mottak og kontering",
    shortDescription:
      "Illustrasjon av RPA prosessdesign-dokument (PDD) slik det kan eksporteres fra FRO. Diagrammer vises kun når de finnes i dokumentet; her er tekstseksjoner fylt ut.",
    executiveSummary:
      "Prosessen digitaliseres stegvis: først strukturert mottak, deretter automatisk match der reglene er entydige.",
    purpose: "Sikre korrekt bokføring og sporbarhet.",
    objectives: "Redusere manuelt volum, beholde kontrollpunkter.",
    keyContacts: [
      {
        role: "Prosess eier",
        name: "E. Eier",
        contact: "eier@eksempel.no",
        notes: "Godkjenner endringer i flyt",
      },
      {
        role: "IT / RPA",
        name: "R. Utvikler",
        contact: "rpa@eksempel.no",
      },
    ],
    prerequisites: "Aktiv konto i økonomisystem; definerte match-regler.",
    orgPrimaryUnit: "Økonomi",
    orgOperatingUnits: "Innkjøp (inndata)",
    orgRolloutNotes: "Pilot på én leverandørgruppe først.",
    orgRosCoverage: "Knyttet til ROS «Eksempel: ROS for kundesaksbehandling» (demo).",
    asIsProcessName: "Manuelt mottak av PDF-fakturaer",
    asIsProcessArea: "Økonomi",
    asIsDepartment: "Regnskap",
    asIsShortDescription: "Saksbehandler åpner e-post, lagrer vedlegg og fører manuelt.",
    asIsRoles: "Saksbehandler, kontrollør",
    asIsSchedule: "Hver virkedag",
    asIsVolume: "~50 per dag (eksempel)",
    asIsHandleTime: "4–8 min per sak",
    asIsExecutionTime: "Varierende",
    asIsPeak: "Månedsskifte",
    asIsFte: "1,2 årsverk",
    asIsInputData: "PDF, e-postmetadata",
    asIsOutputData: "Bokført bilag",
    asIsApplications: [
      { name: "E-post", type: "Kommunikasjon", env: "Sky" },
      { name: "Økonomi", type: "ERP", env: "On-prem" },
    ],
    asIsProcessMap: "Høynivå: Innboks → lagring → føring.",
    asIsSteps: [
      {
        stepNo: "1",
        input: "E-post med PDF",
        description: "Saksbehandler identifiserer leverandør",
        details: "Manuell vurdering av gyldighet",
        exception: "Ukjent leverandør → manuell sjekk",
        actions: "Lagre i mappe",
        rules: "Standard filnavn",
      },
      {
        stepNo: "2",
        input: "PDF",
        description: "Kontering",
        details: "Manuell postering",
        exception: "Beløpsavvik",
        actions: "Send til godkjenning",
        rules: "Delegasjonsgrenser",
      },
    ],
    toBeMap: "E-post → robot → forslag til postering → menneske ved avvik.",
    toBeSteps:
      "Robot leser kjente leverandører, foreslår konto og kontering; menneske godkjenner.",
    parallelInitiatives: "Oppgradering av OCR (eksempel).",
    inScope: "Standard fakturaer fra avtalte leverandører.",
    outOfScope: "Kreditnotaer med komplekse motposteringer (fase 2).",
    hukiRows: [
      { activity: "Mottak og klassifisering", h: "x", u: "x", k: "", i: "" },
      { activity: "Kontering", h: "", u: "x", k: "x", i: "" },
      { activity: "Betaling", h: "x", u: "", k: "x", i: "x" },
    ],
    businessExceptionsKnown: [
      {
        name: "Beløp over grense",
        step: "2",
        action: "Alltid manuell godkjenning",
      },
    ],
    businessExceptionsUnknown: "Nye leverandørtyper kan kreve regelverk.",
    appErrorsKnown: [
      {
        name: "API-timeout mot ERP",
        action: "Retry tre ganger, deretter manuell kø",
      },
    ],
    appErrorsUnknown: "Nettverksbrudd hos sky-leverandør.",
    reporting: "Dashbord med volum, feilrate og ledetid.",
    otherObservations: "Dette dokumentet er kun til visning i hjelpen.",
    additionalSources: "Intern wiki, ROS, PVV (eksempelkoblinger).",
    targetTimeline: "Pilot Q3, produksjon Q4 (fiktiv tidslinje).",
    appendix: "Ordliste og referanser kan legges ved.",
    documentHistory: [
      {
        date: "2026-03-01",
        version: "0.1",
        role: "Forfatter",
        name: "P. Design",
        organization: "Eksempel AS",
        comments: "Første utkast",
      },
      {
        date: "2026-04-01",
        version: "0.2",
        role: "Reviewer",
        name: "K. Kontroll",
        organization: "Eksempel AS",
        comments: "Justert HUKI",
      },
    ],
    approvalRows: [
      {
        version: "0.2",
        flow: "Standard",
        role: "Prosess eier",
        name: "E. Eier",
        org: "Eksempel AS",
        signature: "—",
      },
    ],
  };
}

export function sampleDocumentationProcessDesignPdfInput(): ProcessDesignPdfInput {
  return {
    assessmentTitle: "Eksempel: PVV for fakturamottak",
    workspaceName: "Eksempel AS",
    organizationLine: "Økonomi · Regnskap",
    payload: samplePddPayload(),
    generatedAt: DEMO_GENERATED_AT,
    publishedVersion: 2,
  };
}
