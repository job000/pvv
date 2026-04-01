import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { ActionCtx } from "./_generated/server";
import { action, internalAction, internalMutation } from "./_generated/server";
import {
  githubGraphql,
  isGithubGraphqlRateLimitError,
} from "./lib/githubGraphql";
import {
  fetchGithubSubIssuesSummary,
  type GithubSubIssuesSummary,
} from "./lib/githubSubIssues";
import { normalizeGithubRepoFullName } from "./lib/github";
import { formatPvvSyncBlock } from "./lib/githubCandidateSync";
import { resolveGithubToken } from "./githubTasks";
import {
  PIPELINE_STATUS_LABELS,
  type PipelineStatus,
} from "../lib/assessment-pipeline";

const GITHUB_DRAFT_BODY_MAX = 65_000;

/** Cache for Status-feltliste fra GitHub GraphQL (unngå rate limit ved tab-bytte / re-render). */
const GITHUB_STATUS_OPTIONS_CACHE_TTL_MS = 10 * 60 * 1000;

export const saveGithubProjectStatusOptionsCache = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    projectNodeId: v.string(),
    preferredFieldKey: v.string(),
    fieldId: v.string(),
    fieldName: v.string(),
    options: v.array(v.object({ id: v.string(), name: v.string() })),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.workspaceId, {
      githubProjectStatusFieldCacheAt: Date.now(),
      githubProjectStatusFieldCache: {
        forProjectNodeId: args.projectNodeId,
        preferredFieldKey: args.preferredFieldKey,
        fieldId: args.fieldId,
        fieldName: args.fieldName,
        options: args.options,
      },
    });
  },
});

const GITHUB_REST_HEADERS = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
} as const;

async function restPatchGithubIssue(
  token: string,
  repoFullName: string,
  issueNumber: number,
  title: string,
  body: string,
): Promise<void> {
  const parts = repoFullName.split("/").filter(Boolean);
  if (parts.length < 2) {
    throw new Error("Ugyldig repo-navn for GitHub-issue.");
  }
  const owner = parts[0]!;
  const repo = parts.slice(1).join("/");
  const url = `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      ...GITHUB_REST_HEADERS,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: title.slice(0, 256),
      body,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `GitHub kunne ikke oppdatere issue (HTTP ${res.status}). ${text.slice(0, 280)}`,
    );
  }
}

const COMPLIANCE_NB: Record<string, string> = {
  not_started: "Ikke startet",
  in_progress: "Pågår",
  completed: "Fullført",
  not_applicable: "Ikke relevant",
};

function pipelineNb(s: string | undefined): string {
  if (!s) return "—";
  return PIPELINE_STATUS_LABELS[s as PipelineStatus] ?? s;
}

export type CandidateGithubSyncContext = {
  candidate: Doc<"candidates">;
  workspaceName: string;
  workspaceId: Id<"workspaces">;
  /** Navn og/eller e-post for brukeren som opprettet prosessen (vises på GitHub) */
  createdByLabel: string | null;
  orgUnitName: string | null;
  linkedAssessments: Array<{
    assessmentId: Id<"assessments">;
    title: string;
    pipelineStatus: string | undefined;
    rosStatus: string | undefined;
    rosNotes: string | undefined;
    rosUrl: string | undefined;
    processDescriptionShort: string | undefined;
    notes: Array<{ body: string; createdAt: number; authorLabel: string }>;
  }>;
  rosAnalyses: Array<{
    _id: Id<"rosAnalyses">;
    notes: string | undefined;
    methodologyStatement: string | undefined;
    contextSummary: string | undefined;
    scopeAndCriteria: string | undefined;
    updatedAt: number;
  }>;
};

/** Valgfri Convex-miljøvariabel for klikkbare lenker til PVV (f.eks. https://pvv.example.com). */
function resolvePvvUrl(path: string): string {
  const base = process.env.PVV_PUBLIC_BASE_URL?.trim().replace(/\/$/, "");
  return base ? `${base}${path}` : path;
}

export function formatCandidateGithubMarkdown(
  ctx: CandidateGithubSyncContext,
  baseUrlPath: string,
): string {
  const now = new Date();
  const iso = now.toISOString();
  const c = ctx.candidate;
  const lines: string[] = [
    `# ${c.name}`,
    `[${c.code}]`,
    "",
    `_Synkronisert fra PVV · ${iso}_`,
    "",
    "## Prosessregister",
    `- **Prosess-ID:** ${c.code}`,
    `- **Navn:** ${c.name}`,
  ];
  if (ctx.createdByLabel) {
    lines.push(`- **Registrert i PVV av:** ${ctx.createdByLabel}`);
  }
  if (ctx.orgUnitName) {
    lines.push(`- **Organisasjon (PVV):** ${ctx.orgUnitName}`);
  }
  lines.push(
    "",
    "### Notat til teamet",
    "",
    formatPvvSyncBlock("notes", c.notes?.trim() ?? ""),
  );
  lines.push(
    "",
    "### Ansvarlig / eier (til vurdering)",
    "",
    formatPvvSyncBlock("owner", c.linkHintBusinessOwner?.trim() ?? ""),
  );
  lines.push(
    "",
    "### Systemer og data",
    "",
    formatPvvSyncBlock("systems", c.linkHintSystems?.trim() ?? ""),
  );
  lines.push(
    "",
    "### Sikkerhet og personvern",
    "",
    formatPvvSyncBlock(
      "compliance",
      c.linkHintComplianceNotes?.trim() ?? "",
    ),
  );
  if (ctx.linkedAssessments.length > 0) {
    lines.push("", "## PVV-vurderinger koblet til denne prosessen");
    for (const a of ctx.linkedAssessments) {
      const link = resolvePvvUrl(`${baseUrlPath}/a/${a.assessmentId}`);
      lines.push(
        "",
        `### ${a.title}`,
        `- **Lenke:** ${link}`,
        `- **Pipeline:** ${pipelineNb(a.pipelineStatus)}`,
      );
      if (a.rosStatus) {
        lines.push(
          `- **ROS (status på saken):** ${COMPLIANCE_NB[a.rosStatus] ?? a.rosStatus}`,
        );
      }
      if (a.rosNotes?.trim()) {
        lines.push(`- **ROS-notat:** ${a.rosNotes.trim().slice(0, 2000)}`);
      }
      if (a.rosUrl?.trim()) {
        lines.push(`- **ROS-URL:** ${a.rosUrl.trim()}`);
      }
      if (a.processDescriptionShort?.trim()) {
        lines.push(
          "",
          "**Grunnlag (utdrag fra PVV):**",
          a.processDescriptionShort.trim(),
        );
      }
      if (a.notes.length > 0) {
        lines.push("", "**Samtale i PVV (siste notater):**");
        for (const n of [...a.notes].reverse()) {
          const d = new Date(n.createdAt).toLocaleString("nb-NO");
          lines.push(
            `- _${d} · ${n.authorLabel}_`,
            `${n.body.slice(0, 4000)}`,
            "",
          );
        }
      }
    }
  }
  if (ctx.rosAnalyses.length > 0) {
    lines.push("", "## ROS-analyser (register) koblet til prosessen");
    for (const r of ctx.rosAnalyses) {
      lines.push(`### ROS ${String(r._id).slice(-6)}`);
      if (r.methodologyStatement?.trim()) {
        lines.push("", r.methodologyStatement.trim().slice(0, 3000));
      }
      if (r.contextSummary?.trim()) {
        lines.push("", "**Kontekst:**", r.contextSummary.trim().slice(0, 2000));
      }
      if (r.scopeAndCriteria?.trim()) {
        lines.push("", "**Omfang:**", r.scopeAndCriteria.trim().slice(0, 2000));
      }
      if (r.notes?.trim()) {
        lines.push("", "**Notat:**", r.notes.trim().slice(0, 4000));
      }
      lines.push(
        `_Oppdatert i PVV: ${new Date(r.updatedAt).toLocaleString("nb-NO")}_`,
        "",
      );
    }
  }
  lines.push(
    "",
    "---",
    `*Arbeidsområde: ${ctx.workspaceName ?? "PVV"} · Full tekst kan være kuttet ved veldig store felt.*`,
  );
  if (!process.env.PVV_PUBLIC_BASE_URL?.trim()) {
    lines.push(
      "*Administrator: sett Convex `PVV_PUBLIC_BASE_URL` (f.eks. https://app.example.com) for klikkbare PVV-lenker.*",
    );
  }
  let body = lines.join("\n");
  if (body.length > GITHUB_DRAFT_BODY_MAX) {
    body =
      body.slice(0, GITHUB_DRAFT_BODY_MAX - 80) +
      "\n\n… _(truncated — body too large for GitHub)_";
  }
  return body;
}

