/**
 * GitHub → Puls import.
 *
 * Viktig: Kun lesing fra GitHub (REST GET + GraphQL query).
 * Ingen opprettelse/oppdatering/sletting av issues, kommentarer eller prosjektkort på GitHub.
 */
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  action,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { fetchProjectStatusFieldOptions } from "./githubCandidateProject";
import { resolveGithubToken } from "./githubTasks";
import {
  requireAssessmentEdit,
  requirePulsBoardAccess,
  requireWorkspaceMember,
} from "./lib/access";
import { normalizeGithubRepoFullName } from "./lib/github";
import {
  buildImportedDescription,
  fetchGithubIssueComments,
  fetchGithubIssueDetails,
  formatImportedGithubCommentBody,
  looksLikeDueDateFieldName,
  looksLikeEstimateFieldName,
  looksLikePriorityFieldName,
  looksLikeSizeFieldName,
  looksLikeStartDateFieldName,
  parseGithubDateToMs,
} from "./lib/githubIssueComments";
import { listGithubSubIssues } from "./lib/githubSubIssues";
import { githubGraphqlReadOnly } from "./lib/githubGraphql";
import { buildAssigneeStates } from "./lib/taskAssignment";
import { listColumnsForBoard } from "./pulsBoardColumns";

const ITEMS_PAGE = 100;
const MAX_PAGES = 30;
/** Soft cap so board-create import stays within action time limits. */
const MAX_IMPORT_ITEMS = 120;
const MAX_SUB_ISSUES_PER_PARENT = 40;
const MAX_COMMENTS_PER_ISSUE = 40;
const NOTE_MAX = 12_000;
const DESC_MAX = 20_000;

/** Read-only GraphQL query — ingen mutation. */
const PROJECT_ITEMS_PAGE_QUERY = `query($id: ID!, $after: String) {
  node(id: $id) {
    ... on ProjectV2 {
      items(first: ${ITEMS_PAGE}, after: $after) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          id
          content {
            __typename
            ... on Issue {
              title
              number
              url
              id
              body
              state
              createdAt
              updatedAt
              closedAt
              assignees(first: 10) {
                nodes {
                  login
                  name
                }
              }
              labels(first: 20) {
                nodes {
                  name
                }
              }
              issueType {
                name
              }
              milestone {
                title
                dueOn
              }
              repository {
                nameWithOwner
              }
            }
            ... on DraftIssue {
              id
              title
              body
            }
            ... on PullRequest {
              title
              number
              url
              id
              repository {
                nameWithOwner
              }
            }
          }
          fieldValues(first: 40) {
            nodes {
              __typename
              ... on ProjectV2ItemFieldSingleSelectValue {
                name
                optionId
                field {
                  ... on ProjectV2SingleSelectField {
                    id
                    name
                  }
                }
              }
              ... on ProjectV2ItemFieldDateValue {
                date
                field {
                  ... on ProjectV2FieldCommon {
                    id
                    name
                  }
                }
              }
              ... on ProjectV2ItemFieldTextValue {
                text
                field {
                  ... on ProjectV2FieldCommon {
                    id
                    name
                  }
                }
              }
              ... on ProjectV2ItemFieldNumberValue {
                number
                field {
                  ... on ProjectV2FieldCommon {
                    id
                    name
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}`;

function fieldValuesList(item: unknown): unknown[] {
  const fv = (item as { fieldValues?: { nodes?: unknown[] } })?.fieldValues
    ?.nodes;
  return Array.isArray(fv) ? fv : [];
}

function getItemStatusOptionId(
  fieldNodes: unknown[],
  statusFieldId: string,
): string | null {
  for (const raw of fieldNodes) {
    if (!raw || typeof raw !== "object") continue;
    const fv = raw as {
      __typename?: string;
      optionId?: string;
      field?: { id?: string } | null;
    };
    if (fv.__typename !== "ProjectV2ItemFieldSingleSelectValue") continue;
    if (fv.field?.id !== statusFieldId) continue;
    const optionId = fv.optionId?.trim();
    if (optionId) return optionId;
  }
  return null;
}

