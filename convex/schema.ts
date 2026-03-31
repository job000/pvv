import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { type Infer, v } from "convex/values";

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
  /** Samlet prioritet: snitt av AP og kritikalitet */
  priorityScore: v.number(),
});

/** ROS / PDD (risiko og personvern i helse/forvaltning) */
export const complianceStatusValidator = v.union(
  v.literal("not_started"),
  v.literal("in_progress"),
  v.literal("completed"),
  v.literal("not_applicable"),
);

/** RPA / CoE-leveranse (iterativ, raskere enn klassisk utvikling) */
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
  }).index("by_owner", ["ownerUserId"]),

  /** Brukerpreferanser (f.eks. standard arbeidsområde etter innlogging) */
  userSettings: defineTable({
    userId: v.id("users"),
    defaultWorkspaceId: v.optional(v.id("workspaces")),
  }).index("by_user", ["userId"]),

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

  /** Sprint / tidsboks (Kanban + prioritering) */
  sprints: defineTable({
    workspaceId: v.id("workspaces"),
    name: v.string(),
    startAt: v.number(),
    endAt: v.number(),
    goal: v.optional(v.string()),
    createdByUserId: v.id("users"),
    createdAt: v.number(),
  }).index("by_workspace", ["workspaceId"]),

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
    createdByUserId: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_code", ["workspaceId", "code"]),

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
    /** Leveranse i RPA-pipeline */
    pipelineStatus: v.optional(pipelineStatusValidator),
    sprintId: v.optional(v.id("sprints")),
    /** Fra siste utkast (oppdateres ved lagring) */
    cachedPriorityScore: v.optional(v.number()),
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
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_updated", ["workspaceId", "updatedAt"]),

  /** Nåværende utkast (autosave) */
  assessmentDrafts: defineTable({
    assessmentId: v.id("assessments"),
    payload: assessmentPayloadValidator,
    updatedAt: v.number(),
    updatedByUserId: v.id("users"),
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
  })
    .index("by_assessment", ["assessmentId"])
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
