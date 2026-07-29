"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "@/lib/app-toast";
import {
  ROS_CELL_FLAG_REQUIRES_ACTION,
  newRosCellItemId,
} from "@/lib/ros-cell-items";
import { cn } from "@/lib/utils";
import { useAction, useQuery } from "convex/react";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Loader2,
  RefreshCw,
  Settings2,
  Shield,
  Sparkles,
} from "lucide-react";
import { useMemo, useState } from "react";

type Suggestion = {
  title: string;
  description: string;
  consequence?: string;
  treatment?: string;
  suggestedRow?: number;
  suggestedCol?: number;
  requiresAction?: boolean;
};

type AddableRisk = {
  id: string;
  text: string;
  flags?: string[];
  beforeRow: number;
  beforeCol: number;
  afterRow: number;
  afterCol: number;
  afterChangeNote?: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: Id<"workspaces">;
  analysisId: Id<"rosAnalyses">;
  rowCount: number;
  colCount: number;
  onAddRisk: (risk: AddableRisk) => void;
  onAccepted?: (info: {
    firstRiskId: string;
    beforeRow: number;
    beforeCol: number;
    count: number;
  }) => void;
};

const HINT_CHIPS = [
  "Personvern og sensitiv data",
  "Feil i roboten / fallback",
  "Tilgang og sikkerhet",
  "Drift og bemanning",
] as const;

function formatRiskDescription(s: Suggestion): string {
  const title = s.title.trim();
  const description = s.description.trim();
  const consequence = s.consequence?.trim() ?? "";

  const body =
    title && description && title !== description
      ? `${title}\n\n${description}`
      : description || title;

  if (consequence) {
    return `${body}\n\nKonsekvens: ${consequence}`.trim();
  }
  return body.trim();
}

