"use client";

import {
  buildRiskRegisterRows,
  buildPairedRiskRegisterRows,
  pairedSummaryStats,
  phaseLabelNb,
  type PairedRiskRegisterRow,
} from "@/lib/ros-risk-register";
import type { RosCellItemMatrix } from "@/lib/ros-cell-items";
import { ROS_CELL_FLAG_REQUIRES_ACTION } from "@/lib/ros-cell-items";
import { legendItems } from "@/lib/ros-risk-colors";
import { cn } from "@/lib/utils";
import {
  ArrowDown,
  ArrowUp,
  Equal,
  Minus,
  Plus,
  TrendingDown,
  TrendingUp,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
} from "lucide-react";

type Props = {
  sameLayout: boolean;
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

const riskLegend = legendItems();

function levelLabel(level: number): string {
  return riskLegend.find((l) => l.level === level)?.label ?? `${level}`;
}

function levelBadgeClass(level: number): string {
  switch (level) {
    case 0: return "bg-muted text-muted-foreground";
    case 1: return "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300";
    case 2: return "bg-lime-500/20 text-lime-700 dark:text-lime-300";
    case 3: return "bg-amber-400/25 text-amber-700 dark:text-amber-300";
    case 4: return "bg-orange-500/25 text-orange-700 dark:text-orange-300";
    case 5: return "bg-red-500/30 text-red-700 dark:text-red-300";
    default: return "bg-muted text-muted-foreground";
  }
}

function DeltaIndicator({ row }: { row: PairedRiskRegisterRow }) {
  const { delta, deltaKind } = row;
  switch (deltaKind) {
    case "improved":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
          <ArrowDown className="size-3" />
          {delta}
        </span>
      );
    case "worse":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-semibold text-red-700 dark:text-red-300">
          <ArrowUp className="size-3" />
          +{delta}
        </span>
      );
    case "unchanged":
      return (
        <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
          <Equal className="size-3" />
          Uendret
        </span>
      );
    case "new":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/15 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:text-blue-300">
          <Plus className="size-3" />
          Ny
        </span>
      );
    case "removed":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-500/15 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
          <Minus className="size-3" />
          Fjernet
        </span>
      );
  }
}

function SummaryCards({ rows }: { rows: PairedRiskRegisterRow[] }) {
  const s = pairedSummaryStats(rows);
  if (s.total === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <div className="rounded-lg border p-3">
        <p className="text-muted-foreground text-xs font-medium">Totalt identifisert</p>
        <p className="text-foreground mt-1 text-2xl font-bold tabular-nums">{s.total}</p>
      </div>

      {s.improved > 0 ? (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] p-3">
          <p className="flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
            <TrendingDown className="size-3.5" />
            Redusert
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
            {s.improved}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border p-3">
          <p className="text-muted-foreground flex items-center gap-1 text-xs font-medium">
            <TrendingDown className="size-3.5" />
            Redusert
          </p>
          <p className="text-muted-foreground mt-1 text-2xl font-bold tabular-nums">0</p>
        </div>
      )}

      {s.worse > 0 ? (
        <div className="rounded-lg border border-red-500/20 bg-red-500/[0.04] p-3">
          <p className="flex items-center gap-1 text-xs font-medium text-red-700 dark:text-red-400">
            <TrendingUp className="size-3.5" />
            Økt risiko
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-red-700 dark:text-red-300">
            {s.worse}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] p-3">
          <p className="flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
            <ShieldCheck className="size-3.5" />
            Økt risiko
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-300">0</p>
        </div>
      )}

      {s.highAfter > 0 ? (
        <div className="rounded-lg border border-orange-500/20 bg-orange-500/[0.04] p-3">
          <p className="flex items-center gap-1 text-xs font-medium text-orange-700 dark:text-orange-400">
            <ShieldAlert className="size-3.5" />
            Høy etter tiltak
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-orange-700 dark:text-orange-300">
            {s.highAfter}
            {s.highBefore > 0 ? (
              <span className="text-muted-foreground ml-1 text-sm font-normal">
                (var {s.highBefore})
              </span>
            ) : null}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] p-3">
          <p className="flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
            <ShieldCheck className="size-3.5" />
            Høy etter tiltak
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
            0
            {s.highBefore > 0 ? (
              <span className="ml-1 text-sm font-normal text-emerald-600 dark:text-emerald-400">
                (var {s.highBefore})
              </span>
            ) : null}
          </p>
        </div>
      )}
    </div>
  );
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

