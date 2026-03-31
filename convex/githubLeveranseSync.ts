import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { ActionCtx } from "./_generated/server";
import { action, internalMutation } from "./_generated/server";
import {
  githubGraphql,
  isGithubGraphqlRateLimitError,
} from "./lib/githubGraphql";
import { resolveGithubToken } from "./githubTasks";

const GITHUB_ITERATION_CACHE_TTL_MS = 10 * 60 * 1000;

const PROJECT_V2_ITERATION_FIELDS_QUERY = `query($id: ID!) {
  node(id: $id) {
    ... on ProjectV2 {
      id
      fields(first: 50) {
        nodes {
          __typename
          ... on ProjectV2IterationField {
            id
            name
            configuration {
              duration
              iterations(first: 100) {
                nodes {
                  id
                  title
                  duration
                  startDate
                }
              }
              completedIterations(first: 100) {
                nodes {
                  id
                  title
                  duration
                  startDate
                }
              }
            }
          }
        }
      }
    }
  }
}`;

type IterationNode = {
  id?: string;
  title?: string;
  duration?: number | null;
  startDate?: string | null;
};

function parseGithubIterationNodes(
  nodes: IterationNode[],
): Array<{
  githubIterationId: string;
  name: string;
  startAt: number;
  endAt: number;
}> {
  const out: Array<{
    githubIterationId: string;
    name: string;
    startAt: number;
    endAt: number;
  }> = [];
  const seen = new Set<string>();
  for (const n of nodes) {
    const id = n.id?.trim();
    const title = n.title?.trim();
    if (!id || !title || seen.has(id)) {
      continue;
    }
    seen.add(id);
    const durationDays =
      typeof n.duration === "number" && n.duration > 0 ? n.duration : 14;
    const startRaw = n.startDate?.trim();
    let startAt: number;
    if (startRaw && /^\d{4}-\d{2}-\d{2}/.test(startRaw)) {
      startAt = new Date(`${startRaw.slice(0, 10)}T00:00:00.000Z`).getTime();
    } else {
      startAt = Date.now();
    }
    const endAt = startAt + durationDays * 86400000 - 1;
    out.push({
      githubIterationId: id,
      name: title.slice(0, 240),
      startAt,
      endAt,
    });
  }
  return out;
}

function preferredIterationFieldKeyFromWorkspace(
  workspace: Doc<"workspaces">,
): string {
  return workspace.githubProjectIterationFieldId?.trim() || "__auto__";
}

function pickIterationField(
  fields: { id: string; name: string; configuration: unknown }[],
  preferredFieldId: string | null,
): { id: string; name: string; configuration: unknown } | null {
  if (fields.length === 0) {
    return null;
  }
  const trimmed = preferredFieldId?.trim();
  if (trimmed) {
    const found = fields.find((f) => f.id === trimmed);
    if (found) {
      return found;
    }
    throw new Error(
      "Valgt iterasjonsfelt finnes ikke i GitHub-prosjektet. Velg felt under Innstillinger → GitHub.",
    );
  }
  const byName = fields.find(
    (f) => f.name.trim().toLowerCase() === "iteration",
  );
  return byName ?? fields[0] ?? null;
}

function countIterationNodesInConfiguration(configuration: unknown): number {
  if (!configuration || typeof configuration !== "object") {
    return 0;
  }
  const c = configuration as {
    iterations?: { nodes?: unknown[] };
    completedIterations?: { nodes?: unknown[] };
  };
  return (
    (c.iterations?.nodes?.length ?? 0) +
    (c.completedIterations?.nodes?.length ?? 0)
  );
}

function parseIterationFieldsFromGithubResponse(
  json: unknown,
  preferredFieldId: string | null,
): {
  fieldId: string;
  fieldName: string;
  iterations: Array<{
    githubIterationId: string;
    name: string;
    startAt: number;
    endAt: number;
  }>;
} | null {
  const rawNodes = (
    json as {
      data?: {
        node?: { fields?: { nodes?: unknown[] } };
      };
    }
  )?.data?.node?.fields?.nodes;
  if (!Array.isArray(rawNodes)) {
    return null;
  }
  const fields: { id: string; name: string; configuration: unknown }[] = [];
  for (const n of rawNodes) {
    if (
      n &&
      typeof n === "object" &&
      (n as { __typename?: string }).__typename === "ProjectV2IterationField" &&
      "id" in n &&
      "name" in n
    ) {
      const f = n as { id: string; name: string; configuration: unknown };
      fields.push(f);
    }
  }
  const field = pickIterationField(fields, preferredFieldId);
  if (!field || !field.configuration) {
    return null;
  }
  const cfg = field.configuration as {
    iterations?: { nodes?: IterationNode[] };
    completedIterations?: { nodes?: IterationNode[] };
  };
  const active = cfg.iterations?.nodes ?? [];
  const completed = cfg.completedIterations?.nodes ?? [];
  const merged = [...active, ...completed];
  const iterations = parseGithubIterationNodes(merged);
  if (iterations.length === 0) {
    return null;
  }
  return {
    fieldId: field.id,
    fieldName: field.name,
    iterations,
  };
}

