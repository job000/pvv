/** Leverandører og modeller for workspace-KI (ROS-forslag m.m.). */

export const WORKSPACE_AI_PROVIDERS = [
  {
    id: "openai",
    label: "OpenAI",
    hint: "api.openai.com",
    tokenPlaceholder: "sk-…",
  },
  {
    id: "anthropic",
    label: "Anthropic (Claude)",
    hint: "api.anthropic.com",
    tokenPlaceholder: "sk-ant-…",
  },
  {
    id: "google",
    label: "Google (Gemini)",
    hint: "generativelanguage.googleapis.com",
    tokenPlaceholder: "AIza…",
  },
  {
    id: "openai_compatible",
    label: "OpenAI-kompatibel",
    hint: "Azure, OpenRouter, Ollama, …",
    tokenPlaceholder: "API-nøkkel …",
  },
] as const;

export type WorkspaceAiProviderId =
  (typeof WORKSPACE_AI_PROVIDERS)[number]["id"];

export const WORKSPACE_AI_MODELS = [
  // OpenAI
  {
    id: "gpt-4o-mini",
    provider: "openai",
    label: "GPT-4o mini",
    hint: "Rask og rimelig — anbefalt",
  },
  {
    id: "gpt-4o",
    provider: "openai",
    label: "GPT-4o",
    hint: "Bedre resonnering",
  },
  {
    id: "gpt-4.1-mini",
    provider: "openai",
    label: "GPT-4.1 mini",
    hint: "Nyere mini-modell",
  },
  {
    id: "gpt-4.1",
    provider: "openai",
    label: "GPT-4.1",
    hint: "Sterkere kontekst",
  },
  {
    id: "o4-mini",
    provider: "openai",
    label: "o4-mini",
    hint: "Resonnering, rask",
  },
  // Anthropic
  {
    id: "claude-haiku-4-5",
    provider: "anthropic",
    label: "Claude Haiku 4.5",
    hint: "Rask og rimelig — anbefalt",
  },
  {
    id: "claude-sonnet-4-5",
    provider: "anthropic",
    label: "Claude Sonnet 4.5",
    hint: "Balansert kvalitet",
  },
  {
    id: "claude-opus-4-5",
    provider: "anthropic",
    label: "Claude Opus 4.5",
    hint: "Høyest kvalitet",
  },
  // Google
  {
    id: "gemini-2.5-flash",
    provider: "google",
    label: "Gemini 2.5 Flash",
    hint: "Rask og rimelig — anbefalt",
  },
  {
    id: "gemini-2.5-pro",
    provider: "google",
    label: "Gemini 2.5 Pro",
    hint: "Sterkere resonnering",
  },
  {
    id: "gemini-2.0-flash",
    provider: "google",
    label: "Gemini 2.0 Flash",
    hint: "Tidligere Flash",
  },
] as const;

export type WorkspaceAiModelId = (typeof WORKSPACE_AI_MODELS)[number]["id"];

export const DEFAULT_WORKSPACE_AI_PROVIDER: WorkspaceAiProviderId = "openai";
export const DEFAULT_WORKSPACE_AI_MODEL: WorkspaceAiModelId = "gpt-4o-mini";

/** @deprecated Bruk DEFAULT_WORKSPACE_AI_MODEL */
export const DEFAULT_ROS_AI_MODEL = DEFAULT_WORKSPACE_AI_MODEL;

/** @deprecated Bruk WORKSPACE_AI_MODELS filtrert på provider */
export const ROS_AI_MODEL_OPTIONS = WORKSPACE_AI_MODELS.filter(
  (m) => m.provider === "openai",
);

export type RosAiModelId = Extract<
  WorkspaceAiModelId,
  "gpt-4o-mini" | "gpt-4o" | "gpt-4.1-mini" | "gpt-4.1" | "o4-mini"
>;

export function isWorkspaceAiProviderId(
  value: string,
): value is WorkspaceAiProviderId {
  return WORKSPACE_AI_PROVIDERS.some((p) => p.id === value);
}

export function isWorkspaceAiModelId(
  value: string,
): value is WorkspaceAiModelId {
  return WORKSPACE_AI_MODELS.some((m) => m.id === value);
}

/** @deprecated */
export function isRosAiModelId(value: string): value is RosAiModelId {
  return WORKSPACE_AI_MODELS.some(
    (m) => m.provider === "openai" && m.id === value,
  );
}

export function modelsForProvider(provider: WorkspaceAiProviderId) {
  return WORKSPACE_AI_MODELS.filter((m) => m.provider === provider);
}

export function defaultModelForProvider(
  provider: WorkspaceAiProviderId,
): string {
  const first = modelsForProvider(provider)[0];
  if (first) return first.id;
  return DEFAULT_WORKSPACE_AI_MODEL;
}

export function isModelAllowedForProvider(
  provider: WorkspaceAiProviderId,
  model: string,
): boolean {
  if (provider === "openai_compatible") {
    return model.trim().length > 0;
  }
  return WORKSPACE_AI_MODELS.some(
    (m) => m.provider === provider && m.id === model,
  );
}

export const WORKSPACE_AI_PROVIDER_VALIDATOR_VALUES = [
  "openai",
  "anthropic",
  "google",
  "openai_compatible",
] as const;
