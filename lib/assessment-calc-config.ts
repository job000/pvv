/**
 * Kalkulasjonsforutsetninger for vurderinger:
 * manuell tid × timepris → årsverkskost → besparelse (AP% × kostnad).
 * Egne ansatte vs. eksterne/innleid kan ha ulike timepriser.
 *
 * Sektor-forslag er grove startpunkter for Norge — ikke offisielle satser.
 * Justér etter egen lønnspolitikk / konsultentavtaler.
 */

export type LaborCostBasis = "own_staff" | "external";

export const CALC_SECTOR_PRESET_IDS = [
  "municipal",
  "hospital",
  "private",
  "general",
] as const;

export type CalcSectorPresetId = (typeof CALC_SECTOR_PRESET_IDS)[number];

export type CalcSectorPreset = {
  id: CalcSectorPresetId;
  label: string;
  /** Kort: hvor dette typisk brukes */
  blurb: string;
  /** Hva som ofte er viktig utover rene timer×kr */
  savingsFocus: string[];
  values: {
    workingDays: number;
    workingHoursPerDay: number;
    hourlyRateOwnStaff: number;
    hourlyRateExternal: number;
    laborCostBasis: LaborCostBasis;
    buildCost: number;
    annualRunCost: number;
  };
};

/**
 * Utgangspunkt for norske virksomheter (fullkost / innleid).
 * Kommune & sykehus = offentlig; privat = mer ROI-fokus.
 */
export const CALC_SECTOR_PRESETS: readonly CalcSectorPreset[] = [
  {
    id: "municipal",
    label: "Kommune",
    blurb:
      "Offentlig — saksbehandling, arkiv, økonomi og tjenester. Ofte egne ansatte; myke gevinster veier tungt.",
    savingsFocus: [
      "Frigjort tid til innbyggertjenester (ikke bare «færre årsverk»)",
      "Færre feil og mindre omarbeid i saksflyt",
      "At lovpålagte oppgaver faktisk blir gjort i tide",
      "Etterlevelse og sporbarhet (arkiv, innsyn, personvern)",
    ],
    values: {
      workingDays: 230,
      workingHoursPerDay: 7.5,
      /** ~850k fullkost / årsverk */
      hourlyRateOwnStaff: 493,
      hourlyRateExternal: 950,
      laborCostBasis: "own_staff",
      buildCost: 280_000,
      annualRunCost: 60_000,
    },
  },
  {
    id: "hospital",
    label: "Sykehus / HF",
    blurb:
      "Offentlig helse — administrasjon, laboratorie, pasientflyt. Pasientsikkerhet og dokumentasjon teller ofte mer enn payback alene.",
    savingsFocus: [
      "Kapasitet til pasientnært arbeid (frigjort klinisk/admin-tid)",
      "Færre manuelle feil i journal, rekvisisjon og overføringer",
      "At kritiske oppgaver ikke blir liggende / glemt",
      "Informasjonssikkerhet og personvern i behandlingskjeden",
      "Redusert ventetid mellom systemer og enheter",
    ],
    values: {
      workingDays: 230,
      workingHoursPerDay: 7.5,
      /** ~1,0 mill. fullkost — typisk blandet admin/helsefaglig støtte */
      hourlyRateOwnStaff: 580,
      hourlyRateExternal: 1_100,
      laborCostBasis: "own_staff",
      buildCost: 400_000,
      annualRunCost: 90_000,
    },
  },
  {
    id: "private",
    label: "Privat sektor",
    blurb:
      "Høyere loaded cost og sterkere fokus på tilbakebetaling — men kvalitet og risiko kan fortsatt være avgjørende.",
    savingsFocus: [
      "Direkte kostnadsbesparelse (timer × timepris)",
      "Kapasitet til vekst uten å ansette",
      "Kortere gjennomløpstid og færre flaskehalser",
      "Lavere feilkostnad mot kunder og compliance",
    ],
    values: {
      workingDays: 230,
      workingHoursPerDay: 7.5,
      /** ~1,12 mill. fullkost */
      hourlyRateOwnStaff: 650,
      hourlyRateExternal: 1_250,
      laborCostBasis: "own_staff",
      buildCost: 450_000,
      annualRunCost: 100_000,
    },
  },
  {
    id: "general",
    label: "Generelt",
    blurb:
      "Nøytralt utgangspunkt når virksomheten ikke passer kommune, HF eller typisk privat.",
    savingsFocus: [
      "Tid × timepris som hovedtall",
      "Myke gevinster som eget beslutningssignal",
    ],
    values: {
      workingDays: 230,
      workingHoursPerDay: 7.5,
      hourlyRateOwnStaff: 493,
      hourlyRateExternal: 950,
      laborCostBasis: "own_staff",
      buildCost: 350_000,
      annualRunCost: 75_000,
    },
  },
] as const;

export function getCalcSectorPreset(
  id: string | null | undefined,
): CalcSectorPreset | null {
  if (!id) return null;
  return CALC_SECTOR_PRESETS.find((p) => p.id === id) ?? null;
}

export function isCalcSectorPresetId(id: string): id is CalcSectorPresetId {
  return (CALC_SECTOR_PRESET_IDS as readonly string[]).includes(id);
}