function getProjectDateFields(fieldNodes: unknown[]): {
  startAt?: number;
  dueAt?: number;
} {
  let startAt: number | undefined;
  let dueAt: number | undefined;
  for (const raw of fieldNodes) {
    if (!raw || typeof raw !== "object") continue;
    const fv = raw as {
      __typename?: string;
      date?: string;
      field?: { name?: string } | null;
    };
    if (fv.__typename !== "ProjectV2ItemFieldDateValue") continue;
    const fieldName = fv.field?.name?.trim() ?? "";
    const ms = parseGithubDateToMs(fv.date);
    if (ms === undefined) continue;
    if (looksLikeStartDateFieldName(fieldName) && startAt === undefined) {
      startAt = ms;
    } else if (looksLikeDueDateFieldName(fieldName) && dueAt === undefined) {
      dueAt = ms;
    }
  }
  return { startAt, dueAt };
}

function getProjectPropertyFields(fieldNodes: unknown[]): {
  priorityLabel?: string;
  size?: string;
  estimate?: number;
} {
  let priorityLabel: string | undefined;
  let size: string | undefined;
  let estimate: number | undefined;
  for (const raw of fieldNodes) {
    if (!raw || typeof raw !== "object") continue;
    const fv = raw as {
      __typename?: string;
      name?: string;
      number?: number;
      field?: { name?: string } | null;
    };
    const fieldName = fv.field?.name?.trim() ?? "";
    if (fv.__typename === "ProjectV2ItemFieldSingleSelectValue") {
      const optionName = fv.name?.trim();
      if (!optionName) continue;
      if (looksLikePriorityFieldName(fieldName) && priorityLabel === undefined) {
        priorityLabel = optionName.slice(0, 80);
      } else if (looksLikeSizeFieldName(fieldName) && size === undefined) {
        size = optionName.slice(0, 80);
      }
    } else if (fv.__typename === "ProjectV2ItemFieldNumberValue") {
      if (
        looksLikeEstimateFieldName(fieldName) &&
        estimate === undefined &&
        typeof fv.number === "number" &&
        Number.isFinite(fv.number)
      ) {
        estimate = Math.max(0, Math.round(fv.number * 100) / 100);
      }
    }
  }
  return { priorityLabel, size, estimate };
}

function issueKey(repoFullName: string, issueNumber: number): string {
  return `${repoFullName.toLowerCase()}#${issueNumber}`;
}

type ParsedImportItem = {
  title: string;
  contentKind: "draft_issue" | "issue" | "pull_request";
  statusOptionId: string;
  githubRepoFullName?: string;
  githubIssueNumber?: number;
  githubIssueNodeId?: string;
  body?: string | null;
  state?: "open" | "closed";
  htmlUrl?: string | null;
  assigneeLogins?: string[];
  labels?: string[];
  issueType?: string | null;
  milestoneTitle?: string | null;
  milestoneDueOn?: string | null;
  priorityLabel?: string;
  size?: string;
  estimate?: number;
  projectStartAt?: number;
  projectDueAt?: number;
};

