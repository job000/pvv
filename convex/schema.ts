import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { type Infer, v } from "convex/values";

const rosCellItemValidator = v.object({
  id: v.string(),
  text: v.string(),
  flags: v.optional(v.array(v.string())),
  afterRow: v.optional(v.number()),
  afterCol: v.optional(v.number()),
  sourceItemId: v.optional(v.string()),
  afterChangeNote: v.optional(v.string()),
});

/** Felles input for én vurdering (Likert 1–5 som tall) */
export const assessmentPayloadFields = {
  processName: v.string(),
  candidateId: v.string(),
  /** Fritekst: kontekst, omfang, forutsetninger (valgfritt; påvirker ikke score) */
  processDescription: v.optional(v.string()),
  /** Mål, forretningsverdi, suksesskriterier (valgfritt; ikke i score) */
  processGoal: v.optional(v.string()),
  /** Roller, ansvar, beslutningstakere (valgfritt) */
  processActors: v.optional(v.string()),
  /** Systemer, integrasjoner, datakilder (valgfritt) */
  processSystems: v.optional(v.string()),
  /** Trinn i flyten, hovedforløp (valgfritt) */
  processFlowSummary: v.optional(v.string()),
  /** Volum, frekvens, topper/sesong (valgfritt) */
  processVolumeNotes: v.optional(v.string()),
  /** Begrensninger, avhengigheter, kjente risikoer (valgfritt) */
  processConstraints: v.optional(v.string()),
  /** Oppfølging, neste avklaring, notat til senere vurdering (valgfritt) */
  processFollowUp: v.optional(v.string()),
  /** Hvor bredt prosessen spenner organisatorisk (styrer veiledning i UI) */
  processScope: v.optional(
    v.union(
      v.literal("single"),
      v.literal("multi"),
      v.literal("unsure"),
    ),
  ),
  processStability: v.number(),
  applicationStability: v.number(),
  structuredInput: v.number(),
  processVariability: v.number(),
  digitization: v.number(),
  processLength: v.number(),
  applicationCount: v.number(),
  ocrRequired: v.boolean(),
  thinClientPercent: v.number(),
  timePerCaseValue: v.optional(v.number()),
  timePerCaseUnit: v.optional(
    v.union(v.literal("minutes"), v.literal("hours")),
  ),
  caseVolumeValue: v.optional(v.number()),
  caseVolumeUnit: v.optional(
    v.union(v.literal("day"), v.literal("week"), v.literal("month")),
  ),
  workloadInputMode: v.optional(
    v.union(v.literal("per_case"), v.literal("fte")),
  ),
  minutesPerCase: v.optional(v.number()),
  casesPerWeek: v.optional(v.number()),
  casesPerMonth: v.optional(v.number()),
  manualFteEstimate: v.optional(v.number()),
  baselineHours: v.number(),
  reworkHours: v.number(),
  auditHours: v.number(),
  avgCostPerYear: v.number(),
  workingDays: v.number(),
  workingHoursPerDay: v.number(),
  employees: v.number(),
  /** Kritikalitet: forretningspåvirkning, regulatorisk risiko (Likert 1–5) */
  criticalityBusinessImpact: v.number(),
  criticalityRegulatoryRisk: v.number(),

  /** —— Krav og kontekst (helseforetak / offentlig sektor) —— Tekst påvirker ikke modellscore */
  /** Forventet tjenestenivå for drift og videre utvikling (1./2./3. linje) */
  hfOperationsSupportLevel: v.optional(
    v.union(
      v.literal("unsure"),
      v.literal("l1"),
      v.literal("l2"),
      v.literal("l3"),
      v.literal("mixed"),
    ),
  ),
  /** Sikkerhet, tilgangsstyring, logging, personvern og tilstrekkelig dokumentasjon */
  hfSecurityInformationNotes: v.optional(v.string()),
  /** Organisasjonsbredde: HF, avdelinger, samhandling, koordinering */
  hfOrganizationalBreadthNotes: v.optional(v.string()),
  /** Besparelse, økonomisk effekt, kritikalitet i kroner og ressurs */
  hfEconomicRationaleNotes: v.optional(v.string()),
  /** Arbeid som ikke utføres i dag og der RPA/automatisering er kritisk */
  hfCriticalManualGapNotes: v.optional(v.string()),
  /** Krav og forventning til utviklere, drift, avtaler (SLA), beredskap */
  hfOperationsSupportNotes: v.optional(v.string()),

  /** Portefølje / RPA-kandidat (Likert 1–5; påvirker ikke modellscore — prioritering og arkiv) */
  rpaExpectedBenefitVsEffort: v.optional(v.number()),
  /** Hvor raskt oppnåelig gevinst (lav hengende frukt) */
  rpaQuickWinPotential: v.optional(v.number()),
  /** 1 = lignende prosess finnes mange steder, 5 = svært spesifikk eller unik for oss */
  rpaProcessSpecificity: v.optional(v.number()),
  /** Selvvurdert hovedbarriere eller grunn til å ikke prioritere RPA */
  rpaBarrierSelfAssessment: v.optional(
    v.union(
      v.literal("none"),
      v.literal("low_payback"),
      v.literal("not_rpa_suitable"),
      v.literal("integration_preferred"),
      v.literal("organizational_block"),
      v.literal("unsure"),
    ),
  ),
  /** Kort begrunnelse — kan støtte ROS og økonomisk vurdering */
  rpaBarrierNotes: v.optional(v.string()),
  /** Har dere lignende automatisering fra før? (RPA eller tilsvarende) */
  rpaSimilarAutomationExists: v.optional(
    v.union(
      v.literal("unsure"),
      v.literal("yes_here"),
      v.literal("yes_elsewhere_or_similar"),
      v.literal("no"),
    ),
  ),
  /** Hvor krevende tror dere det er å få løsningen i drift? (Likert 1–5) */
  rpaImplementationDifficulty: v.optional(v.number()),
  /** Kontaktperson som følger saken til den er i produksjon */
  rpaLifecycleContact: v.optional(v.string()),
  /** Hvem tar manuelt arbeid hvis roboten stopper eller feiler */
  rpaManualFallbackWhenRobotFails: v.optional(v.string()),
  /**
   * Fritekst: hvilken gevinst (tid, kvalitet, ventetid), manuell tid vs. tid med robot,
   * at oppgaver ikke blir liggende / glemt — for alle roller (ikke IT-språk).
   */
  rpaBenefitKindsAndOperationsNotes: v.optional(v.string()),
};