/** Hva prosjektkortet peker på: utkast, ekte issue i repo, eller PR. */
export type GithubProjectItemShapeResult = {
  kind: "draft" | "issue" | "pull_request" | "unknown" | "no_item";
  draftIssueId?: string;
  draftTitle?: string;
  issue?: {
    number: number;
    url: string;
    title: string;
    state: string;
    repoFullName: string;
    /** GraphQL node id (Issue) */
    nodeId?: string;
    /** Under-saker (GitHub sub-issues), når API returnerer data */
    subIssuesSummary?: GithubSubIssuesSummary;
  };
  pullRequest?: {
    number: number;
    url: string;
    title: string;
    state: string;
    repoFullName: string;
  };
  /** Normaliserte eier/repo fra arbeidsområdets innstillinger */
  workspaceDefaultRepos: string[];
  /** null hvis ikke issue/PR eller ingen standard-repo satt */
  issueMatchesDefaultRepo: boolean | null;
};

function collectWorkspaceDefaultRepos(workspace: Doc<"workspaces">): string[] {
  const out: string[] = [];
  for (const raw of workspace.githubDefaultRepoFullNames ?? []) {
    try {
      out.push(normalizeGithubRepoFullName(raw));
    } catch {
      /* hopp over ugyldig */
    }
  }
  if (workspace.githubDefaultRepoFullName?.trim()) {
    try {
      out.push(normalizeGithubRepoFullName(workspace.githubDefaultRepoFullName));
    } catch {
      /* */
    }
  }
  return [...new Set(out)];
}

