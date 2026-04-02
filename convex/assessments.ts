import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import {
  assessmentPayloadValidator,
  complianceStatusValidator,
  pipelineStatusValidator,
  type AssessmentPayload,
} from "./schema";
import type { Doc, Id } from "./_generated/dataModel";
import {
  nextStepHint,
  normalizePipelineStatus,
  readinessLabel,
  type PipelineStatus,
} from "../lib/assessment-pipeline";
import {
  canEditAssessment,
  canReadAssessment,
  getAssessmentCollaborator,
  getAssessmentIfReadable,
  getWorkspaceMembership,
  requireAssessmentEdit,
  requireUserId,
  requireWorkspaceMember,
} from "./lib/access";
import { cascadeDeleteAssessmentData } from "./lib/cascadeDeletePvv";
import {
  createAssessmentWithPayload,
  defaultAssessmentPayload,
  mergeCandidateIntoAssessmentPayload,
  nextAssessmentKanbanRank,
} from "./lib/assessmentCreation";
import { sanitizeAssessmentProcessTextFields } from "../lib/assessment-process-profile";
import { payloadToSnapshot } from "./lib/payloadSnapshot";
import { computeAllResults } from "./lib/rpaScoring";

async function refreshCachedPriority(
  ctx: MutationCtx,
  assessmentId: Id<"assessments">,
) {
  const draft = await ctx.db
    .query("assessmentDrafts")
    .withIndex("by_assessment", (q) => q.eq("assessmentId", assessmentId))
    .unique();
  if (!draft) {
    return;
  }
  const computed = computeAllResults(
    payloadToSnapshot(draft.payload as Record<string, unknown>),
  );
  await ctx.db.patch(assessmentId, {
    cachedPriorityScore: computed.priorityScore,
    cachedAp: computed.ap,
    cachedCriticality: computed.criticality,
    cachedEase: computed.ease,
    cachedEaseLabel: computed.easeLabel,
  });
}

async function requireOrgUnitInWorkspace(
  ctx: MutationCtx,
  workspaceId: Id<"workspaces">,
  orgUnitId: Id<"orgUnits">,
) {
  const u = await ctx.db.get(orgUnitId);
  if (!u || u.workspaceId !== workspaceId) {
    throw new Error("Ugyldig organisasjonsenhet.");
  }
}

export const listByWorkspace = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }
    await requireWorkspaceMember(ctx, args.workspaceId, userId, "viewer");
    const rows = await ctx.db
      .query("assessments")
      .withIndex("by_workspace_updated", (q) =>
        q.eq("workspaceId", args.workspaceId),
      )
      .order("desc")
      .collect();
    const out = [];
    for (const a of rows) {
      if (await canReadAssessment(ctx, a, userId)) {
        out.push(a);
      }
    }
    return out;
  },
});

function effectivePriorityFromAssessment(a: Doc<"assessments">): number {
  if (
    a.manualPriorityOverride !== undefined &&
    a.manualPriorityOverride !== null
  ) {
    return a.manualPriorityOverride;
  }
  return a.cachedPriorityScore ?? 0;
}

const DASH_CAP_WITHOUT_ROS = 25;
const DASH_CAP_READY = 25;
const DASH_CAP_BLOCKED = 25;
const DASH_CAP_RECENT = 6;
const DASH_CAP_PRIORITY_TOP = 5;

/** Felles rad for workspace-dashboard (teller, lister). */
export type WorkspaceDashboardAssessmentRow = {
  assessmentId: Id<"assessments">;
  title: string;
  updatedAt: number;
  pipelineStatus: PipelineStatus;
  effectivePriority: number;
  /** Minst én rad i rosAnalysisAssessments for denne vurderingen */
  rosLinked: boolean;
  /** @deprecated Bruk rosLinked */
  hasRosLink: boolean;
  ownerName: string | null;
  nextStepHint: string;
  rosStatus: "not_started" | "in_progress" | "completed" | "not_applicable";
  pddStatus: "not_started" | "in_progress" | "completed" | "not_applicable";
  cachedAp?: number;
  cachedCriticality?: number;
  manualPriorityOverride?: number;
};

function buildDashboardRow(
  a: Doc<"assessments">,
  status: PipelineStatus,
  rosLinked: boolean,
  ownerName: string | null,
): WorkspaceDashboardAssessmentRow {
  return {
    assessmentId: a._id,
    title: a.title,
    updatedAt: a.updatedAt,
    pipelineStatus: status,
    effectivePriority: effectivePriorityFromAssessment(a),
    rosLinked,
    hasRosLink: rosLinked,
    ownerName,
    nextStepHint: nextStepHint(status),
    rosStatus: a.rosStatus ?? "not_started",
    pddStatus: a.pddStatus ?? "not_started",
    cachedAp: a.cachedAp,
    cachedCriticality: a.cachedCriticality,
    manualPriorityOverride: a.manualPriorityOverride,
  };
}

