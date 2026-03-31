/**
 * Kuraterte rammer og krav-pekere for ROS (metadata — ikke juridisk uttømmende).
 * ID-er brukes som tags på analyser; tekst og URL kan vises i UI og PDF.
 */

export type RosComplianceScopeTagId =
  | "iso31000"
  | "iso27005"
  | "gdpr"
  | "pdp_norway"
  | "nis2_profile"
  | "sector_health"
  | "sector_public";

export type RosComplianceScopeTag = {
  id: RosComplianceScopeTagId;
  label: string;
  description: string;
};

export const ROS_COMPLIANCE_SCOPE_TAGS: readonly RosComplianceScopeTag[] = [
  {
    id: "iso31000",
    label: "ISO 31000 (risikostyring)",
    description: "Overordnet risikostyringsprosess — kontekst, vurdering, behandling.",
  },
  {
    id: "iso27005",
    label: "ISO/IEC 27005 (IKT-risiko)",
    description: "Informasjonssikkerhetsrisiko — ofte sammen med ISO/IEC 27001.",
  },
  {
    id: "gdpr",
    label: "GDPR / personvern",
    description: "Personopplysninger — vurder behandlingsgrunnlag, DPIA der påkrevd.",
  },
  {
    id: "pdp_norway",
    label: "Personopplysningsloven",
    description: "Nasjonale utfyllinger og praksis i Norge.",
  },
  {
    id: "nis2_profile",
    label: "NIS2 (profil)",
    description: "Valgfri merking: virksomhet omfattet av krav til cybersikkerhet og risikostyring.",
  },
  {
    id: "sector_health",
    label: "Helse / sensitivt",
    description: "Sektorielle krav kan gjelde — dokumenter interne retningslinjer.",
  },
  {
    id: "sector_public",
    label: "Offentlig forvaltning",
    description: "Sektorielle krav og sikkerhetsloven kan være relevant — vurder selv.",
  },
] as const;

export type RosRequirementSource =
  | "gdpr"
  | "nis2"
  | "iso31000"
  | "iso27005"
  | "norwegian_law"
  | "internal";

export type RosRequirementRef = {
  source: RosRequirementSource;
  article?: string;
  note?: string;
  documentationUrl?: string;
};
