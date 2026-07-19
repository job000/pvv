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
  canAccessPulsBoard,
  canEditAssessment,
  canReadAssessment,
  requireAssessmentEdit,
  requireAssessmentRead,
  requirePulsBoardAccess,
  requireUserId,
  requireWorkspaceMember,
} from "./lib/access";
import { buildAssigneeStates } from "./lib/taskAssignment";
import {
  ensureDefaultColumns,
  listColumnsForBoard,
  resolveColumnForLegacy,
} from "./pulsBoardColumns";
import { ensureDefaultPulsBoard } from "./pulsBoards";
import { insertUserInAppNotification } from "./userInAppNotifications";

async function requireTaskWriteAccess(
  ctx: MutationCtx,
  task: Doc<"assessmentTasks">,
): Promise<Id<"users">> {
  if (task.boardId) {
    const { userId } = await requirePulsBoardAccess(
      ctx,
      task.boardId,
      "editor",
    );
    return userId;
  }
  if (task.assessmentId) {
    const { userId } = await requireAssessmentEdit(ctx, task.assessmentId);
    return userId;
  }
  const userId = await requireUserId(ctx);
  await requireWorkspaceMember(ctx, task.workspaceId, userId, "editor");
  return userId;
}

function clampPriority(p: number | undefined): number {
  if (p === undefined) return 3;
  return Math.min(5, Math.max(1, Math.round(p)));
}

const LABEL_MAX = 40;
const LABEL_COUNT_MAX = 20;
const META_STR_MAX = 80;

function normalizeLabels(raw: string[] | undefined | null): string[] | undefined {
  if (raw === null || raw === undefined) return undefined;
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const t = item.trim().slice(0, LABEL_MAX);
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
    if (out.length >= LABEL_COUNT_MAX) break;
  }
  return out.length > 0 ? out : undefined;
}

function normalizeMetaString(
  raw: string | undefined | null,
): string | undefined {
  if (raw === null || raw === undefined) return undefined;
  const t = raw.trim().slice(0, META_STR_MAX);
  return t || undefined;
}

function normalizeEstimate(
  raw: number | undefined | null,
): number | undefined {
  if (raw === null || raw === undefined) return undefined;
  if (!Number.isFinite(raw)) return undefined;
  return Math.max(0, Math.round(raw * 100) / 100);
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

const MAX_NESTING_DEPTH = 8;

/** Fullfør hele subtreet rekursivt. */
async function markSubtreeDone(
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
    await markSubtreeDone(ctx, child._id);
  }
}

function taskDepth(
  taskId: Id<"assessmentTasks">,
  parentById: Map<Id<"assessmentTasks">, Id<"assessmentTasks"> | undefined>,
): number {
  let depth = 0;
  let cur = parentById.get(taskId);
  const seen = new Set<Id<"assessmentTasks">>();
  while (cur) {
    if (seen.has(cur)) break;
    seen.add(cur);
    depth += 1;
    cur = parentById.get(cur);
  }
  return depth;
}

function subtreeHeight(
  rootId: Id<"assessmentTasks">,
  childrenByParent: Map<Id<"assessmentTasks">, Id<"assessmentTasks">[]>,
): number {
  const kids = childrenByParent.get(rootId) ?? [];
  if (kids.length === 0) return 0;
  let max = 0;
  for (const kid of kids) {
    max = Math.max(max, 1 + subtreeHeight(kid, childrenByParent));
  }
  return max;
}

function buildParentMaps(siblings: Doc<"assessmentTasks">[]) {
  const parentById = new Map<
    Id<"assessmentTasks">,
    Id<"assessmentTasks"> | undefined
  >();
  const childrenByParent = new Map<
    Id<"assessmentTasks">,
    Id<"assessmentTasks">[]
  >();
  for (const t of siblings) {
    parentById.set(t._id, t.parentTaskId);
    if (t.parentTaskId) {
      const list = childrenByParent.get(t.parentTaskId) ?? [];
      list.push(t._id);
      childrenByParent.set(t.parentTaskId, list);
    }
  }
  return { parentById, childrenByParent };
}

async function loadAssessmentParentMaps(
  ctx: QueryCtx,
  assessmentId: Id<"assessments">,
) {
  const siblings = await ctx.db
    .query("assessmentTasks")
    .withIndex("by_assessment", (q) => q.eq("assessmentId", assessmentId))
    .collect();
  return buildParentMaps(siblings);
}

