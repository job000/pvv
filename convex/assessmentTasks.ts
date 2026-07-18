import { v } from "convex/values";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Doc, Id } from "./_generated/dataModel";
import {
  canEditAssessment,
  canReadAssessment,
  requireAssessmentEdit,
  requireAssessmentRead,
  requireUserId,
  requireWorkspaceMember,
} from "./lib/access";
import { buildAssigneeStates } from "./lib/taskAssignment";
import { insertUserInAppNotification } from "./userInAppNotifications";

function clampPriority(p: number | undefined): number {
  if (p === undefined) return 3;
  return Math.min(5, Math.max(1, Math.round(p)));
}

function assertDateRange(startAt?: number, dueAt?: number) {
  if (
    startAt !== undefined &&
    dueAt !== undefined &&
    startAt > dueAt
  ) {
    throw new Error("Startdato kan ikke være etter sluttdato.");
  }
}

async function markChildrenDone(
  ctx: MutationCtx,
  parentId: Id<"assessmentTasks">,
) {
  const children = await ctx.db
    .query("assessmentTasks")
    .withIndex("by_parent", (q) => q.eq("parentTaskId", parentId))
    .collect();
  for (const child of children) {
    if (child.status !== "done") {
      await ctx.db.patch(child._id, { status: "done" });
    }
  }
}

function resolveAssigneeIds(row: Doc<"assessmentTasks">): Id<"users">[] {
  if (row.assigneeUserIds && row.assigneeUserIds.length > 0) {
    return row.assigneeUserIds;
  }
  if (row.assigneeUserId) {
    return [row.assigneeUserId];
  }
  return [];
}

async function enrichTask(ctx: QueryCtx, row: Doc<"assessmentTasks">) {
  const ids = resolveAssigneeIds(row);
  const assignees: { userId: Id<"users">; name: string }[] = [];
  for (const uid of ids) {
    const u = await ctx.db.get(uid);
    if (u) assignees.push({ userId: uid, name: u.name ?? u.email ?? String(uid) });
  }
  const creator = await ctx.db.get(row.createdByUserId);
  const githubIssueUrl =
    row.githubRepoFullName !== undefined && row.githubIssueNumber != null
      ? `https://github.com/${row.githubRepoFullName}/issues/${row.githubIssueNumber}`
      : null;

  let parentTitle: string | null = null;
  if (row.parentTaskId) {
    const parent = await ctx.db.get(row.parentTaskId);
    parentTitle = parent?.title ?? null;
  }

  const children = await ctx.db
    .query("assessmentTasks")
    .withIndex("by_parent", (q) => q.eq("parentTaskId", row._id))
    .collect();
  const subIssueCount = children.length;
  const subIssueDoneCount = children.filter((c) => c.status === "done").length;

  return {
    ...row,
    assigneeName: assignees.length > 0 ? assignees.map((a) => a.name).join(", ") : null,
    assignees,
    creatorName: creator?.name ?? creator?.email ?? null,
    githubIssueUrl,
    parentTitle,
    subIssueCount,
    subIssueDoneCount,
  };
}

/**
 * Valider at `child` kan knyttes som sub-issue under `parent`.
 * GitHub-modell: kun ett nivå — forelder må være toppnivå-issue.
 */
async function assertCanSetParent(
  ctx: QueryCtx,
  child: Doc<"assessmentTasks">,
  parentId: Id<"assessmentTasks">,
) {
  if (parentId === child._id) {
    throw new Error("En sak kan ikke være under-sak av seg selv.");
  }
  const parent = await ctx.db.get(parentId);
  if (!parent) {
    throw new Error("Fant ikke hovedsaken.");
  }
  if (parent.assessmentId !== child.assessmentId) {
    throw new Error("Under-sak må være på samme vurdering som hovedsaken.");
  }
  if (parent.parentTaskId) {
    throw new Error(
      "Kan ikke koble under en under-sak. Velg en hovedsak (issue) som ikke selv er under-sak.",
    );
  }
  const childHasChildren = await ctx.db
    .query("assessmentTasks")
    .withIndex("by_parent", (q) => q.eq("parentTaskId", child._id))
    .first();
  if (childHasChildren) {
    throw new Error(
      "Saken har allerede under-saker. Fjern dem eller gjør dem om til hovedsaker først.",
    );
  }
}

