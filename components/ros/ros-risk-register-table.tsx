"use client";

import { buildRiskRegisterRows, phaseLabelNb } from "@/lib/ros-risk-register";
import type { RosCellItemMatrix } from "@/lib/ros-cell-items";
import { cn } from "@/lib/utils";

type Props = {
  before: {
    rowLabels: string[];
    colLabels: string[];
    matrixValues: number[][];
    cellItems: RosCellItemMatrix;
  };
  after: {
    rowLabels: string[];
    colLabels: string[];
    matrixValues: number[][];
    cellItems: RosCellItemMatrix;
  };
  className?: string;
};

export function RosRiskRegisterTable({ before, after, className }: Props) {
  const beforeRows = buildRiskRegisterRows({
    phase: "before",
    rowLabels: before.rowLabels,
    colLabels: before.colLabels,
    matrixValues: before.matrixValues,
    cellItems: before.cellItems,
  });
  const afterRows = buildRiskRegisterRows({
    phase: "after",
    rowLabels: after.rowLabels,
    colLabels: after.colLabels,
    matrixValues: after.matrixValues,
    cellItems: after.cellItems,
  });
  const all = [...beforeRows, ...afterRows];

  if (all.length === 0) {
    return (
      <p className="text-muted-foreground text-sm leading-relaxed">
        Ingen celler med nivå eller tekstpunkter ennå. Legg inn risiko i matrisen
        (eller skriv punkter i celle før dere setter nivå) — radene dukker opp her
        automatisk.
      </p>
    );
  }

  return (
    <div className={cn("overflow-x-auto rounded-lg border", className)}>
      <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
        <thead>
          <tr className="bg-muted/50 border-b text-xs font-medium uppercase tracking-wide">
            <th className="px-3 py-2">Fase</th>
            <th className="px-3 py-2">Celle (rad × kol)</th>
            <th className="px-3 py-2 tabular-nums">Nivå</th>
            <th className="px-3 py-2">Trusler / punkter (som i ROS-tabell)</th>
          </tr>
        </thead>
        <tbody>
          {all.map((r, idx) => (
            <tr
              key={`${r.phase}-${r.row}-${r.col}-${idx}`}
              className="border-border/60 border-b last:border-b-0"
            >
              <td className="text-muted-foreground whitespace-nowrap px-3 py-2 align-top text-xs">
                {phaseLabelNb(r.phase)}
              </td>
              <td className="px-3 py-2 align-top">
                <span className="text-foreground font-medium">
                  {r.rowLabel}
                </span>
                <span className="text-muted-foreground"> × </span>
                <span className="text-foreground font-medium">
                  {r.colLabel}
                </span>
              </td>
              <td className="px-3 py-2 align-top tabular-nums font-semibold">
                {r.level}
              </td>
              <td className="text-muted-foreground px-3 py-2 align-top">
                {r.itemTexts.length > 0 ? (
                  <ul className="list-inside list-disc space-y-1">
                    {r.itemTexts.map((t, i) => (
                      <li key={i}>{t}</li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-muted-foreground/80 italic">
                    Kun nivå — åpne cellen for å legge til punkter (trussel,
                    kommentar, tiltak).
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
