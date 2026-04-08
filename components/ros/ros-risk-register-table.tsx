"use client";

import {
  buildRiskRegisterRows,
  buildPairedRiskRegisterRows,
  computeMatrixItemStats,
  maxMatrixLevel,
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
import { useState, type ReactNode } from "react";

type Props = {
  sameLayout: boolean;
  /** Aksetitler — forklarer sannsynlighet (rad) og konsekvens (kolonne) */
  rowAxisTitle?: string;
  colAxisTitle?: string;
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

function KpiTile({
  icon,
  value,
  label,
  hint,
  tone,
}: {
  icon: ReactNode;
  value: ReactNode;
  label: string;
  hint?: string;
  tone: "neutral" | "success" | "warn" | "danger";
}) {
  const shell =
    tone === "danger"
      ? "bg-red-500/[0.06] ring-red-500/15"
      : tone === "warn"
        ? "bg-amber-500/[0.06] ring-amber-500/15"
        : tone === "success"
          ? "bg-emerald-500/[0.06] ring-emerald-500/15"
          : "bg-muted/25 ring-black/[0.04] dark:ring-white/[0.06]";
  const iconWrap =
    tone === "danger"
      ? "bg-red-500/15 text-red-600 dark:text-red-400"
      : tone === "warn"
        ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
        : tone === "success"
          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
          : "bg-primary/10 text-primary";

  return (
    <div
      className={cn(
        "flex min-h-[4.25rem] min-w-0 items-start gap-3 rounded-2xl px-3.5 py-3 ring-1 sm:min-h-0 sm:items-center sm:px-4 sm:py-3.5",
        shell,
      )}
    >
      <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", iconWrap)}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-2xl font-bold tabular-nums leading-none tracking-tight">{value}</p>
        <p className="text-muted-foreground mt-1 text-[11px] font-medium leading-tight">{label}</p>
        {hint ? (
          <p className="text-muted-foreground/90 mt-0.5 text-[10px] leading-snug">{hint}</p>
        ) : null}
      </div>
    </div>
  );
}

function OverviewIntro({
  rowAxisTitle,
  colAxisTitle,
  maxBefore,
  maxAfter,
}: {
  rowAxisTitle: string;
  colAxisTitle: string;
  maxBefore: number;
  maxAfter: number;
}) {
  const beforeLabel =
    maxBefore >= 5 ? "Kritisk" : maxBefore >= 4 ? "Høy" : maxBefore >= 3 ? "Middels" : maxBefore >= 2 ? "Lav" : "Svært lav";
  const afterLabel =
    maxAfter >= 5 ? "Kritisk" : maxAfter >= 4 ? "Høy" : maxAfter >= 3 ? "Middels" : maxAfter >= 2 ? "Lav" : maxAfter <= 0 ? "—" : "Svært lav";

  return (
    <div className="space-y-4 rounded-2xl border border-border/60 bg-gradient-to-br from-muted/30 via-card/80 to-card p-4 shadow-sm ring-1 ring-black/[0.04] dark:from-muted/15 dark:ring-white/[0.06] sm:p-5">
      <div className="space-y-2">
        <h2 className="font-heading text-lg font-semibold tracking-tight text-foreground sm:text-xl">
          Risiko og konsekvens
        </h2>
        <p className="text-muted-foreground max-w-prose text-sm leading-relaxed">
          <span className="text-foreground font-medium">{rowAxisTitle}</span> på raden og{" "}
          <span className="text-foreground font-medium">{colAxisTitle}</span> i kolonnen definerer
          hvert kryss. Nivået oppsummerer risiko for den kombinasjonen — før og etter tiltak.
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/50 bg-background/60 px-3 py-2.5 text-sm shadow-sm">
          <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
            Høyeste i matrisen
          </span>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-bold tabular-nums",
              levelBadgeClass(maxBefore),
            )}
          >
            Før {maxBefore}
            <span className="text-[10px] font-semibold opacity-80">{beforeLabel}</span>
          </span>
          <ArrowRight className="text-muted-foreground size-4 shrink-0" aria-hidden />
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-bold tabular-nums",
              maxAfter > 0 ? levelBadgeClass(maxAfter) : "bg-muted text-muted-foreground",
            )}
          >
            Etter {maxAfter > 0 ? maxAfter : "—"}
            {maxAfter > 0 ? (
              <span className="text-[10px] font-semibold opacity-80">{afterLabel}</span>
            ) : null}
          </span>
        </div>
        {maxBefore > maxAfter && maxAfter > 0 ? (
          <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
            Restrisiko lavere enn utgangspunktet
          </span>
        ) : null}
        {maxAfter > maxBefore ? (
          <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
            Høyeste viste nivå er høyere etter tiltak i minst én celle — sjekk begrunnelse
          </span>
        ) : null}
      </div>
    </div>
  );
}