export const listByAssessment = query({
  args: { assessmentId: v.id("assessments") },
  handler: async (ctx, args) => {
    await requireAssessmentRead(ctx, args.assessmentId);
    const rows = await ctx.db
      .query("assessmentTasks")
      .withIndex("by_assessment", (q) => q.eq("assessmentId", args.assessmentId))
      .collect();
    rows.sort((a, b) => {
      if (a.status !== b.status) {
        return a.status === "open" ? -1 : 1;
      }
      const pa = clampPriority(a.priority);
      const pb = clampPriority(b.priority);
      if (pa !== pb) return pa - pb;
      return (
        (a.dashboardRank ?? a.createdAt) - (b.dashboardRank ?? b.createdAt)
      );
    });
    const out = [];
    for (const r of rows) {
      out.push(await enrichTask(ctx, r));
    }
    return out;
  },
});

/**
 * Saker-tavle for ett arbeidsområde: hvert issue og hver under-sak er eget kort.
 */
const boardCardValidator = v.object({
  _id: v.id("assessmentTasks"),
  workspaceId: v.id("workspaces"),
  assessmentId: v.id("assessments"),
  title: v.string(),
  description: v.optional(v.string()),
  parentTaskId: v.optional(v.id("assessmentTasks")),
  status: v.union(v.literal("open"), v.literal("done")),
  priority: v.number(),
  startAt: v.optional(v.number()),
  dueAt: v.optional(v.number()),
  dashboardRank: v.optional(v.number()),
  createdAt: v.number(),
  assessmentTitle: v.string(),
  assigneeName: v.union(v.string(), v.null()),
  assignees: v.array(v.object({ userId: v.id("users"), name: v.string() })),
  githubIssueUrl: v.union(v.string(), v.null()),
  parentTitle: v.union(v.string(), v.null()),
  subIssueCount: v.number(),
  subIssueDoneCount: v.number(),
  canEdit: v.boolean(),
});

export const listBoardByWorkspace = query({
  args: { workspaceId: v.id("workspaces") },
  returns: v.array(boardCardValidator),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    await requireWorkspaceMember(ctx, args.workspaceId, userId, "viewer");

    const tasks = await ctx.db
      .query("assessmentTasks")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .take(500);

    const titleById = new Map(tasks.map((t) => [t._id, t.title]));
    const out: Array<{
      _id: Id<"assessmentTasks">;
      workspaceId: Id<"workspaces">;
      assessmentId: Id<"assessments">;
      title: string;
      description?: string;
      parentTaskId?: Id<"assessmentTasks">;
      status: "open" | "done";
      priority: number;
      startAt?: number;
      dueAt?: number;
      dashboardRank?: number;
      createdAt: number;
      assessmentTitle: string;
      assigneeName: string | null;
      assignees: { userId: Id<"users">; name: string }[];
      githubIssueUrl: string | null;
      parentTitle: string | null;
      subIssueCount: number;
      subIssueDoneCount: number;
      canEdit: boolean;
    }> = [];

    for (const t of tasks) {
      const assessment = await ctx.db.get(t.assessmentId);
      if (!assessment) continue;
      if (!(await canReadAssessment(ctx, assessment, userId))) continue;

      const ids = resolveAssigneeIds(t);
      const assignees: { userId: Id<"users">; name: string }[] = [];
      for (const uid of ids) {
        const u = await ctx.db.get(uid);
        if (u)
          assignees.push({
            userId: uid,
            name: u.name ?? u.email ?? String(uid),
          });
      }
      const githubIssueUrl =
        t.githubRepoFullName !== undefined && t.githubIssueNumber != null
          ? `https://github.com/${t.githubRepoFullName}/issues/${t.githubIssueNumber}`
          : null;
      const children = tasks.filter((c) => c.parentTaskId === t._id);

      out.push({
        _id: t._id,
        workspaceId: t.workspaceId,
        assessmentId: t.assessmentId,
        title: t.title,
        description: t.description,
        parentTaskId: t.parentTaskId,
        status: t.status,
        priority: clampPriority(t.priority),
        startAt: t.startAt,
        dueAt: t.dueAt,
        dashboardRank: t.dashboardRank,
        createdAt: t.createdAt,
        assessmentTitle: assessment.title,
        assigneeName:
          assignees.length > 0
            ? assignees.map((a) => a.name).join(", ")
            : null,
        assignees,
        githubIssueUrl,
        parentTitle: t.parentTaskId
          ? (titleById.get(t.parentTaskId) ?? null)
          : null,
        subIssueCount: children.length,
        subIssueDoneCount: children.filter((c) => c.status === "done").length,
        canEdit: await canEditAssessment(ctx, assessment, userId),
      });
    }

    out.sort((a, b) => {
      if (a.status !== b.status) return a.status === "open" ? -1 : 1;
      if (a.priority !== b.priority) return a.priority - b.priority;
      return (a.dashboardRank ?? a.createdAt) - (b.dashboardRank ?? b.createdAt);
    });

    return out;
  },
});

