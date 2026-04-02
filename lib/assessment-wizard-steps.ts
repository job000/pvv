/** Eneste kilde til steg-rekkefølge og navn i PVV-veiviseren */
export const ASSESSMENT_WIZARD_STEP_LABELS = [
  "Screening",
  "RPA-egnethet",
  "Resultat",
  "Detaljer",
] as const;

export type AssessmentWizardStepLabel =
  (typeof ASSESSMENT_WIZARD_STEP_LABELS)[number];

export const ASSESSMENT_WIZARD_STEP_COUNT =
  ASSESSMENT_WIZARD_STEP_LABELS.length;