async function ownerDisplayName(
  ctx: QueryCtx,
  userId: Id<"users">,
  cache: Map<Id<"users">, Doc<"users"> | null>,
): Promise<string | null> {
  if (!cache.has(userId)) {
    cache.set(userId, await ctx.db.get(userId));
  }
  const u = cache.get(userId);
  return u?.name ?? u?.email ?? null;
}

/**
 * Operativ oversikt for workspace-dashboard: tall, ROS-dekning, køer og utvalgte saker.
 *
 * Datakilder: `assessments` (index `by_workspace_updated`), `rosAnalysisAssessments` (index `by_workspace`).
 * Ingen schema-endring. Én lesing per synlig vurdering for eier (cache per bruker-ID).
 */
export const workspaceDashboard = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }
    await requireWorkspaceMember(ctx, args.workspaceId, userId, "viewer");

    const rosLinks = await ctx.db
      .query("rosAnalysisAssessments")
      .withIndex("by_workspace", (q) =>
        q.eq("workspaceId", args.workspaceId),
      )
      .collect();
    const assessmentIdsWithRos = new Set(
      rosLinks.map((l) => l.assessmentId),
    );

    const rows = await ctx.db
      .query("assessments")
      .withIndex("by_workspace_updated", (q) =>
        q.eq("workspaceId", args.workspaceId),
      )
      .order("desc")
      .collect();

    const userCache = new Map<Id<"users">, Doc<"users"> | null>();
    const visible: WorkspaceDashboardAssessmentRow[] = [];
    let withoutRosLink = 0;
    let onHold = 0;
    let readyForPrioritizationCount = 0;

    for (const a of rows) {
      if (!(await canReadAssessment(ctx, a, userId))) {
        continue;
      }
      const status = normalizePipelineStatus(a.pipelineStatus);
      const rosLinked = assessmentIdsWithRos.has(a._id);
      if (!rosLinked) {
        withoutRosLink += 1;
      }
      if (status === "on_hold") {
        onHold += 1;
      }
      if (status === "assessed") {
        readyForPrioritizationCount += 1;
      }
      const ownerName = await ownerDisplayName(ctx, a.createdByUserId, userCache);
      visible.push(buildDashboardRow(a, status, rosLinked, ownerName));
    }

    const byPriority = [...visible].sort(
      (x, y) => y.effectivePriority - x.effectivePriority,
    );
    const byRecent = [...visible].sort((x, y) => y.updatedAt - x.updatedAt);

    const withoutRosSorted = visible
      .filter((r) => !r.rosLinked)
      .sort((x, y) => y.effectivePriority - x.effectivePriority);
    const readySorted = visible
      .filter((r) => r.pipelineStatus === "assessed")
      .sort((x, y) => y.effectivePriority - x.effectivePriority);
    const blockedSorted = visible
      .filter((r) => r.pipelineStatus === "on_hold")
      .sort((x, y) => y.updatedAt - x.updatedAt);

    const recentlyUpdated = byRecent.slice(0, DASH_CAP_RECENT);

    return {
      assessmentCount: visible.length,
      withoutRosLinkCount: withoutRosLink,
      onHoldCount: onHold,
      blockedCount: onHold,
      readyForPrioritizationCount,
      assessmentsWithoutRos: withoutRosSorted.slice(0, DASH_CAP_WITHOUT_ROS),
      readyForPrioritization: readySorted.slice(0, DASH_CAP_READY),
      blockedItems: blockedSorted.slice(0, DASH_CAP_BLOCKED),
      recentlyUpdated,
      priorityTop: byPriority.slice(0, DASH_CAP_PRIORITY_TOP),
      /** @deprecated Bruk recentlyUpdated */
      recentUpdated: recentlyUpdated,
    };
  },
});

export const create = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    title: v.string(),
    shareWithWorkspace: v.boolean(),
    /** Ferdigutfylt steg 1 i veiviseren fra valgt prosess (f.eks. etter GitHub-issue). */
    fromCandidateId: v.optional(v.id("candidates")),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireWorkspaceMember(ctx, args.workspaceId, userId, "member");
    let payload = defaultAssessmentPayload();
    if (args.fromCandidateId) {
      const cand = await ctx.db.get(args.fromCandidateId);
      if (!cand || cand.workspaceId !== args.workspaceId) {
        throw new Error("Fant ikke prosessen i dette arbeidsområdet.");
      }
      payload = mergeCandidateIntoAssessmentPayload(payload, cand);
    }
    return await createAssessmentWithPayload(ctx, {
      workspaceId: args.workspaceId,
      userId,
      title: args.title,
      shareWithWorkspace: args.shareWithWorkspace,
      payload,
    });
  },
});