export async function fetchGithubProjectItemShape(
  token: string,
  projectItemId: string,
  workspaceDefaultRepos: string[],
): Promise<GithubProjectItemShapeResult> {
  const q = `query($id: ID!) {
    node(id: $id) {
      ... on ProjectV2Item {
        content {
          __typename
          ... on DraftIssue {
            id
            title
          }
          ... on Issue {
            id
            number
            url
            title
            state
            repository { nameWithOwner }
          }
          ... on PullRequest {
            id
            number
            url
            title
            state
            repository { nameWithOwner }
          }
        }
      }
    }
  }`;
  const json = await githubGraphql(token, q, { id: projectItemId });
  const node = (json.data as { node?: { content?: Record<string, unknown> | null } | null })
    ?.node;
  const content = node?.content;
  if (!content || typeof content !== "object") {
    return {
      kind: "unknown",
      workspaceDefaultRepos,
      issueMatchesDefaultRepo: null,
    };
  }
  const tn = (content as { __typename?: string }).__typename;
  if (tn === "DraftIssue") {
    const id = (content as { id?: string }).id;
    const title = (content as { title?: string }).title;
    return {
      kind: "draft",
      draftIssueId: typeof id === "string" ? id : undefined,
      draftTitle: typeof title === "string" ? title : undefined,
      workspaceDefaultRepos,
      issueMatchesDefaultRepo: null,
    };
  }
  if (tn === "Issue") {
    const c = content as {
      id?: string;
      number?: number;
      url?: string;
      title?: string;
      state?: string;
      repository?: { nameWithOwner?: string };
    };
    const repoRaw = c.repository?.nameWithOwner?.trim();
    let repoFullName = "";
    if (repoRaw) {
      try {
        repoFullName = normalizeGithubRepoFullName(repoRaw);
      } catch {
        repoFullName = repoRaw.toLowerCase();
      }
    }
    const issueMatchesDefaultRepo =
      workspaceDefaultRepos.length === 0
        ? null
        : repoFullName.length > 0 &&
          workspaceDefaultRepos.includes(repoFullName);
    const issueNumber = typeof c.number === "number" ? c.number : 0;
    let subIssuesSummary: GithubSubIssuesSummary | undefined;
    if (repoFullName.length > 0 && issueNumber > 0) {
      const sub = await fetchGithubSubIssuesSummary(
        token,
        repoFullName,
        issueNumber,
      );
      if (sub) {
        subIssuesSummary = sub;
      }
    }
    return {
      kind: "issue",
      issue: {
        number: issueNumber,
        url: typeof c.url === "string" ? c.url : "",
        title: typeof c.title === "string" ? c.title : "",
        state: typeof c.state === "string" ? c.state : "",
        repoFullName,
        nodeId: typeof c.id === "string" ? c.id : undefined,
        ...(subIssuesSummary ? { subIssuesSummary } : {}),
      },
      workspaceDefaultRepos,
      issueMatchesDefaultRepo,
    };
  }
  if (tn === "PullRequest") {
    const c = content as {
      number?: number;
      url?: string;
      title?: string;
      state?: string;
      repository?: { nameWithOwner?: string };
    };
    const repoRaw = c.repository?.nameWithOwner?.trim();
    let repoFullName = "";
    if (repoRaw) {
      try {
        repoFullName = normalizeGithubRepoFullName(repoRaw);
      } catch {
        repoFullName = repoRaw.toLowerCase();
      }
    }
    const issueMatchesDefaultRepo =
      workspaceDefaultRepos.length === 0
        ? null
        : repoFullName.length > 0 &&
          workspaceDefaultRepos.includes(repoFullName);
    return {
      kind: "pull_request",
      pullRequest: {
        number: typeof c.number === "number" ? c.number : 0,
        url: typeof c.url === "string" ? c.url : "",
        title: typeof c.title === "string" ? c.title : "",
        state: typeof c.state === "string" ? c.state : "",
        repoFullName,
      },
      workspaceDefaultRepos,
      issueMatchesDefaultRepo,
    };
  }
  return {
    kind: "unknown",
    workspaceDefaultRepos,
    issueMatchesDefaultRepo: null,
  };
}

async function updateDraftIssueBodyAndTitle(
  token: string,
  draftIssueId: string,
  title: string,
  body: string,
): Promise<void> {
  const m = `mutation($input: UpdateProjectV2DraftIssueInput!) {
    updateProjectV2DraftIssue(input: $input) {
      draftIssue { id title }
    }
  }`;
  await githubGraphql(token, m, {
    input: {
      draftIssueId,
      title: title.slice(0, 256),
      body,
    },
  });
}

async function pushCandidateMarkdownToGithub(
  ctx: ActionCtx,
  candidateId: Id<"candidates">,
  userId: Id<"users">,
  mode: "silent" | "throw",
): Promise<void> {
  const { candidate, workspace } = await assertMemberForCandidate(
    ctx,
    candidateId,
    userId,
  );
  const itemNodeId = candidate.githubProjectItemNodeId?.trim();
  if (!itemNodeId) {
    if (mode === "throw") {
      throw new Error("Ingen prosjektkobling.");
    }
    return;
  }
  const syncCtx = await ctx.runQuery(
    internal.candidates.getCandidateGithubSyncContext,
    { candidateId },
  );
  if (!syncCtx) {
    if (mode === "throw") {
      throw new Error("Fant ikke prosessdata.");
    }
    return;
  }
  const token = await resolveGithubToken(ctx, candidate.workspaceId);
  const basePath = `/w/${syncCtx.workspaceId}`;
  const mdBody = formatCandidateGithubMarkdown(
    syncCtx as CandidateGithubSyncContext,
    basePath,
  );
  const title = `[${syncCtx.candidate.code}] ${syncCtx.candidate.name}`.slice(
    0,
    256,
  );
  const defaultRepos = collectWorkspaceDefaultRepos(workspace);
  const shape = await fetchGithubProjectItemShape(
    token,
    itemNodeId,
    defaultRepos,
  );

  if (shape.kind === "draft" && shape.draftIssueId) {
    await updateDraftIssueBodyAndTitle(
      token,
      shape.draftIssueId,
      title,
      mdBody,
    );
    await ctx.runMutation(internal.candidates.clearGithubIssueLink, {
      candidateId,
    });
    return;
  }

  if (
    shape.kind === "issue" &&
    shape.issue &&
    shape.issue.repoFullName &&
    shape.issue.number > 0
  ) {
    await restPatchGithubIssue(
      token,
      shape.issue.repoFullName,
      shape.issue.number,
      title,
      mdBody,
    );
    await ctx.runMutation(internal.candidates.setGithubIssueLinkFromGithub, {
      candidateId,
      githubRepoFullName: shape.issue.repoFullName,
      githubIssueNumber: shape.issue.number,
      githubIssueNodeId: shape.issue.nodeId,
    });
    return;
  }

  if (mode === "throw") {
    if (shape.kind === "pull_request") {
      throw new Error(
        "Prosjektkortet er en pull request. Synk gjelder utkast eller issue.",
      );
    }
    throw new Error(
      "Fant ikke utkast eller issue på GitHub — sjekk at prosjektkortet er koblet.",
    );
  }
}

