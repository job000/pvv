"use node";

import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { WorkspaceAiProviderId } from "../lib/ros-ai-models";
import { workspaceAiChatJson } from "../lib/workspace-ai-client";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";

const suggestionValidator = v.object({
  title: v.string(),
  description: v.string(),
  consequence: v.optional(v.string()),
  treatment: v.optional(v.string()),
  suggestedRow: v.optional(v.number()),
  suggestedCol: v.optional(v.number()),
  requiresAction: v.optional(v.boolean()),
});

function clampIndex(n: unknown, maxExclusive: number): number | undefined {
  if (typeof n !== "number" || !Number.isFinite(n)) return undefined;
  const i = Math.round(n);
  if (i < 0 || i >= maxExclusive) return undefined;
  return i;
}

function parseSuggestions(
  raw: unknown,
  rowCount: number,
  colCount: number,
): Array<{
  title: string;
  description: string;
  consequence?: string;
  treatment?: string;
  suggestedRow?: number;
  suggestedCol?: number;
  requiresAction?: boolean;
}> {
  if (!raw || typeof raw !== "object") return [];
  const risks = (raw as { risks?: unknown }).risks;
  if (!Array.isArray(risks)) return [];
  const out: Array<{
    title: string;
    description: string;
    consequence?: string;
    treatment?: string;
    suggestedRow?: number;
    suggestedCol?: number;
    requiresAction?: boolean;
  }> = [];
  for (const item of risks.slice(0, 12)) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const title = typeof o.title === "string" ? o.title.trim() : "";
    const description =
      typeof o.description === "string" ? o.description.trim() : "";
    if (!title && !description) continue;
    out.push({
      title: title || description.slice(0, 80),
      description: description || title,
      consequence:
        typeof o.consequence === "string" && o.consequence.trim()
          ? o.consequence.trim()
          : undefined,
      treatment:
        typeof o.treatment === "string" && o.treatment.trim()
          ? o.treatment.trim()
          : undefined,
      suggestedRow: clampIndex(o.suggestedRow, rowCount),
      suggestedCol: clampIndex(o.suggestedCol, colCount),
      requiresAction:
        typeof o.requiresAction === "boolean" ? o.requiresAction : undefined,
    });
  }
  return out;
}

/**
 * Hent kontekst fra vurdering + prosessdesign og foreslå ROS-risikoer via AI.
 */
export const suggestRisksForAnalysis = action({
  args: {
    analysisId: v.id("rosAnalyses"),
    userHint: v.optional(v.string()),
  },
  returns: v.object({
    suggestions: v.array(suggestionValidator),
    hasLinkedSources: v.boolean(),
    model: v.string(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    suggestions: Array<{
      title: string;
      description: string;
      consequence?: string;
      treatment?: string;
      suggestedRow?: number;
      suggestedCol?: number;
      requiresAction?: boolean;
    }>;
    hasLinkedSources: boolean;
    model: string;
  }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Du må være innlogget.");
    }

    const packed: {
      workspaceId: import("./_generated/dataModel").Id<"workspaces">;
      contextText: string;
      rowCount: number;
      colCount: number;
      hasLinkedSources: boolean;
    } | null = await ctx.runQuery(
      internal.rosAiContext.getRosAiContextInternal,
      {
        analysisId: args.analysisId,
        userId,
      },
    );
    if (!packed) {
      throw new Error("Fant ikke ROS-analysen, eller du mangler tilgang.");
    }

    const secret: {
      token: string;
      model: string;
      provider: WorkspaceAiProviderId;
      baseUrl?: string;
      enabled: boolean;
    } | null = await ctx.runQuery(
      internal.workspaceAi.getWorkspaceAiSecretInternal,
      { workspaceId: packed.workspaceId },
    );
    if (!secret?.token) {
      throw new Error(
        "AI er ikke konfigurert. En administrator må legge inn API-nøkkel under Innstillinger.",
      );
    }
    if (!secret.enabled) {
      throw new Error(
        "KI er slått av for arbeidsområdet. En administrator kan slå den på under Innstillinger.",
      );
    }

    if (!packed.hasLinkedSources) {
      throw new Error(
        "Koble minst én vurdering (og gjerne prosessdesign) til ROS-analysen før AI-forslag.",
      );
    }

    const system = `Du er en norsk ROS-/risikoanalytiker for RPA og prosessautomatisering i offentlig sektor / helse.
Du foreslår konkrete risikoer basert på oppgitt kontekst fra vurdering (PVV) og prosessdesign (PDD).
Svar KUN med gyldig JSON (ingen markdown, ingen forklaring utenfor JSON):
{
  "risks": [
    {
      "title": "kort tittel",
      "description": "hva kan gå galt (risiko)",
      "consequence": "mulig konsekvens",
      "treatment": "mulig tiltak (valgfritt)",
      "suggestedRow": 0,
      "suggestedCol": 0,
      "requiresAction": true
    }
  ]
}
Regler:
- suggestedRow/suggestedCol er 0-baserte indekser på aksene i konteksten (sannsynlighet × konsekvens).
- Maks 8 risikoer. Unngå duplikater mot «Eksisterende risikoer».
- Vær konkret og handlingsrettet. Ikke generiske floskler.
- Bruk norsk bokmål.`;

    const userContent = [
      packed.contextText,
      args.userHint?.trim()
        ? `\n## Ekstra instruks fra bruker\n${args.userHint.trim().slice(0, 1500)}`
        : "",
      "\nLag forslag nå.",
    ]
      .filter(Boolean)
      .join("\n");

    const parsed = await workspaceAiChatJson({
      provider: secret.provider,
      token: secret.token,
      model: secret.model,
      baseUrl: secret.baseUrl,
      messages: [
        { role: "system", content: system },
        { role: "user", content: userContent },
      ],
      temperature: 0.3,
    });

    const suggestions = parseSuggestions(
      parsed,
      packed.rowCount,
      packed.colCount,
    );
    if (suggestions.length === 0) {
      throw new Error(
        "AI fant ingen forslag. Prøv igjen eller utvid konteksten.",
      );
    }

    return {
      suggestions,
      hasLinkedSources: packed.hasLinkedSources,
      model: secret.model,
    };
  },
});
