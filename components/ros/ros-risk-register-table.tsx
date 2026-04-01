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
import { cn } from "@/lib/utils";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ChevronDown,
  Equal,
  Minus,
  Plus,
  TrendingDown,
  TrendingUp,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
} from "lucide-react";
import { useState } from "react";

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
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div className="flex items-center gap-3 rounded-2xl bg-muted/20 px-4 py-3.5 ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <ShieldCheck className="size-5 text-primary" />
        </div>
        <div>
          <p className="text-2xl font-bold tabular-nums leading-none">{s.total}</p>
          <p className="text-muted-foreground mt-0.5 text-[11px]">Identifisert</p>
        </div>
      </div>

      <div className={cn(
        "flex items-center gap-3 rounded-2xl px-4 py-3.5 ring-1",
        s.improved > 0
          ? "bg-emerald-500/[0.06] ring-emerald-500/15"
          : "bg-muted/20 ring-black/[0.04] dark:ring-white/[0.06]",
      )}>
        <div className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-xl",
          s.improved > 0 ? "bg-emerald-500/15" : "bg-muted/30",
        )}>
          <TrendingDown className={cn("size-5", s.improved > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")} />
        </div>
        <div>
          <p className="text-2xl font-bold tabular-nums leading-none">{s.improved}</p>
          <p className="text-muted-foreground mt-0.5 text-[11px]">Redusert</p>
        </div>
      </div>

      <div className={cn(
        "flex items-center gap-3 rounded-2xl px-4 py-3.5 ring-1",
        s.worse > 0
          ? "bg-red-500/[0.06] ring-red-500/15"
          : "bg-emerald-500/[0.06] ring-emerald-500/15",
      )}>
        <div className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-xl",
          s.worse > 0 ? "bg-red-500/15" : "bg-emerald-500/15",
        )}>
          {s.worse > 0
            ? <TrendingUp className="size-5 text-red-600 dark:text-red-400" />
            : <ShieldCheck className="size-5 text-emerald-600 dark:text-emerald-400" />
          }
        </div>
        <div>
          <p className="text-2xl font-bold tabular-nums leading-none">{s.worse}</p>
          <p className="text-muted-foreground mt-0.5 text-[11px]">Økt risiko</p>
        </div>
      </div>

      <div className={cn(
        "flex items-center gap-3 rounded-2xl px-4 py-3.5 ring-1",
        s.highAfter > 0
          ? "bg-orange-500/[0.06] ring-orange-500/15"
          : "bg-emerald-500/[0.06] ring-emerald-500/15",
      )}>
        <div className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-xl",
          s.highAfter > 0 ? "bg-orange-500/15" : "bg-emerald-500/15",
        )}>
          {s.highAfter > 0
            ? <ShieldAlert className="size-5 text-orange-600 dark:text-orange-400" />
            : <ShieldCheck className="size-5 text-emerald-600 dark:text-emerald-400" />
          }
        </div>
        <div>
          <p className="text-2xl font-bold tabular-nums leading-none">
            {s.highAfter}
            {s.highBefore > 0 && s.highBefore !== s.highAfter ? (
              <span className="text-muted-foreground ml-1 text-sm font-normal">(var {s.highBefore})</span>
            ) : null}
          </p>
          <p className="text-muted-foreground mt-0.5 text-[11px]">Høy etter</p>
        </div>
      </div>
    </div>
  );
}