export const findLatestForCandidate = query({
  args: {
    workspaceId: v.id("workspaces"),
    candidateId: v.id("candidates"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }
    await requireWorkspaceMember(ctx, args.workspaceId, userId, "viewer");
    const candidate = await ctx.db.get(args.candidateId);
    if (!candidate || candidate.workspaceId !== args.workspaceId) {
      return null;
    }

    const candidateCode = candidate.code;
    const assessments = ctx.db
      .query("assessments")
      .withIndex("by_workspace_updated", (q) =>
        q.eq("workspaceId", args.workspaceId),
      )
      .order("desc");

    for await (const assessment of assessments) {
      if (!(await canReadAssessment(ctx, assessment, userId))) {
        continue;
      }
      const draft = await ctx.db
        .query("assessmentDrafts")
        .withIndex("by_assessment", (q) => q.eq("assessmentId", assessment._id))
        .unique();
      const draftCandidateCode = draft
        ? String((draft.payload as Record<string, unknown>).candidateId ?? "")
        : "";
      if (draftCandidateCode !== candidateCode) {
        continue;
      }
      const pipelineStatus = normalizePipelineStatus(assessment.pipelineStatus);
      return {
        assessmentId: assessment._id,
        title: assessment.title,
        updatedAt: assessment.updatedAt,
        pipelineStatus,
        nextStepHint: nextStepHint(pipelineStatus),
      };
    }

    return null;
  },
});

