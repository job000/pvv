import {
  clampLikert5,
  type AssessmentInputSnapshot,
} from "./rpaScoring";

/** Standardverdier når felt mangler, er tomme eller er NaN (f.eks. tømt tallfelt i UI). */
const SNAPSHOT_DEFAULTS: AssessmentInputSnapshot = {
  processName: "",
  candidateId: "",
  processStability: 3,
  applicationStability: 3,
  structuredInput: 3,
  processVariability: 3,
  digitization: 3,
  processLength: 3,
  applicationCount: 3,
  ocrRequired: false,
  thinClientPercent: 30,
  baselineHours: 800,
  reworkHours: 50,
  auditHours: 40,
  avgCostPerYear: 850000,
  workingDays: 230,
  workingHoursPerDay: 7.5,
  employees: 3,
  criticalityBusinessImpact: 3,
  criticalityRegulatoryRisk: 3,
};

function readNum(
  p: Record<string, unknown>,
  key: string,
  fallback: number,
): number {
  const v = p[key];
  let n: number;
  if (typeof v === "number") {
    n = v;
  } else if (typeof v === "string" && v.trim() !== "") {
    n = Number(v);
  } else {
    return fallback;
  }
  if (!Number.isFinite(n)) {
    return fallback;
  }
  return n;
}

function readBool(p: Record<string, unknown>, key: string, fallback: boolean) {
  const v = p[key];
  if (typeof v === "boolean") {
    return v;
  }
  return fallback;
}

export function payloadToSnapshot(
  p: Record<string, unknown>,
): AssessmentInputSnapshot {
  const thin = readNum(p, "thinClientPercent", SNAPSHOT_DEFAULTS.thinClientPercent);
  const workingDays = Math.min(
    366,
    Math.max(1, Math.round(readNum(p, "workingDays", SNAPSHOT_DEFAULTS.workingDays))),
  );
  const workingHoursPerDay = Math.min(
    24,
    Math.max(0.1, readNum(p, "workingHoursPerDay", SNAPSHOT_DEFAULTS.workingHoursPerDay)),
  );
  const employees = Math.max(
    0.01,
    readNum(p, "employees", SNAPSHOT_DEFAULTS.employees),
  );

  return {
    processName: String(p.processName ?? SNAPSHOT_DEFAULTS.processName),
    candidateId: String(p.candidateId ?? SNAPSHOT_DEFAULTS.candidateId),
    processStability: clampLikert5(
      readNum(p, "processStability", SNAPSHOT_DEFAULTS.processStability),
    ),
    applicationStability: clampLikert5(
      readNum(p, "applicationStability", SNAPSHOT_DEFAULTS.applicationStability),
    ),
    structuredInput: clampLikert5(
      readNum(p, "structuredInput", SNAPSHOT_DEFAULTS.structuredInput),
    ),
    processVariability: clampLikert5(
      readNum(p, "processVariability", SNAPSHOT_DEFAULTS.processVariability),
    ),
    digitization: clampLikert5(
      readNum(p, "digitization", SNAPSHOT_DEFAULTS.digitization),
    ),
    processLength: clampLikert5(
      readNum(p, "processLength", SNAPSHOT_DEFAULTS.processLength),
    ),
    applicationCount: clampLikert5(
      readNum(p, "applicationCount", SNAPSHOT_DEFAULTS.applicationCount),
    ),
    ocrRequired: readBool(p, "ocrRequired", SNAPSHOT_DEFAULTS.ocrRequired),
    thinClientPercent: Math.min(100, Math.max(0, thin)),
    baselineHours: Math.max(0, readNum(p, "baselineHours", SNAPSHOT_DEFAULTS.baselineHours)),
    reworkHours: Math.max(0, readNum(p, "reworkHours", SNAPSHOT_DEFAULTS.reworkHours)),
    auditHours: Math.max(0, readNum(p, "auditHours", SNAPSHOT_DEFAULTS.auditHours)),
    avgCostPerYear: Math.max(
      0,
      readNum(p, "avgCostPerYear", SNAPSHOT_DEFAULTS.avgCostPerYear),
    ),
    workingDays,
    workingHoursPerDay,
    employees,
    criticalityBusinessImpact: clampLikert5(
      readNum(
        p,
        "criticalityBusinessImpact",
        SNAPSHOT_DEFAULTS.criticalityBusinessImpact,
      ),
    ),
    criticalityRegulatoryRisk: clampLikert5(
      readNum(
        p,
        "criticalityRegulatoryRisk",
        SNAPSHOT_DEFAULTS.criticalityRegulatoryRisk,
      ),
    ),
  };
}