async function loadTaskParentMaps(
  ctx: QueryCtx,
  task: Doc<"assessmentTasks">,
) {
  if (task.boardId) {
    const siblings = await ctx.db
      .query("assessmentTasks")
      .withIndex("by_board", (q) => q.eq("boardId", task.boardId!))
      .collect();
    return buildParentMaps(siblings);
  }
  if (task.assessmentId) {
    return await loadAssessmentParentMaps(ctx, task.assessmentId);
  }
  const siblings = await ctx.db
    .query("assessmentTasks")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", task.workspaceId))
    .collect();
  return buildParentMaps(siblings);
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
 * Valider at `child` kan knyttes som under-sak under `parent`.
 * Flernivå tillatt: syklus forbudt, maks dybde MAX_NESTING_DEPTH.
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
    throw new Error("Fant ikke foreldresaken.");
  }
  if (parent.workspaceId !== child.workspaceId) {
    throw new Error("Under-sak må være i samme arbeidsområde som forelderen.");
  }
  if (
    parent.boardId &&
    child.boardId &&
    parent.boardId !== child.boardId
  ) {
    throw new Error("Under-sak må være på samme tavle som forelderen.");
  }
  if (
    parent.assessmentId &&
    child.assessmentId &&
    parent.assessmentId !== child.assessmentId
  ) {
    throw new Error("Under-sak må være på samme vurdering som forelderen.");
  }

  const { parentById, childrenByParent } = await loadTaskParentMaps(ctx, child);

  // Syklus: child må ikke ligge i ancestor-kjeden til ny forelder
  let walk: Id<"assessmentTasks"> | undefined = parentId;
  const seen = new Set<Id<"assessmentTasks">>();
  while (walk) {
    if (walk === child._id) {
      throw new Error(
        "Kan ikke koble: dette ville laget en sirkel i sakstreet.",
      );
    }
    if (seen.has(walk)) break;
    seen.add(walk);
    walk = parentById.get(walk);
  }

  const parentDepth = taskDepth(parentId, parentById);
  const childHeight = subtreeHeight(child._id, childrenByParent);
  if (parentDepth + 1 + childHeight > MAX_NESTING_DEPTH) {
    throw new Error(
      `Under-saker kan maksimalt være ${MAX_NESTING_DEPTH} nivåer dype.`,
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
const boardLinkedProcessValidator = v.object({
  id: v.id("candidates"),
  name: v.string(),
  code: v.string(),
});

const boardLinkedRosValidator = v.object({
  id: v.id("rosAnalyses"),
  title: v.string(),
  status: v.string(),
});

const boardLinkKindValidator = v.union(
  v.literal("none"),
  v.literal("assessment"),
  v.literal("process"),
  v.literal("ros"),
  v.literal("pdd"),
  v.literal("form"),
);

const boardCardValidator = v.object({
  _id: v.id("assessmentTasks"),
  workspaceId: v.id("workspaces"),
  assessmentId: v.union(v.id("assessments"), v.null()),
  candidateId: v.union(v.id("candidates"), v.null()),
  rosAnalysisId: v.union(v.id("rosAnalyses"), v.null()),
  processDesignDocumentId: v.union(
    v.id("processDesignDocuments"),
    v.null(),
  ),
  intakeFormId: v.union(v.id("intakeForms"), v.null()),
  boardId: v.union(v.id("pulsBoards"), v.null()),
  columnId: v.union(v.id("pulsBoardColumns"), v.null()),
  title: v.string(),
  description: v.optional(v.string()),
  parentTaskId: v.optional(v.id("assessmentTasks")),
  status: v.union(v.literal("open"), v.literal("done")),
  priority: v.number(),
  startAt: v.optional(v.number()),
  dueAt: v.optional(v.number()),
  labels: v.optional(v.array(v.string())),
  issueType: v.optional(v.string()),
  priorityLabel: v.optional(v.string()),
  size: v.optional(v.string()),
  estimate: v.optional(v.number()),
  milestone: v.optional(v.string()),
  dashboardRank: v.optional(v.number()),
  createdAt: v.number(),
  assessmentTitle: v.string(),
  linkKind: boardLinkKindValidator,
  linkLabel: v.string(),
  linkHref: v.union(v.string(), v.null()),
  assigneeName: v.union(v.string(), v.null()),
  assignees: v.array(v.object({ userId: v.id("users"), name: v.string() })),
  githubIssueUrl: v.union(v.string(), v.null()),
  parentTitle: v.union(v.string(), v.null()),
  depth: v.number(),
  subIssueCount: v.number(),
  subIssueDoneCount: v.number(),
  linkedProcesses: v.array(boardLinkedProcessValidator),
  linkedRos: v.array(boardLinkedRosValidator),
  canEdit: v.boolean(),
});

async function resolveTaskLinkContext(
  ctx: QueryCtx,
  task: Doc<"assessmentTasks">,
  assessmentTitle: string | null,
): Promise<{
  linkKind:
    | "none"
    | "assessment"
    | "process"
    | "ros"
    | "pdd"
    | "form";
  linkLabel: string;
  linkHref: string | null;
}> {
  const ws = task.workspaceId;
  const parts: string[] = [];
  let primaryKind:
    | "none"
    | "assessment"
    | "process"
    | "ros"
    | "pdd"
    | "form" = "none";
  let primaryHref: string | null = null;

  if (task.assessmentId) {
    const label = assessmentTitle?.trim() || "Vurdering";
    parts.push(label);
    if (primaryKind === "none") {
      primaryKind = "assessment";
      primaryHref = `/w/${ws}/a/${task.assessmentId}`;
    }
  }
  if (task.candidateId) {
    const cand = await ctx.db.get(task.candidateId);
    const label = cand
      ? cand.code
        ? `${cand.code} — ${cand.name}`
        : cand.name
      : "Prosess";
    parts.push(label);
    if (primaryKind === "none") {
      primaryKind = "process";
      primaryHref = `/w/${ws}/vurderinger?fane=prosesser&rediger=${task.candidateId}`;
    }
  }
  if (task.rosAnalysisId) {
    const ros = await ctx.db.get(task.rosAnalysisId);
    const label = ros?.title?.trim() || "ROS";
    parts.push(label);
    if (primaryKind === "none") {
      primaryKind = "ros";
      primaryHref = ros ? `/w/${ws}/ros/a/${ros._id}` : null;
    }
  }
  if (task.processDesignDocumentId) {
    const doc = await ctx.db.get(task.processDesignDocumentId);
    const assessment = doc ? await ctx.db.get(doc.assessmentId) : null;
    const payload = doc?.payload as { processTitle?: string } | undefined;
    const title =
      (typeof payload?.processTitle === "string"
        ? payload.processTitle.replace(/<[^>]+>/g, "").trim()
        : "") ||
      assessment?.title?.trim() ||
      "Prosessdesign";
    parts.push(title);
    if (primaryKind === "none") {
      primaryKind = "pdd";
      primaryHref = assessment
        ? `/w/${ws}/a/${assessment._id}/prosessdesign`
        : null;
    }
  }
  if (task.intakeFormId) {
    const form = await ctx.db.get(task.intakeFormId);
    const label = form?.title?.trim() || "Skjema";
    parts.push(label);
    if (primaryKind === "none") {
      primaryKind = "form";
      primaryHref = form ? `/w/${ws}/skjemaer?form=${form._id}` : null;
    }
  }

  if (parts.length === 0) {
    return { linkKind: "none", linkLabel: "Uten kobling", linkHref: null };
  }
  return {
    linkKind: primaryKind,
    linkLabel: parts.join(" · "),
    linkHref: primaryHref,
  };
}

async function buildBoardCards(
  ctx: QueryCtx,
  userId: Id<"users">,
  workspaceId: Id<"workspaces">,
  tasks: Doc<"assessmentTasks">[],
  canEditBoard: boolean,
) {
    const titleById = new Map(tasks.map((t) => [t._id, t.title]));
    const parentById = new Map<
      Id<"assessmentTasks">,
      Id<"assessmentTasks"> | undefined
    >(tasks.map((t) => [t._id, t.parentTaskId]));

    const processLinks = await ctx.db
      .query("candidateAssessmentLinks")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    const processesByAssessment = new Map<
      Id<"assessments">,
      Array<{ id: Id<"candidates">; name: string; code: string }>
    >();
    for (const link of processLinks) {
      const candidate = await ctx.db.get(link.candidateId);
      if (!candidate) continue;
      const list = processesByAssessment.get(link.assessmentId) ?? [];
      if (!list.some((p) => p.id === candidate._id)) {
        list.push({
          id: candidate._id,
          name: candidate.name,
          code: candidate.code,
        });
      }
      processesByAssessment.set(link.assessmentId, list);
    }

    const rosLinks = await ctx.db
      .query("rosAnalysisAssessments")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    const rosByAssessment = new Map<
      Id<"assessments">,
      Array<{ id: Id<"rosAnalyses">; title: string; status: string }>
    >();
    for (const link of rosLinks) {
      const ros = await ctx.db.get(link.rosAnalysisId);
      if (!ros) continue;
      const list = rosByAssessment.get(link.assessmentId) ?? [];
      if (!list.some((r) => r.id === ros._id)) {
        const status =
          ros.reviewScheduleActive === false
            ? "inaktiv"
            : ros.nextReviewAt != null
              ? "planlagt"
              : "koblet";
        list.push({ id: ros._id, title: ros.title, status });
      }
      rosByAssessment.set(link.assessmentId, list);
    }

    const boardIds = [
      ...new Set(
        tasks
          .map((t) => t.boardId)
          .filter((id): id is Id<"pulsBoards"> => id != null),
      ),
    ];
    const columnsByBoard = new Map<
      Id<"pulsBoards">,
      Doc<"pulsBoardColumns">[]
    >();
    for (const bid of boardIds) {
      columnsByBoard.set(bid, await listColumnsForBoard(ctx, bid));
    }

    const out: Array<{
      _id: Id<"assessmentTasks">;
      workspaceId: Id<"workspaces">;
      assessmentId: Id<"assessments"> | null;
      candidateId: Id<"candidates"> | null;
      rosAnalysisId: Id<"rosAnalyses"> | null;
      processDesignDocumentId: Id<"processDesignDocuments"> | null;
      intakeFormId: Id<"intakeForms"> | null;
      boardId: Id<"pulsBoards"> | null;
      columnId: Id<"pulsBoardColumns"> | null;
      title: string;
      description?: string;
      parentTaskId?: Id<"assessmentTasks">;
      status: "open" | "done";
      priority: number;
      startAt?: number;
      dueAt?: number;
      labels?: string[];
      issueType?: string;
      priorityLabel?: string;
      size?: string;
      estimate?: number;
      milestone?: string;
      dashboardRank?: number;
      createdAt: number;
      assessmentTitle: string;
      linkKind:
        | "none"
        | "assessment"
        | "process"
        | "ros"
        | "pdd"
        | "form";
      linkLabel: string;
      linkHref: string | null;
      assigneeName: string | null;
      assignees: { userId: Id<"users">; name: string }[];
      githubIssueUrl: string | null;
      parentTitle: string | null;
      depth: number;
      subIssueCount: number;
      subIssueDoneCount: number;
      linkedProcesses: Array<{
        id: Id<"candidates">;
        name: string;
        code: string;
      }>;
      linkedRos: Array<{
        id: Id<"rosAnalyses">;
        title: string;
        status: string;
      }>;
      canEdit: boolean;
    }> = [];

    for (const t of tasks) {
      let assessment: Doc<"assessments"> | null = null;
      if (t.assessmentId) {
        assessment = await ctx.db.get(t.assessmentId);
        if (!assessment) continue;
        if (!(await canReadAssessment(ctx, assessment, userId))) continue;
      }

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
      const cols = t.boardId
        ? (columnsByBoard.get(t.boardId) ?? [])
        : [];
      const columnId = resolveColumnForLegacy(cols, t);

      const linkedProcesses: Array<{
        id: Id<"candidates">;
        name: string;
        code: string;
      }> = [];
      if (t.candidateId) {
        const cand = await ctx.db.get(t.candidateId);
        if (cand) {
          linkedProcesses.push({
            id: cand._id,
            name: cand.name,
            code: cand.code,
          });
        }
      } else if (t.assessmentId) {
        linkedProcesses.push(
          ...(processesByAssessment.get(t.assessmentId) ?? []),
        );
      }

      const linkedRos: Array<{
        id: Id<"rosAnalyses">;
        title: string;
        status: string;
      }> = [];
      if (t.rosAnalysisId) {
        const ros = await ctx.db.get(t.rosAnalysisId);
        if (ros) {
          const status =
            ros.reviewScheduleActive === false
              ? "inaktiv"
              : ros.nextReviewAt != null
                ? "planlagt"
                : "koblet";
          linkedRos.push({ id: ros._id, title: ros.title, status });
        }
      } else if (t.assessmentId) {
        linkedRos.push(...(rosByAssessment.get(t.assessmentId) ?? []));
      }

      const link = await resolveTaskLinkContext(
        ctx,
        t,
        assessment?.title ?? null,
      );

      out.push({
        _id: t._id,
        workspaceId: t.workspaceId,
        assessmentId: t.assessmentId ?? null,
        candidateId: t.candidateId ?? null,
        rosAnalysisId: t.rosAnalysisId ?? null,
        processDesignDocumentId: t.processDesignDocumentId ?? null,
        intakeFormId: t.intakeFormId ?? null,
        boardId: t.boardId ?? null,
        columnId,
        title: t.title,
        description: t.description,
        parentTaskId: t.parentTaskId,
        status: t.status,
        priority: clampPriority(t.priority),
        startAt: t.startAt,
        dueAt: t.dueAt,
        labels: t.labels,
        issueType: t.issueType,
        priorityLabel: t.priorityLabel,
        size: t.size,
        estimate: t.estimate,
        milestone: t.milestone,
        dashboardRank: t.dashboardRank,
        createdAt: t.createdAt,
        assessmentTitle: assessment?.title ?? link.linkLabel,
        linkKind: link.linkKind,
        linkLabel: link.linkLabel,
        linkHref: link.linkHref,
        assigneeName:
          assignees.length > 0
            ? assignees.map((a) => a.name).join(", ")
            : null,
        assignees,
        githubIssueUrl,
        parentTitle: t.parentTaskId
          ? (titleById.get(t.parentTaskId) ?? null)
          : null,
        depth: taskDepth(t._id, parentById),
        subIssueCount: children.length,
        subIssueDoneCount: children.filter((c) => c.status === "done").length,
        linkedProcesses,
        linkedRos,
        canEdit:
          canEditBoard ||
          (assessment
            ? await canEditAssessment(ctx, assessment, userId)
            : false),
      });
    }

    out.sort((a, b) => {
      if (a.status !== b.status) return a.status === "open" ? -1 : 1;
      if (a.priority !== b.priority) return a.priority - b.priority;
      return (a.dashboardRank ?? a.createdAt) - (b.dashboardRank ?? b.createdAt);
    });

    return out;
}

export const listBoardByPulsBoard = query({
  args: { boardId: v.id("pulsBoards") },
  returns: v.array(boardCardValidator),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const board = await ctx.db.get(args.boardId);
    if (!board) return [];
    const canView = await canAccessPulsBoard(ctx, board, userId, "viewer");
    if (!canView) return [];
    const canEditBoard = await canAccessPulsBoard(ctx, board, userId, "editor");

    const tasks = await ctx.db
      .query("assessmentTasks")
      .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
      .take(500);

    return await buildBoardCards(
      ctx,
      userId,
      board.workspaceId,
      tasks,
      canEditBoard,
    );
  },
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

    return await buildBoardCards(ctx, userId, args.workspaceId, tasks, false);
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
        columnName: string | null;
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
      const columnNameById = new Map<Id<"pulsBoardColumns">, string>();
      for (const t of tasks) {
        if (!t.columnId || columnNameById.has(t.columnId)) continue;
        const col = await ctx.db.get(t.columnId);
        if (col) columnNameById.set(t.columnId, col.name);
      }
      for (const t of tasks) {
        let assessment: Doc<"assessments"> | null = null;
        if (t.assessmentId) {
          assessment = await ctx.db.get(t.assessmentId);
          if (!assessment) continue;
          if (!(await canReadAssessment(ctx, assessment, userId))) continue;
        }
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
        const link = await resolveTaskLinkContext(
          ctx,
          t,
          assessment?.title ?? null,
        );
        enriched.push({
          ...t,
          assessmentTitle: assessment?.title ?? link.linkLabel,
          workspaceName: ws?.name ?? "",
          columnName: t.columnId
            ? (columnNameById.get(t.columnId) ?? null)
            : null,
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
    /** Når kortet ikke knyttes til vurdering — krev boardId eller workspaceId */
    workspaceId: v.optional(v.id("workspaces")),
    assessmentId: v.optional(v.id("assessments")),
    candidateId: v.optional(v.id("candidates")),
    rosAnalysisId: v.optional(v.id("rosAnalyses")),
    processDesignDocumentId: v.optional(v.id("processDesignDocuments")),
    intakeFormId: v.optional(v.id("intakeForms")),
    boardId: v.optional(v.id("pulsBoards")),
    columnId: v.optional(v.id("pulsBoardColumns")),
    title: v.string(),
    description: v.optional(v.string()),
    assigneeUserId: v.optional(v.id("users")),
    assigneeUserIds: v.optional(v.array(v.id("users"))),
    priority: v.optional(v.number()),
    startAt: v.optional(v.number()),
    dueAt: v.optional(v.number()),
    labels: v.optional(v.array(v.string())),
    issueType: v.optional(v.string()),
    priorityLabel: v.optional(v.string()),
    size: v.optional(v.string()),
    estimate: v.optional(v.number()),
    milestone: v.optional(v.string()),
    /** Opprett som delkort under denne saken (flernivå tillatt) */
    parentTaskId: v.optional(v.id("assessmentTasks")),
  },
  returns: v.id("assessmentTasks"),
  handler: async (ctx, args) => {
    let userId: Id<"users">;
    let workspaceId: Id<"workspaces">;
    let assessment: Doc<"assessments"> | null = null;
    let assessmentId = args.assessmentId;
    let candidateId = args.candidateId;
    let rosAnalysisId = args.rosAnalysisId;
    let processDesignDocumentId = args.processDesignDocumentId;
    let intakeFormId = args.intakeFormId;

    if (assessmentId) {
      const access = await requireAssessmentEdit(ctx, assessmentId);
      assessment = access.assessment;
      userId = access.userId;
      workspaceId = assessment.workspaceId;
    } else if (args.boardId) {
      const access = await requirePulsBoardAccess(ctx, args.boardId, "editor");
      userId = access.userId;
      workspaceId = access.board.workspaceId;
    } else if (args.workspaceId) {
      userId = await requireUserId(ctx);
      await requireWorkspaceMember(ctx, args.workspaceId, userId, "editor");
      workspaceId = args.workspaceId;
    } else {
      throw new Error(
        "Kortet må knyttes til en tavle, et arbeidsområde eller en vurdering.",
      );
    }

    let boardId = args.boardId;
    let boardDoc: Doc<"pulsBoards"> | null = null;
    if (boardId) {
      const access = await requirePulsBoardAccess(ctx, boardId, "editor");
      boardDoc = access.board;
      if (boardDoc.workspaceId !== workspaceId) {
        throw new Error("Tavlen tilhører ikke samme arbeidsområde.");
      }
      userId = access.userId;
    } else {
      boardId = await ensureDefaultPulsBoard(ctx, workspaceId, userId);
      const access = await requirePulsBoardAccess(ctx, boardId, "editor");
      boardDoc = access.board;
    }

    if (candidateId) {
      const cand = await ctx.db.get(candidateId);
      if (!cand || cand.workspaceId !== workspaceId) {
        throw new Error("Prosessen finnes ikke i dette arbeidsområdet.");
      }
    }
    if (rosAnalysisId) {
      const ros = await ctx.db.get(rosAnalysisId);
      if (!ros || ros.workspaceId !== workspaceId) {
        throw new Error("ROS-analysen finnes ikke i dette arbeidsområdet.");
      }
    }
    if (processDesignDocumentId) {
      const doc = await ctx.db.get(processDesignDocumentId);
      if (!doc || doc.workspaceId !== workspaceId) {
        throw new Error("Prosessdesign finnes ikke i dette arbeidsområdet.");
      }
      // PDD hører til en vurdering — sett den hvis ikke valgt eksplisitt
      if (!assessmentId) {
        assessmentId = doc.assessmentId;
        assessment = await ctx.db.get(doc.assessmentId);
        if (assessment) {
          await requireAssessmentEdit(ctx, assessmentId);
        }
      }
    }
    if (intakeFormId) {
      const form = await ctx.db.get(intakeFormId);
      if (!form || form.workspaceId !== workspaceId) {
        throw new Error("Skjemaet finnes ikke i dette arbeidsområdet.");
      }
    }

    const cols = await ensureDefaultColumns(ctx, boardDoc);
    let columnId = args.columnId;
    if (columnId) {
      const col = cols.find((c) => c._id === columnId);
      if (!col) throw new Error("Kolonnen finnes ikke på denne tavlen.");
      if (col.isDone) throw new Error("Nye kort kan ikke legges direkte i Ferdig.");
    } else {
      const openCols = cols.filter((c) => !c.isDone);
      const p = clampPriority(args.priority);
      columnId = openCols[p - 1]?._id ?? openCols[0]?._id;
    }

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
      if (!parent || parent.workspaceId !== workspaceId) {
        throw new Error("Foreldrekortet finnes ikke i dette arbeidsområdet.");
      }
      if (parent.boardId && parent.boardId !== boardId) {
        throw new Error("Foreldrekortet ligger på en annen tavle.");
      }
      if (
        assessmentId &&
        parent.assessmentId &&
        parent.assessmentId !== assessmentId
      ) {
        throw new Error("Foreldrekortet hører til en annen vurdering.");
      }
      // Arv koblinger fra forelder hvis ikke satt
      if (!assessmentId && parent.assessmentId) {
        assessmentId = parent.assessmentId;
      }
      if (!candidateId && parent.candidateId) candidateId = parent.candidateId;
      if (!rosAnalysisId && parent.rosAnalysisId) {
        rosAnalysisId = parent.rosAnalysisId;
      }
      if (!processDesignDocumentId && parent.processDesignDocumentId) {
        processDesignDocumentId = parent.processDesignDocumentId;
      }
      if (!intakeFormId && parent.intakeFormId) {
        intakeFormId = parent.intakeFormId;
      }
      const { parentById } = await loadTaskParentMaps(ctx, parent);
      const parentDepth = taskDepth(args.parentTaskId, parentById);
      if (parentDepth + 1 > MAX_NESTING_DEPTH) {
        throw new Error(
          `Delkort kan maksimalt være ${MAX_NESTING_DEPTH} nivåer dype.`,
        );
      }
      parentTaskId = args.parentTaskId;
    }

    const taskId = await ctx.db.insert("assessmentTasks", {
      workspaceId,
      assessmentId,
      candidateId,
      rosAnalysisId,
      processDesignDocumentId,
      intakeFormId,
      boardId,
      columnId,
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
      labels: normalizeLabels(args.labels),
      issueType: normalizeMetaString(args.issueType),
      priorityLabel: normalizeMetaString(args.priorityLabel),
      size: normalizeMetaString(args.size),
      estimate: normalizeEstimate(args.estimate),
      milestone: normalizeMetaString(args.milestone),
      dashboardRank: now,
      createdAt: now,
    });

    const linkCtx = await resolveTaskLinkContext(
      ctx,
      {
        workspaceId,
        assessmentId,
        candidateId,
        rosAnalysisId,
        processDesignDocumentId,
        intakeFormId,
      } as Doc<"assessmentTasks">,
      assessment?.title ?? null,
    );
    const notifyBody =
      linkCtx.linkKind === "none"
        ? "Åpne kortet under Puls."
        : `Koblet til «${linkCtx.linkLabel}». Åpne kortet under Puls.`;
    const pulsHref = `/w/${workspaceId}/puls/${boardId}?task=${taskId}`;
    for (const uid of uniqueIds) {
      if (uid !== userId) {
        await insertUserInAppNotification(ctx, {
          userId: uid,
          title: `Du er tildelt «${title}»`,
          body: notifyBody,
          href: pulsHref,
        });
      }
    }
    return taskId;
  },
});

/** Valg for «Kobling»-velgeren ved opprettelse av Puls-kort. */
export const listCreateLinkTargets = query({
  args: { workspaceId: v.id("workspaces") },
  returns: v.object({
    assessments: v.array(
      v.object({ id: v.id("assessments"), title: v.string() }),
    ),
    processes: v.array(
      v.object({
        id: v.id("candidates"),
        name: v.string(),
        code: v.string(),
      }),
    ),
    ros: v.array(
      v.object({ id: v.id("rosAnalyses"), title: v.string() }),
    ),
    pdds: v.array(
      v.object({
        id: v.id("processDesignDocuments"),
        title: v.string(),
        assessmentId: v.id("assessments"),
      }),
    ),
    forms: v.array(
      v.object({ id: v.id("intakeForms"), title: v.string() }),
    ),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return {
        assessments: [],
        processes: [],
        ros: [],
        pdds: [],
        forms: [],
      };
    }
    await requireWorkspaceMember(ctx, args.workspaceId, userId, "viewer");

    const assessmentsRaw = await ctx.db
      .query("assessments")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .take(200);
    const assessments: Array<{ id: Id<"assessments">; title: string }> = [];
    for (const a of assessmentsRaw) {
      if (!(await canReadAssessment(ctx, a, userId))) continue;
      assessments.push({
        id: a._id,
        title: a.title.trim() || "Uten tittel",
      });
    }
    assessments.sort((a, b) => a.title.localeCompare(b.title, "nb"));

    const processesRaw = await ctx.db
      .query("candidates")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .take(300);
    const processes = processesRaw
      .map((c) => ({ id: c._id, name: c.name, code: c.code }))
      .sort((a, b) =>
        (a.code || a.name).localeCompare(b.code || b.name, "nb"),
      );

    const rosRaw = await ctx.db
      .query("rosAnalyses")
      .withIndex("by_workspace_updated", (q) =>
        q.eq("workspaceId", args.workspaceId),
      )
      .order("desc")
      .take(200);
    const ros = rosRaw
      .map((r) => ({
        id: r._id,
        title: r.title.trim() || "Uten tittel",
      }))
      .sort((a, b) => a.title.localeCompare(b.title, "nb"));

    const pddRaw = await ctx.db
      .query("processDesignDocuments")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .take(200);
    const pdds: Array<{
      id: Id<"processDesignDocuments">;
      title: string;
      assessmentId: Id<"assessments">;
    }> = [];
    for (const doc of pddRaw) {
      const a = await ctx.db.get(doc.assessmentId);
      if (!a) continue;
      if (!(await canReadAssessment(ctx, a, userId))) continue;
      const payload = doc.payload as { processTitle?: string } | undefined;
      const fromPayload =
        typeof payload?.processTitle === "string"
          ? payload.processTitle.replace(/<[^>]+>/g, "").trim()
          : "";
      pdds.push({
        id: doc._id,
        title: fromPayload || a.title.trim() || "Prosessdesign",
        assessmentId: doc.assessmentId,
      });
    }
    pdds.sort((a, b) => a.title.localeCompare(b.title, "nb"));

    const formsRaw = await ctx.db
      .query("intakeForms")
      .withIndex("by_workspace_and_updated_at", (q) =>
        q.eq("workspaceId", args.workspaceId),
      )
      .order("desc")
      .take(100);
    const forms = formsRaw
      .map((f) => ({
        id: f._id,
        title: f.title.trim() || "Uten tittel",
      }))
      .sort((a, b) => a.title.localeCompare(b.title, "nb"));

    return { assessments, processes, ros, pdds, forms };
  },
});

/**
 * Koble / fjern under-sak (flernivå).
 * - `parentTaskId: id` → knytt under valgt sak (syklus/maks dybde sjekkes)
 * - `parentTaskId: null` → gjør saken om til toppnivå
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
    await requireTaskWriteAccess(ctx, row);

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
    labels: v.optional(v.union(v.array(v.string()), v.null())),
    issueType: v.optional(v.union(v.string(), v.null())),
    priorityLabel: v.optional(v.union(v.string(), v.null())),
    size: v.optional(v.union(v.string(), v.null())),
    estimate: v.optional(v.union(v.number(), v.null())),
    milestone: v.optional(v.union(v.string(), v.null())),
    status: v.optional(v.union(v.literal("open"), v.literal("done"))),
    /** Når status settes til done: også fullfør hele subtreet */
    completeSubIssues: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.taskId);
    if (!row) {
      throw new Error("Fant ikke oppgaven.");
    }
    const userId = await requireTaskWriteAccess(ctx, row);
    const assessment = row.assessmentId
      ? await ctx.db.get(row.assessmentId)
      : null;
    const linkCtx = await resolveTaskLinkContext(
      ctx,
      row,
      assessment?.title ?? null,
    );
    const notifyBody =
      linkCtx.linkKind === "none"
        ? "Åpne kortet under Puls."
        : `Koblet til «${linkCtx.linkLabel}». Åpne kortet under Puls.`;
    const pulsHref = row.boardId
      ? `/w/${row.workspaceId}/puls/${row.boardId}?task=${args.taskId}`
      : `/w/${row.workspaceId}/puls?task=${args.taskId}`;
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
      for (const uid of added) {
        if (uid !== userId) {
          await insertUserInAppNotification(ctx, {
            userId: uid,
            title: `Du er tildelt «${row.title}»`,
            body: notifyBody,
            href: pulsHref,
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
          await insertUserInAppNotification(ctx, {
            userId: args.assigneeUserId,
            title: `Du er tildelt «${row.title}»`,
            body: notifyBody,
            href: pulsHref,
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
    if (args.labels !== undefined) {
      patch.labels =
        args.labels === null ? undefined : normalizeLabels(args.labels);
    }
    if (args.issueType !== undefined) {
      patch.issueType =
        args.issueType === null
          ? undefined
          : normalizeMetaString(args.issueType);
    }
    if (args.priorityLabel !== undefined) {
      patch.priorityLabel =
        args.priorityLabel === null
          ? undefined
          : normalizeMetaString(args.priorityLabel);
    }
    if (args.size !== undefined) {
      patch.size =
        args.size === null ? undefined : normalizeMetaString(args.size);
    }
    if (args.estimate !== undefined) {
      patch.estimate =
        args.estimate === null ? undefined : normalizeEstimate(args.estimate);
    }
    if (args.milestone !== undefined) {
      patch.milestone =
        args.milestone === null
          ? undefined
          : normalizeMetaString(args.milestone);
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
    if (args.status === "done" && args.completeSubIssues === true) {
      await markSubtreeDone(ctx, args.taskId);
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
    await requireTaskWriteAccess(ctx, row);
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
     * Ved «done»: true = fullfør også hele subtreet,
     * false/undefined = kun denne saken.
     */
    completeSubIssues: v.optional(v.boolean()),
  },
  returns: v.object({ ok: v.literal(true) }),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.taskId);
    if (!row) {
      throw new Error("Fant ikke oppgaven.");
    }
    await requireTaskWriteAccess(ctx, row);
    await ctx.db.patch(args.taskId, { status: args.status });
    if (args.status === "done" && args.completeSubIssues === true) {
      await markSubtreeDone(ctx, args.taskId);
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
      try {
        await requireTaskWriteAccess(ctx, row);
      } catch {
        continue;
      }
      await ctx.db.patch(id, { dashboardRank: rank++ });
    }
  },
});

/** Flytt mellom kolonner (eller legacy prioritet 1–5 / ferdig). */
export const moveTask = mutation({
  args: {
    taskId: v.id("assessmentTasks"),
    columnId: v.optional(v.id("pulsBoardColumns")),
    priority: v.optional(v.number()),
    status: v.optional(v.union(v.literal("open"), v.literal("done"))),
    /** Ved flytting til ferdig: også fullfør hele subtreet */
    completeSubIssues: v.optional(v.boolean()),
  },
  returns: v.object({ ok: v.literal(true) }),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.taskId);
    if (!row) {
      throw new Error("Fant ikke oppgaven.");
    }
    await requireTaskWriteAccess(ctx, row);
    // Behold dashboardRank ved status/kolonne-endring, så gjenåpning
    // havner på samme plass i «Puls på tvers» (ikke nederst).
    const patch: {
      columnId?: Id<"pulsBoardColumns">;
      priority?: number;
      status?: "open" | "done";
    } = {};

    if (args.columnId !== undefined) {
      const col = await ctx.db.get(args.columnId);
      if (!col || (row.boardId && col.boardId !== row.boardId)) {
        throw new Error("Kolonnen finnes ikke på denne tavlen.");
      }
      patch.columnId = args.columnId;
      patch.status = col.isDone ? "done" : "open";
      if (!col.isDone) {
        const cols = await listColumnsForBoard(ctx, col.boardId);
        const openIdx = cols
          .filter((c) => !c.isDone)
          .findIndex((c) => c._id === col._id);
        if (openIdx >= 0) patch.priority = openIdx + 1;
      }
    } else {
      if (args.priority !== undefined) {
        patch.priority = clampPriority(args.priority);
      }
      if (args.status !== undefined) {
        patch.status = args.status;
      }
      if (row.boardId) {
        const board = await ctx.db.get(row.boardId);
        if (board) {
          const cols = await ensureDefaultColumns(ctx, board);
          const nextStatus = patch.status ?? row.status;
          const nextPriority = patch.priority ?? clampPriority(row.priority);
          patch.columnId =
            resolveColumnForLegacy(cols, {
              status: nextStatus,
              priority: nextPriority,
              columnId: undefined,
            }) ?? undefined;
        }
      }
    }

    await ctx.db.patch(args.taskId, patch);
    const becameDone =
      (patch.status === "done" || args.status === "done") &&
      args.completeSubIssues === true;
    if (becameDone) {
      await markSubtreeDone(ctx, args.taskId);
    }
    return { ok: true as const };
  },
});

/**
 * Fullfør kort → Ferdig-kolonne, valgfri kommentar, varsel til tildelte.
 */
export const completeTask = mutation({
  args: {
    taskId: v.id("assessmentTasks"),
    comment: v.optional(v.string()),
    completeSubIssues: v.optional(v.boolean()),
  },
  returns: v.object({ ok: v.literal(true) }),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.taskId);
    if (!row) throw new Error("Fant ikke oppgaven.");
    const userId = await requireTaskWriteAccess(ctx, row);

    let doneColumnId: Id<"pulsBoardColumns"> | undefined;
    if (row.boardId) {
      const board = await ctx.db.get(row.boardId);
      if (board) {
        const cols = await ensureDefaultColumns(ctx, board);
        const doneCol = cols.find((c) => c.isDone);
        doneColumnId = doneCol?._id;
      }
    }

    await ctx.db.patch(args.taskId, {
      status: "done",
      columnId: doneColumnId,
    });
    if (args.completeSubIssues === true) {
      await markSubtreeDone(ctx, args.taskId);
      if (doneColumnId) {
        const allOnBoard = await ctx.db
          .query("assessmentTasks")
          .withIndex("by_board", (q) => q.eq("boardId", row.boardId!))
          .take(500);
        const descendants = new Set<Id<"assessmentTasks">>();
        const walk = (id: Id<"assessmentTasks">) => {
          for (const c of allOnBoard) {
            if (c.parentTaskId === id && !descendants.has(c._id)) {
              descendants.add(c._id);
              walk(c._id);
            }
          }
        };
        walk(args.taskId);
        for (const id of descendants) {
          await ctx.db.patch(id, { columnId: doneColumnId, status: "done" });
        }
      }
    }

    const comment = args.comment?.trim();
    if (comment) {
      await ctx.db.insert("assessmentTaskNotes", {
        workspaceId: row.workspaceId,
        assessmentId: row.assessmentId,
        taskId: args.taskId,
        authorUserId: userId,
        body: comment,
        createdAt: Date.now(),
      });
    }

    const actor = await ctx.db.get(userId);
    const actorName = actor?.name?.trim() || actor?.email || "Noen";
    const boardPath = row.boardId
      ? `/w/${row.workspaceId}/puls/${row.boardId}?task=${args.taskId}`
      : `/w/${row.workspaceId}/puls?task=${args.taskId}`;
    const bodyBase = comment
      ? `${actorName} fullførte «${row.title}»: ${comment}`
      : `${actorName} markerte «${row.title}» som ferdig.`;

    for (const uid of resolveAssigneeIds(row)) {
      if (uid === userId) continue;
      await insertUserInAppNotification(ctx, {
        userId: uid,
        title: `Kort fullført: «${row.title}»`,
        body: bodyBase,
        href: boardPath,
      });
    }

    return { ok: true as const };
  },
});

