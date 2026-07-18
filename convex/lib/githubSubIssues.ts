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

export type GithubSubIssueRow = {
  title: string;
  number: number;
  repoFullName: string;
  nodeId?: string;
  state: "open" | "closed";
  body: string | null;
  assignees: { login: string; name: string | null }[];
  labels: string[];
  milestoneTitle: string | null;
  milestoneDueOn: string | null;
  htmlUrl: string | null;
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

/** Kun GET mot GitHub REST for sub-issues. */
async function githubGet(
  token: string,
  url: string,
): Promise<Response> {
  return await fetch(url, { method: "GET", headers: subIssueHeaders(token) });
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
    const res = await githubGet(token, url);
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
  const res = await githubGet(token, issueUrl);
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

function repoFullNameFromRepositoryUrl(url: string | undefined): string | null {
  if (!url?.trim()) return null;
  const m = /\/repos\/([^/]+)\/([^/]+)/i.exec(url.trim());
  if (!m?.[1] || !m[2]) return null;
  return `${m[1].toLowerCase()}/${m[2].toLowerCase()}`;
}

/**
 * Lister under-saker for et issue (én side av gangen, maks `limit`).
 */
export async function listGithubSubIssues(
  token: string,
  repoFullName: string,
  issueNumber: number,
  limit = 50,
): Promise<GithubSubIssueRow[]> {
  const parts = repoFullName.split("/").filter(Boolean);
  if (parts.length !== 2) return [];
  const [owner, repo] = parts;
  const capped = Math.min(100, Math.max(1, Math.floor(limit)));
  let url: string | null =
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${issueNumber}/sub_issues?per_page=${capped}`;
  const out: GithubSubIssueRow[] = [];
  while (url && out.length < capped) {
    const res = await githubGet(token, url);
    if (!res.ok) return out;
    const items = (await res.json()) as unknown;
    if (!Array.isArray(items)) return out;
    for (const raw of items) {
      if (out.length >= capped) break;
      const it = raw as {
        title?: string;
        number?: number;
        node_id?: string;
        state?: string;
        body?: string | null;
        repository_url?: string;
        html_url?: string;
        pull_request?: unknown;
        assignees?: unknown[];
        labels?: unknown[];
        milestone?: { title?: string; due_on?: string | null } | null;
      };
      if (it.pull_request) continue;
      const num = typeof it.number === "number" ? it.number : 0;
      if (num < 1) continue;
      const childRepo =
        repoFullNameFromRepositoryUrl(it.repository_url) ??
        repoFullName.toLowerCase();
      const assignees = (Array.isArray(it.assignees) ? it.assignees : [])
        .map((a) => {
          const u = a as { login?: string; name?: string | null };
          return {
            login: typeof u.login === "string" ? u.login : "",
            name: typeof u.name === "string" ? u.name : null,
          };
        })
        .filter((a) => a.login);
      const labels = (Array.isArray(it.labels) ? it.labels : [])
        .map((l) => {
          if (typeof l === "string") return l;
          const o = l as { name?: string };
          return typeof o.name === "string" ? o.name : "";
        })
        .filter(Boolean);
      out.push({
        title:
          typeof it.title === "string" && it.title.trim()
            ? it.title.trim()
            : "(Uten tittel)",
        number: num,
        repoFullName: childRepo,
        nodeId: typeof it.node_id === "string" ? it.node_id : undefined,
        state: it.state === "closed" ? "closed" : "open",
        body: typeof it.body === "string" ? it.body : null,
        assignees,
        labels,
        milestoneTitle:
          typeof it.milestone?.title === "string" ? it.milestone.title : null,
        milestoneDueOn:
          typeof it.milestone?.due_on === "string" ? it.milestone.due_on : null,
        htmlUrl: typeof it.html_url === "string" ? it.html_url : null,
      });
    }
    url = parseNextUrlFromLinkHeader(res.headers.get("link"));
  }
  return out;
}
