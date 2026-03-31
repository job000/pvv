import { clampLikert5, type AssessmentInputSnapshot } from "./rpaScoring";

export function payloadToSnapshot(
  p: Record<string, unknown>,
): AssessmentInputSnapshot {
  const n = (k: string) => Number(p[k]);
  const b = (k: string) => Boolean(p[k]);
  return {
    processName: String(p.processName ?? ""),
    candidateId: String(p.candidateId ?? ""),
    processStability: clampLikert5(n("processStability")),
    applicationStability: clampLikert5(n("applicationStability")),
    structuredInput: clampLikert5(n("structuredInput")),
    processVariability: clampLikert5(n("processVariability")),
    digitization: clampLikert5(n("digitization")),
    processLength: clampLikert5(n("processLength")),
    applicationCount: clampLikert5(n("applicationCount")),
    ocrRequired: b("ocrRequired"),
    thinClientPercent: Math.min(100, Math.max(0, n("thinClientPercent"))),
    baselineHours: n("baselineHours"),
    reworkHours: n("reworkHours"),
    auditHours: n("auditHours"),
    avgCostPerYear: n("avgCostPerYear"),
    workingDays: Math.max(1, n("workingDays")),
    workingHoursPerDay: Math.max(0.1, n("workingHoursPerDay")),
    employees: Math.max(1, n("employees")),
    criticalityBusinessImpact: clampLikert5(n("criticalityBusinessImpact")),
    criticalityRegulatoryRisk: clampLikert5(n("criticalityRegulatoryRisk")),
  };
}
