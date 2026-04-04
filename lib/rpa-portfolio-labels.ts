/**
 * Portefølje / RPA-kandidat — felles etiketter (vurdering, inntak, PDF).
 * Teksten er virksomhetsnøytral (helse, offentlig, privat).
 */

export const RPA_BARRIER_SELF_ASSESSMENT_VALUES = [
  "none",
  "low_payback",
  "not_rpa_suitable",
  "integration_preferred",
  "organizational_block",
  "unsure",
] as const;

export type RpaBarrierSelfAssessment =
  (typeof RPA_BARRIER_SELF_ASSESSMENT_VALUES)[number];

export const RPA_BARRIER_SELF_ASSESSMENT_LABELS_NB: Record<
  RpaBarrierSelfAssessment,
  string
> = {
  none: "Ingen slik hindring (eller ikke vurdert)",
  low_payback: "Lite å hente i tid eller penger",
  not_rpa_suitable: "Passer ikke med robot som jobber i skjermbilder",
  integration_preferred: "Bedre med direkte kobling mellom systemer (ikke robot)",
  organizational_block: "Vanskelig å få til hos oss akkurat nå",
  unsure: "Usikker — må avklares",
};

/** Har dere noe som ligner fra før (robot eller liknende automatisering)? */
export const RPA_SIMILAR_AUTOMATION_VALUES = [
  "unsure",
  "yes_here",
  "yes_elsewhere_or_similar",
  "no",
] as const;

export type RpaSimilarAutomation =
  (typeof RPA_SIMILAR_AUTOMATION_VALUES)[number];

export const RPA_SIMILAR_AUTOMATION_LABELS_NB: Record<
  RpaSimilarAutomation,
  string
> = {
  unsure: "Vet ikke ennå",
  yes_here: "Ja — vi har noe lignende hos oss",
  yes_elsewhere_or_similar:
    "Ja — kjent fra andre steder eller tidligere prosjekter",
  no: "Nei — dette er nytt for oss",
};
