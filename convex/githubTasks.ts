import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { ActionCtx } from "./_generated/server";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import {
  canEditAssessment,
  getWorkspaceMembership,
  requireAssessmentEdit,
  requireUserId,
  requireWorkspaceMember,
} from "./lib/access";
import { normalizeGithubRepoFullName, parseGithubIssueUrl } from "./lib/github";

const GITHUB_API_HEADERS = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
} as const;

/** Parser `Link`-header for `rel="next"` (GitHub REST paginering). */
function parseGithubNextLinkUrl(linkHeader: string | null): string | null {
  if (!linkHeader) {
    return null;
  }
  const m = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
  return m?.[1] ?? null;
}

/**
 * Henter alle sider fra en Projects v2-liste-URL (array-respons).
 * @see https://docs.github.com/en/rest/projects/projects
 */
async function fetchProjectsV2ListFromUrl(
  token: string,
  firstUrl: string,
): Promise<{ id: string; title: string }[] | null> {
  const out: { id: string; title: string }[] = [];
  let url: string | null = firstUrl;
  let isFirst = true;
  while (url) {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        ...GITHUB_API_HEADERS,
      },
    });
    if (res.status !== 200) {
      return isFirst ? null : out;
    }
    const raw = (await res.json()) as unknown;
    if (!Array.isArray(raw)) {
      return isFirst ? null : out;
    }
    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      const row = item as { node_id?: string; title?: string };
      if (typeof row.node_id === "string" && row.node_id.length > 0) {
        out.push({
          id: row.node_id,
          title: typeof row.title === "string" ? row.title : "",
        });
      }
    }
    isFirst = false;
    url = parseGithubNextLinkUrl(res.headers.get("link"));
  }
  return out;
}

/** Medlemskap: trengs for å liste org-eide Projects v2 via REST. */
async function listGithubOrgLoginsForToken(token: string): Promise<string[]> {
  const logins: string[] = [];
  let url: string | null =
    "https://api.github.com/user/orgs?per_page=100";
  while (url) {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        ...GITHUB_API_HEADERS,
      },
    });
    if (res.status !== 200) {
      break;
    }
    const raw = (await res.json()) as unknown;
    if (!Array.isArray(raw)) {
      break;
    }
    for (const o of raw) {
      if (!o || typeof o !== "object") continue;
      const login = (o as { login?: string }).login;
      if (typeof login === "string" && login.length > 0) {
        logins.push(login);
      }
    }
    url = parseGithubNextLinkUrl(res.headers.get("link"));
  }
  return logins;
}

/**
 * Projects v2: REST returnerer `node_id` (GraphQL global id). Samme token kan ofte
 * få 200 her selv om GraphQL `projectV2` sier «Resource not accessible» (fine-grained).
 * @see https://docs.github.com/en/rest/projects/projects
 */
async function fetchProjectV2NodeViaRest(
  token: string,
  ownerKind: "user" | "organization",
  login: string,
  projectNumber: number,
): Promise<{ id: string; title: string } | null> {
  const path =
    ownerKind === "user"
      ? `users/${encodeURIComponent(login)}/projectsV2/${projectNumber}`
      : `orgs/${encodeURIComponent(login)}/projectsV2/${projectNumber}`;
  const res = await fetch(`https://api.github.com/${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      ...GITHUB_API_HEADERS,
    },
  });
  if (res.status !== 200) {
    return null;
  }
  const j = (await res.json()) as { node_id?: unknown; title?: unknown };
  if (typeof j.node_id !== "string" || j.node_id.length === 0) {
    return null;
  }
  return {
    id: j.node_id,
    title: typeof j.title === "string" ? j.title : "",
  };
}

/**
 * Lister tilgjengelige Projects v2 via REST: bruker + alle orgs tokenet ser via /user/orgs.
 * Dekker org-eide tavler når kun bruker-liste er tom eller feiler.
 * @see https://docs.github.com/en/rest/projects/projects
 */
async function listAllProjectsV2ViaRest(
  token: string,
): Promise<{ id: string; title: string }[] | null> {
  const login = await githubRestAuthenticatedLogin(token);
  if (!login) {
    return null;
  }
  const byId = new Map<string, { id: string; title: string }>();

  const userList = await fetchProjectsV2ListFromUrl(
    token,
    `https://api.github.com/users/${encodeURIComponent(login)}/projectsV2?per_page=100`,
  );
  if (userList !== null) {
    for (const p of userList) {
      byId.set(p.id, p);
    }
  }

  const orgs = await listGithubOrgLoginsForToken(token);
  for (const org of orgs) {
    const orgList = await fetchProjectsV2ListFromUrl(
      token,
      `https://api.github.com/orgs/${encodeURIComponent(org)}/projectsV2?per_page=100`,
    );
    if (orgList) {
      for (const p of orgList) {
        if (!byId.has(p.id)) {
          byId.set(p.id, p);
        }
      }
    }
  }

  if (byId.size === 0 && userList === null) {
    return null;
  }
  return Array.from(byId.values()).sort((a, b) =>
    a.title.localeCompare(b.title, "nb"),
  );
}

