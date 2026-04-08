/**
 * Etiketter for organisasjonsenheter.
 * Nøklene (helseforetak / avdeling / seksjon / team) er historiske i databasen;
 * visningstekstene er generelle for alle typer virksomheter.
 */
export const ORG_UNIT_KIND_LABELS = {
  helseforetak: "Hovedselskap eller konsern",
  avdeling: "Avdeling eller forretningsenhet",
  seksjon: "Team, gruppe eller seksjon",
  /** Undernivå under seksjon; kan nøstes for flere lag. */
  team: "Team eller undergruppe",
} as const;

/** Status for risiko- og personvernsdokumentasjon (kort språk i lister) */
export const COMPLIANCE_STATUS_LABELS = {
  not_started: "Ikke påbegynt",
  in_progress: "Under arbeid",
  completed: "Ferdig dokumentert",
  not_applicable: "Ikke aktuelt her",
} as const;

export type ComplianceStatusKey = keyof typeof COMPLIANCE_STATUS_LABELS;

export const COMPLIANCE_STATUS_ORDER: ComplianceStatusKey[] = [
  "not_started",
  "in_progress",
  "completed",
  "not_applicable",
];

/** Tjenestenivå drift / videre utvikling (enkle forklaringer) */
export const OPERATIONS_SUPPORT_LEVEL_LABELS = {
  unsure: "Ikke avklart ennå",
  l1: "1. linje — førstelinje (brukerstøtte, superbruker, intern hjelp)",
  l2: "2. linje — spesialister og driftsmiljø (intern kompetanse)",
  l3: "3. linje — leverandør eller dyp teknisk støtte (ekstern)",
  mixed: "Blandet — flere nivåer etter type henvendelse",
} as const;

export type OperationsSupportLevelKey =
  keyof typeof OPERATIONS_SUPPORT_LEVEL_LABELS;