export const assessmentPayloadValidator = v.object(assessmentPayloadFields);
export type AssessmentPayload = Infer<typeof assessmentPayloadValidator>;

export const computedSnapshotValidator = v.object({
  ap: v.number(),
  feasible: v.boolean(),
  easeBase: v.number(),
  ease: v.number(),
  easeLabel: v.string(),
  criticality: v.number(),
  hoursY: v.number(),
  fte: v.number(),
  costY: v.number(),
  benH: v.number(),
  benC: v.number(),
  benFte: v.number(),
  benHPerEmp: v.number(),
  benCPerEmp: v.number(),
  benFtePerEmp: v.number(),
  /** Samlet porteføljeprioritet (geometrisk av AP og kritikalitet) */
  priorityScore: v.number(),
});

export const intakeFormStatusValidator = v.union(
  v.literal("draft"),
  v.literal("published"),
  v.literal("archived"),
);

export const intakeLayoutModeValidator = v.union(
  v.literal("one_per_screen"),
  v.literal("grouped"),
);

export const intakeQuestionTypeValidator = v.union(
  v.literal("text"),
  v.literal("number"),
  v.literal("multiple_choice"),
  v.literal("scale"),
  v.literal("yes_no"),
);

export const intakeLinkAccessModeValidator = v.union(
  v.literal("anonymous"),
  v.literal("email_required"),
);

export const intakeConfirmationModeValidator = v.union(
  v.literal("none"),
  v.literal("email_copy"),
);

export const intakeSubmissionStatusValidator = v.union(
  v.literal("submitted"),
  v.literal("under_review"),
  v.literal("approved"),
  v.literal("rejected"),
);

export const intakeQuestionOptionValidator = v.object({
  id: v.string(),
  label: v.string(),
});

export const intakeConditionalMatchValidator = v.union(
  v.object({
    kind: v.literal("yes_no"),
    value: v.boolean(),
  }),
  v.object({
    kind: v.literal("multiple_choice"),
    optionId: v.string(),
  }),
  v.object({
    kind: v.literal("scale"),
    value: v.number(),
  }),
);

export const intakeQuestionVisibilityRuleValidator = v.object({
  parentQuestionKey: v.string(),
  match: intakeConditionalMatchValidator,
});

export const intakeMappingTargetValidator = v.union(
  v.object({
    kind: v.literal("assessmentText"),
    field: v.union(
      v.literal("processName"),
      v.literal("processDescription"),
      v.literal("processGoal"),
      v.literal("processActors"),
      v.literal("processSystems"),
      v.literal("processFlowSummary"),
      v.literal("processVolumeNotes"),
      v.literal("processConstraints"),
      v.literal("processFollowUp"),
      v.literal("hfSecurityInformationNotes"),
      v.literal("hfOrganizationalBreadthNotes"),
      v.literal("hfEconomicRationaleNotes"),
      v.literal("hfCriticalManualGapNotes"),
      v.literal("hfOperationsSupportNotes"),
      v.literal("rpaBarrierNotes"),
      v.literal("rpaLifecycleContact"),
      v.literal("rpaManualFallbackWhenRobotFails"),
      v.literal("rpaBenefitKindsAndOperationsNotes"),
    ),
  }),
  v.object({
    kind: v.literal("assessmentScale"),
    field: v.union(
      v.literal("criticalityBusinessImpact"),
      v.literal("criticalityRegulatoryRisk"),
      v.literal("rpaExpectedBenefitVsEffort"),
      v.literal("rpaQuickWinPotential"),
      v.literal("rpaProcessSpecificity"),
      v.literal("rpaImplementationDifficulty"),
    ),
  }),
  v.object({
    kind: v.literal("assessmentRpaBarrier"),
  }),
  v.object({
    kind: v.literal("assessmentRpaSimilar"),
  }),
  v.object({
    kind: v.literal("assessmentNumber"),
    field: v.union(
      v.literal("timePerCaseValue"),
      v.literal("caseVolumeValue"),
      v.literal("manualFteEstimate"),
      v.literal("workingDays"),
      v.literal("workingHoursPerDay"),
    ),
  }),
  v.object({
    kind: v.literal("assessmentChoice"),
    field: v.union(
      v.literal("timePerCaseUnit"),
      v.literal("caseVolumeUnit"),
    ),
  }),
  v.object({
    kind: v.literal("derivedFrequency"),
  }),
  v.object({
    kind: v.literal("rosConsequence"),
  }),
  v.object({
    kind: v.literal("rosRiskDescription"),
  }),
  v.object({
    kind: v.literal("pvvPersonalData"),
  }),
);

export const intakeAnswerValidator = v.union(
  v.object({
    questionId: v.string(),
    kind: v.literal("text"),
    value: v.string(),
  }),
  v.object({
    questionId: v.string(),
    kind: v.literal("number"),
    value: v.number(),
  }),
  v.object({
    questionId: v.string(),
    kind: v.literal("multiple_choice"),
    optionId: v.string(),
    label: v.string(),
  }),
  v.object({
    questionId: v.string(),
    kind: v.literal("scale"),
    value: v.number(),
  }),
  v.object({
    questionId: v.string(),
    kind: v.literal("yes_no"),
    value: v.boolean(),
  }),
);

