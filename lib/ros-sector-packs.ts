/**
 * Sektor-pakker for nye ROS-analyser: metodikk, rammeverk-tagger og kravhenvisninger.
 * Kun offentlige kilder. Erstatter ikke juridisk rådgivning.
 * Delt mellom Next.js og Convex (importeres fra convex/ros.ts og convex/workspaces.ts).
 */

export const ROS_SECTOR_PACK_IDS = [
  "general",
  "va_water",
  "health_care",
  "municipal",
] as const;

export type RosSectorPackId = (typeof ROS_SECTOR_PACK_IDS)[number];

/** Matcher `rosRequirementRefValidator` i schema. */
export type RosSectorPackRequirementRef = {
  source:
    | "gdpr"
    | "nis2"
    | "iso31000"
    | "iso27005"
    | "norwegian_law"
    | "internal";
  article?: string;
  note?: string;
  documentationUrl?: string;
};

export type RosSectorPack = {
  id: RosSectorPackId;
  name: string;
  shortDescription: string;
  complianceScopeTags: string[];
  requirementRefs: RosSectorPackRequirementRef[];
  methodologyStatement: string;
  scopeAndCriteria: string;
  axisScaleNotes?: string;
};

const PACKS: readonly RosSectorPack[] = [
  {
    id: "general",
    name: "Generelt (ISO / personvern)",
    shortDescription:
      "ROS etter vanlig praksis med ISO 31000 / ISO/IEC 27005 og støtte for GDPR og NIS2-merking.",
    complianceScopeTags: ["iso31000", "iso27005", "gdpr", "nis2_profile"],
    requirementRefs: [
      {
        source: "iso31000" as const,
        note: "Risikostyring — prinsipper og prosess",
        documentationUrl: "https://www.iso.org/standard/65694.html",
      },
      {
        source: "iso27005" as const,
        note: "Informasjonssikkerhetsrisiko",
        documentationUrl: "https://www.iso.org/standard/80585.html",
      },
      {
        source: "gdpr" as const,
        article: "Art. 32",
        note: "Hensiktsmessige tekniske og organisatoriske tiltak",
        documentationUrl:
          "https://eur-lex.europa.eu/legal-content/NO/TXT/?uri=CELEX%3A32016R0679",
      },
    ],
    methodologyStatement:
      "Vi dokumenterer risiko kvalitativt i sannsynlighet × konsekvens-matrise, vurderer behandling av risiko og rest risiko, og reviser ved endring i kontekst eller etter hendelser — i tråd med prinsippene i ISO 31000.",
    scopeAndCriteria:
      "Omfang og akseptkriterier fastsettes av virksomheten per analyse. Matrisen i PVV støtter 0–5 per celle; nivåer på aksene defineres i mal eller i feltet for skalanotater.",
  },
  {
    id: "va_water",
    name: "Vann og avløp",
    shortDescription:
      "ROS med vekt på kritisk infrastruktur for vannforsyning og avløp — koble til relevant forskriftsgrunnlag på Lovdata.",
    complianceScopeTags: ["iso31000", "norwegian_law", "va_ros"],
    requirementRefs: [
      {
        source: "norwegian_law" as const,
        note: "Drikkevannsforskriften — se gjeldende tekst på Lovdata",
        documentationUrl: "https://lovdata.no",
      },
      {
        source: "norwegian_law" as const,
        note: "Forskrift om avløp — se gjeldende tekst på Lovdata",
        documentationUrl: "https://lovdata.no",
      },
      {
        source: "iso31000" as const,
        note: "Overordnet risikostyring",
        documentationUrl: "https://www.iso.org/standard/65694.html",
      },
    ],
    methodologyStatement:
      "ROS for VA fokuserer på hendelser som kan påvirke hygienisk sikkerhet, kontinuitet i vannforsyning og miljø. Vi vurderer sannsynlighet og konsekvens i matrisen, dokumenterer barrierer og tiltak, og knytter analysen til gjeldende forskriftskrav som virksomheten identifiserer.",
    scopeAndCriteria:
      "Omfatt det systemet eller anlegget som vurderes (inntak, behandling, distribusjon, avløp e.l.). Konsekvens skal reflektere helse, miljø, tjenesteleveranse og eventuelle økonomiske/kompenserende forhold etter virksomhetens kriterier.",
    axisScaleNotes:
      "Tilpass konsekvensbeskrivelser slik at de dekker helseskade, miljøskade, driftsstans og omdømme der det er relevant for deres VA-tjeneste.",
  },
  {
    id: "health_care",
    name: "Helse og omsorg",
    shortDescription:
      "ROS for behandling, drift og IKT i helse- og omsorgssektoren — inkl. personvern og informasjonssikkerhet.",
    complianceScopeTags: ["iso31000", "gdpr", "iso27005", "norwegian_law"],
    requirementRefs: [
      {
        source: "gdpr" as const,
        article: "Art. 32",
        note: "Sikkerhet ved behandling",
        documentationUrl:
          "https://eur-lex.europa.eu/legal-content/NO/TXT/?uri=CELEX%3A32016R0679",
      },
      {
        source: "norwegian_law" as const,
        note: "Personopplysningsloven — se Lovdata",
        documentationUrl: "https://lovdata.no/dokument/NL/lov/2018-06-15-38",
      },
      {
        source: "iso27005" as const,
        note: "Risikovurdering for informasjonssikkerhet",
        documentationUrl: "https://www.iso.org/standard/80585.html",
      },
    ],
    methodologyStatement:
      "Vi kartlegger risiko for pasienter, personell og tjenestekvalitet, inkludert tilgjengelighet og integritet for helseopplysninger. Matrisen brukes til å prioritere tiltak og til å støtte beslutning om behandling og eventuell behov for konsekvensvurdering (DPIA) ved siden av ROS.",
    scopeAndCriteria:
      "Angi hvilke tjenester, systemer og behandlingsgrunnlag som inngår. Konsekvensnivåer bør være konsistente med virksomhetens pasientsikkerhets- og personvernpraksis.",
  },
  {
    id: "municipal",
    name: "Kommune / forvaltning",
    shortDescription:
      "ROS for kommunale tjenester og forvaltningsrelevant IKT — med vekt på kontinuitet og etterlevelse.",
    complianceScopeTags: ["iso31000", "gdpr", "nis2", "norwegian_law"],
    requirementRefs: [
      {
        source: "norwegian_law" as const,
        note: "Forvaltningsloven og sikkerhetsloven der relevant — se Lovdata",
        documentationUrl: "https://lovdata.no",
      },
      {
        source: "gdpr" as const,
        note: "Personvern i kommunale behandlinger",
        documentationUrl:
          "https://eur-lex.europa.eu/legal-content/NO/TXT/?uri=CELEX%3A32016R0679",
      },
      {
        source: "nis2" as const,
        note: "Nett- og informasjonssikkerhet for omfattede virksomheter",
        documentationUrl:
          "https://eur-lex.europa.eu/legal-content/NO/TXT/?uri=CELEX%3A32022L2555",
      },
    ],
    methodologyStatement:
      "Kommunal ROS knyttes til tjenesteleveranse, beredskap, personvern og IKT-drift. Vi bruker matrisen til å dokumentere risiko før og etter tiltak og til å understøtte internkontroll og beslutningsgrunnlag.",
    scopeAndCriteria:
      "Definer hvilke tjenesteområder, systemer og interessenter analysen dekker. Juster akser slik at konsekvens for innbyggere, tillit og lovpålagte plikter kommer tydelig fram.",
  },
] as const;

