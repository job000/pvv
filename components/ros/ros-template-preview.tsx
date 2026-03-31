"use client";

import { cellRiskClass } from "@/lib/ros-risk-colors";
import { cn } from "@/lib/utils";
import { useMemo } from "react";

/** Visuell demo av fargeskala: typisk økende «eksponering» mot høyre og ned. */
function demoLevel(
  row: number,
  rows: number,
  col: number,
  cols: number,
): number {
  if (rows < 1 || cols < 1) return 0;
  const r = (row + 0.5) / rows;
  const c = (col + 0.5) / cols;
  const raw = Math.round((r * c) * 6);
  return Math.min(5, Math.max(0, raw));
}

export function RosTemplatePreviewMini({
  rowLabels,
  colLabels,
  className,
}: {
  rowLabels: string[];
  colLabels: string[];
  className?: string;
}) {
  const rows = rowLabels.length;
  const cols = colLabels.length;
  const demo = useMemo(() => {
    return Array.from({ length: rows }, (_, i) =>
      Array.from({ length: cols }, (_, j) => demoLevel(i, rows, j, cols)),
    );
  }, [rows, cols]);

  if (rows === 0 || cols === 0) {
    return (
      <div
        className={cn(
          "bg-muted/40 text-muted-foreground flex min-h-[5rem] items-center justify-center rounded-xl border border-dashed text-xs",
          className,
        )}
      >
        Ingen rutenett ennå
      </div>
    );
  }

  return (
    <div className={cn("overflow-hidden rounded-xl border border-border/60", className)}>
      <div className="text-muted-foreground flex max-h-48 overflow-auto">
        <table className="w-full border-collapse text-left text-[9px]">
          <thead>
            <tr>
              <th className="bg-muted/50 sticky left-0 z-[1] w-8 min-w-0 border-b border-r p-0.5" />
              {colLabels.map((_, j) => (
                <th
                  key={j}
                  className="bg-muted/40 max-w-[3.5rem] truncate border-b p-0.5 text-center font-medium"
                  title={colLabels[j]}
                >
                  {j + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rowLabels.map((_, i) => (
              <tr key={i}>
                <th
                  className="bg-muted/50 sticky left-0 z-[1] max-w-[4rem] truncate border-r p-0.5 text-left font-medium"
                  title={rowLabels[i]}
                >
                  {i + 1}
                </th>
                {colLabels.map((_, j) => {
                  const v = demo[i]?.[j] ?? 0;
                  return (
                    <td key={j} className="p-0.5">
                      <div
                        className={cn(
                          "flex h-6 min-w-[1.25rem] items-center justify-center rounded-md border text-[8px] font-bold tabular-nums",
                          cellRiskClass(v),
                        )}
                        title={`Demo nivå ${v}`}
                      >
                        {v}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-muted-foreground border-t border-border/50 bg-muted/20 px-2 py-1 text-[10px] leading-tight">
        Forhåndsvisning: eksempelverdier viser fargeskala (1–5). Tomme celler i
        analysen starter på 0 (ikke vurdert).
      </p>
    </div>
  );
}