export const intakeRiskSuggestionValidator = v.object({
  id: v.string(),
  title: v.string(),
  description: v.string(),
  severity: v.number(),
});

export const intakeRosSuggestionValidator = v.object({
  shouldCreateRos: v.boolean(),
  summary: v.optional(v.string()),
  risks: v.array(intakeRiskSuggestionValidator),
});

export const intakeGeneratedAssessmentValidator = v.object({
  title: v.string(),
  payload: assessmentPayloadValidator,
  autoFilledFields: v.array(v.string()),
});

export const intakeSubmitterMetaValidator = v.object({
  name: v.optional(v.string()),
  email: v.optional(v.string()),
});

export type IntakeMappingTarget = Infer<typeof intakeMappingTargetValidator>;
export type IntakeAnswer = Infer<typeof intakeAnswerValidator>;
export type IntakeQuestionVisibilityRule = Infer<
  typeof intakeQuestionVisibilityRuleValidator
>;
export type IntakeGeneratedAssessment = Infer<
  typeof intakeGeneratedAssessmentValidator
>;
export type IntakeRosSuggestion = Infer<typeof intakeRosSuggestionValidator>;

/** ROS / PDD (risiko og personvern i helse/forvaltning) */
export const complianceStatusValidator = v.union(
  v.literal("not_started"),
  v.literal("in_progress"),
  v.literal("completed"),
  v.literal("not_applicable"),
);

/** Strukturert peker til rammeverk (EU/Norge/ISO/intern) — brukt på ROS-analyse og PVV-kobling */
export const rosRequirementRefValidator = v.object({
  source: v.union(
    v.literal("gdpr"),
    v.literal("nis2"),
    v.literal("iso31000"),
    v.literal("iso27005"),
    v.literal("norwegian_law"),
    v.literal("internal"),
  ),
  article: v.optional(v.string()),
  note: v.optional(v.string()),
  documentationUrl: v.optional(v.string()),
});

/** RPA / CoE pipeline (iterativ, raskere enn klassisk utvikling) */
export const pipelineStatusValidator = v.union(
  v.literal("not_assessed"),
  v.literal("assessed"),
  v.literal("prioritized"),
  v.literal("development"),
  v.literal("uat"),
  v.literal("production"),
  v.literal("monitoring"),
  v.literal("done"),
  v.literal("on_hold"),
);

