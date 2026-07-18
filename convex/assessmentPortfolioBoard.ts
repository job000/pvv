import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";
import {
  canReadAssessment,
  requireAssessmentEdit,
  requireWorkspaceMember,
} from "./lib/access";
import { pipelineStatusValidator } from "./schema";
import {
  normalizePipelineStatus,
  PIPELINE_KANBAN_ORDER,
  type PipelineStatus,
} from "../lib/assessment-pipeline";

/**
 * Lavthengende frukt: høy gjennomførbarhet, ikke nødvendigvis høyest prioritet-score.
 * Forslag til koordinator — overstyrer ikke tavlerekkefølge.
 */
function isLowHangingFruit(a: {
  cachedEase?: number;
  cachedPriorityScore?: number;
  cachedDeliveryConfidence?: number;
}): boolean {
  const ease = a.cachedEase ?? 0;
  const score = a.cachedPriorityScore ?? 0;
  const delivery = a.cachedDeliveryConfidence ?? 0;
  return ease >= 65 && (score < 75 || delivery >= 60);
}

const boardCardValidator = v.object({
  assessmentId: v.id("assessments"),
  title: v.string(),
  pipelineStatus: v.string(),
  kanbanRank: v.number(),
  updatedAt: v.number(),
  modelPriorityScore: v.number(),
  effectivePriority: v.number(),
  hasManualPriority: v.boolean(),
  manualPriorityOverride: v.union(v.number(), v.null()),
  cachedAp: v.optional(v.number()),
  cachedEase: v.optional(v.number()),
  cachedEaseLabel: v.optional(v.string()),
  cachedCriticality: v.optional(v.number()),
  cachedDeliveryConfidence: v.optional(v.number()),
  lowHangingFruit: v.boolean(),
  rosStatus: v.string(),
  pddStatus: v.string(),
  openTaskCount: v.number(),
  noteCount: v.number(),
  openAssigneeNames: v.array(v.string()),
});

