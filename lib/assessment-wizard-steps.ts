/** Eneste kilde til steg-rekkefølge og navn i PVV-veiviseren */
export const ASSESSMENT_WIZARD_STEP_LABELS = [
  "Prosess",
  "Organisasjon",
  "Viktighet",
  "Trygghet",
  "Automatisering",
  "Omfang og teknikk",
  "Tall og kost",
  "Samarbeid",
  "Oppsummering",
] as const;

export type AssessmentWizardStepLabel =
  (typeof ASSESSMENT_WIZARD_STEP_LABELS)[number];

export const ASSESSMENT_WIZARD_STEP_COUNT =
  ASSESSMENT_WIZARD_STEP_LABELS.length;
