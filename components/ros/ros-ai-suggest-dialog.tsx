"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
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
import { Loader2, Sparkles } from "lucide-react";
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
  /** Kalles etter at valgte forslag er lagt inn (matrise + beskrivelse). */
  onAccepted?: (info: {
    firstRiskId: string;
    beforeRow: number;
    beforeCol: number;
    count: number;
  }) => void;
};

/** Tekst til «Hva kan gå galt?» — tittel, beskrivelse og konsekvens. */
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

  const allSelected = useMemo(
    () =>
      suggestions.length > 0 && selected.size === suggestions.length,
    [selected.size, suggestions.length],
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
      // Én oppføring: beskrivelse i matrisecellen + tiltak i «Tiltak som reduserer …»
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

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          setError(null);
          setSuggestions([]);
          setSelected(new Set());
          setUsedModel(null);
        }
      }}
    >
      <DialogContent size="xl" titleId="ros-ai-suggest-title">
        <DialogHeader>
          <h2
            id="ros-ai-suggest-title"
            className="font-heading flex items-center gap-2 text-lg font-semibold"
          >
            <Sparkles className="size-4" aria-hidden />
            AI-forslag til risiko
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Velg forslag og legg dem inn i matrisen. Beskrivelse fylles under
            «Hva kan gå galt?», og tiltak under «Tiltak som reduserer risikoen».
            Du kan redigere fritekst etterpå.
          </p>
        </DialogHeader>
        <DialogBody className="space-y-4">
          {aiStatus && !aiStatus.configured ? (
            <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm leading-relaxed">
              KI er ikke konfigurert. En administrator må legge inn API-nøkkel og
              modell under{" "}
              <a
                href={`/w/${workspaceId}/innstillinger`}
                className="text-primary font-medium underline-offset-4 hover:underline"
              >
                Innstillinger
              </a>
              .
            </p>
          ) : null}
          {aiStatus?.configured && !aiStatus.enabled ? (
            <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm leading-relaxed">
              KI er slått av for arbeidsområdet. En administrator kan slå den på
              under{" "}
              <a
                href={`/w/${workspaceId}/innstillinger`}
                className="text-primary font-medium underline-offset-4 hover:underline"
              >
                Innstillinger
              </a>
              .
            </p>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="ros-ai-hint">Ekstra instruks (valgfritt)</Label>
            <Textarea
              id="ros-ai-hint"
              value={hint}
              onChange={(e) => setHint(e.target.value)}
              placeholder="F.eks. fokuser på personvern, eller på drift ved feil …"
              className="min-h-[4.5rem] resize-y text-sm"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              className="h-10 gap-2"
              disabled={loading || aiStatus?.available !== true}
              onClick={() => void runSuggest()}
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Sparkles className="size-4" aria-hidden />
              )}
              {suggestions.length > 0 ? "Hent nye forslag" : "Hent forslag"}
            </Button>
            {usedModel ? (
              <span className="text-muted-foreground self-center text-xs">
                Modell: {usedModel}
              </span>
            ) : null}
          </div>

          {error ? (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          ) : null}

          {suggestions.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">
                  Forslag ({selected.size}/{suggestions.length} valgt)
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs"
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
              </div>
              <ul className="max-h-[min(50vh,22rem)] space-y-2 overflow-y-auto pr-1">
                {suggestions.map((s, i) => {
                  const checked = selected.has(i);
                  return (
                    <li key={`${s.title}-${i}`}>
                      <button
                        type="button"
                        onClick={() => toggle(i)}
                        className={cn(
                          "w-full rounded-xl border px-3 py-3 text-left text-sm transition-colors",
                          checked
                            ? "border-primary/50 bg-primary/5"
                            : "border-border/60 bg-card hover:bg-muted/40",
                        )}
                      >
                        <div className="flex items-start gap-2">
                          <span
                            className={cn(
                              "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border text-[10px]",
                              checked
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border",
                            )}
                            aria-hidden
                          >
                            {checked ? "✓" : ""}
                          </span>
                          <div className="min-w-0 space-y-1">
                            <p className="font-medium">{s.title}</p>
                            <p className="text-muted-foreground text-xs leading-relaxed">
                              {s.description}
                            </p>
                            {s.consequence ? (
                              <p className="text-xs">
                                <span className="font-medium">Konsekvens:</span>{" "}
                                {s.consequence}
                              </p>
                            ) : null}
                            {s.treatment ? (
                              <p className="text-xs">
                                <span className="font-medium">Tiltak:</span>{" "}
                                {s.treatment}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </DialogBody>
        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Avbryt
          </Button>
          <Button
            type="button"
            disabled={selected.size === 0 || loading}
            onClick={acceptSelected}
          >
            Legg inn i matrise
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
