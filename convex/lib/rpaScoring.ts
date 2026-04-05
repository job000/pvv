/**
 * Delt mellom Convex og Next — hold synkron med UI.
 * @see lib/rpa-assessment (fjernet — bruk denne filen)
 */

export type Likert5 = 1 | 2 | 3 | 4 | 5;

export function clampLikert5(n: number): Likert5 {
  if (!Number.isFinite(n)) {
    return 3;
  }
  const x = Math.round(n);
  if (x < 1) return 1;
  if (x > 5) return 5;
  return x as Likert5;
}

export function likert5ToUnit01(s: Likert5): number {
  return (s - 1) / 4;
}

/**
 * Hvor like sakene er (1 = svært ulike, 5 = nesten like hver gang).
 * Høyere likhet → bedre RPA-kandidat — samme retning som andre Likert-felt.
 */
export function caseSimilarityFavorability(s: Likert5): number {
  return likert5ToUnit01(s);
}

export function lengthFavorability(s: Likert5): number {
  return (5 - s) / 4;
}

export function appCountFavorability(s: Likert5): number {
  return (5 - s) / 4;
}

const W_AP_STRUCT = 0.35;
const W_AP_VAR = 0.35;
const W_AP_DIG = 0.20;
const W_AP_VOL = 0.10;

/**
 * Maps annual manual hours to a 0-1 volume signal.
 * More volume = better automation candidate (more savings per build).
 * 0h → 0, ~500h → 0.5, 2000+h → ~1.0
 */
export function volumeFactor(manualHoursPerYear: number): number {
  const h = Math.max(0, manualHoursPerYear);
  return 1 - Math.exp(-h / 1200);
}

export function automationPotentialPercent(args: {
  structuredInput: Likert5;
  processVariability: Likert5;
  digitization: Likert5;
  manualHoursPerYear?: number;
}): number {
  const struct = likert5ToUnit01(args.structuredInput);
  const caseSim = caseSimilarityFavorability(args.processVariability);
  const dig = likert5ToUnit01(args.digitization);
  const vol = volumeFactor(args.manualHoursPerYear ?? 800);
  const raw =
    W_AP_STRUCT * struct + W_AP_VAR * caseSim + W_AP_DIG * dig + W_AP_VOL * vol;
  return Math.round(raw * 1000) / 10;
}

export function feasibilityFeasible(args: {
  processStability: Likert5;
  applicationStability: Likert5;
}): boolean {
  return args.processStability >= 3 && args.applicationStability >= 3;
}

/**
 * Ease-of-implementation weights (sum = 1.0).
 * Stability matters most — an unstable process/app kills the project.
 * Length and app count are secondary friction factors.
 */
const W_E_PSTAB = 0.25;
const W_E_ASTAB = 0.25;
const W_E_STRUCT = 0.15;
const W_E_VAR = 0.15;
const W_E_LEN = 0.10;
const W_E_APPS = 0.10;

export function easeOfImplementationBasePercent(args: {
  processStability: Likert5;
  applicationStability: Likert5;
  structuredInput: Likert5;
  processVariability: Likert5;
  processLength: Likert5;
  applicationCount: Likert5;
}): number {
  const pStab = likert5ToUnit01(args.processStability);
  const aStab = likert5ToUnit01(args.applicationStability);
  const struct = likert5ToUnit01(args.structuredInput);
  const caseSim = caseSimilarityFavorability(args.processVariability);
  const len = lengthFavorability(args.processLength);
  const apps = appCountFavorability(args.applicationCount);
  const raw =
    W_E_PSTAB * pStab +
    W_E_ASTAB * aStab +
    W_E_STRUCT * struct +
    W_E_VAR * caseSim +
    W_E_LEN * len +
    W_E_APPS * apps;
  return Math.round(raw * 1000) / 10;
}

export function ocrMultiplier(ocrRequired: boolean): number {
  return ocrRequired ? 0.82 : 1;
}

export function thinClientMultiplier(thinClientPercent: number): number {
  const p = Math.min(100, Math.max(0, thinClientPercent));
  return 1 - 0.35 * (p / 100);
}

export function easeOfImplementationFinalPercent(args: {
  basePercent: number;
  ocrRequired: boolean;
  thinClientPercent: number;
}): number {
  const m =
    ocrMultiplier(args.ocrRequired) *
    thinClientMultiplier(args.thinClientPercent);
  return Math.round(args.basePercent * m * 10) / 10;
}