/** Flytt kort (og delkort) til en annen Puls-tavle i samme workspace. */
export const moveToBoard = mutation({
  args: {
    taskId: v.id("assessmentTasks"),
    targetBoardId: v.id("pulsBoards"),
    targetColumnId: v.optional(v.id("pulsBoardColumns")),
    /** true = flytt også hele delkort-treet */
    moveSubtree: v.optional(v.boolean()),
  },
  returns: v.object({ ok: v.literal(true) }),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.taskId);
    if (!row) throw new Error("Fant ikke oppgaven.");
    await requireTaskWriteAccess(ctx, row);

    const { board: targetBoard } = await requirePulsBoardAccess(
      ctx,
      args.targetBoardId,
      "editor",
    );
    if (targetBoard.workspaceId !== row.workspaceId) {
      throw new Error("Tavlen tilhører ikke samme arbeidsområde.");
    }

    const cols = await ensureDefaultColumns(ctx, targetBoard);
    let columnId = args.targetColumnId;
    if (columnId) {
      const col = cols.find((c) => c._id === columnId);
      if (!col) throw new Error("Kolonnen finnes ikke på mål-tavlen.");
    } else {
      columnId =
        resolveColumnForLegacy(cols, {
          status: row.status,
          priority: row.priority,
          columnId: undefined,
        }) ?? undefined;
    }
    const targetCol = columnId ? await ctx.db.get(columnId) : null;
    const nextStatus = targetCol?.isDone ? "done" : row.status === "done" && !targetCol?.isDone ? "open" : row.status;

    const moveIds = new Set<Id<"assessmentTasks">>([args.taskId]);
    if (args.moveSubtree !== false) {
      const siblings = await ctx.db
        .query("assessmentTasks")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", row.workspaceId))
        .take(500);
      const walk = (id: Id<"assessmentTasks">) => {
        for (const c of siblings) {
          if (c.parentTaskId === id && !moveIds.has(c._id)) {
            moveIds.add(c._id);
            walk(c._id);
          }
        }
      };
      walk(args.taskId);
    }

    const now = Date.now();
    for (const id of moveIds) {
      const t = await ctx.db.get(id);
      if (!t) continue;
      const isRoot = id === args.taskId;
      let parentTaskId = t.parentTaskId;
      if (isRoot) {
        // Rot: fjern forelder hvis den ikke flyttes med
        if (parentTaskId && !moveIds.has(parentTaskId)) {
          parentTaskId = undefined;
        }
      } else if (parentTaskId && !moveIds.has(parentTaskId)) {
        parentTaskId = undefined;
      }

      const colForTask =
        isRoot || t.status === row.status
          ? columnId
          : resolveColumnForLegacy(cols, {
              status: t.status,
              priority: t.priority,
              columnId: undefined,
            }) ?? columnId;

      const colDoc = colForTask ? await ctx.db.get(colForTask) : null;
      await ctx.db.patch(id, {
        boardId: args.targetBoardId,
        columnId: colForTask,
        parentTaskId,
        status: colDoc?.isDone
          ? "done"
          : isRoot
            ? nextStatus
            : t.status,
        dashboardRank: now,
      });
    }

    await ctx.db.patch(args.targetBoardId, { updatedAt: now });
    return { ok: true as const };
  },
});
