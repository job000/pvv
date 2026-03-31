/**
 * GitHub under-saker (sub-issues): REST krever ny API-versjon.
 * @see https://docs.github.com/en/rest/issues/sub-issues
 */
export const GITHUB_SUB_ISSUES_API_VERSION = "2026-03-10";

export type GithubSubIssuesSummary = {
  total: number;
  completed: number;
  /** GitHub kan sende ferdig beregnet prosent; ellers avledes fra completed/total */
  percentCompleted: number | null;
};

function parseNextUrlFromLinkHeader(linkHeader: string | null): string | null {
  if (!linkHeader) return null;
  const m = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
  return m?.[1] ?? null;
}

function subIssueHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": GITHUB_SUB_ISSUES_API_VERSION,
  };
}

async function fetchSubIssuesCountsFromList(
  token: string,
  owner: string,
  repo: string,
  issueNumber: number,
): Promise<GithubSubIssuesSummary | null> {
  let url: string | null =
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${issueNumber}/sub_issues?per_page=100`;
  let total = 0;
  let completed = 0;
  while (url) {
    const res = await fetch(url, { headers: subIssueHeaders(token) });
    if (res.status === 404) {
      return null;
    }
    if (!res.ok) {
      return null;
    }
    const items = (await res.json()) as unknown;
    if (!Array.isArray(items)) {
      return null;
    }
    for (const it of items) {
      const state = (it as { state?: string }).state;
      total += 1;
      if (state === "closed") {
        completed += 1;
      }
    }
    url = parseNextUrlFromLinkHeader(res.headers.get("link"));
  }
  if (total === 0) {
    return null;
  }
  const percentCompleted =
    total > 0 ? Math.round((completed / total) * 100) : null;
  return { total, completed, percentCompleted };
}

/**
 * Henter aggregert fremdrift for under-saker til et issue (hovedsak).
 * Bruker GET issue med `sub_issues_summary` når tilgjengelig, ellers lister under-saker.
 */
export async function fetchGithubSubIssuesSummary(
  token: string,
  repoFullName: string,
  issueNumber: number,
): Promise<GithubSubIssuesSummary | null> {
  const parts = repoFullName.split("/").filter(Boolean);
  if (parts.length !== 2) {
    return null;
  }
  const [owner, repo] = parts;
  const issueUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${issueNumber}`;
  const res = await fetch(issueUrl, { headers: subIssueHeaders(token) });
  if (!res.ok) {
    return null;
  }
  const body = (await res.json()) as {
    sub_issues_summary?: {
      total?: number;
      completed?: number;
      percent_completed?: number;
    };
  };
  const sum = body.sub_issues_summary;
  if (sum && typeof sum.total === "number") {
    if (sum.total === 0) {
      return null;
    }
    const completed =
      typeof sum.completed === "number" ? sum.completed : 0;
    let percentCompleted: number | null =
      typeof sum.percent_completed === "number"
        ? sum.percent_completed
        : null;
    if (percentCompleted === null && sum.total > 0) {
      percentCompleted = Math.round((completed / sum.total) * 100);
    }
    return {
      total: sum.total,
      completed,
      percentCompleted,
    };
  }
  return fetchSubIssuesCountsFromList(token, owner, repo, issueNumber);
}
