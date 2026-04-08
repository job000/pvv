/**
 * Korte sektorhenvisninger for ROS-metodehjelp (offentlige kilder).
 * Erstatter ikke juridisk rådgivning.
 */

export type RosSectorMethodologySnippet = {
  id: "general" | "va_water" | "health_care" | "municipal";
  title: string;
  body: string[];
  links: readonly { label: string; href: string }[];
};

export const ROS_SECTOR_METHODOLOGY_SNIPPETS: readonly RosSectorMethodologySnippet[] =
  [
    {
      id: "general",
      title: "Generelt (ISO og personvern)",
      body: [
        "Bruk matrisen til å dokumentere risiko i tråd med prinsippene i ISO 31000 og, der det passer, ISO/IEC 27005 for informasjonssikkerhetsrisiko.",
        "Ved behandling av personopplysninger: vurder om det er behov for konsekvensvurdering (DPIA) i tillegg til generell ROS — se Datatilsynets veiledning.",
      ],
      links: [
        {
          label: "ISO 31000 (iso.org)",
          href: "https://www.iso.org/standard/65694.html",
        },
        {
          label: "GDPR i EUR-Lex (norsk)",
          href: "https://eur-lex.europa.eu/legal-content/NO/TXT/?uri=CELEX%3A32016R0679",
        },
        {
          label: "DPIA — Datatilsynet",
          href: "https://www.datatilsynet.no/rettigheter-og-plikter/virksomhetenes-plikter/konsekvensvurdering/",
        },
      ],
    },
    {
      id: "va_water",
      title: "Vann og avløp",
      body: [
        "For VA er det sentralt å dokumentere risiko for hygienisk sikkerhet, kontinuitet og miljø. Tilpass konsekvensbeskrivelser slik at helse- og miljøaspekter kommer tydelig fram.",
        "Gjeldende forskrifter og veiledning finnes på Lovdata og hos relevante etater — virksomheten må selv peke på konkrete paragraffer som gjelder deres anlegg og konsesjon.",
      ],
      links: [
        { label: "Lovdata", href: "https://lovdata.no" },
        {
          label: "Helsedirektoratet (veiledning)",
          href: "https://www.helsedirektoratet.no",
        },
      ],
    },
    {
      id: "health_care",
      title: "Helse og omsorg",
      body: [
        "ROS i helse bør dekke pasientsikkerhet, tilgjengelighet for kritiske tjenester og beskyttelse av sensitive opplysninger.",
        "Knyt dokumentasjon til internkontroll og personvern — bruk PDD/DPIA der personvernriskoen tilsier det.",
      ],
      links: [
        {
          label: "Personopplysningsloven — Lovdata",
          href: "https://lovdata.no/dokument/NL/lov/2018-06-15-38",
        },
        {
          label: "Datatilsynet",
          href: "https://www.datatilsynet.no",
        },
      ],
    },
    {
      id: "municipal",
      title: "Kommune og forvaltning",
      body: [
        "Kommunal ROS understøtter tjenesteleveranse, beredskap og IKT-drift. Ved behandling av personopplysninger og kritisk infrastruktur: vurder NIS2-omfang og interne retningslinjer.",
      ],
      links: [
        { label: "Lovdata", href: "https://lovdata.no" },
        {
          label: "NIS2 i EUR-Lex (norsk)",
          href: "https://eur-lex.europa.eu/legal-content/NO/TXT/?uri=CELEX%3A32022L2555",
        },
      ],
    },
  ];