export const updateAssessmentTitle = mutation({
  args: {
    assessmentId: v.id("assessments"),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAssessmentEdit(ctx, args.assessmentId);
    const t = args.title.trim();
    if (!t) {
      throw new Error("Tittel kan ikke være tom.");
    }
    if (t.length > 240) {
      throw new Error("Tittel er for lang (maks 240 tegn).");
    }
    await ctx.db.patch(args.assessmentId, {
      title: t,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const getDraft = query({
  args: { assessmentId: v.id("assessments") },
  handler: async (ctx, args) => {
    const readable = await getAssessmentIfReadable(ctx, args.assessmentId);
    if (!readable) {
      return null;
    }
    const { assessment } = readable;
    const draft = await ctx.db
      .query("assessmentDrafts")
      .withIndex("by_assessment", (q) => q.eq("assessmentId", args.assessmentId))
      .unique();
    if (!draft) {
      return null;
    }
    const computed = computeAllResults(
      payloadToSnapshot(draft.payload as Record<string, unknown>),
    );
    return { assessment, draft, computed };
  },
});

export const saveDraft = mutation({
  args: {
    assessmentId: v.id("assessments"),
    /** Må matche `draft.revision` på serveren (0 hvis eldre utkast uten revisjon) */
    expectedRevision: v.number(),
    payload: assessmentPayloadValidator,
  },
  handler: async (ctx, args) => {
    const { assessment, userId } = await requireAssessmentEdit(
      ctx,
      args.assessmentId,
    );
    if (
      !Number.isInteger(args.expectedRevision) ||
      args.expectedRevision < 0
    ) {
      throw new Error("Ugyldig revisjon.");
    }
    const now = Date.now();
    const payload = sanitizeAssessmentProcessTextFields(
      args.payload as unknown as Record<string, unknown>,
    ) as AssessmentPayload;
    const existing = await ctx.db
      .query("assessmentDrafts")
      .withIndex("by_assessment", (q) =>
        q.eq("assessmentId", args.assessmentId),
      )
      .unique();
    if (!existing) {
      if (args.expectedRevision !== 0) {
        throw new Error(
          "Utkastet er ikke synket. Last siden på nytt og prøv igjen.",
        );
      }
      await ctx.db.insert("assessmentDrafts", {
        assessmentId: args.assessmentId,
        payload,
        updatedAt: now,
        updatedByUserId: userId,
        revision: 1,
      });
      await ctx.db.patch(assessment._id, { updatedAt: now });
      await refreshCachedPriority(ctx, args.assessmentId);
      return { ok: true as const, revision: 1 };
    }
    const serverRev = existing.revision ?? 0;
    if (args.expectedRevision !== serverRev) {
      const u = await ctx.db.get(existing.updatedByUserId);
      return {
        ok: false as const,
        conflict: {
          serverRevision: serverRev,
          serverPayload: existing.payload as AssessmentPayload,
          updatedAt: existing.updatedAt,
          updatedByUserId: existing.updatedByUserId,
          updatedByName: u?.name ?? u?.email ?? null,
        },
      };
    }
    const newRev = serverRev + 1;
    await ctx.db.patch(existing._id, {
      payload,
      updatedAt: now,
      updatedByUserId: userId,
      revision: newRev,
    });
    await ctx.db.patch(assessment._id, { updatedAt: now });
    await refreshCachedPriority(ctx, args.assessmentId);
    return { ok: true as const, revision: newRev };
  },
});

export const createVersion = mutation({
  args: {
    assessmentId: v.id("assessments"),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { assessment, userId } = await requireAssessmentEdit(
      ctx,
      args.assessmentId,
    );
    const draft = await ctx.db
      .query("assessmentDrafts")
      .withIndex("by_assessment", (q) =>
        q.eq("assessmentId", args.assessmentId),
      )
      .unique();
    if (!draft) {
      throw new Error("Ingen utkast å lagre.");
    }
    const payload = draft.payload as Record<string, unknown>;
    const snapshot = payloadToSnapshot(payload);
    const computed = computeAllResults(snapshot);
    const last = await ctx.db
      .query("assessmentVersions")
      .withIndex("by_assessment", (q) =>
        q.eq("assessmentId", args.assessmentId),
      )
      .order("desc")
      .first();
    const nextVersion = (last?.version ?? 0) + 1;
    const now = Date.now();
    await ctx.db.insert("assessmentVersions", {
      assessmentId: args.assessmentId,
      version: nextVersion,
      note: args.note,
      payload: draft.payload,
      computed,
      createdByUserId: userId,
      createdAt: now,
    });
    await ctx.db.patch(assessment._id, {
      updatedAt: now,
      cachedPriorityScore: computed.priorityScore,
      cachedAp: computed.ap,
      cachedCriticality: computed.criticality,
      cachedEase: computed.ease,
      cachedEaseLabel: computed.easeLabel,
    });
    return nextVersion;
  },
});

/** Gjenopprett utkast fra en lagret versjon (utkastet overskrives; historikk beholdes). */
export const restoreDraftFromVersion = mutation({
  args: {
    assessmentId: v.id("assessments"),
    version: v.number(),
  },
  handler: async (ctx, args) => {
    const { assessment, userId } = await requireAssessmentEdit(
      ctx,
      args.assessmentId,
    );
    if (args.version < 1 || !Number.isInteger(args.version)) {
      throw new Error("Ugyldig versjonsnummer.");
    }
    const ver = await ctx.db
      .query("assessmentVersions")
      .withIndex("by_assessment_version", (q) =>
        q.eq("assessmentId", args.assessmentId).eq("version", args.version),
      )
      .unique();
    if (!ver) {
      throw new Error("Fant ikke denne versjonen.");
    }
    const now = Date.now();
    const existing = await ctx.db
      .query("assessmentDrafts")
      .withIndex("by_assessment", (q) =>
        q.eq("assessmentId", args.assessmentId),
      )
      .unique();
    const restoredPayload = sanitizeAssessmentProcessTextFields(
      ver.payload as unknown as Record<string, unknown>,
    ) as AssessmentPayload;
    const prevRev = existing ? (existing.revision ?? 0) : 0;
    const newRevision = prevRev + 1;
    if (existing) {
      await ctx.db.patch(existing._id, {
        payload: restoredPayload,
        updatedAt: now,
        updatedByUserId: userId,
        revision: newRevision,
      });
    } else {
      await ctx.db.insert("assessmentDrafts", {
        assessmentId: args.assessmentId,
        payload: restoredPayload,
        updatedAt: now,
        updatedByUserId: userId,
        revision: newRevision,
      });
    }
    await ctx.db.patch(assessment._id, { updatedAt: now });
    await refreshCachedPriority(ctx, args.assessmentId);
    return { payload: restoredPayload, revision: newRevision };
  },
});

export const listPriorityHighlights = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }
    const cap = Math.min(24, Math.max(1, args.limit ?? 12));
    const memberships = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const out: Array<{
      assessment: Doc<"assessments">;
      workspaceId: Id<"workspaces">;
      workspaceName: string;
      priorityScore: number;
      effectivePriority: number;
      pipelineStatus: PipelineStatus;
      nextStepHint: string;
      readinessLabel: string;
    }> = [];
    for (const m of memberships) {
      const ws = await ctx.db.get(m.workspaceId);
      if (!ws) {
        continue;
      }
      const assessments = await ctx.db
        .query("assessments")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", m.workspaceId))
        .collect();
      for (const a of assessments) {
        if (!(await canReadAssessment(ctx, a, userId))) {
          continue;
        }
        const draft = await ctx.db
          .query("assessmentDrafts")
          .withIndex("by_assessment", (q) => q.eq("assessmentId", a._id))
          .unique();
        const snapshot = draft
          ? payloadToSnapshot(draft.payload as Record<string, unknown>)
          : payloadToSnapshot(
              defaultAssessmentPayload() as unknown as Record<string, unknown>,
            );
        const computed = computeAllResults(snapshot);
        const status = normalizePipelineStatus(a.pipelineStatus);
        const base = computed.priorityScore;
        const effective =
          a.manualPriorityOverride !== undefined && a.manualPriorityOverride !== null
            ? a.manualPriorityOverride
            : base;
        out.push({
          assessment: a,
          workspaceId: m.workspaceId,
          workspaceName: ws.name,
          priorityScore: base,
          effectivePriority: effective,
          pipelineStatus: status,
          nextStepHint: nextStepHint(status),
          readinessLabel: readinessLabel(status),
        });
      }
    }
    out.sort((x, y) => y.effectivePriority - x.effectivePriority);
    return out.slice(0, cap);
  },
});

export const setPipelineStatus = mutation({
  args: {
    assessmentId: v.id("assessments"),
    status: pipelineStatusValidator,
  },
  handler: async (ctx, args) => {
    const { assessment } = await requireAssessmentEdit(ctx, args.assessmentId);
    const status = args.status as PipelineStatus;
    const rank = await nextAssessmentKanbanRank(
      ctx,
      assessment.workspaceId,
      status,
    );
    await ctx.db.patch(args.assessmentId, {
      pipelineStatus: args.status,
      kanbanRank: rank,
      updatedAt: Date.now(),
    });
  },
});

export const setManualPriorityOverride = mutation({
  args: {
    assessmentId: v.id("assessments"),
    manualPriorityOverride: v.union(v.number(), v.null()),
  },
  handler: async (ctx, args) => {
    await requireAssessmentEdit(ctx, args.assessmentId);
    if (args.manualPriorityOverride !== null) {
      const v0 = args.manualPriorityOverride;
      if (Number.isNaN(v0) || v0 < 0 || v0 > 100) {
        throw new Error("Manuell prioritet må være mellom 0 og 100.");
      }
    }
    await ctx.db.patch(args.assessmentId, {
      manualPriorityOverride:
        args.manualPriorityOverride === null ? undefined : args.manualPriorityOverride,
      updatedAt: Date.now(),
    });
  },
});

export const setAssessmentOrgUnit = mutation({
  args: {
    assessmentId: v.id("assessments"),
    orgUnitId: v.union(v.id("orgUnits"), v.null()),
  },
  handler: async (ctx, args) => {
    const { assessment } = await requireAssessmentEdit(ctx, args.assessmentId);
    if (args.orgUnitId !== null) {
      await requireOrgUnitInWorkspace(
        ctx,
        assessment.workspaceId,
        args.orgUnitId,
      );
    }
    await ctx.db.patch(args.assessmentId, {
      orgUnitId: args.orgUnitId === null ? undefined : args.orgUnitId,
      updatedAt: Date.now(),
    });
  },
});

export const updateAssessmentCompliance = mutation({
  args: {
    assessmentId: v.id("assessments"),
    rosStatus: v.optional(complianceStatusValidator),
    rosUrl: v.optional(v.union(v.string(), v.null())),
    rosNotes: v.optional(v.union(v.string(), v.null())),
    rosCompletedAt: v.optional(v.union(v.number(), v.null())),
    pddStatus: v.optional(complianceStatusValidator),
    pddUrl: v.optional(v.union(v.string(), v.null())),
    pddNotes: v.optional(v.union(v.string(), v.null())),
    pddCompletedAt: v.optional(v.union(v.number(), v.null())),
    nextRosPvvReviewAt: v.optional(v.union(v.number(), v.null())),
    rosPvvReviewRoutineNotes: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const { assessment: priorAssessment } = await requireAssessmentEdit(
      ctx,
      args.assessmentId,
    );
    const now = Date.now();
    const prevRos = priorAssessment.rosStatus ?? "not_started";
    const patch: {
      updatedAt: number;
      rosStatus?: typeof args.rosStatus;
      rosUrl?: string;
      rosNotes?: string;
      rosCompletedAt?: number;
      pddStatus?: typeof args.pddStatus;
      pddUrl?: string;
      pddNotes?: string;
      pddCompletedAt?: number;
      nextRosPvvReviewAt?: number;
      rosPvvReviewRoutineNotes?: string;
      pipelineStatus?: PipelineStatus;
      kanbanRank?: number;
    } = { updatedAt: now };
    const strOrClear = (val: string | null | undefined) => {
      if (val == null) {
        return undefined;
      }
      const t = val.trim();
      return t || undefined;
    };
    if (args.rosStatus !== undefined) {
      patch.rosStatus = args.rosStatus;
    }
    if (args.rosUrl !== undefined) {
      patch.rosUrl = strOrClear(args.rosUrl);
    }
    if (args.rosNotes !== undefined) {
      patch.rosNotes = strOrClear(args.rosNotes);
    }
    if (args.rosCompletedAt !== undefined) {
      patch.rosCompletedAt =
        args.rosCompletedAt === null ? undefined : args.rosCompletedAt;
    } else if (args.rosStatus === "completed") {
      patch.rosCompletedAt = now;
    }
    if (args.pddStatus !== undefined) {
      patch.pddStatus = args.pddStatus;
    }
    if (args.pddUrl !== undefined) {
      patch.pddUrl = strOrClear(args.pddUrl);
    }
    if (args.pddNotes !== undefined) {
      patch.pddNotes = strOrClear(args.pddNotes);
    }
    if (args.pddCompletedAt !== undefined) {
      patch.pddCompletedAt =
        args.pddCompletedAt === null ? undefined : args.pddCompletedAt;
    } else if (args.pddStatus === "completed") {
      patch.pddCompletedAt = now;
    }
    if (args.nextRosPvvReviewAt !== undefined) {
      patch.nextRosPvvReviewAt =
        args.nextRosPvvReviewAt === null ? undefined : args.nextRosPvvReviewAt;
    }
    if (args.rosPvvReviewRoutineNotes !== undefined) {
      patch.rosPvvReviewRoutineNotes = strOrClear(
        args.rosPvvReviewRoutineNotes,
      );
    }
    /** Når ROS markeres fullført første gang og PVV fortsatt er «Ikke vurdert», løft til «Vurdert». */
    if (
      args.rosStatus === "completed" &&
      prevRos !== "completed" &&
      normalizePipelineStatus(priorAssessment.pipelineStatus) === "not_assessed"
    ) {
      patch.pipelineStatus = "assessed";
      patch.kanbanRank = await nextAssessmentKanbanRank(
        ctx,
        priorAssessment.workspaceId,
        "assessed",
      );
    }
    await ctx.db.patch(args.assessmentId, patch);
    if (
      args.rosStatus === "completed" &&
      prevRos !== "completed"
    ) {
      await ctx.scheduler.runAfter(
        0,
        internal.githubCandidateProject.postRosCompletedGithubComment,
        { assessmentId: args.assessmentId },
      );
    }
  },
});

export const listVersions = query({
  args: { assessmentId: v.id("assessments") },
  handler: async (ctx, args) => {
    const readable = await getAssessmentIfReadable(ctx, args.assessmentId);
    if (!readable) {
      return [];
    }
    const rows = await ctx.db
      .query("assessmentVersions")
      .withIndex("by_assessment", (q) =>
        q.eq("assessmentId", args.assessmentId),
      )
      .order("desc")
      .collect();
    const enriched = [];
    for (const r of rows) {
      const u = await ctx.db.get(r.createdByUserId);
      enriched.push({
        ...r,
        creatorName: u?.name ?? u?.email ?? null,
      });
    }
    return enriched;
  },
});

/** En lagret milepæl-versjon (for forhåndsvisning uten hele payload i klient). */
export const getAssessmentVersion = query({
  args: {
    assessmentId: v.id("assessments"),
    version: v.number(),
  },
  handler: async (ctx, args) => {
    const readable = await getAssessmentIfReadable(ctx, args.assessmentId);
    if (!readable) {
      return null;
    }
    const row = await ctx.db
      .query("assessmentVersions")
      .withIndex("by_assessment_version", (q) =>
        q.eq("assessmentId", args.assessmentId).eq("version", args.version),
      )
      .unique();
    if (!row) {
      return null;
    }
    const u = await ctx.db.get(row.createdByUserId);
    const payload = row.payload as Record<string, unknown>;
    const pn = payload.processName;
    const cid = payload.candidateId;
    return {
      version: row.version,
      note: row.note ?? null,
      createdAt: row.createdAt,
      creatorName: u?.name ?? u?.email ?? null,
      computed: row.computed,
      processName: typeof pn === "string" ? pn : "",
      candidateId: typeof cid === "string" ? cid : "",
    };
  },
});

/** Sammenlign to lagrede versjoner (beregning + hvilke skjemafelt som avviker). */
export const compareAssessmentVersions = query({
  args: {
    assessmentId: v.id("assessments"),
    versionA: v.number(),
    versionB: v.number(),
  },
  handler: async (ctx, args) => {
    const readable = await getAssessmentIfReadable(ctx, args.assessmentId);
    if (!readable) {
      return null;
    }
    const a = await ctx.db
      .query("assessmentVersions")
      .withIndex("by_assessment_version", (q) =>
        q.eq("assessmentId", args.assessmentId).eq("version", args.versionA),
      )
      .unique();
    const b = await ctx.db
      .query("assessmentVersions")
      .withIndex("by_assessment_version", (q) =>
        q.eq("assessmentId", args.assessmentId).eq("version", args.versionB),
      )
      .unique();
    if (!a || !b) {
      return null;
    }
    const pa = a.payload as Record<string, unknown>;
    const pb = b.payload as Record<string, unknown>;
    const keys = new Set([...Object.keys(pa), ...Object.keys(pb)]);
    const changedFields: Array<{
      key: string;
      before: string;
      after: string;
    }> = [];
    const fmt = (v: unknown): string => {
      if (v === undefined || v === null) return "—";
      if (typeof v === "boolean") return v ? "Ja" : "Nei";
      if (typeof v === "number") return String(v);
      if (typeof v === "string") {
        const t = v.trim();
        return t.length > 280 ? `${t.slice(0, 280)}…` : t;
      }
      try {
        const s = JSON.stringify(v);
        return s.length > 200 ? `${s.slice(0, 200)}…` : s;
      } catch {
        return "…";
      }
    };
    for (const k of keys) {
      const sa = JSON.stringify(pa[k]);
      const sb = JSON.stringify(pb[k]);
      if (sa === sb) continue;
      changedFields.push({
        key: k,
        before: fmt(pa[k]),
        after: fmt(pb[k]),
      });
    }
    changedFields.sort((x, y) => x.key.localeCompare(y.key, "nb"));
    return {
      versionA: {
        version: a.version,
        createdAt: a.createdAt,
        note: a.note ?? null,
        computed: a.computed,
      },
      versionB: {
        version: b.version,
        createdAt: b.createdAt,
        note: b.note ?? null,
        computed: b.computed,
      },
      changedFields,
    };
  },
});

export const deleteAssessmentVersion = mutation({
  args: {
    assessmentId: v.id("assessments"),
    version: v.number(),
  },
  handler: async (ctx, args) => {
    await requireAssessmentEdit(ctx, args.assessmentId);
    const row = await ctx.db
      .query("assessmentVersions")
      .withIndex("by_assessment_version", (q) =>
        q.eq("assessmentId", args.assessmentId).eq("version", args.version),
      )
      .unique();
    if (!row) {
      throw new Error("Fant ikke versjonen.");
    }
    await ctx.db.delete(row._id);
    return null;
  },
});

export const deleteAssessment = mutation({
  args: { assessmentId: v.id("assessments") },
  handler: async (ctx, args) => {
    await requireAssessmentEdit(ctx, args.assessmentId);
    await cascadeDeleteAssessmentData(ctx, args.assessmentId);
    return null;
  },
});

export const listCollaborators = query({
  args: { assessmentId: v.id("assessments") },
  handler: async (ctx, args) => {
    const readable = await getAssessmentIfReadable(ctx, args.assessmentId);
    if (!readable) {
      return [];
    }
    const rows = await ctx.db
      .query("assessmentCollaborators")
      .withIndex("by_assessment", (q) =>
        q.eq("assessmentId", args.assessmentId),
      )
      .collect();
    const enriched = [];
    for (const r of rows) {
      const u = await ctx.db.get(r.userId);
      enriched.push({
        ...r,
        email: u?.email ?? null,
        name: u?.name ?? null,
      });
    }
    return enriched;
  },
});

export const inviteCollaborator = mutation({
  args: {
    assessmentId: v.id("assessments"),
    email: v.string(),
    role: v.union(
      v.literal("editor"),
      v.literal("reviewer"),
      v.literal("viewer"),
    ),
  },
  handler: async (ctx, args) => {
    const { assessment, userId } = await requireAssessmentEdit(
      ctx,
      args.assessmentId,
    );
    const email = args.email.trim().toLowerCase();
    if (!email) {
      throw new Error("E-post mangler.");
    }
    const foundUser = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .unique();
    if (foundUser) {
      const existing = await ctx.db
        .query("assessmentCollaborators")
        .withIndex("by_user_assessment", (q) =>
          q.eq("userId", foundUser._id).eq("assessmentId", args.assessmentId),
        )
        .unique();
      if (!existing) {
        const wm = await getWorkspaceMembership(
          ctx,
          assessment.workspaceId,
          foundUser._id,
        );
        if (!wm) {
          await ctx.db.insert("workspaceMembers", {
            workspaceId: assessment.workspaceId,
            userId: foundUser._id,
            role: "viewer",
            joinedAt: Date.now(),
          });
        }
        await ctx.db.insert("assessmentCollaborators", {
          assessmentId: args.assessmentId,
          userId: foundUser._id,
          role: args.role,
          addedAt: Date.now(),
        });
        return { kind: "linked" as const };
      }
      if (existing.role === "owner") {
        return { kind: "already" as const };
      }
      if (existing.role !== args.role) {
        await ctx.db.patch(existing._id, { role: args.role });
        return { kind: "updated" as const };
      }
      return { kind: "already" as const };
    }
    const token = `inv_${Date.now()}_${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
    await ctx.db.insert("assessmentInvites", {
      assessmentId: args.assessmentId,
      email,
      role: args.role,
      token,
      invitedByUserId: userId,
      createdAt: Date.now(),
    });
    return { kind: "pending" as const, token };
  },
});

export const acceptInvitesForEmail = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const user = await ctx.db.get(userId);
    const email = user?.email?.trim().toLowerCase();
    if (!email) {
      return 0;
    }
    const invites = await ctx.db
      .query("assessmentInvites")
      .withIndex("by_email", (q) => q.eq("email", email))
      .collect();
    let n = 0;
    for (const inv of invites) {
      const assessment = await ctx.db.get(inv.assessmentId);
      if (!assessment) {
        await ctx.db.delete(inv._id);
        continue;
      }
      const wm = await getWorkspaceMembership(
        ctx,
        assessment.workspaceId,
        userId,
      );
      if (!wm) {
        await ctx.db.insert("workspaceMembers", {
          workspaceId: assessment.workspaceId,
          userId,
          role: "viewer",
          joinedAt: Date.now(),
        });
      }
      const exists = await ctx.db
        .query("assessmentCollaborators")
        .withIndex("by_user_assessment", (q) =>
          q.eq("userId", userId).eq("assessmentId", inv.assessmentId),
        )
        .unique();
      if (!exists) {
        await ctx.db.insert("assessmentCollaborators", {
          assessmentId: inv.assessmentId,
          userId,
          role: inv.role,
          addedAt: Date.now(),
        });
        n++;
      }
      await ctx.db.delete(inv._id);
    }
    return n;
  },
});

export const setShareWithWorkspace = mutation({
  args: {
    assessmentId: v.id("assessments"),
    shareWithWorkspace: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { assessment, userId } = await requireAssessmentEdit(
      ctx,
      args.assessmentId,
    );
    const collab = await getAssessmentCollaborator(ctx, args.assessmentId, userId);
    const canOwnerEditor =
      collab?.role === "owner" || collab?.role === "editor";
    if (!canOwnerEditor) {
      await requireWorkspaceMember(
        ctx,
        assessment.workspaceId,
        userId,
        "admin",
      );
    }
    await ctx.db.patch(args.assessmentId, {
      shareWithWorkspace: args.shareWithWorkspace,
      updatedAt: Date.now(),
    });
  },
});

export const getMyAccess = query({
  args: { assessmentId: v.id("assessments") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }
    const assessment = await ctx.db.get(args.assessmentId);
    if (!assessment) {
      return null;
    }
    const read = await canReadAssessment(ctx, assessment, userId);
    if (!read) {
      return null;
    }
    const edit = await canEditAssessment(ctx, assessment, userId);
    const collab = await getAssessmentCollaborator(ctx, args.assessmentId, userId);
    const wm = await getWorkspaceMembership(ctx, assessment.workspaceId, userId);
    return {
      userId,
      canEdit: edit,
      collaboratorRole: collab?.role ?? null,
      workspaceRole: wm?.role ?? null,
      shareWithWorkspace: assessment.shareWithWorkspace,
    };
  },
});

export const listAssessmentInvites = query({
  args: { assessmentId: v.id("assessments") },
  handler: async (ctx, args) => {
    await requireAssessmentEdit(ctx, args.assessmentId);
    const rows = await ctx.db
      .query("assessmentInvites")
      .withIndex("by_assessment", (q) =>
        q.eq("assessmentId", args.assessmentId),
      )
      .collect();
    return rows.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const removeCollaborator = mutation({
  args: {
    assessmentId: v.id("assessments"),
    targetUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await requireAssessmentEdit(ctx, args.assessmentId);
    const row = await ctx.db
      .query("assessmentCollaborators")
      .withIndex("by_user_assessment", (q) =>
        q.eq("userId", args.targetUserId).eq("assessmentId", args.assessmentId),
      )
      .unique();
    if (!row) {
      throw new Error("Brukeren er ikke på teamet for denne vurderingen.");
    }
    if (row.role === "owner") {
      throw new Error("Kan ikke fjerne eier.");
    }
    await ctx.db.delete(row._id);
    return null;
  },
});

export const updateCollaboratorRole = mutation({
  args: {
    assessmentId: v.id("assessments"),
    targetUserId: v.id("users"),
    role: v.union(
      v.literal("editor"),
      v.literal("reviewer"),
      v.literal("viewer"),
    ),
  },
  handler: async (ctx, args) => {
    await requireAssessmentEdit(ctx, args.assessmentId);
    const row = await ctx.db
      .query("assessmentCollaborators")
      .withIndex("by_user_assessment", (q) =>
        q.eq("userId", args.targetUserId).eq("assessmentId", args.assessmentId),
      )
      .unique();
    if (!row) {
      throw new Error("Brukeren er ikke på teamet for denne vurderingen.");
    }
    if (row.role === "owner") {
      throw new Error("Eierrollen kan ikke endres her.");
    }
    await ctx.db.patch(row._id, { role: args.role });
    return null;
  },
});

export const cancelAssessmentInvite = mutation({
  args: { inviteId: v.id("assessmentInvites") },
  handler: async (ctx, args) => {
    const inv = await ctx.db.get(args.inviteId);
    if (!inv) {
      throw new Error("Invitasjonen finnes ikke.");
    }
    await requireAssessmentEdit(ctx, inv.assessmentId);
    await ctx.db.delete(args.inviteId);
    return null;
  },
});

export const listMineAcrossWorkspaces = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }
    const collabs = await ctx.db
      .query("assessmentCollaborators")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const out = [];
    for (const c of collabs) {
      const a = await ctx.db.get(c.assessmentId);
      if (a && (await canReadAssessment(ctx, a, userId))) {
        out.push({ assessment: a, role: c.role });
      }
    }
    return out;
  },
});