export function easeDifficultyLabel(
  percent: number,
): "Enkel" | "Middels" | "Krevende" | "Vanskelig" {
  const p = Number.isFinite(percent) ? percent : 0;
  if (p >= 60) return "Enkel";
  if (p >= 40) return "Middels";
  if (p >= 20) return "Krevende";
  return "Vanskelig";
}

/**
 * Porteføljeprioritet 0–100: geometrisk middel av automasjonspotensial og
 * viktighet. Krever at begge er høye for topp-score (mer robust enn enkel snitt).
 */
export function portfolioPriorityScore(apPercent: number, criticalityPercent: number): number {
  const a = Math.min(100, Math.max(0, apPercent));
  const c = Math.min(100, Math.max(0, criticalityPercent));
  const g = Math.sqrt(a * c);
  return Math.round(g * 10) / 10;
}

function finiteOr(n: number, fallback: number): number {
  return Number.isFinite(n) ? n : fallback;
}

export function totalHoursPerYear(args: {
  baselineHoursPerYear: number;
  reworkHoursPerYear: number;
  auditHoursPerYear: number;
}): number {
  return (
    args.baselineHoursPerYear +
    args.reworkHoursPerYear +
    args.auditHoursPerYear
  );
}

export function fteRequired(args: {
  totalHoursPerYear: number;
  workingDaysPerYear: number;
  workingHoursPerDay: number;
}): number {
  const denom = args.workingDaysPerYear * args.workingHoursPerDay;
  if (denom <= 0) return 0;
  return args.totalHoursPerYear / denom;
}

export function costPerYearAsIs(args: {
  averageEmployeeFullCostPerYear: number;
  fteRequired: number;
}): number {
  return args.averageEmployeeFullCostPerYear * args.fteRequired;
}

export function estimatedBenefitHoursPerYear(args: {
  automationPotentialPercent: number;
  totalHoursPerYear: number;
}): number {
  return (
    (args.automationPotentialPercent / 100) * args.totalHoursPerYear
  );
}

export function estimatedBenefitCurrencyPerYear(args: {
  automationPotentialPercent: number;
  costPerYearAsIs: number;
}): number {
  return (
    (args.automationPotentialPercent / 100) * args.costPerYearAsIs
  );
}

export function estimatedBenefitFte(args: {
  automationPotentialPercent: number;
  fteRequired: number;
}): number {
  return (args.automationPotentialPercent / 100) * args.fteRequired;
}

export function perEmployee(
  companyTotal: number,
  numberOfEmployees: number,
): number {
  if (numberOfEmployees <= 0) return 0;
  return companyTotal / numberOfEmployees;
}

/** Maks antall valg per flervelgsliste i verdisteg (synk med UI). */
const MAX_VALUE_TAG_OPTIONS = 6;

/**
 * 0–1 fra antall valgte problemer/forbedringer — brukes som moderat løft i criticality
 * slik at flervalget samsvarer med tallene brukeren ser.
 */
export function valueTagContextUnit01(painCount: number, gainCount: number): number {
  const p =
    Math.min(Math.max(painCount, 0), MAX_VALUE_TAG_OPTIONS) / MAX_VALUE_TAG_OPTIONS;
  const g =
    Math.min(Math.max(gainCount, 0), MAX_VALUE_TAG_OPTIONS) / MAX_VALUE_TAG_OPTIONS;
  return (p + g) / 2;
}

export function criticalityPercent(args: {
  businessImpact: Likert5;
  regulatoryRisk: Likert5;
  manualHoursPerYear: number;
  /** 0–1 fra flervalg under verdi (problem/gevinst); maks. +8 prosentpoeng */
  valueContext01?: number;
}): number {
  const bi = likert5ToUnit01(args.businessImpact);
  const rr = likert5ToUnit01(args.regulatoryRisk);
  const cap = 2500;
  const h = Math.min(Math.max(args.manualHoursPerYear / cap, 0), 1);
  const raw = 0.42 * h + 0.33 * bi + 0.25 * rr;
  let pct = Math.round(raw * 1000) / 10;
  const ctx = args.valueContext01 ?? 0;
  if (ctx > 0) {
    const bump = ctx * 8;
    pct = Math.min(100, Math.round((pct + bump) * 10) / 10);
  }
  return pct;
}