export const CALC_DEFAULTS = {
  workingDays: 230,
  workingHoursPerDay: 7.5,
  /** ~850 000 kr / (230 × 7,5) — typisk fullkost egne ansatte (kommune/generelt) */
  hourlyRateOwnStaff: 493,
  /** Innleid / konsulent — høyere timepris */
  hourlyRateExternal: 950,
  laborCostBasis: "own_staff" as LaborCostBasis,
  buildCost: 350_000,
  annualRunCost: 75_000,
  avgCostPerYearOwn: 850_000,
} as const;

export type WorkspaceCalcDefaults = {
  workingDays: number;
  workingHoursPerDay: number;
  hourlyRateOwnStaff: number;
  hourlyRateExternal: number;
  laborCostBasis: LaborCostBasis;
  buildCost: number;
  annualRunCost: number;
};

export type WorkspaceCalcSource = {
  calcSectorPresetId?: CalcSectorPresetId | string | null;
  calcWorkingDays?: number | null;
  calcWorkingHoursPerDay?: number | null;
  calcHourlyRateOwnStaff?: number | null;
  calcHourlyRateExternal?: number | null;
  calcDefaultLaborCostBasis?: LaborCostBasis | null;
  calcDefaultBuildCost?: number | null;
  calcDefaultAnnualRunCost?: number | null;
};

export function annualCostFromHourlyRate(
  hourlyRate: number,
  workingDays: number,
  workingHoursPerDay: number,
): number {
  const h = Math.max(0, hourlyRate);
  const d = Math.max(1, workingDays);
  const th = Math.max(0.1, workingHoursPerDay);
  return Math.round(h * d * th);
}

export function hourlyRateFromAnnualCost(
  avgCostPerYear: number,
  workingDays: number,
  workingHoursPerDay: number,
): number {
  const denom = Math.max(1, workingDays) * Math.max(0.1, workingHoursPerDay);
  if (denom <= 0) return 0;
  return Math.round((Math.max(0, avgCostPerYear) / denom) * 10) / 10;
}

export function resolveWorkspaceCalcDefaults(
  ws: WorkspaceCalcSource | null | undefined,
): WorkspaceCalcDefaults {
  const workingDays =
    typeof ws?.calcWorkingDays === "number" && ws.calcWorkingDays > 0
      ? Math.min(366, Math.round(ws.calcWorkingDays))
      : CALC_DEFAULTS.workingDays;
  const workingHoursPerDay =
    typeof ws?.calcWorkingHoursPerDay === "number" &&
    ws.calcWorkingHoursPerDay > 0
      ? Math.min(24, ws.calcWorkingHoursPerDay)
      : CALC_DEFAULTS.workingHoursPerDay;
  const hourlyRateOwnStaff =
    typeof ws?.calcHourlyRateOwnStaff === "number" &&
    ws.calcHourlyRateOwnStaff > 0
      ? ws.calcHourlyRateOwnStaff
      : CALC_DEFAULTS.hourlyRateOwnStaff;
  const hourlyRateExternal =
    typeof ws?.calcHourlyRateExternal === "number" &&
    ws.calcHourlyRateExternal > 0
      ? ws.calcHourlyRateExternal
      : CALC_DEFAULTS.hourlyRateExternal;
  const laborCostBasis =
    ws?.calcDefaultLaborCostBasis === "external"
      ? "external"
      : CALC_DEFAULTS.laborCostBasis;
  const buildCost =
    typeof ws?.calcDefaultBuildCost === "number" && ws.calcDefaultBuildCost >= 0
      ? ws.calcDefaultBuildCost
      : CALC_DEFAULTS.buildCost;
  const annualRunCost =
    typeof ws?.calcDefaultAnnualRunCost === "number" &&
    ws.calcDefaultAnnualRunCost >= 0
      ? ws.calcDefaultAnnualRunCost
      : CALC_DEFAULTS.annualRunCost;

  return {
    workingDays,
    workingHoursPerDay,
    hourlyRateOwnStaff,
    hourlyRateExternal,
    laborCostBasis,
    buildCost,
    annualRunCost,
  };
}

export function hourlyRateForBasis(
  defaults: WorkspaceCalcDefaults,
  basis: LaborCostBasis,
): number {
  return basis === "external"
    ? defaults.hourlyRateExternal
    : defaults.hourlyRateOwnStaff;
}

/** Felt som settes på ny vurdering fra arbeidsområdets kalkulasjonsstandard. */
export function assessmentCalcFieldsFromWorkspace(
  ws: WorkspaceCalcSource | null | undefined,
): {
  laborCostBasis: LaborCostBasis;
  hourlyLaborRate: number;
  avgCostPerYear: number;
  workingDays: number;
  workingHoursPerDay: number;
  implementationBuildCost: number;
  annualRunCost: number;
} {
  const d = resolveWorkspaceCalcDefaults(ws);
  const hourlyLaborRate = hourlyRateForBasis(d, d.laborCostBasis);
  return {
    laborCostBasis: d.laborCostBasis,
    hourlyLaborRate,
    avgCostPerYear: annualCostFromHourlyRate(
      hourlyLaborRate,
      d.workingDays,
      d.workingHoursPerDay,
    ),
    workingDays: d.workingDays,
    workingHoursPerDay: d.workingHoursPerDay,
    implementationBuildCost: d.buildCost,
    annualRunCost: d.annualRunCost,
  };
}

export function laborCostBasisLabel(basis: LaborCostBasis): string {
  return basis === "external" ? "Eksterne / innleid" : "Egne ansatte";
}
