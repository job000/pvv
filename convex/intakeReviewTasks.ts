import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUserId, requireWorkspaceMember } from "./lib/access";
import { buildAssigneeStates } from "./lib/taskAssignment";
import { insertUserInAppNotification } from "./userInAppNotifications";

const requestKindValidator = v.union(
  v.literal("review"),
  v.literal("decide"),
  v.literal("general"),
);

function clampPriority(p: number | undefined): number {
  if (p === undefined) return 3;
  return Math.min(5, Math.max(1, Math.round(p)));
}

function defaultTitle(
  kind: "review" | "decide" | "general",
  proposalTitle: string,
): string {
  const t = proposalTitle.trim() || "forslag";
  switch (kind) {
    case "decide":
      return `Godkjenn eller avslå: ${t}`;
    case "review":
      return `Gjennomgå forslag: ${t}`;
    default:
      return `Oppgave om forslag: ${t}`;
  }
}

function defaultNotifyBody(
  kind: "review" | "decide" | "general",
  proposalTitle: string,
): string {
  const t = proposalTitle.trim() || "forslaget";
  switch (kind) {
    case "decide":
      return `Du er bedt om å godkjenne eller avslå «${t}». Åpne under Oppgaver eller Skjemaer.`;
    case "review":
      return `Du er bedt om å gjennomgå «${t}». Åpne under Oppgaver.`;
    default:
      return `Du er tildelt en oppgave knyttet til «${t}».`;
  }
}

export const listBySubmission = query({
  args: { submissionId: v.id("intakeSubmissions") },
  returns: v.array(
    v.object({
      _id: v.id("intakeReviewTasks"),
      title: v.string(),
      description: v.optional(v.string()),
      requestKind: requestKindValidator,
      status: v.union(v.literal("open"), v.literal("done")),
      priority: v.number(),
      dueAt: v.optional(v.number()),
      createdAt: v.number(),
      createdByName: v.string(),
      assignees: v.array(
        v.object({
          userId: v.id("users"),
          name: v.string(),
          status: v.union(
            v.literal("pending"),
            v.literal("accepted"),
            v.literal("declined"),
            v.literal("done"),
          ),
        }),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const submission = await ctx.db.get(args.submissionId);
    if (!submission) return [];
    await requireWorkspaceMember(ctx, submission.workspaceId, userId, "viewer");
    const rows = await ctx.db
      .query("intakeReviewTasks")
      .withIndex("by_submission", (q) =>
        q.eq("submissionId", args.submissionId),
      )
      .collect();
    rows.sort((a, b) => b.createdAt - a.createdAt);
    const out = [];
    for (const row of rows) {
      const creator = await ctx.db.get(row.createdByUserId);
      const ids =
        row.assigneeUserIds && row.assigneeUserIds.length > 0
          ? row.assigneeUserIds
          : row.assigneeUserId
            ? [row.assigneeUserId]
            : [];
      const assignees = [];
      for (const uid of ids) {
        const u = await ctx.db.get(uid);
        const st =
          row.assigneeStates?.find((s) => s.userId === uid)?.status ??
          (row.status === "done" ? "done" : "accepted");
        assignees.push({
          userId: uid,
          name: u?.name ?? u?.email ?? "Bruker",
          status: st as "pending" | "accepted" | "declined" | "done",
        });
      }
      out.push({
        _id: row._id,
        title: row.title,
        description: row.description,
        requestKind: row.requestKind,
        status: row.status,
        priority: clampPriority(row.priority),
        dueAt: row.dueAt,
        createdAt: row.createdAt,
        createdByName: creator?.name ?? creator?.email ?? "Bruker",
        assignees,
      });
    }
    return out;
  },
});

export const create = mutation({
  args: {
    submissionId: v.id("intakeSubmissions"),
    assigneeUserIds: v.array(v.id("users")),
    requestKind: requestKindValidator,
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    priority: v.optional(v.number()),
    dueAt: v.optional(v.number()),
  },
  returns: v.id("intakeReviewTasks"),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const submission = await ctx.db.get(args.submissionId);
    if (!submission) throw new Error("Fant ikke forslaget.");
    await requireWorkspaceMember(ctx, submission.workspaceId, userId, "member");

    if (
      submission.status === "approved" ||
      submission.status === "rejected"
    ) {
      throw new Error("Forslaget er allerede avsluttet.");
    }

    const uniqueIds = [...new Set(args.assigneeUserIds)];
    if (uniqueIds.length === 0) {
      throw new Error("Velg minst én person å tildele.");
    }
    for (const uid of uniqueIds) {
      try {
        await requireWorkspaceMember(
          ctx,
          submission.workspaceId,
          uid,
          "viewer",
        );
      } catch {
        throw new Error("En av de valgte er ikke medlem av arbeidsområdet.");
      }
    }

    const proposalTitle = submission.generatedAssessmentDraft.title;
    const title =
      args.title?.trim() || defaultTitle(args.requestKind, proposalTitle);
    const description = args.description?.trim() || undefined;
    const now = Date.now();
    const assigneeStates = buildAssigneeStates({
      assigneeIds: uniqueIds,
      actorUserId: userId,
      now,
    });

    if (submission.status === "submitted") {
      await ctx.db.patch(args.submissionId, {
        status: "under_review",
        reviewedAt: now,
        reviewedByUserId: userId,
      });
    }

    const taskId = await ctx.db.insert("intakeReviewTasks", {
      workspaceId: submission.workspaceId,
      submissionId: args.submissionId,
      title,
      description,
      requestKind: args.requestKind,
      assigneeUserId: uniqueIds[0],
      assigneeUserIds: uniqueIds,
      assigneeStates,
      createdByUserId: userId,
      status: "open",
      priority: clampPriority(args.priority),
      dueAt: args.dueAt,
      createdAt: now,
    });

    const tasksHref = `/w/${submission.workspaceId}/oppgaver`;
    const forslagHref = `/w/${submission.workspaceId}/skjemaer?forslag=${args.submissionId}`;
    for (const uid of uniqueIds) {
      if (uid === userId) continue;
      await insertUserInAppNotification(ctx, {
        userId: uid,
        title: `Ny oppgave: ${title}`,
        body: defaultNotifyBody(args.requestKind, proposalTitle),
        href: args.requestKind === "decide" ? forslagHref : tasksHref,
      });
    }

    return taskId;
  },
});
