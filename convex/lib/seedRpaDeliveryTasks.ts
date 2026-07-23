import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { PipelineStatus } from "../../lib/assessment-pipeline";
import {
  buildRpaDeliveryDescription,
  buildRpaDeliverySubtaskDescription,
  type RpaDeliveryContext,
} from "../../lib/rpa-delivery-task-template";
import type { AssessmentPayload } from "../../lib/assessment-types";
import { ensureDefaultColumns } from "../pulsBoardColumns";
import { ensureDefaultPulsBoard } from "../pulsBoards";
import { buildAssigneeStates } from "./taskAssignment";
import { insertUserInAppNotification } from "../userInAppNotifications";
import {
  ensurePddForDelivery,
  ensureRosForDelivery,
} from "./ensureRpaDeliveryArtifacts";

/** Label som markerer auto-opprettet leveransepakke (unngår duplikater). */
export const AUTO_LEVERANSE_LABEL = "auto-leveranse";

type SeedResult = {
  created: boolean;
  parentTaskId: Id<"assessmentTasks"> | null;
  rosCreated: boolean;
  pddCreated: boolean;
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

async function collectRoleAssignees(
  ctx: MutationCtx,
  candidateId: Id<"candidates"> | undefined,
  role: "utforende" | "vurdering" | "ros" | "pdd",
): Promise<Id<"users">[]> {
  if (!candidateId) return [];
  const rows = await ctx.db
    .query("candidateAssignees")
    .withIndex("by_candidate_and_role", (q) =>
      q.eq("candidateId", candidateId).eq("role", role),
    )
    .collect();
  rows.sort((a, b) => a.assignedAt - b.assignedAt);
  return rows.map((r) => r.userId);
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
    /** false = kun opprett; pakkevarsel sendes samlet etterpå */
    notifyAssignees?: boolean;
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

  if (args.notifyAssignees !== false) {
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
 * opprett ROS/PDD ved behov, leveransepakke på Puls, og varsle involverte.
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
  const empty: SeedResult = {
    created: false,
    parentTaskId: null,
    rosCreated: false,
    pddCreated: false,
  };

  if (!SEED_TRIGGER_STATUSES.has(args.nextStatus)) {
    return empty;
  }
  /* Allerede i leveranseløpet — ikke opprett på nytt ved hopp Prioritert → Utvikling. */
  if (SEED_TRIGGER_STATUSES.has(args.previousStatus)) {
    return empty;
  }

  const assessmentId = args.assessment._id;
  const workspaceId = args.assessment.workspaceId;

  const workspace = await ctx.db.get(workspaceId);
  /* Mangler/undefined = på (standard). Eksplisitt false = av. */
  if (workspace?.autoSeedRpaDeliveryTasksOnDevelopment === false) {
    return empty;
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
    return empty;
  }

  const link = await ctx.db
    .query("candidateAssessmentLinks")
    .withIndex("by_assessment", (q) => q.eq("assessmentId", assessmentId))
    .first();
  const candidateId = link?.candidateId;

  const utforende = await collectRoleAssignees(ctx, candidateId, "utforende");
  const vurderingIds = await collectRoleAssignees(ctx, candidateId, "vurdering");
  const rosRoleIds = await collectRoleAssignees(ctx, candidateId, "ros");
  const pddRoleIds = await collectRoleAssignees(ctx, candidateId, "pdd");

  const developerId = utforende[0];
  const coDeveloperId = utforende[1];

  const draft = await ctx.db
    .query("assessmentDrafts")
    .withIndex("by_assessment", (q) => q.eq("assessmentId", assessmentId))
    .unique();
  const payload = draft?.payload as AssessmentPayload | undefined;

  const intake = await ctx.db
    .query("intakeSubmissions")
    .withIndex("by_approved_assessment_submitted", (q) =>
      q.eq("approvedAssessmentId", assessmentId),
    )
    .order("desc")
    .first();
  const intakeForm = intake ? await ctx.db.get(intake.formId) : null;

  const { ros, created: rosCreated } = await ensureRosForDelivery(ctx, {
    assessment: args.assessment,
    actorUserId: args.actorUserId,
    candidateId,
    intake,
    draftPayload: payload,
  });

  const { pdd, created: pddCreated } = await ensurePddForDelivery(ctx, {
    assessment: args.assessment,
    actorUserId: args.actorUserId,
    draftPayload: payload,
    intake,
    rosTitle: ros.title,
  });

  const pddPayload = pdd.payload;
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
    rosTitle: ros.title,
    rosStatus: args.assessment.rosStatus ?? null,
    pddExists: true,
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

  const parentAssignees = [
    ...teamAssignees,
    ...vurderingIds,
  ];

  const parentTaskId = await insertTask(ctx, {
    workspaceId,
    boardId,
    columnId,
    assessmentId,
    candidateId,
    rosAnalysisId: ros._id,
    processDesignDocumentId: pdd._id,
    intakeFormId: intake?.formId,
    title: `Leveranse: ${args.assessment.title}`,
    description: buildRpaDeliveryDescription(deliveryCtx),
    labels,
    assigneeUserIds: parentAssignees,
    actorUserId: args.actorUserId,
    now,
    priority: 1,
    notifyAssignees: false,
  });

  const rosAssignees =
    rosRoleIds.length > 0 ? rosRoleIds : teamAssignees;
  const pddAssignees =
    pddRoleIds.length > 0 ? pddRoleIds : teamAssignees;

  const subtasks: Array<{
    kind: "ros" | "pdd" | "tilganger" | "utvikling" | "prodsetting";
    title: string;
    assignees: Id<"users">[];
    priority: number;
  }> = [
    {
      kind: "ros",
      title: `ROS: ${args.assessment.title}`,
      assignees: rosAssignees,
      priority: 1,
    },
    {
      kind: "pdd",
      title: `PDD: ${args.assessment.title}`,
      assignees: pddAssignees,
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
      rosAnalysisId: ros._id,
      processDesignDocumentId: pdd._id,
      intakeFormId: intake?.formId,
      parentTaskId,
      title: sub.title,
      description: buildRpaDeliverySubtaskDescription(sub.kind, deliveryCtx),
      labels: [AUTO_LEVERANSE_LABEL, sub.kind],
      assigneeUserIds: sub.assignees,
      actorUserId: args.actorUserId,
      now: now + offset,
      priority: sub.priority,
      notifyAssignees: false,
    });
    offset += 1;
  }

  /* Én samlet pakkevarsel til utvikler, coutvikler, vurdering, ROS og PDD. */
  const packNotifyIds = new Set<Id<"users">>([
    ...teamAssignees,
    ...vurderingIds,
    ...rosRoleIds,
    ...pddRoleIds,
  ]);
  const artifactBits = [
    rosCreated ? "ROS opprettet" : "ROS koblet",
    pddCreated ? "PDD opprettet" : "PDD koblet",
    "Puls-leveransepakke klar",
  ].join(" · ");
  const pulsHref = `/w/${workspaceId}/tavler/${boardId}?task=${parentTaskId}`;
  for (const uid of packNotifyIds) {
    if (uid === args.actorUserId) continue;
    const isOwner = vurderingIds.includes(uid);
    await insertUserInAppNotification(ctx, {
      userId: uid,
      title: isOwner
        ? `Prosess prioritert: «${args.assessment.title}»`
        : `Leveranse startet: «${args.assessment.title}»`,
      body: isOwner
        ? `${artifactBits}. Du er knyttet som vurdering/prosesseier — følg leveranseforberedelsen.`
        : `${artifactBits}. Åpne leveransekortet under Tavler.`,
      href: pulsHref,
    });
  }

  return {
    created: true,
    parentTaskId,
    rosCreated,
    pddCreated,
  };
}