export type AssessmentInputSnapshot = {
  processName: string;
  candidateId: string;
  processStability: Likert5;
  applicationStability: Likert5;
  structuredInput: Likert5;
  processVariability: Likert5;
  digitization: Likert5;
  processLength: Likert5;
  applicationCount: Likert5;
  ocrRequired: boolean;
  thinClientPercent: number;
  baselineHours: number;
  reworkHours: number;
  auditHours: number;
  avgCostPerYear: number;
  workingDays: number;
  workingHoursPerDay: number;
  employees: number;
  criticalityBusinessImpact: Likert5;
  criticalityRegulatoryRisk: Likert5;
  /** 0–1 fra valuePainPointIds + valueGainIds */
  valueContext01: number;
};

export type ComputedSnapshot = {
  ap: number;
  feasible: boolean;
  easeBase: number;
  ease: number;
  easeLabel: string;
  criticality: number;
  hoursY: number;
  fte: number;
  costY: number;
  benH: number;
  benC: number;
  benFte: number;
  benHPerEmp: number;
  benCPerEmp: number;
  benFtePerEmp: number;
  priorityScore: number;
};

export function computeAllResults(input: AssessmentInputSnapshot): ComputedSnapshot {
  const totalManualHours =
    input.baselineHours + input.reworkHours + input.auditHours;
  const ap = automationPotentialPercent({
    structuredInput: input.structuredInput,
    processVariability: input.processVariability,
    digitization: input.digitization,
    manualHoursPerYear: totalManualHours,
  });
  const feasible = feasibilityFeasible({
    processStability: input.processStability,
    applicationStability: input.applicationStability,
  });
  const easeBase = easeOfImplementationBasePercent({
    processStability: input.processStability,
    applicationStability: input.applicationStability,
    structuredInput: input.structuredInput,
    processVariability: input.processVariability,
    processLength: input.processLength,
    applicationCount: input.applicationCount,
  });
  const ease = easeOfImplementationFinalPercent({
    basePercent: easeBase,
    ocrRequired: input.ocrRequired,
    thinClientPercent: input.thinClientPercent,
  });
  const hoursY = totalHoursPerYear({
    baselineHoursPerYear: input.baselineHours,
    reworkHoursPerYear: input.reworkHours,
    auditHoursPerYear: input.auditHours,
  });
  const criticality = criticalityPercent({
    businessImpact: input.criticalityBusinessImpact,
    regulatoryRisk: input.criticalityRegulatoryRisk,
    manualHoursPerYear: hoursY,
    valueContext01: input.valueContext01,
  });
  const fte = fteRequired({
    totalHoursPerYear: hoursY,
    workingDaysPerYear: input.workingDays,
    workingHoursPerDay: input.workingHoursPerDay,
  });
  const costY = costPerYearAsIs({
    averageEmployeeFullCostPerYear: input.avgCostPerYear,
    fteRequired: fte,
  });
  const benH = estimatedBenefitHoursPerYear({
    automationPotentialPercent: ap,
    totalHoursPerYear: hoursY,
  });
  const benC = estimatedBenefitCurrencyPerYear({
    automationPotentialPercent: ap,
    costPerYearAsIs: costY,
  });
  const benFte = estimatedBenefitFte({
    automationPotentialPercent: ap,
    fteRequired: fte,
  });
  const benHPerEmp = perEmployee(benH, input.employees);
  const benCPerEmp = perEmployee(benC, input.employees);
  const benFtePerEmp = perEmployee(benFte, input.employees);
  const apSafe = finiteOr(ap, 0);
  const critSafe = finiteOr(criticality, 0);
  const priorityScore = portfolioPriorityScore(apSafe, critSafe);
  return {
    ap: apSafe,
    feasible,
    easeBase: finiteOr(easeBase, 0),
    ease: finiteOr(ease, 0),
    easeLabel: easeDifficultyLabel(finiteOr(ease, 0)),
    criticality: critSafe,
    hoursY: finiteOr(hoursY, 0),
    fte: finiteOr(fte, 0),
    costY: finiteOr(costY, 0),
    benH: finiteOr(benH, 0),
    benC: finiteOr(benC, 0),
    benFte: finiteOr(benFte, 0),
    benHPerEmp: finiteOr(benHPerEmp, 0),
    benCPerEmp: finiteOr(benCPerEmp, 0),
    benFtePerEmp: finiteOr(benFtePerEmp, 0),
    priorityScore,
  };
}
