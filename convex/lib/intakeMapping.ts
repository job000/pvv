import type {
  IntakeAnswer,
  IntakeGeneratedAssessment,
  IntakeMappingTarget,
  IntakeRosSuggestion,
} from "../schema";
import type { AssessmentPayload } from "../schema";
import { defaultAssessmentPayload } from "./assessmentCreation";

type IntakeQuestionDoc = {
  _id: string;
  label: string;
  questionType: "text" | "number" | "multiple_choice" | "scale" | "yes_no";
  mappingTargets: IntakeMappingTarget[];
};

type WorkloadNumberField =
  | "timePerCaseValue"
  | "caseVolumeValue"
  | "manualFteEstimate"
  | "workingDays"
  | "workingHoursPerDay";

type WorkloadChoiceField = "timePerCaseUnit" | "caseVolumeUnit";

type MappingResult = {
  generatedAssessment: IntakeGeneratedAssessment;
  rosSuggestion: IntakeRosSuggestion;
  generatedPvvFlags: string[];
  riskSignals: string[];
  personDataSignal: boolean;
};

function clampLikert(value: number): number {
  return Math.max(1, Math.min(5, Math.round(value)));
}

function normalizedText(answer: IntakeAnswer): string {
  switch (answer.kind) {
    case "text":
      return answer.value.trim();
    case "number":
      return String(answer.value);
    case "multiple_choice":
      return answer.label.trim();
    case "scale":
      return String(answer.value);
    case "yes_no":
      return answer.value ? "Ja" : "Nei";
  }
}

function normalizedScale(answer: IntakeAnswer): number | null {
  switch (answer.kind) {
    case "scale":
      return clampLikert(answer.value);
    case "number":
      return clampLikert(answer.value);
    case "yes_no":
      return answer.value ? 4 : 1;
    case "multiple_choice": {
      const lower = answer.label.toLowerCase();
      if (lower.includes("høy") || lower.includes("stor")) return 5;
      if (lower.includes("middels")) return 3;
      if (lower.includes("lav") || lower.includes("liten")) return 2;
      return null;
    }
    case "text": {
      const maybe = Number(answer.value);
      return Number.isFinite(maybe) ? clampLikert(maybe) : null;
    }
  }
}

function normalizedNumber(answer: IntakeAnswer): number | null {
  switch (answer.kind) {
    case "number":
      return Number.isFinite(answer.value) ? answer.value : null;
    case "scale":
      return Number.isFinite(answer.value) ? answer.value : null;
    case "text": {
      const maybe = Number(answer.value.replace(",", ".").trim());
      return Number.isFinite(maybe) ? maybe : null;
    }
    default:
      return null;
  }
}

function normalizedChoice(answer: IntakeAnswer): string | null {
  if (answer.kind === "multiple_choice") {
    return answer.optionId;
  }
  const text = normalizedText(answer).trim().toLowerCase();
  return text || null;
}

function normalizeFrequency(answer: IntakeAnswer): number {
  if (answer.kind === "scale") {
    return clampLikert(answer.value);
  }
  if (answer.kind === "yes_no") {
    return answer.value ? 4 : 1;
  }
  const lower = normalizedText(answer).toLowerCase();
  if (
    lower.includes("daglig") ||
    lower.includes("hver dag") ||
    lower.includes("daily")
  ) {
    return 5;
  }
  if (
    lower.includes("ukentlig") ||
    lower.includes("hver uke") ||
    lower.includes("weekly")
  ) {
    return 4;
  }
  if (
    lower.includes("måned") ||
    lower.includes("monthly") ||
    lower.includes("hver måned")
  ) {
    return 3;
  }
  if (lower.includes("sjelden") || lower.includes("rarely")) {
    return 2;
  }
  return 3;
}

function appendText(
  payload: AssessmentPayload,
  field: keyof AssessmentPayload,
  value: string,
): AssessmentPayload {
  const trimmed = value.trim();
  if (!trimmed) {
    return payload;
  }
  const current = payload[field];
  if (typeof current === "string" && current.trim()) {
    return {
      ...payload,
      [field]: `${current.trim()}\n\n${trimmed}`,
    };
  }
  return {
    ...payload,
    [field]: trimmed,
  };
}