type SingleSelectField = {
  __typename: string;
  id: string;
  name: string;
  options: { id: string; name: string }[];
};

function parseAllSingleSelectFields(nodes: unknown): SingleSelectField[] {
  if (!Array.isArray(nodes)) {
    return [];
  }
  const selects: SingleSelectField[] = [];
  for (const n of nodes) {
    if (
      n &&
      typeof n === "object" &&
      (n as { __typename?: string }).__typename ===
        "ProjectV2SingleSelectField" &&
      "id" in n &&
      "name" in n &&
      "options" in n
    ) {
      const f = n as SingleSelectField;
      if (Array.isArray(f.options)) {
        selects.push(f);
      }
    }
  }
  return selects;
}

function resolveSingleSelectFieldFromList(
  selects: SingleSelectField[],
  preferredFieldId: string | null | undefined,
): SingleSelectField | null {
  if (selects.length === 0) {
    return null;
  }
  const trimmed = preferredFieldId?.trim();
  if (trimmed) {
    const found = selects.find((f) => f.id === trimmed);
    if (!found) {
      throw new Error(
        "Valgt prosjektkolonne finnes ikke i GitHub-prosjektet. Velg felt på nytt under Innstillinger → GitHub.",
      );
    }
    return found;
  }
  const byName = selects.find(
    (f) => f.name.trim().toLowerCase() === "status",
  );
  return byName ?? selects[0] ?? null;
}

const PROJECT_V2_SINGLE_SELECT_FIELDS_QUERY = `query($id: ID!) {
  node(id: $id) {
    ... on ProjectV2 {
      id
      fields(first: 50) {
        nodes {
          __typename
          ... on ProjectV2SingleSelectField {
            id
            name
            options { id name }
          }
        }
      }
    }
  }
}`;

async function fetchProjectV2SingleSelectFieldsFromGithub(
  token: string,
  projectNodeId: string,
): Promise<SingleSelectField[]> {
  const json = await githubGraphql(token, PROJECT_V2_SINGLE_SELECT_FIELDS_QUERY, {
    id: projectNodeId.trim(),
  });
  const rawNodes = (
    json.data as {
      node?: { fields?: { nodes?: unknown[] } };
    }
  )?.node?.fields?.nodes;
  return parseAllSingleSelectFields(rawNodes ?? []);
}

function preferredFieldKeyFromWorkspace(workspace: Doc<"workspaces">): string {
  return workspace.githubProjectSingleSelectFieldId?.trim() || "__auto__";
}

async function assertMemberForCandidate(
  ctx: ActionCtx,
  candidateId: Id<"candidates">,
  userId: Id<"users">,
): Promise<{
  candidate: Doc<"candidates">;
  workspace: Doc<"workspaces">;
}> {
  const row = await ctx.runQuery(internal.candidates.getCandidateForGithub, {
    candidateId,
  });
  if (!row?.candidate || !row.workspace) {
    throw new Error("Prosess finnes ikke.");
  }
  await ctx.runQuery(internal.candidates.assertMemberForWorkspace, {
    workspaceId: row.candidate.workspaceId,
    userId,
  });
  return { candidate: row.candidate, workspace: row.workspace };
}

export type ListGithubProjectStatusOptionsResult = {
  projectNodeId: string;
  fieldId: string;
  fieldName: string;
  options: { id: string; name: string }[];
  /** True når GitHub svarte rate limit og vi ikke hadde lagret cache — tom liste, ikke kastet feil. */
  githubRateLimited?: boolean;
};

export async function fetchProjectStatusFieldOptions(
  token: string,
  projectNodeId: string,
  preferredFieldId?: string | null,
): Promise<{ fieldId: string; fieldName: string; options: { id: string; name: string }[] }> {
  const selects = await fetchProjectV2SingleSelectFieldsFromGithub(
    token,
    projectNodeId,
  );
  const field = resolveSingleSelectFieldFromList(selects, preferredFieldId);
  if (!field || field.options.length === 0) {
    throw new Error(
      "Fant ingen enkeltvalg-felt (kolonne) i prosjektet. Legg til et enkeltvalg-felt på GitHub, eller velg et annet felt under Innstillinger.",
    );
  }
  return {
    fieldId: field.id,
    fieldName: field.name,
    options: field.options.map((o) => ({ id: o.id, name: o.name })),
  };
}

/**
 * Bruker workspace-cache for statusfelt (samme TTL som listGithubProjectStatusOptions)
 * slik at registrering/oppdatering ikke treffer GraphQL feltliste hver gang (rate limit).
 */