function parseImportItem(
  item: unknown,
  statusFieldId: string,
): ParsedImportItem | null {
  if (!item || typeof item !== "object") return null;
  const fieldNodes = fieldValuesList(item);
  const statusOptionId = getItemStatusOptionId(fieldNodes, statusFieldId);
  if (!statusOptionId) return null;
  const projectDates = getProjectDateFields(fieldNodes);
  const projectProps = getProjectPropertyFields(fieldNodes);

  const content = (item as { content?: Record<string, unknown> | null })
    .content;
  const tn = content?.__typename;
  if (tn === "DraftIssue") {
    const c = content as { title?: string; body?: string | null };
    return {
      title: typeof c.title === "string" ? c.title : "(Uten tittel)",
      contentKind: "draft_issue",
      statusOptionId,
      body: typeof c.body === "string" ? c.body : null,
      priorityLabel: projectProps.priorityLabel,
      size: projectProps.size,
      estimate: projectProps.estimate,
      projectStartAt: projectDates.startAt,
      projectDueAt: projectDates.dueAt,
    };
  }
  if (tn === "Issue" || tn === "PullRequest") {
    const c = content as {
      title?: string;
      number?: number;
      id?: string;
      body?: string | null;
      state?: string;
      url?: string;
      assignees?: { nodes?: { login?: string; name?: string | null }[] };
      labels?: { nodes?: { name?: string }[] };
      issueType?: { name?: string } | null;
      milestone?: { title?: string; dueOn?: string | null } | null;
      repository?: { nameWithOwner?: string };
    };
    const rawRepo = c.repository?.nameWithOwner?.trim();
    let githubRepoFullName: string | undefined;
    if (rawRepo) {
      try {
        githubRepoFullName = normalizeGithubRepoFullName(rawRepo);
      } catch {
        githubRepoFullName = rawRepo.toLowerCase();
      }
    }
    const assigneeLogins = (c.assignees?.nodes ?? [])
      .map((n) => n.login?.trim() ?? "")
      .filter(Boolean);
    const labels = (c.labels?.nodes ?? [])
      .map((n) => n.name?.trim() ?? "")
      .filter(Boolean);
    const issueType =
      typeof c.issueType?.name === "string" && c.issueType.name.trim()
        ? c.issueType.name.trim()
        : null;
    return {
      title: typeof c.title === "string" ? c.title : "(Uten tittel)",
      contentKind: tn === "Issue" ? "issue" : "pull_request",
      statusOptionId,
      githubRepoFullName,
      githubIssueNumber: typeof c.number === "number" ? c.number : undefined,
      githubIssueNodeId: typeof c.id === "string" ? c.id : undefined,
      body: typeof c.body === "string" ? c.body : null,
      state: c.state === "CLOSED" || c.state === "closed" ? "closed" : "open",
      htmlUrl: typeof c.url === "string" ? c.url : null,
      assigneeLogins,
      labels,
      issueType,
      milestoneTitle: c.milestone?.title ?? null,
      milestoneDueOn: c.milestone?.dueOn ?? null,
      priorityLabel: projectProps.priorityLabel,
      size: projectProps.size,
      estimate: projectProps.estimate,
      projectStartAt: projectDates.startAt,
      projectDueAt: projectDates.dueAt,
    };
  }
  return null;
}

function matchAssigneeUserIds(
  logins: string[],
  members: { userId: Id<"users">; name: string | null; email: string | null }[],
): { matched: Id<"users">[]; unmatched: string[] } {
  const matched: Id<"users">[] = [];
  const unmatched: string[] = [];
  for (const login of logins) {
    const l = login.trim().toLowerCase();
    if (!l) continue;
    const hit = members.find((m) => {
      const email = m.email?.trim().toLowerCase() ?? "";
      const local = email.includes("@") ? email.split("@")[0]! : email;
      const name = m.name?.trim().toLowerCase() ?? "";
      return local === l || name === l || name.includes(l) || email.startsWith(`${l}@`);
    });
    if (hit) {
      if (!matched.includes(hit.userId)) matched.push(hit.userId);
    } else {
      unmatched.push(login);
    }
  }
  return { matched, unmatched };
}