function applyFrequencyPreset(
  payload: AssessmentPayload,
  level: number,
): AssessmentPayload {
  if (level >= 5) {
    return {
      ...payload,
      baselineHours: 2200,
      reworkHours: 120,
      auditHours: 80,
      structuredInput: 5,
      processVariability: 1,
      digitization: 5,
      processLength: 4,
    };
  }
  if (level === 4) {
    return {
      ...payload,
      baselineHours: 1400,
      reworkHours: 80,
      auditHours: 60,
      structuredInput: 4,
      processVariability: 2,
      digitization: 4,
    };
  }
  if (level === 3) {
    return {
      ...payload,
      baselineHours: 800,
      reworkHours: 50,
      auditHours: 40,
      structuredInput: 3,
      processVariability: 3,
      digitization: 3,
    };
  }
  if (level === 2) {
    return {
      ...payload,
      baselineHours: 300,
      reworkHours: 20,
      auditHours: 20,
      structuredInput: 3,
      processVariability: 4,
      digitization: 3,
    };
  }
  return {
    ...payload,
    baselineHours: 120,
    reworkHours: 10,
    auditHours: 10,
    structuredInput: 2,
    processVariability: 5,
    digitization: 2,
  };
}

function buildRiskTitle(questionLabel: string): string {
  return questionLabel.trim() || "Identifisert risiko";
}

function annualCasesFromPayload(payload: AssessmentPayload): number | null {
  const caseVolumeValue =
    payload.caseVolumeValue ??
    payload.casesPerWeek ??
    payload.casesPerMonth ??
    undefined;
  if (!(typeof caseVolumeValue === "number" && caseVolumeValue > 0)) {
    return null;
  }
  const caseVolumeUnit =
    payload.caseVolumeUnit ??
    (payload.casesPerMonth !== undefined ? "month" : "week");
  switch (caseVolumeUnit) {
    case "day":
      return caseVolumeValue * 5 * 52;
    case "month":
      return caseVolumeValue * 12;
    case "week":
    default:
      return caseVolumeValue * 52;
  }
}

function derivedBaselineHoursFromPayload(payload: AssessmentPayload): number | null {
  const annualCases = annualCasesFromPayload(payload);
  const timePerCaseValue = payload.timePerCaseValue ?? payload.minutesPerCase ?? undefined;
  if (
    typeof timePerCaseValue === "number" &&
    timePerCaseValue > 0 &&
    annualCases !== null
  ) {
    const hoursPerCase =
      (payload.timePerCaseUnit ?? "minutes") === "hours"
        ? timePerCaseValue
        : timePerCaseValue / 60;
    return Math.round(hoursPerCase * annualCases * 10) / 10;
  }
  if (
    typeof payload.manualFteEstimate === "number" &&
    payload.manualFteEstimate > 0 &&
    payload.workingDays > 0 &&
    payload.workingHoursPerDay > 0
  ) {
    return Math.round(
      payload.manualFteEstimate * payload.workingDays * payload.workingHoursPerDay * 10,
    ) / 10;
  }
  return null;
}

function syncWorkloadDerivedFields(payload: AssessmentPayload): AssessmentPayload {
  const derivedBaselineHours = derivedBaselineHoursFromPayload(payload);
  if (derivedBaselineHours === null) {
    return payload;
  }
  return {
    ...payload,
    baselineHours: derivedBaselineHours,
  };
}

function applyAssessmentNumber(
  payload: AssessmentPayload,
  field: WorkloadNumberField,
  value: number,
): AssessmentPayload {
  let nextPayload: AssessmentPayload = {
    ...payload,
    [field]: value,
  };
  if (field === "timePerCaseValue" || field === "caseVolumeValue") {
    nextPayload = {
      ...nextPayload,
      workloadInputMode: "per_case",
    };
  }
  if (field === "manualFteEstimate") {
    nextPayload = {
      ...nextPayload,
      workloadInputMode: "fte",
    };
  }
  return syncWorkloadDerivedFields(nextPayload);
}

function applyAssessmentChoice(
  payload: AssessmentPayload,
  field: WorkloadChoiceField,
  value: string,
): AssessmentPayload {
  if (field === "timePerCaseUnit" && (value === "minutes" || value === "hours")) {
    return syncWorkloadDerivedFields({
      ...payload,
      timePerCaseUnit: value,
      workloadInputMode: "per_case",
    });
  }
  if (field === "caseVolumeUnit" && (value === "day" || value === "week" || value === "month")) {
    return syncWorkloadDerivedFields({
      ...payload,
      caseVolumeUnit: value,
      workloadInputMode: "per_case",
    });
  }
  return payload;
}

