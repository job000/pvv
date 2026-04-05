/** Flervalg under «Verdi og effekt» — arkiv og dialog; påvirker ikke modellformelen direkte. */

export const ASSESSMENT_VALUE_PAIN_OPTIONS = [
  { id: "wait_time", label: "Ventetid og køer" },
  { id: "manual_errors", label: "Manuelle feil og rettinger" },
  { id: "staff_pressure", label: "Høy belastning på ansatte" },
  { id: "cost", label: "Unødvendige kostnader" },
  { id: "compliance", label: "Usikkerhet rundt regler / dokumentasjon" },
  { id: "patient_citizen", label: "Dårlig opplevelse for pasient/bruker" },
] as const;

export const ASSESSMENT_VALUE_GAIN_OPTIONS = [
  { id: "save_time", label: "Spare tid" },
  { id: "fewer_errors", label: "Færre feil" },
  { id: "lower_cost", label: "Lavere kostnad" },
  { id: "faster_flow", label: "Raskere svar / gjennomløp" },
  { id: "better_overview", label: "Bedre oversikt og sporbarhet" },
  { id: "free_capacity", label: "Frigjøre folk til annet arbeid" },
] as const;

export type ValuePainId = (typeof ASSESSMENT_VALUE_PAIN_OPTIONS)[number]["id"];
export type ValueGainId = (typeof ASSESSMENT_VALUE_GAIN_OPTIONS)[number]["id"];
