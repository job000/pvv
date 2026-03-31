"use client";

import { cnCell, legendItems } from "@/lib/ros-risk-colors";
import { RISK_LEVEL_HINTS } from "@/lib/ros-defaults";
import { cn } from "@/lib/utils";

type Props = {
  rowAxisTitle: string;
  colAxisTitle: string;
  rowLabels: string[];
  colLabels: string[];
  matrixValues: number[][];
  onCellChange?: (row: number, col: number, next: number) => void;
  readOnly?: boolean;
};

export function RosMatrix({
  rowAxisTitle,
  colAxisTitle,
  rowLabels,
  colLabels,
  matrixValues,
  onCellChange,
  readOnly = false,
}: Props) {
  const interactive = Boolean(onCellChange) && !readOnly;

  return (
    <div className="space-y-3">
      <div className="relative overflow-x-auto rounded-2xl border border-border/70 shadow-inner">
        <table className="w-full min-w-[min(100%,48rem)] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border/60 bg-muted/50">
              <th
                scope="col"
                className="bg-muted/95 sticky top-0 left-0 z-20 min-w-[7rem] border-r border-border/50 px-2 py-3 text-xs font-semibold uppercase tracking-wide"
              >
                <span className="text-muted-foreground block font-normal normal-case">
                  {rowAxisTitle}
                </span>
                <span className="text-foreground">× {colAxisTitle}</span>
              </th>
              {colLabels.map((label, j) => (
                <th
                  key={j}
                  scope="col"
                  className="bg-muted/95 sticky top-0 z-10 max-w-[8rem] min-w-[5rem] border-b border-border/50 px-2 py-2 text-center text-xs font-medium leading-snug"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rowLabels.map((rowLabel, i) => (
              <tr key={i} className="border-b border-border/40 last:border-0">
                <th
                  scope="row"
                  className="bg-card sticky left-0 z-10 max-w-[10rem] border-r border-border/50 px-2 py-2 text-left text-xs font-medium leading-snug"
                >
                  {rowLabel}
                </th>
                {colLabels.map((_, j) => {
                  const v = matrixValues[i]?.[j] ?? 0;
                  return (
                    <td key={j} className="p-1 align-middle">
                      <button
                        type="button"
                        disabled={!interactive}
                        title={`${RISK_LEVEL_HINTS[v] ?? ""} — klikk for neste nivå`}
                        onClick={() => {
                          if (!interactive || !onCellChange) return;
                          const next = (v + 1) % 6;
                          onCellChange(i, j, next);
                        }}
                        className={cn(
                          cnCell(v, interactive),
                          "flex h-full min-h-[3.25rem] w-full items-center justify-center rounded-lg",
                          !interactive && "cursor-default",
                        )}
                      >
                        {v}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-2">
        {legendItems().map(({ level, label }) => (
          <span
            key={level}
            className={cn(
              cnCell(level, false),
              "inline-flex rounded-md px-2 py-1 text-[10px] font-medium",
            )}
          >
            {level}: {label}
          </span>
        ))}
      </div>
      <p className="text-muted-foreground text-xs leading-relaxed">
        {interactive
          ? "Klikk på en celle for å øke risikonivå (0 → 1 → … → 5 → 0). Verdiene er veiledende og må dokumenteres i notat eller egen rapport."
          : "Matrise i visningsmodus."}
      </p>
    </div>
  );
}
