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
    <div className={cn("w-full min-w-0 max-w-full space-y-4", className)}>
      <div className="min-w-0 space-y-1.5">
        <p
          id={`${id}-label`}
          className="text-foreground text-base font-semibold leading-snug text-pretty sm:text-lg"
        >
          {label}
        </p>
        {hint ? (
          <p
            id={hintId}
            className="text-muted-foreground text-sm leading-relaxed text-pretty"
          >
            {hint}
          </p>
        ) : null}
      </div>

      <div
        className="w-full min-w-0 max-w-full overflow-hidden rounded-2xl bg-muted/15 p-3 sm:p-5"
        role="radiogroup"
        aria-labelledby={`${id}-label`}
        aria-describedby={hintId}
      >
        <div className="text-muted-foreground mb-3 flex min-w-0 justify-between gap-2 text-[11px] font-medium sm:text-xs">
          <span className="min-w-0 flex-1 truncate">{left}</span>
          <span className="min-w-0 flex-1 truncate text-right">{right}</span>
        </div>

        {/** To rader (knapper / etiketter): hold innen viewport — ingen scale som sprenger bredde. */}
        <div
          className="w-full min-w-0 touch-manipulation space-y-1.5"
          style={{ WebkitTapHighlightColor: "transparent" }}
        >
          <div className="grid w-full min-w-0 grid-cols-5 gap-1 sm:gap-2.5">
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
                    "focus-visible:ring-ring relative flex min-h-11 w-full min-w-0 flex-col items-center justify-center rounded-lg text-base font-bold tabular-nums transition-colors duration-150 outline-none focus-visible:ring-2 sm:min-h-12 sm:rounded-xl sm:text-lg",
                    selected
                      ? cn(
                          "text-white shadow-md ring-2",
                          SCALE_BG[n],
                          SCALE_RING[n],
                        )
                      : "bg-card text-foreground shadow-sm ring-1 ring-black/[0.06] hover:bg-muted/40 active:bg-muted/60 dark:ring-white/[0.08]",
                    disabled && "pointer-events-none opacity-50",
                  )}
                >
                  {n}
                </button>
              );
            })}
          </div>
          {scaleLabels ? (
            <div className="grid w-full min-w-0 grid-cols-5 gap-1 sm:gap-2.5">
              {SCALE.map((n) => {
                const selected = value === n;
                const scaleLabel = scaleLabels[n - 1];
                return (
                  <div
                    key={n}
                    className="flex min-w-0 justify-center px-0.5"
                    aria-hidden
                  >
                    <span
                      className={cn(
                        "line-clamp-2 max-w-full text-center text-[9px] leading-tight break-words hyphens-auto sm:text-[11px] sm:leading-snug",
                        selected
                          ? "text-foreground font-medium"
                          : "text-muted-foreground",
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