export async function resolveGithubToken(
  ctx: ActionCtx,
  workspaceId: Id<"workspaces">,
): Promise<string> {
  const fromDb = await ctx.runQuery(
    internal.githubTasks.getGithubTokenForWorkspace,
    { workspaceId },
  );
  const token = fromDb ?? process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error(
      "GitHub er ikke konfigurert: legg inn personal access token under arbeidsområdets innstillinger (fine-grained eller klassisk), eller sett GITHUB_TOKEN i Convex-miljøet som reserve.",
    );
  }
  return token;
}

export const getGithubTokenForWorkspace = internalQuery({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("workspaceGithubSecrets")
      .withIndex("by_workspace", (q) =>
        q.eq("workspaceId", args.workspaceId),
      )
      .first();
    return row?.token ?? null;
  },
});

export const getWorkspaceDoc = internalQuery({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.workspaceId);
  },
});

export const assertWorkspaceAdmin = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const m = await getWorkspaceMembership(
      ctx,
      args.workspaceId,
      args.userId,
    );
    if (!m) {
      return false;
    }
    return m.role === "owner" || m.role === "admin";
  },
});

export const getWorkspaceGithubProjectNodeId = internalQuery({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const w = await ctx.db.get(args.workspaceId);
    const raw = w?.githubProjectNodeId;
    return typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : null;
  },
});

export const getTaskForAction = internalQuery({
  args: { taskId: v.id("assessmentTasks") },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) return null;
    const workspace = await ctx.db.get(task.workspaceId);
    return { task, workspace };
  },
});

export const assertCanEditTask = internalQuery({
  args: {
    taskId: v.id("assessmentTasks"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.taskId);
    if (!row) {
      return { ok: false as const };
    }
    const assessment = await ctx.db.get(row.assessmentId);
    if (!assessment) {
      return { ok: false as const };
    }
    const can = await canEditAssessment(ctx, assessment, args.userId);
    if (!can) {
      return { ok: false as const };
    }
    const workspace = await ctx.db.get(row.workspaceId);
    return {
      ok: true as const,
      task: row,
      workspace,
    };
  },
});

export const applyCreatedIssue = internalMutation({
  args: {
    taskId: v.id("assessmentTasks"),
    githubRepoFullName: v.string(),
    githubIssueNumber: v.number(),
    githubIssueNodeId: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.patch(args.taskId, {
      githubRepoFullName: args.githubRepoFullName,
      githubIssueNumber: args.githubIssueNumber,
      githubIssueNodeId: args.githubIssueNodeId,
      githubLastSyncedAt: now,
    });
  },
});

export const applyWebhookIssueState = internalMutation({
  args: {
    repoFullName: v.string(),
    issueNumber: v.number(),
    state: v.union(v.literal("open"), v.literal("closed")),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("assessmentTasks")
      .withIndex("by_github_issue", (q) =>
        q
          .eq("githubRepoFullName", args.repoFullName)
          .eq("githubIssueNumber", args.issueNumber),
      )
      .first();
    if (!row) {
      return { updated: false as const };
    }
    const status = args.state === "closed" ? ("done" as const) : ("open" as const);
    if (row.status !== status) {
      await ctx.db.patch(row._id, { status });
    }
    return { updated: true as const, taskId: row._id };
  },
});

