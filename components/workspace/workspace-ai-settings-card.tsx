"use client";

import { Button } from "@/components/ui/button";
import { CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  DEFAULT_WORKSPACE_AI_MODEL,
  WORKSPACE_AI_PROVIDERS,
  defaultModelForProvider,
  isWorkspaceAiModelId,
  isWorkspaceAiProviderId,
  modelsForProvider,
  type WorkspaceAiModelId,
  type WorkspaceAiProviderId,
} from "@/lib/ros-ai-models";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import { Check, ChevronRight, Loader2, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Props = {
  workspaceId: Id<"workspaces">;
};

export function WorkspaceAiSettingsCard({ workspaceId }: Props) {
  const status = useQuery(api.workspaceAi.getWorkspaceAiSettingsStatus, {
    workspaceId,
  });
  const setSettings = useMutation(api.workspaceAi.setWorkspaceAiSettings);
  const setEnabled = useMutation(api.workspaceAi.setWorkspaceAiEnabled);
  const clearSettings = useMutation(api.workspaceAi.clearWorkspaceAiSettings);

  const [tokenInput, setTokenInput] = useState("");
  const [model, setModel] = useState<WorkspaceAiModelId>(
    DEFAULT_WORKSPACE_AI_MODEL,
  );
  const [customModel, setCustomModel] = useState("");
  const [provider, setProvider] = useState<WorkspaceAiProviderId>("openai");
  const [baseUrl, setBaseUrl] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toggleBusy, setToggleBusy] = useState(false);

  useEffect(() => {
    if (!status) return;
    if (isWorkspaceAiProviderId(status.provider)) {
      setProvider(status.provider);
    }
    const list = modelsForProvider(
      isWorkspaceAiProviderId(status.provider) ? status.provider : "openai",
    );
    if (
      status.provider === "openai_compatible" ||
      !isWorkspaceAiModelId(status.model)
    ) {
      setCustomModel(status.model);
      const fallback = list[0]?.id ?? DEFAULT_WORKSPACE_AI_MODEL;
      setModel(fallback);
    } else {
      setModel(status.model);
      setCustomModel("");
    }
    setBaseUrl(status.baseUrl ?? "");
  }, [status]);

  const providerModels = useMemo(
    () => modelsForProvider(provider),
    [provider],
  );
  const providerMeta = WORKSPACE_AI_PROVIDERS.find((p) => p.id === provider);

  const configured = status?.configured ?? false;
  const enabled = status?.enabled ?? false;
  const available = status?.available ?? false;

  function onProviderChange(next: WorkspaceAiProviderId) {
    setProvider(next);
    const nextDefault = defaultModelForProvider(next);
    if (isWorkspaceAiModelId(nextDefault)) {
      setModel(nextDefault);
    }
    if (next === "openai_compatible") {
      setCustomModel((prev) => prev || nextDefault);
    } else {
      setCustomModel("");
    }
    if (next !== "openai_compatible") setBaseUrl("");
  }

  async function save() {
    setMessage(null);
    setBusy(true);
    try {
      const resolvedModel =
        provider === "openai_compatible"
          ? customModel.trim() || model
          : model;
      await setSettings({
        workspaceId,
        token: tokenInput.trim() || undefined,
        model: resolvedModel,
        provider,
        baseUrl:
          provider === "openai_compatible" ? baseUrl.trim() : undefined,
        enabled: configured ? enabled : true,
      });
      setTokenInput("");
      setMessage("KI-innstillinger er lagret.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Kunne ikke lagre.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleEnabled(next: boolean) {
    setMessage(null);
    setToggleBusy(true);
    try {
      await setEnabled({ workspaceId, enabled: next });
      setMessage(next ? "KI er slått på." : "KI er slått av.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Kunne ikke oppdatere.");
    } finally {
      setToggleBusy(false);
    }
  }

  async function clear() {
    setMessage(null);
    setBusy(true);
    try {
      await clearSettings({ workspaceId });
      setTokenInput("");
      setMessage("API-nøkkel fjernet.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Kunne ikke fjerne.");
    } finally {
      setBusy(false);
    }
  }

  const statusLabel = !configured
    ? "Ikke konfigurert"
    : available
      ? `På · ${status?.model ?? ""}`
      : `Av · ${status?.model ?? ""}`;

  return (
    <details
      id="ai-arbeidsomrade"
      className="group scroll-mt-24 overflow-hidden rounded-2xl border border-border/50 bg-card"
    >
      <summary className="flex cursor-pointer list-none items-center gap-4 px-4 py-4 transition-colors hover:bg-muted/30 [&::-webkit-details-marker]:hidden sm:px-5">
        <span
          className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted"
          aria-hidden
        >
          <Sparkles className="size-4 text-foreground" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-medium tracking-tight text-foreground">
            KI for ROS-forslag
          </span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {statusLabel}
          </span>
        </span>
        {available ? (
          <Check
            className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
            aria-hidden
          />
        ) : null}
        <ChevronRight
          className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90"
          aria-hidden
        />
      </summary>

      <CardContent className="space-y-6 border-t border-border/40 pt-6">
        <p className="text-muted-foreground text-sm leading-relaxed">
          Velg leverandør (OpenAI, Claude, Gemini eller kompatibel), modell og
          API-nøkkel. Brukes til ROS-forslag basert på vurdering og
          prosessdesign. Nøkkelen lagres i backend og returneres aldri til
          klienten.
        </p>

        <section className="flex flex-col gap-3 rounded-xl border border-border/50 bg-muted/15 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-medium text-foreground">KI på / av</p>
            <p className="text-muted-foreground text-xs leading-relaxed">
              {configured
                ? "Når KI er av, skjules AI-forslag i ROS. Nøkkel og modell beholdes."
                : "Lagre API-nøkkel først — deretter kan du slå KI av og på."}
            </p>
          </div>
          <div
            className="flex shrink-0 rounded-full border border-border/60 bg-background p-1"
            role="group"
            aria-label="KI på eller av"
          >
            <button
              type="button"
              disabled={!configured || toggleBusy}
              className={cn(
                "h-9 min-w-[3.5rem] rounded-full px-3 text-sm font-medium transition-colors disabled:opacity-50",
                configured && enabled
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground",
              )}
              aria-pressed={configured && enabled}
              onClick={() => void toggleEnabled(true)}
            >
              På
            </button>
            <button
              type="button"
              disabled={!configured || toggleBusy}
              className={cn(
                "h-9 min-w-[3.5rem] rounded-full px-3 text-sm font-medium transition-colors disabled:opacity-50",
                configured && !enabled
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground",
              )}
              aria-pressed={configured && !enabled}
              onClick={() => void toggleEnabled(false)}
            >
              Av
            </button>
          </div>
        </section>

        <section className="space-y-3">
          <Label htmlFor="ai-provider">Leverandør</Label>
          <select
            id="ai-provider"
            className="border-input bg-background h-11 w-full rounded-lg border px-3 text-sm"
            value={provider}
            onChange={(e) => {
              const v = e.target.value;
              if (isWorkspaceAiProviderId(v)) onProviderChange(v);
            }}
          >
            {WORKSPACE_AI_PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label} — {p.hint}
              </option>
            ))}
          </select>
        </section>

        {provider === "openai_compatible" ? (
          <section className="space-y-3">
            <Label htmlFor="ai-base-url">Base-URL</Label>
            <Input
              id="ai-base-url"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://openrouter.ai/api/v1"
              className="h-11 font-mono text-sm"
              autoComplete="off"
            />
            <p className="text-muted-foreground text-xs">
              Endepunktet må støtte{" "}
              <code className="bg-muted rounded px-1 font-mono text-[0.7rem]">
                /chat/completions
              </code>
              .
            </p>
          </section>
        ) : null}

        <section className="space-y-3">
          <Label htmlFor="ai-model">Modell</Label>
          {provider === "openai_compatible" ? (
            <Input
              id="ai-model"
              value={customModel}
              onChange={(e) => setCustomModel(e.target.value)}
              placeholder="f.eks. openai/gpt-4o-mini eller claude-sonnet-4-5"
              className="h-11 font-mono text-sm"
              autoComplete="off"
            />
          ) : (
            <select
              id="ai-model"
              className="border-input bg-background h-11 w-full rounded-lg border px-3 text-sm"
              value={
                providerModels.some((m) => m.id === model)
                  ? model
                  : (providerModels[0]?.id ?? "")
              }
              onChange={(e) => {
                const value = e.target.value;
                if (isWorkspaceAiModelId(value)) setModel(value);
              }}
            >
              {providerModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label} — {m.hint}
                </option>
              ))}
            </select>
          )}
        </section>

        <section className="space-y-3">
          <Label htmlFor="ai-token">API-nøkkel</Label>
          <Input
            id="ai-token"
            type="password"
            autoComplete="off"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder={
              configured
                ? `Lagret: ${status?.tokenHint ?? "••••"} — lim inn for å bytte`
                : (providerMeta?.tokenPlaceholder ?? "API-nøkkel …")
            }
            className="h-11 font-mono text-sm"
          />
          {status?.updatedAt ? (
            <p className="text-muted-foreground text-xs" role="status">
              Sist oppdatert{" "}
              {new Date(status.updatedAt).toLocaleString("nb-NO")}
            </p>
          ) : null}
        </section>

        {message ? (
          <p
            className={cn(
              "text-sm",
              message.includes("lagret") ||
                message.includes("fjernet") ||
                message.includes("slått")
                ? "text-muted-foreground"
                : "text-destructive",
            )}
            role="status"
          >
            {message}
          </p>
        ) : null}
      </CardContent>

      <CardFooter className="bg-muted/15 border-border/50 flex flex-col gap-2 border-t py-4 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          className="h-11"
          disabled={!configured || busy}
          onClick={() => void clear()}
        >
          Fjern nøkkel
        </Button>
        <Button
          type="button"
          className="h-11 gap-2"
          disabled={busy || status === undefined}
          onClick={() => void save()}
        >
          {busy ? (
            <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
          ) : null}
          Lagre KI-innstillinger
        </Button>
      </CardFooter>
    </details>
  );
}
