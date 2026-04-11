import { describe, expect, test } from "vitest";
import { buildGovernanceReadinessSummary } from "./assessment-governance";
import { computeAllResults } from "../convex/lib/rpaScoring";

describe("assessment governance readiness", () => {
  test("scores readiness high when core governance inputs are present", () => {
    const summary = buildGovernanceReadinessSummary({
      payload: {
        processDescription: "Beskrivelse",
        processGoal: "Maal",
        processActors: "Saksbehandler",
        processSystems: "DIPS",
        processFlowSummary: "Flyt",
        processConstraints: "Ingen store",
        hfEconomicRationaleNotes: "Spart tid",
        rpaBenefitKindsAndOperationsNotes: "Mindre ventetid",
        rpaLifecycleContact: "Teamleder",
        rpaManualFallbackWhenRobotFails: "Fagteam tar over",
      },
      rosStatus: "completed",
      pddStatus: "completed",
      hasProcessDesignDocument: true,
    });

    expect(summary.readinessLabel).toBe("Høy");
    expect(summary.readyCount).toBe(summary.totalCount);
    expect(summary.readinessScore).toBe(100);
  });

  test("computed result separates economic, delivery and readiness scores", () => {
    const computed = computeAllResults({
      processName: "Fakturering",
      candidateId: "P-1",
      processStability: 4,
      applicationStability: 4,
      structuredInput: 4,
      processVariability: 4,
      digitization: 4,
      processLength: 2,
      applicationCount: 2,
      ocrRequired: false,
      thinClientPercent: 10,
      baselineHours: 1600,
      reworkHours: 120,
      auditHours: 40,
      avgCostPerYear: 900000,
      workingDays: 230,
      workingHoursPerDay: 7.5,
      employees: 4,
      criticalityBusinessImpact: 4,
      criticalityRegulatoryRisk: 4,
      valueContext01: 0.5,
      buildCost: 300000,
      annualRunCost: 80000,
      implementationDifficulty: 2,
      quickWinPotential: 4,
      readinessScore: 75,
    });

    expect(computed.economicCaseScore).toBeGreaterThan(0);
    expect(computed.deliveryConfidence).toBeGreaterThan(0);
    expect(computed.readinessScore).toBe(75);
    expect(computed.netBenefitAnnual).toBeGreaterThanOrEqual(0);
  });
});
