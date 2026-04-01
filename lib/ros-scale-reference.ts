/**
 * Referanseskala for forklaring av nivå 1–5 på ROS-akser (sannsynlighet / konsekvens).
 * Utgangspunkt: typisk grovanalyse med akseptkriterier (f.eks. helsesektor).
 * Dette er standardtekst; brukeren kan i malen endre akser, nivåtekster og egen definisjon (axisScaleNotes).
 */

export type RosProbabilityLevelRef = {
  level: 1 | 2 | 3 | 4 | 5;
  label: string;
  description: string;
  frequency: string;
  percentageRange: string;
};

export type RosConsequenceLevelRef = {
  level: 1 | 2 | 3 | 4 | 5;
  label: string;
  /** Generell konsekvens (person, miljø, økonomi, omdømme) */
  general: string;
  /** Informasjonssikkerhet / behandling */
  informationSecurity: string;
  /** Datasikkerhet / tilgjengelighet */
  dataSecurity: string;
};

export const ROS_SCALE_REFERENCE_META = {
  presetId: "nlsh-grovanalyse-v1",
  title: "Standard referanse (sannsynlighet og konsekvens)",
  shortNote:
    "Tekstene under er forhåndsdefinerte forklaringer av nivå 1–5. I ROS-malen kan du tilpasse aksetitler, tekst på hvert matrisenivå (rad og kolonne) og valgfritt eget felt «Definisjon av nivå 0–5» under Livsløp og etterlevelse — den beskrivelsen er gjeldende for denne analysen når den er utfylt.",
} as const;

/** Sannsynlighet — nivå 1–5 med frekvens og omtrentlig sannsynlighetsintervall */
export const DEFAULT_ROS_PROBABILITY_REFERENCE: readonly RosProbabilityLevelRef[] =
  [
    {
      level: 1,
      label: "Svært liten",
      description: "Har aldri hørt om dette.",
      frequency: "> 5 år",
      percentageRange: "0–20 %",
    },
    {
      level: 2,
      label: "Liten",
      description:
        "Lite sannsynlig at dette inntreffer. Kun få rapporterte tilfeller.",
      frequency: "1 × år",
      percentageRange: "21–40 %",
    },
    {
      level: 3,
      label: "Middels",
      description:
        "Har hørt om. Dette har hendt før. Noen rapporterte tilfeller.",
      frequency: "1 × mnd.",
      percentageRange: "41–60 %",
    },
    {
      level: 4,
      label: "Stor",
      description:
        "Inntreffer relativt ofte. Flere rapporterte tilfeller.",
      frequency: "1 × uke",
      percentageRange: "61–80 %",
    },
    {
      level: 5,
      label: "Svært stor",
      description:
        "Dette skjer til stadighet. Hyppige rapporterte tilfeller.",
      frequency: "< daglig",
      percentageRange: "81–100 %",
    },
  ];

/** Konsekvens — nivå 1–5 med vekt på helse, IKT og data (eksempel) */
export const DEFAULT_ROS_CONSEQUENCE_REFERENCE: readonly RosConsequenceLevelRef[] =
  [
    {
      level: 1,
      label: "Ubetydelig",
      general:
        "Minimal eller ingen skade på personer og arbeidsmiljø. Ubetydelig materiell skade. Ingen eller svært små økonomiske konsekvenser.",
      informationSecurity:
        "Ingen stans i tjenesteleveranse. Ingen uautorisert tilgang til helse- og personopplysninger. Journaler er fullstendige.",
      dataSecurity:
        "Alle datasystemer tilgjengelige. Enkeltvise systemutfall < 15 min. Stabilt nettverk.",
    },
    {
      level: 2,
      label: "Lav",
      general:
        "Små skader eller belastninger på personer/miljø. Mindre materiell skade. Små økonomiske konsekvenser. Mindre omdømmetap.",
      informationSecurity:
        "Kort stans i tjenesteleveranse. Uautorisert tilgang til enkeltvise helse-/personopplysninger og lovbrudd. Mangler i journal slik at de ikke er fullstendige/oppdaterte.",
      dataSecurity:
        "Kortsiktige utfall på enkeltsystemer (15 min – 3 t). Mindre nettverksforstyrrelser/treghet.",
    },
    {
      level: 3,
      label: "Middels",
      general:
        "Uheldige belastninger eller skader. Skade og økonomi i middels omfang. Kortsiktig omdømmeskade.",
      informationSecurity:
        "Stans i tjenesteleveranse. Uautorisert tilgang til flere journaler, mulighet for endring, lovbrudd. Manglende opplysninger. Uautorisert tilgang for eksterne uten klinisk behov.",
      dataSecurity:
        "Utfall på enkeltsystemer (3–24 t). Utfall på flere systemer < 30 min. Nettverk ustabilt eller utilgjengelig på enkelte enheter.",
    },
    {
      level: 4,
      label: "Alvorlig",
      general:
        "Skade på personer/miljø. Alvorlig materiell og økonomisk skade. Varig omdømmeskade.",
      informationSecurity:
        "Lengre stans i tjenesteleveranse. Uautorisert tilgang til store mengder helse-/personopplysninger, mulighet for endring, lovbrudd. Viktig informasjon mangler i journal. Tilgang for eksterne uten klinisk behov.",
      dataSecurity:
        "Utfall på enkeltsystemer > 24 t. Utfall på flere systemer > 30 min. Nettverk utilgjengelig i deler av virksomheten.",
    },
    {
      level: 5,
      label: "Svært alvorlig / kritisk",
      general:
        "Død eller svært alvorlig skade. Svært alvorlig påvirkning på arbeidsmiljø (konflikt/sykefravær). Omfattende materiell skade. Svært alvorlige økonomiske konsekvenser. Langvarig omdømmeskade.",
      informationSecurity:
        "Full stans i tjenesteleveranse. Full uautorisert tilgang eller mulighet til å endre alle helse-/personopplysninger. Kritisk informasjon mangler. Feil i legemidler, dosering eller behandling.",
      dataSecurity:
        "Ingen nettilgang. Ingen tilgang til eller kontroll over egne datasystemer.",
    },
  ];
