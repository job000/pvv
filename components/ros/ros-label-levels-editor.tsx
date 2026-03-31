"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { useCallback, useMemo } from "react";

function linesFromValue(value: string): string[] {
  if (value === "") return [];
  return value.split("\n");
}

function trimmedNonEmpty(lines: string[]): string[] {
  return lines.map((s) => s.trim()).filter(Boolean);
}

export type RosLabelLevelsEditorProps = {
  id: string;
  title: string;
  intro: string;
  value: string;
  onChange: (next: string) => void;
  defaultLabels: readonly string[];
  lowEndHint: string;
  highEndHint: string;
  className?: string;
  variant?: "template" | "matrixAxes";
  /** Per-level descriptions (parallel to lines) */
  descriptions?: string[];
  onDescriptionsChange?: (next: string[]) => void;
};

export function RosLabelLevelsEditor({
  id,
  title,
  intro,
  value,
  onChange,
  defaultLabels,
  lowEndHint,
  highEndHint,
  className,
  variant = "template",
  descriptions,
  onDescriptionsChange,
}: RosLabelLevelsEditorProps) {
  const isMatrixAxes = variant === "matrixAxes";
  const lines = useMemo(() => linesFromValue(value), [value]);
  const nonEmpty = useMemo(() => trimmedNonEmpty(lines), [lines]);
  const hasDescriptions = !!onDescriptionsChange;

  const applyDefaultLabels = useCallback(() => {
    onChange([...defaultLabels].join("\n"));
    if (onDescriptionsChange) {
      onDescriptionsChange(defaultLabels.map(() => ""));
    }
  }, [defaultLabels, onChange, onDescriptionsChange]);

  const startEmptyRows = useCallback(() => {
    onChange("\n");
    if (onDescriptionsChange) {
      onDescriptionsChange(["", ""]);
    }
  }, [onChange, onDescriptionsChange]);

  const clearToBuiltin = useCallback(() => {
    onChange("");
    if (onDescriptionsChange) {
      onDescriptionsChange([]);
    }
  }, [onChange, onDescriptionsChange]);

  const setLine = useCallback(
    (index: number, text: string) => {
      const next = [...lines];
      while (next.length <= index) next.push("");
      next[index] = text;
      onChange(next.join("\n"));
    },
    [lines, onChange],
  );

  const setDescription = useCallback(
    (index: number, text: string) => {
      if (!onDescriptionsChange) return;
      const next = [...(descriptions ?? [])];
      while (next.length <= index) next.push("");
      next[index] = text;
      onDescriptionsChange(next);
    },
    [descriptions, onDescriptionsChange],
  );

  const addLine = useCallback(() => {
    const next = [...lines, ""];
    if (next.length === 1) next.push("");
    onChange(next.join("\n"));
    if (onDescriptionsChange) {
      const d = [...(descriptions ?? [])];
      d.push("");
      if (d.length === 1) d.push("");
      onDescriptionsChange(d);
    }
  }, [lines, onChange, descriptions, onDescriptionsChange]);

  const removeLine = useCallback(
    (index: number) => {
      if (lines.length <= 2) return;
      const next = [...lines];
      next.splice(index, 1);
      onChange(next.join("\n"));
      if (onDescriptionsChange) {
        const d = [...(descriptions ?? [])];
        d.splice(index, 1);
        onDescriptionsChange(d);
      }
    },
    [lines, onChange, descriptions, onDescriptionsChange],
  );

  const moveLine = useCallback(
    (index: number, dir: -1 | 1) => {
      const target = index + dir;
      if (target < 0 || target >= lines.length) return;
      const next = [...lines];
      [next[index]!, next[target]!] = [next[target]!, next[index]!];
      onChange(next.join("\n"));
      if (onDescriptionsChange && descriptions) {
        const d = [...descriptions];
        while (d.length < lines.length) d.push("");
        [d[index]!, d[target]!] = [d[target]!, d[index]!];
        onDescriptionsChange(d);
      }
    },
    [lines, onChange, descriptions, onDescriptionsChange],
  );

  const showReferenceOnly = !isMatrixAxes && value === "";
  const showListEditor = isMatrixAxes || value !== "";

  const rowCount = Math.max(2, lines.length);

  return (
    <div className={cn("space-y-2", className)}>
      <div>
        <Label htmlFor={`${id}-0`} className="text-foreground">
          {title}
        </Label>
        <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
          {intro}{" "}
          <span className="text-foreground/90">
            Nivå 1 ({lowEndHint}) til nivå {defaultLabels.length} ({highEndHint}
            ) i standardoppsettet — du kan ha flere eller færre.
          </span>
        </p>
      </div>

      {showReferenceOnly ? (
        <div className="border-border/60 bg-muted/20 space-y-3 rounded-xl border p-3">
          <p className="text-muted-foreground text-xs leading-relaxed">
            <strong className="text-foreground">Tomt felt</strong> betyr at
            malen bruker det innebygde 5×5-rutenettet. Du kan kopiere dem inn
            for å redigere ordlyden.
          </p>
          <ol className="text-muted-foreground list-decimal space-y-1 pl-4 text-xs leading-relaxed">
            {defaultLabels.map((l, i) => (
              <li key={i}>
                <span className="text-foreground">{l}</span>
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={applyDefaultLabels}>
              Kopier inn som redigerbare nivåer
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={startEmptyRows}
            >
              Skriv egne (2 tomme felt)
            </Button>
          </div>
        </div>
      ) : null}

      {showListEditor ? (
        <div
          className={cn(
            "space-y-2",
            isMatrixAxes &&
              "border-border/60 from-card to-muted/15 rounded-xl border bg-gradient-to-b p-3 shadow-sm",
          )}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">
              Nivåer (minst 2 med tekst)
            </span>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                onClick={applyDefaultLabels}
              >
                Sett inn standardtekst
              </Button>
              {!isMatrixAxes ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={clearToBuiltin}
                >
                  Tøm (innebygd 5×5)
                </Button>
              ) : null}
            </div>
          </div>
          <ul className="space-y-2">
            {Array.from({ length: rowCount }, (_, i) => (
              <li
                key={i}
                className="flex items-start gap-2 rounded-lg border border-border/40 bg-card p-2"
              >
                <span
                  className="text-muted-foreground bg-muted/50 flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-semibold tabular-nums"
                  title={`Nivå ${i + 1}`}
                >
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                  <Input
                    id={i === 0 ? `${id}-0` : undefined}
                    value={lines[i] ?? ""}
                    onChange={(e) => setLine(i, e.target.value)}
                    placeholder={defaultLabels[i] ?? `Nivå ${i + 1}`}
                    className="h-9 text-sm"
                    aria-label={`Etikett nivå ${i + 1}`}
                  />
                  {hasDescriptions ? (
                    <Input
                      value={descriptions?.[i] ?? ""}
                      onChange={(e) => setDescription(i, e.target.value)}
                      placeholder="Beskrivelse (valgfritt) — hva betyr dette nivået?"
                      className="h-8 text-xs text-muted-foreground"
                      aria-label={`Beskrivelse nivå ${i + 1}`}
                    />
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-col gap-0.5">
                  <button
                    type="button"
                    className="rounded p-0.5 text-muted-foreground/60 hover:bg-muted hover:text-foreground disabled:invisible"
                    disabled={i === 0}
                    onClick={() => moveLine(i, -1)}
                    title="Flytt opp"
                  >
                    <ChevronUp className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    className="rounded p-0.5 text-muted-foreground/60 hover:bg-muted hover:text-foreground disabled:invisible"
                    disabled={i >= rowCount - 1}
                    onClick={() => moveLine(i, 1)}
                    title="Flytt ned"
                  >
                    <ChevronDown className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    className="rounded p-0.5 text-muted-foreground/60 hover:bg-destructive/10 hover:text-destructive disabled:invisible"
                    disabled={rowCount <= 2}
                    onClick={() => removeLine(i)}
                    title="Fjern nivå"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={addLine}
          >
            <Plus className="size-3.5" />
            Legg til nivå
          </Button>
          {nonEmpty.length === 1 ? (
            <p className="text-amber-800 dark:text-amber-200 text-xs">
              {isMatrixAxes
                ? "Fyll inn minst to nivåer med tekst, eller bruk «Sett inn standardtekst»."
                : "Fyll inn minst to nivåer med tekst, eller bruk «Tøm» for innebygd standard."}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