export function RosAiSuggestDialog({
  open,
  onOpenChange,
  workspaceId,
  analysisId,
  rowCount,
  colCount,
  onAddRisk,
  onAccepted,
}: Props) {
  const aiStatus = useQuery(api.workspaceAi.getWorkspaceAiSettingsStatus, {
    workspaceId,
  });
  const suggest = useAction(api.rosAi.suggestRisksForAnalysis);

  const [hint, setHint] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [usedModel, setUsedModel] = useState<string | null>(null);

  const hasSuggestions = suggestions.length > 0;
  const selectedCount = selected.size;
  const aiReady = aiStatus?.available === true;

  const allSelected = useMemo(
    () => hasSuggestions && selectedCount === suggestions.length,
    [hasSuggestions, selectedCount, suggestions.length],
  );

  async function runSuggest() {
    setLoading(true);
    setError(null);
    setSuggestions([]);
    setSelected(new Set());
    setUsedModel(null);
    try {
      const r = await suggest({
        analysisId,
        userHint: hint.trim() || undefined,
      });
      setSuggestions(r.suggestions);
      setSelected(new Set(r.suggestions.map((_s, i: number) => i)));
      setUsedModel(r.model);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunne ikke hente forslag.");
    } finally {
      setLoading(false);
    }
  }

  function toggle(i: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  function acceptSelected() {
    const picks = suggestions.filter((_, i) => selected.has(i));
    if (picks.length === 0) {
      toast.error("Velg minst ett forslag.");
      return;
    }
    let firstId: string | null = null;
    let firstRow = 0;
    let firstCol = 0;
    for (const s of picks) {
      const row = Math.min(
        Math.max(s.suggestedRow ?? 0, 0),
        Math.max(rowCount - 1, 0),
      );
      const col = Math.min(
        Math.max(s.suggestedCol ?? 0, 0),
        Math.max(colCount - 1, 0),
      );
      const treatment = s.treatment?.trim() || undefined;
      const id = newRosCellItemId();
      if (!firstId) {
        firstId = id;
        firstRow = row;
        firstCol = col;
      }
      onAddRisk({
        id,
        text: formatRiskDescription(s),
        flags:
          treatment || s.requiresAction
            ? [ROS_CELL_FLAG_REQUIRES_ACTION]
            : undefined,
        beforeRow: row,
        beforeCol: col,
        afterRow: row,
        afterCol: col,
        afterChangeNote: treatment,
      });
    }
    if (firstId) {
      onAccepted?.({
        firstRiskId: firstId,
        beforeRow: firstRow,
        beforeCol: firstCol,
        count: picks.length,
      });
    }
    toast.success(
      picks.length === 1
        ? "Forslag lagt inn i matrise og beskrivelse."
        : `${picks.length} forslag lagt inn i matrise og beskrivelse.`,
    );
    onOpenChange(false);
  }

  function resetAndClose(next: boolean) {
    onOpenChange(next);
    if (!next) {
      setError(null);
      setSuggestions([]);
      setSelected(new Set());
      setUsedModel(null);
      setHint("");
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={resetAndClose}>
      <DialogContent size="2xl" titleId="ros-ai-suggest-title">
        <DialogHeader className="space-y-3 bg-transparent sm:space-y-4">
          <div className="flex items-start gap-3">
            <span className="bg-foreground text-background flex size-11 shrink-0 items-center justify-center rounded-2xl shadow-sm">
              <Sparkles className="size-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <h2
                id="ros-ai-suggest-title"
                className="font-heading text-lg font-semibold tracking-tight sm:text-xl"
              >
                Foreslå risikoer med KI
              </h2>
              <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                Basert på vurdering og prosessdesign. Du velger hva som skal
                inn i matrisen.
              </p>
            </div>
          </div>

          <ol className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-medium sm:text-xs">
            <li
              className={cn(
                "inline-flex items-center gap-1.5",
                !hasSuggestions && !loading && "text-foreground",
              )}
            >
              <span
                className={cn(
                  "flex size-5 items-center justify-center rounded-full text-[10px] font-semibold",
                  !hasSuggestions && !loading
                    ? "bg-foreground text-background"
                    : "bg-muted text-muted-foreground",
                )}
              >
                1
              </span>
              Veiled
            </li>
            <ArrowRight className="size-3 opacity-40" aria-hidden />
            <li
              className={cn(
                "inline-flex items-center gap-1.5",
                loading && "text-foreground",
                hasSuggestions && "text-foreground",
              )}
            >
              <span
                className={cn(
                  "flex size-5 items-center justify-center rounded-full text-[10px] font-semibold",
                  loading || hasSuggestions
                    ? "bg-foreground text-background"
                    : "bg-muted text-muted-foreground",
                )}
              >
                2
              </span>
              Hent forslag
            </li>
            <ArrowRight className="size-3 opacity-40" aria-hidden />
            <li
              className={cn(
                "inline-flex items-center gap-1.5",
                hasSuggestions && "text-foreground",
              )}
            >
              <span
                className={cn(
                  "flex size-5 items-center justify-center rounded-full text-[10px] font-semibold",
                  hasSuggestions
                    ? "bg-foreground text-background"
                    : "bg-muted text-muted-foreground",
                )}
              >
                3
              </span>
              Legg inn
            </li>
          </ol>
        </DialogHeader>

        <DialogBody className="space-y-5">
          {!aiReady && aiStatus !== undefined ? (
            <div className="flex gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/[0.07] px-4 py-3.5">
              <Settings2
                className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-300"
                aria-hidden
              />
              <div className="min-w-0 space-y-1 text-sm leading-relaxed">
                <p className="font-medium text-foreground">
                  {!aiStatus.configured
                    ? "KI er ikke satt opp ennå"
                    : "KI er slått av"}
                </p>
                <p className="text-muted-foreground text-xs sm:text-sm">
                  En administrator kan{" "}
                  {!aiStatus.configured
                    ? "legge inn API-nøkkel og modell"
                    : "slå KI på"}{" "}
                  under{" "}
                  <a
                    href={`/w/${workspaceId}/innstillinger`}
                    className="text-foreground font-medium underline-offset-4 hover:underline"
                  >
                    Innstillinger
                  </a>
                  .
                </p>
              </div>
            </div>
          ) : null}

          <section className="space-y-3">
            <div className="flex items-end justify-between gap-2">
              <label
                htmlFor="ros-ai-hint"
                className="text-sm font-semibold tracking-tight"
              >
                Hva skal KI fokusere på?
                <span className="text-muted-foreground ml-1.5 font-normal">
                  Valgfritt
                </span>
              </label>
            </div>
            <Textarea
              id="ros-ai-hint"
              value={hint}
              onChange={(e) => setHint(e.target.value)}
              placeholder="F.eks. personvern, feil i roboten, eller bemanning ved stans …"
              className="min-h-[5rem] resize-none rounded-2xl border-border/70 bg-muted/20 px-4 py-3 text-sm leading-relaxed shadow-none focus-visible:bg-background"
              disabled={loading}
            />
            <div className="flex flex-wrap gap-1.5">
              {HINT_CHIPS.map((chip) => {
                const active = hint.includes(chip);
                return (
                  <button
                    key={chip}
                    type="button"
                    disabled={loading}
                    onClick={() =>
                      setHint((prev) => {
                        const t = prev.trim();
                        if (t.includes(chip)) return t;
                        return t ? `${t}. ${chip}` : chip;
                      })
                    }
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors",
                      active
                        ? "border-foreground/20 bg-foreground/5 text-foreground"
                        : "border-border/60 bg-background text-muted-foreground hover:border-border hover:text-foreground",
                    )}
                  >
                    {chip}
                  </button>
                );
              })}
            </div>
          </section>

          {!hasSuggestions && !loading ? (
            <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border/70 bg-muted/10 px-5 py-10 text-center">
              <div className="bg-muted/60 flex size-14 items-center justify-center rounded-2xl">
                <Shield
                  className="text-muted-foreground size-7"
                  strokeWidth={1.5}
                  aria-hidden
                />
              </div>
              <div className="max-w-sm space-y-1.5">
                <p className="text-sm font-semibold tracking-tight">
                  Klar til å foreslå risikoer
                </p>
                <p className="text-muted-foreground text-xs leading-relaxed sm:text-sm">
                  KI leser koblet vurdering og prosessdesign, og foreslår
                  konkrete risikoer, konsekvenser og tiltak.
                </p>
              </div>
              <Button
                type="button"
                className="h-11 gap-2 rounded-full px-6 text-sm font-semibold shadow-sm"
                disabled={!aiReady}
                onClick={() => void runSuggest()}
              >
                <Sparkles className="size-4" aria-hidden />
                Hent forslag
              </Button>
            </div>
          ) : null}

          {loading ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl bg-muted/20 px-5 py-12 text-center">
              <Loader2
                className="text-foreground size-8 animate-spin"
                aria-hidden
              />
              <div className="space-y-1">
                <p className="text-sm font-semibold">Analyserer konteksten …</p>
                <p className="text-muted-foreground text-xs">
                  Dette tar vanligvis noen sekunder.
                </p>
              </div>
            </div>
          ) : null}

          {error ? (
            <div
              className="flex gap-3 rounded-2xl border border-destructive/25 bg-destructive/5 px-4 py-3.5"
              role="alert"
            >
              <AlertTriangle
                className="text-destructive mt-0.5 size-4 shrink-0"
                aria-hidden
              />
              <div className="min-w-0 space-y-2">
                <p className="text-destructive text-sm leading-relaxed">
                  {error}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 rounded-full text-xs"
                  disabled={!aiReady}
                  onClick={() => void runSuggest()}
                >
                  <RefreshCw className="size-3" aria-hidden />
                  Prøv igjen
                </Button>
              </div>
            </div>
          ) : null}

          {hasSuggestions && !loading ? (
            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold tracking-tight">
                    {selectedCount} av {suggestions.length} valgt
                  </p>
                  {usedModel ? (
                    <p className="text-muted-foreground text-[11px]">
                      Modell: {usedModel}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 rounded-full text-xs"
                    onClick={() => {
                      if (allSelected) setSelected(new Set());
                      else
                        setSelected(
                          new Set(suggestions.map((_s, i: number) => i)),
                        );
                    }}
                  >
                    {allSelected ? "Fjern alle" : "Velg alle"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 rounded-full text-xs"
                    disabled={!aiReady}
                    onClick={() => void runSuggest()}
                  >
                    <RefreshCw className="size-3" aria-hidden />
                    Hent på nytt
                  </Button>
                </div>
              </div>

              <ul className="max-h-[min(48vh,26rem)] space-y-2.5 overflow-y-auto overscroll-contain pr-0.5 [-webkit-overflow-scrolling:touch]">
                {suggestions.map((s, i) => {
                  const checked = selected.has(i);
                  return (
                    <li key={`${s.title}-${i}`}>
                      <button
                        type="button"
                        onClick={() => toggle(i)}
                        aria-pressed={checked}
                        className={cn(
                          "group w-full rounded-2xl border px-3.5 py-3.5 text-left transition-all sm:px-4",
                          checked
                            ? "border-foreground/25 bg-foreground/[0.03] shadow-sm ring-1 ring-foreground/10"
                            : "border-border/50 bg-card hover:border-border hover:bg-muted/30",
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <span
                            className={cn(
                              "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors",
                              checked
                                ? "border-foreground bg-foreground text-background"
                                : "border-border/80 bg-background text-transparent group-hover:border-foreground/30",
                            )}
                            aria-hidden
                          >
                            <Check className="size-3" strokeWidth={3} />
                          </span>
                          <div className="min-w-0 flex-1 space-y-2">
                            <p className="text-sm font-semibold leading-snug tracking-tight">
                              {s.title}
                            </p>
                            <p className="text-muted-foreground text-xs leading-relaxed sm:text-[13px]">
                              {s.description}
                            </p>
                            {(s.consequence || s.treatment) && (
                              <div className="flex flex-col gap-1.5 pt-0.5">
                                {s.consequence ? (
                                  <p className="text-[11px] leading-relaxed sm:text-xs">
                                    <span className="text-muted-foreground font-medium">
                                      Konsekvens
                                    </span>
                                    <span className="text-foreground ml-1.5">
                                      {s.consequence}
                                    </span>
                                  </p>
                                ) : null}
                                {s.treatment ? (
                                  <p className="text-[11px] leading-relaxed sm:text-xs">
                                    <span className="text-muted-foreground font-medium">
                                      Tiltak
                                    </span>
                                    <span className="text-foreground ml-1.5">
                                      {s.treatment}
                                    </span>
                                  </p>
                                ) : null}
                              </div>
                            )}
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}
        </DialogBody>

        <DialogFooter className="gap-2 sm:justify-between">
          <p className="text-muted-foreground hidden text-xs sm:block sm:max-w-[14rem] sm:leading-relaxed">
            {hasSuggestions
              ? "Valgte forslag fyller matrise og beskrivelse. Du kan redigere etterpå."
              : "Du kan alltid skrive risikoer selv med fritekst."}
          </p>
          <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row">
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-full"
              onClick={() => resetAndClose(false)}
            >
              Avbryt
            </Button>
            {hasSuggestions ? (
              <Button
                type="button"
                className="h-11 gap-2 rounded-full px-5 font-semibold shadow-sm"
                disabled={selectedCount === 0 || loading}
                onClick={acceptSelected}
              >
                Legg inn {selectedCount > 0 ? selectedCount : ""} i matrise
                <ArrowRight className="size-4" aria-hidden />
              </Button>
            ) : (
              <Button
                type="button"
                className="h-11 gap-2 rounded-full px-5 font-semibold shadow-sm"
                disabled={loading || !aiReady}
                onClick={() => void runSuggest()}
              >
                {loading ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Sparkles className="size-4" aria-hidden />
                )}
                Hent forslag
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
