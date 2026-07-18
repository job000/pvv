/**
 * Ledelsestekster for tallfestede og ikke-tallfestede RPA-gevinster.
 * Brukes på Gevinster-siden — ikke i scoringsformelen.
 */

export const SOFT_GAIN_LEADERSHIP: Record<
  string,
  { label: string; why: string }
> = {
  fewer_errors: {
    label: "Færre feil / bedre kvalitet",
    why: "Reduserer omarbeid, klager og risiko for feil beslutninger — ofte mer verdifullt enn rå tid.",
  },
  better_overview: {
    label: "Bedre oversikt og sporbarhet",
    why: "Gir revisjonsspor, status i sanntid og færre «hvor ble det av?»-avvik.",
  },
  security_compliance: {
    label: "Sikkerhet og etterlevelse",
    why: "Konsistent logging, tilgang og prosessfølging — vanskelig å prissette, kritisk ved tilsyn.",
  },
  reliable_completion: {
    label: "At jobben faktisk blir gjort",
    why: "Robot kjører når kapasitet mangler. Unngår stille etterslep og skjult teknisk gjeld i køer.",
  },
  faster_flow: {
    label: "Raskere svar / gjennomløp",
    why: "Kortere ledetid forbedrer brukeropplevelse og frigjør kapasitet i resten av verdikjeden.",
  },
  free_capacity: {
    label: "Frigjøre folk til annet arbeid",
    why: "Timer flyttes fra rutine til faglig arbeid — ikke alltid synlig som direkte kostnadsreduksjon.",
  },
  save_time: {
    label: "Spare tid",
    why: "Direkte tid frigjort fra manuell behandling — grunnlaget for timer og FTE-tall.",
  },
  lower_cost: {
    label: "Lavere kostnad",
    why: "Redusert manuell innsats og omarbeid som kan knyttes til årsverkskostnad.",
  },
};

export const REALIZATION_LABELS = {
  potential: "Potensial (kartlagt)",
  in_delivery: "Under leveranse",
  realized: "I drift / realisert",
} as const;
