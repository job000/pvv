"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { clampLikert5, type Likert5 } from "@/lib/rpa-assessment/scoring";
import { useCallback, useRef } from "react";

const SCALE = [1, 2, 3, 4, 5] as const;

const SCALE_BG: Record<number, string> = {
  1: "bg-emerald-500",
  2: "bg-lime-500",
  3: "bg-amber-500",
  4: "bg-orange-500",
  5: "bg-rose-500",
};
const SCALE_RING: Record<number, string> = {
  1: "ring-emerald-500/30",
  2: "ring-lime-500/30",
  3: "ring-amber-500/30",
  4: "ring-orange-500/30",
  5: "ring-rose-500/30",
};

type LikertFieldProps = {
  id: string;
  label: string;
  hint?: string;
  value: Likert5;
  onChange: (v: Likert5) => void;
  left: string;
  right: string;
  className?: string;
  disabled?: boolean;
  scaleLabels?: readonly [string, string, string, string, string];
  /** Tekst ved tallfeltet nederst (tilgjengelighet / tastatur). */
  manualInputLabel?: string;
};

export function LikertField({
  id,
  label,
  hint,
  value,
  onChange,
  left,
  right,
  className,
  disabled = false,
  scaleLabels,
  manualInputLabel = "Skriv 1–5",
}: LikertFieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const buttonsRef = useRef<Array<HTMLButtonElement | null>>([]);

  const focusValue = useCallback((v: Likert5) => {
    const el = buttonsRef.current[v - 1];
    if (el) el.focus();
  }, []);

  const handleRadioKeyDown = useCallback(
    (n: Likert5, e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (disabled) return;
      let next: Likert5 | null = null;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        next = clampLikert5(n + 1);
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        next = clampLikert5(n - 1);
      } else if (e.key === "Home") {
        e.preventDefault();
        next = 1;
      } else if (e.key === "End") {
        e.preventDefault();
        next = 5;
      }
      if (next !== null) {
        onChange(next);
        requestAnimationFrame(() => focusValue(next));
      }
    },
    [disabled, onChange, focusValue],
  );

  return (
    <div className={cn("space-y-4", className)}>
      <div className="space-y-1.5">
        <p
          id={`${id}-label`}
          className="text-foreground text-base font-semibold leading-snug sm:text-lg"
        >
          {label}
        </p>
        {hint ? (
          <p
            id={hintId}
            className="text-muted-foreground max-w-prose text-sm leading-relaxed"
          >
            {hint}
          </p>
        ) : null}
      </div>

      <div
        className="rounded-2xl bg-muted/15 p-4 sm:p-5"
        role="radiogroup"
        aria-labelledby={`${id}-label`}
        aria-describedby={hintId}
      >
        <div className="text-muted-foreground mb-3 flex justify-between text-xs font-medium">
          <span>{left}</span>
          <span>{right}</span>
        </div>

        {/** To rader (knapper / etiketter): unngå at én kolonne med lang tekst strekker hele kortet vertikalt. */}
        <div
          className="touch-manipulation space-y-1.5"
          style={{ WebkitTapHighlightColor: "transparent" }}
        >
          <div className="flex gap-2 sm:gap-3">
            {SCALE.map((n) => {
              const selected = value === n;
              const scaleLabel = scaleLabels?.[n - 1];
              return (
                <button
                  key={n}
                  ref={(el) => {
                    buttonsRef.current[n - 1] = el;
                  }}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={scaleLabel ? `${n} — ${scaleLabel}` : String(n)}
                  tabIndex={selected ? 0 : -1}
                  disabled={disabled}
                  onClick={() => onChange(clampLikert5(n))}
                  onKeyDown={(e) => handleRadioKeyDown(n, e)}
                  className={cn(
                    "focus-visible:ring-ring relative flex min-h-[52px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl text-lg font-bold tabular-nums transition-all duration-150 outline-none focus-visible:ring-2 sm:min-h-12 sm:rounded-xl",
                    selected
                      ? cn(
                          "text-white shadow-lg ring-2 scale-[1.05]",
                          SCALE_BG[n],
                          SCALE_RING[n],
                        )
                      : "bg-card text-foreground shadow-sm ring-1 ring-black/[0.06] hover:shadow-md hover:scale-[1.02] active:scale-[0.98] dark:ring-white/[0.08]",
                    disabled && "pointer-events-none opacity-50",
                  )}
                >
                  {n}
                </button>
              );
            })}
          </div>
          {scaleLabels ? (
            <div className="flex gap-2 sm:gap-3">
              {SCALE.map((n) => {
                const selected = value === n;
                const scaleLabel = scaleLabels[n - 1];
                return (
                  <div
                    key={n}
                    className="flex min-w-0 flex-1 justify-center"
                    aria-hidden
                  >
                    <span
                      className={cn(
                        "hyphens-auto line-clamp-2 max-w-full text-center text-[10px] leading-snug break-words sm:text-[11px]",
                        selected ? "text-foreground font-medium" : "text-muted-foreground",
                      )}
                    >
                      {scaleLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-border/30 pt-3">
          <Label
            htmlFor={`${id}-manual`}
            className="text-muted-foreground text-[11px] font-normal"
            id={`${id}-manual-label`}
          >
            {manualInputLabel}
          </Label>
          <Input
            id={`${id}-manual`}
            type="number"
            inputMode="numeric"
            pattern="[1-5]"
            autoComplete="off"
            min={1}
            max={5}
            step={1}
            disabled={disabled}
            value={value}
            onChange={(e) => {
              const t = e.target.value.trim();
              if (t === "") return;
              const num = Number(t);
              if (!Number.isFinite(num)) return;
              onChange(clampLikert5(num));
            }}
            className={cn(
              "h-8 w-16 rounded-lg text-center font-mono text-sm tabular-nums",
              "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
            )}
            aria-labelledby={`${id}-manual-label`}
          />
        </div>
      </div>
    </div>
  );
}