export const createIssueAction = internalAction({
  args: {
    taskId: v.id("assessmentTasks"),
    repoFullName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const data: {
      task: Doc<"assessmentTasks">;
      workspace: Doc<"workspaces"> | null;
    } | null = await ctx.runQuery(internal.githubTasks.getTaskForAction, {
      taskId: args.taskId,
    });
    if (!data?.task || !data.workspace) {
      throw new Error("Fant ikke oppgaven.");
    }
    const { task, workspace } = data;
    if (
      task.githubIssueNumber != null &&
      task.githubRepoFullName !== undefined
    ) {
      throw new Error("Oppgaven er allerede koblet til et GitHub-issue.");
    }
    const defaultRepos =
      workspace.githubDefaultRepoFullNames?.filter(Boolean) ?? [];
    const legacy = workspace.githubDefaultRepoFullName;
    const firstDefault =
      defaultRepos.length > 0
        ? defaultRepos[0]
        : legacy !== undefined
          ? legacy
          : null;
    const repo = args.repoFullName
      ? normalizeGithubRepoFullName(args.repoFullName)
      : firstDefault;
    if (!repo) {
      throw new Error(
        "Sett standard GitHub-repo i arbeidsområdeinnstillinger, eller oppgi repo ved opprettelse.",
      );
    }
    const token = await resolveGithubToken(ctx, task.workspaceId);
    const [owner, repoName] = repo.split("/");
    const title = task.title;
    const body = task.description ?? "";
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repoName}/issues`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          ...GITHUB_API_HEADERS,
        },
        body: JSON.stringify({ title, body }),
      },
    );
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(
        `GitHub kunne ikke opprette issue (${res.status}). ${errText.slice(0, 280)}`,
      );
    }
    const issue = (await res.json()) as {
      number: number;
      node_id: string;
    };
    await ctx.runMutation(internal.githubTasks.applyCreatedIssue, {
      taskId: args.taskId,
      githubRepoFullName: repo,
      githubIssueNumber: issue.number,
      githubIssueNodeId: issue.node_id,
    });
    if (workspace.githubProjectNodeId) {
      await ctx.runAction(internal.githubTasks.addIssueToProjectAction, {
        workspaceId: task.workspaceId,
        projectNodeId: workspace.githubProjectNodeId,
        issueNodeId: issue.node_id,
      });
    }
  },
});

export const addIssueToProjectAction = internalAction({
  args: {
    workspaceId: v.id("workspaces"),
    projectNodeId: v.string(),
    issueNodeId: v.string(),
  },
  handler: async (ctx, args) => {
    const token = await resolveGithubToken(ctx, args.workspaceId);
    const res = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: `mutation($projectId:ID!,$contentId:ID!){
          addProjectV2ItemById(input:{projectId:$projectId,contentId:$contentId}) {
            item { id }
          }
        }`,
        variables: {
          projectId: args.projectNodeId,
          contentId: args.issueNodeId,
        },
      }),
    });
    const bodyText = await res.text();
    let json: {
      data?: {
        addProjectV2ItemById?: { item?: { id?: string } | null } | null;
      };
      errors?: { message: string }[];
    };
    try {
      json = JSON.parse(bodyText) as typeof json;
    } catch {
      throw new Error(
        `Issue er opprettet i GitHub, men prosjekt-tillegg feilet (ugyldig svar, HTTP ${res.status}). ${bodyText.slice(0, 200)}`,
      );
    }
    if (!res.ok) {
      throw new Error(
        `Issue er opprettet i GitHub, men prosjekt-API feilet (HTTP ${res.status}). ${bodyText.slice(0, 240)}`,
      );
    }
    if (json.errors?.length) {
      const raw = json.errors.map((e) => e.message).join("; ");
      throw new Error(
        `Issue er opprettet og koblet i PVV, men GitHub la det ikke i prosjektet: ${raw}. Sjekk PAT (Projects), node-ID (PVT_…), og at prosjektet kan inneholde issues fra dette repoet.`,
      );
    }
  },
});

export const syncFromGithubAction = internalAction({
  args: { taskId: v.id("assessmentTasks") },
  handler: async (ctx, args) => {
    const data: {
      task: Doc<"assessmentTasks">;
      workspace: Doc<"workspaces"> | null;
    } | null = await ctx.runQuery(internal.githubTasks.getTaskForAction, {
      taskId: args.taskId,
    });
    if (!data?.task) {
      throw new Error("Fant ikke oppgaven.");
    }
    const { task } = data;
    if (task.githubRepoFullName === undefined || task.githubIssueNumber == null) {
      throw new Error("Oppgaven er ikke koblet til et GitHub-issue.");
    }
    const token = await resolveGithubToken(ctx, task.workspaceId);
    const [owner, repoName] = task.githubRepoFullName.split("/");
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repoName}/issues/${task.githubIssueNumber}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          ...GITHUB_API_HEADERS,
        },
      },
    );
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(
        `GitHub: ${res.status} ${errText.slice(0, 200)}`,
      );
    }
    const issue = (await res.json()) as {
      title: string;
      body: string | null;
      state: string;
    };
    const status = issue.state === "closed" ? ("done" as const) : ("open" as const);
    await ctx.runMutation(internal.githubTasks.applySyncFromGithub, {
      taskId: args.taskId,
      title: issue.title,
      description: issue.body ?? "",
      status,
    });
  },
});

export const applySyncFromGithub = internalMutation({
  args: {
    taskId: v.id("assessmentTasks"),
    title: v.string(),
    description: v.string(),
    status: v.union(v.literal("open"), v.literal("done")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.patch(args.taskId, {
      title: args.title.trim() || "Uten tittel",
      description: args.description.trim() || undefined,
      status: args.status,
      githubLastSyncedAt: now,
    });
  },
});

export const pushToGithubAction = internalAction({
  args: { taskId: v.id("assessmentTasks") },
  handler: async (ctx, args) => {
    const data: {
      task: Doc<"assessmentTasks">;
      workspace: Doc<"workspaces"> | null;
    } | null = await ctx.runQuery(internal.githubTasks.getTaskForAction, {
      taskId: args.taskId,
    });
    if (!data?.task) {
      throw new Error("Fant ikke oppgaven.");
    }
    const { task } = data;
    if (task.githubRepoFullName === undefined || task.githubIssueNumber == null) {
      throw new Error("Oppgaven er ikke koblet til et GitHub-issue.");
    }
    const token = await resolveGithubToken(ctx, task.workspaceId);
    const [owner, repoName] = task.githubRepoFullName.split("/");
    const state = task.status === "done" ? "closed" : "open";
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repoName}/issues/${task.githubIssueNumber}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          ...GITHUB_API_HEADERS,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: task.title,
          body: task.description ?? "",
          state,
        }),
      },
    );
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(
        `GitHub: ${res.status} ${errText.slice(0, 200)}`,
      );
    }
    await ctx.runMutation(internal.githubTasks.touchGithubSynced, {
      taskId: args.taskId,
    });
  },
});

export const touchGithubSynced = internalMutation({
  args: { taskId: v.id("assessmentTasks") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.taskId, { githubLastSyncedAt: Date.now() });
  },
});

export const upsertWorkspaceGithubToken = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    token: v.string(),
    updatedByUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("workspaceGithubSecrets")
      .withIndex("by_workspace", (q) =>
        q.eq("workspaceId", args.workspaceId),
      )
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        token: args.token,
        updatedAt: now,
        updatedByUserId: args.updatedByUserId,
      });
    } else {
      await ctx.db.insert("workspaceGithubSecrets", {
        workspaceId: args.workspaceId,
        token: args.token,
        updatedAt: now,
        updatedByUserId: args.updatedByUserId,
      });
    }
  },
});

export const setWorkspaceGithubToken = action({
  args: {
    workspaceId: v.id("workspaces"),
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Du må være innlogget.");
    }
    const ok = await ctx.runQuery(internal.githubTasks.assertWorkspaceAdmin, {
      workspaceId: args.workspaceId,
      userId,
    });
    if (!ok) {
      throw new Error("Kun administratorer kan sette GitHub-token.");
    }
    const trimmed = args.token.trim();
    if (!trimmed) {
      throw new Error("Token kan ikke være tomt.");
    }
    const r = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${trimmed}`,
        ...GITHUB_API_HEADERS,
      },
    });
    if (!r.ok) {
      const t = await r.text();
      throw new Error(
        `GitHub godtok ikke tokenet (${r.status}). For fine-grained PAT: gi tilgang til riktig org/repo og nødvendige rettigheter (Issues, Metadata m.m.). ${t.slice(0, 160)}`,
      );
    }
    await ctx.runMutation(internal.githubTasks.upsertWorkspaceGithubToken, {
      workspaceId: args.workspaceId,
      token: trimmed,
      updatedByUserId: userId,
    });
  },
});

