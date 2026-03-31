import type { Doc } from "@/convex/_generated/dataModel";

/** Samme normalisering som i Convex — for visning og før lagring. */
export function normalizeGithubRepoInput(input: string): string {
  const t = input
    .trim()
    .replace(/^https?:\/\/github\.com\//i, "")
    .replace(/\/$/, "");
  const parts = t.split("/").filter(Boolean);
  if (parts.length !== 2) {
    throw new Error("Bruk formen eier/repo (f.eks. min-org/min-app).");
  }
  const [owner, repo] = parts;
  if (!/^[\w.-]+$/.test(owner) || !/^[\w.-]+$/.test(repo)) {
    throw new Error("Ugyldig repo-navn.");
  }
  return `${owner.toLowerCase()}/${repo.toLowerCase()}`;
}

/** Repo-liste fra workspace: flere repoer, eller eldre enkeltfelt. */
export function effectiveGithubDefaultRepos(
  workspace:
    | Pick<
        Doc<"workspaces">,
        "githubDefaultRepoFullNames" | "githubDefaultRepoFullName"
      >
    | null
    | undefined,
): string[] {
  if (!workspace) return [];
  const list = workspace.githubDefaultRepoFullNames?.filter(Boolean);
  if (list && list.length > 0) return list;
  if (workspace.githubDefaultRepoFullName) {
    return [workspace.githubDefaultRepoFullName];
  }
  return [];
}