/** Alle oppgaver i arbeidsområder du har tilgang til — for dashboard. */
export const listMineAcrossWorkspaces = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }
    const members = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const enriched: Array<
      Doc<"assessmentTasks"> & {
        assessmentTitle: string;
        workspaceName: string;
        assigneeName: string | null;
        assignees: { userId: Id<"users">; name: string }[];
        githubIssueUrl: string | null;
        parentTitle: string | null;
        subIssueCount: number;
        subIssueDoneCount: number;
      }
    > = [];

    for (const m of members) {
      const tasks = await ctx.db
        .query("assessmentTasks")
        .withIndex("by_workspace", (q) =>
          q.eq("workspaceId", m.workspaceId),
        )
        .collect();
      const ws = await ctx.db.get(m.workspaceId);
      const titleById = new Map(tasks.map((t) => [t._id, t.title]));
      for (const t of tasks) {
        const assessment = await ctx.db.get(t.assessmentId);
        if (!assessment) continue;
        if (!(await canReadAssessment(ctx, assessment, userId))) continue;
        const ids = resolveAssigneeIds(t);
        const assignees: { userId: Id<"users">; name: string }[] = [];
        for (const uid of ids) {
          const u = await ctx.db.get(uid);
          if (u) assignees.push({ userId: uid, name: u.name ?? u.email ?? String(uid) });
        }
        const githubIssueUrl =
          t.githubRepoFullName !== undefined && t.githubIssueNumber != null
            ? `https://github.com/${t.githubRepoFullName}/issues/${t.githubIssueNumber}`
            : null;
        const children = tasks.filter((c) => c.parentTaskId === t._id);
        enriched.push({
          ...t,
          assessmentTitle: assessment.title,
          workspaceName: ws?.name ?? "",
          assigneeName: assignees.length > 0 ? assignees.map((a) => a.name).join(", ") : null,
          assignees,
          githubIssueUrl,
          parentTitle: t.parentTaskId
            ? (titleById.get(t.parentTaskId) ?? null)
            : null,
          subIssueCount: children.length,
          subIssueDoneCount: children.filter((c) => c.status === "done").length,
        });
      }
    }

    enriched.sort((a, b) => {
      if (a.status !== b.status) {
        return a.status === "open" ? -1 : 1;
      }
      const pa = clampPriority(a.priority);
      const pb = clampPriority(b.priority);
      if (pa !== pb) return pa - pb;
      return (
        (a.dashboardRank ?? a.createdAt) - (b.dashboardRank ?? b.createdAt)
      );
    });

    return enriched;
  },
});