export type TestGithubWorkspaceConnectionResult =
  | {
      ok: true;
      login: string;
      name: string | null;
      tokenSource: "workspace" | "convex_env";
      /** Antall Projects v2 som ble funnet via REST (bruker + org). */
      projectsV2RestCount?: number;
    }
  | { ok: false; message: string };

/**
 * Verifiserer at PAT (arbeidsområde eller GITHUB_TOKEN i Convex) faktisk fungerer mot GitHub API.
 */
export const testGithubWorkspaceConnection = action({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args): Promise<TestGithubWorkspaceConnectionResult> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Du må være innlogget.");
    }
    const admin = await ctx.runQuery(internal.githubTasks.assertWorkspaceAdmin, {
      workspaceId: args.workspaceId,
      userId,
    });
    if (!admin) {
      throw new Error("Kun administratorer kan teste GitHub-koblingen.");
    }

    const fromDb: string | null = await ctx.runQuery(
      internal.githubTasks.getGithubTokenForWorkspace,
      { workspaceId: args.workspaceId },
    );
    const token: string | undefined = fromDb ?? process.env.GITHUB_TOKEN;
    if (!token) {
      return {
        ok: false as const,
        message:
          "Ingen token konfigurert: legg inn PAT over, eller sett GITHUB_TOKEN i Convex-miljøet.",
      };
    }

    const res: Response = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${token}`,
        ...GITHUB_API_HEADERS,
      },
    });
    if (!res.ok) {
      const t = await res.text();
      return {
        ok: false,
        message: `GitHub avviste tokenet (HTTP ${res.status}). ${t.slice(0, 240)}`,
      };
    }
    const u = (await res.json()) as {
      login?: string;
      name?: string | null;
    };
    const restProjects = await listAllProjectsV2ViaRest(token);
    return {
      ok: true,
      login: typeof u.login === "string" ? u.login : "",
      name: typeof u.name === "string" ? u.name : null,
      tokenSource: fromDb ? "workspace" : "convex_env",
      ...(restProjects !== null
        ? { projectsV2RestCount: restProjects.length }
        : {}),
    };
  },
});

export type TestGithubProjectAccessResult =
  | {
      ok: true;
      projectTitle: string;
      projectNodeId: string;
    }
  | { ok: false; message: string };

/**
 * Leser lagret prosjekt-node-ID via GraphQL (bekrefter at token kan se prosjektet).
 * Full «legg issue i prosjekt» testes ved å opprette et issue fra en oppgave.
 */
export const testGithubProjectAccess = action({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args): Promise<TestGithubProjectAccessResult> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Du må være innlogget.");
    }
    const admin = await ctx.runQuery(internal.githubTasks.assertWorkspaceAdmin, {
      workspaceId: args.workspaceId,
      userId,
    });
    if (!admin) {
      throw new Error("Kun administratorer kan teste prosjekt-koblingen.");
    }
    const projectNodeId = await ctx.runQuery(
      internal.githubTasks.getWorkspaceGithubProjectNodeId,
      { workspaceId: args.workspaceId },
    );
    if (!projectNodeId) {
      return {
        ok: false,
        message:
          "Ingen prosjekt-node-ID er lagret. Hent eller lim inn PVT_… og trykk «Lagre repo og prosjekt».",
      };
    }
    const token = await resolveGithubToken(ctx, args.workspaceId);
    const res = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: `query($id: ID!) {
          node(id: $id) {
            ... on ProjectV2 {
              id
              title
            }
          }
        }`,
        variables: { id: projectNodeId },
      }),
    });
    const bodyText = await res.text();
    let json: {
      data?: { node?: { id?: string; title?: string } | null };
      errors?: { message: string }[];
    };
    try {
      json = JSON.parse(bodyText) as typeof json;
    } catch {
      return {
        ok: false,
        message: `Ugyldig svar fra GitHub (HTTP ${res.status}). ${bodyText.slice(0, 200)}`,
      };
    }
    if (!res.ok) {
      return {
        ok: false,
        message: `GitHub (${res.status}): ${bodyText.slice(0, 240)}`,
      };
    }
    if (json.errors?.length) {
      return {
        ok: false,
        message:
          json.errors[0]?.message ??
          "GraphQL kunne ikke lese prosjektet (sjekk token og node-ID).",
      };
    }
    const node = json.data?.node;
    if (!node?.id || typeof node.title !== "string") {
      return {
        ok: false,
        message:
          "Fant ikke prosjektet for denne node-ID-en (feil ID eller manglende tilgang).",
      };
    }
    return {
      ok: true,
      projectTitle: node.title,
      projectNodeId: node.id,
    };
  },
});

export const getWorkspaceGithubTokenStatus = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }
    await requireWorkspaceMember(ctx, args.workspaceId, userId, "admin");
    const row = await ctx.db
      .query("workspaceGithubSecrets")
      .withIndex("by_workspace", (q) =>
        q.eq("workspaceId", args.workspaceId),
      )
      .first();
    return {
      hasWorkspaceToken: row !== null,
      updatedAt: row?.updatedAt ?? null,
    };
  },
});

export const clearWorkspaceGithubToken = mutation({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireWorkspaceMember(ctx, args.workspaceId, userId, "admin");
    const existing = await ctx.db
      .query("workspaceGithubSecrets")
      .withIndex("by_workspace", (q) =>
        q.eq("workspaceId", args.workspaceId),
      )
      .first();
    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

function isGithubGraphqlProjectsPermissionError(raw: string): boolean {
  const lower = raw.toLowerCase();
  return (
    lower.includes("resource not accessible") ||
    lower.includes("not accessible by personal access token") ||
    lower.includes("insufficient_scope") ||
    lower.includes("permission denied")
  );
}

function graphqlProjectsAccessDeniedMessage(raw: string): string | null {
  if (!isGithubGraphqlProjectsPermissionError(raw)) {
    return null;
  }
  return (
    "Tokenet har ikke tilgang til å liste GitHub-prosjekt (Projects v2). " +
    "For fine-grained PAT: på token-siden er det to faner — «Repositories» og «Account». " +
    "Under «Account» må **Projects** være satt til minst les (eller les/skriv). " +
    "Hvis fanen «Account» viser 0 tillatelser, er det der feilen sitter — repo-tillatelser (Issues, Actions m.m.) gir ikke tilgang til prosjekt-listen. " +
    "Klassisk token med read:project er ofte enklest. " +
    "Org-prosjekter: legg til organisasjonen under «Repository and organization access» og gi Projects for den orgen. " +
    "Alternativt: lim inn node-ID (PVT_…) manuelt — da trengs ikke listen."
  );
}

/**
 * Tilgang nektet ved henting av ett prosjekt (node-ID). Org-prosjekter krever
 * eksplisitt org-tilgang på fine-grained PAT — ikke bare Account → Projects.
 */
function graphqlProjectsAccessDeniedMessageResolve(
  raw: string,
  ownerKind: "user" | "organization",
): string | null {
  if (!isGithubGraphqlProjectsPermissionError(raw)) {
    return null;
  }
  const classic =
    "Klassisk personal access token med omfanget read:project (og nødvendige repo-omfang) er ofte mest pålitelig for Projects v2. ";

  if (ownerKind === "organization") {
    return (
      "Tokenet har ikke tilgang til dette organisasjonsprosjektet (Projects v2). " +
      "For fine-grained: under «Repository and organization access», legg til denne organisasjonen og gi «Projects» (les eller les/skriv). " +
      "Kun «Account permissions» → Projects gir ikke alltid tilgang til org-prosjekter; org kan også kreve godkjenning av tokenet. " +
      classic +
      "Alternativt: kopier node-ID (PVT_…) fra prosjektets URL eller utviklerverktøy og lim inn under."
    );
  }

  return (
    "Tokenet har ikke tilgang til dette brukerprosjektet (Projects v2). " +
    "Fine-grained: på token-siden, fanen «Account» (ved siden av «Repositories») — sett **Projects** der; repo-tillatelser alene holder ikke. " +
    "Sørg for at PAT er for samme GitHub-bruker som eier prosjektet. " +
    classic +
    "Alternativt: lim inn node-ID (PVT_…) manuelt under."
  );
}

/** Når viewer, organization og user er forsøkt — unngå misvisende «kun bruker»-tekst. */
function graphqlProjectsAccessDeniedMessageResolveAny(raw: string): string | null {
  if (!isGithubGraphqlProjectsPermissionError(raw)) {
    return null;
  }
  return (
    "Tokenet har ikke tilgang til prosjektet via GraphQL (forsøkte viewer, organisasjon og bruker). " +
    "Fine-grained: under «Account» på token-siden, sett **Projects** (ikke bare repo-tillatelser). " +
    "Org-prosjekter: legg til org under «Repository and organization access» og gi Projects for orgen. " +
    "Klassisk token med read:project er ofte enklest. " +
    "Alternativt: lim inn node-ID (PVT_…) manuelt."
  );
}

type GithubGqlProjectV2Response = {
  data?: {
    viewer?: { projectV2?: { id?: string; title?: string } | null };
    user?: { projectV2?: { id?: string; title?: string } | null };
    organization?: { projectV2?: { id?: string; title?: string } | null };
  };
  errors?: { message: string }[];
};

function projectV2FromGithubGql(
  json: GithubGqlProjectV2Response,
  kind: "viewer" | "user" | "organization",
): { id: string; title: string } | null {
  const p =
    kind === "viewer"
      ? json.data?.viewer?.projectV2
      : kind === "user"
        ? json.data?.user?.projectV2
        : json.data?.organization?.projectV2;
  if (p?.id && typeof p.id === "string") {
    return { id: p.id, title: typeof p.title === "string" ? p.title : "" };
  }
  return null;
}

async function githubRestAuthenticatedLogin(token: string): Promise<string | null> {
  const res = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${token}`,
      ...GITHUB_API_HEADERS,
    },
  });
  if (!res.ok) {
    return null;
  }
  const j = (await res.json()) as { login?: string };
  return typeof j.login === "string" ? j.login : null;
}

