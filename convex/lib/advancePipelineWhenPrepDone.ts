import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { normalizePipelineStatus } from "../../lib/assessment-pipeline";
import { nextAssessmentKanbanRank } from "./assessmentCreation";
import { AUTO_LEVERANSE_LABEL } from "./seedRpaDeliveryTasks";
import { insertUserInAppNotification } from "../userInAppNotifications";

/** Forberedelses-subkort før aktiv utvikling. */
export const PREP_SUBTASK_KINDS = ["ros", "pdd", "tilganger"] as const;
export type PrepSubtaskKind = (typeof PREP_SUBTASK_KINDS)[number];

function prepKindOf(task: Doc<"assessmentTasks">): PrepSubtaskKind | null {
  const labels = task.labels ?? [];
  if (!labels.includes(AUTO_LEVERANSE_LABEL)) return null;
  for (const kind of PREP_SUBTASK_KINDS) {
    if (labels.includes(kind)) return kind;
  }
  return null;
}

/**
 * Når ROS / PDD / Tilganger-subkort i auto-leveransepakken er ferdige
 * og vurderingen står i Prioritert → flytt til Utvikling.
 */
export async function maybeAdvancePipelineWhenPrepDone(
  ctx: MutationCtx,
  args: {
    task: Doc<"assessmentTasks">;
    actorUserId: Id<"users">;
  },
): Promise<{ advanced: boolean }> {
  const labels = args.task.labels ?? [];
  if (!labels.includes(AUTO_LEVERANSE_LABEL)) {
    return { advanced: false };
  }

  const workspace = await ctx.db.get(args.task.workspaceId);
  /* Samme hovedbryter som seed: mangler/undefined = på, eksplisitt false = av. */
  if (workspace?.autoSeedRpaDeliveryTasksOnDevelopment === false) {
    return { advanced: false };
  }

  const parentId = args.task.parentTaskId ?? args.task._id;
  const siblings = await ctx.db
    .query("assessmentTasks")
    .withIndex("by_parent", (q) => q.eq("parentTaskId", parentId))
    .take(50);

  const prepByKind = new Map<PrepSubtaskKind, Doc<"assessmentTasks">>();
  for (const s of siblings) {
    const kind = prepKindOf(s);
    if (kind && !prepByKind.has(kind)) {
      prepByKind.set(kind, s);
    }
  }
  /* Sikre at den aktuelle oppgaven telles som ferdig (patch kan være nyere enn sibling-query). */
  const selfKind = prepKindOf(args.task);
  if (selfKind) {
    prepByKind.set(selfKind, { ...args.task, status: "done" });
  }

  for (const kind of PREP_SUBTASK_KINDS) {
    const row = prepByKind.get(kind);
    if (!row || row.status !== "done") {
      return { advanced: false };
    }
  }

  if (!args.task.assessmentId) {
    return { advanced: false };
  }

  const assessment = await ctx.db.get(args.task.assessmentId);
  if (!assessment) {
    return { advanced: false };
  }

  const status = normalizePipelineStatus(assessment.pipelineStatus);
  if (status !== "prioritized") {
    return { advanced: false };
  }

  const rank = await nextAssessmentKanbanRank(
    ctx,
    assessment.workspaceId,
    "development",
  );
  await ctx.db.patch(assessment._id, {
    pipelineStatus: "development",
    kanbanRank: rank,
    updatedAt: Date.now(),
  });

  const notifyIds = new Set<Id<"users">>();
  for (const s of siblings) {
    for (const uid of s.assigneeUserIds ?? []) {
      notifyIds.add(uid);
    }
    if (s.assigneeUserId) notifyIds.add(s.assigneeUserId);
  }
  for (const uid of args.task.assigneeUserIds ?? []) {
    notifyIds.add(uid);
  }
  if (args.task.assigneeUserId) notifyIds.add(args.task.assigneeUserId);

  const href = `/w/${assessment.workspaceId}/vurderinger/${assessment._id}`;
  for (const uid of notifyIds) {
    if (uid === args.actorUserId) continue;
    await insertUserInAppNotification(ctx, {
      userId: uid,
      title: `Klar for utvikling: «${assessment.title}»`,
      body: "ROS, PDD og tilganger er markert ferdige. Vurderingen er flyttet til Utvikling.",
      href,
    });
  }

  return { advanced: true };
}