/** Leser kolonner for import-action. */
export const listBoardColumnsInternal = internalQuery({
  args: {
    boardId: v.id("pulsBoards"),
  },
  returns: v.array(
    v.object({
      _id: v.id("pulsBoardColumns"),
      name: v.string(),
      isDone: v.boolean(),
      order: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    await requirePulsBoardAccess(ctx, args.boardId, "editor");
    const cols = await listColumnsForBoard(ctx, args.boardId);
    return cols.map((c) => ({
      _id: c._id,
      name: c.name,
      isDone: c.isDone,
      order: c.order,
    }));
  },
});

/** Medlemmer for å matche GitHub-assignees → Puls-brukere (kun lesing). */
export const listWorkspaceMembersForImport = internalQuery({
  args: { workspaceId: v.id("workspaces") },
  returns: v.array(
    v.object({
      userId: v.id("users"),
      name: v.union(v.string(), v.null()),
      email: v.union(v.string(), v.null()),
    }),
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Du må være innlogget.");
    await requireWorkspaceMember(ctx, args.workspaceId, userId, "member");
    const rows = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    const out: {
      userId: Id<"users">;
      name: string | null;
      email: string | null;
    }[] = [];
    for (const r of rows) {
      const u = await ctx.db.get(r.userId);
      out.push({
        userId: r.userId,
        name: u?.name ?? null,
        email: u?.email ?? null,
      });
    }
    return out;
  },
});

/**
 * Bulk-insert for GitHub → Puls import (tillater kort i ferdig-kolonne).
 * Skriver kun til Puls/Convex — aldri tilbake til GitHub.
 */
function normalizeImportLabels(
  raw: string[] | undefined,
): string[] | undefined {
  if (!raw || raw.length === 0) return undefined;
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const t = item.trim().slice(0, 40);
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
    if (out.length >= 20) break;
  }
  return out.length > 0 ? out : undefined;
}

function normalizeImportMeta(
  raw: string | null | undefined,
): string | undefined {
  if (raw == null) return undefined;
  const t = raw.trim().slice(0, 80);
  return t || undefined;
}

function normalizeImportEstimate(
  raw: number | undefined,
): number | undefined {
  if (raw === undefined || !Number.isFinite(raw)) return undefined;
  return Math.max(0, Math.round(raw * 100) / 100);
}

export const insertImportedGithubCard = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    boardId: v.id("pulsBoards"),
    assessmentId: v.id("assessments"),
    columnId: v.id("pulsBoardColumns"),
    title: v.string(),
    status: v.union(v.literal("open"), v.literal("done")),
    description: v.optional(v.string()),
    parentTaskId: v.optional(v.id("assessmentTasks")),
    startAt: v.optional(v.number()),
    dueAt: v.optional(v.number()),
    assigneeUserIds: v.optional(v.array(v.id("users"))),
    labels: v.optional(v.array(v.string())),
    issueType: v.optional(v.string()),
    priorityLabel: v.optional(v.string()),
    size: v.optional(v.string()),
    estimate: v.optional(v.number()),
    milestone: v.optional(v.string()),
    githubRepoFullName: v.optional(v.string()),
    githubIssueNumber: v.optional(v.number()),
    githubIssueNodeId: v.optional(v.string()),
  },
  returns: v.id("assessmentTasks"),
  handler: async (ctx, args) => {
    const { assessment, userId } = await requireAssessmentEdit(
      ctx,
      args.assessmentId,
    );
    if (assessment.workspaceId !== args.workspaceId) {
      throw new Error("Vurderingen tilhører ikke arbeidsområdet.");
    }
    const { board } = await requirePulsBoardAccess(
      ctx,
      args.boardId,
      "editor",
    );
    if (board.workspaceId !== args.workspaceId) {
      throw new Error("Tavlen tilhører ikke arbeidsområdet.");
    }
    const cols = await listColumnsForBoard(ctx, args.boardId);
    const col = cols.find((c) => c._id === args.columnId);
    if (!col) {
      throw new Error("Kolonnen finnes ikke på denne tavlen.");
    }
    if (args.parentTaskId) {
      const parent = await ctx.db.get(args.parentTaskId);
      if (
        !parent ||
        parent.assessmentId !== args.assessmentId ||
        parent.boardId !== args.boardId
      ) {
        throw new Error("Foreldrekortet finnes ikke på denne tavlen.");
      }
    }
    const title = args.title.trim().slice(0, 200);
    if (!title) {
      throw new Error("Oppgavetekst mangler.");
    }
    const description = args.description?.trim().slice(0, DESC_MAX) || undefined;
    let startAt = args.startAt;
    let dueAt = args.dueAt;
    if (startAt !== undefined && dueAt !== undefined && startAt > dueAt) {
      const tmp = startAt;
      startAt = dueAt;
      dueAt = tmp;
    }
    const uniqueIds = [...new Set(args.assigneeUserIds ?? [])].slice(0, 20);
    const now = Date.now();
    const assigneeStates =
      uniqueIds.length > 0
        ? buildAssigneeStates({
            assigneeIds: uniqueIds,
            actorUserId: userId,
            now,
          })
        : undefined;
    const status =
      args.status === "done" || col.isDone
        ? ("done" as const)
        : ("open" as const);
    return await ctx.db.insert("assessmentTasks", {
      workspaceId: args.workspaceId,
      assessmentId: args.assessmentId,
      boardId: args.boardId,
      columnId: args.columnId,
      title,
      description,
      parentTaskId: args.parentTaskId,
      assigneeUserId: uniqueIds[0],
      assigneeUserIds: uniqueIds.length > 0 ? uniqueIds : undefined,
      assigneeStates,
      createdByUserId: userId,
      status,
      priority: 3,
      startAt,
      dueAt,
      labels: normalizeImportLabels(args.labels),
      issueType: normalizeImportMeta(args.issueType),
      priorityLabel: normalizeImportMeta(args.priorityLabel),
      size: normalizeImportMeta(args.size),
      estimate: normalizeImportEstimate(args.estimate),
      milestone: normalizeImportMeta(args.milestone),
      dashboardRank: now,
      createdAt: now,
      githubRepoFullName: args.githubRepoFullName,
      githubIssueNumber: args.githubIssueNumber,
      githubIssueNodeId: args.githubIssueNodeId,
      githubLastSyncedAt:
        args.githubRepoFullName && args.githubIssueNumber != null
          ? now
          : undefined,
    });
  },
});