function RiskCard({ row }: { row: PairedRiskRegisterRow }) {
  const [expanded, setExpanded] = useState(false);
  const hasActionFlag = [
    ...row.beforeItems,
    ...row.afterItems,
  ].some((it) => it.flags?.includes(ROS_CELL_FLAG_REQUIRES_ACTION));
  const isHighAfter = row.afterLevel >= 4;
  const hasTexts = row.beforeTexts.length > 0 || row.afterTexts.length > 0;

  const borderClass =
    row.deltaKind === "improved" ? "border-l-emerald-500"
    : row.deltaKind === "worse" ? "border-l-red-500"
    : isHighAfter && !hasActionFlag ? "border-l-orange-500"
    : "border-l-transparent";

  return (
    <div className={cn(
      "overflow-hidden rounded-2xl border-l-[3px] bg-card shadow-sm ring-1 ring-black/[0.04] transition-all duration-200 hover:shadow-md dark:ring-white/[0.06]",
      borderClass,
    )}>
      <button
        type="button"
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left sm:gap-4"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Before level */}
        <div className="flex shrink-0 items-center gap-2">
          <span className={cn(
            "inline-flex size-9 items-center justify-center rounded-xl text-sm font-bold tabular-nums",
            levelBadgeClass(row.beforeLevel),
          )}>
            {row.beforeLevel || "–"}
          </span>
          <ArrowRight className={cn(
            "size-4 shrink-0",
            row.deltaKind === "improved" ? "text-emerald-500" : row.deltaKind === "worse" ? "text-red-500" : "text-muted-foreground/30",
          )} />
          <span className={cn(
            "inline-flex size-9 items-center justify-center rounded-xl text-sm font-bold tabular-nums",
            levelBadgeClass(row.afterLevel),
          )}>
            {row.afterLevel || "–"}
          </span>
        </div>

        {/* Risk info */}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">
            {row.rowLabel} × {row.colLabel}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <DeltaIndicator row={row} />
            {isHighAfter && !hasActionFlag && (
              <span className="inline-flex items-center gap-0.5 rounded-md bg-orange-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-orange-600 dark:text-orange-400">
                <AlertTriangle className="size-2.5" />
                Mangler handling
              </span>
            )}
          </div>
        </div>

        {hasTexts && (
          <ChevronDown className={cn(
            "size-4 shrink-0 text-muted-foreground/50 transition-transform duration-200",
            expanded && "rotate-180",
          )} />
        )}
      </button>

      {expanded && hasTexts && (
        <div className="space-y-3 border-t border-border/30 px-4 py-3.5">
          {row.beforeTexts.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Før tiltak</p>
              <ul className="mt-1 space-y-0.5">
                {row.beforeTexts.map((t, i) => (
                  <li key={i} className="text-sm text-muted-foreground">• {t}</li>
                ))}
              </ul>
            </div>
          )}
          {row.afterTexts.length > 0 && (
            <div>
              <p className={cn(
                "text-[10px] font-bold uppercase tracking-wider",
                row.deltaKind === "improved" ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
              )}>Etter tiltak</p>
              <ul className="mt-1 space-y-0.5">
                {row.afterTexts.map((t, i) => (
                  <li key={i} className="text-sm text-muted-foreground">• {t}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PairedCards({ rows }: { rows: PairedRiskRegisterRow[] }) {
  if (rows.length === 0) return null;

  return (
    <div className="space-y-2">
      {rows.map((r, idx) => (
        <RiskCard key={`${r.row}-${r.col}-${idx}`} row={r} />
      ))}
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
    <div className={cn("space-y-2", className)}>
      {all.map((r, idx) => (
        <div
          key={`${r.phase}-${r.row}-${r.col}-${idx}`}
          className="flex items-center gap-3 rounded-xl bg-card px-4 py-3 shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06]"
        >
          <span className={cn(
            "inline-flex size-9 items-center justify-center rounded-xl text-sm font-bold tabular-nums",
            levelBadgeClass(r.level),
          )}>
            {r.level}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">
              {r.rowLabel} × {r.colLabel}
            </p>
            <p className="text-muted-foreground text-xs">
              {phaseLabelNb(r.phase)}
              {r.itemTexts.length > 0 ? ` · ${r.itemTexts.join(", ")}` : ""}
            </p>
          </div>
        </div>
      ))}
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
        Ingen risikoer registrert ennå. Legg inn risiko under &laquo;Risikoer&raquo; &mdash;
        oversikten oppdateres automatisk.
      </p>
    );
  }

  if (sameLayout && pairedRows.length > 0) {
    return (
      <div className={cn("space-y-5", className)}>
        <SummaryCards rows={pairedRows} />
        <PairedCards rows={pairedRows} />
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