export const create = mutation({
  args: {
    assessmentId: v.id("assessments"),
    title: v.string(),
    description: v.optional(v.string()),
    assigneeUserId: v.optional(v.id("users")),
    assigneeUserIds: v.optional(v.array(v.id("users"))),
    priority: v.optional(v.number()),
    startAt: v.optional(v.number()),
    dueAt: v.optional(v.number()),
    /** Opprett direkte som under-sak under denne hovedsaken */
    parentTaskId: v.optional(v.id("assessmentTasks")),
  },
  returns: v.id("assessmentTasks"),
  handler: async (ctx, args) => {
    const { assessment, userId } = await requireAssessmentEdit(
      ctx,
      args.assessmentId,
    );
    const title = args.title.trim();
    if (!title) {
      throw new Error("Oppgavetekst mangler.");
    }
    assertDateRange(args.startAt, args.dueAt);
    const now = Date.now();
    const priority = clampPriority(args.priority);
    const allIds =
      args.assigneeUserIds && args.assigneeUserIds.length > 0
        ? args.assigneeUserIds
        : args.assigneeUserId
          ? [args.assigneeUserId]
          : [];
    const uniqueIds = [...new Set(allIds)];
    const assigneeStates =
      uniqueIds.length > 0
        ? buildAssigneeStates({
            assigneeIds: uniqueIds,
            actorUserId: userId,
            now,
          })
        : undefined;

    let parentTaskId: Id<"assessmentTasks"> | undefined;
    if (args.parentTaskId) {
      const parent = await ctx.db.get(args.parentTaskId);
      if (!parent || parent.assessmentId !== args.assessmentId) {
        throw new Error("Hovedsaken finnes ikke på denne vurderingen.");
      }
      if (parent.parentTaskId) {
        throw new Error(
          "Kan ikke opprette under-sak under en under-sak. Velg en hovedsak.",
        );
      }
      parentTaskId = args.parentTaskId;
    }

    const taskId = await ctx.db.insert("assessmentTasks", {
      workspaceId: assessment.workspaceId,
      assessmentId: args.assessmentId,
      title,
      description: args.description?.trim() || undefined,
      parentTaskId,
      assigneeUserId: uniqueIds[0],
      assigneeUserIds: uniqueIds.length > 0 ? uniqueIds : undefined,
      assigneeStates,
      createdByUserId: userId,
      status: "open",
      priority,
      startAt: args.startAt,
      dueAt: args.dueAt,
      dashboardRank: now,
      createdAt: now,
    });
    const atitle = assessment.title.trim() || "vurdering";
    const sakerHref = `/w/${assessment.workspaceId}/saker?task=${taskId}`;
    for (const uid of uniqueIds) {
      if (uid !== userId) {
        await insertUserInAppNotification(ctx, {
          userId: uid,
          title: `Du er tildelt «${title}»`,
          body: `På vurderingen «${atitle}». Åpne saken under Saker.`,
          href: sakerHref,
        });
      }
    }
    return taskId;
  },
});

/**
 * Koble / fjern under-sak (GitHub: issue ↔ sub-issue).
 * - `parentTaskId: id` → gjør saken til under-sak (må være hovedsak uten egne under-saker)
 * - `parentTaskId: null` → gjør under-sak om til selvstendig issue
 */
export const setParent = mutation({
  args: {
    taskId: v.id("assessmentTasks"),
    parentTaskId: v.union(v.id("assessmentTasks"), v.null()),
  },
  returns: v.object({ ok: v.literal(true) }),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.taskId);
    if (!row) {
      throw new Error("Fant ikke saken.");
    }
    await requireAssessmentEdit(ctx, row.assessmentId);

    if (args.parentTaskId === null) {
      if (!row.parentTaskId) {
        return { ok: true as const };
      }
      await ctx.db.patch(args.taskId, { parentTaskId: undefined });
      return { ok: true as const };
    }

    await assertCanSetParent(ctx, row, args.parentTaskId);
    await ctx.db.patch(args.taskId, { parentTaskId: args.parentTaskId });
    return { ok: true as const };
  },
});

