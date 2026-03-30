/**
 * RPA-kandidatvurdering inspirert av UiPath Automation Hub «Detailed Assessment».
 * @see https://docs.uipath.com/automation-hub/automation-cloud/latest/user-guide/information-about-the-detailed-assessment-algorithm
 *
 * Excel-malen «Process Vurdering Verktøy_Prod_MedMacro.xlsm» var ikke tilgjengelig i repoet;
 * formlene her følger den offisielle beskrivelsen av utdata (Feasibility, Automation Potential %,
 * Ease of Implementation %, og årlige nytte-KPI-er).
 */

/** Skala 1–5 som brukes i skjemaet */
export type Likert5 = 1 | 2 | 3 | 4 | 5;

export function clampLikert5(n: number): Likert5 {
  const x = Math.round(n);
  if (x < 1) return 1;
  if (x > 5) return 5;
  return x as Likert5;
}

/** Mapper 1→0, 5→1 (lineært) */
export function likert5ToUnit01(s: Likert5): number {
  return (s - 1) / 4;
}

/** Lav variabilitet (1) → 1, høy (5) → 0 */
export function variabilityFavorability(s: Likert5): number {
  return (5 - s) / 4;
}

/** Kort prosess (1) → 1, lang (5) → 0 */
export function lengthFavorability(s: Likert5): number {
  return (5 - s) / 4;
}

/** Få applikasjoner (1) → 1, mange (5) → 0 */
export function appCountFavorability(s: Likert5): number {
  return (5 - s) / 4;
}

const W_AP_STRUCT = 1 / 3;
const W_AP_VAR = 1 / 3;
const W_AP_DIG = 1 / 3;

/**
 * Automation Potential (0–100 %).
 * Faktorer: struktur på inndata, prosessvariasjon, digitaliseringsgrad.
 * Antakelse: utgangspunktet er at prosessen i stor grad kan automatiseres; lavere score betyr
 * at mindre av prosessen forventes automatisert (jf. UiPath-dokumentasjon).
 */
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

/**
 * Feasibility (oppnåelig nå): basert på prosess- og applikasjonsstabilitet.
 * UiPath bruker ja/nei; vi bruker terskel: begge ≥ 3 på 1–5-skala.
 */
export function feasibilityFeasible(args: {
  processStability: Likert5;
  applicationStability: Likert5;
}): boolean {
  return args.processStability >= 3 && args.applicationStability >= 3;
}

const W_EASE = 1 / 6;

/**
 * Ease of Implementation (0–100 %) før multiplikatorer.
 * Faktorer: prosessstabilitet, applikasjonsstabilitet, struktur, variasjon, prosesslengde, antall applikasjoner.
 */
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

/** OCR reduserer «ease» (multiplikator jf. UiPath). */
export function ocrMultiplier(ocrRequired: boolean): number {
  return ocrRequired ? 0.82 : 1;
}

/**
 * Tynnklient-andel 0–100: høyere andel gir mer friksjon (lavere ease).
 * Lineær reduksjon inntil 35 % ved 100 % tynnklient.
 */
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

/** Sum timer/år for As-Is (grunnlag + omarbeid + revisjon). */
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

/**
 * Nytte timer/år = (Automation Potential %) × totale timer As-Is.
 * Jf. UiPath: «Automation Potential % multiplied by Total Time Needed…»
 */
export function estimatedBenefitHoursPerYear(args: {
  automationPotentialPercent: number;
  totalHoursPerYear: number;
}): number {
  return (
    (args.automationPotentialPercent / 100) * args.totalHoursPerYear
  );
}

/**
 * Nytte valuta/år = (Automation Potential %) × kostnad As-Is /år.
 */
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
