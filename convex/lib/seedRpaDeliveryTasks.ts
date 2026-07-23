import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { PipelineStatus } from "../../lib/assessment-pipeline";
import {
  buildRpaDeliveryDescription,
  buildRpaDeliverySubtaskDescription,
  type RpaDeliveryContext,
} from "../../lib/rpa-delivery-task-template";
import { ensureDefaultColumns } from "../pulsBoardColumns";
import { ensureDefaultPulsBoard } from "../pulsBoards";
import { buildAssigneeStates } from "./taskAssignment";
import { insertUserInAppNotification } from "../userInAppNotifications";

/** Label som markerer auto-opprettet leveransepakke (unngår duplikater). */
export const AUTO_LEVERANSE_LABEL = "auto-leveranse";

type SeedResult = {
  created: boolean;
  parentTaskId: Id<"assessmentTasks"> | null;
};

async function userDisplayName(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<string | null> {
  const user = await ctx.db.get(userId);
  if (!user) return null;
  const name = user.name?.trim();
  if (name) return name;
  const email = user.email?.trim();
  return email || null;
}

async function insertTask(
  ctx: MutationCtx,
  args: {
    workspaceId: Id<"workspaces">;
    boardId: Id<"pulsBoards">;
    columnId: Id<"pulsBoardColumns">;
    assessmentId: Id<"assessments">;
    candidateId?: Id<"candidates">;
    rosAnalysisId?: Id<"rosAnalyses">;
    processDesignDocumentId?: Id<"processDesignDocuments">;
    intakeFormId?: Id<"intakeForms">;
    parentTaskId?: Id<"assessmentTasks">;
    title: string;
    description: string;
    labels: string[];
    assigneeUserIds: Id<"users">[];
    actorUserId: Id<"users">;
    now: number;
    priority?: number;
  },
): Promise<Id<"assessmentTasks">> {
  const uniqueIds = [...new Set(args.assigneeUserIds)];
  const assigneeStates =
    uniqueIds.length > 0
      ? buildAssigneeStates({
          assigneeIds: uniqueIds,
          actorUserId: args.actorUserId,
          now: args.now,
        })
      : undefined;

  const taskId = await ctx.db.insert("assessmentTasks", {
    workspaceId: args.workspaceId,
    assessmentId: args.assessmentId,
    candidateId: args.candidateId,
    rosAnalysisId: args.rosAnalysisId,
    processDesignDocumentId: args.processDesignDocumentId,
    intakeFormId: args.intakeFormId,
    boardId: args.boardId,
    columnId: args.columnId,
    title: args.title,
    description: args.description,
    parentTaskId: args.parentTaskId,
    assigneeUserId: uniqueIds[0],
    assigneeUserIds: uniqueIds.length > 0 ? uniqueIds : undefined,
    assigneeStates,
    createdByUserId: args.actorUserId,
    status: "open",
    priority: args.priority ?? 2,
    labels: args.labels,
    dashboardRank: args.now,
    createdAt: args.now,
  });

  const pulsHref = `/w/${args.workspaceId}/tavler/${args.boardId}?task=${taskId}`;
  for (const uid of uniqueIds) {
    if (uid !== args.actorUserId) {
      await insertUserInAppNotification(ctx, {
        userId: uid,
        title: `Du er tildelt «${args.title}»`,
        body: "Auto-opprettet leveranse for vurderingen. Åpne kortet under Tavler.",
        href: pulsHref,
      });
    }
  }

  return taskId;
}

/** Statuser der leveranseforberedelse starter (før aktiv utvikling). */
const SEED_TRIGGER_STATUSES: ReadonlySet<PipelineStatus> = new Set([
  "prioritized",
  "development",
]);

/**
 * Når pipeline går inn i «Prioritert» (eller rett til «Utvikling»):
 * opprett leveransepakke på Puls-tavle før koding — ROS, PDD, tilganger osv.
 */
export async function seedRpaDeliveryTasksIfNeeded(
  ctx: MutationCtx,
  args: {
    assessment: Doc<"assessments">;
    previousStatus: PipelineStatus;
    nextStatus: PipelineStatus;
    actorUserId: Id<"users">;
  },
): Promise<SeedResult> {
  if (!SEED_TRIGGER_STATUSES.has(args.nextStatus)) {
    return { created: false, parentTaskId: null };
  }
  /* Allerede i leveranseløpet — ikke opprett på nytt ved hopp Prioritert → Utvikling. */
  if (SEED_TRIGGER_STATUSES.has(args.previousStatus)) {
    return { created: false, parentTaskId: null };
  }

  const assessmentId = args.assessment._id;
  const workspaceId = args.assessment.workspaceId;

  const workspace = await ctx.db.get(workspaceId);
  /* Mangler/undefined = på (standard). Eksplisitt false = av. */
  if (workspace?.autoSeedRpaDeliveryTasksOnDevelopment === false) {
    return { created: false, parentTaskId: null };
  }

  const existingTasks = await ctx.db
    .query("assessmentTasks")
    .withIndex("by_assessment", (q) => q.eq("assessmentId", assessmentId))
    .take(100);
  const alreadySeeded = existingTasks.some(
    (t) =>
      !t.parentTaskId &&
      (t.labels ?? []).includes(AUTO_LEVERANSE_LABEL) &&
      t.status === "open",
  );
  if (alreadySeeded) {
    return { created: false, parentTaskId: null };
  }

  const link = await ctx.db
    .query("candidateAssessmentLinks")
    .withIndex("by_assessment", (q) => q.eq("assessmentId", assessmentId))
    .first();
  const candidateId = link?.candidateId;

  let developerId: Id<"users"> | undefined;
  let coDeveloperId: Id<"users"> | undefined;
  if (candidateId) {
    const assignees = await ctx.db
      .query("candidateAssignees")
      .withIndex("by_candidate_and_role", (q) =>
        q.eq("candidateId", candidateId).eq("role", "utforende"),
      )
      .collect();
    assignees.sort((a, b) => a.assignedAt - b.assignedAt);
    developerId = assignees[0]?.userId;
    coDeveloperId = assignees[1]?.userId;
  }

  const draft = await ctx.db
    .query("assessmentDrafts")
    .withIndex("by_assessment", (q) => q.eq("assessmentId", assessmentId))
    .unique();
  const payload = draft?.payload;

  const intake = await ctx.db
    .query("intakeSubmissions")
    .withIndex("by_approved_assessment_submitted", (q) =>
      q.eq("approvedAssessmentId", assessmentId),
    )
    .order("desc")
    .first();
  const intakeForm = intake ? await ctx.db.get(intake.formId) : null;

  const rosLink = candidateId
    ? await ctx.db
        .query("candidateRosAnalysisLinks")
        .withIndex("by_candidate", (q) => q.eq("candidateId", candidateId))
        .first()
    : null;
  let ros =
    intake?.approvedRosAnalysisId
      ? await ctx.db.get(intake.approvedRosAnalysisId)
      : null;
  if (!ros && rosLink) {
    ros = await ctx.db.get(rosLink.rosAnalysisId);
  }
  if (!ros) {
    ros = await ctx.db
      .query("rosAnalyses")
      .withIndex("by_assessment", (q) => q.eq("assessmentId", assessmentId))
      .first();
  }

  const pdd = await ctx.db
    .query("processDesignDocuments")
    .withIndex("by_assessment", (q) => q.eq("assessmentId", assessmentId))
    .first();
  const pddPayload = pdd?.payload;
  const applicationNames = (pddPayload?.asIsApplications ?? [])
    .map((a) => a.name.trim())
    .filter(Boolean);
  const uniqueApps = [...new Set(applicationNames)];

  const developerName = developerId
    ? await userDisplayName(ctx, developerId)
    : null;
  const coDeveloperName = coDeveloperId
    ? await userDisplayName(ctx, coDeveloperId)
    : null;

  const intakeRiskLines = (intake?.generatedRosSuggestion?.risks ?? [])
    .map((r) => {
      const title = r.title?.trim() ?? "";
      const desc = r.description?.trim() ?? "";
      if (title && desc) return `${title}: ${desc}`;
      return title || desc;
    })
    .filter(Boolean)
    .slice(0, 12);

  const deliveryCtx: RpaDeliveryContext = {
    assessmentTitle: args.assessment.title,
    developerName,
    coDeveloperName,
    processSystems: payload?.processSystems?.trim() || null,
    processActors: payload?.processActors?.trim() || null,
    processGoal: payload?.processGoal?.trim() || null,
    processDescription: payload?.processDescription?.trim() || null,
    intakeFormTitle: intakeForm?.title ?? null,
    intakeSubmitter:
      [intake?.submitterMeta?.name, intake?.submitterMeta?.email]
        .filter(Boolean)
        .join(" · ") || null,
    intakeRosSummary: intake?.generatedRosSuggestion?.summary?.trim() || null,
    intakeRiskLines,
    intakePersonData: intake?.personDataSignal === true,
    intakePvvFlags: intake?.generatedPvvFlags ?? [],
    rosTitle: ros?.title ?? null,
    rosStatus: args.assessment.rosStatus ?? null,
    pddExists: Boolean(pdd),
    pddProcessTitle:
      (typeof pddPayload?.processTitle === "string" &&
        pddPayload.processTitle.trim()) ||
      null,
    applicationNames: uniqueApps,
  };

  let boardId = workspace?.rpaDeliveryBoardId;
  if (boardId) {
    const configured = await ctx.db.get(boardId);
    if (!configured || configured.workspaceId !== workspaceId) {
      boardId = undefined;
    }
  }
  if (!boardId) {
    boardId = await ensureDefaultPulsBoard(
      ctx,
      workspaceId,
      args.actorUserId,
    );
  }
  const board = await ctx.db.get(boardId);
  if (!board) {
    throw new Error("Kunne ikke finne Puls-tavle for leveranseoppgaver.");
  }
  const cols = await ensureDefaultColumns(ctx, board);
  const openCols = cols.filter((c) => !c.isDone);
  const columnId = openCols[1]?._id ?? openCols[0]?._id;
  if (!columnId) {
    throw new Error("Tavlen mangler åpne kolonner.");
  }

  const now = Date.now();
  const teamAssignees = [developerId, coDeveloperId].filter(
    (id): id is Id<"users"> => id !== undefined,
  );
  const labels = [
    AUTO_LEVERANSE_LABEL,
    "rpa",
    "leveranse",
    ...(developerName ? [`utvikler:${developerName}`] : []),
    ...(coDeveloperName ? [`coutvikler:${coDeveloperName}`] : []),
  ];

  const parentTaskId = await insertTask(ctx, {
    workspaceId,
    boardId,
    columnId,
    assessmentId,
    candidateId,
    rosAnalysisId: ros?._id,
    processDesignDocumentId: pdd?._id,
    intakeFormId: intake?.formId,
    title: `Leveranse: ${args.assessment.title}`,
    description: buildRpaDeliveryDescription(deliveryCtx),
    labels,
    assigneeUserIds: teamAssignees,
    actorUserId: args.actorUserId,
    now,
    priority: 1,
  });

  const subtasks: Array<{
    kind: "ros" | "pdd" | "tilganger" | "utvikling" | "prodsetting";
    title: string;
    assignees: Id<"users">[];
    priority: number;
  }> = [
    {
      kind: "ros",
      title: `ROS: ${args.assessment.title}`,
      assignees: teamAssignees,
      priority: 1,
    },
    {
      kind: "pdd",
      title: `PDD: ${args.assessment.title}`,
      assignees: teamAssignees,
      priority: 1,
    },
    {
      kind: "tilganger",
      title: `Tilganger: ${args.assessment.title}`,
      assignees: teamAssignees,
      priority: 2,
    },
    {
      kind: "utvikling",
      title: `Utvikling & test: ${args.assessment.title}`,
      assignees: teamAssignees,
      priority: 2,
    },
    {
      kind: "prodsetting",
      title: `Prodsetting & drift: ${args.assessment.title}`,
      assignees: teamAssignees,
      priority: 3,
    },
  ];

  let offset = 1;
  for (const sub of subtasks) {
    await insertTask(ctx, {
      workspaceId,
      boardId,
      columnId,
      assessmentId,
      candidateId,
      rosAnalysisId: ros?._id,
      processDesignDocumentId: pdd?._id,
      intakeFormId: intake?.formId,
      parentTaskId,
      title: sub.title,
      description: buildRpaDeliverySubtaskDescription(sub.kind, deliveryCtx),
      labels: [AUTO_LEVERANSE_LABEL, sub.kind],
      assigneeUserIds: sub.assignees,
      actorUserId: args.actorUserId,
      now: now + offset,
      priority: sub.priority,
    });
    offset += 1;
  }

  return { created: true, parentTaskId };
}
