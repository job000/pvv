import { v } from "convex/values";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Doc, Id } from "./_generated/dataModel";
import {
  canEditAssessment,
  canReadAssessment,
  requireAssessmentEdit,
  requireAssessmentRead,
  requireUserId,
} from "./lib/access";
import { insertUserInAppNotification } from "./userInAppNotifications";

function clampPriority(p: number | undefined): number {
  if (p === undefined) return 3;
  return Math.min(5, Math.max(1, Math.round(p)));
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
  return {
    ...row,
    assigneeName: assignees.length > 0 ? assignees.map((a) => a.name).join(", ") : null,
    assignees,
    creatorName: creator?.name ?? creator?.email ?? null,
    githubIssueUrl,
  };
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
        enriched.push({
          ...t,
          assessmentTitle: assessment.title,
          workspaceName: ws?.name ?? "",
          assigneeName: assignees.length > 0 ? assignees.map((a) => a.name).join(", ") : null,
          assignees,
          githubIssueUrl,
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
    dueAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { assessment, userId } = await requireAssessmentEdit(
      ctx,
      args.assessmentId,
    );
    const title = args.title.trim();
    if (!title) {
      throw new Error("Oppgavetekst mangler.");
    }
    const now = Date.now();
    const priority = clampPriority(args.priority);
    const allIds =
      args.assigneeUserIds && args.assigneeUserIds.length > 0
        ? args.assigneeUserIds
        : args.assigneeUserId
          ? [args.assigneeUserId]
          : [];
    const uniqueIds = [...new Set(allIds)];
    const taskId = await ctx.db.insert("assessmentTasks", {
      workspaceId: assessment.workspaceId,
      assessmentId: args.assessmentId,
      title,
      description: args.description?.trim() || undefined,
      assigneeUserId: uniqueIds[0],
      assigneeUserIds: uniqueIds.length > 0 ? uniqueIds : undefined,
      createdByUserId: userId,
      status: "open",
      priority,
      dueAt: args.dueAt,
      dashboardRank: now,
      createdAt: now,
    });
    const atitle = assessment.title.trim() || "vurdering";
    for (const uid of uniqueIds) {
      if (uid !== userId) {
        await insertUserInAppNotification(ctx, {
          userId: uid,
          title: `Du er tildelt oppgaven «${title}»`,
          body: `På vurderingen «${atitle}».`,
          href: `/w/${assessment.workspaceId}/a/${args.assessmentId}`,
        });
      }
    }
    return taskId;
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
    dueAt: v.optional(v.union(v.number(), v.null())),
    status: v.optional(v.union(v.literal("open"), v.literal("done"))),
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
      const oldIds = new Set(resolveAssigneeIds(row));
      const added = newIds.filter((id) => !oldIds.has(id));
      const atitle = assessment.title.trim() || "vurdering";
      for (const uid of added) {
        if (uid !== userId) {
          await insertUserInAppNotification(ctx, {
            userId: uid,
            title: `Du er tildelt oppgaven «${row.title}»`,
            body: `På vurderingen «${atitle}».`,
            href: `/w/${assessment.workspaceId}/a/${row.assessmentId}`,
          });
        }
      }
    } else if (args.assigneeUserId !== undefined) {
      patch.assigneeUserId =
        args.assigneeUserId === null ? undefined : args.assigneeUserId;
      if (args.assigneeUserId) {
        patch.assigneeUserIds = [args.assigneeUserId];
      } else {
        patch.assigneeUserIds = undefined;
      }
    }
    if (args.priority !== undefined) {
      patch.priority = clampPriority(args.priority);
    }
    if (args.dueAt !== undefined) {
      patch.dueAt = args.dueAt === null ? undefined : args.dueAt;
    }
    if (args.status !== undefined) {
      patch.status = args.status;
    }
    await ctx.db.patch(args.taskId, patch);
  },
});

export const remove = mutation({
  args: { taskId: v.id("assessmentTasks") },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.taskId);
    if (!row) {
      throw new Error("Fant ikke oppgaven.");
    }
    await requireAssessmentEdit(ctx, row.assessmentId);
    await ctx.db.delete(args.taskId);
  },
});

export const setStatus = mutation({
  args: {
    taskId: v.id("assessmentTasks"),
    status: v.union(v.literal("open"), v.literal("done")),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.taskId);
    if (!row) {
      throw new Error("Fant ikke oppgaven.");
    }
    await requireAssessmentEdit(ctx, row.assessmentId);
    await ctx.db.patch(args.taskId, { status: args.status });
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
  },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.taskId);
    if (!row) {
      throw new Error("Fant ikke oppgaven.");
    }
    await requireAssessmentEdit(ctx, row.assessmentId);
    const patch: { priority?: number; status?: "open" | "done"; dashboardRank?: number } = {};
    if (args.priority !== undefined) {
      patch.priority = clampPriority(args.priority);
    }
    if (args.status !== undefined) {
      patch.status = args.status;
    }
    patch.dashboardRank = Date.now();
    await ctx.db.patch(args.taskId, patch);
  },
});
