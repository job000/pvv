/**
 * Felles formuleringer om ROS-metodikk, rammeverk og ansvar (EU/EØS, Norge, ISO).
 * Lenker peker til offisielle kilder (iso.org, EUR-Lex, Lovdata, myndigheter).
 * Erstatter ikke juridisk rådgivning eller attestasjon.
 */

/** Kort linje for infobanner i ROS-arbeidsområdet */
export const ROS_COMPLIANCE_UI_TAGLINE_NB =
  "PVV støtter dokumentert ROS (risiko- og sårbarhetsanalyse) med matrise og sporbarhet — i tråd med prinsippene i ISO 31000 og ISO/IEC 27005 og med krav i EU/EØS og norsk lov der disse gjelder. Dere må selv vurdere personvern (GDPR), NIS2, sektor og interne retningslinjer.";

/** Sluttdisclaimer i eksportert ROS-PDF (A4) */
export const ROS_COMPLIANCE_PDF_DISCLAIMER_NB =
  "Metodikk og ansvar: Eksporten dokumenterer innholdet i ROS-analysen i PVV. " +
  "Virksomheten skal selv sikre at metode, dokumentasjon og etterlevelse er i samsvar med gjeldende EU/EØS- og norsk regelverk, " +
  "relevante ISO- og sektorstandarder (f.eks. via Standard Norge / NS-ISO), og interne krav. " +
  "Eksporten er ikke juridisk rådgivning, sertifisering eller attestasjon.";

export type RosComplianceFramework = {
  id: string;
  title: string;
  description: string;
  /** Primær offisiell dokumentasjon (standard, direktiv, lovtekst) */
  documentationUrl?: string;
  documentationLabel?: string;
};

/** Rammeverk med lenker til offisiell dokumentasjon */
export const ROS_COMPLIANCE_FRAMEWORKS_NB: readonly RosComplianceFramework[] = [
  {
    id: "iso31000",
    title: "ISO 31000",
    description:
      "Internasjonal standard for risikostyring — prinsipper og prosess (ikke én fast «teller»). PVV støtter samme type strukturert vurdering og dokumentasjon.",
    documentationUrl: "https://www.iso.org/standard/65694.html",
    documentationLabel: "ISO 31000:2018 på iso.org",
  },
  {
    id: "iso27005",
    title: "ISO/IEC 27005",
    description:
      "Veiledning for informasjonssikkerhetsrisiko; ofte brukt sammen med ISO/IEC 27001. Matrisen og logg i PVV er forenlig med kvalitativ risikovurdering etter slik praksis.",
    documentationUrl: "https://www.iso.org/standard/80585.html",
    documentationLabel: "ISO/IEC 27005 på iso.org",
  },
  {
    id: "gdpr",
    title: "Personvern (GDPR og norsk lov)",
    description:
      "EU-personvernforordningen og personopplysningsloven krever blant annet hensiktsmessige tiltak. Ved høy risiko for personers rettigheter kan DPIA (konsekvensvurdering) være nødvendig — et eget spor ved siden av generell ROS.",
    documentationUrl:
      "https://eur-lex.europa.eu/legal-content/NO/TXT/?uri=CELEX%3A32016R0679",
    documentationLabel: "GDPR i EUR-Lex (norsk språk)",
  },
  {
    id: "nis2",
    title: "NIS2",
    description:
      "Direktiv om tiltak for høy felles cybersikkerhet; gjelder mange virksomheter med kritiske eller viktige tjenester i EU/EØS og stiller krav til risikostyring og sikkerhet for nett- og informasjonssystemer.",
    documentationUrl:
      "https://eur-lex.europa.eu/legal-content/NO/TXT/?uri=CELEX%3A32022L2555",
    documentationLabel: "NIS2 i EUR-Lex (norsk språk)",
  },
  {
    id: "no-sector",
    title: "Norge og sektor",
    description:
      "Norske utgaver av standarder (NS-ISO), veiledning fra Datatilsynet og NSM, og sektorregler (f.eks. helse, offentlig forvaltning) — avhengig av behandling og virksomhet.",
    documentationUrl: "https://www.standard.no",
    documentationLabel: "Standard Norge",
  },
] as const;

/** Første avsnitt: metode og EU/EØS–forankring */
export const ROS_COMPLIANCE_METHODOLOGY_INTRO_NB =
  "Det finnes flere anerkjente måter å vurdere risiko og sårbarhet på — blant annet kvalitativ matrise (som i PVV), semi-kvantitative skalaer, kvantitative modeller og scenario- eller hendelsesbaserte analyser. " +
  "I EU/EØS og Norge forventes det ofte at slikt arbeid er forankret i gjeldende lov, anerkjente standarder og god praksis. " +
  "Valg av metode må tilpasses virksomhet, sektor og tilsyn; dere må fastsette og dokumentere egen metodikk.";

/** Avsnitt før rammeverk-listen */
export const ROS_COMPLIANCE_METHODOLOGY_BRIDGE_NB =
  "EU, EØS og Norge: PVV er utformet slik at dokumentert ROS med matrise, sporbarhet, versjon og kobling til PVV følger samme overordnede struktur som anbefales i risikostyring etter ISO 31000 og i informasjonssikkerhetsrisiko etter ISO/IEC 27005, og at dere kan dokumentere etterlevelse i tråd med personvern (GDPR / norsk lov), NIS2 der direktivet omfatter dere, og nasjonale og sektorielle krav. " +
  "Nedenfor er konkrete rammeverk med lenker til offisiell dokumentasjon på nett.";

/** Avsnitt om hva PVV er (og ikke) */
export const ROS_COMPLIANCE_PVV_PARAGRAPH_NB =
  "Hva betyr det for PVV? Løsningen gir et strukturert verktøy for ROS med matrise, sporbarhet, versjon og kobling til PVV — i tråd med vanlig praksis for kvalitativ og semi-kvalitativ risikovurdering. " +
  "PVV erstatter ikke juridisk bistand, ekstern revisjon eller krav som gjelder akkurat deres virksomhet; dere må selv sikre at metode, dokumentasjon og beslutninger møter deres forpliktelser og godkjente interne retningslinjer.";

/** Nasjonale og praktiske innganger (myndigheter, standardisering) */
export const ROS_COMPLIANCE_EXTERNAL_LINKS_NB = [
  { label: "Standard Norge", href: "https://www.standard.no" },
  { label: "Datatilsynet", href: "https://www.datatilsynet.no" },
  { label: "NSM", href: "https://www.nsm.no" },
] as const;

/** Tilleggslenker: lov, veiledning og EU-kompetanse (alle offisielle domener) */
export const ROS_COMPLIANCE_OFFICIAL_RESOURCES_NB = [
  {
    label: "Personopplysningsloven — Lovdata",
    href: "https://lovdata.no/dokument/NL/lov/2018-06-15-38",
  },
  {
    label: "Konsekvensvurdering (DPIA) — Datatilsynet",
    href: "https://www.datatilsynet.no/rettigheter-og-plikter/virksomhetenes-plikter/konsekvensvurdering/",
  },
  {
    label: "Risikostyring — ENISA (EU byrå for cybersikkerhet)",
    href: "https://www.enisa.europa.eu/topics/risk-management",
  },
] as const;
