import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";
import { normalizeGithubRepoFullName, parseGithubIssueUrl } from "./lib/github";
import { resolveGithubToken } from "./githubTasks";

const GITHUB_ACCEPT = "application/vnd.github+json";
const GITHUB_API_VERSION = "2022-11-28";

type GithubIssueCommentPreview = {
  id: number;
  body: string;
  author: { login: string; avatarUrl: string } | null;
  createdAt: string;
  updatedAt: string;
};

type GithubIssuePreview = {
  title: string;
  body: string | null;
  state: string;
  stateReason: string | null;
  number: number;
  repoFullName: string;
  htmlUrl: string;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  author: { login: string; avatarUrl: string } | null;
  assignees: { login: string; avatarUrl: string }[];
  labels: { name: string; color: string }[];
  milestone: string | null;
  commentsCount: number;
  /** Siste inntil 100 kommentarer (issue-/PR-tråd på GitHub) */
  comments: GithubIssueCommentPreview[];
};

/**
 * Henter issue-metadata via GitHub REST (krever lagret PAT for arbeidsområdet).
 * Brukes før opprettelse av prosess i PVV uten at saken ligger som prosjektkort.
 */
export const fetchGithubIssueForProcessImport = action({
  args: {
    workspaceId: v.id("workspaces"),
    issueUrl: v.optional(v.string()),
    repoFullName: v.optional(v.string()),
    issueNumber: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Du må være innlogget.");
    }
    await ctx.runQuery(internal.candidates.assertMemberForWorkspace, {
      workspaceId: args.workspaceId,
      userId,
    });

    let repoFullName: string;
    let issueNumber: number;

    const urlRaw = args.issueUrl?.trim();
    if (urlRaw) {
      const parsed = parseGithubIssueUrl(urlRaw);
      if (!parsed) {
        throw new Error(
          "Ugyldig issue-URL. Bruk en lenke som slutter med …/issues/123 (ikke pull request).",
        );
      }
      repoFullName = parsed.repoFullName;
      issueNumber = parsed.issueNumber;
    } else if (args.repoFullName?.trim() && args.issueNumber != null) {
      repoFullName = normalizeGithubRepoFullName(args.repoFullName);
      issueNumber = Math.floor(args.issueNumber);
      if (!Number.isFinite(issueNumber) || issueNumber < 1) {
        throw new Error("Issue-nummer må være et positivt heltall.");
      }
    } else {
      throw new Error("Oppgi issue-URL (anbefalt) eller repo + nummer.");
    }

    const token = await resolveGithubToken(ctx, args.workspaceId);
    const [owner, repo] = repoFullName.split("/");
    const res = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${issueNumber}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: GITHUB_ACCEPT,
          "X-GitHub-Api-Version": GITHUB_API_VERSION,
        },
      },
    );

    if (res.status === 404) {
      throw new Error(
        "Fant ikke issue (404). Sjekk repo, nummer og at token har tilgang til repoet.",
      );
    }
    if (res.status === 403) {
      throw new Error(
        "Ingen tilgang til issue (403). Sjekk at PAT har «Issues» for dette repoet.",
      );
    }
    if (!res.ok) {
      const t = await res.text();
      throw new Error(
        `GitHub kunne ikke hente issue (HTTP ${res.status}). ${t.slice(0, 200)}`,
      );
    }

    const json = (await res.json()) as {
      title?: string;
      node_id?: string;
      number?: number;
      pull_request?: unknown;
    };

    if (json.pull_request != null) {
      throw new Error(
        "Dette er en pull request, ikke et issue. Bruk prosjektkolonne eller opprett prosess manuelt.",
      );
    }

    const title = typeof json.title === "string" ? json.title : "";
    const issueNodeId =
      typeof json.node_id === "string" && json.node_id.length > 0
        ? json.node_id
        : undefined;

    return {
      title: title || "(Uten tittel)",
      repoFullName,
      issueNumber:
        typeof json.number === "number" ? json.number : issueNumber,
      issueNodeId,
    };
  },
});

async function fetchGithubIssueRest(
  token: string,
  owner: string,
  repo: string,
  issueNumber: number,
): Promise<Record<string, unknown>> {
  const res = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${issueNumber}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: GITHUB_ACCEPT,
        "X-GitHub-Api-Version": GITHUB_API_VERSION,
      },
    },
  );
  if (!res.ok) {
    const t = await res.text();
    throw new Error(
      `GitHub feil (HTTP ${res.status}). ${t.slice(0, 200)}`,
    );
  }
  return (await res.json()) as Record<string, unknown>;
}