export const patchImportedGithubCard = internalMutation({
  args: {
    taskId: v.id("assessmentTasks"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    parentTaskId: v.optional(v.id("assessmentTasks")),
    startAt: v.optional(v.number()),
    dueAt: v.optional(v.number()),
    status: v.optional(v.union(v.literal("open"), v.literal("done"))),
    assigneeUserIds: v.optional(v.array(v.id("users"))),
    labels: v.optional(v.array(v.string())),
    issueType: v.optional(v.string()),
    priorityLabel: v.optional(v.string()),
    size: v.optional(v.string()),
    estimate: v.optional(v.number()),
    milestone: v.optional(v.string()),
  },
  returns: v.object({ ok: v.literal(true) }),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.taskId);
    if (!row) throw new Error("Fant ikke saken.");
    let userId: Id<"users">;
    if (row.boardId) {
      ({ userId } = await requirePulsBoardAccess(ctx, row.boardId, "editor"));
    } else if (row.assessmentId) {
      ({ userId } = await requireAssessmentEdit(ctx, row.assessmentId));
    } else {
      throw new Error("Kortet mangler tilgangskontekst.");
    }
    const patch: Record<string, unknown> = {};
    if (args.title !== undefined) {
      const t = args.title.trim().slice(0, 200);
      if (t) patch.title = t;
    }
    if (args.description !== undefined) {
      const d = args.description.trim().slice(0, DESC_MAX);
      if (d) patch.description = d;
    }
    if (args.parentTaskId !== undefined) {
      if (args.parentTaskId === args.taskId) {
        throw new Error("Et kort kan ikke være forelder til seg selv.");
      }
      const parent = await ctx.db.get(args.parentTaskId);
      if (
        !parent ||
        parent.assessmentId !== row.assessmentId ||
        parent.boardId !== row.boardId
      ) {
        throw new Error("Foreldrekortet finnes ikke på denne tavlen.");
      }
      patch.parentTaskId = args.parentTaskId;
    }
    if (args.startAt !== undefined) patch.startAt = args.startAt;
    if (args.dueAt !== undefined) patch.dueAt = args.dueAt;
    if (args.status !== undefined) patch.status = args.status;
    if (args.assigneeUserIds !== undefined) {
      const uniqueIds = [...new Set(args.assigneeUserIds)].slice(0, 20);
      patch.assigneeUserId = uniqueIds[0];
      patch.assigneeUserIds = uniqueIds.length > 0 ? uniqueIds : undefined;
      patch.assigneeStates =
        uniqueIds.length > 0
          ? buildAssigneeStates({
              assigneeIds: uniqueIds,
              actorUserId: userId,
              now: Date.now(),
            })
          : undefined;
    }
    if (args.labels !== undefined) {
      patch.labels = normalizeImportLabels(args.labels);
    }
    if (args.issueType !== undefined) {
      patch.issueType = normalizeImportMeta(args.issueType);
    }
    if (args.priorityLabel !== undefined) {
      patch.priorityLabel = normalizeImportMeta(args.priorityLabel);
    }
    if (args.size !== undefined) {
      patch.size = normalizeImportMeta(args.size);
    }
    if (args.estimate !== undefined) {
      patch.estimate = normalizeImportEstimate(args.estimate);
    }
    if (args.milestone !== undefined) {
      patch.milestone = normalizeImportMeta(args.milestone);
    }
    if (
      typeof patch.startAt === "number" &&
      typeof patch.dueAt === "number" &&
      patch.startAt > patch.dueAt
    ) {
      const tmp = patch.startAt;
      patch.startAt = patch.dueAt;
      patch.dueAt = tmp;
    }
    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(args.taskId, patch);
    }
    return { ok: true as const };
  },
});

