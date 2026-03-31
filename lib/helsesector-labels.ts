/** Etiketter for organisasjonsenheter (offentlig sektor / sykehus) */

export const ORG_UNIT_KIND_LABELS = {
  helseforetak: "Helseforetak",
  avdeling: "Avdeling",
  seksjon: "Seksjon",
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
