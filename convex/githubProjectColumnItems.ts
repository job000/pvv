import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { action } from "./_generated/server";
import { fetchProjectStatusFieldOptions } from "./githubCandidateProject";
import {
  intakeGithubOccupiedRefsFromSerialized,
  isGithubColumnItemOccupiedByIntake,
} from "./lib/intakeGithubOccupiedRefs";
import { githubGraphql } from "./lib/githubGraphql";
import { resolveGithubToken } from "./githubTasks";

const ITEMS_PAGE = 100;
const MAX_PAGES = 30;

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
              repository {
                nameWithOwner
              }
            }
            ... on DraftIssue {
              id
              title
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
            }
          }
        }
      }
    }
  }
}`;

function itemMatchesStatusColumn(
  fieldNodes: unknown[],
  statusFieldId: string,
  statusOptionId: string,
): boolean {
  for (const raw of fieldNodes) {
    if (!raw || typeof raw !== "object") continue;
    const fv = raw as {
      __typename?: string;
      optionId?: string;
      field?: { id?: string } | null;
    };
    if (fv.__typename !== "ProjectV2ItemFieldSingleSelectValue") continue;
    if (fv.field?.id !== statusFieldId) continue;
    if (fv.optionId === statusOptionId) {
      return true;
    }
  }
  return false;
}

export type GithubProjectColumnItemRow = {
  projectItemId: string;
  contentKind: "draft_issue" | "issue" | "pull_request" | "unknown";
  title: string;
  issueUrl?: string;
  issueNumber?: number;
  repoFullName?: string;
  issueNodeId?: string;
  draftIssueId?: string;
};

/**
 * Lister prosjektkort som står i en gitt statuskolonne (samme enkeltvalg-felt som PVV bruker for tavle).
 */
export const listGithubProjectItemsInStatusColumn = action({
  args: {
    workspaceId: v.id("workspaces"),
    statusOptionId: v.string(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    fieldId: string;
    fieldName: string;
    optionName: string;
    items: GithubProjectColumnItemRow[];
  }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Du må være innlogget.");
    }
    await ctx.runQuery(internal.candidates.assertMemberForWorkspace, {
      workspaceId: args.workspaceId,
      userId,
    });
    const workspace: Doc<"workspaces"> | null = await ctx.runQuery(
      internal.githubTasks.getWorkspaceDoc,
      { workspaceId: args.workspaceId },
    );
    if (!workspace) {
      throw new Error("Arbeidsområde finnes ikke.");
    }
    const projectNodeId = workspace.githubProjectNodeId?.trim();
    if (!projectNodeId) {
      throw new Error(
        "Ingen GitHub-prosjekt-node-ID er lagret. Konfigurer under Innstillinger → GitHub.",
      );
    }
    const token = await resolveGithubToken(ctx, args.workspaceId);
    const meta = await fetchProjectStatusFieldOptions(
      token,
      projectNodeId,
      workspace.githubProjectSingleSelectFieldId?.trim() || null,
    );
    const opt = meta.options.find((o) => o.id === args.statusOptionId.trim());
    if (!opt) {
      throw new Error(
        "Ugyldig kolonne — hent statuslisten på nytt under Innstillinger eller oppdater siden.",
      );
    }
    const statusFieldId = meta.fieldId;
    const occupied = await ctx.runQuery(
      internal.intakeSubmissions.loadGithubOccupiedRefsForWorkspace,
      { workspaceId: args.workspaceId },
    );
    const intakeGithubRefs = intakeGithubOccupiedRefsFromSerialized(occupied);
    const out: GithubProjectColumnItemRow[] = [];
    let after: string | null = null;
    let pages = 0;
    while (pages < MAX_PAGES) {
      pages += 1;
      const json = await githubGraphql(token, PROJECT_ITEMS_PAGE_QUERY, {
        id: projectNodeId,
        after,
      });
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
      const fieldValuesList = (item: unknown): unknown[] => {
        const fv = (item as { fieldValues?: { nodes?: unknown[] } })?.fieldValues
          ?.nodes;
        return Array.isArray(fv) ? fv : [];
      };
      for (const item of nodes) {
        if (!item || typeof item !== "object") continue;
        const itemId = (item as { id?: string }).id?.trim();
        if (!itemId) continue;
        if (
          !itemMatchesStatusColumn(
            fieldValuesList(item),
            statusFieldId,
            args.statusOptionId.trim(),
          )
        ) {
          continue;
        }
        const content = (item as { content?: Record<string, unknown> | null })
          .content;
        const tn = content?.__typename;
        let row: GithubProjectColumnItemRow | null = null;
        if (tn === "DraftIssue") {
          const c = content as { id?: string; title?: string };
          row = {
            projectItemId: itemId,
            contentKind: "draft_issue",
            title: typeof c.title === "string" ? c.title : "(Uten tittel)",
            draftIssueId: typeof c.id === "string" ? c.id : undefined,
          };
        } else if (tn === "Issue") {
          const c = content as {
            title?: string;
            number?: number;
            url?: string;
            id?: string;
            repository?: { nameWithOwner?: string };
          };
          let repoFullName = "";
          const raw = c.repository?.nameWithOwner?.trim();
          if (raw) {
            repoFullName = raw.toLowerCase();
          }
          row = {
            projectItemId: itemId,
            contentKind: "issue",
            title: typeof c.title === "string" ? c.title : "(Uten tittel)",
            issueUrl: typeof c.url === "string" ? c.url : undefined,
            issueNumber: typeof c.number === "number" ? c.number : undefined,
            repoFullName: repoFullName || undefined,
            issueNodeId: typeof c.id === "string" ? c.id : undefined,
          };
        } else if (tn === "PullRequest") {
          const c = content as {
            title?: string;
            number?: number;
            url?: string;
            id?: string;
            repository?: { nameWithOwner?: string };
          };
          let repoFullName = "";
          const raw = c.repository?.nameWithOwner?.trim();
          if (raw) {
            repoFullName = raw.toLowerCase();
          }
          row = {
            projectItemId: itemId,
            contentKind: "pull_request",
            title: typeof c.title === "string" ? c.title : "(Uten tittel)",
            issueUrl: typeof c.url === "string" ? c.url : undefined,
            issueNumber: typeof c.number === "number" ? c.number : undefined,
            repoFullName: repoFullName || undefined,
            issueNodeId: typeof c.id === "string" ? c.id : undefined,
          };
        } else {
          row = {
            projectItemId: itemId,
            contentKind: "unknown",
            title: "(Ukjent innholdstype)",
          };
        }
        if (row) {
          if (isGithubColumnItemOccupiedByIntake(intakeGithubRefs, row)) {
            continue;
          }
          out.push(row);
        }
      }
      const pageInfo = conn?.pageInfo;
      if (!pageInfo?.hasNextPage || !pageInfo.endCursor) {
        break;
      }
      after = pageInfo.endCursor;
    }
    return {
      fieldId: statusFieldId,
      fieldName: meta.fieldName,
      optionName: opt.name,
      items: out,
    };
  },
});

const DRAFT_ISSUE_NODE_QUERY = `query($id: ID!) {
  node(id: $id) {
    ... on DraftIssue {
      id
      title
      body
      createdAt
      updatedAt
      creator {
        __typename
        login
        ... on User {
          avatarUrl
        }
        ... on Organization {
          avatarUrl
        }
      }
    }
  }
}`;

/**
 * Henter tekst og metadata for et prosjekt-utkast (DraftIssue) via GraphQL.
 * Utkast har ikke repo/issue-nummer før de konverteres til vanlig issue.
 */
export const previewGithubDraftIssue = action({
  args: {
    workspaceId: v.id("workspaces"),
    draftIssueNodeId: v.string(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    title: string;
    body: string | null;
    createdAt: string;
    updatedAt: string;
    creator: { login: string; avatarUrl: string } | null;
    draftIssueNodeId: string;
  }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Du må være innlogget.");
    }
    await ctx.runQuery(internal.candidates.assertMemberForWorkspace, {
      workspaceId: args.workspaceId,
      userId,
    });
    const id = args.draftIssueNodeId.trim();
    if (!id) {
      throw new Error("Mangler utkast-ID.");
    }
    const token = await resolveGithubToken(ctx, args.workspaceId);
    const json = await githubGraphql(token, DRAFT_ISSUE_NODE_QUERY, { id });
    const node = (json.data as { node?: Record<string, unknown> | null })
      ?.node;
    if (!node || typeof node !== "object") {
      throw new Error("Fant ikke utkastet på GitHub.");
    }
    const title =
      typeof node.title === "string" && node.title.length > 0
        ? node.title
        : "(Uten tittel)";
    const body = typeof node.body === "string" ? node.body : null;
    const createdAt =
      typeof node.createdAt === "string" ? node.createdAt : "";
    const updatedAt =
      typeof node.updatedAt === "string" ? node.updatedAt : "";
    const outId = typeof node.id === "string" ? node.id : id;
    const cr = node.creator as
      | { login?: string; avatarUrl?: string }
      | null
      | undefined;
    const creator =
      cr && typeof cr.login === "string" && cr.login.length > 0
        ? {
            login: cr.login,
            avatarUrl:
              typeof cr.avatarUrl === "string" ? cr.avatarUrl : "",
          }
        : null;
    return {
      title,
      body,
      createdAt,
      updatedAt,
      creator,
      draftIssueNodeId: outId,
    };
  },
});
