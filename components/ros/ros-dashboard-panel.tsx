"use client";

import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { cellRiskClass, legendItems } from "@/lib/ros-risk-colors";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import { Label } from "@/components/ui/label";
import {
  AlertTriangle,
  BarChart3,
  CalendarClock,
  ExternalLink,
  Shield,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { RosCompareDashboardSection } from "@/components/ros/ros-compare-risk-charts";

function formatTs(ms: number) {
  try {
    return new Intl.DateTimeFormat("nb-NO", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(ms));
  } catch {
    return String(ms);
  }
}

function nextReviewPresentation(ms: number | undefined | null): {
  text: string;
  className: string;
} {
  if (ms == null) return { text: "Ikke satt", className: "text-muted-foreground" };
  const now = Date.now();
  if (ms < now) return { text: `Forfalt · ${formatTs(ms)}`, className: "text-destructive font-medium" };
  const days = (ms - now) / 86_400_000;
  if (days <= 14) {
    return {
      text: days <= 1 ? `Snart · ${formatTs(ms)}` : `Om ${Math.ceil(days)} d · ${formatTs(ms)}`,
      className: "text-amber-800 dark:text-amber-200",
    };
  }
  return { text: formatTs(ms), className: "text-muted-foreground" };
}

const LEVEL_COLORS = [
  "bg-zinc-300/60 dark:bg-zinc-600/50",
  "bg-emerald-500",
  "bg-lime-500",
  "bg-amber-400",
  "bg-orange-500",
  "bg-red-500",
] as const;

type Counts6 = readonly [number, number, number, number, number, number];

function KpiCard({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: "default" | "danger" | "warn" | "success";
}) {
  return (
    <div
      className={cn(
        "relative flex flex-col rounded-2xl border px-4 py-3.5 shadow-sm",
        tone === "danger" && "border-red-500/30 bg-red-500/[0.06]",
        tone === "warn" && "border-amber-500/30 bg-amber-500/[0.06]",
        tone === "success" && "border-emerald-500/25 bg-emerald-500/[0.04]",
        tone === "default" && "border-border/50 bg-card",
      )}
    >
      <span className="text-muted-foreground text-[10px] font-semibold uppercase tracking-[0.12em]">
        {label}
      </span>
      <span className="font-heading text-2xl font-bold tabular-nums tracking-tight text-foreground sm:text-[1.75rem]">
        {value}
      </span>
      {sub ? <span className="text-muted-foreground mt-0.5 text-[11px] leading-snug">{sub}</span> : null}
    </div>
  );
}

function VerticalStackedBarChart({
  analyses,
  workspaceId,
}: {
  analyses: Array<{
    analysisId: Id<"rosAnalyses">;
    title: string;
    candidateCode: string;
    counts: Counts6;
    maxLevel: number;
  }>;
  workspaceId: Id<"workspaces">;
}) {
  const legend = legendItems();
  const maxTotal = Math.max(1, ...analyses.map((a) => a.counts.reduce((s, v) => s + v, 0)));

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-foreground flex items-center gap-2 text-sm font-semibold tracking-tight">
          <BarChart3 className="size-4 text-primary" aria-hidden />
          Risikofordeling per analyse
        </h3>
        <p className="text-muted-foreground mt-0.5 text-xs">
          Stående stablede søyler — én per ROS-analyse. Hver farge representerer et risikonivå.
        </p>
      </div>

      <div className="flex items-end gap-1 overflow-x-auto pb-2 [scrollbar-width:thin]" style={{ minHeight: "16rem" }}>
        {analyses.map((a) => {
          const total = a.counts.reduce((s, v) => s + v, 0);
          const barH = total > 0 ? (total / maxTotal) * 100 : 0;
          return (
            <Link
              key={a.analysisId}
              href={`/w/${workspaceId}/ros/a/${a.analysisId}`}
              className="group flex min-w-[2.8rem] flex-1 flex-col items-center gap-1"
              title={`${a.title}\nMaks: ${a.maxLevel}\nTotalt: ${total} celler`}
            >
              <div
                className="relative flex w-full flex-col justify-end overflow-hidden rounded-t-lg border border-border/40 bg-muted/30 shadow-sm transition-shadow group-hover:shadow-md"
                style={{ height: `${Math.max(barH, 8)}%`, minHeight: "2rem" }}
              >
                {[5, 4, 3, 2, 1, 0].map((level) => {
                  const c = a.counts[level]!;
                  if (c === 0) return null;
                  const pct = (c / total) * 100;
                  return (
                    <div
                      key={level}
                      className={cn(
                        "w-full transition-[flex-grow]",
                        LEVEL_COLORS[level],
                      )}
                      style={{ flexGrow: pct }}
                      title={`Nivå ${level}: ${c} (${Math.round(pct)}%)`}
                    />
                  );
                })}
              </div>
              <div className="flex w-full flex-col items-center gap-0.5">
                <span
                  className={cn(
                    "inline-flex size-5 items-center justify-center rounded-md text-[10px] font-bold tabular-nums",
                    cellRiskClass(a.maxLevel),
                  )}
                >
                  {a.maxLevel}
                </span>
                <span className="text-muted-foreground max-w-full truncate text-center text-[9px] font-medium leading-tight group-hover:text-foreground sm:text-[10px]">
                  {a.candidateCode || a.title.slice(0, 12)}
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px]">
        {legend.map(({ level, label }) => (
          <span key={level} className="inline-flex items-center gap-1.5">
            <span className={cn("size-2.5 rounded-sm", LEVEL_COLORS[level])} aria-hidden />
            <span className="text-muted-foreground font-medium">
              {level} {label}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

function RiskPortfolioHeatmap({
  analyses,
  workspaceId,
}: {
  analyses: Array<{
    analysisId: Id<"rosAnalyses">;
    title: string;
    candidateName: string;
    candidateCode: string;
    maxLevel: number;
    highRiskCells: number;
    avgAssessed: number;
    assessedCells: number;
    linkedPvvCount: number;
    openTasksCount: number;
    nextReviewAt: number | undefined;
  }>;
  workspaceId: Id<"workspaces">;
}) {
  const sorted = useMemo(
    () => [...analyses].sort((a, b) => b.maxLevel - a.maxLevel || b.highRiskCells - a.highRiskCells),
    [analyses],
  );

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-foreground flex items-center gap-2 text-sm font-semibold tracking-tight">
          <Shield className="size-4 text-primary" aria-hidden />
          Risikoportefølje
        </h3>
        <p className="text-muted-foreground mt-0.5 text-xs">
          Sortert på maks risiko og antall høyrisikoceller. Klikk for å åpne analysen.
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {sorted.map((a) => {
          const rev = nextReviewPresentation(a.nextReviewAt);
          return (
            <Link
              key={a.analysisId}
              href={`/w/${workspaceId}/ros/a/${a.analysisId}`}
              className="group border-border/50 hover:border-primary/30 flex items-start gap-3 rounded-xl border bg-card p-3 shadow-sm transition-all hover:shadow-md"
            >
              <span
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-xl text-lg font-bold tabular-nums",
                  cellRiskClass(a.maxLevel),
                )}
              >
                {a.maxLevel}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold group-hover:text-primary">{a.title}</p>
                <p className="text-muted-foreground text-[11px]">
                  {a.candidateName} <span className="font-mono">({a.candidateCode})</span>
                </p>
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
                  <span>
                    <strong className="text-foreground">{a.highRiskCells}</strong> høy (4–5)
                  </span>
                  <span>
                    snitt <strong className="text-foreground tabular-nums">{a.avgAssessed || "—"}</strong>
                  </span>
                  <span>
                    PVV <strong className="text-foreground tabular-nums">{a.linkedPvvCount}</strong>
                  </span>
                  {a.openTasksCount > 0 ? (
                    <span className="text-amber-700 dark:text-amber-300">
                      {a.openTasksCount} oppgave{a.openTasksCount !== 1 ? "r" : ""}
                    </span>
                  ) : null}
                </div>
                <p className={cn("mt-1 text-[10px]", rev.className)}>{rev.text}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function AllAnalysesDistribution({
  workspaceCounts,
  totalCells,
  notAssessed,
  analysisCount,
}: {
  workspaceCounts: Counts6;
  totalCells: number;
  notAssessed: number;
  analysisCount: number;
}) {
  const legend = legendItems();
  const assessed = totalCells - notAssessed;
  const maxCount = Math.max(1, ...workspaceCounts);

  return (
    <Card className="overflow-hidden border-border/40 shadow-sm ring-1 ring-black/[0.03] dark:ring-white/[0.05]">
      <CardHeader className="border-b border-border/40 bg-gradient-to-b from-muted/30 to-transparent pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <BarChart3 className="size-4 text-primary" aria-hidden />
          Samlet fordeling (alle {analysisCount} analyser)
        </CardTitle>
        <CardDescription className="text-xs">
          {totalCells} celler totalt · {assessed} vurderte · {notAssessed} ikke vurdert
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-5">
        <div className="flex items-end gap-2" style={{ height: "10rem" }}>
          {workspaceCounts.map((c, level) => {
            const h = (c / maxCount) * 100;
            const pct = totalCells > 0 ? Math.round((c / totalCells) * 100) : 0;
            const lab = legend[level]?.label ?? "";
            return (
              <div key={level} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                <span className="text-muted-foreground text-[10px] tabular-nums">
                  {c} <span className="opacity-60">({pct}%)</span>
                </span>
                <div className="flex w-full justify-center" style={{ height: "7.5rem" }}>
                  <div className="flex w-full max-w-[3rem] flex-col justify-end">
                    <div
                      className={cn(
                        "w-full rounded-t-lg shadow-sm transition-[height]",
                        LEVEL_COLORS[level],
                      )}
                      style={{ height: `${Math.max(h, 3)}%` }}
                    />
                  </div>
                </div>
                <div className="text-center">
                  <span className="text-foreground font-mono text-xs font-bold">{level}</span>
                  <span className="text-muted-foreground hidden text-[9px] sm:block">{lab}</span>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function OverviewKpiRow({
  data,
}: {
  data: {
    analysisCount: number;
    totalCells: number;
    assessedCells: number;
    notAssessedCells: number;
    maxAcrossAll: number;
    workspaceCounts: Counts6;
  };
}) {
  const highCells = (data.workspaceCounts[4] ?? 0) + (data.workspaceCounts[5] ?? 0);
  const critPct = data.totalCells > 0 ? Math.round((highCells / data.totalCells) * 100) : 0;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <KpiCard
        label="ROS-analyser"
        value={data.analysisCount}
        sub={`${data.totalCells} celler totalt`}
      />
      <KpiCard
        label="Høyeste nivå"
        value={data.maxAcrossAll}
        sub="Maks i noen celle"
        tone={data.maxAcrossAll >= 4 ? "danger" : data.maxAcrossAll >= 3 ? "warn" : "success"}
      />
      <KpiCard
        label="Høy / kritisk"
        value={highCells}
        sub={`${critPct}% av alle celler`}
        tone={highCells > 0 ? "danger" : "success"}
      />
      <KpiCard
        label="Vurderte celler"
        value={data.assessedCells}
        sub={`${data.notAssessedCells} ikke vurdert`}
      />
    </div>
  );
}

export function RosDashboardPanel({
  workspaceId,
}: {
  workspaceId: Id<"workspaces">;
}) {
  const [minAlertLevel, setMinAlertLevel] = useState(4);
  const [includeTagged, setIncludeTagged] = useState(true);
  const data = useQuery(api.ros.workspaceDashboard, {
    workspaceId,
    minAlertLevel,
    includeTaggedRiskItems: includeTagged,
  });

  if (data === undefined) {
    return (
      <div className="flex min-h-[12rem] items-center justify-center">
        <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (data === null) {
    return (
      <p className="text-muted-foreground text-sm">
        Kunne ikke laste oversikt (innlogget?).
      </p>
    );
  }

  const legend = legendItems();

  return (
    <div className="space-y-8">

      {/* ── KPI-kort ─────────────────────────────────────────── */}
      <OverviewKpiRow data={data} />

      {/* ── Stående søylediagram: fordeling per analyse ───── */}
      {data.analyses.length > 0 ? (
        <Card className="border-border/40 shadow-sm ring-1 ring-black/[0.03] dark:ring-white/[0.05]">
          <CardContent className="pt-6">
            <VerticalStackedBarChart
              analyses={data.analyses}
              workspaceId={workspaceId}
            />
          </CardContent>
        </Card>
      ) : null}

      {/* ── Samlet fordeling + Risikoportefølje ──────────── */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <AllAnalysesDistribution
          workspaceCounts={data.workspaceCounts}
          totalCells={data.totalCells}
          notAssessed={data.notAssessedCells}
          analysisCount={data.analysisCount}
        />

        <Card className="border-border/40 shadow-sm ring-1 ring-black/[0.03] dark:ring-white/[0.05]">
          <CardContent className="pt-5">
            <RiskPortfolioHeatmap
              analyses={data.analyses}
              workspaceId={workspaceId}
            />
          </CardContent>
        </Card>
      </div>

      {/* ── Sammenlign to analyser (gruppert diagram) ────── */}
      <RosCompareDashboardSection
        workspaceId={workspaceId}
        analyses={data.analyses.map((a) => ({
          analysisId: a.analysisId,
          title: a.title,
          candidateName: a.candidateName,
          candidateCode: a.candidateCode,
        }))}
      />

      {/* ── Revisjon & varsling  +  Samarbeid ────────────── */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <Card className="border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="size-4" aria-hidden />
              Revisjon og varsling
            </CardTitle>
            <CardDescription>
              Neste planlagte gjennomgang per analyse. Forfalte datoer markeres
              med rødt. E-postvarsler sendes til eier.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.analyses.length === 0 ? (
              <p className="text-muted-foreground text-sm">Ingen analyser.</p>
            ) : (
              <ul className="max-h-64 space-y-2 overflow-y-auto pr-1 [scrollbar-width:thin]">
                {[...data.analyses]
                  .sort((x, y) => (x.nextReviewAt ?? Infinity) - (y.nextReviewAt ?? Infinity))
                  .map((a) => {
                    const pr = nextReviewPresentation(a.nextReviewAt);
                    return (
                      <li
                        key={a.analysisId}
                        className="border-border/50 flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card/40 px-3 py-2 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium">{a.title}</p>
                          <p className="text-muted-foreground text-xs">
                            {a.candidateName} <span className="font-mono">({a.candidateCode})</span>
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className={cn("text-xs tabular-nums", pr.className)}>{pr.text}</span>
                          <Link
                            href={`/w/${workspaceId}/ros/a/${a.analysisId}`}
                            className={buttonVariants({ variant: "ghost", size: "sm", className: "h-7 text-xs" })}
                          >
                            Åpne
                          </Link>
                        </div>
                      </li>
                    );
                  })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="size-4" aria-hidden />
              Samarbeid og tilgang
            </CardTitle>
            <CardDescription>
              Del arbeidsområdet med kolleger, og bruk ROS-oppgaver til å delegere
              tiltak.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex flex-col gap-2">
              <Link
                href={`/w/${workspaceId}/innstillinger`}
                className={buttonVariants({ variant: "outline", className: "justify-center gap-2" })}
              >
                Medlemmer og invitasjoner
              </Link>
            </div>
            <p className="text-muted-foreground text-xs leading-relaxed">
              <strong className="text-foreground">ROS-oppgaver</strong> finnes inne i
              analysen (fanen Oppgaver): tildel til bruker, sett frist og koble til
              risiko i matrisen.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Oppmerksomhet (høy risiko) ───────────────────── */}
      <Card className="border-amber-500/20 bg-amber-500/[0.06]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="size-4 text-amber-700 dark:text-amber-400" />
            Oppmerksomhet
          </CardTitle>
          <CardDescription>
            Celler med nivå fra valgt terskel, eller der et punkt er markert med
            varsel / krever handling.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="ros-dash-min">Min. nivå</Label>
              <select
                id="ros-dash-min"
                className="border-input bg-background flex h-10 rounded-lg border px-2 text-sm"
                value={minAlertLevel}
                onChange={(e) => setMinAlertLevel(Number(e.target.value) || 4)}
              >
                {[3, 4, 5].map((n) => (
                  <option key={n} value={n}>{n} og høyere</option>
                ))}
              </select>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 rounded border"
                checked={includeTagged}
                onChange={(e) => setIncludeTagged(e.target.checked)}
              />
              Inkluder flaggde punkter
            </label>
          </div>
          {(data.attentionItems ?? []).length === 0 ? (
            <p className="text-muted-foreground text-sm">Ingen treff.</p>
          ) : (
            <ul className="max-h-[28rem] space-y-3 overflow-y-auto pr-1">
              {(data.attentionItems ?? []).map((it, idx) => (
                <li
                  key={`${it.analysisId}-${it.phase}-${it.rowIndex}-${it.colIndex}-${idx}`}
                  className="bg-card rounded-xl border p-3 text-sm shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 space-y-1">
                      <p className="font-medium leading-snug">{it.title}</p>
                      <p className="text-muted-foreground text-xs">
                        {it.candidateName}{" "}
                        <span className="font-mono">({it.candidateCode})</span>
                        {" · "}
                        {it.phase === "before" ? "Før" : "Etter"} tiltak
                        {" · "}
                        {it.rowLabel} × {it.colLabel}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "inline-flex shrink-0 rounded-md border px-2 py-0.5 text-xs font-bold tabular-nums",
                        cellRiskClass(it.level),
                      )}
                    >
                      {it.level}
                    </span>
                  </div>
                  <p className="text-muted-foreground mt-2 text-xs">
                    {it.reasons
                      .map((r) =>
                        r === "level_ge_4"
                          ? `Nivå ≥ ${data.minAlertLevel}`
                          : r === "watch"
                            ? "Varsel"
                            : r === "requires_action"
                              ? "Krever handling"
                              : r,
                      )
                      .join(" · ")}
                  </p>
                  {it.flaggedTexts.length > 0 ? (
                    <ul className="text-muted-foreground mt-1 list-inside list-disc text-xs">
                      {it.flaggedTexts.map((t, i) => <li key={i}>{t}</li>)}
                    </ul>
                  ) : null}
                  <div className="mt-2">
                    <Link
                      href={`/w/${workspaceId}/ros/a/${it.analysisId}`}
                      className={buttonVariants({ variant: "outline", size: "sm", className: "gap-1" })}
                    >
                      Åpne
                      <ExternalLink className="size-3.5 opacity-70" />
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* ── Tabell: sammenligning per analyse ────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Detaljert sammenligning</CardTitle>
          <CardDescription>
            Nøkkeltall per analyse med visuell indikator.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0 sm:p-6">
          {data.analyses.length === 0 ? (
            <p className="text-muted-foreground px-6 py-8 text-sm">Ingen analyser.</p>
          ) : (
            <table className="w-full min-w-[52rem] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-muted/30">
                  <th className="px-3 py-2 font-medium">Analyse</th>
                  <th className="px-3 py-2 font-medium">Prosess</th>
                  <th className="px-3 py-2 text-center font-medium">Fordeling</th>
                  <th className="px-3 py-2 text-center font-medium">Maks</th>
                  <th className="px-3 py-2 text-center font-medium">Snitt</th>
                  <th className="px-3 py-2 text-center font-medium">Høy</th>
                  <th className="px-3 py-2 font-medium">Revisjon</th>
                  <th className="px-3 py-2 text-center font-medium">Oppg.</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {data.analyses.map((a) => {
                  const rev = nextReviewPresentation(a.nextReviewAt);
                  const total = a.counts.reduce((s, v) => s + v, 0);
                  return (
                    <tr key={a.analysisId} className="border-b border-border/40 last:border-0">
                      <td className="max-w-[13rem] px-3 py-2.5 font-medium">{a.title}</td>
                      <td className="text-muted-foreground max-w-[10rem] px-3 py-2.5 text-xs">
                        {a.candidateName} <span className="font-mono">({a.candidateCode})</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="mx-auto flex h-3 w-full max-w-[8rem] overflow-hidden rounded-full" title="Fordeling nivå 0–5">
                          {a.counts.map((c, level) => {
                            if (c === 0) return null;
                            return (
                              <div
                                key={level}
                                className={cn("min-w-[2px]", LEVEL_COLORS[level])}
                                style={{ flexGrow: c }}
                              />
                            );
                          })}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span
                          className={cn(
                            "inline-flex min-w-[2rem] justify-center rounded-md border px-1.5 py-0.5 text-xs font-bold tabular-nums",
                            cellRiskClass(a.maxLevel),
                          )}
                        >
                          {a.maxLevel}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center tabular-nums">
                        {a.assessedCells > 0 ? a.avgAssessed : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-center tabular-nums">{a.highRiskCells}</td>
                      <td className="max-w-[10rem] px-3 py-2.5 text-xs">
                        <span className={cn(rev.className)}>{rev.text}</span>
                      </td>
                      <td className="px-3 py-2.5 text-center tabular-nums">{a.openTasksCount}</td>
                      <td className="px-3 py-2.5">
                        <Link
                          href={`/w/${workspaceId}/ros/a/${a.analysisId}`}
                          className={buttonVariants({ variant: "secondary", size: "sm", className: "gap-1" })}
                        >
                          Åpne
                          <ExternalLink className="size-3.5 opacity-70" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          <p className="text-muted-foreground border-t border-border/50 px-6 py-3 text-[11px] leading-relaxed">
            Snitt = gjennomsnitt av vurderte celler (1–5). Høy = celler nivå 4–5.
            Fargelinjen viser proporsjonal fordeling.
          </p>
        </CardContent>
      </Card>

      {/* ── Legende ──────────────────────────────────────── */}
      <div className="rounded-xl border border-border/60 bg-muted/15 px-4 py-3">
        <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
          Risikonivå (referanse)
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {legend.map(({ level, label }) => (
            <span
              key={level}
              className={cn(
                "inline-flex items-center rounded-lg border px-2 py-1 text-[11px] font-medium",
                cellRiskClass(level),
              )}
            >
              <span className="tabular-nums font-bold">{level}</span>
              <span className="mx-1 opacity-60">·</span>
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
