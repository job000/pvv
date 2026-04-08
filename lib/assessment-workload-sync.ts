import type { AssessmentPayload } from "./assessment-types";

function roundKpiValue(value: number) {
  return Math.round(value * 10) / 10;
}

type TimePerCaseUnit = "minutes" | "hours";
type CaseVolumeUnit = "day" | "week" | "month";

function effectiveTimePerCaseValue(
  payload: AssessmentPayload,
): number | undefined {
  return payload.timePerCaseValue ?? payload.minutesPerCase ?? undefined;
}

function effectiveTimePerCaseUnit(payload: AssessmentPayload): TimePerCaseUnit {
  return payload.timePerCaseUnit ?? "minutes";
}

function effectiveCaseVolumeValue(
  payload: AssessmentPayload,
): number | undefined {
  if (payload.caseVolumeValue !== undefined) {
    return payload.caseVolumeValue;
  }
  if (payload.casesPerWeek !== undefined) {
    return payload.casesPerWeek;
  }
  if (payload.casesPerMonth !== undefined) {
    return payload.casesPerMonth;
  }
  return undefined;
}

function effectiveCaseVolumeUnit(payload: AssessmentPayload): CaseVolumeUnit {
  if (payload.caseVolumeUnit) {
    return payload.caseVolumeUnit;
  }
  if (payload.casesPerMonth !== undefined) {
    return "month";
  }
  return "week";
}

function annualCasesFromPayload(payload: AssessmentPayload): number | null {
  const caseVolumeValue = effectiveCaseVolumeValue(payload);
  if (!(typeof caseVolumeValue === "number" && caseVolumeValue > 0)) {
    return null;
  }
  switch (effectiveCaseVolumeUnit(payload)) {
    case "day":
      return caseVolumeValue * 5 * 52;
    case "month":
      return caseVolumeValue * 12;
    case "week":
    default:
      return caseVolumeValue * 52;
  }
}

/** Timer/år utledet fra tid-per-sak + volum eller årsverk (uten å endre payload). */
export function derivedBaselineHoursFromPayload(
  payload: AssessmentPayload,
): number | null {
  const annualCases = annualCasesFromPayload(payload);
  const timePerCaseValue = effectiveTimePerCaseValue(payload);
  if (
    typeof timePerCaseValue === "number" &&
    timePerCaseValue > 0 &&
    annualCases !== null
  ) {
    const hoursPerCase =
      effectiveTimePerCaseUnit(payload) === "hours"
        ? timePerCaseValue
        : timePerCaseValue / 60;
    return roundKpiValue(hoursPerCase * annualCases);
  }

  const manualFteEstimate = payload.manualFteEstimate;
  if (typeof manualFteEstimate === "number" && manualFteEstimate > 0) {
    return roundKpiValue(
      manualFteEstimate * payload.workingDays * payload.workingHoursPerDay,
    );
  }
  return null;
}

/**
 * Oppdaterer `baselineHours` fra tid-per-sak + volum eller fra årsverk-estimat,
 * slik at poengberegning (Convex + liste) samsvar med det brukeren fyller inn i veiviseren.
 */
export function syncWorkloadDerivedFields(
  payload: AssessmentPayload,
): AssessmentPayload {
  const derivedBaselineHours = derivedBaselineHoursFromPayload(payload);
  if (derivedBaselineHours === null) {
    return payload;
  }
  return {
    ...payload,
    baselineHours: derivedBaselineHours,
  };
}
