import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";
import { normalizeGithubRepoFullName, parseGithubIssueUrl } from "./lib/github";
import { resolveGithubToken } from "./githubTasks";

const GITHUB_ACCEPT = "application/vnd.github+json";
const GITHUB_API_VERSION = "2022-11-28";

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