export const listBoard = query({
  args: { workspaceId: v.id("workspaces") },
  returns: v.union(
    v.null(),
    v.object({
      columns: v.array(
        v.object({
          status: v.string(),
          cards: v.array(boardCardValidator),
        }),
      ),
      totalCount: v.number(),
      lowHangingFruitCount: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    await requireWorkspaceMember(ctx, args.workspaceId, userId, "viewer");

    const rows = await ctx.db
      .query("assessments")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .take(500);

    type Card = {
      assessmentId: Id<"assessments">;
      title: string;
      pipelineStatus: PipelineStatus;
      kanbanRank: number;
      updatedAt: number;
      modelPriorityScore: number;
      effectivePriority: number;
      hasManualPriority: boolean;
      manualPriorityOverride: number | null;
      cachedAp?: number;
      cachedEase?: number;
      cachedEaseLabel?: string;
      cachedCriticality?: number;
      cachedDeliveryConfidence?: number;
      lowHangingFruit: boolean;
      rosStatus: string;
      pddStatus: string;
      openTaskCount: number;
      noteCount: number;
      openAssigneeNames: string[];
    };

    const byStatus = new Map<PipelineStatus, Card[]>();
    for (const s of PIPELINE_KANBAN_ORDER) {
      byStatus.set(s, []);
    }

    let totalCount = 0;
    let lowHangingFruitCount = 0;

    for (const a of rows) {
      if (!(await canReadAssessment(ctx, a, userId))) continue;
      totalCount += 1;
      const status = normalizePipelineStatus(a.pipelineStatus);
      const modelPriorityScore = a.cachedPriorityScore ?? 0;
      const hasManual =
        a.manualPriorityOverride !== undefined &&
        a.manualPriorityOverride !== null;
      const effectivePriority = hasManual
        ? (a.manualPriorityOverride as number)
        : modelPriorityScore;
      const lowHangingFruit = isLowHangingFruit(a);
      if (lowHangingFruit) lowHangingFruitCount += 1;

      const tasks = await ctx.db
        .query("assessmentTasks")
        .withIndex("by_assessment", (q) => q.eq("assessmentId", a._id))
        .collect();
      const openTasks = tasks.filter((t) => t.status === "open");
      const assigneeNames: string[] = [];
      const seenAssignees = new Set<string>();
      for (const t of openTasks) {
        const ids =
          t.assigneeUserIds && t.assigneeUserIds.length > 0
            ? t.assigneeUserIds
            : t.assigneeUserId
              ? [t.assigneeUserId]
              : [];
        for (const uid of ids) {
          if (seenAssignees.has(uid)) continue;
          seenAssignees.add(uid);
          const u = await ctx.db.get(uid);
          assigneeNames.push(u?.name ?? u?.email ?? "Bruker");
          if (assigneeNames.length >= 4) break;
        }
        if (assigneeNames.length >= 4) break;
      }
      const notes = await ctx.db
        .query("assessmentNotes")
        .withIndex("by_assessment", (q) => q.eq("assessmentId", a._id))
        .collect();

      const card: Card = {
        assessmentId: a._id,
        title: a.title.trim() || "Uten tittel",
        pipelineStatus: status,
        kanbanRank: a.kanbanRank ?? a.updatedAt,
        updatedAt: a.updatedAt,
        modelPriorityScore,
        effectivePriority,
        hasManualPriority: hasManual,
        manualPriorityOverride: hasManual
          ? (a.manualPriorityOverride as number)
          : null,
        cachedAp: a.cachedAp,
        cachedEase: a.cachedEase,
        cachedEaseLabel: a.cachedEaseLabel,
        cachedCriticality: a.cachedCriticality,
        cachedDeliveryConfidence: a.cachedDeliveryConfidence,
        lowHangingFruit,
        rosStatus: a.rosStatus ?? "not_started",
        pddStatus: a.pddStatus ?? "not_started",
        openTaskCount: openTasks.length,
        noteCount: notes.length,
        openAssigneeNames: assigneeNames,
      };
      byStatus.get(status)!.push(card);
    }

    const columns = PIPELINE_KANBAN_ORDER.map((status) => {
      const cards = byStatus.get(status) ?? [];
      // Koordinatorens rekkefølge først (kanbanRank), deretter modell-score
      cards.sort((x, y) => {
        if (x.kanbanRank !== y.kanbanRank) return x.kanbanRank - y.kanbanRank;
        return y.effectivePriority - x.effectivePriority;
      });
      return { status, cards };
    });

    return { columns, totalCount, lowHangingFruitCount };
  },
});

/**
 * Flytt kort til kolonne og/eller ny plass i kolonnen.
 * `beforeAssessmentId` = null → legg sist i kolonnen.
 */
export const moveOnBoard = mutation({
  args: {
    assessmentId: v.id("assessments"),
    toStatus: pipelineStatusValidator,
    beforeAssessmentId: v.union(v.id("assessments"), v.null()),
  },
  returns: v.object({ ok: v.literal(true) }),
  handler: async (ctx, args) => {
    const { assessment } = await requireAssessmentEdit(ctx, args.assessmentId);
    const toStatus = args.toStatus as PipelineStatus;
    const now = Date.now();

    const siblings = await ctx.db
      .query("assessments")
      .withIndex("by_workspace", (q) =>
        q.eq("workspaceId", assessment.workspaceId),
      )
      .collect();

    const inTarget = siblings
      .filter(
        (r) =>
          r._id !== args.assessmentId &&
          normalizePipelineStatus(r.pipelineStatus) === toStatus,
      )
      .sort(
        (a, b) =>
          (a.kanbanRank ?? a.updatedAt) - (b.kanbanRank ?? b.updatedAt),
      );

    const orderedIds: Id<"assessments">[] = [];
    let inserted = false;
    for (const row of inTarget) {
      if (
        args.beforeAssessmentId !== null &&
        row._id === args.beforeAssessmentId
      ) {
        orderedIds.push(args.assessmentId);
        inserted = true;
      }
      orderedIds.push(row._id);
    }
    if (!inserted) {
      orderedIds.push(args.assessmentId);
    }

    let rank = 1;
    for (const id of orderedIds) {
      if (id === args.assessmentId) {
        await ctx.db.patch(id, {
          pipelineStatus: toStatus,
          kanbanRank: rank,
          updatedAt: now,
        });
      } else {
        await ctx.db.patch(id, {
          kanbanRank: rank,
          updatedAt: now,
        });
      }
      rank += 1;
    }

    return { ok: true as const };
  },
});

/** Sett eller fjern manuell porteføljeprioritet (0–100). Overstyrer modell-score i oversikter. */
export const setCoordinatorPriority = mutation({
  args: {
    assessmentId: v.id("assessments"),
    priority: v.union(v.number(), v.null()),
  },
  returns: v.object({ ok: v.literal(true) }),
  handler: async (ctx, args) => {
    await requireAssessmentEdit(ctx, args.assessmentId);
    if (args.priority !== null) {
      if (
        Number.isNaN(args.priority) ||
        args.priority < 0 ||
        args.priority > 100
      ) {
        throw new Error("Prioritet må være mellom 0 og 100.");
      }
    }
    await ctx.db.patch(args.assessmentId, {
      manualPriorityOverride:
        args.priority === null ? undefined : Math.round(args.priority),
      updatedAt: Date.now(),
    });
    return { ok: true as const };
  },
});