export const update = mutation({
  args: {
    taskId: v.id("assessmentTasks"),
    title: v.optional(v.string()),
    description: v.optional(v.union(v.string(), v.null())),
    assigneeUserId: v.optional(v.union(v.id("users"), v.null())),
    assigneeUserIds: v.optional(v.union(v.array(v.id("users")), v.null())),
    priority: v.optional(v.number()),
    startAt: v.optional(v.union(v.number(), v.null())),
    dueAt: v.optional(v.union(v.number(), v.null())),
    status: v.optional(v.union(v.literal("open"), v.literal("done"))),
    /** Når status settes til done på hovedsak: også fullfør under-saker */
    completeSubIssues: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.taskId);
    if (!row) {
      throw new Error("Fant ikke oppgaven.");
    }
    const { assessment, userId } = await requireAssessmentEdit(ctx, row.assessmentId);
    const patch: Record<string, unknown> = {};
    if (args.title !== undefined) {
      const t = args.title.trim();
      if (!t) throw new Error("Tittel kan ikke være tom.");
      patch.title = t;
    }
    if (args.description !== undefined) {
      patch.description =
        args.description === null ? undefined : args.description.trim() || undefined;
    }
    if (args.assigneeUserIds !== undefined) {
      const newIds =
        args.assigneeUserIds === null ? [] : [...new Set(args.assigneeUserIds)];
      patch.assigneeUserIds = newIds.length > 0 ? newIds : undefined;
      patch.assigneeUserId = newIds[0] ?? undefined;
      patch.assigneeStates =
        newIds.length > 0
          ? buildAssigneeStates({
              assigneeIds: newIds,
              actorUserId: userId,
              previous: row.assigneeStates,
              now: Date.now(),
            })
          : undefined;
      const oldIds = new Set(resolveAssigneeIds(row));
      const added = newIds.filter((id) => !oldIds.has(id));
      const atitle = assessment.title.trim() || "vurdering";
      const sakerHref = `/w/${assessment.workspaceId}/saker?task=${args.taskId}`;
      for (const uid of added) {
        if (uid !== userId) {
          await insertUserInAppNotification(ctx, {
            userId: uid,
            title: `Du er tildelt «${row.title}»`,
            body: `På vurderingen «${atitle}». Åpne saken under Saker.`,
            href: sakerHref,
          });
        }
      }
    } else if (args.assigneeUserId !== undefined) {
      const previousIds = new Set(resolveAssigneeIds(row));
      patch.assigneeUserId =
        args.assigneeUserId === null ? undefined : args.assigneeUserId;
      if (args.assigneeUserId) {
        patch.assigneeUserIds = [args.assigneeUserId];
        patch.assigneeStates = buildAssigneeStates({
          assigneeIds: [args.assigneeUserId],
          actorUserId: userId,
          previous: row.assigneeStates,
          now: Date.now(),
        });
        if (
          !previousIds.has(args.assigneeUserId) &&
          args.assigneeUserId !== userId
        ) {
          const atitle = assessment.title.trim() || "vurdering";
          await insertUserInAppNotification(ctx, {
            userId: args.assigneeUserId,
            title: `Du er tildelt «${row.title}»`,
            body: `På vurderingen «${atitle}». Åpne saken under Saker.`,
            href: `/w/${assessment.workspaceId}/saker?task=${args.taskId}`,
          });
        }
      } else {
        patch.assigneeUserIds = undefined;
        patch.assigneeStates = undefined;
      }
    }
    if (args.priority !== undefined) {
      patch.priority = clampPriority(args.priority);
    }
    if (args.startAt !== undefined) {
      patch.startAt = args.startAt === null ? undefined : args.startAt;
    }
    if (args.dueAt !== undefined) {
      patch.dueAt = args.dueAt === null ? undefined : args.dueAt;
    }
    const nextStart =
      args.startAt !== undefined
        ? args.startAt === null
          ? undefined
          : args.startAt
        : row.startAt;
    const nextDue =
      args.dueAt !== undefined
        ? args.dueAt === null
          ? undefined
          : args.dueAt
        : row.dueAt;
    assertDateRange(nextStart, nextDue);
    if (args.status !== undefined) {
      patch.status = args.status;
    }
    await ctx.db.patch(args.taskId, patch);
    if (
      args.status === "done" &&
      args.completeSubIssues === true &&
      !row.parentTaskId
    ) {
      await markChildrenDone(ctx, args.taskId);
    }
  },
});

