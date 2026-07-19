/**
 * Lesing av GitHub-issue via REST (kun GET — ingen skriving til GitHub).
 */

const GITHUB_ACCEPT = "application/vnd.github+json";
const GITHUB_API_VERSION = "2022-11-28";

function githubGetHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: GITHUB_ACCEPT,
    "X-GitHub-Api-Version": GITHUB_API_VERSION,
  };
}

/** Kun GET — kaster hvis noen prøver å sende body/method. */
async function githubGetJson(
  token: string,
  url: string,
): Promise<{ ok: boolean; status: number; json: unknown }> {
  const res = await fetch(url, {
    method: "GET",
    headers: githubGetHeaders(token),
  });
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { ok: res.ok, status: res.status, json };
}

export type GithubIssueCommentRow = {
  id: number;
  body: string;
  authorLogin: string | null;
  createdAt: string;
};

export type GithubIssueDetails = {
  title: string;
  body: string | null;
  state: "open" | "closed";
  htmlUrl: string | null;
  assignees: { login: string; name: string | null }[];
  labels: string[];
  /** GitHub issue type name when API returns it */
  issueType: string | null;
  milestoneTitle: string | null;
  /** Milestone due_on (ISO date) → brukes som sluttdato-fallback */
  milestoneDueOn: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  closedAt: string | null;
};

export async function fetchGithubIssueComments(
  token: string,
  owner: string,
  repo: string,
  issueNumber: number,
  limit = 50,
): Promise<GithubIssueCommentRow[]> {
  const capped = Math.min(100, Math.max(1, Math.floor(limit)));
  const { ok, json } = await githubGetJson(
    token,
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${issueNumber}/comments?per_page=${capped}`,
  );
  if (!ok || !Array.isArray(json)) return [];
  const out: GithubIssueCommentRow[] = [];
  for (const item of json) {
    if (out.length >= capped) break;
    const c = item as Record<string, unknown>;
    const user = c.user as Record<string, unknown> | null;
    const body = typeof c.body === "string" ? c.body : "";
    if (!body.trim()) continue;
    out.push({
      id: typeof c.id === "number" ? c.id : 0,
      body,
      authorLogin:
        user && typeof user.login === "string" ? user.login : null,
      createdAt: typeof c.created_at === "string" ? c.created_at : "",
    });
  }
  return out;
}

export async function fetchGithubIssueDetails(
  token: string,
  owner: string,
  repo: string,
  issueNumber: number,
): Promise<GithubIssueDetails | null> {
  const { ok, json } = await githubGetJson(
    token,
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${issueNumber}`,
  );
  if (!ok || !json || typeof json !== "object") return null;
  const j = json as Record<string, unknown>;
  const assigneesRaw = Array.isArray(j.assignees) ? j.assignees : [];
  const labelsRaw = Array.isArray(j.labels) ? j.labels : [];
  const milestone =
    j.milestone && typeof j.milestone === "object"
      ? (j.milestone as Record<string, unknown>)
      : null;
  const typeObj =
    j.type && typeof j.type === "object"
      ? (j.type as Record<string, unknown>)
      : null;

  return {
    title:
      typeof j.title === "string" && j.title.trim()
        ? j.title.trim()
        : "(Uten tittel)",
    body: typeof j.body === "string" && j.body.trim() ? j.body : null,
    state: j.state === "closed" ? "closed" : "open",
    htmlUrl: typeof j.html_url === "string" ? j.html_url : null,
    assignees: assigneesRaw.map((a) => {
      const u = a as Record<string, unknown>;
      return {
        login: typeof u.login === "string" ? u.login : "",
        name: typeof u.name === "string" ? u.name : null,
      };
    }).filter((a) => a.login),
    labels: labelsRaw
      .map((l) => {
        if (typeof l === "string") return l;
        const o = l as Record<string, unknown>;
        return typeof o.name === "string" ? o.name : "";
      })
      .filter(Boolean),
    issueType:
      typeObj && typeof typeObj.name === "string" && typeObj.name.trim()
        ? typeObj.name.trim()
        : null,
    milestoneTitle:
      milestone && typeof milestone.title === "string"
        ? milestone.title
        : null,
    milestoneDueOn:
      milestone && typeof milestone.due_on === "string"
        ? milestone.due_on
        : null,
    createdAt: typeof j.created_at === "string" ? j.created_at : null,
    updatedAt: typeof j.updated_at === "string" ? j.updated_at : null,
    closedAt: typeof j.closed_at === "string" ? j.closed_at : null,
  };
}

