import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { canReadAssessment, requireUserId, requireWorkspaceMember } from "./lib/access";
import {
  assignmentStatusValidator,
  resolveAssignerUserId,
  resolveMyAssignmentStatus,
  returnAssigneeToAssigner,
  upsertAssigneeState,
  type AssignmentStatus,
  type AssigneeState,
} from "./lib/taskAssignment";
import { insertUserInAppNotification } from "./userInAppNotifications";

function resolveAssessmentAssigneeIds(row: Doc<"assessmentTasks">): Id<"users">[] {
  if (row.assigneeUserIds && row.assigneeUserIds.length > 0) {
    return row.assigneeUserIds;
  }
  if (row.assigneeUserId) return [row.assigneeUserId];
  return [];
}

function resolveRosAssigneeIds(row: Doc<"rosTasks">): Id<"users">[] {
  if (row.assigneeUserIds && row.assigneeUserIds.length > 0) {
    return row.assigneeUserIds;
  }
  if (row.assigneeUserId) return [row.assigneeUserId];
  return [];
}

function resolveIntakeAssigneeIds(row: Doc<"intakeReviewTasks">): Id<"users">[] {
  if (row.assigneeUserIds && row.assigneeUserIds.length > 0) {
    return row.assigneeUserIds;
  }
  if (row.assigneeUserId) return [row.assigneeUserId];
  return [];
}

function clampPriority(p: number | undefined): number {
  if (p === undefined) return 3;
  return Math.min(5, Math.max(1, Math.round(p)));
}

async function userDisplayName(
  ctx: { db: { get: (id: Id<"users">) => Promise<Doc<"users"> | null> } },
  userId: Id<"users">,
): Promise<string> {
  const u = await ctx.db.get(userId);
  return u?.name ?? u?.email ?? "Ukjent";
}

const workDetailFieldValidator = v.object({
  label: v.string(),
  value: v.string(),
});

const workPreviewValidator = v.object({
  kindLabel: v.string(),
  workHref: v.string(),
  workLabel: v.string(),
  fields: v.array(workDetailFieldValidator),
  /** ROS-behandling som kan fullføres i dialogen */
  rosTreatment: v.optional(
    v.object({
      kind: v.union(
        v.literal("mitigate"),
        v.literal("accept"),
        v.literal("transfer"),
        v.literal("avoid"),
      ),
      kindLabel: v.string(),
      justificationRequired: v.boolean(),
      justificationLabel: v.string(),
      justificationValue: v.string(),
      dateLabel: v.string(),
      dueAt: v.optional(v.number()),
      linkedRiskSummary: v.union(v.string(), v.null()),
    }),
  ),
});

const workspaceTaskItemValidator = v.object({
  kind: v.union(
    v.literal("assessment"),
    v.literal("ros"),
    v.literal("intake"),
  ),
  taskId: v.string(),
  title: v.string(),
  description: v.optional(v.string()),
  status: v.union(v.literal("open"), v.literal("done")),
  myStatus: assignmentStatusValidator,
  priority: v.number(),
  dueAt: v.optional(v.number()),
  createdAt: v.number(),
  href: v.string(),
  contextTitle: v.string(),
  /** Innlogget bruker (den oppgaven er tildelt). */
  assigneeName: v.string(),
  assigneeUserId: v.id("users"),
  /** Den som tildelte denne brukeren (returneres hit). */
  assignerName: v.string(),
  assignerUserId: v.id("users"),
  creatorName: v.union(v.string(), v.null()),
  createdByUserId: v.id("users"),
  work: workPreviewValidator,
});

const TREATMENT_LABEL: Record<
  "mitigate" | "accept" | "transfer" | "avoid",
  string
> = {
  mitigate: "Reduser",
  accept: "Akseptere",
  transfer: "Overføre",
  avoid: "Unngå",
};

function findLinkedRiskText(
  analysis: Doc<"rosAnalyses">,
  cellItemId: string,
  phase: "before" | "after",
): string | null {
  const matrix = phase === "before" ? analysis.cellItems : analysis.cellItemsAfter;
  if (!Array.isArray(matrix)) return null;
  for (const row of matrix) {
    if (!Array.isArray(row)) continue;
    for (const cell of row) {
      if (!Array.isArray(cell)) continue;
      for (const it of cell) {
        if (
          it &&
          typeof it === "object" &&
          "id" in it &&
          (it as { id: string }).id === cellItemId &&
          "text" in it
        ) {
          const text = String((it as { text: unknown }).text ?? "").trim();
          return text || null;
        }
      }
    }
  }
  return null;
}