export const saveGithubProjectIterationFieldCache = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    projectNodeId: v.string(),
    preferredFieldKey: v.string(),
    fieldId: v.string(),
    fieldName: v.string(),
    iterations: v.array(
      v.object({
        githubIterationId: v.string(),
        name: v.string(),
        startAt: v.number(),
        endAt: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.workspaceId, {
      githubProjectIterationFieldCacheAt: Date.now(),
      githubProjectIterationFieldCache: {
        forProjectNodeId: args.projectNodeId,
        preferredFieldKey: args.preferredFieldKey,
        fieldId: args.fieldId,
        fieldName: args.fieldName,
        iterations: args.iterations,
      },
    });
  },
});

/**
 * Lister iterasjonsfelt i GitHub-prosjekt (for innstillinger).
 */
export const listGithubProjectIterationFields = action({
  args: { workspaceId: v.id("workspaces") },
  handler: async (
    ctx,
    args,
  ): Promise<
    { fields: { id: string; name: string; iterationCount: number }[] }
  > => {
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
    const json = await githubGraphql(token, PROJECT_V2_ITERATION_FIELDS_QUERY, {
      id: projectNodeId,
    });
    const rawNodes = (
      json.data as { node?: { fields?: { nodes?: unknown[] } } }
    )?.node?.fields?.nodes;
    if (!Array.isArray(rawNodes)) {
      return { fields: [] };
    }
    const out: { id: string; name: string; iterationCount: number }[] = [];
    for (const n of rawNodes) {
      if (
        n &&
        typeof n === "object" &&
        (n as { __typename?: string }).__typename ===
          "ProjectV2IterationField" &&
        "id" in n &&
        "name" in n
      ) {
        const f = n as { id: string; name: string; configuration?: unknown };
        out.push({
          id: f.id,
          name: f.name,
          iterationCount: countIterationNodesInConfiguration(f.configuration),
        });
      }
    }
    return { fields: out };
  },
});

async function fetchIterationMetaFromGithubOrCache(
  ctx: ActionCtx,
  args: {
    workspaceId: Id<"workspaces">;
    workspace: Doc<"workspaces">;
    projectNodeId: string;
    token: string;
    forceRefresh: boolean;
  },
): Promise<{
  fieldId: string;
  fieldName: string;
  iterations: Array<{
    githubIterationId: string;
    name: string;
    startAt: number;
    endAt: number;
  }>;
}> {
  const { workspaceId, workspace, projectNodeId, token, forceRefresh } = args;
  const prefKey = preferredIterationFieldKeyFromWorkspace(workspace);
  const cache = workspace.githubProjectIterationFieldCache;
  const cachedAt = workspace.githubProjectIterationFieldCacheAt;
  const now = Date.now();

  if (
    !forceRefresh &&
    cache &&
    cachedAt != null &&
    cache.forProjectNodeId === projectNodeId &&
    (cache.preferredFieldKey ?? "__auto__") === prefKey &&
    now - cachedAt < GITHUB_ITERATION_CACHE_TTL_MS &&
    cache.iterations.length > 0
  ) {
    return {
      fieldId: cache.fieldId,
      fieldName: cache.fieldName,
      iterations: cache.iterations,
    };
  }

  try {
    const json = await githubGraphql(token, PROJECT_V2_ITERATION_FIELDS_QUERY, {
      id: projectNodeId,
    });
    const parsed = parseIterationFieldsFromGithubResponse(
      json,
      workspace.githubProjectIterationFieldId?.trim() || null,
    );
    if (!parsed || parsed.iterations.length === 0) {
      throw new Error(
        "Fant ingen iterasjoner i GitHub-prosjektet. Legg til et iterasjonsfelt og minst én iterasjon på GitHub, eller vent til teamet har opprettet sykler.",
      );
    }
    await ctx.runMutation(
      internal.githubLeveranseSync.saveGithubProjectIterationFieldCache,
      {
        workspaceId,
        projectNodeId,
        preferredFieldKey: prefKey,
        fieldId: parsed.fieldId,
        fieldName: parsed.fieldName,
        iterations: parsed.iterations,
      },
    );
    return parsed;
  } catch (e) {
    if (
      isGithubGraphqlRateLimitError(e) &&
      cache &&
      cache.forProjectNodeId === projectNodeId &&
      (cache.preferredFieldKey ?? "__auto__") === prefKey &&
      cache.iterations.length > 0
    ) {
      return {
        fieldId: cache.fieldId,
        fieldName: cache.fieldName,
        iterations: cache.iterations,
      };
    }
    throw e;
  }
}

/**
 * Oppretter eller oppdaterer PVV-sprinter fra GitHub Projects iterasjonsfelt
 * (samme navn og datoer som på GitHub, koblet med githubIterationId).
 */
export const syncSprintsFromGithubProject = action({
  args: {
    workspaceId: v.id("workspaces"),
    forceRefresh: v.optional(v.boolean()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    ok: true;
    fieldName: string;
    created: number;
    updated: number;
    total: number;
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
        "Lagre GitHub-prosjekt (node-ID) under Innstillinger først.",
      );
    }
    const token = await resolveGithubToken(ctx, args.workspaceId);
    const meta = await fetchIterationMetaFromGithubOrCache(ctx, {
      workspaceId: args.workspaceId,
      workspace,
      projectNodeId,
      token,
      forceRefresh: args.forceRefresh === true,
    });
    const result: { created: number; updated: number } = await ctx.runMutation(
      internal.sprints.applyGithubIterationsSync,
      {
        workspaceId: args.workspaceId,
        createdByUserId: userId,
        items: meta.iterations,
      },
    );
    return {
      ok: true as const,
      fieldName: meta.fieldName,
      created: result.created,
      updated: result.updated,
      total: meta.iterations.length,
    };
  },
});