async function getProjectStatusFieldMetaWithCache(
  ctx: ActionCtx,
  args: {
    workspaceId: Id<"workspaces">;
    workspace: Doc<"workspaces">;
    projectNodeId: string;
    token: string;
  },
): Promise<{
  fieldId: string;
  fieldName: string;
  options: { id: string; name: string }[];
}> {
  const { workspaceId, workspace, projectNodeId, token } = args;
  const prefKey = preferredFieldKeyFromWorkspace(workspace);
  const cache = workspace.githubProjectStatusFieldCache;
  const cachedAt = workspace.githubProjectStatusFieldCacheAt;
  const now = Date.now();

  if (
    cache &&
    cachedAt != null &&
    cache.forProjectNodeId === projectNodeId &&
    (cache.preferredFieldKey ?? "__auto__") === prefKey &&
    now - cachedAt < GITHUB_STATUS_OPTIONS_CACHE_TTL_MS
  ) {
    return {
      fieldId: cache.fieldId,
      fieldName: cache.fieldName,
      options: cache.options,
    };
  }

  try {
    const meta = await fetchProjectStatusFieldOptions(
      token,
      projectNodeId,
      workspace.githubProjectSingleSelectFieldId?.trim() || null,
    );
    await ctx.runMutation(
      internal.githubCandidateProject.saveGithubProjectStatusOptionsCache,
      {
        workspaceId,
        projectNodeId,
        preferredFieldKey: prefKey,
        fieldId: meta.fieldId,
        fieldName: meta.fieldName,
        options: meta.options,
      },
    );
    return meta;
  } catch (e) {
    if (
      isGithubGraphqlRateLimitError(e) &&
      cache &&
      cache.forProjectNodeId === projectNodeId &&
      (cache.preferredFieldKey ?? "__auto__") === prefKey
    ) {
      return {
        fieldId: cache.fieldId,
        fieldName: cache.fieldName,
        options: cache.options,
      };
    }
    throw e;
  }
}

function sanitizeGithubCommentLine(s: string, max: number): string {
  const t = s.replace(/\r\n/g, "\n").replace(/\n/g, " ").trim();
  const cut = t.slice(0, max);
  return cut.replace(/\*/g, "·");
}

/** Intern: legg inn issue-kommentar når ROS-status settes til fullført (kun ved overgang til completed). */
export const postRosCompletedGithubComment = internalAction({
  args: { assessmentId: v.id("assessments") },
  handler: async (ctx, args) => {
    const context = await ctx.runQuery(
      internal.candidates.getGithubRosCompletedCommentContext,
      { assessmentId: args.assessmentId },
    );
    if (!context) {
      return { posted: false as const, reason: "no_context" as const };
    }
    let token: string;
    try {
      token = await resolveGithubToken(ctx, context.workspaceId);
    } catch {
      return { posted: false as const, reason: "no_token" as const };
    }
    const parts = context.githubRepoFullName.split("/").filter(Boolean);
    if (parts.length < 2) {
      return { posted: false as const, reason: "bad_repo" as const };
    }
    const owner = parts[0]!;
    const repo = parts.slice(1).join("/");
    const titleSafe = sanitizeGithubCommentLine(context.assessmentTitle, 200);
    const body =
      `**PVV:** ROS er satt til **fullført** for prosess \`${context.processCode}\` (${sanitizeGithubCommentLine(context.processName, 120)}) · vurdering «${titleSafe}».`;
    const url = `https://api.github.com/repos/${owner}/${repo}/issues/${context.githubIssueNumber}/comments`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          ...GITHUB_REST_HEADERS,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ body }),
      });
      if (!res.ok) {
        const text = await res.text();
        console.error(
          "[postRosCompletedGithubComment] GitHub HTTP",
          res.status,
          text.slice(0, 300),
        );
        return { posted: false as const, reason: "http_error" as const };
      }
      return { posted: true as const };
    } catch (e) {
      console.error("[postRosCompletedGithubComment]", e);
      return { posted: false as const, reason: "fetch_error" as const };
    }
  },
});

export const listGithubProjectStatusOptions = action({
  args: {
    workspaceId: v.id("workspaces"),
    /** Tving nytt kall til GitHub (f.eks. etter endring av prosjekt på GitHub). */
    forceRefresh: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<ListGithubProjectStatusOptionsResult> => {
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
      {
        workspaceId: args.workspaceId,
      },
    );
    if (!workspace) {
      throw new Error("Arbeidsområde finnes ikke.");
    }
    const projectNodeId: string | undefined = workspace.githubProjectNodeId?.trim();
    if (!projectNodeId) {
      throw new Error(
        "Ingen GitHub-prosjekt-node-ID er lagret for arbeidsområdet. Konfigurer under Innstillinger → GitHub.",
      );
    }
    const now = Date.now();
    const prefKey = preferredFieldKeyFromWorkspace(workspace);
    const cache = workspace.githubProjectStatusFieldCache;
    const cachedAt = workspace.githubProjectStatusFieldCacheAt;
    if (
      !args.forceRefresh &&
      cache &&
      cachedAt != null &&
      cache.forProjectNodeId === projectNodeId &&
      (cache.preferredFieldKey ?? "__auto__") === prefKey &&
      now - cachedAt < GITHUB_STATUS_OPTIONS_CACHE_TTL_MS
    ) {
      return {
        projectNodeId,
        fieldId: cache.fieldId,
        fieldName: cache.fieldName,
        options: cache.options,
      };
    }
    const token = await resolveGithubToken(ctx, args.workspaceId);
    try {
      const meta = await fetchProjectStatusFieldOptions(
        token,
        projectNodeId,
        workspace.githubProjectSingleSelectFieldId?.trim() || null,
      );
      await ctx.runMutation(
        internal.githubCandidateProject.saveGithubProjectStatusOptionsCache,
        {
          workspaceId: args.workspaceId,
          projectNodeId,
          preferredFieldKey: prefKey,
          fieldId: meta.fieldId,
          fieldName: meta.fieldName,
          options: meta.options,
        },
      );
      return { projectNodeId, ...meta };
    } catch (e) {
      if (!isGithubGraphqlRateLimitError(e)) {
        throw e;
      }
      if (
        cache &&
        cache.forProjectNodeId === projectNodeId &&
        (cache.preferredFieldKey ?? "__auto__") === prefKey
      ) {
        return {
          projectNodeId,
          fieldId: cache.fieldId,
          fieldName: cache.fieldName,
          options: cache.options,
        };
      }
      return {
        projectNodeId,
        fieldId: "",
        fieldName: "Status",
        options: [],
        githubRateLimited: true,
      };
    }
  },
});

