import { v } from "convex/values";
import { query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { canReadAssessment, requireWorkspaceMember } from "./lib/access";
import { computeAllResults } from "./lib/rpaScoring";
import { payloadToSnapshot } from "./lib/payloadSnapshot";
import {
  normalizePipelineStatus,
  type PipelineStatus,
} from "../lib/assessment-pipeline";
import {
  ASSESSMENT_VALUE_GAIN_OPTIONS,
  ASSESSMENT_VALUE_PAIN_OPTIONS,
  SOFT_VALUE_GAIN_IDS,
} from "../lib/assessment-value-tags";

const HARD_VALUE_GAIN_IDS = new Set([
  "save_time",
  "lower_cost",
  "free_capacity",
]);

/** Statuser der gevinst typisk er under realisering eller realisert. */
const REALIZED_STATUSES = new Set<PipelineStatus>([
  "production",
  "monitoring",
  "done",
]);

/** Statuser der kandidaten er valgt / under leveranse (ikke bare kartlagt). */
const SELECTED_STATUSES = new Set<PipelineStatus>([
  "prioritized",
  "development",
  "uat",
  "production",
  "monitoring",
  "done",
]);

function readStringIdArray(payload: Record<string, unknown>, key: string): string[] {
  const raw = payload[key];
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string" && x.length > 0);
}

const portfolioItemValidator = v.object({
  assessmentId: v.id("assessments"),
  title: v.string(),
  pipelineStatus: v.string(),
  updatedAt: v.number(),
  hoursSavedPerYear: v.number(),
  currencySavedPerYear: v.number(),
  fteFreed: v.number(),
  netBenefitAnnual: v.number(),
  paybackMonths: v.union(v.number(), v.null()),
  buildCost: v.number(),
  annualRunCost: v.number(),
  asIsHoursPerYear: v.number(),
  asIsCostPerYear: v.number(),
  automationPotential: v.number(),
  priorityScore: v.number(),
  economicCaseScore: v.number(),
  valueGainIds: v.array(v.string()),
  valuePainPointIds: v.array(v.string()),
  softGainCount: v.number(),
  hardGainCount: v.number(),
  hasQuantifiedBenefit: v.boolean(),
  realizationBucket: v.union(
    v.literal("potential"),
    v.literal("in_delivery"),
    v.literal("realized"),
  ),
});

export const workspacePortfolio = query({
  args: { workspaceId: v.id("workspaces") },
  returns: v.union(
    v.null(),
    v.object({
      assessmentCount: v.number(),
      withDraftCount: v.number(),
      totals: v.object({
        hoursSavedPerYear: v.number(),
        currencySavedPerYear: v.number(),
        fteFreed: v.number(),
        netBenefitAnnual: v.number(),
        buildCost: v.number(),
        annualRunCost: v.number(),
        asIsHoursPerYear: v.number(),
        asIsCostPerYear: v.number(),
      }),
      realizedTotals: v.object({
        hoursSavedPerYear: v.number(),
        currencySavedPerYear: v.number(),
        fteFreed: v.number(),
        netBenefitAnnual: v.number(),
      }),
      inDeliveryTotals: v.object({
        hoursSavedPerYear: v.number(),
        currencySavedPerYear: v.number(),
        fteFreed: v.number(),
        netBenefitAnnual: v.number(),
      }),
      potentialTotals: v.object({
        hoursSavedPerYear: v.number(),
        currencySavedPerYear: v.number(),
        fteFreed: v.number(),
        netBenefitAnnual: v.number(),
      }),
      byPipeline: v.array(
        v.object({
          status: v.string(),
          count: v.number(),
          hoursSavedPerYear: v.number(),
          currencySavedPerYear: v.number(),
          fteFreed: v.number(),
          netBenefitAnnual: v.number(),
        }),
      ),
      softGainFrequency: v.array(
        v.object({
          id: v.string(),
          label: v.string(),
          count: v.number(),
          soft: v.boolean(),
        }),
      ),
      painFrequency: v.array(
        v.object({
          id: v.string(),
          label: v.string(),
          count: v.number(),
        }),
      ),
      items: v.array(portfolioItemValidator),
    }),
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    await requireWorkspaceMember(ctx, args.workspaceId, userId, "viewer");

    const rows = await ctx.db
      .query("assessments")
      .withIndex("by_workspace_updated", (q) =>
        q.eq("workspaceId", args.workspaceId),
      )
      .order("desc")
      .take(400);

    const softGainCountMap = new Map<string, number>();
    const hardGainCountMap = new Map<string, number>();
    const painCountMap = new Map<string, number>();
    for (const opt of ASSESSMENT_VALUE_GAIN_OPTIONS) {
      softGainCountMap.set(opt.id, 0);
      hardGainCountMap.set(opt.id, 0);
    }
    for (const opt of ASSESSMENT_VALUE_PAIN_OPTIONS) {
      painCountMap.set(opt.id, 0);
    }

    type Item = {
      assessmentId: (typeof rows)[0]["_id"];
      title: string;
      pipelineStatus: PipelineStatus;
      updatedAt: number;
      hoursSavedPerYear: number;
      currencySavedPerYear: number;
      fteFreed: number;
      netBenefitAnnual: number;
      paybackMonths: number | null;
      buildCost: number;
      annualRunCost: number;
      asIsHoursPerYear: number;
      asIsCostPerYear: number;
      automationPotential: number;
      priorityScore: number;
      economicCaseScore: number;
      valueGainIds: string[];
      valuePainPointIds: string[];
      softGainCount: number;
      hardGainCount: number;
      hasQuantifiedBenefit: boolean;
      realizationBucket: "potential" | "in_delivery" | "realized";
    };

    const items: Item[] = [];
    let withDraftCount = 0;

    const emptyTotals = () => ({
      hoursSavedPerYear: 0,
      currencySavedPerYear: 0,
      fteFreed: 0,
      netBenefitAnnual: 0,
      buildCost: 0,
      annualRunCost: 0,
      asIsHoursPerYear: 0,
      asIsCostPerYear: 0,
    });
    const totals = emptyTotals();
    const realizedTotals = {
      hoursSavedPerYear: 0,
      currencySavedPerYear: 0,
      fteFreed: 0,
      netBenefitAnnual: 0,
    };
    const inDeliveryTotals = { ...realizedTotals };
    const potentialTotals = { ...realizedTotals };

    const byPipelineMap = new Map<
      PipelineStatus,
      {
        count: number;
        hoursSavedPerYear: number;
        currencySavedPerYear: number;
        fteFreed: number;
        netBenefitAnnual: number;
      }
    >();

    for (const a of rows) {
      if (!(await canReadAssessment(ctx, a, userId))) continue;

      const draft = await ctx.db
        .query("assessmentDrafts")
        .withIndex("by_assessment", (q) => q.eq("assessmentId", a._id))
        .unique();

      const status = normalizePipelineStatus(a.pipelineStatus);
      let hoursSavedPerYear = 0;
      let currencySavedPerYear = 0;
      let fteFreed = 0;
      let netBenefitAnnual = 0;
      let paybackMonths: number | null = null;
      let buildCost = 0;
      let annualRunCost = 0;
      let asIsHoursPerYear = 0;
      let asIsCostPerYear = 0;
      let automationPotential = a.cachedAp ?? 0;
      let priorityScore =
        a.manualPriorityOverride ?? a.cachedPriorityScore ?? 0;
      let economicCaseScore = a.cachedEconomicCaseScore ?? 0;
      let valueGainIds: string[] = [];
      let valuePainPointIds: string[] = [];

      if (draft) {
        withDraftCount += 1;
        const payload = draft.payload as Record<string, unknown>;
        const computed = computeAllResults(payloadToSnapshot(payload));
        hoursSavedPerYear = computed.benH;
        currencySavedPerYear = computed.benC;
        fteFreed = computed.benFte;
        netBenefitAnnual = computed.netBenefitAnnual;
        paybackMonths = computed.paybackMonths;
        buildCost = computed.buildCost;
        annualRunCost = computed.annualRunCost;
        asIsHoursPerYear = computed.hoursY;
        asIsCostPerYear = computed.costY;
        automationPotential = computed.ap;
        priorityScore =
          a.manualPriorityOverride ?? computed.priorityScore;
        economicCaseScore = computed.economicCaseScore;
        valueGainIds = readStringIdArray(payload, "valueGainIds");
        valuePainPointIds = readStringIdArray(payload, "valuePainPointIds");
      }

      for (const id of valueGainIds) {
        if (SOFT_VALUE_GAIN_IDS.has(id)) {
          softGainCountMap.set(id, (softGainCountMap.get(id) ?? 0) + 1);
        } else {
          hardGainCountMap.set(id, (hardGainCountMap.get(id) ?? 0) + 1);
        }
      }
      for (const id of valuePainPointIds) {
        painCountMap.set(id, (painCountMap.get(id) ?? 0) + 1);
      }

      const softGainCount = valueGainIds.filter((id) =>
        SOFT_VALUE_GAIN_IDS.has(id),
      ).length;
      const hardGainCount = valueGainIds.filter((id) =>
        HARD_VALUE_GAIN_IDS.has(id),
      ).length;
      const hasQuantifiedBenefit =
        hoursSavedPerYear > 0 || currencySavedPerYear > 0 || fteFreed > 0;

      const realizationBucket: Item["realizationBucket"] = REALIZED_STATUSES.has(
        status,
      )
        ? "realized"
        : SELECTED_STATUSES.has(status)
          ? "in_delivery"
          : "potential";

      const bucketTotals =
        realizationBucket === "realized"
          ? realizedTotals
          : realizationBucket === "in_delivery"
            ? inDeliveryTotals
            : potentialTotals;
      bucketTotals.hoursSavedPerYear += hoursSavedPerYear;
      bucketTotals.currencySavedPerYear += currencySavedPerYear;
      bucketTotals.fteFreed += fteFreed;
      bucketTotals.netBenefitAnnual += netBenefitAnnual;

      totals.hoursSavedPerYear += hoursSavedPerYear;
      totals.currencySavedPerYear += currencySavedPerYear;
      totals.fteFreed += fteFreed;
      totals.netBenefitAnnual += netBenefitAnnual;
      totals.buildCost += buildCost;
      totals.annualRunCost += annualRunCost;
      totals.asIsHoursPerYear += asIsHoursPerYear;
      totals.asIsCostPerYear += asIsCostPerYear;

      const pipe = byPipelineMap.get(status) ?? {
        count: 0,
        hoursSavedPerYear: 0,
        currencySavedPerYear: 0,
        fteFreed: 0,
        netBenefitAnnual: 0,
      };
      pipe.count += 1;
      pipe.hoursSavedPerYear += hoursSavedPerYear;
      pipe.currencySavedPerYear += currencySavedPerYear;
      pipe.fteFreed += fteFreed;
      pipe.netBenefitAnnual += netBenefitAnnual;
      byPipelineMap.set(status, pipe);

      items.push({
        assessmentId: a._id,
        title: a.title.trim() || "Uten tittel",
        pipelineStatus: status,
        updatedAt: a.updatedAt,
        hoursSavedPerYear,
        currencySavedPerYear,
        fteFreed,
        netBenefitAnnual,
        paybackMonths,
        buildCost,
        annualRunCost,
        asIsHoursPerYear,
        asIsCostPerYear,
        automationPotential,
        priorityScore,
        economicCaseScore,
        valueGainIds,
        valuePainPointIds,
        softGainCount,
        hardGainCount,
        hasQuantifiedBenefit,
        realizationBucket,
      });
    }

    const byPipeline = (
      [
        "not_assessed",
        "assessed",
        "prioritized",
        "development",
        "uat",
        "production",
        "monitoring",
        "done",
        "on_hold",
      ] as PipelineStatus[]
    ).map((status) => {
      const row = byPipelineMap.get(status) ?? {
        count: 0,
        hoursSavedPerYear: 0,
        currencySavedPerYear: 0,
        fteFreed: 0,
        netBenefitAnnual: 0,
      };
      return { status, ...row };
    });

    const softGainFrequency = ASSESSMENT_VALUE_GAIN_OPTIONS.map((opt) => ({
      id: opt.id,
      label: opt.label,
      count:
        (softGainCountMap.get(opt.id) ?? 0) +
        (hardGainCountMap.get(opt.id) ?? 0),
      soft: SOFT_VALUE_GAIN_IDS.has(opt.id),
    })).sort((a, b) => b.count - a.count);

    const painFrequency = ASSESSMENT_VALUE_PAIN_OPTIONS.map((opt) => ({
      id: opt.id,
      label: opt.label,
      count: painCountMap.get(opt.id) ?? 0,
    })).sort((a, b) => b.count - a.count);

    return {
      assessmentCount: items.length,
      withDraftCount,
      totals,
      realizedTotals,
      inDeliveryTotals,
      potentialTotals,
      byPipeline,
      softGainFrequency,
      painFrequency,
      items,
    };
  },
});
