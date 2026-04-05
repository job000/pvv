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
  timePerCaseValue?: number;
  timePerCaseUnit?: "minutes" | "hours";
  caseVolumeValue?: number;
  caseVolumeUnit?: "day" | "week" | "month";
  workloadInputMode?: "per_case" | "fte";
  minutesPerCase?: number;
  casesPerWeek?: number;
  casesPerMonth?: number;
  manualFteEstimate?: number;
  baselineHours: number;
  reworkHours: number;
  auditHours: number;
  avgCostPerYear: number;
  workingDays: number;
  workingHoursPerDay: number;
  employees: number;
  criticalityBusinessImpact: number;
  criticalityRegulatoryRisk: number;

  /** Krav helseforetak / virksomhet (tekst; ikke i modellscore) */
  hfOperationsSupportLevel?:
    | "unsure"
    | "l1"
    | "l2"
    | "l3"
    | "mixed";
  hfSecurityInformationNotes?: string;
  hfOrganizationalBreadthNotes?: string;
  hfEconomicRationaleNotes?: string;
  hfCriticalManualGapNotes?: string;
  hfOperationsSupportNotes?: string;

  /** Portefølje / RPA-kandidat (Likert 1–5; ikke i modellscore) */
  rpaExpectedBenefitVsEffort?: number;
  rpaQuickWinPotential?: number;
  rpaProcessSpecificity?: number;
  rpaBarrierSelfAssessment?:
    | "none"
    | "low_payback"
    | "not_rpa_suitable"
    | "integration_preferred"
    | "organizational_block"
    | "unsure";
  rpaBarrierNotes?: string;
  rpaSimilarAutomationExists?:
    | "unsure"
    | "yes_here"
    | "yes_elsewhere_or_similar"
    | "no";
  rpaImplementationDifficulty?: number;
  rpaLifecycleContact?: string;
  rpaManualFallbackWhenRobotFails?: string;
  rpaBenefitKindsAndOperationsNotes?: string;

  /** Flervalg verdisteg (arkiv) */
  valuePainPointIds?: string[];
  valueGainIds?: string[];
};