function OverviewKpis({
  rows,
  before,
  after,
  rowAxisTitle,
  colAxisTitle,
}: {
  rows: PairedRiskRegisterRow[];
  before: Props["before"];
  after: Props["after"];
  rowAxisTitle: string;
  colAxisTitle: string;
}) {
  const cellStats = pairedSummaryStats(rows);
  const itemStats = computeMatrixItemStats(
    before.cellItems,
    before.rowLabels,
    before.colLabels,
    after.rowLabels,
    after.colLabels,
  );
  const maxBefore = maxMatrixLevel(before.matrixValues);
  const maxAfter = maxMatrixLevel(after.matrixValues);

  const hasAny =
    cellStats.total > 0 ||
    itemStats.textItemCount > 0 ||
    maxBefore > 0 ||
    maxAfter > 0;
  if (!hasAny) return null;

  return (
    <div className="space-y-6">
      <OverviewIntro
        rowAxisTitle={rowAxisTitle}
        colAxisTitle={colAxisTitle}
        maxBefore={maxBefore}
        maxAfter={maxAfter}
      />

      <div className="space-y-3">
        <div>
          <p className="text-muted-foreground text-[11px] font-semibold uppercase tracking-wider">
            Risikopunkter
          </p>
          <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
            Tall basert på beskrevne punkter i matrisen (samme som under «Risikoer»).
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4">
          <KpiTile
            tone="neutral"
            icon={<ShieldCheck className="size-5" />}
            value={itemStats.textItemCount}
            label="Beskrevne punkter"
            hint="Med fritekst i cellen"
          />
          <KpiTile
            tone={itemStats.highOrCriticalBefore > 0 ? "danger" : "success"}
            icon={
              itemStats.highOrCriticalBefore > 0 ? (
                <ShieldAlert className="size-5" />
              ) : (
                <ShieldCheck className="size-5" />
              )
            }
            value={itemStats.highOrCriticalBefore}
            label="Høy eller kritisk (før)"
            hint="Nivå 4–5 før tiltak"
          />
          <KpiTile
            tone={itemStats.needsAction > 0 ? "warn" : "neutral"}
            icon={<AlertTriangle className="size-5" />}
            value={itemStats.needsAction}
            label="Mangler «krever handling»"
            hint="Høy risiko uten flagg"
          />
          <KpiTile
            tone={itemStats.highAfter > 0 ? "warn" : "success"}
            icon={
              itemStats.highAfter > 0 ? (
                <ShieldAlert className="size-5" />
              ) : (
                <ShieldCheck className="size-5" />
              )
            }
            value={itemStats.highAfter}
            label="Høy rest (punkter)"
            hint="Restrisiko ≥ 4 for punktet"
          />
        </div>
      </div>

      {rows.length > 0 ? (
      <div className="space-y-3">
        <div>
          <p className="text-muted-foreground text-[11px] font-semibold uppercase tracking-wider">
            Matriseposisjoner (før → etter)
          </p>
          <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
            Én rad per celle som har innhold eller nivå — sammenligning av cellenivå før og etter tiltak.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4">
          <KpiTile
            tone="neutral"
            icon={<ShieldCheck className="size-5" />}
            value={cellStats.total}
            label="Aktive celler"
            hint="Med data eller nivå"
          />
          <KpiTile
            tone={cellStats.improved > 0 ? "success" : "neutral"}
            icon={<TrendingDown className="size-5" />}
            value={cellStats.improved}
            label="Lavere nivå etter"
            hint="Risikoreduksjon"
          />
          <KpiTile
            tone={cellStats.worse > 0 ? "danger" : "success"}
            icon={
              cellStats.worse > 0 ? (
                <TrendingUp className="size-5" />
              ) : (
                <ShieldCheck className="size-5" />
              )
            }
            value={cellStats.worse}
            label="Høyere nivå etter"
            hint="Krever forklaring"
          />
          <KpiTile
            tone={cellStats.highAfter > 0 ? "warn" : "success"}
            icon={
              cellStats.highAfter > 0 ? (
                <ShieldAlert className="size-5" />
              ) : (
                <ShieldCheck className="size-5" />
              )
            }
            value={
              <>
                {cellStats.highAfter}
                {cellStats.highBefore > 0 && cellStats.highBefore !== cellStats.highAfter ? (
                  <span className="text-muted-foreground ml-1 text-base font-normal">
                    (var {cellStats.highBefore})
                  </span>
                ) : null}
              </>
            }
            label="Høy/kritisk etter (celler)"
            hint="Celle med nivå ≥ 4"
          />
        </div>
      </div>
      ) : null}
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
        className="flex w-full flex-col gap-3 px-4 py-4 text-left sm:flex-row sm:items-center sm:gap-4 sm:py-3.5"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        {/* Before level */}
        <div className="flex w-full shrink-0 items-center justify-between gap-2 sm:w-auto sm:justify-start">
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
        <div className="min-w-0 w-full flex-1 sm:w-auto">
          <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wide">
            Plassering (rad × kolonne)
          </p>
          <p className="mt-0.5 break-words text-sm font-medium leading-snug">
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
            "size-4 shrink-0 self-end text-muted-foreground/50 transition-transform duration-200 sm:self-center",
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
  rowAxisTitle,
  colAxisTitle,
  before,
  after,
  className,
}: Props) {
  const rowTitle = rowAxisTitle?.trim() || "Rad (sannsynlighet)";
  const colTitle = colAxisTitle?.trim() || "Kolonne (konsekvens)";

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

  if (sameLayout) {
    return (
      <div className={cn("space-y-8", className)}>
        <OverviewKpis
          rows={pairedRows}
          before={before}
          after={after}
          rowAxisTitle={rowTitle}
          colAxisTitle={colTitle}
        />
        {pairedRows.length > 0 ? (
          <div className="space-y-3">
            <h3 className="font-heading text-foreground text-base font-semibold tracking-tight">
              Detaljer per celle
            </h3>
            <p className="text-muted-foreground -mt-1 text-xs leading-relaxed">
              Trykk en rad for å lese beskrivelser. «Før» og «etter» viser samme celle i matrisen.
            </p>
            <PairedCards rows={pairedRows} />
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className={cn("space-y-5", className)}>
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
        Før- og etter-matrisen har <strong>ulike akser</strong>. Listen under viser hver fase for seg
        — sammenligning krever lik rutenett-layout.
      </div>
      <OverviewKpis
        rows={[]}
        before={before}
        after={after}
        rowAxisTitle={rowTitle}
        colAxisTitle={colTitle}
      />
      <div className="space-y-2">
        <h3 className="font-heading text-foreground text-base font-semibold tracking-tight">
          Alle aktive celler
        </h3>
        <FlatTable before={before} after={after} />
      </div>
    </div>
  );
}
