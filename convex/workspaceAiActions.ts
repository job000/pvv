"use node";

import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import {
  isModelAllowedForProvider,
  type WorkspaceAiProviderId,
} from "../lib/ros-ai-models";
import { testWorkspaceAiConnection } from "../lib/workspace-ai-client";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";

const providerValidator = v.union(
  v.literal("openai"),
  v.literal("anthropic"),
  v.literal("google"),
  v.literal("openai_compatible"),
);

/**
 * Test API-nøkkel + modell mot valgt leverandør.
 * Kan bruke lagret nøkkel, eller midlertidig nøkkel fra skjema (før lagring).
 */
export const testWorkspaceAiConnectionAction = action({
  args: {
    workspaceId: v.id("workspaces"),
    provider: providerValidator,
    model: v.string(),
    baseUrl: v.optional(v.string()),
    /** Hvis tom: bruk lagret nøkkel. */
    token: v.optional(v.string()),
  },
  returns: v.object({
    ok: v.boolean(),
    message: v.string(),
    latencyMs: v.optional(v.number()),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ ok: boolean; message: string; latencyMs?: number }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return { ok: false, message: "Du må være innlogget." };
    }

    const membership: { ok: boolean; message: string } = await ctx.runQuery(
      internal.workspaceAi.requireAdminForAiTest,
      { workspaceId: args.workspaceId, userId },
    );
    if (!membership.ok) {
      return { ok: false, message: membership.message };
    }

    const model = args.model.trim();
    if (!model) {
      return { ok: false, message: "Velg eller skriv inn en modell." };
    }
    if (
      !isModelAllowedForProvider(
        args.provider as WorkspaceAiProviderId,
        model,
      )
    ) {
      return {
        ok: false,
        message: "Ugyldig modell-ID for valgt leverandør.",
      };
    }

    let baseUrl = args.baseUrl?.trim() || undefined;
    if (args.provider === "openai_compatible") {
      if (!baseUrl) {
        return {
          ok: false,
          message: "Base-URL kreves for OpenAI-kompatibel leverandør.",
        };
      }
      try {
        const u = new URL(baseUrl);
        if (u.protocol !== "https:" && u.protocol !== "http:") {
          throw new Error("ugyldig");
        }
      } catch {
        return { ok: false, message: "Ugyldig base-URL." };
      }
    } else {
      baseUrl = undefined;
    }

    let token = args.token?.trim() ?? "";
    if (!token) {
      const secret = await ctx.runQuery(
        internal.workspaceAi.getWorkspaceAiSecretInternal,
        { workspaceId: args.workspaceId },
      );
      if (!secret?.token) {
        return {
          ok: false,
          message: "Lim inn en API-nøkkel, eller lagre nøkkel først.",
        };
      }
      token = secret.token;
    }
    if (token.length < 8) {
      return { ok: false, message: "API-nøkkelen ser ugyldig ut." };
    }

    try {
      const result = await testWorkspaceAiConnection({
        provider: args.provider as WorkspaceAiProviderId,
        token,
        model,
        baseUrl,
      });
      return {
        ok: true,
        message: `${result.detail} (${result.latencyMs} ms)`,
        latencyMs: result.latencyMs,
      };
    } catch (e) {
      return {
        ok: false,
        message:
          e instanceof Error ? e.message : "Tilkoblingstest feilet.",
      };
    }
  },
});