/** @deprecated Bruk fetchGithubIssueDetails */
export async function fetchGithubIssueBody(
  token: string,
  owner: string,
  repo: string,
  issueNumber: number,
): Promise<string | null> {
  const details = await fetchGithubIssueDetails(
    token,
    owner,
    repo,
    issueNumber,
  );
  return details?.body ?? null;
}

/** Formatér GitHub-kommentar for Puls (plain tekst → RichTextView). */
export function formatImportedGithubCommentBody(
  authorLogin: string | null,
  body: string,
  createdAt: string,
): string {
  const who = authorLogin?.trim() ? `@${authorLogin.trim()}` : "GitHub";
  const when = createdAt.trim()
    ? ` · ${createdAt.trim().slice(0, 10)}`
    : "";
  return `Importert fra GitHub · ${who}${when}\n\n${body.trim()}`;
}

/** Parse GitHub date (`YYYY-MM-DD` eller ISO) til midt-på-dagen UTC ms. */
export function parseGithubDateToMs(value: string | null | undefined): number | undefined {
  if (!value?.trim()) return undefined;
  const t = value.trim();
  // Date-only → noon UTC to avoid timezone edge flips
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    const ms = Date.parse(`${t}T12:00:00.000Z`);
    return Number.isFinite(ms) ? ms : undefined;
  }
  const ms = Date.parse(t);
  return Number.isFinite(ms) ? ms : undefined;
}

export function looksLikeStartDateFieldName(name: string): boolean {
  const n = name.trim().toLowerCase();
  return (
    n === "start" ||
    n === "start date" ||
    n === "startdato" ||
    n === "startet" ||
    n.includes("start date") ||
    n.includes("startdato")
  );
}

export function looksLikeDueDateFieldName(name: string): boolean {
  const n = name.trim().toLowerCase();
  return (
    n === "due" ||
    n === "due date" ||
    n === "end" ||
    n === "end date" ||
    n === "target date" ||
    n === "target" ||
    n === "frist" ||
    n === "sluttdato" ||
    n === "deadline" ||
    n.includes("due date") ||
    n.includes("end date") ||
    n.includes("target date") ||
    n.includes("sluttdato") ||
    n.includes("frist")
  );
}

export function looksLikePriorityFieldName(name: string): boolean {
  const n = name.trim().toLowerCase();
  return n === "priority" || n === "prioritet" || n.includes("priority");
}

export function looksLikeSizeFieldName(name: string): boolean {
  const n = name.trim().toLowerCase();
  return n === "size" || n === "størrelse" || n === "storrelse";
}

export function looksLikeEstimateFieldName(name: string): boolean {
  const n = name.trim().toLowerCase();
  return (
    n === "estimate" ||
    n === "estimat" ||
    n === "story points" ||
    n === "points" ||
    n.includes("estimate")
  );
}

/**
 * Bygg beskrivelse: issue-body + kort metadata.
 * Labels/milestone lagres som egne felt — ikke i beskrivelsen.
 */
export function buildImportedDescription(args: {
  body: string | null;
  htmlUrl?: string | null;
  unmatchedAssigneeLogins?: string[];
}): string | undefined {
  const parts: string[] = [];
  if (args.body?.trim()) {
    parts.push(args.body.trim());
  }
  const meta: string[] = [];
  if (args.htmlUrl?.trim()) {
    meta.push(`GitHub: ${args.htmlUrl.trim()}`);
  }
  const unmatched = args.unmatchedAssigneeLogins ?? [];
  if (unmatched.length > 0) {
    meta.push(
      `Tildelt på GitHub (ikke match i Tavler): ${unmatched.map((l) => `@${l}`).join(", ")}`,
    );
  }
  if (meta.length > 0) {
    parts.push(`---\n${meta.join("\n")}`);
  }
  const out = parts.join("\n\n").trim();
  return out || undefined;
}
