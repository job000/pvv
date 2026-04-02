export const INTAKE_LAYOUT_MODES = [
  "one_per_screen",
  "grouped",
] as const;

export const INTAKE_FORM_STATUSES = [
  "draft",
  "published",
  "archived",
] as const;

export const INTAKE_LINK_ACCESS_MODES = [
  "anonymous",
  "email_required",
] as const;

export const INTAKE_SUBMISSION_STATUSES = [
  "submitted",
  "under_review",
  "approved",
  "rejected",
] as const;

export const INTAKE_QUESTION_TYPES = [
  "text",
  "multiple_choice",
  "scale",
  "yes_no",
] as const;

export const INTAKE_ASSESSMENT_TEXT_FIELDS = [
  "processName",
  "processDescription",
  "processGoal",
  "processActors",
  "processSystems",
  "processFlowSummary",
  "processVolumeNotes",
  "processConstraints",
  "processFollowUp",
  "hfSecurityInformationNotes",
  "hfOrganizationalBreadthNotes",
  "hfEconomicRationaleNotes",
  "hfCriticalManualGapNotes",
  "hfOperationsSupportNotes",
] as const;

export const INTAKE_ASSESSMENT_SCALE_FIELDS = [
  "criticalityBusinessImpact",
  "criticalityRegulatoryRisk",
] as const;

export const INTAKE_MAPPING_TARGET_LABELS = [
  {
    kind: "assessmentText",
    value: "processName",
    label: "Fyll inn prosessnavn / hva de gjør i dag",
  },
  {
    kind: "assessmentText",
    value: "processDescription",
    label: "Fyll inn beskrivelse av oppgaven",
  },
  {
    kind: "assessmentText",
    value: "processGoal",
    label: "Fyll inn mål og ønsket verdi",
  },
  {
    kind: "assessmentText",
    value: "processActors",
    label: "Fyll inn hvem som er involvert",
  },
  {
    kind: "assessmentText",
    value: "processSystems",
    label: "Fyll inn systemer og verktøy",
  },
  {
    kind: "assessmentText",
    value: "processFlowSummary",
    label: "Fyll inn hovedsteg i flyten",
  },
  {
    kind: "assessmentText",
    value: "processVolumeNotes",
    label: "Fyll inn volum / hvor ofte det skjer",
  },
  {
    kind: "assessmentText",
    value: "processConstraints",
    label: "Fyll inn begrensninger / hva som kan gå galt",
  },
  {
    kind: "assessmentText",
    value: "hfSecurityInformationNotes",
    label: "Fyll inn sikkerhet / personvern-notat",
  },
  {
    kind: "assessmentText",
    value: "hfEconomicRationaleNotes",
    label: "Fyll inn nytte / gevinst-notat",
  },
  {
    kind: "assessmentScale",
    value: "criticalityBusinessImpact",
    label: "Bruk som viktighet for drift og tjeneste",
  },
  {
    kind: "assessmentScale",
    value: "criticalityRegulatoryRisk",
    label: "Bruk som viktighet for regelverk og kontroll",
  },
  {
    kind: "derivedFrequency",
    value: "derivedFrequency",
    label: "Bruk som signal for automatiseringspotensial",
  },
  {
    kind: "rosConsequence",
    value: "rosConsequence",
    label: "Bruk som konsekvens i ROS-forslag",
  },
  {
    kind: "rosRiskDescription",
    value: "rosRiskDescription",
    label: "Bruk som identifisert risiko i ROS-forslag",
  },
  {
    kind: "pvvPersonalData",
    value: "pvvPersonalData",
    label: "Bruk som persondata-signal for PVV",
  },
] as const;

export const INTAKE_TECHNICAL_TERMS = [
  "risikomatrise",
  "risk matrix",
  "automatise",
  "automation complexity",
  "sannsynlighet",
  "probability of failure",
  "regulatorisk",
  "compliance",
  "kritikalitet",
  "risiko",
  "ros",
  "pvv",
] as const;

export function detectTechnicalTerms(input: string): string[] {
  const lower = input.trim().toLowerCase();
  if (!lower) {
    return [];
  }
  return INTAKE_TECHNICAL_TERMS.filter((term) => lower.includes(term));
}

export function defaultIntakeQuestions() {
  const personalDataQuestionId = crypto.randomUUID();

  return [
    {
      id: crypto.randomUUID(),
      label: "Hva gjør du i dag?",
      helpText: "Beskriv oppgaven kort med egne ord.",
      questionType: "text" as const,
      required: true,
      options: [],
      mappingTargets: [
        { kind: "assessmentText" as const, field: "processName" as const },
        {
          kind: "assessmentText" as const,
          field: "processDescription" as const,
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      label: "Hvor ofte gjør du dette?",
      helpText: "Velg det som passer best.",
      questionType: "multiple_choice" as const,
      required: true,
      options: [
        { id: "daily", label: "Daglig" },
        { id: "weekly", label: "Ukentlig" },
        { id: "monthly", label: "Månedlig" },
        { id: "rarely", label: "Sjelden" },
      ],
      mappingTargets: [{ kind: "derivedFrequency" as const }],
    },
    {
      id: crypto.randomUUID(),
      label: "Hva skjer hvis det blir feil?",
      helpText: "Beskriv konsekvensen med en enkel setning.",
      questionType: "text" as const,
      required: true,
      options: [],
      mappingTargets: [
        { kind: "rosConsequence" as const },
        {
          kind: "assessmentText" as const,
          field: "processConstraints" as const,
        },
      ],
    },
    {
      id: personalDataQuestionId,
      label: "Bruker dere personopplysninger?",
      helpText: "Velg ja hvis oppgaven bruker opplysninger om personer.",
      questionType: "yes_no" as const,
      required: true,
      options: [],
      mappingTargets: [{ kind: "pvvPersonalData" as const }],
    },
    {
      id: crypto.randomUUID(),
      label: "Hvilke personopplysninger brukes mest?",
      helpText: "Velg det som passer best for denne oppgaven.",
      questionType: "multiple_choice" as const,
      required: true,
      options: [
        { id: "name", label: "Navn" },
        { id: "contact", label: "Kontaktopplysninger" },
        { id: "national_id", label: "Fodselsnummer eller personnummer" },
        { id: "mixed", label: "Kombinasjon av flere typer" },
      ],
      visibilityRule: {
        parentQuestionKey: personalDataQuestionId,
        match: { kind: "yes_no" as const, value: true },
      },
      mappingTargets: [
        {
          kind: "assessmentText" as const,
          field: "hfSecurityInformationNotes" as const,
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      label: "Hva brukes personopplysningene til i oppgaven?",
      helpText: "Beskriv kort hvorfor dere trenger disse opplysningene.",
      questionType: "text" as const,
      required: false,
      options: [],
      visibilityRule: {
        parentQuestionKey: personalDataQuestionId,
        match: { kind: "yes_no" as const, value: true },
      },
      mappingTargets: [
        {
          kind: "assessmentText" as const,
          field: "hfSecurityInformationNotes" as const,
        },
        {
          kind: "assessmentText" as const,
          field: "processConstraints" as const,
        },
      ],
    },
  ];
}