/** Lister prosjekter tilknyttet innlogget GitHub-bruker (Projects v2). Krever prosjekttilgang på PAT. */
export const listGithubProjectsForWorkspace = action({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Du må være innlogget.");
    }
    const ok = await ctx.runQuery(internal.githubTasks.assertWorkspaceAdmin, {
      workspaceId: args.workspaceId,
      userId,
    });
    if (!ok) {
      throw new Error("Kun administratorer kan hente prosjekter.");
    }
    const token = await resolveGithubToken(ctx, args.workspaceId);

    /** REST: bruker + org-prosjekter (GraphQL viewer.projectsV2 feiler ofte med fine-grained). */
    const restList = await listAllProjectsV2ViaRest(token);
    if (restList !== null && restList.length > 0) {
      return restList;
    }

    const res = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: `query {
          viewer {
            projectsV2(first: 50) {
              nodes { id title }
            }
          }
        }`,
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      const friendly = graphqlProjectsAccessDeniedMessage(t);
      const restHint =
        restList === null
          ? " (REST fikk ikke listet prosjekter — sjekk «Account»-fanen på fine-grained token og sett Projects.)"
          : restList.length === 0
            ? " (REST returnerte 0 prosjekter — mangler ofte Account → Projects på PAT, eller ingen tavler.)"
            : "";
      throw new Error(
        (friendly ?? `GitHub (${res.status}): ${t.slice(0, 200)}`) + restHint,
      );
    }
    const json = (await res.json()) as {
      data?: {
        viewer?: { projectsV2?: { nodes?: { id: string; title: string }[] } };
      };
      errors?: { message: string }[];
    };
    if (json.errors?.length) {
      const raw = json.errors[0]?.message ?? "GitHub GraphQL feilet.";
      const friendly = graphqlProjectsAccessDeniedMessage(raw);
      const restHint =
        restList === null
          ? " (REST fikk ikke listet — fine-grained: «Account» → Projects.)"
          : restList.length === 0
            ? " (REST var tom — sjekk Account-fanen på tokenet, eller org-tilgang for org-prosjekter.)"
            : "";
      throw new Error((friendly ?? raw) + restHint);
    }
    const nodes = json.data?.viewer?.projectsV2?.nodes ?? [];
    return nodes.map((n) => ({ id: n.id, title: n.title }));
  },
});