const PACK_BY_ID = new Map<RosSectorPackId, RosSectorPack>(
  PACKS.map((p) => [p.id, p]),
);

export function listRosSectorPacks(): readonly RosSectorPack[] {
  return PACKS;
}

export function getRosSectorPack(
  id: string | undefined | null,
): RosSectorPack | null {
  if (!id) return null;
  return PACK_BY_ID.get(id as RosSectorPackId) ?? null;
}

export function isValidRosSectorPackId(id: string): id is RosSectorPackId {
  return ROS_SECTOR_PACK_IDS.includes(id as RosSectorPackId);
}

export function sectorPackInitialAnalysisFields(pack: RosSectorPack): {
  methodologyStatement: string;
  scopeAndCriteria: string;
  axisScaleNotes?: string;
  complianceScopeTags: string[];
  requirementRefs: RosSectorPackRequirementRef[];
} {
  return {
    methodologyStatement: pack.methodologyStatement,
    scopeAndCriteria: pack.scopeAndCriteria,
    axisScaleNotes: pack.axisScaleNotes,
    complianceScopeTags: [...pack.complianceScopeTags],
    requirementRefs: pack.requirementRefs.map((r) => ({ ...r })),
  };
}

export function workspaceDefaultSectorPackId(
  workspace:
    | { defaultRosSectorPackId?: string | null }
    | null
    | undefined,
): RosSectorPackId | null {
  const raw = workspace?.defaultRosSectorPackId?.trim();
  if (!raw || !isValidRosSectorPackId(raw)) return null;
  return raw;
}