export type GithubProjectSingleSelectFieldRow = {
  id: string;
  name: string;
  optionCount: number;
};

/** Lister alle enkeltvalg-felt (kolonner) i prosjektet — velg hvilket PVV skal styre under innstillinger. */
export const listGithubProjectSingleSelectFields = action({
  args: { workspaceId: v.id("workspaces") },
  handler: async (
    ctx,
    args,
  ): Promise<{ fields: GithubProjectSingleSelectFieldRow[] }> => {
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
        "Lagre GitHub-prosjekt (node-ID) først, så kan vi hente kolonner.",
      );
    }
    const token = await resolveGithubToken(ctx, args.workspaceId);
    const selects = await fetchProjectV2SingleSelectFieldsFromGithub(
      token,
      projectNodeId,
    );
    return {
      fields: selects.map((f) => ({
        id: f.id,
        name: f.name,
        optionCount: f.options.length,
      })),
    };
  },
});

/**
 * Sjekker om prosjektkortet er utkast, ekte issue i repo, eller PR — og om repo matcher standard-repo.
 * Skriver ikke til databasen (unngår Convex-konflikt ved mange parallelle kall + GitHub rate limit).
 * Repo/issue-kobling lagres ved «Synk til GitHub» (`pushCandidateMarkdownToGithub`).
 */
export const describeGithubProjectItemForCandidate = action({
  args: { candidateId: v.id("candidates") },
  handler: async (ctx, args): Promise<GithubProjectItemShapeResult> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Du må være innlogget.");
    }
    const { candidate, workspace } = await assertMemberForCandidate(
      ctx,
      args.candidateId,
      userId,
    );
    const defaultRepos = collectWorkspaceDefaultRepos(workspace);
    const itemId = candidate.githubProjectItemNodeId?.trim();
    if (!itemId) {
      return {
        kind: "no_item",
        workspaceDefaultRepos: defaultRepos,
        issueMatchesDefaultRepo: null,
      };
    }
    const token = await resolveGithubToken(ctx, candidate.workspaceId);
    return await fetchGithubProjectItemShape(token, itemId, defaultRepos);
  },
});

/** Henter Markdown-body fra prosjektkort (utkast, issue eller PR). */
async function fetchGithubProjectItemMarkdownBody(
  token: string,
  projectItemNodeId: string,
): Promise<string | null> {
  const q = `query($id: ID!) {
    node(id: $id) {
      ... on ProjectV2Item {
        content {
          __typename
          ... on DraftIssue {
            body
          }
          ... on Issue {
            body
          }
          ... on PullRequest {
            body
          }
        }
      }
    }
  }`;
  const json = await githubGraphql(token, q, { id: projectItemNodeId.trim() });
  const content = (
    json.data as {
      node?: {
        content?: { __typename?: string; body?: string | null } | null;
      } | null;
    }
  )?.node?.content;
  if (!content || typeof content !== "object") {
    return null;
  }
  const b = (content as { body?: string | null }).body;
  return typeof b === "string" ? b : null;
}

export type ImportPvvFieldsFromGithubResult =
  | { ok: true; updatedKeys: string[] }
  | {
      ok: false;
      reason:
        | "empty_body"
        | "no_markers"
        | "no_extracted_fields";
    };

/**
 * Leser synkbare felt fra GitHub (markører `<!-- pvv:b64:… -->`) inn i prosessregisteret.
 * PVV/ROS som full Markdown genereres ved «Send til GitHub»; tilbakehenting gjelder merkede blokker.
 */
export const importPvvFieldsFromGithubProjectItem = action({
  args: { candidateId: v.id("candidates") },
  handler: async (ctx, args): Promise<ImportPvvFieldsFromGithubResult> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Du må være innlogget.");
    }
    const { candidate } = await assertMemberForCandidate(
      ctx,
      args.candidateId,
      userId,
    );
    const itemId = candidate.githubProjectItemNodeId?.trim();
    if (!itemId) {
      throw new Error(
        "Koble prosessen til prosjektet («Legg til i tavle») før du henter fra GitHub.",
      );
    }
    const token = await resolveGithubToken(ctx, candidate.workspaceId);
    const bodyText = await fetchGithubProjectItemMarkdownBody(token, itemId);
    if (bodyText === null || bodyText.trim() === "") {
      return {
        ok: false as const,
        reason: "empty_body" as const,
      };
    }
    const result = await ctx.runMutation(
      internal.candidates.applyPvvSyncedMarkersFromBody,
      {
        candidateId: args.candidateId,
        body: bodyText,
      },
    );
    if (result.applied === false) {
      return {
        ok: false as const,
        reason: result.reason,
      };
    }
    return {
      ok: true as const,
      updatedKeys: result.updatedKeys,
    };
  },
});