async function fetchGithubIssueCommentsRest(
  token: string,
  owner: string,
  repo: string,
  issueNumber: number,
): Promise<GithubIssueCommentPreview[]> {
  const res = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${issueNumber}/comments?per_page=100`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: GITHUB_ACCEPT,
        "X-GitHub-Api-Version": GITHUB_API_VERSION,
      },
    },
  );
  if (!res.ok) {
    return [];
  }
  const raw = (await res.json()) as unknown;
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.map((item) => {
    const c = item as Record<string, unknown>;
    const user = c.user as Record<string, unknown> | null;
    return {
      id: typeof c.id === "number" ? c.id : 0,
      body: typeof c.body === "string" ? c.body : "",
      author: user
        ? {
            login: (user.login as string) || "",
            avatarUrl: (user.avatar_url as string) || "",
          }
        : null,
      createdAt: typeof c.created_at === "string" ? c.created_at : "",
      updatedAt: typeof c.updated_at === "string" ? c.updated_at : "",
    };
  });
}

function parseGithubIssueJson(
  json: Record<string, unknown>,
  repoFullName: string,
): GithubIssuePreview {
  const user = json.user as Record<string, unknown> | null;
  const assigneesRaw = Array.isArray(json.assignees) ? json.assignees : [];
  const labelsRaw = Array.isArray(json.labels) ? json.labels : [];

  return {
    title: (json.title as string) || "(Uten tittel)",
    body: typeof json.body === "string" ? json.body : null,
    state: (json.state as string) || "unknown",
    stateReason:
      typeof json.state_reason === "string" ? json.state_reason : null,
    number: (json.number as number) || 0,
    repoFullName,
    htmlUrl: (json.html_url as string) || "",
    createdAt: (json.created_at as string) || "",
    updatedAt: (json.updated_at as string) || "",
    closedAt:
      typeof json.closed_at === "string" ? json.closed_at : null,
    author: user
      ? {
          login: (user.login as string) || "",
          avatarUrl: (user.avatar_url as string) || "",
        }
      : null,
    assignees: assigneesRaw.map((a: Record<string, unknown>) => ({
      login: (a.login as string) || "",
      avatarUrl: (a.avatar_url as string) || "",
    })),
    labels: labelsRaw.map((l: Record<string, unknown>) => ({
      name: (l.name as string) || "",
      color: (l.color as string) || "666",
    })),
    milestone:
      json.milestone && typeof json.milestone === "object"
        ? ((json.milestone as Record<string, unknown>).title as string) || null
        : null,
    commentsCount: typeof json.comments === "number" ? json.comments : 0,
    comments: [],
  };
}

/**
 * Fetches a full preview of a GitHub issue/PR for inline display.
 * Returns title, body (markdown), state, assignees, labels, dates, etc.
 */
export const previewGithubIssue = action({
  args: {
    workspaceId: v.id("workspaces"),
    repoFullName: v.string(),
    issueNumber: v.number(),
  },
  handler: async (ctx, args): Promise<GithubIssuePreview> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Du må være innlogget.");
    await ctx.runQuery(internal.candidates.assertMemberForWorkspace, {
      workspaceId: args.workspaceId,
      userId,
    });

    const repo = normalizeGithubRepoFullName(args.repoFullName);
    const num = Math.floor(args.issueNumber);
    if (!Number.isFinite(num) || num < 1) {
      throw new Error("Ugyldig issue-nummer.");
    }

    const token = await resolveGithubToken(ctx, args.workspaceId);
    const [owner, repoName] = repo.split("/");
    const json = await fetchGithubIssueRest(token, owner, repoName, num);
    const preview = parseGithubIssueJson(json, repo);
    const comments = await fetchGithubIssueCommentsRest(
      token,
      owner,
      repoName,
      num,
    );
    return { ...preview, comments };
  },
});

/**
 * Fetches a full preview of a GitHub issue by URL.
 */
export const previewGithubIssueByUrl = action({
  args: {
    workspaceId: v.id("workspaces"),
    issueUrl: v.string(),
  },
  handler: async (ctx, args): Promise<GithubIssuePreview> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Du må være innlogget.");
    await ctx.runQuery(internal.candidates.assertMemberForWorkspace, {
      workspaceId: args.workspaceId,
      userId,
    });

    const parsed = parseGithubIssueUrl(args.issueUrl.trim());
    if (!parsed) throw new Error("Ugyldig GitHub issue-URL.");

    const token = await resolveGithubToken(ctx, args.workspaceId);
    const [owner, repoName] = parsed.repoFullName.split("/");
    const json = await fetchGithubIssueRest(
      token,
      owner,
      repoName,
      parsed.issueNumber,
    );
    const preview = parseGithubIssueJson(json, parsed.repoFullName);
    const comments = await fetchGithubIssueCommentsRest(
      token,
      owner,
      repoName,
      parsed.issueNumber,
    );
    return { ...preview, comments };
  },
});
