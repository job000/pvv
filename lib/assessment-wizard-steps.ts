/**
 * Én fast flyt for alle vurderinger (også fra inntak).
 * Steg 3 samler verdi; utfyllende porteføljespørsmål ligger valgfritt under steg 5.
 */
export const ASSESSMENT_WIZARD_STEP_LABELS = [
  "Kandidat og volum",
  "Prosess og systemer",
  "Verdi og effekt",
  "Resultat",
  "Valgfritt mer",
] as const;

/** @deprecated Bruk ASSESSMENT_WIZARD_STEP_LABELS */
export const ASSESSMENT_WIZARD_STEP_LABELS_WITH_PORTFOLIO =
  ASSESSMENT_WIZARD_STEP_LABELS;

/** @deprecated Bruk ASSESSMENT_WIZARD_STEP_LABELS */
export const ASSESSMENT_WIZARD_STEP_LABELS_FROM_INTAKE =
  ASSESSMENT_WIZARD_STEP_LABELS;

export type AssessmentWizardStepLabel =
  (typeof ASSESSMENT_WIZARD_STEP_LABELS)[number];