export const remove = mutation({
  args: { taskId: v.id("assessmentTasks") },
  returns: v.object({ ok: v.literal(true) }),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.taskId);
    if (!row) {
      throw new Error("Fant ikke oppgaven.");
    }
    await requireAssessmentEdit(ctx, row.assessmentId);
    // Under-saker blir selvstendige issues (som når man sletter parent på GitHub)
    const children = await ctx.db
      .query("assessmentTasks")
      .withIndex("by_parent", (q) => q.eq("parentTaskId", args.taskId))
      .collect();
    for (const child of children) {
      await ctx.db.patch(child._id, { parentTaskId: undefined });
    }
    const taskNotes = await ctx.db
      .query("assessmentTaskNotes")
      .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
      .collect();
    for (const n of taskNotes) {
      await ctx.db.delete(n._id);
    }
    await ctx.db.delete(args.taskId);
    return { ok: true as const };
  },
});

export const setStatus = mutation({
  args: {
    taskId: v.id("assessmentTasks"),
    status: v.union(v.literal("open"), v.literal("done")),
    /**
     * Ved «done» på hovedsak: true = fullfør også alle under-saker,
     * false/undefined = kun hovedsaken.
     */
    completeSubIssues: v.optional(v.boolean()),
  },
  returns: v.object({ ok: v.literal(true) }),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.taskId);
    if (!row) {
      throw new Error("Fant ikke oppgaven.");
    }
    await requireAssessmentEdit(ctx, row.assessmentId);
    await ctx.db.patch(args.taskId, { status: args.status });
    if (
      args.status === "done" &&
      args.completeSubIssues === true &&
      !row.parentTaskId
    ) {
      await markChildrenDone(ctx, args.taskId);
    }
    return { ok: true as const };
  },
});

/** Rekkefølge i dashboard (alle synlige åpne oppgaver). */
export const reorderDashboard = mutation({
  args: { orderedTaskIds: v.array(v.id("assessmentTasks")) },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    let rank = 0;
    for (const id of args.orderedTaskIds) {
      const row = await ctx.db.get(id);
      if (!row) continue;
      const assessment = await ctx.db.get(row.assessmentId);
      if (!assessment) continue;
      if (!(await canEditAssessment(ctx, assessment, userId))) continue;
      await ctx.db.patch(id, { dashboardRank: rank++ });
    }
  },
});

/** Flytt mellom prioriteringskolonner (1–5) eller til/fra ferdig. */
export const moveTask = mutation({
  args: {
    taskId: v.id("assessmentTasks"),
    priority: v.optional(v.number()),
    status: v.optional(v.union(v.literal("open"), v.literal("done"))),
    /** Ved flytting til ferdig på hovedsak: også fullfør under-saker */
    completeSubIssues: v.optional(v.boolean()),
  },
  returns: v.object({ ok: v.literal(true) }),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.taskId);
    if (!row) {
      throw new Error("Fant ikke oppgaven.");
    }
    await requireAssessmentEdit(ctx, row.assessmentId);
    const patch: {
      priority?: number;
      status?: "open" | "done";
      dashboardRank?: number;
    } = {};
    if (args.priority !== undefined) {
      patch.priority = clampPriority(args.priority);
    }
    if (args.status !== undefined) {
      patch.status = args.status;
    }
    patch.dashboardRank = Date.now();
    await ctx.db.patch(args.taskId, patch);
    if (
      args.status === "done" &&
      args.completeSubIssues === true &&
      !row.parentTaskId
    ) {
      await markChildrenDone(ctx, args.taskId);
    }
    return { ok: true as const };
  },
});