/**
 * Henter GraphQL node-ID (PVT_…) for et prosjekt fra URL som
 * github.com/users/OWNER/projects/N eller …/orgs/ORG/projects/N.
 */
export const fetchGithubProjectNodeByOwner = action({
  args: {
    workspaceId: v.id("workspaces"),
    ownerLogin: v.string(),
    projectNumber: v.number(),
    ownerKind: v.union(v.literal("user"), v.literal("organization")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Du må være innlogget.");
    }
    const ok = await ctx.runQuery(internal.githubTasks.assertWorkspaceAdmin, {
      workspaceId: args.workspaceId,
      userId,
    });
    if (!ok) {
      throw new Error("Kun administratorer kan hente prosjekt-ID.");
    }
    const token = await resolveGithubToken(ctx, args.workspaceId);
    const login = args.ownerLogin.trim();
    if (!login) {
      throw new Error("Oppgi brukernavn eller organisasjonsnavn.");
    }
    const num = Math.floor(args.projectNumber);
    if (num < 1) {
      throw new Error("Prosjektnummer må være et positivt heltall (fra URL-en).");
    }

    let viaRest = await fetchProjectV2NodeViaRest(
      token,
      args.ownerKind,
      login,
      num,
    );
    /** Feil type (bruker vs org) i skjema gir ofte 404 på REST — prøv begge. */
    if (!viaRest) {
      viaRest = await fetchProjectV2NodeViaRest(
        token,
        args.ownerKind === "user" ? "organization" : "user",
        login,
        num,
      );
    }
    if (viaRest) {
      return viaRest;
    }

    /**
     * Fine-grained PAT feiler ofte på én GraphQL-vei (f.eks. user(login)) mens
     * viewer eller organization fungerer — prøv alle før tilgangsfeil kastes.
     */
    const queryViewer = `query($number: Int!) {
      viewer {
        projectV2(number: $number) {
          id
          title
        }
      }
    }`;

    const queryUser = `query($login: String!, $number: Int!) {
      user(login: $login) {
        projectV2(number: $number) {
          id
          title
        }
      }
    }`;

    const queryOrg = `query($login: String!, $number: Int!) {
      organization(login: $login) {
        projectV2(number: $number) {
          id
          title
        }
      }
    }`;

    const authLogin = await githubRestAuthenticatedLogin(token);
    const loginMatches = authLogin?.toLowerCase() === login.toLowerCase();

    const tries: Array<{
      kind: "viewer" | "user" | "organization";
      query: string;
      variables: Record<string, unknown>;
    }> = [];
    if (loginMatches) {
      tries.push({
        kind: "viewer",
        query: queryViewer,
        variables: { number: num },
      });
    }
    tries.push({
      kind: "organization",
      query: queryOrg,
      variables: { login, number: num },
    });
    tries.push({
      kind: "user",
      query: queryUser,
      variables: { login, number: num },
    });

    let lastPermissionRaw: string | null = null;

    for (const t of tries) {
      const res = await fetch("https://api.github.com/graphql", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: t.query,
          variables: t.variables,
        }),
      });
      const bodyText = await res.text();
      if (!res.ok) {
        if (isGithubGraphqlProjectsPermissionError(bodyText)) {
          lastPermissionRaw = bodyText;
          continue;
        }
        throw new Error(
          graphqlProjectsAccessDeniedMessage(bodyText) ??
            `GitHub (${res.status}): ${bodyText.slice(0, 200)}`,
        );
      }
      let json: GithubGqlProjectV2Response;
      try {
        json = JSON.parse(bodyText) as GithubGqlProjectV2Response;
      } catch {
        throw new Error(`Ugyldig svar fra GitHub GraphQL: ${bodyText.slice(0, 160)}`);
      }
      if (json.errors?.length) {
        const raw = json.errors[0]?.message ?? "";
        if (isGithubGraphqlProjectsPermissionError(raw)) {
          lastPermissionRaw = raw;
          continue;
        }
        throw new Error(raw || "GitHub GraphQL feilet.");
      }
      const proj = projectV2FromGithubGql(json, t.kind);
      if (proj) {
        return proj;
      }
    }

    if (lastPermissionRaw) {
      const anyMsg = graphqlProjectsAccessDeniedMessageResolveAny(lastPermissionRaw);
      throw new Error(
        anyMsg ??
          graphqlProjectsAccessDeniedMessageResolve(
            lastPermissionRaw,
            args.ownerKind,
          ) ??
          lastPermissionRaw,
      );
    }
    throw new Error(
      "Fant ikke prosjektet. Sjekk brukernavn/org, nummer i URL (f.eks. …/projects/6 → 6), og at tokenet har tilgang til dette prosjektet (Projects + riktig konto).",
    );
  },
});

