import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import {
  DEFAULT_WORKSPACE_AI_MODEL,
  isModelAllowedForProvider,
  type WorkspaceAiProviderId,
} from "../lib/ros-ai-models";
import { internalQuery, mutation, query } from "./_generated/server";
import { requireUserId, requireWorkspaceMember } from "./lib/access";

const providerValidator = v.union(
  v.literal("openai"),
  v.literal("anthropic"),
  v.literal("google"),
  v.literal("openai_compatible"),
);

/** Mangler felt = på (eksisterende rader før enabled ble innført). */
function isAiEnabled(row: { enabled?: boolean } | null | undefined): boolean {
  if (!row) return false;
  return row.enabled !== false;
}

export const getWorkspaceAiSecretInternal = internalQuery({
  args: { workspaceId: v.id("workspaces") },
  returns: v.union(
    v.object({
      token: v.string(),
      model: v.string(),
      provider: providerValidator,
      baseUrl: v.optional(v.string()),
      enabled: v.boolean(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("workspaceAiSecrets")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();
    if (!row) return null;
    return {
      token: row.token,
      model: row.model,
      provider: row.provider,
      baseUrl: row.baseUrl,
      enabled: isAiEnabled(row),
    };
  },
});

/** Status uten token — trygt for klient. */
export const getWorkspaceAiSettingsStatus = query({
  args: { workspaceId: v.id("workspaces") },
  returns: v.object({
    configured: v.boolean(),
    enabled: v.boolean(),
    available: v.boolean(),
    model: v.string(),
    provider: providerValidator,
    baseUrl: v.optional(v.string()),
    tokenHint: v.union(v.string(), v.null()),
    updatedAt: v.union(v.number(), v.null()),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return {
        configured: false,
        enabled: false,
        available: false,
        model: DEFAULT_WORKSPACE_AI_MODEL,
        provider: "openai" as const,
        tokenHint: null,
        updatedAt: null,
      };
    }
    await requireWorkspaceMember(ctx, args.workspaceId, userId, "viewer");
    const row = await ctx.db
      .query("workspaceAiSecrets")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();
    if (!row) {
      return {
        configured: false,
        enabled: false,
        available: false,
        model: DEFAULT_WORKSPACE_AI_MODEL,
        provider: "openai" as const,
        tokenHint: null,
        updatedAt: null,
      };
    }
    const enabled = isAiEnabled(row);
    const tip =
      row.token.length > 8
        ? `${row.token.slice(0, 3)}…${row.token.slice(-4)}`
        : "••••";
    return {
      configured: true,
      enabled,
      available: enabled,
      model: row.model,
      provider: row.provider,
      baseUrl: row.baseUrl,
      tokenHint: tip,
      updatedAt: row.updatedAt,
    };
  },
});

/** Lagre/oppdater token + modell. Admin only. Token aldri returnert. */
export const setWorkspaceAiSettings = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    token: v.optional(v.string()),
    model: v.string(),
    provider: providerValidator,
    baseUrl: v.optional(v.string()),
    enabled: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireWorkspaceMember(ctx, args.workspaceId, userId, "admin");

    const model = args.model.trim();
    if (!model) {
      throw new Error("Modell må oppgis.");
    }
    if (
      !isModelAllowedForProvider(
        args.provider as WorkspaceAiProviderId,
        model,
      )
    ) {
      throw new Error(
        "Ukjent modell for valgt leverandør. Velg en modell fra listen, eller bruk OpenAI-kompatibel med fritekst.",
      );
    }

    const existing = await ctx.db
      .query("workspaceAiSecrets")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();

    const incomingToken = args.token?.trim() ?? "";
    let token = incomingToken;
    if (!token) {
      if (!existing?.token) {
        throw new Error("API-nøkkel mangler. Lim inn en gyldig nøkkel.");
      }
      token = existing.token;
    }
    if (token.length < 8) {
      throw new Error("API-nøkkelen ser ugyldig ut.");
    }

    let baseUrl = args.baseUrl?.trim() || undefined;
    if (args.provider === "openai_compatible") {
      if (!baseUrl) {
        throw new Error(
          "Base-URL kreves for kompatibel leverandør (f.eks. https://openrouter.ai/api/v1).",
        );
      }
      try {
        const u = new URL(baseUrl);
        if (u.protocol !== "https:" && u.protocol !== "http:") {
          throw new Error("ugyldig");
        }
      } catch {
        throw new Error("Ugyldig base-URL.");
      }
    } else {
      baseUrl = undefined;
    }

    const enabled =
      args.enabled ?? (existing ? isAiEnabled(existing) : true);

    const now = Date.now();
    const patch = {
      token,
      model,
      provider: args.provider,
      baseUrl,
      enabled,
      updatedAt: now,
      updatedByUserId: userId,
    };
    if (existing) {
      await ctx.db.patch(existing._id, patch);
    } else {
      await ctx.db.insert("workspaceAiSecrets", {
        workspaceId: args.workspaceId,
        ...patch,
      });
    }
    return null;
  },
});

export const setWorkspaceAiEnabled = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    enabled: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireWorkspaceMember(ctx, args.workspaceId, userId, "admin");
    const existing = await ctx.db
      .query("workspaceAiSecrets")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();
    if (!existing) {
      throw new Error(
        "Lagre API-nøkkel først før du kan slå KI av eller på.",
      );
    }
    await ctx.db.patch(existing._id, {
      enabled: args.enabled,
      updatedAt: Date.now(),
      updatedByUserId: userId,
    });
    return null;
  },
});

export const clearWorkspaceAiSettings = mutation({
  args: { workspaceId: v.id("workspaces") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireWorkspaceMember(ctx, args.workspaceId, userId, "admin");
    const existing = await ctx.db
      .query("workspaceAiSecrets")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();
    if (existing) {
      await ctx.db.delete(existing._id);
    }
    return null;
  },
});

/** Brukes fra test-action — sjekker admin uten å lekke detaljer. */
export const requireAdminForAiTest = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
  },
  returns: v.object({
    ok: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    try {
      await requireWorkspaceMember(
        ctx,
        args.workspaceId,
        args.userId,
        "admin",
      );
      return { ok: true, message: "" };
    } catch (e) {
      return {
        ok: false,
        message:
          e instanceof Error
            ? e.message
            : "Kun administratorer kan teste KI-tilkobling.",
      };
    }
  },
});