export const registerCandidateToGithubProject = action({
  args: {
    candidateId: v.id("candidates"),
    statusOptionId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Du må være innlogget.");
    }
    const { candidate, workspace } = await assertMemberForCandidate(
      ctx,
      args.candidateId,
      userId,
    );
    if (candidate.githubProjectItemNodeId) {
      throw new Error(
        "Prosessen er allerede registrert i prosjektet. Bruk «Oppdater status» eller «Fjern fra prosjekt».",
      );
    }
    const projectNodeId = workspace.githubProjectNodeId?.trim();
    if (!projectNodeId) {
      throw new Error(
        "Arbeidsområdet har ikke GitHub-prosjekt konfigurert. Lagre det i innstillinger først.",
      );
    }
    const token = await resolveGithubToken(ctx, candidate.workspaceId);
    const meta = await getProjectStatusFieldMetaWithCache(ctx, {
      workspaceId: candidate.workspaceId,
      workspace,
      projectNodeId,
      token,
    });
    if (!meta.options.some((o) => o.id === args.statusOptionId)) {
      throw new Error("Ugyldig status — hent statuslisten på nytt.");
    }
    const syncCtx = await ctx.runQuery(
      internal.candidates.getCandidateGithubSyncContext,
      { candidateId: args.candidateId },
    );
    if (!syncCtx) {
      throw new Error("Kunne ikke hente prosessdata for GitHub.");
    }
    const title = `[${syncCtx.candidate.code}] ${syncCtx.candidate.name}`.slice(
      0,
      256,
    );
    const basePath = `/w/${syncCtx.workspaceId}`;
    const draftBody = formatCandidateGithubMarkdown(
      syncCtx as CandidateGithubSyncContext,
      basePath,
    );
    const addM = `mutation($projectId: ID!, $title: String!, $body: String) {
      addProjectV2DraftIssue(input: {projectId: $projectId, title: $title, body: $body}) {
        projectItem { id }
      }
    }`;
    const addJson = await githubGraphql(token, addM, {
      projectId: projectNodeId,
      title,
      body: draftBody,
    });
    const itemId = (
      addJson.data as {
        addProjectV2DraftIssue?: { projectItem?: { id?: string } | null };
      }
    )?.addProjectV2DraftIssue?.projectItem?.id;
    if (!itemId) {
      throw new Error(
        "GitHub kunne ikke opprette utkast i prosjektet (manglende tilgang eller prosjekt).",
      );
    }
    const updM = `mutation($input: UpdateProjectV2ItemFieldValueInput!) {
      updateProjectV2ItemFieldValue(input: $input) {
        projectV2Item { id }
      }
    }`;
    await githubGraphql(token, updM, {
      input: {
        projectId: projectNodeId,
        itemId,
        fieldId: meta.fieldId,
        value: { singleSelectOptionId: args.statusOptionId },
      },
    });
    await ctx.runMutation(internal.candidates.setGithubProjectItem, {
      candidateId: args.candidateId,
      itemNodeId: itemId,
      statusOptionId: args.statusOptionId,
    });
    return { ok: true as const, itemNodeId: itemId };
  },
});

/**
 * Oppretter ekte GitHub-issue i standard-repo, legger den i prosjekt-tavlen med valgt status,
 * kobler PVV-prosessen og synker Markdown (samme som «Send til GitHub»).
 */
