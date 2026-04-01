"use client";

import { buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { cellRiskClass, legendItems } from "@/lib/ros-risk-colors";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import type { RosSummary } from "@/lib/ros-summary";
import { BarChart3, ExternalLink, GitCompare } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

type LevelCounts = readonly [number, number, number, number, number, number];

type CompareBlock = {
  analysisId: Id<"rosAnalyses">;
  title: string;
  candidateName: string;
  candidateCode: string;
  summary: RosSummary;
  levelCountsBefore: LevelCounts;
  levelCountsAfter: LevelCounts;
};

type Row = {
  analysisId: Id<"rosAnalyses">;
  title: string;
  candidateName: string;
  candidateCode: string;
};

const LEVEL_BG = [
  "bg-zinc-300/70 dark:bg-zinc-600/60",
  "bg-emerald-500",
  "bg-lime-500",
  "bg-amber-400",
  "bg-orange-500",
  "bg-red-500",
] as const;

function VerticalGroupedBarChart({
  title,
  subtitle,
  countsA,
  countsB,
  shortLabelA,
  shortLabelB,
}: {
  title: string;
  subtitle: string;
  countsA: LevelCounts;
  countsB: LevelCounts;
  shortLabelA: string;
  shortLabelB: string;
}) {
  const max = Math.max(1, ...countsA, ...countsB);
  const legend = legendItems();

  return (
    <div
      className="border-border/50 bg-card/60 space-y-3 rounded-2xl border p-4 shadow-sm"
      role="img"
      aria-label={title}
    >
      <div>
        <p className="text-foreground text-sm font-semibold tracking-tight">{title}</p>
        <p className="text-muted-foreground text-xs">{subtitle}</p>
      </div>

      <div className="flex items-end gap-2 sm:gap-3" style={{ height: "12rem" }}>
        {[0, 1, 2, 3, 4, 5].map((level) => {
          const hA = (countsA[level]! / max) * 100;
          const hB = (countsB[level]! / max) * 100;
          const lab = legend.find((x) => x.level === level)?.label ?? "";
          return (
            <div key={level} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <div className="flex w-full items-end justify-center gap-[2px] sm:gap-1" style={{ height: "9.5rem" }}>
                <div
                  className="flex w-[44%] flex-col justify-end"
                  title={`${shortLabelA}: ${countsA[level]!} (nivå ${level})`}
                >
                  <div
                    className={cn(
                      "w-full rounded-t-md shadow-sm transition-[height]",
                      LEVEL_BG[level],
                    )}
                    style={{ height: `${Math.max(hA, 3)}%`, minHeight: "3px" }}
                  />
                </div>
                <div
                  className="flex w-[44%] flex-col justify-end"
                  title={`${shortLabelB}: ${countsB[level]!} (nivå ${level})`}
                >
                  <div
                    className={cn(
                      "w-full rounded-t-md border-2 border-dashed opacity-70 transition-[height]",
                      LEVEL_BG[level],
                    )}
                    style={{ height: `${Math.max(hB, 3)}%`, minHeight: "3px" }}
                  />
                </div>
              </div>
              <div className="text-center leading-none">
                <span className="text-foreground font-mono text-xs font-bold tabular-nums">{level}</span>
                <span className="text-muted-foreground hidden text-[9px] sm:block">{lab.split(" ")[0]}</span>
              </div>
              <div className="text-muted-foreground flex gap-0.5 text-[9px] tabular-nums sm:text-[10px]">
                <span>{countsA[level]}</span>
                <span className="opacity-40">/</span>
                <span>{countsB[level]}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-border/40 flex flex-wrap items-center gap-3 border-t pt-2 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="bg-foreground/70 size-2.5 rounded-sm" aria-hidden />
          {shortLabelA} (fylt)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="border-foreground/30 size-2.5 rounded-sm border-2 border-dashed" aria-hidden />
          {shortLabelB} (stiplet)
        </span>
      </div>
    </div>
  );
}

function MaxLevelComparison({
  a,
  b,
  labelA,
  labelB,
}: {
  a: RosSummary;
  b: RosSummary;
  labelA: string;
  labelB: string;
}) {
  const rows = [
    { label: "Maks (før tiltak)", vA: a.maxBefore, vB: b.maxBefore },
    { label: "Maks (etter tiltak)", vA: a.maxAfter, vB: b.maxAfter },
    { label: "Høy-risiko celler (4–5) før", vA: a.cellsHighRiskBefore, vB: b.cellsHighRiskBefore },
    { label: "Høy-risiko celler (4–5) etter", vA: a.cellsHighRiskAfter, vB: b.cellsHighRiskAfter },
    { label: "Forbedrede celler", vA: a.cellsImproved, vB: b.cellsImproved },
    { label: "Forverrede celler", vA: a.cellsWorse, vB: b.cellsWorse },
  ];
  const maxVal = Math.max(1, ...rows.flatMap((r) => [r.vA, r.vB]));

  return (
    <div className="border-border/50 space-y-3 rounded-2xl border bg-card/60 p-4 shadow-sm">
      <p className="text-foreground text-sm font-semibold tracking-tight">Nøkkeltall (sammenligning)</p>
      <div className="space-y-3">
        {rows.map((row) => {
          const scale = Math.max(row.vA, row.vB, 1);
          return (
            <div key={row.label} className="space-y-1.5">
              <p className="text-muted-foreground text-[11px] font-medium">{row.label}</p>
              <div className="space-y-1">
                {[
                  { v: row.vA, lab: labelA },
                  { v: row.vB, lab: labelB },
                ].map((x, i) => (
                  <div key={x.lab} className="flex items-center gap-2">
                    <span className="text-muted-foreground w-20 shrink-0 truncate text-[10px]">{x.lab}</span>
                    <div className="bg-muted/60 h-2.5 flex-1 overflow-hidden rounded-full">
                      <div
                        className={cn(
                          "h-full rounded-full transition-[width]",
                          i === 0 ? "bg-primary/80" : "bg-primary/50",
                        )}
                        style={{ width: `${(x.v / scale) * 100}%` }}
                      />
                    </div>
                    <span className="text-foreground w-8 shrink-0 text-right text-xs font-bold tabular-nums">{x.v}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function RosCompareDashboardSection({
  workspaceId,
  analyses,
}: {
  workspaceId: Id<"workspaces">;
  analyses: Row[];
}) {
  const [aId, setAId] = useState<Id<"rosAnalyses"> | "">("");
  const [bId, setBId] = useState<Id<"rosAnalyses"> | "">("");

  const canCompare = aId !== "" && bId !== "" && aId !== bId;

  const data = useQuery(
    api.ros.compareRosAnalyses,
    canCompare
      ? { workspaceId, analysisIdA: aId as Id<"rosAnalyses">, analysisIdB: bId as Id<"rosAnalyses"> }
      : "skip",
  );

  const options = useMemo(
    () => [...analyses].sort((x, y) => x.title.localeCompare(y.title, "nb", { sensitivity: "base" })),
    [analyses],
  );

  const short = (r: Row) =>
    r.candidateCode
      ? `${r.title.slice(0, 18)}${r.title.length > 18 ? "…" : ""}`
      : r.title.slice(0, 22);

  const labelA = options.find((x) => x.analysisId === aId);
  const labelB = options.find((x) => x.analysisId === bId);
  const shortA = labelA ? short(labelA) : "A";
  const shortB = labelB ? short(labelB) : "B";

  if (analyses.length < 2) {
    return (
      <div className="border-border/50 bg-muted/10 rounded-2xl border border-dashed p-6 text-center">
        <BarChart3 className="text-muted-foreground mx-auto mb-2 size-8 opacity-50" aria-hidden />
        <p className="text-muted-foreground text-sm">
          Opprett minst to ROS-analyser for å sammenligne.
        </p>
      </div>
    );
  }

  return (
    <div className="border-border/60 from-primary/[0.04] space-y-5 rounded-3xl border bg-gradient-to-b via-card to-card p-5 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.12)] ring-1 ring-black/[0.04] dark:to-card dark:ring-white/[0.06] sm:p-6">
      <div>
        <h3 className="font-heading text-foreground flex items-center gap-2 text-base font-semibold tracking-tight sm:text-lg">
          <GitCompare className="text-primary size-5 shrink-0" aria-hidden />
          Sammenlign ROS-risiko
        </h3>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-relaxed">
          Velg to analyser for å se stående søylediagram per risikonivå (0–5),
          nøkkeltall og oppsummering side om side.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="ros-dash-compare-a">Analyse A</Label>
          <select
            id="ros-dash-compare-a"
            className="border-input bg-background flex h-11 w-full rounded-xl border px-3 text-sm shadow-sm"
            value={aId}
            onChange={(e) => setAId(e.target.value === "" ? "" : (e.target.value as Id<"rosAnalyses">))}
          >
            <option value="">— Velg analyse —</option>
            {options.map((r) => (
              <option key={r.analysisId} value={r.analysisId}>
                {r.title}{r.candidateCode ? ` (${r.candidateCode})` : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ros-dash-compare-b">Analyse B</Label>
          <select
            id="ros-dash-compare-b"
            className="border-input bg-background flex h-11 w-full rounded-xl border px-3 text-sm shadow-sm"
            value={bId}
            onChange={(e) => setBId(e.target.value === "" ? "" : (e.target.value as Id<"rosAnalyses">))}
          >
            <option value="">— Velg analyse —</option>
            {options.map((r) => (
              <option key={r.analysisId} value={r.analysisId}>
                {r.title}{r.candidateCode ? ` (${r.candidateCode})` : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!canCompare ? (
        <p className="text-muted-foreground text-sm">Velg to ulike analyser for å vise diagram.</p>
      ) : data === undefined ? (
        <div className="flex min-h-[12rem] items-center justify-center rounded-2xl border border-dashed bg-muted/15">
          <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : data === null ? (
        <p className="text-destructive text-sm">Kunne ikke laste sammenligning.</p>
      ) : (
        <CompareChartsInner workspaceId={workspaceId} data={data} shortA={shortA} shortB={shortB} />
      )}
    </div>
  );
}

function CompareChartsInner({
  workspaceId,
  data,
  shortA,
  shortB,
}: {
  workspaceId: Id<"workspaces">;
  data: { a: CompareBlock; b: CompareBlock };
  shortA: string;
  shortB: string;
}) {
  const { a, b } = data;

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <VerticalGroupedBarChart
          title="Fordeling før tiltak"
          subtitle="Antall matriseceller per risikonivå"
          countsA={a.levelCountsBefore}
          countsB={b.levelCountsBefore}
          shortLabelA={shortA}
          shortLabelB={shortB}
        />
        <VerticalGroupedBarChart
          title="Fordeling etter tiltak"
          subtitle="Residual risiko etter tiltak"
          countsA={a.levelCountsAfter}
          countsB={b.levelCountsAfter}
          shortLabelA={shortA}
          shortLabelB={shortB}
        />
      </div>

      <MaxLevelComparison a={a.summary} b={b.summary} labelA={shortA} labelB={shortB} />

      <div className="border-border/40 rounded-xl border bg-muted/20 px-4 py-3">
        <p className="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">
          Oppsummering
        </p>
        <div className="mt-2 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-foreground mb-1 text-xs font-semibold">{shortA}</p>
            <ul className="text-muted-foreground space-y-0.5 text-xs leading-relaxed">
              {a.summary.summaryLines.map((line, i) => <li key={i}>{line}</li>)}
            </ul>
          </div>
          <div>
            <p className="text-foreground mb-1 text-xs font-semibold">{shortB}</p>
            <ul className="text-muted-foreground space-y-0.5 text-xs leading-relaxed">
              {b.summary.summaryLines.map((line, i) => <li key={i}>{line}</li>)}
            </ul>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href={`/w/${workspaceId}/ros/a/${a.analysisId}`}
          className={buttonVariants({ variant: "outline", size: "sm", className: "gap-1.5" })}
        >
          Åpne A <ExternalLink className="size-3.5 opacity-70" />
        </Link>
        <Link
          href={`/w/${workspaceId}/ros/a/${b.analysisId}`}
          className={buttonVariants({ variant: "outline", size: "sm", className: "gap-1.5" })}
        >
          Åpne B <ExternalLink className="size-3.5 opacity-70" />
        </Link>
      </div>
    </div>
  );
}
