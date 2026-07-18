import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireAssessmentEdit, requireAssessmentRead } from "./lib/access";
import { insertUserInAppNotification } from "./userInAppNotifications";

const NOTE_MAX = 8_000;

function resolveTaskAssigneeIds(task: {
  assigneeUserIds?: Id<"users">[];
  assigneeUserId?: Id<"users">;
}): Id<"users">[] {
  if (task.assigneeUserIds && task.assigneeUserIds.length > 0) {
    return task.assigneeUserIds;
  }
  if (task.assigneeUserId) {
    return [task.assigneeUserId];
  }
  return [];
}

export const listByTask = query({
  args: { taskId: v.id("assessmentTasks") },
  returns: v.array(
    v.object({
      _id: v.id("assessmentTaskNotes"),
      _creationTime: v.number(),
      workspaceId: v.id("workspaces"),
      assessmentId: v.id("assessments"),
      taskId: v.id("assessmentTasks"),
      authorUserId: v.id("users"),
      body: v.string(),
      parentNoteId: v.optional(v.id("assessmentTaskNotes")),
      mentionedUserIds: v.optional(v.array(v.id("users"))),
      createdAt: v.number(),
      authorName: v.string(),
      mentionedNames: v.array(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) return [];
    await requireAssessmentRead(ctx, task.assessmentId);

    const rows = await ctx.db
      .query("assessmentTaskNotes")
      .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
      .collect();
    rows.sort((a, b) => b.createdAt - a.createdAt);

    const out = [];
    for (const r of rows) {
      const u = await ctx.db.get(r.authorUserId);
      const mentionedNames: string[] = [];
      for (const uid of r.mentionedUserIds ?? []) {
        const mu = await ctx.db.get(uid);
        if (mu) mentionedNames.push(mu.name ?? mu.email ?? "Bruker");
      }
      out.push({
        ...r,
        authorName: u?.name ?? u?.email ?? "Bruker",
        mentionedNames,
      });
    }
    return out;
  },
});

export const add = mutation({
  args: {
    taskId: v.id("assessmentTasks"),
    body: v.string(),
    parentNoteId: v.optional(v.id("assessmentTaskNotes")),
    mentionedUserIds: v.optional(v.array(v.id("users"))),
  },
  returns: v.id("assessmentTaskNotes"),
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) {
      throw new Error("Fant ikke saken.");
    }
    const { assessment, userId } = await requireAssessmentEdit(
      ctx,
      task.assessmentId,
    );

    const body = args.body.trim();
    if (!body) {
      throw new Error("Kommentaren er tom.");
    }
    if (body.length > NOTE_MAX) {
      throw new Error(`Kommentaren kan ikke overstige ${NOTE_MAX} tegn.`);
    }

    let parentNoteId = args.parentNoteId;
    let notifyParentAuthor: Id<"users"> | null = null;
    if (parentNoteId) {
      const parent = await ctx.db.get(parentNoteId);
      if (!parent || parent.taskId !== args.taskId) {
        throw new Error("Tråden finnes ikke på denne saken.");
      }
      if (parent.parentNoteId) {
        parentNoteId = parent.parentNoteId;
        const root = await ctx.db.get(parentNoteId);
        if (root && root.authorUserId !== userId) {
          notifyParentAuthor = root.authorUserId;
        }
      } else if (parent.authorUserId !== userId) {
        notifyParentAuthor = parent.authorUserId;
      }
    }

    const mentioned = [...new Set(args.mentionedUserIds ?? [])].slice(0, 20);
    const now = Date.now();
    const noteId = await ctx.db.insert("assessmentTaskNotes", {
      workspaceId: assessment.workspaceId,
      assessmentId: task.assessmentId,
      taskId: args.taskId,
      authorUserId: userId,
      body,
      parentNoteId,
      mentionedUserIds: mentioned.length > 0 ? mentioned : undefined,
      createdAt: now,
    });

    const taskTitle = task.title.trim() || "sak";
    const href = `/w/${assessment.workspaceId}/puls?task=${args.taskId}`;

    /** Varsle: @-taggede, tildelte på saken, og tråd-eier ved svar */
    const notifyIds = new Set<Id<"users">>(mentioned);
    for (const uid of resolveTaskAssigneeIds(task)) {
      notifyIds.add(uid);
    }
    if (notifyParentAuthor) notifyIds.add(notifyParentAuthor);

    for (const uid of notifyIds) {
      if (uid === userId) continue;
      const isMention = mentioned.includes(uid);
      const isAssignee =
        !isMention && resolveTaskAssigneeIds(task).includes(uid);
      await insertUserInAppNotification(ctx, {
        userId: uid,
        title: isMention
          ? `Du ble nevnt i «${taskTitle}»`
          : isAssignee
            ? `Ny kommentar på «${taskTitle}»`
            : `Nytt svar i «${taskTitle}»`,
        body: body.length > 160 ? `${body.slice(0, 157)}…` : body,
        href,
      });
    }

    return noteId;
  },
});
