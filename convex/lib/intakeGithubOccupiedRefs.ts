import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { normalizeGithubRepoFullName } from "./github";

export type IntakeGithubOccupiedRefs = {
  projectItemIds: Set<string>;
  issueKeys: Set<string>;
  issueNodeIds: Set<string>;
};

/**
 * GitHub-kort / issues som allerede er knyttet til skjemaforslag (intakeSubmissions).
 * Skal ikke vises eller importeres som prosess i prosessregisteret.
 */
export async function loadIntakeGithubOccupiedRefs(
  ctx: QueryCtx | MutationCtx,
  workspaceId: Id<"workspaces">,
): Promise<IntakeGithubOccupiedRefs> {
  const rows = await ctx.db
    .query("intakeSubmissions")
    .withIndex("by_workspace_and_submitted_at", (q) =>
      q.eq("workspaceId", workspaceId),
    )
    .take(500);
  const projectItemIds = new Set<string>();
  const issueKeys = new Set<string>();
  const issueNodeIds = new Set<string>();
  for (const r of rows) {
    if (r.githubProjectItemNodeId?.trim()) {
      projectItemIds.add(r.githubProjectItemNodeId.trim());
    }
    if (r.githubRepoFullName?.trim() && r.githubIssueNumber != null) {
      try {
        const repo = normalizeGithubRepoFullName(r.githubRepoFullName);
        issueKeys.add(`${repo}#${r.githubIssueNumber}`);
      } catch {
        /* ugyldig repo i eldre data */
      }
    }
    if (r.githubIssueNodeId?.trim()) {
      issueNodeIds.add(r.githubIssueNodeId.trim());
    }
  }
  return { projectItemIds, issueKeys, issueNodeIds };
}

export function intakeGithubOccupiedRefsFromSerialized(occupied: {
  projectItemIds: string[];
  issueKeys: string[];
  issueNodeIds: string[];
}): IntakeGithubOccupiedRefs {
  return {
    projectItemIds: new Set(occupied.projectItemIds),
    issueKeys: new Set(occupied.issueKeys),
    issueNodeIds: new Set(occupied.issueNodeIds),
  };
}

export function isGithubColumnItemOccupiedByIntake(
  refs: IntakeGithubOccupiedRefs,
  row: {
    projectItemId: string;
    contentKind: string;
    repoFullName?: string;
    issueNumber?: number;
    issueNodeId?: string;
  },
): boolean {
  if (refs.projectItemIds.has(row.projectItemId.trim())) {
    return true;
  }
  if (
    (row.contentKind === "issue" || row.contentKind === "pull_request") &&
    row.issueNodeId?.trim() &&
    refs.issueNodeIds.has(row.issueNodeId.trim())
  ) {
    return true;
  }
  if (
    (row.contentKind === "issue" || row.contentKind === "pull_request") &&
    row.repoFullName &&
    row.issueNumber != null
  ) {
    const key = `${row.repoFullName}#${row.issueNumber}`;
    if (refs.issueKeys.has(key)) {
      return true;
    }
  }
  return false;
}

const INTAKE_PROJECT_ITEM_MESSAGE =
  "Dette prosjektkortet er allerede knyttet til et skjemaforslag i PVV og kan ikke importeres som egen prosess.";

const INTAKE_ISSUE_MESSAGE =
  "Denne GitHub-saken er allerede knyttet til et skjemaforslag i PVV og kan ikke importeres som egen prosess.";

export function assertGithubProjectItemNotIntakeLinked(
  refs: IntakeGithubOccupiedRefs,
  projectItemNodeId: string,
): void {
  if (refs.projectItemIds.has(projectItemNodeId.trim())) {
    throw new Error(INTAKE_PROJECT_ITEM_MESSAGE);
  }
}

export function assertGithubIssueNotIntakeLinked(
  refs: IntakeGithubOccupiedRefs,
  repo: string,
  issueNumber: number,
  issueNodeId?: string,
): void {
  if (issueNodeId?.trim() && refs.issueNodeIds.has(issueNodeId.trim())) {
    throw new Error(INTAKE_ISSUE_MESSAGE);
  }
  const key = `${repo}#${issueNumber}`;
  if (refs.issueKeys.has(key)) {
    throw new Error(INTAKE_ISSUE_MESSAGE);
  }
}
