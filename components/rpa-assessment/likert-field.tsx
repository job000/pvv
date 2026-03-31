"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { clampLikert5, type Likert5 } from "@/lib/rpa-assessment/scoring";
import { useCallback, useRef } from "react";

const SCALE = [1, 2, 3, 4, 5] as const;

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
}: LikertFieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const captionId = `${id}-caption`;
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
      <div className="space-y-2">
        <p
          id={`${id}-label`}
          className="text-base font-medium leading-snug text-foreground sm:text-[1.05rem]"
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
        <p
          id={captionId}
          className="text-muted-foreground text-xs leading-snug sm:text-[11px]"
        >
          Skala <span className="text-foreground font-medium">1–5</span>{" "}
          (heltall). Lagres som før i PVV-beregningen — ingen endring i
          poengformler, bare måten du setter verdien på.
        </p>
      </div>

      <div
        className="border-border/70 bg-card/40 shadow-sm ring-1 ring-border/40 rounded-2xl border p-3 sm:p-5"
        role="radiogroup"
        aria-labelledby={`${id}-label`}
        aria-describedby={
          [hintId, captionId].filter(Boolean).join(" ") || undefined
        }
      >
        <div className="text-muted-foreground mb-3 flex justify-between gap-2 text-[11px] font-medium leading-tight sm:mb-4 sm:gap-3 sm:text-xs">
          <span className="max-w-[46%] min-w-0 text-left">{left}</span>
          <span className="max-w-[46%] min-w-0 text-right">{right}</span>
        </div>

        <div
          className="mb-3 flex h-2.5 gap-0.5 rounded-full bg-muted/70 p-0.5 sm:mb-4 sm:h-2"
          aria-hidden
        >
          {SCALE.map((step) => (
            <div
              key={step}
              className={cn(
                "min-h-0 flex-1 rounded-full transition-colors duration-200 motion-reduce:transition-none",
                step <= value
                  ? "bg-primary"
                  : "bg-muted-foreground/15 dark:bg-muted-foreground/10",
              )}
            />
          ))}
        </div>

        <div
          className="flex touch-manipulation gap-1 sm:gap-2"
          style={{ WebkitTapHighlightColor: "transparent" }}
        >
          {SCALE.map((n) => {
            const selected = value === n;
            return (
              <button
                key={n}
                ref={(el) => {
                  buttonsRef.current[n - 1] = el;
                }}
                type="button"
                role="radio"
                aria-checked={selected}
                tabIndex={selected ? 0 : -1}
                disabled={disabled}
                onClick={() => onChange(clampLikert5(n))}
                onKeyDown={(e) => handleRadioKeyDown(n, e)}
                className={cn(
                  "focus-visible:ring-ring motion-safe:active:scale-[0.98] min-h-[44px] min-w-0 flex-1 rounded-xl text-base font-semibold tabular-nums transition-[transform,box-shadow,background-color] outline-none focus-visible:ring-3 motion-reduce:transition-none motion-reduce:active:scale-100 sm:min-h-11 sm:text-sm",
                  selected
                    ? "bg-primary text-primary-foreground shadow-md ring-2 ring-primary/25"
                    : "bg-background/90 text-foreground border-border/80 hover:bg-muted/80 border shadow-xs",
                  disabled && "pointer-events-none opacity-50",
                )}
              >
                {n}
              </button>
            );
          })}
        </div>

        <p className="text-muted-foreground mt-3 hidden text-center text-[11px] sm:block">
          Tastatur: piltaster flytter valg · Home / End til 1 eller 5
        </p>
        <p className="text-muted-foreground mt-2 text-center text-[11px] sm:hidden">
          Tips: trykk på 1–5, eller skriv under. Store taster — enkle å treffe.
        </p>

        <div className="border-border/50 mt-4 flex flex-col items-stretch gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <Label
            htmlFor={`${id}-manual`}
            className="text-muted-foreground shrink-0 text-xs font-normal"
            id={`${id}-manual-label`}
          >
            Skriv verdi (1–5)
          </Label>
          <div className="flex justify-center sm:justify-end">
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
                "min-h-[44px] w-[5.5rem] text-center font-mono text-base tabular-nums sm:min-h-9 sm:w-[4.5rem] sm:text-sm",
                "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
              )}
              aria-labelledby={`${id}-manual-label`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