/** Sett inn importert GitHub-kommentar uten varsler. */
export const insertImportedGithubNote = internalMutation({
  args: {
    taskId: v.id("assessmentTasks"),
    body: v.string(),
    createdAt: v.optional(v.number()),
  },
  returns: v.id("assessmentTaskNotes"),
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Fant ikke saken.");
    let userId: Id<"users">;
    if (task.boardId) {
      ({ userId } = await requirePulsBoardAccess(ctx, task.boardId, "editor"));
    } else if (task.assessmentId) {
      ({ userId } = await requireAssessmentEdit(ctx, task.assessmentId));
    } else {
      throw new Error("Kortet mangler tilgangskontekst.");
    }
    const body = args.body.trim().slice(0, NOTE_MAX);
    if (!body) throw new Error("Kommentaren er tom.");
    return await ctx.db.insert("assessmentTaskNotes", {
      workspaceId: task.workspaceId,
      assessmentId: task.assessmentId,
      taskId: args.taskId,
      authorUserId: userId,
      body,
      createdAt: args.createdAt ?? Date.now(),
    });
  },
});

/**
 * Importerer GitHub Project-kort som Puls-oppgaver.
 * Henter tittel, beskrivelse, tildelte, start/slutt, labels, kommentarer og sub-issues.
 * Endrer aldri noe på GitHub.
 */
