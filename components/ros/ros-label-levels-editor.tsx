"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Minus, Plus } from "lucide-react";
import { useCallback, useMemo } from "react";

/** Rå streng → linjer; tom streng ⇒ ingen linjer (ikke én tom linje). */
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
  /** Kort forklaring over feltet (f.eks. sannsynlighet vs konsekvens) */
  intro: string;
  value: string;
  onChange: (next: string) => void;
  /** Standardetiketter som vises som referanse og «kopier inn» */
  defaultLabels: readonly string[];
  /** Tekst ved nivå 1 (lav ende av aksen) */
  lowEndHint: string;
  /** Tekst ved siste nivå (høy ende) */
  highEndHint: string;
  className?: string;
  /**
   * `template` — tom streng viser mal-referanse (dialog for nye maler).
   * `matrixAxes` — alltid redigerbar liste (etter-tiltak-matrise); tom gir to tomme felt.
   */
  variant?: "template" | "matrixAxes";
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
}: RosLabelLevelsEditorProps) {
  const isMatrixAxes = variant === "matrixAxes";
  const lines = useMemo(() => linesFromValue(value), [value]);
  const nonEmpty = useMemo(() => trimmedNonEmpty(lines), [lines]);

  const applyDefaultLabels = useCallback(() => {
    onChange([...defaultLabels].join("\n"));
  }, [defaultLabels, onChange]);

  const startEmptyRows = useCallback(() => {
    onChange("\n");
  }, [onChange]);

  const clearToBuiltin = useCallback(() => {
    onChange("");
  }, [onChange]);

  const setLine = useCallback(
    (index: number, text: string) => {
      const next = [...lines];
      while (next.length <= index) next.push("");
      next[index] = text;
      onChange(next.join("\n"));
    },
    [lines, onChange],
  );

  const addLine = useCallback(() => {
    const next = [...lines, ""];
    if (next.length === 1) next.push("");
    onChange(next.join("\n"));
  }, [lines, onChange]);

  const removeLastLine = useCallback(() => {
    if (lines.length <= 2) return;
    onChange(lines.slice(0, -1).join("\n"));
  }, [lines, onChange]);

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
            ) i standardoppsettet — du kan ha flere eller færre rader om du
            tilpasser.
          </span>
        </p>
      </div>

      {showReferenceOnly ? (
        <div className="border-border/60 bg-muted/20 space-y-3 rounded-xl border p-3">
          <p className="text-muted-foreground text-xs leading-relaxed">
            <strong className="text-foreground">Tomt felt</strong> betyr at malen
            bruker det innebygde 5×5-rutenettet med disse tekstene (du ser dem i
            forhåndsvisning). Du kan også kopiere dem inn for å redigere ordlyden.
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
              <li key={i} className="flex items-start gap-2">
                <span
                  className="text-muted-foreground bg-muted/50 flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-semibold tabular-nums"
                  title={`Nivå ${i + 1}`}
                >
                  {i + 1}
                </span>
                <Input
                  id={i === 0 ? `${id}-0` : undefined}
                  value={lines[i] ?? ""}
                  onChange={(e) => setLine(i, e.target.value)}
                  placeholder={defaultLabels[i] ?? `Nivå ${i + 1}`}
                  className={cn(
                    "h-10 min-w-0 flex-1 rounded-lg border-border/70 text-sm shadow-xs transition-shadow",
                    isMatrixAxes &&
                      "focus-visible:border-primary/40 focus-visible:ring-primary/20",
                  )}
                  aria-label={`Etikett nivå ${i + 1}`}
                />
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
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
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1"
              disabled={lines.length <= 2}
              onClick={removeLastLine}
            >
              <Minus className="size-3.5" />
              Fjern siste nivå
            </Button>
          </div>
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