export const createGithubIssue = action({
  args: {
    taskId: v.id("assessmentTasks"),
    repoFullName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Du må være innlogget.");
    }
    const check = await ctx.runQuery(internal.githubTasks.assertCanEditTask, {
      taskId: args.taskId,
      userId,
    });
    if (!check.ok) {
      throw new Error("Du har ikke tilgang til å endre denne oppgaven.");
    }
    await ctx.runAction(internal.githubTasks.createIssueAction, {
      taskId: args.taskId,
      repoFullName: args.repoFullName,
    });
  },
});

export const syncFromGithub = action({
  args: { taskId: v.id("assessmentTasks") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Du må være innlogget.");
    }
    const check = await ctx.runQuery(internal.githubTasks.assertCanEditTask, {
      taskId: args.taskId,
      userId,
    });
    if (!check.ok) {
      throw new Error("Du har ikke tilgang til å endre denne oppgaven.");
    }
    await ctx.runAction(internal.githubTasks.syncFromGithubAction, {
      taskId: args.taskId,
    });
  },
});

export const pushToGithub = action({
  args: { taskId: v.id("assessmentTasks") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Du må være innlogget.");
    }
    const check = await ctx.runQuery(internal.githubTasks.assertCanEditTask, {
      taskId: args.taskId,
      userId,
    });
    if (!check.ok) {
      throw new Error("Du har ikke tilgang til å endre denne oppgaven.");
    }
    await ctx.runAction(internal.githubTasks.pushToGithubAction, {
      taskId: args.taskId,
    });
  },
});

