/**
 * Full veiviser: eget steg for beslutningsgrunnlag når vurderingen ikke kommer fra inntak.
 */
export const ASSESSMENT_WIZARD_STEP_LABELS_WITH_PORTFOLIO = [
  "Kandidat og volum",
  "Prosess og systemer",
  "Gevinst og drift",
  "Resultat",
  "Detaljer",
] as const;

/**
 * Etter godkjent inntak: samme felt som i skjema, samlet under Resultat (ikke eget hovedsteg).
 */
export const ASSESSMENT_WIZARD_STEP_LABELS_FROM_INTAKE = [
  "Kandidat og volum",
  "Prosess og systemer",
  "Resultat",
  "Detaljer",
] as const;

/** @deprecated Bruk WITH_PORTFOLIO eller FROM_INTAKE avhengig av `assessment.sourcedFromIntake` */
export const ASSESSMENT_WIZARD_STEP_LABELS = ASSESSMENT_WIZARD_STEP_LABELS_FROM_INTAKE;

export type AssessmentWizardStepLabel =
  | (typeof ASSESSMENT_WIZARD_STEP_LABELS_WITH_PORTFOLIO)[number]
  | (typeof ASSESSMENT_WIZARD_STEP_LABELS_FROM_INTAKE)[number];
