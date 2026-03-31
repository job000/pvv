"use client";

import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { clampLikert5, type Likert5 } from "@/lib/rpa-assessment/scoring";

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
  return (
    <div className={cn("space-y-6", className)}>
      <div className="space-y-2.5">
        <Label htmlFor={id} className="text-base font-medium leading-snug">
          {label}
        </Label>
        {hint ? (
          <p className="text-muted-foreground max-w-prose text-sm leading-relaxed">
            {hint}
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-3 pt-1">
        <span className="w-[5.5rem] shrink-0 text-xs leading-snug text-muted-foreground sm:w-28">
          {left}
        </span>
        <Slider
          id={id}
          min={1}
          max={5}
          step={1}
          value={[value]}
          disabled={disabled}
          onValueChange={(v) => {
            const raw = Array.isArray(v) ? v[0] : v;
            onChange(clampLikert5(Number(raw)));
          }}
          className="min-w-[10rem] flex-1"
        />
        <span className="w-[5.5rem] shrink-0 text-right text-xs leading-snug text-muted-foreground sm:w-28">
          {right}
        </span>
        <Badge
          variant="secondary"
          className="min-w-9 justify-center font-mono tabular-nums"
        >
          {value}
        </Badge>
      </div>
    </div>
  );
}
