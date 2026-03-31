import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { ActionCtx } from "./_generated/server";
import { action } from "./_generated/server";
import { normalizeGithubRepoFullName } from "./lib/github";
import { resolveGithubToken } from "./githubTasks";
import {
  PIPELINE_STATUS_LABELS,
  type PipelineStatus,
} from "../lib/assessment-pipeline";

const GITHUB_DRAFT_BODY_MAX = 65_000;

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
  if (ctx.orgUnitName) {
    lines.push(`- **Organisasjon (PVV):** ${ctx.orgUnitName}`);
  }
  if (c.notes?.trim()) {
    lines.push("", "### Notat til teamet", c.notes.trim());
  }
  if (c.linkHintBusinessOwner?.trim()) {
    lines.push(
      "",
      "### Ansvarlig / eier (til vurdering)",
      c.linkHintBusinessOwner.trim(),
    );
  }
  if (c.linkHintSystems?.trim()) {
    lines.push("", "### Systemer og data", c.linkHintSystems.trim());
  }
  if (c.linkHintComplianceNotes?.trim()) {
    lines.push(
      "",
      "### Sikkerhet og personvern",
      c.linkHintComplianceNotes.trim(),
    );
  }
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

const GITHUB_GRAPHQL = "https://api.github.com/graphql";

type GraphqlPayload = {
  data?: unknown;
  errors?: { message: string }[];
};

async function githubGraphql(
  token: string,
  query: string,
  variables: Record<string, unknown>,
): Promise<GraphqlPayload> {
  const res = await fetch(GITHUB_GRAPHQL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });
  const text = await res.text();
  let json: GraphqlPayload;
  try {
    json = JSON.parse(text) as GraphqlPayload;
  } catch {
    throw new Error(
      `GitHub GraphQL: ugyldig svar (HTTP ${res.status}). ${text.slice(0, 200)}`,
    );
  }
  if (!res.ok) {
    throw new Error(
      `GitHub GraphQL: HTTP ${res.status}. ${text.slice(0, 240)}`,
    );
  }
  if (json.errors?.length) {
    throw new Error(
      json.errors.map((e) => e.message).join("; ") || "GraphQL feilet.",
    );
  }
  return json;
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
      kind: "issue",
      issue: {
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

async function graphqlDraftIssueIdFromProjectItem(
  token: string,
  projectItemId: string,
): Promise<string | null> {
  const shape = await fetchGithubProjectItemShape(token, projectItemId, []);
  if (shape.kind !== "draft" || !shape.draftIssueId) {
    return null;
  }
  return shape.draftIssueId;
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

async function pushCandidateMarkdownToGithubDraft(
  ctx: ActionCtx,
  candidateId: Id<"candidates">,
  userId: Id<"users">,
  mode: "silent" | "throw",
): Promise<void> {
  const { candidate } = await assertMemberForCandidate(
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
  const body = formatCandidateGithubMarkdown(
    syncCtx as CandidateGithubSyncContext,
    basePath,
  );
  const title = `[${syncCtx.candidate.code}] ${syncCtx.candidate.name}`.slice(
    0,
    256,
  );
  const draftId = await graphqlDraftIssueIdFromProjectItem(token, itemNodeId);
  if (!draftId) {
    if (mode === "throw") {
      throw new Error(
        "Fant ikke utkast på GitHub (konvertert til issue?). Synk gjelder prosjekt-utkast.",
      );
    }
    return;
  }
  await updateDraftIssueBodyAndTitle(token, draftId, title, body);
}

type SingleSelectField = {
  __typename: string;
  id: string;
  name: string;
  options: { id: string; name: string }[];
};

function pickStatusField(nodes: unknown): SingleSelectField | null {
  if (!Array.isArray(nodes)) return null;
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
  if (selects.length === 0) return null;
  const byName = selects.find(
    (f) => f.name.trim().toLowerCase() === "status",
  );
  return byName ?? selects[0] ?? null;
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
};

export async function fetchProjectStatusFieldOptions(
  token: string,
  projectNodeId: string,
): Promise<{ fieldId: string; fieldName: string; options: { id: string; name: string }[] }> {
  const query = `query($id: ID!) {
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
  const json = await githubGraphql(token, query, { id: projectNodeId.trim() });
  const node = (
    json.data as {
      node?: {
        fields?: { nodes?: unknown[] };
      };
    }
  )?.node;
  const rawNodes = node?.fields?.nodes;
  const field = pickStatusField(rawNodes ?? []);
  if (!field || field.options.length === 0) {
    throw new Error(
      "Fant ingen enkeltvalg-felt (f.eks. Status) i prosjektet. Sjekk prosjektet på GitHub.",
    );
  }
  return {
    fieldId: field.id,
    fieldName: field.name,
    options: field.options.map((o) => ({ id: o.id, name: o.name })),
  };
}

export const listGithubProjectStatusOptions = action({
  args: { workspaceId: v.id("workspaces") },
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
    const token = await resolveGithubToken(ctx, args.workspaceId);
    const meta = await fetchProjectStatusFieldOptions(token, projectNodeId);
    return { projectNodeId, ...meta };
  },
});

/** Sjekker om prosjektkortet er utkast, ekte issue i repo, eller PR — og om repo matcher standard-repo. */
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
    const meta = await fetchProjectStatusFieldOptions(token, projectNodeId);
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
    await pushCandidateMarkdownToGithubDraft(
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
    const meta = await fetchProjectStatusFieldOptions(token, projectNodeId);
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
      await pushCandidateMarkdownToGithubDraft(
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
