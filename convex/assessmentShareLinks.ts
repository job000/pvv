import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { payloadToSnapshot } from "./lib/payloadSnapshot";
import { computeAllResults } from "./lib/rpaScoring";
import {
  requireAssessmentEdit,
  requireAssessmentRead,
} from "./lib/access";
import {
  PIPELINE_STATUS_LABELS,
  normalizePipelineStatus,
} from "../lib/assessment-pipeline";
import {
  COMPLIANCE_STATUS_LABELS,
  type ComplianceStatusKey,
} from "../lib/helsesector-labels";

function randomToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Offentlig sammendrag — ingen innlogging. Ugyldig/utløpt → null. */
export const getPublic = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const token = args.token.trim();
    if (!token) {
      return null;
    }
    const row = await ctx.db
      .query("assessmentShareLinks")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique();
    if (!row) {
      return null;
    }
    const now = Date.now();
    if (now > row.expiresAt) {
      return null;
    }
    const assessment = await ctx.db.get(row.assessmentId);
    if (!assessment) {
      return null;
    }
    const draft = await ctx.db
      .query("assessmentDrafts")
      .withIndex("by_assessment", (q) =>
        q.eq("assessmentId", assessment._id),
      )
      .unique();
    if (!draft) {
      return null;
    }
    const payload = draft.payload as Record<string, unknown>;
    const computed = computeAllResults(payloadToSnapshot(payload));
    const workspace = await ctx.db.get(assessment.workspaceId);
    const ros = (assessment.rosStatus ?? "not_started") as ComplianceStatusKey;
    const pdd = (assessment.pddStatus ?? "not_started") as ComplianceStatusKey;
    const pipeline = normalizePipelineStatus(assessment.pipelineStatus);

    return {
      kind: "ok" as const,
      expiresAt: row.expiresAt,
      linkCreatedAt: row.createdAt,
      title: assessment.title,
      workspaceName: workspace?.name ?? null,
      processName: String(payload.processName ?? ""),
      candidateId: String(payload.candidateId ?? ""),
      processDescription:
        typeof payload.processDescription === "string"
          ? payload.processDescription
          : undefined,
      processGoal:
        typeof payload.processGoal === "string" ? payload.processGoal : undefined,
      processActors:
        typeof payload.processActors === "string"
          ? payload.processActors
          : undefined,
      processSystems:
        typeof payload.processSystems === "string"
          ? payload.processSystems
          : undefined,
      processFlowSummary:
        typeof payload.processFlowSummary === "string"
          ? payload.processFlowSummary
          : undefined,
      processVolumeNotes:
        typeof payload.processVolumeNotes === "string"
          ? payload.processVolumeNotes
          : undefined,
      processConstraints:
        typeof payload.processConstraints === "string"
          ? payload.processConstraints
          : undefined,
      processFollowUp:
        typeof payload.processFollowUp === "string"
          ? payload.processFollowUp
          : undefined,
      processScope: payload.processScope as
        | "single"
        | "multi"
        | "unsure"
        | undefined,
      pipelineLabel: PIPELINE_STATUS_LABELS[pipeline],
      rosLabel: COMPLIANCE_STATUS_LABELS[ros],
      pddLabel: COMPLIANCE_STATUS_LABELS[pdd],
      computed: {
        ap: computed.ap,
        criticality: computed.criticality,
        priorityScore: computed.priorityScore,
        feasible: computed.feasible,
        ease: computed.ease,
        easeLabel: computed.easeLabel,
        benH: computed.benH,
        benC: computed.benC,
      },
      assessmentUpdatedAt: assessment.updatedAt,
    };
  },
});

export const listByAssessment = query({
  args: { assessmentId: v.id("assessments") },
  handler: async (ctx, args) => {
    await requireAssessmentRead(ctx, args.assessmentId);
    const rows = await ctx.db
      .query("assessmentShareLinks")
      .withIndex("by_assessment", (q) =>
        q.eq("assessmentId", args.assessmentId),
      )
      .collect();
    const now = Date.now();
    return rows
      .map((r) => ({
        _id: r._id,
        token: r.token,
        expiresAt: r.expiresAt,
        createdAt: r.createdAt,
        active: r.expiresAt > now,
      }))
      .sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const create = mutation({
  args: {
    assessmentId: v.id("assessments"),
    /** 1–720 timer (30 dager) */
    expiresInHours: v.number(),
  },
  handler: async (ctx, args) => {
    const { assessment, userId } = await requireAssessmentEdit(
      ctx,
      args.assessmentId,
    );
    const hours = Math.min(720, Math.max(1, Math.floor(args.expiresInHours)));
    const now = Date.now();
    const expiresAt = now + hours * 60 * 60 * 1000;

    let token = randomToken();
    for (let i = 0; i < 5; i++) {
      const existing = await ctx.db
        .query("assessmentShareLinks")
        .withIndex("by_token", (q) => q.eq("token", token))
        .unique();
      if (!existing) break;
      token = randomToken();
    }

    await ctx.db.insert("assessmentShareLinks", {
      token,
      assessmentId: args.assessmentId,
      workspaceId: assessment.workspaceId,
      expiresAt,
      createdByUserId: userId,
      createdAt: now,
    });

    return { token, expiresAt, expiresInHours: hours };
  },
});

export const revoke = mutation({
  args: { linkId: v.id("assessmentShareLinks") },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.linkId);
    if (!row) {
      throw new Error("Lenken finnes ikke.");
    }
    await requireAssessmentEdit(ctx, row.assessmentId);
    await ctx.db.delete(args.linkId);
  },
});