export const importGithubProjectItemsToBoard = action({
  args: {
    workspaceId: v.id("workspaces"),
    boardId: v.id("pulsBoards"),
    assessmentId: v.id("assessments"),
    projectNodeId: v.string(),
    fieldId: v.string(),
    columnMap: v.array(
      v.object({
        githubOptionId: v.string(),
        columnName: v.string(),
      }),
    ),
    includePullRequests: v.optional(v.boolean()),
  },
  returns: v.object({
    imported: v.number(),
    subIssues: v.number(),
    comments: v.number(),
    skipped: v.number(),
    capped: v.boolean(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    imported: number;
    subIssues: number;
    comments: number;
    skipped: number;
    capped: boolean;
  }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Du må være innlogget.");
    }
    await ctx.runQuery(internal.candidates.assertMemberForWorkspace, {
      workspaceId: args.workspaceId,
      userId,
    });

    const projectNodeId = args.projectNodeId.trim();
    const fieldId = args.fieldId.trim();
    if (!projectNodeId || !fieldId) {
      throw new Error("Mangler GitHub-prosjekt eller statusfelt.");
    }
    if (args.columnMap.length === 0) {
      throw new Error("Ingen kolonnemapping å importere mot.");
    }

    const boardCols = await ctx.runQuery(
      internal.pulsGithubImport.listBoardColumnsInternal,
      { boardId: args.boardId },
    );
    type ColRef = (typeof boardCols)[number];
    const nameToColumn = new Map<string, ColRef>();
    for (const c of boardCols) {
      nameToColumn.set(c.name.trim(), c);
    }
    const optionToColumn = new Map<string, ColRef>();
    for (const m of args.columnMap) {
      const optId = m.githubOptionId.trim();
      if (!optId || optId.startsWith("__puls_")) continue;
      const col = nameToColumn.get(m.columnName.trim());
      if (col) {
        optionToColumn.set(optId, col);
      }
    }
    if (optionToColumn.size === 0) {
      throw new Error("Fant ingen matchende Puls-kolonner for GitHub-status.");
    }

    const members = await ctx.runQuery(
      internal.pulsGithubImport.listWorkspaceMembersForImport,
      { workspaceId: args.workspaceId },
    );

    // Token brukes kun til GET/query
    const token = await resolveGithubToken(ctx, args.workspaceId);
    await fetchProjectStatusFieldOptions(token, projectNodeId, fieldId);

    const includePrs = args.includePullRequests === true;
    const parsed: ParsedImportItem[] = [];
    let after: string | null = null;
    let pages = 0;
    let capped = false;

    while (pages < MAX_PAGES) {
      pages += 1;
      const json = await githubGraphqlReadOnly(
        token,
        PROJECT_ITEMS_PAGE_QUERY,
        {
          id: projectNodeId,
          after,
        },
      );
      const node = (
        json.data as {
          node?: {
            items?: {
              pageInfo?: { hasNextPage?: boolean; endCursor?: string | null };
              nodes?: unknown[];
            };
          };
        }
      )?.node;
      const conn = node?.items;
      const nodes = Array.isArray(conn?.nodes) ? conn!.nodes! : [];
      for (const item of nodes) {
        const row = parseImportItem(item, fieldId);
        if (!row) continue;
        if (row.contentKind === "pull_request" && !includePrs) continue;
        if (!optionToColumn.has(row.statusOptionId)) continue;
        parsed.push(row);
        if (parsed.length >= MAX_IMPORT_ITEMS) {
          capped = true;
          break;
        }
      }
      if (capped) break;
      const pageInfo = conn?.pageInfo;
      if (!pageInfo?.hasNextPage || !pageInfo.endCursor) break;
      after = pageInfo.endCursor;
    }

    const byIssueKey = new Map<string, Id<"assessmentTasks">>();
    type EnrichTarget = {
      taskId: Id<"assessmentTasks">;
      repoFullName: string;
      issueNumber: number;
      columnId: Id<"pulsBoardColumns">;
      /** Datoer/metadata allerede hentet fra prosjekt-query */
      seed: ParsedImportItem;
    };
    const enrichQueue: EnrichTarget[] = [];

    let imported = 0;
    let skipped = 0;
    let subIssuesImported = 0;
    let commentsImported = 0;

    for (const row of parsed) {
      const col = optionToColumn.get(row.statusOptionId);
      if (!col) {
        skipped += 1;
        continue;
      }
      const title = row.title.trim();
      if (!title) {
        skipped += 1;
        continue;
      }

      const logins = row.assigneeLogins ?? [];
      const { matched, unmatched } = matchAssigneeUserIds(logins, members);
      const dueAt =
        row.projectDueAt ?? parseGithubDateToMs(row.milestoneDueOn ?? undefined);
      const startAt = row.projectStartAt;
      const description = buildImportedDescription({
        body: row.body ?? null,
        htmlUrl: row.htmlUrl,
        unmatchedAssigneeLogins: unmatched,
      });

      try {
        const taskId = await ctx.runMutation(
          internal.pulsGithubImport.insertImportedGithubCard,
          {
            workspaceId: args.workspaceId,
            boardId: args.boardId,
            assessmentId: args.assessmentId,
            columnId: col._id,
            title,
            status:
              col.isDone || row.state === "closed" ? "done" : "open",
            description,
            startAt,
            dueAt,
            assigneeUserIds: matched.length > 0 ? matched : undefined,
            labels: row.labels,
            issueType: row.issueType ?? undefined,
            priorityLabel: row.priorityLabel,
            size: row.size,
            estimate: row.estimate,
            milestone: row.milestoneTitle ?? undefined,
            githubRepoFullName:
              row.contentKind === "issue" || row.contentKind === "pull_request"
                ? row.githubRepoFullName
                : undefined,
            githubIssueNumber:
              row.contentKind === "issue" || row.contentKind === "pull_request"
                ? row.githubIssueNumber
                : undefined,
            githubIssueNodeId:
              row.contentKind === "issue" || row.contentKind === "pull_request"
                ? row.githubIssueNodeId
                : undefined,
          },
        );
        imported += 1;
        if (
          row.contentKind === "issue" &&
          row.githubRepoFullName &&
          row.githubIssueNumber != null
        ) {
          byIssueKey.set(
            issueKey(row.githubRepoFullName, row.githubIssueNumber),
            taskId,
          );
          enrichQueue.push({
            taskId,
            repoFullName: row.githubRepoFullName,
            issueNumber: row.githubIssueNumber,
            columnId: col._id,
            seed: row,
          });
        }
      } catch {
        skipped += 1;
      }
    }

    for (const target of enrichQueue) {
      const parts = target.repoFullName.split("/").filter(Boolean);
      if (parts.length !== 2) continue;
      const [owner, repo] = parts;

      // REST GET for full issue (tittel/body/assignees/datoer) — overskriver med fersk data
      try {
        const details = await fetchGithubIssueDetails(
          token,
          owner,
          repo,
          target.issueNumber,
        );
        if (details) {
          const { matched, unmatched } = matchAssigneeUserIds(
            details.assignees.map((a) => a.login),
            members,
          );
          const dueAt =
            target.seed.projectDueAt ??
            parseGithubDateToMs(details.milestoneDueOn ?? undefined);
          const startAt = target.seed.projectStartAt;
          const description = buildImportedDescription({
            body: details.body,
            htmlUrl: details.htmlUrl,
            unmatchedAssigneeLogins: unmatched,
          });
          await ctx.runMutation(
            internal.pulsGithubImport.patchImportedGithubCard,
            {
              taskId: target.taskId,
              title: details.title,
              description,
              startAt,
              dueAt,
              status: details.state === "closed" ? "done" : undefined,
              assigneeUserIds: matched.length > 0 ? matched : undefined,
              labels: details.labels,
              issueType:
                details.issueType ?? target.seed.issueType ?? undefined,
              priorityLabel: target.seed.priorityLabel,
              size: target.seed.size,
              estimate: target.seed.estimate,
              milestone:
                details.milestoneTitle ??
                target.seed.milestoneTitle ??
                undefined,
            },
          );
        }
      } catch {
        /* detaljer er valgfrie */
      }

      try {
        const parentComments = await fetchGithubIssueComments(
          token,
          owner,
          repo,
          target.issueNumber,
          MAX_COMMENTS_PER_ISSUE,
        );
        for (const c of parentComments) {
          try {
            await ctx.runMutation(
              internal.pulsGithubImport.insertImportedGithubNote,
              {
                taskId: target.taskId,
                body: formatImportedGithubCommentBody(
                  c.authorLogin,
                  c.body,
                  c.createdAt,
                ),
                createdAt: c.createdAt
                  ? Date.parse(c.createdAt) || Date.now()
                  : Date.now(),
              },
            );
            commentsImported += 1;
          } catch {
            /* hopp over enkeltkommentar */
          }
        }
      } catch {
        /* kommentarer er valgfrie */
      }

      let subs: Awaited<ReturnType<typeof listGithubSubIssues>> = [];
      try {
        subs = await listGithubSubIssues(
          token,
          target.repoFullName,
          target.issueNumber,
          MAX_SUB_ISSUES_PER_PARENT,
        );
      } catch {
        continue;
      }

      for (const sub of subs) {
        const key = issueKey(sub.repoFullName, sub.number);
        const existingId = byIssueKey.get(key);
        if (existingId) {
          if (existingId !== target.taskId) {
            try {
              await ctx.runMutation(
                internal.pulsGithubImport.patchImportedGithubCard,
                {
                  taskId: existingId,
                  parentTaskId: target.taskId,
                },
              );
            } catch {
              /* ignore */
            }
          }
          continue;
        }

        const { matched, unmatched } = matchAssigneeUserIds(
          sub.assignees.map((a) => a.login),
          members,
        );
        const description = buildImportedDescription({
          body: sub.body,
          htmlUrl: sub.htmlUrl,
          unmatchedAssigneeLogins: unmatched,
        });

        try {
          const childId = await ctx.runMutation(
            internal.pulsGithubImport.insertImportedGithubCard,
            {
              workspaceId: args.workspaceId,
              boardId: args.boardId,
              assessmentId: args.assessmentId,
              columnId: target.columnId,
              title: sub.title,
              status: sub.state === "closed" ? "done" : "open",
              description,
              parentTaskId: target.taskId,
              dueAt: parseGithubDateToMs(sub.milestoneDueOn ?? undefined),
              assigneeUserIds: matched.length > 0 ? matched : undefined,
              labels: sub.labels,
              issueType: sub.issueType ?? undefined,
              milestone: sub.milestoneTitle ?? undefined,
              githubRepoFullName: sub.repoFullName,
              githubIssueNumber: sub.number,
              githubIssueNodeId: sub.nodeId,
            },
          );
          byIssueKey.set(key, childId);
          subIssuesImported += 1;

          const subParts = sub.repoFullName.split("/").filter(Boolean);
          if (subParts.length === 2) {
            try {
              const childComments = await fetchGithubIssueComments(
                token,
                subParts[0]!,
                subParts[1]!,
                sub.number,
                MAX_COMMENTS_PER_ISSUE,
              );
              for (const c of childComments) {
                try {
                  await ctx.runMutation(
                    internal.pulsGithubImport.insertImportedGithubNote,
                    {
                      taskId: childId,
                      body: formatImportedGithubCommentBody(
                        c.authorLogin,
                        c.body,
                        c.createdAt,
                      ),
                      createdAt: c.createdAt
                        ? Date.parse(c.createdAt) || Date.now()
                        : Date.now(),
                    },
                  );
                  commentsImported += 1;
                } catch {
                  /* ignore */
                }
              }
            } catch {
              /* ignore */
            }
          }
        } catch {
          skipped += 1;
        }
      }
    }

    return {
      imported,
      subIssues: subIssuesImported,
      comments: commentsImported,
      skipped,
      capped,
    };
  },
});
