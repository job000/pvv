"use client";

import { RISK_LEVEL_HINTS } from "@/lib/ros-defaults";
import { cn } from "@/lib/utils";

type Props = {
  rowAxisTitle: string;
  colAxisTitle: string;
  rowLabels: string[];
  colLabels: string[];
  className?: string;
};

/**
 * Viser hva rad- og kolonneaksene «spør om» — tilsvarende akseptkriterier i papir-ROS,
 * her som etiketter fra malen.
 */
export function RosAxisOverview({
  rowAxisTitle,
  colAxisTitle,
  rowLabels,
  colLabels,
  className,
}: Props) {
  return (
    <div
      className={cn(
        "border-border/60 bg-muted/20 grid gap-4 rounded-xl border p-4 text-sm sm:grid-cols-2",
        className,
      )}
    >
      <div className="space-y-2">
        <p className="text-foreground text-xs font-semibold uppercase tracking-wide">
          {rowAxisTitle}
        </p>
        <ul className="text-muted-foreground space-y-1.5 leading-snug">
          {rowLabels.map((label, i) => (
            <li key={`r-${i}`} className="flex gap-2">
              <span className="text-foreground/80 w-6 shrink-0 font-mono text-xs tabular-nums">
                {i + 1}
              </span>
              <span>{label}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="space-y-2">
        <p className="text-foreground text-xs font-semibold uppercase tracking-wide">
          {colAxisTitle}
        </p>
        <ul className="text-muted-foreground space-y-1.5 leading-snug">
          {colLabels.map((label, j) => (
            <li key={`c-${j}`} className="flex gap-2">
              <span className="text-foreground/80 w-6 shrink-0 font-mono text-xs tabular-nums">
                {j + 1}
              </span>
              <span>{label}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="text-muted-foreground border-border/50 border-t pt-2 text-xs leading-relaxed sm:col-span-2">
        <span className="text-foreground font-medium">Nivå i celle (0–5):</span>{" "}
        {[1, 2, 3, 4, 5].map((k) => (
          <span key={k}>
            {k > 1 ? " · " : null}
            {k} = {RISK_LEVEL_HINTS[k] ?? "—"}
          </span>
        ))}
        . Celle 0 = ikke vurdert ennå.
      </div>
    </div>
  );
}
