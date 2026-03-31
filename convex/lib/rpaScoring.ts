/**
 * Delt mellom Convex og Next — hold synkron med UI.
 * @see lib/rpa-assessment (fjernet — bruk denne filen)
 */

export type Likert5 = 1 | 2 | 3 | 4 | 5;

export function clampLikert5(n: number): Likert5 {
  const x = Math.round(n);
  if (x < 1) return 1;
  if (x > 5) return 5;
  return x as Likert5;
}

export function likert5ToUnit01(s: Likert5): number {
  return (s - 1) / 4;
}

export function variabilityFavorability(s: Likert5): number {
  return (5 - s) / 4;
}

export function lengthFavorability(s: Likert5): number {
  return (5 - s) / 4;
}

export function appCountFavorability(s: Likert5): number {
  return (5 - s) / 4;
}

const W_AP_STRUCT = 1 / 3;
const W_AP_VAR = 1 / 3;
const W_AP_DIG = 1 / 3;

export function automationPotentialPercent(args: {
  structuredInput: Likert5;
  processVariability: Likert5;
  digitization: Likert5;
}): number {
  const struct = likert5ToUnit01(args.structuredInput);
  const varLow = variabilityFavorability(args.processVariability);
  const dig = likert5ToUnit01(args.digitization);
  const raw =
    W_AP_STRUCT * struct + W_AP_VAR * varLow + W_AP_DIG * dig;
  return Math.round(raw * 1000) / 10;
}

export function feasibilityFeasible(args: {
  processStability: Likert5;
  applicationStability: Likert5;
}): boolean {
  return args.processStability >= 3 && args.applicationStability >= 3;
}

const W_EASE = 1 / 6;

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
  const varLow = variabilityFavorability(args.processVariability);
  const len = lengthFavorability(args.processLength);
  const apps = appCountFavorability(args.applicationCount);
  const raw =
    W_EASE * (pStab + aStab + struct + varLow + len + apps);
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
): "Enkel" | "Middels" | "Vanskelig" {
  if (percent >= 65) return "Enkel";
  if (percent >= 35) return "Middels";
  return "Vanskelig";
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

export function criticalityPercent(args: {
  businessImpact: Likert5;
  regulatoryRisk: Likert5;
  manualHoursPerYear: number;
}): number {
  const bi = likert5ToUnit01(args.businessImpact);
  const rr = likert5ToUnit01(args.regulatoryRisk);
  const cap = 2500;
  const h = Math.min(Math.max(args.manualHoursPerYear / cap, 0), 1);
  const raw = 0.42 * h + 0.33 * bi + 0.25 * rr;
  return Math.round(raw * 1000) / 10;
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
  const ap = automationPotentialPercent({
    structuredInput: input.structuredInput,
    processVariability: input.processVariability,
    digitization: input.digitization,
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
  const priorityScore = Math.round(((ap + criticality) / 2) * 10) / 10;
  return {
    ap,
    feasible,
    easeBase,
    ease,
    easeLabel: easeDifficultyLabel(ease),
    criticality,
    hoursY,
    fte,
    costY,
    benH,
    benC,
    benFte,
    benHPerEmp,
    benCPerEmp,
    benFtePerEmp,
    priorityScore,
  };
}
