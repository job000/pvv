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
import { BarChart3, BookOpen, ExternalLink, Layers } from "lucide-react";
import Link from "next/link";

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

function DistributionBars({
  counts,
  total,
  label,
}: {
  counts: readonly [number, number, number, number, number, number];
  total: number;
  label: string;
}) {
  const legend = legendItems();
  return (
    <div className="space-y-2" role="img" aria-label={label}>
      {counts.map((c, level) => {
        const pct = total > 0 ? Math.min(100, (c / total) * 100) : 0;
        const lab = legend.find((x) => x.level === level)?.label ?? "";
        return (
          <div
            key={level}
            className="grid grid-cols-[1fr_minmax(0,3.5fr)_auto] items-center gap-2 text-xs sm:gap-3"
          >
            <span className="text-muted-foreground truncate font-medium">
              <span className="tabular-nums">{level}</span>{" "}
              <span className="hidden sm:inline">{lab}</span>
            </span>
            <div className="bg-muted/80 h-3 overflow-hidden rounded-full">
              <div
                className={cn(
                  "h-full min-w-[2px] rounded-full transition-[width]",
                  cellRiskClass(level),
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-muted-foreground shrink-0 text-right tabular-nums">
              {c}
              <span className="text-muted-foreground/60">
                {" "}
                ({total > 0 ? Math.round((c / total) * 100) : 0}%)
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function RosDashboardPanel({
  workspaceId,
}: {
  workspaceId: Id<"workspaces">;
}) {
  const data = useQuery(api.ros.workspaceDashboard, { workspaceId });

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
  const totalForBars = data.totalCells;

  return (
    <div className="space-y-8">
      <div className="border-border/60 bg-muted/10 rounded-2xl border p-5">
        <div className="flex flex-wrap items-start gap-3">
          <div className="bg-primary/12 text-primary flex size-11 shrink-0 items-center justify-center rounded-xl">
            <BookOpen className="size-5" aria-hidden />
          </div>
          <div className="min-w-0 space-y-2">
            <h2 className="font-heading text-lg font-semibold">
              Slik leser du oversikten
            </h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              <strong className="text-foreground">ROS</strong> kartlegger risiko
              i en matrise (sannsynlighet × konsekvens). Hver celle får nivå{" "}
              <strong>0–5</strong> med farger fra grå (ikke vurdert) til rød
              (kritisk). Denne siden summerer{" "}
              <strong>alle analyser</strong> i arbeidsområdet slik at dere ser
              fordeling, høyeste nivå og hvilke prosesser som har flest
              høyrisiko-celler — i tillegg til kobling mot{" "}
              <strong>PVV</strong> (antall koblede vurderinger per analyse).
            </p>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Bruk <strong className="text-foreground">søylediagrammet</strong>{" "}
              under for å se total fordeling på tvers av analyser. Tabellen
              under sammenligner hver analyse: maks nivå, gjennomsnitt av
              vurderte celler, og «høy/sårbar» (nivå 4–5).
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <Card className="border-primary/15 overflow-hidden">
          <CardHeader className="border-b border-border/50 bg-muted/15">
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="size-4" aria-hidden />
              Totalt i arbeidsområdet
            </CardTitle>
            <CardDescription>
              Fordeling av alle celleverdier på tvers av{" "}
              <strong>{data.analysisCount}</strong> ROS-analyse
              {data.analysisCount === 1 ? "" : "r"} ({data.totalCells} celler
              totalt, {data.notAssessedCells} ikke vurdert).
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {data.analysisCount === 0 ? (
              <p className="text-muted-foreground text-sm">
                Ingen analyser ennå — opprett under fanen «ROS-analyser».
              </p>
            ) : (
              <DistributionBars
                counts={data.workspaceCounts}
                total={totalForBars}
                label="Fordeling av risikonivå i alle ROS-matriser"
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Layers className="size-4" aria-hidden />
              Nøkkeltall
            </CardTitle>
            <CardDescription>
              Rask oppsummering basert på lagrede matriser.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between gap-4 border-b border-border/40 pb-2">
              <span className="text-muted-foreground">Analyser</span>
              <span className="font-semibold tabular-nums">
                {data.analysisCount}
              </span>
            </div>
            <div className="flex justify-between gap-4 border-b border-border/40 pb-2">
              <span className="text-muted-foreground">Høyeste nivå (noen celle)</span>
              <span className="font-semibold tabular-nums">
                {data.analysisCount === 0 ? "—" : data.maxAcrossAll}
              </span>
            </div>
            <div className="flex justify-between gap-4 border-b border-border/40 pb-2">
              <span className="text-muted-foreground">Vurderte celler (≠0)</span>
              <span className="font-semibold tabular-nums">
                {data.assessedCells}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Ikke vurdert (0)</span>
              <span className="font-semibold tabular-nums">
                {data.notAssessedCells}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sammenligning per analyse</CardTitle>
          <CardDescription>
            Klikk «Åpne» for å gå til matrisen. PVV-kolonner viser antall
            koblede vurderinger.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0 sm:p-6">
          {data.analyses.length === 0 ? (
            <p className="text-muted-foreground px-6 py-8 text-sm">
              Ingen analyser å sammenligne.
            </p>
          ) : (
            <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-muted/30">
                  <th className="px-3 py-2 font-medium">Analyse</th>
                  <th className="px-3 py-2 font-medium">Kandidat</th>
                  <th className="px-3 py-2 text-center font-medium">PVV</th>
                  <th className="px-3 py-2 text-center font-medium">Maks</th>
                  <th className="px-3 py-2 text-center font-medium">Snitt*</th>
                  <th className="px-3 py-2 text-center font-medium">Høy (4–5)</th>
                  <th className="px-3 py-2 font-medium">Oppdatert</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {data.analyses.map((a) => (
                  <tr
                    key={a.analysisId}
                    className="border-b border-border/40 last:border-0"
                  >
                    <td className="max-w-[14rem] px-3 py-2 font-medium">
                      {a.title}
                    </td>
                    <td className="text-muted-foreground max-w-[12rem] px-3 py-2">
                      {a.candidateName}{" "}
                      <span className="font-mono text-xs">({a.candidateCode})</span>
                    </td>
                    <td className="px-3 py-2 text-center tabular-nums">
                      {a.linkedPvvCount}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span
                        className={cn(
                          "inline-flex min-w-[2rem] justify-center rounded-md border px-1.5 py-0.5 text-xs font-bold tabular-nums",
                          cellRiskClass(a.maxLevel),
                        )}
                      >
                        {a.maxLevel}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center tabular-nums">
                      {a.assessedCells > 0 ? a.avgAssessed : "—"}
                    </td>
                    <td className="px-3 py-2 text-center tabular-nums">
                      {a.highRiskCells}
                    </td>
                    <td className="text-muted-foreground px-3 py-2 text-xs whitespace-nowrap">
                      {formatTs(a.updatedAt)}
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        href={`/w/${workspaceId}/ros/a/${a.analysisId}`}
                        className={buttonVariants({
                          variant: "secondary",
                          size: "sm",
                          className: "inline-flex gap-1",
                        })}
                      >
                        Åpne
                        <ExternalLink className="size-3.5 opacity-70" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="text-muted-foreground border-t border-border/50 px-6 py-3 text-[11px] leading-relaxed">
            *Snitt = gjennomsnitt av alle celler med verdi 1–5 (ekskluderer 0).
            «Høy (4–5)» = antall celler med sterkest risiko — nyttig som sårbarhetsindikator
            sammen med PVV-koblinger.
          </p>
        </CardContent>
      </Card>

      <div className="rounded-xl border border-border/60 bg-muted/15 px-4 py-3">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
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
