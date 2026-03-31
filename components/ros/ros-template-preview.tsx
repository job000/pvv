"use client";

import { cellRiskClass } from "@/lib/ros-risk-colors";
import { positionRiskLevel } from "@/lib/ros-defaults";
import { cn } from "@/lib/utils";
import { useMemo } from "react";

export function RosTemplatePreviewMini({
  rowLabels,
  colLabels,
  compact,
  className,
}: {
  rowLabels: string[];
  colLabels: string[];
  compact?: boolean;
  className?: string;
}) {
  const rows = rowLabels.length;
  const cols = colLabels.length;
  const demo = useMemo(() => {
    return Array.from({ length: rows }, (_, i) =>
      Array.from({ length: cols }, (_, j) =>
        positionRiskLevel(i, j, rows, cols),
      ),
    );
  }, [rows, cols]);

  if (rows === 0 || cols === 0) {
    return (
      <div
        className={cn(
          "bg-muted/40 text-muted-foreground flex min-h-[4rem] items-center justify-center rounded-xl border border-dashed text-xs",
          className,
        )}
      >
        Ingen rutenett ennå
      </div>
    );
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border/60",
        compact && "max-w-[10rem]",
        className,
      )}
    >
      <table className="w-full border-collapse text-[10px]">
        <thead>
          <tr>
            <th className="bg-muted/50 w-6 border-b border-r border-border/40 p-0" />
            {colLabels.map((_, j) => (
              <th
                key={j}
                className={cn(
                  "bg-muted/30 border-b border-border/40 text-center font-medium text-muted-foreground",
                  compact ? "py-0.5" : "py-1",
                )}
                title={colLabels[j]}
              >
                {j + 1}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[...rowLabels].map((_, _ri) => {
            const i = rows - 1 - _ri;
            return (
              <tr key={i}>
                <th
                  className="bg-muted/30 border-r border-border/40 py-0.5 text-center font-medium text-muted-foreground"
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
                          "flex items-center justify-center rounded-md border font-bold tabular-nums",
                          compact
                            ? "size-5 text-[8px]"
                            : "aspect-square text-[9px]",
                          cellRiskClass(v),
                        )}
                      >
                        {v}
                      </div>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