export const listMyInWorkspace = query({
  args: { workspaceId: v.id("workspaces") },
  returns: v.object({
    mine: v.array(workspaceTaskItemValidator),
    assignedByMe: v.array(
      v.object({
        kind: v.union(
          v.literal("assessment"),
          v.literal("ros"),
          v.literal("intake"),
        ),
        taskId: v.string(),
        title: v.string(),
        description: v.optional(v.string()),
        status: v.union(v.literal("open"), v.literal("done")),
        priority: v.number(),
        dueAt: v.optional(v.number()),
        createdAt: v.number(),
        href: v.string(),
        contextTitle: v.string(),
        assignees: v.array(
          v.object({
            userId: v.id("users"),
            name: v.string(),
            status: assignmentStatusValidator,
          }),
        ),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireWorkspaceMember(ctx, args.workspaceId, userId, "viewer");
    const meName = await userDisplayName(ctx, userId);

    const assessmentTasks = await ctx.db
      .query("assessmentTasks")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    const rosTasks = await ctx.db
      .query("rosTasks")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    const intakeTasks = await ctx.db
      .query("intakeReviewTasks")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    type WorkPreview = {
      kindLabel: string;
      workHref: string;
      workLabel: string;
      fields: { label: string; value: string }[];
      rosTreatment?: {
        kind: "mitigate" | "accept" | "transfer" | "avoid";
        kindLabel: string;
        justificationRequired: boolean;
        justificationLabel: string;
        justificationValue: string;
        dateLabel: string;
        dueAt?: number;
        linkedRiskSummary: string | null;
      };
    };

    type MineItem = {
      kind: "assessment" | "ros" | "intake";
      taskId: string;
      title: string;
      description?: string;
      status: "open" | "done";
      myStatus: AssignmentStatus;
      priority: number;
      dueAt?: number;
      createdAt: number;
      href: string;
      contextTitle: string;
      assigneeName: string;
      assigneeUserId: Id<"users">;
      assignerName: string;
      assignerUserId: Id<"users">;
      creatorName: string | null;
      createdByUserId: Id<"users">;
      work: WorkPreview;
    };

    type AssignedByMeItem = {
      kind: "assessment" | "ros" | "intake";
      taskId: string;
      title: string;
      description?: string;
      status: "open" | "done";
      priority: number;
      dueAt?: number;
      createdAt: number;
      href: string;
      contextTitle: string;
      assignees: {
        userId: Id<"users">;
        name: string;
        status: AssignmentStatus;
      }[];
    };

    const mine: MineItem[] = [];
    const assignedByMe: AssignedByMeItem[] = [];

    for (const t of assessmentTasks) {
      const assessment = await ctx.db.get(t.assessmentId);
      if (!assessment) continue;
      if (!(await canReadAssessment(ctx, assessment, userId))) continue;
      const ids = resolveAssessmentAssigneeIds(t);
      const states = t.assigneeStates as AssigneeState[] | undefined;
      const contextTitle = assessment.title.trim() || "Vurdering";
      const href = `/w/${args.workspaceId}/a/${t.assessmentId}`;
      const myStatus = resolveMyAssignmentStatus(ids, states, userId, t.status);
      if (myStatus) {
        const assignerUserId = resolveAssignerUserId(
          states,
          userId,
          t.createdByUserId,
        );
        const assignerName = await userDisplayName(ctx, assignerUserId);
        const creator = await ctx.db.get(t.createdByUserId);
        const fields = [
          { label: "Vurdering", value: contextTitle },
          { label: "Tildelt til", value: meName },
          { label: "Tildelt av", value: assignerName },
          { label: "Prioritet", value: `P${clampPriority(t.priority)}` },
        ];
        if (t.dueAt) {
          fields.push({
            label: "Frist",
            value: new Date(t.dueAt).toLocaleString("nb-NO"),
          });
        }
        if (t.description?.trim()) {
          fields.push({ label: "Beskrivelse", value: t.description.trim() });
        }
        mine.push({
          kind: "assessment",
          taskId: t._id,
          title: t.title,
          description: t.description,
          status: t.status,
          myStatus,
          priority: clampPriority(t.priority),
          dueAt: t.dueAt,
          createdAt: t.createdAt,
          href,
          contextTitle,
          assigneeName: meName,
          assigneeUserId: userId,
          assignerName,
          assignerUserId,
          creatorName: creator?.name ?? creator?.email ?? null,
          createdByUserId: t.createdByUserId,
          work: {
            kindLabel: "Vurdering",
            workHref: href,
            workLabel: "Åpne vurdering",
            fields,
          },
        });
      }
      const iAssignedSomeone = ids.some((uid) => {
        if (uid === userId) return false;
        const st = states?.find((s) => s.userId === uid);
        return (st?.assignedByUserId ?? t.createdByUserId) === userId;
      });
      if ((t.createdByUserId === userId || iAssignedSomeone) && ids.length > 0) {
        const assignees = [];
        for (const uid of ids) {
          const st =
            resolveMyAssignmentStatus(ids, states, uid, t.status) ?? "accepted";
          assignees.push({
            userId: uid,
            name: await userDisplayName(ctx, uid),
            status: st,
          });
        }
        assignedByMe.push({
          kind: "assessment",
          taskId: t._id,
          title: t.title,
          description: t.description,
          status: t.status,
          priority: clampPriority(t.priority),
          dueAt: t.dueAt,
          createdAt: t.createdAt,
          href,
          contextTitle,
          assignees,
        });
      }
    }

    for (const t of rosTasks) {
      const analysis = await ctx.db.get(t.rosAnalysisId);
      if (!analysis || analysis.workspaceId !== args.workspaceId) continue;
      const ids = resolveRosAssigneeIds(t);
      const states = t.assigneeStates as AssigneeState[] | undefined;
      const contextTitle = analysis.title?.trim() || "ROS-analyse";
      const href = `/w/${args.workspaceId}/ros/a/${t.rosAnalysisId}?seksjon=oppgaver`;
      const myStatus = resolveMyAssignmentStatus(ids, states, userId, t.status);
      if (myStatus) {
        const assignerUserId = resolveAssignerUserId(
          states,
          userId,
          t.createdByUserId,
        );
        const assignerName = await userDisplayName(ctx, assignerUserId);
        const creator = await ctx.db.get(t.createdByUserId);
        const linkedRiskSummary =
          t.linkedCellItemId && t.linkedCellItemPhase
            ? findLinkedRiskText(
                analysis,
                t.linkedCellItemId,
                t.linkedCellItemPhase,
              )
            : null;
        const treatment = t.riskTreatmentKind;
        const fields = [
          { label: "ROS-analyse", value: contextTitle },
          { label: "Tildelt til", value: meName },
          { label: "Tildelt av", value: assignerName },
          { label: "Prioritet", value: `P${clampPriority(t.priority)}` },
        ];
        if (treatment) {
          fields.push({
            label: "Strategi",
            value: TREATMENT_LABEL[treatment],
          });
        }
        if (linkedRiskSummary) {
          fields.push({ label: "Koblet risiko", value: linkedRiskSummary });
        }
        if (t.dueAt) {
          fields.push({
            label:
              treatment === "accept" ? "Neste gjennomgang" : "Frist",
            value: new Date(t.dueAt).toLocaleString("nb-NO"),
          });
        }
        if (t.description?.trim()) {
          fields.push({ label: "Beskrivelse", value: t.description.trim() });
        }
        if (t.residualRiskAcceptedNote?.trim()) {
          fields.push({
            label: "Begrunnelse",
            value: t.residualRiskAcceptedNote.trim(),
          });
        }
        const needsJust =
          treatment === "accept" ||
          treatment === "transfer" ||
          treatment === "avoid";
        mine.push({
          kind: "ros",
          taskId: t._id,
          title: t.title,
          description: t.description,
          status: t.status,
          myStatus,
          priority: clampPriority(t.priority),
          dueAt: t.dueAt,
          createdAt: t.createdAt,
          href,
          contextTitle,
          assigneeName: meName,
          assigneeUserId: userId,
          assignerName,
          assignerUserId,
          creatorName: creator?.name ?? creator?.email ?? null,
          createdByUserId: t.createdByUserId,
          work: {
            kindLabel: "ROS",
            workHref: href,
            workLabel: "Åpne i ROS",
            fields,
            rosTreatment: treatment
              ? {
                  kind: treatment,
                  kindLabel: TREATMENT_LABEL[treatment],
                  justificationRequired: needsJust,
                  justificationLabel:
                    treatment === "accept"
                      ? "Grunnlag for aksept"
                      : "Begrunnelse",
                  justificationValue: t.residualRiskAcceptedNote ?? "",
                  dateLabel:
                    treatment === "accept"
                      ? "Neste gjennomgang"
                      : treatment === "transfer"
                        ? "Skal være aktiv innen"
                        : treatment === "avoid"
                          ? "Stoppet/endret innen"
                          : "Ferdig innen",
                  dueAt: t.dueAt,
                  linkedRiskSummary,
                }
              : undefined,
          },
        });
      }
      const iAssignedSomeone = ids.some((uid) => {
        if (uid === userId) return false;
        const st = states?.find((s) => s.userId === uid);
        return (st?.assignedByUserId ?? t.createdByUserId) === userId;
      });
      if ((t.createdByUserId === userId || iAssignedSomeone) && ids.length > 0) {
        const assignees = [];
        for (const uid of ids) {
          const st =
            resolveMyAssignmentStatus(ids, states, uid, t.status) ?? "accepted";
          assignees.push({
            userId: uid,
            name: await userDisplayName(ctx, uid),
            status: st,
          });
        }
        assignedByMe.push({
          kind: "ros",
          taskId: t._id,
          title: t.title,
          description: t.description,
          status: t.status,
          priority: clampPriority(t.priority),
          dueAt: t.dueAt,
          createdAt: t.createdAt,
          href,
          contextTitle,
          assignees,
        });
      }
    }

    for (const t of intakeTasks) {
      const submission = await ctx.db.get(t.submissionId);
      if (!submission || submission.workspaceId !== args.workspaceId) continue;
      const ids = resolveIntakeAssigneeIds(t);
      const states = t.assigneeStates as AssigneeState[] | undefined;
      const contextTitle =
        submission.generatedAssessmentDraft.title.trim() || "Skjemaforslag";
      const href = `/w/${args.workspaceId}/skjemaer?forslag=${t.submissionId}`;
      const myStatus = resolveMyAssignmentStatus(ids, states, userId, t.status);
      const requestLabel =
        t.requestKind === "decide"
          ? "Godkjenning / avslag"
          : t.requestKind === "review"
            ? "Gjennomgang"
            : "Oppgave";
      if (myStatus) {
        const assignerUserId = resolveAssignerUserId(
          states,
          userId,
          t.createdByUserId,
        );
        const assignerName = await userDisplayName(ctx, assignerUserId);
        const creator = await ctx.db.get(t.createdByUserId);
        const fields = [
          { label: "Forslag", value: contextTitle },
          { label: "Type", value: requestLabel },
          { label: "Tildelt til", value: meName },
          { label: "Tildelt av", value: assignerName },
          { label: "Prioritet", value: `P${clampPriority(t.priority)}` },
        ];
        if (t.dueAt) {
          fields.push({
            label: "Frist",
            value: new Date(t.dueAt).toLocaleString("nb-NO"),
          });
        }
        if (t.description?.trim()) {
          fields.push({ label: "Melding", value: t.description.trim() });
        }
        mine.push({
          kind: "intake",
          taskId: t._id,
          title: t.title,
          description: t.description,
          status: t.status,
          myStatus,
          priority: clampPriority(t.priority),
          dueAt: t.dueAt,
          createdAt: t.createdAt,
          href,
          contextTitle,
          assigneeName: meName,
          assigneeUserId: userId,
          assignerName,
          assignerUserId,
          creatorName: creator?.name ?? creator?.email ?? null,
          createdByUserId: t.createdByUserId,
          work: {
            kindLabel: "Forslag",
            workHref: href,
            workLabel:
              t.requestKind === "decide"
                ? "Åpne og avgjør"
                : "Åpne forslag",
            fields,
          },
        });
      }
      const iAssignedSomeone = ids.some((uid) => {
        if (uid === userId) return false;
        const st = states?.find((s) => s.userId === uid);
        return (st?.assignedByUserId ?? t.createdByUserId) === userId;
      });
      if ((t.createdByUserId === userId || iAssignedSomeone) && ids.length > 0) {
        const assignees = [];
        for (const uid of ids) {
          const st =
            resolveMyAssignmentStatus(ids, states, uid, t.status) ?? "accepted";
          assignees.push({
            userId: uid,
            name: await userDisplayName(ctx, uid),
            status: st,
          });
        }
        assignedByMe.push({
          kind: "intake",
          taskId: t._id,
          title: t.title,
          description: t.description,
          status: t.status,
          priority: clampPriority(t.priority),
          dueAt: t.dueAt,
          createdAt: t.createdAt,
          href,
          contextTitle,
          assignees,
        });
      }
    }

    const sortMine = (a: MineItem, b: MineItem) => {
      const order: Record<AssignmentStatus, number> = {
        pending: 0,
        accepted: 1,
        done: 2,
        declined: 3,
      };
      if (order[a.myStatus] !== order[b.myStatus]) {
        return order[a.myStatus] - order[b.myStatus];
      }
      if (a.priority !== b.priority) return a.priority - b.priority;
      return b.createdAt - a.createdAt;
    };
    mine.sort(sortMine);
    assignedByMe.sort((a, b) => {
      if (a.status !== b.status) return a.status === "open" ? -1 : 1;
      if (a.priority !== b.priority) return a.priority - b.priority;
      return b.createdAt - a.createdAt;
    });

    return { mine, assignedByMe };
  },
});

export const respond = mutation({
  args: {
    kind: v.union(
      v.literal("assessment"),
      v.literal("ros"),
      v.literal("intake"),
    ),
    taskId: v.string(),
    action: v.union(
      v.literal("accept"),
      v.literal("decline"),
      v.literal("complete"),
      v.literal("reopen"),
    ),
    /** Begrunnelse ved returnering */
    note: v.optional(v.string()),
    /** Begrunnelse ved utført (ROS-aksept m.m.) */
    completionJustification: v.optional(v.string()),
    /** Oppdatert frist / neste gjennomgang ved utført */
    completionDueAt: v.optional(v.union(v.number(), v.null())),
  },
  returns: v.object({
    ok: v.literal(true),
  }),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const now = Date.now();
    const note = args.note?.trim();
    const completionJustification = args.completionJustification?.trim();
    const myName = await userDisplayName(ctx, userId);

    if (args.kind === "intake") {
      const taskId = args.taskId as Id<"intakeReviewTasks">;
      const row = await ctx.db.get(taskId);
      if (!row) throw new Error("Fant ikke oppgaven.");
      await requireWorkspaceMember(ctx, row.workspaceId, userId, "viewer");
      const ids = resolveIntakeAssigneeIds(row);
      if (!ids.includes(userId)) {
        throw new Error("Du er ikke tildelt denne oppgaven.");
      }
      const states = row.assigneeStates as AssigneeState[] | undefined;
      const submission = await ctx.db.get(row.submissionId);
      const contextTitle =
        submission?.generatedAssessmentDraft.title.trim() || "skjemaforslag";
      const href = `/w/${row.workspaceId}/oppgaver`;
      const assignerUserId = resolveAssignerUserId(
        states,
        userId,
        row.createdByUserId,
      );

      if (args.action === "accept") {
        await ctx.db.patch(taskId, {
          assigneeStates: upsertAssigneeState(states, userId, "accepted", now),
        });
      } else if (args.action === "decline") {
        const returned = returnAssigneeToAssigner({
          assigneeIds: ids,
          states,
          returningUserId: userId,
          assignerUserId,
          now,
        });
        await ctx.db.patch(taskId, {
          status: "open",
          assigneeUserIds: returned.assigneeIds,
          assigneeUserId: returned.assigneeIds[0],
          assigneeStates: returned.states,
        });
        if (assignerUserId !== userId) {
          await insertUserInAppNotification(ctx, {
            userId: assignerUserId,
            title: `${myName} returnerte oppgaven «${row.title}» til deg`,
            body: note
              ? `På forslaget «${contextTitle}». Begrunnelse: ${note}`
              : `På forslaget «${contextTitle}». Oppgaven er tilbake hos deg under Oppgaver.`,
            href,
          });
        }
      } else if (args.action === "complete") {
        await ctx.db.patch(taskId, {
          status: "done",
          assigneeStates: upsertAssigneeState(states, userId, "done", now),
        });
        if (assignerUserId !== userId) {
          await insertUserInAppNotification(ctx, {
            userId: assignerUserId,
            title: `${myName} fullførte «${row.title}»`,
            body: `På forslaget «${contextTitle}».`,
            href,
          });
        }
      } else if (args.action === "reopen") {
        if (
          row.status !== "done" &&
          resolveMyAssignmentStatus(ids, states, userId, row.status) !== "done"
        ) {
          throw new Error("Oppgaven er ikke markert som utført.");
        }
        await ctx.db.patch(taskId, {
          status: "open",
          assigneeStates: upsertAssigneeState(states, userId, "accepted", now),
        });
        if (assignerUserId !== userId) {
          await insertUserInAppNotification(ctx, {
            userId: assignerUserId,
            title: `${myName} angret utført på «${row.title}»`,
            body: `På forslaget «${contextTitle}». Oppgaven er åpen igjen.`,
            href,
          });
        }
      } else {
        throw new Error("Ugyldig handling.");
      }
      return { ok: true as const };
    }

    if (args.kind === "assessment") {
      const taskId = args.taskId as Id<"assessmentTasks">;
      const row = await ctx.db.get(taskId);
      if (!row) throw new Error("Fant ikke oppgaven.");
      await requireWorkspaceMember(ctx, row.workspaceId, userId, "viewer");
      const ids = resolveAssessmentAssigneeIds(row);
      if (!ids.includes(userId)) {
        throw new Error("Du er ikke tildelt denne oppgaven.");
      }
      const states = row.assigneeStates as AssigneeState[] | undefined;
      const assessment = await ctx.db.get(row.assessmentId);
      const contextTitle = assessment?.title.trim() || "vurdering";
      const href = `/w/${row.workspaceId}/oppgaver`;
      const assignerUserId = resolveAssignerUserId(
        states,
        userId,
        row.createdByUserId,
      );

      if (args.action === "accept") {
        await ctx.db.patch(taskId, {
          assigneeStates: upsertAssigneeState(states, userId, "accepted", now),
        });
      } else if (args.action === "decline") {
        const returned = returnAssigneeToAssigner({
          assigneeIds: ids,
          states,
          returningUserId: userId,
          assignerUserId,
          now,
        });
        await ctx.db.patch(taskId, {
          status: "open",
          assigneeUserIds: returned.assigneeIds,
          assigneeUserId: returned.assigneeIds[0],
          assigneeStates: returned.states,
        });
        if (assignerUserId !== userId) {
          await insertUserInAppNotification(ctx, {
            userId: assignerUserId,
            title: `${myName} returnerte oppgaven «${row.title}» til deg`,
            body: note
              ? `På «${contextTitle}». Begrunnelse: ${note}`
              : `På «${contextTitle}». Oppgaven er tilbake hos deg under Oppgaver.`,
            href,
          });
        }
      } else if (args.action === "complete") {
        await ctx.db.patch(taskId, {
          status: "done",
          assigneeStates: upsertAssigneeState(states, userId, "done", now),
        });
        if (assignerUserId !== userId) {
          await insertUserInAppNotification(ctx, {
            userId: assignerUserId,
            title: `${myName} fullførte «${row.title}»`,
            body: `På vurderingen «${contextTitle}».`,
            href,
          });
        }
      } else if (args.action === "reopen") {
        if (row.status !== "done" && resolveMyAssignmentStatus(ids, states, userId, row.status) !== "done") {
          throw new Error("Oppgaven er ikke markert som utført.");
        }
        await ctx.db.patch(taskId, {
          status: "open",
          assigneeStates: upsertAssigneeState(states, userId, "accepted", now),
        });
        if (assignerUserId !== userId) {
          await insertUserInAppNotification(ctx, {
            userId: assignerUserId,
            title: `${myName} angret utført på «${row.title}»`,
            body: `På vurderingen «${contextTitle}». Oppgaven er åpen igjen.`,
            href,
          });
        }
      } else {
        throw new Error("Ugyldig handling.");
      }
      return { ok: true as const };
    }

    const taskId = args.taskId as Id<"rosTasks">;
    const row = await ctx.db.get(taskId);
    if (!row) throw new Error("Fant ikke oppgaven.");
    await requireWorkspaceMember(ctx, row.workspaceId, userId, "viewer");
    const ids = resolveRosAssigneeIds(row);
    if (!ids.includes(userId)) {
      throw new Error("Du er ikke tildelt denne oppgaven.");
    }
    const states = row.assigneeStates as AssigneeState[] | undefined;
    const analysis = await ctx.db.get(row.rosAnalysisId);
    const contextTitle = analysis?.title?.trim() || "ROS-analyse";
    const href = `/w/${row.workspaceId}/oppgaver`;
    const assignerUserId = resolveAssignerUserId(
      states,
      userId,
      row.createdByUserId,
    );

    if (args.action === "accept") {
      await ctx.db.patch(taskId, {
        updatedAt: now,
        assigneeStates: upsertAssigneeState(states, userId, "accepted", now),
      });
    } else if (args.action === "decline") {
      const returned = returnAssigneeToAssigner({
        assigneeIds: ids,
        states,
        returningUserId: userId,
        assignerUserId,
        now,
      });
      await ctx.db.patch(taskId, {
        updatedAt: now,
        status: "open",
        assigneeUserIds: returned.assigneeIds,
        assigneeUserId: returned.assigneeIds[0],
        assigneeStates: returned.states,
      });
      if (assignerUserId !== userId) {
        await insertUserInAppNotification(ctx, {
          userId: assignerUserId,
          title: `${myName} returnerte ROS-oppgaven «${row.title}» til deg`,
          body: note
            ? `På «${contextTitle}». Begrunnelse: ${note}`
            : `På «${contextTitle}». Oppgaven er tilbake hos deg under Oppgaver.`,
          href,
        });
      }
    } else if (args.action === "complete") {
      const treatment = row.riskTreatmentKind;
      const needsJust =
        treatment === "accept" ||
        treatment === "transfer" ||
        treatment === "avoid";
      const just =
        completionJustification || row.residualRiskAcceptedNote?.trim() || "";
      if (needsJust && !just) {
        throw new Error(
          treatment === "accept"
            ? "Skriv grunnlag for aksept før du registrerer."
            : "Skriv en begrunnelse før du markerer som utført.",
        );
      }
      // Tillat fullføring direkte fra «pending» (tar imot + utfører i ett steg).
      const patch: Record<string, unknown> = {
        updatedAt: now,
        status: "done",
        assigneeStates: upsertAssigneeState(states, userId, "done", now),
      };
      if (needsJust) {
        patch.residualRiskAcceptedNote = just;
        patch.residualRiskAcceptedAt = now;
      }
      if (args.completionDueAt !== undefined) {
        patch.dueAt =
          args.completionDueAt === null ? undefined : args.completionDueAt;
      }
      await ctx.db.patch(taskId, patch);
      if (assignerUserId !== userId) {
        await insertUserInAppNotification(ctx, {
          userId: assignerUserId,
          title: `${myName} fullførte «${row.title}»`,
          body: `På ROS-analysen «${contextTitle}».`,
          href,
        });
      }
    } else if (args.action === "reopen") {
      if (
        row.status !== "done" &&
        resolveMyAssignmentStatus(ids, states, userId, row.status) !== "done"
      ) {
        throw new Error("Oppgaven er ikke markert som utført.");
      }
      // Angre feilaktig aksept/utført: åpne igjen, behold begrunnelse som utkast.
      await ctx.db.patch(taskId, {
        updatedAt: now,
        status: "open",
        residualRiskAcceptedAt: undefined,
        assigneeStates: upsertAssigneeState(states, userId, "accepted", now),
      });
      if (assignerUserId !== userId) {
        const treatment = row.riskTreatmentKind;
        const undoLabel =
          treatment === "accept"
            ? "angret risikoaksepten"
            : "angret utført";
        await insertUserInAppNotification(ctx, {
          userId: assignerUserId,
          title: `${myName} ${undoLabel} på «${row.title}»`,
          body: `På ROS-analysen «${contextTitle}». Oppgaven er åpen igjen under Oppgaver.`,
          href,
        });
      }
    } else {
      throw new Error("Ugyldig handling.");
    }
    return { ok: true as const };
  },
});