export function generateIntakeSuggestion(
  questions: IntakeQuestionDoc[],
  answers: IntakeAnswer[],
): MappingResult {
  const questionMap = new Map<string, IntakeQuestionDoc>();
  for (const question of questions) {
    questionMap.set(question._id, question);
  }

  let payload = defaultAssessmentPayload();
  const autoFilledFields = new Set<string>();
  const riskSignals = new Set<string>();
  const generatedPvvFlags = new Set<string>();
  const risks: IntakeRosSuggestion["risks"] = [];
  let personDataSignal = false;

  for (const answer of answers) {
    const question = questionMap.get(answer.questionId);
    if (!question) {
      continue;
    }
    for (const target of question.mappingTargets) {
      if (target.kind === "assessmentText") {
        payload = appendText(payload, target.field, normalizedText(answer));
        autoFilledFields.add(target.field);
        continue;
      }
      if (target.kind === "assessmentScale") {
        const scale = normalizedScale(answer);
        if (scale !== null) {
          payload = {
            ...payload,
            [target.field]: scale,
          };
          autoFilledFields.add(target.field);
        }
        continue;
      }
      if (target.kind === "assessmentNumber") {
        const numericValue = normalizedNumber(answer);
        if (numericValue !== null) {
          payload = applyAssessmentNumber(payload, target.field, numericValue);
          autoFilledFields.add(target.field);
          if (target.field === "timePerCaseValue" || target.field === "caseVolumeValue") {
            autoFilledFields.add("workloadInputMode");
          }
          if (target.field === "manualFteEstimate") {
            autoFilledFields.add("workloadInputMode");
          }
          if (derivedBaselineHoursFromPayload(payload) !== null) {
            autoFilledFields.add("baselineHours");
          }
        }
        continue;
      }
      if (target.kind === "assessmentChoice") {
        const choiceValue = normalizedChoice(answer);
        if (choiceValue) {
          payload = applyAssessmentChoice(payload, target.field, choiceValue);
          autoFilledFields.add(target.field);
          autoFilledFields.add("workloadInputMode");
          if (derivedBaselineHoursFromPayload(payload) !== null) {
            autoFilledFields.add("baselineHours");
          }
        }
        continue;
      }
      if (target.kind === "derivedFrequency") {
        const level = normalizeFrequency(answer);
        payload = applyFrequencyPreset(payload, level);
        payload = appendText(
          payload,
          "processVolumeNotes",
          `Oppgitt frekvens: ${normalizedText(answer)}`,
        );
        autoFilledFields.add("baselineHours");
        autoFilledFields.add("reworkHours");
        autoFilledFields.add("auditHours");
        autoFilledFields.add("structuredInput");
        autoFilledFields.add("processVariability");
        autoFilledFields.add("digitization");
        autoFilledFields.add("processVolumeNotes");
        continue;
      }
      if (target.kind === "rosConsequence") {
        const text = normalizedText(answer);
        if (text) {
          risks.push({
            id: crypto.randomUUID(),
            title: buildRiskTitle(question.label),
            description: text,
            severity: 4,
          });
          riskSignals.add("consequence_reported");
        }
        continue;
      }
      if (target.kind === "rosRiskDescription") {
        const text = normalizedText(answer);
        if (text) {
          risks.push({
            id: crypto.randomUUID(),
            title: buildRiskTitle(question.label),
            description: text,
            severity: 3,
          });
          riskSignals.add("risk_described");
        }
        continue;
      }
      if (target.kind === "pvvPersonalData") {
        const yes =
          answer.kind === "yes_no"
            ? answer.value
            : normalizedText(answer).toLowerCase().includes("ja");
        if (yes) {
          personDataSignal = true;
          generatedPvvFlags.add("personopplysninger");
          riskSignals.add("personal_data");
          payload = appendText(
            payload,
            "hfSecurityInformationNotes",
            "Svar indikerer at prosessen bruker personopplysninger.",
          );
          autoFilledFields.add("hfSecurityInformationNotes");
        }
      }
    }
  }

  const titleBase =
    payload.processName?.trim() || payload.processDescription?.trim() || "Innsendt forslag";
  const summary =
    risks.length > 0
      ? `Skjemaet ga ${risks.length} foreslåtte risikoer som bør vurderes i ROS.`
      : personDataSignal
        ? "Skjemaet peker på persondata og bør vurderes videre for personvern og ROS."
        : "Ingen tydelige risikoer ble identifisert automatisk.";

  return {
    generatedAssessment: {
      title: titleBase.slice(0, 180),
      payload,
      autoFilledFields: [...autoFilledFields],
    },
    rosSuggestion: {
      shouldCreateRos: risks.length > 0 || personDataSignal,
      summary,
      risks,
    },
    generatedPvvFlags: [...generatedPvvFlags],
    riskSignals: [...riskSignals],
    personDataSignal,
  };
}