export const createGithubRepoIssueForCandidate = action({
  args: {
    candidateId: v.id("candidates"),
    statusOptionId: v.string(),
    repoFullName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Du må være innlogget.");
    }
    const { candidate, workspace } = await assertMemberForCandidate(
      ctx,
      args.candidateId,
      userId,
    );
    if (candidate.githubProjectItemNodeId) {
      throw new Error(
        "Prosessen er allerede koblet til GitHub-prosjektet. Bruk «Send til GitHub» eller fjern koblingen først.",
      );
    }
    const projectNodeId = workspace.githubProjectNodeId?.trim();
    if (!projectNodeId) {
      throw new Error(
        "Arbeidsområdet har ikke GitHub-prosjekt konfigurert. Lagre det i innstillinger først.",
      );
    }
    const defaultRepos = collectWorkspaceDefaultRepos(workspace);
    let repo: string | undefined;
    if (args.repoFullName?.trim()) {
      try {
        repo = normalizeGithubRepoFullName(args.repoFullName);
      } catch {
        throw new Error("Ugyldig repo-navn.");
      }
    } else if (defaultRepos.length > 0) {
      repo = defaultRepos[0];
    } else {
      throw new Error(
        "Sett minst ett standard GitHub-repo under Innstillinger → GitHub før du oppretter issue i repo.",
      );
    }
    const token = await resolveGithubToken(ctx, candidate.workspaceId);
    const meta = await getProjectStatusFieldMetaWithCache(ctx, {
      workspaceId: candidate.workspaceId,
      workspace,
      projectNodeId,
      token,
    });
    if (!meta.options.some((o) => o.id === args.statusOptionId)) {
      throw new Error("Ugyldig status — hent statuslisten på nytt.");
    }
    const syncCtx = await ctx.runQuery(
      internal.candidates.getCandidateGithubSyncContext,
      { candidateId: args.candidateId },
    );
    if (!syncCtx) {
      throw new Error("Kunne ikke hente prosessdata for GitHub.");
    }
    const title = `[${syncCtx.candidate.code}] ${syncCtx.candidate.name}`.slice(
      0,
      256,
    );
    const [owner, repoName] = repo.split("/");
    const res = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repoName)}/issues`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          ...GITHUB_REST_HEADERS,
        },
        body: JSON.stringify({ title, body: "" }),
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
    const addM = `mutation($projectId: ID!, $contentId: ID!) {
      addProjectV2ItemById(input: {projectId: $projectId, contentId: $contentId}) {
        item { id }
      }
    }`;
    const addJson = await githubGraphql(token, addM, {
      projectId: projectNodeId,
      contentId: issue.node_id,
    });
    const itemId = (
      addJson.data as {
        addProjectV2ItemById?: { item?: { id?: string } | null } | null;
      }
    )?.addProjectV2ItemById?.item?.id;
    if (!itemId) {
      throw new Error(
        "Issue ble opprettet i GitHub, men kunne ikke legges i prosjekt-tavlen. Sjekk PAT (Projects), prosjekt-node-ID og at repoet kan brukes i prosjektet.",
      );
    }
    const updM = `mutation($input: UpdateProjectV2ItemFieldValueInput!) {
      updateProjectV2ItemFieldValue(input: $input) {
        projectV2Item { id }
      }
    }`;
    await githubGraphql(token, updM, {
      input: {
        projectId: projectNodeId,
        itemId,
        fieldId: meta.fieldId,
        value: { singleSelectOptionId: args.statusOptionId },
      },
    });
    await ctx.runMutation(internal.candidates.setGithubProjectItemWithIssueLink, {
      candidateId: args.candidateId,
      itemNodeId: itemId,
      statusOptionId: args.statusOptionId,
      githubRepoFullName: repo,
      githubIssueNumber: issue.number,
      githubIssueNodeId: issue.node_id,
    });
    await pushCandidateMarkdownToGithub(ctx, args.candidateId, userId, "throw");
    return { ok: true as const, itemNodeId: itemId };
  },
});

export const syncCandidateGithubDraft = action({
  args: { candidateId: v.id("candidates") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Du må være innlogget.");
    }
    const { candidate } = await assertMemberForCandidate(
      ctx,
      args.candidateId,
      userId,
    );
    if (!candidate.githubProjectItemNodeId?.trim()) {
      throw new Error(
        "Prosessen er ikke i GitHub-prosjektet — bruk «Legg til i tavle» først.",
      );
    }
    await pushCandidateMarkdownToGithub(
      ctx,
      args.candidateId,
      userId,
      "throw",
    );
    return { ok: true as const };
  },
});

export const updateCandidateGithubProjectStatus = action({
  args: {
    candidateId: v.id("candidates"),
    statusOptionId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Du må være innlogget.");
    }
    const { candidate, workspace } = await assertMemberForCandidate(
      ctx,
      args.candidateId,
      userId,
    );
    const itemId = candidate.githubProjectItemNodeId?.trim();
    if (!itemId) {
      throw new Error(
        "Prosessen er ikke registrert i prosjektet ennå. Bruk «Registrer i prosjekt».",
      );
    }
    const projectNodeId = workspace.githubProjectNodeId?.trim();
    if (!projectNodeId) {
      throw new Error("Arbeidsområdet mangler prosjekt-node-ID.");
    }
    const token = await resolveGithubToken(ctx, candidate.workspaceId);
    const meta = await getProjectStatusFieldMetaWithCache(ctx, {
      workspaceId: candidate.workspaceId,
      workspace,
      projectNodeId,
      token,
    });
    if (!meta.options.some((o) => o.id === args.statusOptionId)) {
      throw new Error("Ugyldig status — hent statuslisten på nytt.");
    }
    const updM = `mutation($input: UpdateProjectV2ItemFieldValueInput!) {
      updateProjectV2ItemFieldValue(input: $input) {
        projectV2Item { id }
      }
    }`;
    await githubGraphql(token, updM, {
      input: {
        projectId: projectNodeId,
        itemId,
        fieldId: meta.fieldId,
        value: { singleSelectOptionId: args.statusOptionId },
      },
    });
    await ctx.runMutation(internal.candidates.setGithubProjectItem, {
      candidateId: args.candidateId,
      itemNodeId: itemId,
      statusOptionId: args.statusOptionId,
    });
    try {
      await pushCandidateMarkdownToGithub(
        ctx,
        args.candidateId,
        userId,
        "silent",
      );
    } catch {
      /* status er oppdatert; Markdown-synk er best-effort */
    }
    return { ok: true as const };
  },
});

export const removeCandidateFromGithubProject = action({
  args: { candidateId: v.id("candidates") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Du må være innlogget.");
    }
    const { candidate } = await assertMemberForCandidate(
      ctx,
      args.candidateId,
      userId,
    );
    const itemId = candidate.githubProjectItemNodeId?.trim();
    if (!itemId) {
      throw new Error("Ingen prosjektkobling å fjerne.");
    }
    const token = await resolveGithubToken(ctx, candidate.workspaceId);
    const delM = `mutation($itemId: ID!) {
      deleteProjectV2Item(input: {itemId: $itemId}) {
        deletedItemId
      }
    }`;
    await githubGraphql(token, delM, { itemId });
    await ctx.runMutation(internal.candidates.setGithubProjectItem, {
      candidateId: args.candidateId,
      itemNodeId: null,
    });
    return { ok: true as const };
  },
});