function CellDescription({ row: r }: { row: PairedRiskRegisterRow }) {
  const hasBefore = r.beforeTexts.length > 0;
  const hasAfter = r.afterTexts.length > 0;

  if (!hasBefore && !hasAfter) {
    return (
      <span className="text-muted-foreground/60 italic">Kun nivå</span>
    );
  }

  const textsIdentical = hasBefore && hasAfter && arraysEqual(r.beforeTexts, r.afterTexts);
  const deltaLabel =
    r.deltaKind === "improved"
      ? `Risiko redusert fra ${r.beforeLevel} → ${r.afterLevel}`
      : r.deltaKind === "worse"
        ? `Risiko økt fra ${r.beforeLevel} → ${r.afterLevel}`
        : r.deltaKind === "new"
          ? "Ny risiko etter tiltak"
          : r.deltaKind === "removed"
            ? "Fjernet etter tiltak"
            : null;

  if (textsIdentical) {
    return (
      <div className="space-y-1">
        <ul className="list-inside list-disc">
          {r.beforeTexts.map((t, i) => (
            <li key={i} className="truncate">{t}</li>
          ))}
        </ul>
        {deltaLabel ? (
          <p className={cn(
            "text-[10px] font-medium",
            r.deltaKind === "improved" ? "text-emerald-600 dark:text-emerald-400" :
            r.deltaKind === "worse" ? "text-red-600 dark:text-red-400" :
            "text-muted-foreground",
          )}>
            {deltaLabel}
          </p>
        ) : (
          <p className="text-muted-foreground/60 text-[10px]">
            Samme beskrivelse og nivå
          </p>
        )}
      </div>
    );
  }

  const addedTexts = hasAfter
    ? r.afterTexts.filter((t) => !r.beforeTexts.includes(t))
    : [];
  const removedTexts = hasBefore
    ? r.beforeTexts.filter((t) => !r.afterTexts.includes(t))
    : [];
  const keptTexts = hasBefore && hasAfter
    ? r.beforeTexts.filter((t) => r.afterTexts.includes(t))
    : [];

  return (
    <div className="space-y-1.5">
      {keptTexts.length > 0 ? (
        <ul className="list-inside list-disc">
          {keptTexts.map((t, i) => (
            <li key={i} className="truncate">{t}</li>
          ))}
        </ul>
      ) : null}
      {removedTexts.length > 0 ? (
        <div>
          <span className="text-red-600/80 dark:text-red-400/80 text-[10px] font-semibold">
            Fjernet:
          </span>
          <ul className="mt-0.5 list-inside list-disc text-red-600/70 line-through dark:text-red-400/70">
            {removedTexts.map((t, i) => (
              <li key={i} className="truncate">{t}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {addedTexts.length > 0 ? (
        <div>
          <span className="text-emerald-600/80 dark:text-emerald-400/80 text-[10px] font-semibold">
            Lagt til etter tiltak:
          </span>
          <ul className="mt-0.5 list-inside list-disc text-emerald-700/80 dark:text-emerald-300/80">
            {addedTexts.map((t, i) => (
              <li key={i} className="truncate">{t}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {!hasBefore && hasAfter ? (
        r.afterTexts.map((t, i) => (
          <span key={i} className="block truncate">{t}</span>
        ))
      ) : null}
      {hasBefore && !hasAfter ? (
        <div>
          <span className="text-[10px] font-semibold text-muted-foreground">Kun før:</span>
          <ul className="mt-0.5 list-inside list-disc">
            {r.beforeTexts.map((t, i) => (
              <li key={i} className="truncate">{t}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {deltaLabel ? (
        <p className={cn(
          "text-[10px] font-medium",
          r.deltaKind === "improved" ? "text-emerald-600 dark:text-emerald-400" :
          r.deltaKind === "worse" ? "text-red-600 dark:text-red-400" :
          r.deltaKind === "new" ? "text-blue-600 dark:text-blue-400" :
          "text-muted-foreground",
        )}>
          {deltaLabel}
        </p>
      ) : null}
    </div>
  );
}

function PairedTable({
  rows,
  className,
}: {
  rows: PairedRiskRegisterRow[];
  className?: string;
}) {
  if (rows.length === 0) return null;

  return (
    <div className={cn("overflow-x-auto rounded-lg border", className)}>
      <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
        <thead>
          <tr className="bg-muted/50 border-b text-xs font-medium uppercase tracking-wide">
            <th className="px-3 py-2">Risiko (celle)</th>
            <th className="px-3 py-2 text-center">Før</th>
            <th className="px-3 py-2 text-center">→</th>
            <th className="px-3 py-2 text-center">Etter</th>
            <th className="px-3 py-2 text-center">Endring</th>
            <th className="px-3 py-2">Beskrivelse</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => {
            const hasActionFlag = [
              ...r.beforeItems,
              ...r.afterItems,
            ].some((it) => it.flags?.includes(ROS_CELL_FLAG_REQUIRES_ACTION));
            const isHighAfter = r.afterLevel >= 4;

            return (
              <tr
                key={`${r.row}-${r.col}-${idx}`}
                className={cn(
                  "border-border/60 border-b last:border-b-0",
                  isHighAfter && !hasActionFlag && "bg-red-500/[0.03]",
                )}
              >
                <td className="px-3 py-2.5 align-top">
                  <span className="text-foreground text-sm font-medium">
                    {r.rowLabel}
                  </span>
                  <span className="text-muted-foreground"> × </span>
                  <span className="text-foreground text-sm font-medium">
                    {r.colLabel}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-center align-top">
                  {r.beforeLevel > 0 ? (
                    <span
                      className={cn(
                        "inline-flex min-w-[2rem] items-center justify-center rounded-md px-1.5 py-0.5 text-xs font-bold tabular-nums",
                        levelBadgeClass(r.beforeLevel),
                      )}
                    >
                      {r.beforeLevel}
                    </span>
                  ) : (
                    <span className="text-muted-foreground/50 text-xs">–</span>
                  )}
                </td>
                <td className="text-muted-foreground px-1 py-2.5 text-center align-top text-xs">
                  →
                </td>
                <td className="px-3 py-2.5 text-center align-top">
                  {r.afterLevel > 0 ? (
                    <span
                      className={cn(
                        "inline-flex min-w-[2rem] items-center justify-center rounded-md px-1.5 py-0.5 text-xs font-bold tabular-nums",
                        levelBadgeClass(r.afterLevel),
                      )}
                    >
                      {r.afterLevel}
                    </span>
                  ) : (
                    <span className="text-muted-foreground/50 text-xs">–</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-center align-top">
                  <DeltaIndicator row={r} />
                </td>
                <td className="text-muted-foreground max-w-[24rem] px-3 py-2.5 align-top text-xs">
                  <CellDescription row={r} />
                  {isHighAfter && !hasActionFlag ? (
                    <span className="mt-1 flex items-center gap-1 text-[10px] font-medium text-orange-600 dark:text-orange-400">
                      <AlertTriangle className="size-3" />
                      Mangler «krever handling»
                    </span>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function FlatTable({
  before,
  after,
  className,
}: {
  before: Props["before"];
  after: Props["after"];
  className?: string;
}) {
  const beforeRows = buildRiskRegisterRows({
    phase: "before",
    ...before,
  });
  const afterRows = buildRiskRegisterRows({
    phase: "after",
    ...after,
  });
  const all = [...beforeRows, ...afterRows];

  if (all.length === 0) return null;

  return (
    <div className={cn("overflow-x-auto rounded-lg border", className)}>
      <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
        <thead>
          <tr className="bg-muted/50 border-b text-xs font-medium uppercase tracking-wide">
            <th className="px-3 py-2">Fase</th>
            <th className="px-3 py-2">Celle (rad × kol)</th>
            <th className="px-3 py-2 tabular-nums">Nivå</th>
            <th className="px-3 py-2">Trusler / punkter</th>
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
                <span className="text-foreground font-medium">{r.rowLabel}</span>
                <span className="text-muted-foreground"> × </span>
                <span className="text-foreground font-medium">{r.colLabel}</span>
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
                    Kun nivå
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

export function RosRiskRegisterTable({
  sameLayout,
  before,
  after,
  className,
}: Props) {
  const pairedRows = sameLayout
    ? buildPairedRiskRegisterRows({
        rowLabels: before.rowLabels,
        colLabels: before.colLabels,
        matrixBefore: before.matrixValues,
        matrixAfter: after.matrixValues,
        cellItemsBefore: before.cellItems,
        cellItemsAfter: after.cellItems,
      })
    : [];

  const hasAnyContent =
    pairedRows.length > 0 ||
    before.matrixValues.some((row) => row.some((v) => v > 0)) ||
    after.matrixValues.some((row) => row.some((v) => v > 0));

  if (!hasAnyContent) {
    return (
      <p className="text-muted-foreground text-sm leading-relaxed">
        Ingen celler med nivå eller tekstpunkter ennå. Legg inn risiko i matrisen —
        registeret oppdateres automatisk.
      </p>
    );
  }

  if (sameLayout && pairedRows.length > 0) {
    return (
      <div className={cn("space-y-4", className)}>
        <SummaryCards rows={pairedRows} />
        <PairedTable rows={pairedRows} />
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <p className="text-muted-foreground text-xs leading-relaxed">
        Før- og etter-matrisen har ulike akser — viser separat liste per fase.
      </p>
      <FlatTable before={before} after={after} className={className} />
    </div>
  );
}
