/** Speiler Convex assessmentPayload — brukes i klient uten å importere convex/server. */
export type AssessmentPayload = {
  processName: string;
  candidateId: string;
  /** Utdyping av prosess/kandidat — valgfritt */
  processDescription?: string;
  processGoal?: string;
  processActors?: string;
  processSystems?: string;
  processFlowSummary?: string;
  processVolumeNotes?: string;
  processConstraints?: string;
  processFollowUp?: string;
  /** Organisatorisk omfang — styrer veiledning */
  processScope?: "single" | "multi" | "unsure";
  processStability: number;
  applicationStability: number;
  structuredInput: number;
  processVariability: number;
  digitization: number;
  processLength: number;
  applicationCount: number;
  ocrRequired: boolean;
  thinClientPercent: number;
  baselineHours: number;
  reworkHours: number;
  auditHours: number;
  avgCostPerYear: number;
  workingDays: number;
  workingHoursPerDay: number;
  employees: number;
  criticalityBusinessImpact: number;
  criticalityRegulatoryRisk: number;
};
