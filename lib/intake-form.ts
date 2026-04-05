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
  "number",
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
  "rpaBarrierNotes",
  "rpaLifecycleContact",
  "rpaManualFallbackWhenRobotFails",
  "rpaBenefitKindsAndOperationsNotes",
] as const;

export const INTAKE_ASSESSMENT_SCALE_FIELDS = [
  "criticalityBusinessImpact",
  "criticalityRegulatoryRisk",
  "rpaExpectedBenefitVsEffort",
  "rpaQuickWinPotential",
  "rpaProcessSpecificity",
  "rpaImplementationDifficulty",
  "processVariability",
  "structuredInput",
  "digitization",
  "applicationCount",
  "processStability",
  "applicationStability",
] as const;

export const INTAKE_ASSESSMENT_NUMBER_FIELDS = [
  "timePerCaseValue",
  "caseVolumeValue",
  "manualFteEstimate",
  "workingDays",
  "workingHoursPerDay",
] as const;

export const INTAKE_ASSESSMENT_CHOICE_FIELDS = [
  "timePerCaseUnit",
  "caseVolumeUnit",
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
    label: "Fyll inn mål, gevinst eller hva dere vil automatisere",
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
    label: "Bruk som forventet økonomisk/operativ gevinst (skala)",
  },
  {
    kind: "assessmentScale",
    value: "criticalityRegulatoryRisk",
    label: "Bruk som kritikalitet ved feil / compliance (RPA)",
  },
  {
    kind: "assessmentScale",
    value: "rpaExpectedBenefitVsEffort",
    label: "Bruk som gevinst mot innsats (lønner det seg?)",
  },
  {
    kind: "assessmentScale",
    value: "rpaQuickWinPotential",
    label: "Bruk som hvor raskt dere kan få effekt",
  },
  {
    kind: "assessmentScale",
    value: "rpaProcessSpecificity",
    label: "Bruk som hvor spesifikk prosessen er (vs. lignende mange steder)",
  },
  {
    kind: "assessmentScale",
    value: "rpaImplementationDifficulty",
    label: "Bruk som hvor krevende det er å få til",
  },
  {
    kind: "assessmentScale",
    value: "processVariability",
    label: "Skala: gjøres det likt hver gang (RPA-egnethet)",
  },
  {
    kind: "assessmentScale",
    value: "structuredInput",
    label: "Skala: data i felt vs. fritekst (RPA-egnethet)",
  },
  {
    kind: "assessmentScale",
    value: "digitization",
    label: "Skala: papir vs. digitalt (RPA-egnethet)",
  },
  {
    kind: "assessmentScale",
    value: "applicationCount",
    label: "Skala: antall systemer i flyten",
  },
  {
    kind: "assessmentScale",
    value: "processStability",
    label: "Skala: prosessstabilitet",
  },
  {
    kind: "assessmentScale",
    value: "applicationStability",
    label: "Skala: systemstabilitet",
  },
  {
    kind: "assessmentStabilityBoth",
    value: "assessmentStabilityBoth",
    label: "Én skala → både prosess- og systemstabilitet",
  },
  {
    kind: "assessmentScaleInvertedLength",
    value: "assessmentScaleInvertedLength",
    label: "Skala: mye/lite skjønn → prosesslengde (som i vurdering)",
  },
  {
    kind: "assessmentRpaSimilar",
    value: "assessmentRpaSimilar",
    label: "Lagre som «lignende automatisering fra før»",
  },
  {
    kind: "assessmentRpaBarrier",
    value: "assessmentRpaBarrier",
    label: "Lagre som hindring / annen løsning",
  },
  {
    kind: "assessmentText",
    value: "rpaBarrierNotes",
    label: "Fyll inn kort begrunnelse (hindring)",
  },
  {
    kind: "assessmentText",
    value: "rpaBenefitKindsAndOperationsNotes",
    label: "Fyll inn gevinst, tid, ventetid, robot vs. manuelt",
  },
  {
    kind: "assessmentText",
    value: "rpaLifecycleContact",
    label: "Fyll inn kontaktperson til løsningen er i drift",
  },
  {
    kind: "assessmentText",
    value: "rpaManualFallbackWhenRobotFails",
    label: "Fyll inn hvem som tar over manuelt ved feil",
  },
  {
    kind: "assessmentNumber",
    value: "timePerCaseValue",
    label: "Lagre som tid per sak",
  },
  {
    kind: "assessmentChoice",
    value: "timePerCaseUnit",
    label: "Lagre som enhet for tid per sak",
  },
  {
    kind: "assessmentNumber",
    value: "caseVolumeValue",
    label: "Lagre som antall saker",
  },
  {
    kind: "assessmentChoice",
    value: "caseVolumeUnit",
    label: "Lagre som periode for antall saker",
  },
  {
    kind: "assessmentNumber",
    value: "manualFteEstimate",
    label: "Lagre som årsverk / FTE",
  },
  {
    kind: "assessmentNumber",
    value: "workingDays",
    label: "Lagre som arbeidsdager per år",
  },
  {
    kind: "assessmentNumber",
    value: "workingHoursPerDay",
    label: "Lagre som timer per arbeidsdag",
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
      label: "Hva heter oppgaven eller arbeidsflyten hos dere?",
      helpText:
        "Kort navn, slik kollegaer ville sagt det — f.eks. «Innkommende fakturaer». (Går inn som «Prosessnavn» i vurderingen.)",
      questionType: "text" as const,
      required: true,
      options: [],
      mappingTargets: [
        { kind: "assessmentText" as const, field: "processName" as const },
      ],
    },
    {
      id: crypto.randomUUID(),
      label: "I korte trekk: hva gjør dere i dag i denne flyten?",
      helpText:
        "Valgfritt, men hjelper oss. Samme felt som «Helhetlig beskrivelse» under Prosess i vurderingen — ikke bare mål, men dagens gjøremål.",
      questionType: "text" as const,
      required: false,
      options: [],
      mappingTargets: [
        {
          kind: "assessmentText" as const,
          field: "processDescription" as const,
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      label: "Hva ønsker dere å slippe manuelt arbeid på — eller få gjort raskere og tryggere?",
      helpText:
        "I vanlig språk: f.eks. «kopiere mellom to systemer», «mindre tastefeil» eller «kortere ventetid for brukere».",
      questionType: "text" as const,
      required: true,
      options: [],
      mappingTargets: [
        { kind: "assessmentText" as const, field: "processGoal" as const },
      ],
    },
    {
      id: crypto.randomUUID(),
      label:
        "Hvor stor nytte tror dere dette kan gi? (tid, færre feil, lavere kost eller bedre tjeneste)",
      helpText:
        "1 = lite å hente · 5 = mye å hente. Grovt anslag holder — samme skala som i vår vurdering.",
      questionType: "scale" as const,
      required: false,
      options: [],
      mappingTargets: [
        {
          kind: "assessmentScale" as const,
          field: "criticalityBusinessImpact" as const,
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      label:
        "Hvor alvorlig er det om noe går galt her? (feil i saksbehandling, pasient/bruker, økonomi …)",
      helpText:
        "1 = lite alvorlig · 5 = svært alvorlig. Samme som i vår vurdering.",
      questionType: "scale" as const,
      required: false,
      options: [],
      mappingTargets: [
        {
          kind: "assessmentScale" as const,
          field: "criticalityRegulatoryRisk" as const,
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      label:
        "Er dette «vår egen» måte å gjøre ting på — eller skjer det likt mange steder hos dere?",
      helpText:
        "1 = skjer mange steder · 5 = mest unikt for oss. Hjelper oss å prioritere.",
      questionType: "scale" as const,
      required: false,
      options: [],
      mappingTargets: [
        {
          kind: "assessmentScale" as const,
          field: "rpaProcessSpecificity" as const,
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      label: "Hvor ofte gjør dere dette i en vanlig uke eller måned?",
      helpText:
        "Velg det som er nærmest — brukes til å anslå hvor mye tid som ligger her.",
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
      label: "Hvor lang tid bruker dere på én sak eller en runde av oppgaven?",
      helpText:
        "Skriv bare tallet (ikke skriv «min» eller «t» her). Neste skjerm spør om tallet er minutter eller timer per sak — det trengs til tids- og kostnadsgrunnlag i vurderingen.",
      questionType: "number" as const,
      required: false,
      options: [],
      mappingTargets: [
        { kind: "assessmentNumber" as const, field: "timePerCaseValue" as const },
      ],
    },
    {
      id: crypto.randomUUID(),
      label: "Enhet for tidsbruket du nettopp skrev: minutter eller timer per sak?",
      helpText:
        "Velg minutter hvis tallet er f.eks. 30 for «30 minutter», eller timer hvis tallet er 2 for «2 timer». Gjelder bare hvis du fylte inn et tall på forrige skjerm.",
      questionType: "multiple_choice" as const,
      required: false,
      options: [
        { id: "minutes", label: "Minutter per sak" },
        { id: "hours", label: "Timer per sak" },
      ],
      mappingTargets: [
        { kind: "assessmentChoice" as const, field: "timePerCaseUnit" as const },
      ],
    },
    {
      id: crypto.randomUUID(),
      label: "Omtrent hvor mange saker (eller tilsvarende) behandler dere?",
      helpText:
        "Skriv antall saker som heltall (f.eks. 15). Neste skjerm spør om tallet er per dag, per uke eller per måned — det brukes som volumgrunnlag i vurderingen.",
      questionType: "number" as const,
      required: false,
      options: [],
      mappingTargets: [
        { kind: "assessmentNumber" as const, field: "caseVolumeValue" as const },
      ],
    },
    {
      id: crypto.randomUUID(),
      label: "Tallet for antall saker — gjelder det per dag, per uke eller per måned?",
      helpText:
        "Velg samme tidsrom som dere tenkte på da dere skrev antallet. Eksempel: «40» og «per uke» betyr omtrent 40 saker i gjennomsnitt per uke.",
      questionType: "multiple_choice" as const,
      required: false,
      options: [
        { id: "day", label: "Per dag" },
        { id: "week", label: "Per uke" },
        { id: "month", label: "Per måned" },
      ],
      mappingTargets: [
        { kind: "assessmentChoice" as const, field: "caseVolumeUnit" as const },
      ],
    },
    {
      id: crypto.randomUUID(),
      label: "Alternativt: omtrent hvor mange årsverk brukes på denne oppgaven?",
      helpText:
        "Valgfritt. Ett årsverk = én heltidsstilling i ett år. Desimal er ok (f.eks. 0,25). Fyll inn hvis det er enklere enn tid per sak — brukes i vurderingen når dere ikke kjenner minutter eller timer godt nok.",
      questionType: "number" as const,
      required: false,
      options: [],
      mappingTargets: [
        { kind: "assessmentNumber" as const, field: "manualFteEstimate" as const },
      ],
    },
    {
      id: crypto.randomUUID(),
      label: "Hvor mange arbeidsdager per år bruker dere i beregninger?",
      helpText:
        "Valgfritt: antall arbeidsdager per kalenderår (typisk omtrent 220–250 i Norge). Bare fyll inn hvis dere avviker fra vanlig mønster. Brukes i vurderingens årsoppgjør for tid.",
      questionType: "number" as const,
      required: false,
      options: [],
      mappingTargets: [
        { kind: "assessmentNumber" as const, field: "workingDays" as const },
      ],
    },
    {
      id: crypto.randomUUID(),
      label: "Hvor mange timer per arbeidsdag er normalt hos dere?",
      helpText:
        "Valgfritt: timer per arbeidsdag, ofte 7,5. Brukes sammen med arbeidsdager i vurderingen. Hopp over hvis standard passer.",
      questionType: "number" as const,
      required: false,
      options: [],
      mappingTargets: [
        {
          kind: "assessmentNumber" as const,
          field: "workingHoursPerDay" as const,
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      label: "Gjøres jobben stort sett på samme måte hver gang?",
      helpText:
        "1 = veldig ulikt fra gang til gang · 5 = nesten alltid likt. (Samme spørsmål som i vår vurdering.)",
      questionType: "scale" as const,
      required: false,
      options: [],
      mappingTargets: [
        { kind: "assessmentScale" as const, field: "processVariability" as const },
      ],
    },
    {
      id: crypto.randomUUID(),
      label: "Hvor mye skjønn og vurdering trengs underveis?",
      helpText:
        "1 = mye menneskelig vurdering · 5 = lite, mest faste regler. (Samme som i vurderingen.)",
      questionType: "scale" as const,
      required: false,
      options: [],
      mappingTargets: [{ kind: "assessmentScaleInvertedLength" as const }],
    },
    {
      id: crypto.randomUUID(),
      label: "Ligger opplysningene klart i skjema og felt — eller mye fri tekst og notater?",
      helpText:
        "1 = mye fritekst · 5 = mest i faste felt. Enklere felt gjør automatisering enklere.",
      questionType: "scale" as const,
      required: false,
      options: [],
      mappingTargets: [
        { kind: "assessmentScale" as const, field: "structuredInput" as const },
      ],
    },
    {
      id: crypto.randomUUID(),
      label: "Hvor stabile er rutinene og skjermbildene i systemene — endrer de seg ofte?",
      helpText:
        "1 = endrer seg ofte · 5 = ganske stabilt. Samme som «prosess og system» i vurderingen.",
      questionType: "scale" as const,
      required: false,
      options: [],
      mappingTargets: [{ kind: "assessmentStabilityBoth" as const }],
    },
    {
      id: crypto.randomUUID(),
      label: "Er arbeidet mest på papir og skanning — eller digitalt i systemer?",
      helpText:
        "1 = mye papir · 5 = helt digitalt. Samme som i vurderingen.",
      questionType: "scale" as const,
      required: false,
      options: [],
      mappingTargets: [
        { kind: "assessmentScale" as const, field: "digitization" as const },
      ],
    },
    {
      id: crypto.randomUUID(),
      label: "Hvor mange ulike systemer må dere vanligvis inn i for én runde?",
      helpText:
        "1 = ett system · 5 = sju eller flere. Færre systemer gjør det ofte enklere.",
      questionType: "scale" as const,
      required: false,
      options: [],
      mappingTargets: [
        { kind: "assessmentScale" as const, field: "applicationCount" as const },
      ],
    },
    {
      id: crypto.randomUUID(),
      label: "Hva kan gå galt for brukere, drift eller regelverk hvis noe feiler?",
      helpText:
        "Én eller noen få setninger om konsekvens. Brukes i vurderingen (blant annet risiko og begrensninger) og kan bidra til ROS (risikoanalyse) når forslaget er godkjent.",
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
      id: crypto.randomUUID(),
      label:
        "Valgfritt: beskriv et konkret scenario der noe går galt (hendelse eller feil)",
      helpText:
        "F.eks. «roboten stopper midt i flyten» eller «feil tall inn i økonomisystemet». Går inn som eget ROS-punkt (annen rad enn konsekvens-spørsmålet over).",
      questionType: "text" as const,
      required: false,
      options: [],
      mappingTargets: [{ kind: "rosRiskDescription" as const }],
    },
    {
      id: personalDataQuestionId,
      label: "Håndterer oppgaven personopplysninger om enkeltpersoner?",
      helpText:
        "Velg ja hvis dere f.eks. bruker navn, kontaktinfo, ID-nummer eller helseopplysninger. Styrer personvern-relevante felt i vurderingen ved godkjenning.",
      questionType: "yes_no" as const,
      required: true,
      options: [],
      mappingTargets: [{ kind: "pvvPersonalData" as const }],
    },
    {
      id: crypto.randomUUID(),
      label: "Hvilken type personopplysninger er mest sentralt her?",
      helpText:
        "Velg det som best beskriver det dere bruker mest. Går inn under sikkerhet og personvern i vurderingen.",
      questionType: "multiple_choice" as const,
      required: true,
      options: [
        { id: "name", label: "Navn" },
        { id: "contact", label: "Kontaktopplysninger" },
        { id: "national_id", label: "Fødselsnummer eller personnummer" },
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
      label: "Hva brukes personopplysningene til — og hvorfor er det nødvendig?",
      helpText:
        "Kort om formål (f.eks. saksbehandling, kundeoppfølging). Brukes i vurderingen under personvern og dokumentasjon.",
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
      ],
    },
    {
      id: crypto.randomUUID(),
      label:
        "Har dere fra før noe som ligner — med robot eller annen automatisering?",
      helpText:
        "Gjelder lege, saksbehandler, HR, IT eller andre. Samme valg som i vurderingen.",
      questionType: "multiple_choice" as const,
      required: false,
      options: [
        { id: "unsure", label: "Vet ikke ennå" },
        { id: "yes_here", label: "Ja — vi har noe lignende hos oss" },
        {
          id: "yes_elsewhere_or_similar",
          label: "Ja — kjent fra andre steder eller tidligere",
        },
        { id: "no", label: "Nei — dette er nytt for oss" },
      ],
      mappingTargets: [{ kind: "assessmentRpaSimilar" as const }],
    },
    {
      id: crypto.randomUUID(),
      label:
        "Blir gevinsten større enn jobben med å få det på plass? (tid, kvalitet, penger …)",
      helpText:
        "1 = neppe verdt innsatsen, 5 = klart verdt det. Skala 1–5 — eget anslag.",
      questionType: "scale" as const,
      required: false,
      options: [],
      mappingTargets: [
        {
          kind: "assessmentScale" as const,
          field: "rpaExpectedBenefitVsEffort" as const,
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      label: "Hvor raskt kan dere få effekt — uten et stort prosjekt først?",
      helpText:
        "1 = lang vei, 5 = kan gi effekt ganske raskt. Skala 1–5.",
      questionType: "scale" as const,
      required: false,
      options: [],
      mappingTargets: [
        {
          kind: "assessmentScale" as const,
          field: "rpaQuickWinPotential" as const,
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      label: "Hvor krevende tror dere det er å få dette trygt i drift?",
      helpText:
        "1 = enkelt, 5 = svært krevende. Skala 1–5 — eget anslag, ikke IT-prøve.",
      questionType: "scale" as const,
      required: false,
      options: [],
      mappingTargets: [
        {
          kind: "assessmentScale" as const,
          field: "rpaImplementationDifficulty" as const,
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      label:
        "Er det noe som gjør at dette ikke bør løses med robot i skjermbilder — eller at annen løsning er bedre?",
      helpText: "Valgfritt.",
      questionType: "multiple_choice" as const,
      required: false,
      options: [
        { id: "none", label: "Nei / ingen slik grunn" },
        { id: "low_payback", label: "Lite å hente i tid eller penger" },
        {
          id: "not_rpa_suitable",
          label: "Passer ikke med robot som jobber i skjermbilder",
        },
        {
          id: "integration_preferred",
          label: "Bedre med direkte kobling mellom systemer (ikke robot)",
        },
        {
          id: "organizational_block",
          label: "Vanskelig å få til hos oss akkurat nå",
        },
        { id: "unsure", label: "Usikker — må avklares" },
      ],
      mappingTargets: [{ kind: "assessmentRpaBarrier" as const }],
    },
    {
      id: crypto.randomUUID(),
      label: "Kort forklaring på forrige svar (valgfritt)",
      helpText: "Ett avsnitt holder.",
      questionType: "text" as const,
      required: false,
      options: [],
      mappingTargets: [
        { kind: "assessmentText" as const, field: "rpaBarrierNotes" as const },
      ],
    },
    {
      id: crypto.randomUUID(),
      label:
        "Hvilken gevinst håper dere på — og hva gjør dere i dag kontra hva roboten skal gjøre?",
      helpText:
        "Skriv gjerne om manuell tid vs. tid med robot, ventetid (ting som sjeldent gjøres nå men bør gjøres med en gang), og at oppgaver ikke blir liggende eller glemt.",
      questionType: "text" as const,
      required: false,
      options: [],
      mappingTargets: [
        {
          kind: "assessmentText" as const,
          field: "rpaBenefitKindsAndOperationsNotes" as const,
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      label:
        "Hvem er kontaktperson som skal følge saken til løsningen er i vanlig bruk (produksjon)?",
      helpText: "Navn og rolle — valgfritt.",
      questionType: "text" as const,
      required: false,
      options: [],
      mappingTargets: [
        { kind: "assessmentText" as const, field: "rpaLifecycleContact" as const },
      ],
    },
    {
      id: crypto.randomUUID(),
      label:
        "Hvis roboten stopper eller gjør feil: hvem tar manuelt over — og hvordan når dere dem?",
      helpText: "Valgfritt. Viktig for beredskap.",
      questionType: "text" as const,
      required: false,
      options: [],
      mappingTargets: [
        {
          kind: "assessmentText" as const,
          field: "rpaManualFallbackWhenRobotFails" as const,
        },
      ],
    },
  ];
}