export const linkGithubIssue = mutation({
  args: {
    taskId: v.id("assessmentTasks"),
    issueUrl: v.optional(v.string()),
    repoFullName: v.optional(v.string()),
    issueNumber: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.taskId);
    if (!row) {
      throw new Error("Fant ikke oppgaven.");
    }
    await requireAssessmentEdit(ctx, row.assessmentId);
    let repo: string;
    let num: number;
    if (args.issueUrl !== undefined && args.issueUrl.trim() !== "") {
      const p = parseGithubIssueUrl(args.issueUrl.trim());
      if (!p) {
        throw new Error(
          "Ugyldig issue-URL. Bruk en lenke som slutter på /issues/123.",
        );
      }
      repo = p.repoFullName;
      num = p.issueNumber;
    } else if (args.repoFullName !== undefined && args.issueNumber != null) {
      repo = normalizeGithubRepoFullName(args.repoFullName);
      num = Math.floor(args.issueNumber);
      if (num < 1) {
        throw new Error("Ugyldig issue-nummer.");
      }
    } else {
      throw new Error("Oppgi issue-URL eller repo og issue-nummer.");
    }
    await ctx.db.patch(args.taskId, {
      githubRepoFullName: repo,
      githubIssueNumber: num,
      githubIssueNodeId: undefined,
      githubLastSyncedAt: Date.now(),
    });
  },
});

export const unlinkGithubIssue = mutation({
  args: { taskId: v.id("assessmentTasks") },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.taskId);
    if (!row) {
      throw new Error("Fant ikke oppgaven.");
    }
    await requireAssessmentEdit(ctx, row.assessmentId);
    await ctx.db.patch(args.taskId, {
      githubRepoFullName: undefined,
      githubIssueNumber: undefined,
      githubIssueNodeId: undefined,
      githubLastSyncedAt: undefined,
    });
  },
});
