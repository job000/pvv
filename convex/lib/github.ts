/** Normaliserer `eier/repo` til små bokstaver for stabile indekser og webhooks. */
export function normalizeGithubRepoFullName(input: string): string {
  const t = input
    .trim()
    .replace(/^https?:\/\/github\.com\//i, "")
    .replace(/\/$/, "");
  const parts = t.split("/").filter(Boolean);
  if (parts.length !== 2) {
    throw new Error("GitHub-repo må være på formen eier/repo.");
  }
  const [owner, repo] = parts;
  if (!/^[\w.-]+$/.test(owner) || !/^[\w.-]+$/.test(repo)) {
    throw new Error("Ugyldig GitHub-repo-navn.");
  }
  return `${owner.toLowerCase()}/${repo.toLowerCase()}`;
}

export function parseGithubIssueUrl(
  url: string,
): { repoFullName: string; issueNumber: number } | null {
  const m = url
    .trim()
    .match(/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)/i);
  if (!m) return null;
  return {
    repoFullName: `${m[1].toLowerCase()}/${m[2].toLowerCase()}`,
    issueNumber: parseInt(m[3], 10),
  };
}