export default defineSchema({
  ...authTables,

  workspaces: defineTable({
    name: v.string(),
    ownerUserId: v.id("users"),
    createdAt: v.number(),
    /** Fritekst: formål, retningslinjer, kontekst for teamet */
    notes: v.optional(v.string()),
    /** Virksomhets-/institusjonsnummer (f.eks. offentlig sektor) */
    organizationNumber: v.optional(v.string()),
    /** Valgfri HER-id eller annen institusjons-ID for integrasjoner */
    institutionIdentifier: v.optional(v.string()),
    /** @deprecated Bruk githubDefaultRepoFullNames. Beholdes for eldre data. */
    githubDefaultRepoFullName: v.optional(v.string()),
    /** Standard GitHub-repoer for nye issues (én eller flere; første brukes som standard ved opprettelse) */
    githubDefaultRepoFullNames: v.optional(v.array(v.string())),
    /** GitHub Project (ny) — GraphQL node-ID (PVT_kw…) for automatisk å legge til opprettede issues */
    githubProjectNodeId: v.optional(v.string()),
    /** Når true: nye prosesser i registeret kan automatisk legges inn som utkast i prosjektet */
    githubAutoRegisterProcessOnCreate: v.optional(v.boolean()),
    /** Single-select option-id for Status (må matche prosjektets felt) */
    githubAutoRegisterProcessStatusOptionId: v.optional(v.string()),
    /**
     * Hvilket enkeltvalg-felt i prosjektet som styrer «kolonne»/status i PVV.
     * Tom = automatisk: felt som heter «Status», ellers første enkeltvalg-felt.
     */
    githubProjectSingleSelectFieldId: v.optional(v.string()),
    /** Cache av Status-felt fra GitHub Projects (GraphQL) — reduserer rate limit */
    githubProjectStatusFieldCacheAt: v.optional(v.number()),
    githubProjectStatusFieldCache: v.optional(
      v.object({
        forProjectNodeId: v.string(),
        /** __auto__ eller valgt felt-id (matcher githubProjectSingleSelectFieldId) */
        preferredFieldKey: v.optional(v.string()),
        fieldId: v.string(),
        fieldName: v.string(),
        options: v.array(v.object({ id: v.string(), name: v.string() })),
      }),
    ),
  }).index("by_owner", ["ownerUserId"]),

  /**
   * GitHub PAT per arbeidsområde (fine-grained eller klassisk).
   * Leses kun av interne actions — eksponeres aldri i queries til klient.
   */
  workspaceGithubSecrets: defineTable({
    workspaceId: v.id("workspaces"),
    token: v.string(),
    updatedAt: v.number(),
    updatedByUserId: v.id("users"),
  }).index("by_workspace", ["workspaceId"]),

  /** Brukerpreferanser (f.eks. standard arbeidsområde etter innlogging) */
  userSettings: defineTable({
    userId: v.id("users"),
    defaultWorkspaceId: v.optional(v.id("workspaces")),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    /** Valgfritt — brukes bare i profil/visning. null = fjernet eksplisitt. */
    age: v.optional(v.union(v.number(), v.null())),
    /** Synkroniseres med next-themes når innlogget. */
    themePreference: v.optional(
      v.union(v.literal("light"), v.literal("dark"), v.literal("system")),
    ),
    /** Global UI-tetthet (komfortabel vs kompakt). */
    uiDensity: v.optional(
      v.union(v.literal("comfortable"), v.literal("compact")),
    ),
    /** Profilbilde i Convex storage; null = fjernet eksplisitt. */
    profileImageId: v.optional(v.union(v.id("_storage"), v.null())),
    /** false = aldri vis prosessregister-veiledning; undefined/true = tillat (se dismissed). */
    prosessregisterTutorialEnabled: v.optional(v.boolean()),
    /** true = bruker valgte «ikke vis mer»; kan nullstilles ved å slå på veiledning i dashboard. */
    prosessregisterTutorialDismissed: v.optional(v.boolean()),
    /**
     * Etter innlogging / når du åpner app uten ?oversikt=1: gå til oversikt eller til
     * standard arbeidsområde (defaultWorkspaceId må være satt).
     */
    appEntryPreference: v.optional(
      v.union(v.literal("dashboard"), v.literal("workspace")),
    ),
    /** false = ikke e-post ved direkte innmelding; ventende invitasjons-e-post sendes uansett. */
    notifyEmailInvitations: v.optional(v.boolean()),
    /** Ukentlig sammendrag av åpne vurderinger (ikke «ferdig»). false = av. */
    notifyEmailDraftSummaryWeekly: v.optional(v.boolean()),
    /** Forberedt for fremtidige sikkerhetsvarsler (innlogging m.m.). false = av. */
    notifyEmailSecurityAlerts: v.optional(v.boolean()),
    /** Siste gang ukentlig utkast-sammendrag ble sendt (kjøling). */
    lastWeeklyDraftDigestSentAt: v.optional(v.number()),
  }).index("by_user", ["userId"]),

  /**
   * In-app-varsler (topplinje). Uavhengig av e-postinnstillinger under «Varslinger».
   */
  userInAppNotifications: defineTable({
    userId: v.id("users"),
    title: v.string(),
    body: v.optional(v.string()),
    /** Intern app-sti, f.eks. /w/<workspaceId> eller /w/.../a/<assessmentId> */
    href: v.optional(v.string()),
    readAt: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_user_created", ["userId", "createdAt"]),

  /**
   * Per-bruker visning av arbeidsområdets dashboard (snarveier og seksjoner).
   * Manglende rad = standard (alle snarveier og alle seksjoner synlige).
   */
  workspaceUserViewPrefs: defineTable({
    userId: v.id("users"),
    workspaceId: v.id("workspaces"),
    /** Synlige snarveier (id-strenger, f.eks. vurderinger, ros) */
    visibleShortcutIds: v.array(v.string()),
    showMetrics: v.boolean(),
    showPrioritySection: v.boolean(),
    showRecentSection: v.boolean(),
    showBegreperSection: v.boolean(),
    updatedAt: v.number(),
  }).index("by_user_workspace", ["userId", "workspaceId"]),

  /** Ventende e-postinvitasjoner til workspace */
  workspaceInvites: defineTable({
    workspaceId: v.id("workspaces"),
    email: v.string(),
    role: v.union(
      v.literal("admin"),
      v.literal("member"),
      v.literal("viewer"),
    ),
    token: v.string(),
    invitedByUserId: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_email", ["email"])
    .index("by_token", ["token"])
    .index("by_workspace", ["workspaceId"]),

  /**
   * Invitasjon til registrert bruker — må godtas før workspaceMembers opprettes.
   * E-postbaserte ventende invitasjoner (workspaceInvites) materialiseres hit ved innlogging.
   */
  workspaceUserInvites: defineTable({
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    role: v.union(
      v.literal("admin"),
      v.literal("member"),
      v.literal("viewer"),
    ),
    invitedByUserId: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_user", ["userId", "createdAt"])
    .index("by_user_workspace", ["userId", "workspaceId"]),

  /**
   * Organisasjonskart (offentlig sektor / sykehus): Helseforetak → avdeling → seksjon.
   * Merkantil kontakt og tilleggsinfo kan settes per enhet.
   */
  orgUnits: defineTable({
    workspaceId: v.id("workspaces"),
    parentId: v.optional(v.id("orgUnits")),
    kind: v.union(
      v.literal("helseforetak"),
      v.literal("avdeling"),
      v.literal("seksjon"),
    ),
    name: v.string(),
    shortName: v.optional(v.string()),
    sortOrder: v.number(),
    merkantilContactName: v.optional(v.string()),
    merkantilContactEmail: v.optional(v.string()),
    merkantilContactPhone: v.optional(v.string()),
    merkantilContactTitle: v.optional(v.string()),
    /** Annen nødvendig informasjon (åpningstider, avtalereferanser, m.m.) */
    extraInfo: v.optional(v.string()),
    /** Lokal avdelings-/seksjonskode om ønskelig */
    localCode: v.optional(v.string()),
    createdByUserId: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_parent", ["parentId"]),

  /**
   * Merkantile kontakter (flere per HF/avdeling/seksjon).
   * Eldre data kan fortsatt ligge som enkeltfelt på orgUnits; vises inntil migrert.
   */
  orgUnitContacts: defineTable({
    workspaceId: v.id("workspaces"),
    orgUnitId: v.id("orgUnits"),
    name: v.string(),
    title: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    notes: v.optional(v.string()),
    sortOrder: v.number(),
    createdByUserId: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_org_unit", ["orgUnitId"]),

  /** Registrerte kandidater/prosesser i et workspace (kobles til vurderinger) */
  candidates: defineTable({
    workspaceId: v.id("workspaces"),
    name: v.string(),
    /** Unik kort kode innenfor workspace (vises som referanse i vurdering) */
    code: v.string(),
    notes: v.optional(v.string()),
    orgUnitId: v.optional(v.id("orgUnits")),
    /** Valgfrie felt som kan flette inn i PVV når prosess velges i skjemaet */
    linkHintBusinessOwner: v.optional(v.string()),
    linkHintSystems: v.optional(v.string()),
    linkHintComplianceNotes: v.optional(v.string()),
    /** GitHub Projects v2: kort/utkast koblet til arbeidsområdets prosjekt */
    githubProjectItemNodeId: v.optional(v.string()),
    /** Siste valgte status (single select option id) i prosjektet */
    githubProjectStatusOptionId: v.optional(v.string()),
    /** Når kortet er konvertert til ekte issue: repo (normalisert små bokstaver) + nummer for REST/webhook */
    githubRepoFullName: v.optional(v.string()),
    githubIssueNumber: v.optional(v.number()),
    githubIssueNodeId: v.optional(v.string()),
    createdByUserId: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_code", ["workspaceId", "code"])
    .index("by_github_issue", ["githubRepoFullName", "githubIssueNumber"]),

  workspaceMembers: defineTable({
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    role: v.union(
      v.literal("owner"),
      v.literal("admin"),
      v.literal("member"),
      v.literal("viewer"),
    ),
    joinedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_user", ["userId"])
    .index("by_user_workspace", ["userId", "workspaceId"]),

  /** Vurdering i et workspace */
  assessments: defineTable({
    workspaceId: v.id("workspaces"),
    title: v.string(),
    createdByUserId: v.id("users"),
    updatedAt: v.number(),
    /** Alle i workspace kan se når true; ellers kun collaborators */
    shareWithWorkspace: v.boolean(),
    /** RPA-pipeline (status i porteføljen) */
    pipelineStatus: v.optional(pipelineStatusValidator),
    /** Fra siste utkast (oppdateres ved lagring) */
    cachedPriorityScore: v.optional(v.number()),
    /** Automatiseringspotensial % — cache for oversikter */
    cachedAp: v.optional(v.number()),
    /** Viktighet / konsekvens % — cache for oversikter */
    cachedCriticality: v.optional(v.number()),
    /** Implementeringskompleksitet % — cache (høyere = enklere å bygge) */
    cachedEase: v.optional(v.number()),
    /** Enkel / Middels / Vanskelig — fra siste utkast */
    cachedEaseLabel: v.optional(v.string()),
    /** 0–100 manuell justering av prioritet (overstyrer visning når satt) */
    manualPriorityOverride: v.optional(v.number()),
    /** Rekkefølge i Kanban-kolonne (lavere = høyere) */
    kanbanRank: v.optional(v.number()),
    /** Plassering i organisasjonskart (HF / avdeling / seksjon) */
    orgUnitId: v.optional(v.id("orgUnits")),
    /** ROS – risiko- og sårbarhetsanalyse */
    rosStatus: v.optional(complianceStatusValidator),
    rosUrl: v.optional(v.string()),
    rosNotes: v.optional(v.string()),
    rosCompletedAt: v.optional(v.number()),
    /** PDD – personvernkonsekvensvurdering */
    pddStatus: v.optional(complianceStatusValidator),
    pddUrl: v.optional(v.string()),
    pddNotes: v.optional(v.string()),
    pddCompletedAt: v.optional(v.number()),
    /** Siste automatiske påminnelser om uferdig ROS/PDD (e-post) */
    lastComplianceReminderAt: v.optional(v.number()),
    /** Planlagt neste gjennomgang av ROS/PDD på PVV-saken (påminnelse når dato passert) */
    nextRosPvvReviewAt: v.optional(v.number()),
    /** Kort rutine / hva som skal sjekkes ved neste revisjon */
    rosPvvReviewRoutineNotes: v.optional(v.string()),
    /** Siste e-post om forfalt planlagt gjennomgang (PVV) */
    lastReviewDueReminderAt: v.optional(v.number()),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_updated", ["workspaceId", "updatedAt"]),

  /** Nåværende utkast (autosave) */
  assessmentDrafts: defineTable({
    assessmentId: v.id("assessments"),
    payload: assessmentPayloadValidator,
    updatedAt: v.number(),
    updatedByUserId: v.id("users"),
    /** Økes ved hver vellykket lagring — brukes til samtidig redigering uten stille overskriving */
    revision: v.optional(v.number()),
  }).index("by_assessment", ["assessmentId"]),

  /** Versjonshistorikk */
  assessmentVersions: defineTable({
    assessmentId: v.id("assessments"),
    version: v.number(),
    note: v.optional(v.string()),
    payload: assessmentPayloadValidator,
    computed: computedSnapshotValidator,
    createdByUserId: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_assessment", ["assessmentId"])
    .index("by_assessment_version", ["assessmentId", "version"]),

  /** Rolle per vurdering */
  assessmentCollaborators: defineTable({
    assessmentId: v.id("assessments"),
    userId: v.id("users"),
    role: v.union(
      v.literal("owner"),
      v.literal("editor"),
      v.literal("reviewer"),
      v.literal("viewer"),
    ),
    addedAt: v.number(),
  })
    .index("by_assessment", ["assessmentId"])
    .index("by_user", ["userId"])
    .index("by_user_assessment", ["userId", "assessmentId"]),

  /** Oppgaver knyttet til én vurdering (tildeling, varsling, dashboard) */
  assessmentTasks: defineTable({
    workspaceId: v.id("workspaces"),
    assessmentId: v.id("assessments"),
    title: v.string(),
    description: v.optional(v.string()),
    assigneeUserId: v.optional(v.id("users")),
    createdByUserId: v.id("users"),
    status: v.union(v.literal("open"), v.literal("done")),
    /** 1 = høyest … 5 = lavest (dashboard-kolonner) */
    priority: v.optional(v.number()),
    /** Frist (ms) */
    dueAt: v.optional(v.number()),
    /** Global rekkefølge på tvers (lavere = høyere i listen) */
    dashboardRank: v.optional(v.number()),
    createdAt: v.number(),
    /** Knytting til GitHub-issue (`eier/repo` + nummer, repo normalisert til små bokstaver) */
    githubRepoFullName: v.optional(v.string()),
    githubIssueNumber: v.optional(v.number()),
    githubIssueNodeId: v.optional(v.string()),
    githubLastSyncedAt: v.optional(v.number()),
  })
    .index("by_assessment", ["assessmentId"])
    .index("by_workspace", ["workspaceId"])
    .index("by_assignee", ["assigneeUserId"])
    .index("by_github_issue", ["githubRepoFullName", "githubIssueNumber"]),

  /** Korte team-notater på vurderingen (samarbeid / hvem sa hva) */
  assessmentNotes: defineTable({
    workspaceId: v.id("workspaces"),
    assessmentId: v.id("assessments"),
    authorUserId: v.id("users"),
    body: v.string(),
    /** Valgfritt: knytt kommentar til et skjemafelt (nøkkel i assessment payload) */
    fieldKey: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_assessment", ["assessmentId"]),

  /** Enkle skjema per arbeidsområde for innsendte forslag til vurdering. */
  intakeForms: defineTable({
    workspaceId: v.id("workspaces"),
    title: v.string(),
    description: v.optional(v.string()),
    status: intakeFormStatusValidator,
    layoutMode: intakeLayoutModeValidator,
    /** Når layoutMode er one_per_screen: antall synlige spørsmål per steg før «Neste». Standard 1 i klient. */
    questionsPerPage: v.optional(v.number()),
    confirmationMode: v.optional(intakeConfirmationModeValidator),
    rosIntegrationEnabled: v.optional(v.boolean()),
    linkedRosTemplateId: v.optional(v.id("rosTemplates")),
    isTemplate: v.optional(v.boolean()),
    sourceTemplateFormId: v.optional(v.id("intakeForms")),
    templatePublishedAt: v.optional(v.number()),
    templatePublishedByUserId: v.optional(v.id("users")),
    createdByUserId: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_and_updated_at", ["workspaceId", "updatedAt"])
    .index("by_source_template_form", ["sourceTemplateFormId"]),

  intakeFormQuestions: defineTable({
    formId: v.id("intakeForms"),
    questionKey: v.optional(v.string()),
    order: v.number(),
    label: v.string(),
    helpText: v.optional(v.string()),
    questionType: intakeQuestionTypeValidator,
    required: v.boolean(),
    options: v.optional(v.array(intakeQuestionOptionValidator)),
    mappingTargets: v.array(intakeMappingTargetValidator),
    visibilityRule: v.optional(intakeQuestionVisibilityRuleValidator),
    groupKey: v.optional(v.string()),
    plainLanguageHint: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_form_and_order", ["formId", "order"]),

  intakeFormLinks: defineTable({
    formId: v.id("intakeForms"),
    workspaceId: v.id("workspaces"),
    token: v.string(),
    expiresAt: v.number(),
    maxResponses: v.optional(v.number()),
    responseCount: v.number(),
    restrictedAccessMode: intakeLinkAccessModeValidator,
    createdByUserId: v.id("users"),
    createdAt: v.number(),
    pausedAt: v.optional(v.number()),
    revokedAt: v.optional(v.number()),
  })
    .index("by_token", ["token"])
    .index("by_form_and_created_at", ["formId", "createdAt"])
    .index("by_workspace_and_created_at", ["workspaceId", "createdAt"]),

  intakeSubmissions: defineTable({
    workspaceId: v.id("workspaces"),
    formId: v.id("intakeForms"),
    linkId: v.id("intakeFormLinks"),
    submittedAt: v.number(),
    submitterMeta: intakeSubmitterMetaValidator,
    answers: v.array(intakeAnswerValidator),
    status: intakeSubmissionStatusValidator,
    generatedAssessmentDraft: intakeGeneratedAssessmentValidator,
    generatedRosSuggestion: intakeRosSuggestionValidator,
    generatedPvvFlags: v.array(v.string()),
    riskSignals: v.array(v.string()),
    personDataSignal: v.boolean(),
    autoGeneratedAt: v.number(),
    reviewedAt: v.optional(v.number()),
    reviewedByUserId: v.optional(v.id("users")),
    rejectionReason: v.optional(v.string()),
    approvedAssessmentId: v.optional(v.id("assessments")),
    approvedRosAnalysisId: v.optional(v.id("rosAnalyses")),
    /** Manuelt opprettet GitHub-issue + prosjektkort (ikke automatisk fra skjema) */
    githubProjectItemNodeId: v.optional(v.string()),
    githubProjectStatusOptionId: v.optional(v.string()),
    githubRepoFullName: v.optional(v.string()),
    githubIssueNumber: v.optional(v.number()),
    githubIssueNodeId: v.optional(v.string()),
  })
    .index("by_form_and_submitted_at", ["formId", "submittedAt"])
    .index("by_workspace_and_submitted_at", ["workspaceId", "submittedAt"])
    .index("by_workspace_and_status_and_submitted_at", [
      "workspaceId",
      "status",
      "submittedAt",
    ])
    .index("by_link_and_submitted_at", ["linkId", "submittedAt"]),

  intakeFormActivations: defineTable({
    sourceFormId: v.id("intakeForms"),
    activatedFormId: v.id("intakeForms"),
    sourceWorkspaceId: v.id("workspaces"),
    targetWorkspaceId: v.id("workspaces"),
    activatedByUserId: v.id("users"),
    activatedAt: v.number(),
    deactivatedAt: v.optional(v.number()),
    deactivatedByUserId: v.optional(v.id("users")),
  })
    .index("by_source_form_and_activated_at", ["sourceFormId", "activatedAt"])
    .index("by_target_workspace_and_activated_at", [
      "targetWorkspaceId",
      "activatedAt",
    ])
    .index("by_activated_form", ["activatedFormId"]),

  /**
   * Gjenbrukbar ROS-mal: sannsynlighet × konsekvens (etiketter per rad/kolonne).
   * Valgfrie beskrivelser per nivå og egendefinerte risikoverdier per celle.
   */
  rosTemplates: defineTable({
    workspaceId: v.id("workspaces"),
    name: v.string(),
    description: v.optional(v.string()),
    rowAxisTitle: v.string(),
    colAxisTitle: v.string(),
    rowLabels: v.array(v.string()),
    colLabels: v.array(v.string()),
    rowDescriptions: v.optional(v.array(v.string())),
    colDescriptions: v.optional(v.array(v.string())),
    /** Egendefinerte risikoverdier per celle (0–5). Erstatter auto-formel. */
    defaultMatrixValues: v.optional(v.array(v.array(v.number()))),
    createdByUserId: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_workspace", ["workspaceId"]),

  /**
   * Gjenbrukbare akse-/etikett-lister (sannsynlighet, konsekvens, tiltak …)
   * med beskrivelse per punkt — CRUD per arbeidsområde.
   */
  rosAxisLists: defineTable({
    workspaceId: v.id("workspaces"),
    name: v.string(),
    description: v.optional(v.string()),
    /** Kort kode (unik per workspace), f.eks. sannsynlighet_v2 */
    code: v.string(),
    createdByUserId: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_code", ["workspaceId", "code"]),

  rosAxisListItems: defineTable({
    listId: v.id("rosAxisLists"),
    label: v.string(),
    description: v.optional(v.string()),
    sortOrder: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_list", ["listId"]),

  /**
   * Brukerdefinerte kategorier for ROS-bibliotek (sortering og filtrering).
   */
  rosLibraryCategories: defineTable({
    workspaceId: v.id("workspaces"),
    name: v.string(),
    sortOrder: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_workspace", ["workspaceId"]),

  /**
   * Gjenbrukbare risiko- og tiltakstekster (bibliotek).
   * visibility "shared" = synlig i alle arbeidsområder brukeren er medlem av.
   */
  rosLibraryItems: defineTable({
    workspaceId: v.id("workspaces"),
    /** Valgfri kategori i samme arbeidsområde (sortering i liste) */
    categoryId: v.optional(v.id("rosLibraryCategories")),
    title: v.string(),
    riskText: v.string(),
    tiltakText: v.optional(v.string()),
    flags: v.optional(v.array(v.string())),
    tags: v.optional(v.array(v.string())),
    createdByUserId: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
    visibility: v.union(v.literal("workspace"), v.literal("shared")),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_visibility", ["visibility"]),

  /**
   * Utfylt ROS-analyse med matrise (0–5 per celle). Kobles til kandidat.
   * @deprecated assessmentId — bruk rosAnalysisAssessments for PVV-kobling (mange-til-mange).
   */
  rosAnalyses: defineTable({
    workspaceId: v.id("workspaces"),
    templateId: v.optional(v.id("rosTemplates")),
    title: v.string(),
    rowAxisTitle: v.string(),
    colAxisTitle: v.string(),
    rowLabels: v.array(v.string()),
    colLabels: v.array(v.string()),
    /** 0 = ikke vurdert, 1–5 = risikonivå — utgangspunkt / før tiltak */
    matrixValues: v.array(v.array(v.number())),
    /** Fritekst per celle (samme dimensjon som matrixValues) — avledet fra cellItems ved lagring */
    cellNotes: v.optional(v.array(v.array(v.string()))),
    /**
     * Flere risiko-/begrunnelse-punkter per celle (før tiltak).
     * cellNotes er sammenslått tekst for PDF/eldre visning.
     */
    cellItems: v.optional(
      v.array(v.array(v.array(rosCellItemValidator))),
    ),
    /** Restrisiko etter planlagte/gjennomførte tiltak */
    matrixValuesAfter: v.optional(v.array(v.array(v.number()))),
    cellNotesAfter: v.optional(v.array(v.array(v.string()))),
    /** Flere punkter per celle (etter tiltak) — cellNotesAfter avledet ved lagring */
    cellItemsAfter: v.optional(
      v.array(v.array(v.array(rosCellItemValidator))),
    ),
    /**
     * Valgfritt eget rutenett for «etter tiltak» (ulike akser/etiketter enn før).
     * Mangler → samme dimensjon som før-matrisen.
     */
    rowAxisTitleAfter: v.optional(v.string()),
    colAxisTitleAfter: v.optional(v.string()),
    rowLabelsAfter: v.optional(v.array(v.string())),
    colLabelsAfter: v.optional(v.array(v.string())),
    candidateId: v.optional(v.id("candidates")),
    assessmentId: v.optional(v.id("assessments")),
    notes: v.optional(v.string()),
    createdByUserId: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
    /** Samtidig redigering — som PVV-utkast */
    revision: v.optional(v.number()),
    /** Planlagt neste revisjon / gjennomgang av analysen */
    nextReviewAt: v.optional(v.number()),
    /** Rutine, referanse eller huskeliste for neste revisjon */
    reviewRoutineNotes: v.optional(v.string()),
    /** Siste e-post om forfalt planlagt ROS-revisjon */
    lastReviewDueReminderAt: v.optional(v.number()),
    /** ISO 31000-inspirert kontekst og metode (valgfritt) */
    methodologyStatement: v.optional(v.string()),
    contextSummary: v.optional(v.string()),
    scopeAndCriteria: v.optional(v.string()),
    riskCriteriaVersion: v.optional(v.string()),
    /** F.eks. definisjon av nivå 0–5 — vises i PDF */
    axisScaleNotes: v.optional(v.string()),
    /** ID-er fra kuratert katalog (f.eks. iso31000, gdpr, nis2_profile) */
    complianceScopeTags: v.optional(v.array(v.string())),
    /** Strukturerte krav-/kildehenvisninger */
    requirementRefs: v.optional(v.array(rosRequirementRefValidator)),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_updated", ["workspaceId", "updatedAt"])
    .index("by_candidate", ["candidateId"])
    .index("by_assessment", ["assessmentId"]),

  /**
   * Tidslinje / logg for ROS-analyse: manuelle innlegg eller auto ved nivåendring.
   * linkedRow/linkedCol peker på matrise (0-basert), valgfritt.
   */
  rosAnalysisJournalEntries: defineTable({
    workspaceId: v.id("workspaces"),
    rosAnalysisId: v.id("rosAnalyses"),
    body: v.string(),
    /** Hvilken matrise cellekoblingen gjelder (mangler = før tiltak, eldre data) */
    matrixPhase: v.optional(
      v.union(v.literal("before"), v.literal("after")),
    ),
    linkedRow: v.optional(v.number()),
    linkedCol: v.optional(v.number()),
    createdByUserId: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_ros_analysis", ["rosAnalysisId"])
    .index("by_workspace", ["workspaceId"]),

  /** Mange-til-mange: ROS-analyse ↔ PVV-vurdering */
  rosAnalysisAssessments: defineTable({
    workspaceId: v.id("workspaces"),
    rosAnalysisId: v.id("rosAnalyses"),
    assessmentId: v.id("assessments"),
    note: v.optional(v.string()),
    /** Manuelt / semantisk flagg for sporbarhet PVV ↔ ROS */
    flags: v.optional(v.array(v.string())),
    /** Synlig i PVV som «krever oppmerksomhet» */
    highlightForPvv: v.optional(v.boolean()),
    /** Kort notat til PVV-kontekst (følger koblingen) */
    pvvLinkNote: v.optional(v.string()),
    /** Strukturerte kravhenvisninger på denne koblingen */
    requirementRefs: v.optional(v.array(rosRequirementRefValidator)),
    createdByUserId: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_ros_analysis", ["rosAnalysisId"])
    .index("by_assessment", ["assessmentId"])
    .index("by_ros_and_assessment", ["rosAnalysisId", "assessmentId"])
    .index("by_workspace", ["workspaceId"]),

  /** Versjonspunkter for ROS-analyse (snapshot av matrise og notat) */
  rosAnalysisVersions: defineTable({
    workspaceId: v.id("workspaces"),
    rosAnalysisId: v.id("rosAnalyses"),
    version: v.number(),
    note: v.optional(v.string()),
    rowAxisTitle: v.string(),
    colAxisTitle: v.string(),
    rowLabels: v.array(v.string()),
    colLabels: v.array(v.string()),
    matrixValues: v.array(v.array(v.number())),
    cellNotes: v.optional(v.array(v.array(v.string()))),
    cellItems: v.optional(
      v.array(v.array(v.array(rosCellItemValidator))),
    ),
    matrixValuesAfter: v.optional(v.array(v.array(v.number()))),
    cellNotesAfter: v.optional(v.array(v.array(v.string()))),
    cellItemsAfter: v.optional(
      v.array(v.array(v.array(rosCellItemValidator))),
    ),
    rowAxisTitleAfter: v.optional(v.string()),
    colAxisTitleAfter: v.optional(v.string()),
    rowLabelsAfter: v.optional(v.array(v.string())),
    colLabelsAfter: v.optional(v.array(v.string())),
    notes: v.optional(v.string()),
    methodologyStatement: v.optional(v.string()),
    contextSummary: v.optional(v.string()),
    scopeAndCriteria: v.optional(v.string()),
    riskCriteriaVersion: v.optional(v.string()),
    axisScaleNotes: v.optional(v.string()),
    complianceScopeTags: v.optional(v.array(v.string())),
    requirementRefs: v.optional(v.array(rosRequirementRefValidator)),
    createdByUserId: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_ros_analysis", ["rosAnalysisId"])
    .index("by_ros_version", ["rosAnalysisId", "version"]),

  /** Oppgaver på ROS-analyse (tildeling, frist, prioritet) */
  rosTasks: defineTable({
    workspaceId: v.id("workspaces"),
    rosAnalysisId: v.id("rosAnalyses"),
    title: v.string(),
    description: v.optional(v.string()),
    assigneeUserId: v.optional(v.id("users")),
    createdByUserId: v.id("users"),
    status: v.union(v.literal("open"), v.literal("done")),
    priority: v.optional(v.number()),
    dueAt: v.optional(v.number()),
    dashboardRank: v.optional(v.number()),
    /**
     * Kobling til konkret risiko-/tiltakspunkt (RosCellItem.id) i analysen.
     * Primær kobling i UI — erstatter ren matrisecelle.
     */
    linkedCellItemId: v.optional(v.string()),
    linkedCellItemPhase: v.optional(
      v.union(v.literal("before"), v.literal("after")),
    ),
    /** @deprecated Eldre oppgaver — bruk linkedCellItemId */
    matrixRow: v.optional(v.number()),
    matrixCol: v.optional(v.number()),
    matrixPhase: v.optional(
      v.union(v.literal("before"), v.literal("after")),
    ),
    riskTreatmentKind: v.optional(
      v.union(
        v.literal("mitigate"),
        v.literal("accept"),
        v.literal("transfer"),
        v.literal("avoid"),
      ),
    ),
    residualRiskAcceptedAt: v.optional(v.number()),
    residualRiskAcceptedNote: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_ros_analysis", ["rosAnalysisId"])
    .index("by_workspace", ["workspaceId"])
    .index("by_assignee", ["assigneeUserId"]),

  /**
   * Tidsbegrenset offentlig lenke (kun sammendrag, ingen redigering).
   * Token er uforutsigbar streng.
   */
  assessmentShareLinks: defineTable({
    token: v.string(),
    assessmentId: v.id("assessments"),
    workspaceId: v.id("workspaces"),
    expiresAt: v.number(),
    createdByUserId: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_assessment", ["assessmentId"]),

  /** E-postinvitasjon (matcher bruker ved innlogging) */
  assessmentInvites: defineTable({
    assessmentId: v.id("assessments"),
    email: v.string(),
    role: v.union(
      v.literal("editor"),
      v.literal("reviewer"),
      v.literal("viewer"),
    ),
    token: v.string(),
    invitedByUserId: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_assessment", ["assessmentId"])
    .index("by_email", ["email"]),
});
