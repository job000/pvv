"use client";

import type { ComponentType } from "react";
import { useMemo } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  CalendarClock,
  ClipboardList,
  Grid3x3,
  Layers,
  ListTodo,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

export type RosWorkspaceHubData = {
  templateCount: number;
  analysisCount: number;
  axisListCount: number;
  candidateCount: number;
  candidatesWithoutRosCount: number;
  candidatesWithoutRos: Array<{
    _id: Id<"candidates">;
    name: string;
    code: string;
  }>;
  openRosTasksCount: number;
  defaultTemplateId: Id<"rosTemplates"> | null;
  recentAnalyses: Array<{
    analysisId: Id<"rosAnalyses">;
    title: string;
    candidateCode: string;
    updatedAt: number;
    fromIntake?: boolean;
  }>;
};

type RosHubTab = "maler" | "analyser" | "oversikt";

function formatShort(ts: number) {
  try {
    return new Intl.DateTimeFormat("nb-NO", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(ts));
  } catch {
    return "";
  }
}

function StatTile({
  label,
  value,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: number | string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  tone?: "default" | "warn" | "muted" | "success";
}) {
  return (
    <div
      className={cn(
        "relative flex min-w-0 items-center gap-3 overflow-hidden rounded-2xl border px-4 py-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-shadow hover:shadow-md",
        tone === "default" && "border-border/50 bg-card ring-1 ring-black/[0.03] dark:ring-white/[0.05]",
        tone === "warn" && "border-amber-500/30 bg-amber-500/[0.06] ring-1 ring-amber-500/15",
        tone === "muted" && "border-border/40 bg-muted/25 ring-1 ring-black/[0.02] dark:ring-white/[0.04]",
        tone === "success" && "border-emerald-500/25 bg-emerald-500/[0.05] ring-1 ring-emerald-500/12",
      )}
    >
      <div
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-xl",
          tone === "warn"
            ? "bg-amber-500/15 text-amber-700 ring-1 ring-amber-500/20 dark:text-amber-300"
            : tone === "success"
              ? "bg-emerald-500/12 text-emerald-700 ring-1 ring-emerald-500/15 dark:text-emerald-300"
              : "bg-primary/10 text-primary ring-1 ring-primary/12",
        )}
      >
        <Icon className="size-5" aria-hidden />
      </div>
      <div className="min-w-0">
        <p className="font-heading text-[1.65rem] font-semibold tabular-nums tracking-tight leading-none text-foreground">
          {value}
        </p>
        <p className="text-muted-foreground mt-1 text-[10px] font-semibold uppercase tracking-[0.12em]">
          {label}
        </p>
      </div>
    </div>
  );
}

export function RosWorkspaceHub({
  workspaceId,
  hub,
  compact = false,
  onTab,
  onStartAnalysisForCandidate,
  onOpenTemplateDialog,
}: {
  workspaceId: Id<"workspaces">;
  hub: RosWorkspaceHubData | null | undefined;
  /** På Maler/Analyser: ett kompakt sammendrag. Full kontrollpanel på Oversikt. */
  compact?: boolean;
  onTab: (t: RosHubTab) => void;
  onStartAnalysisForCandidate: (candidateId: Id<"candidates">) => void;
  onOpenTemplateDialog: () => void;
}) {
  const reviewSchedule = useQuery(api.reviewSchedule.listWorkspaceReviewItems, {
    workspaceId,
  });
  const overdueReviewCount = useMemo(() => {
    if (!reviewSchedule?.items?.length) return 0;
    // Brukes kun til telling av forfalte punkter fra serverdata (ikke som render-klokke).
    // eslint-disable-next-line react-hooks/purity -- Date.now() er akseptabelt for denne filtreringen
    const now = Date.now();
    return reviewSchedule.items.filter((i) => i.dueAt <= now).length;
  }, [reviewSchedule]);

  if (hub === undefined) {
    return (
      <div className="border-border/60 bg-muted/15 flex min-h-[7rem] items-center justify-center rounded-2xl border">
        <div
          className="size-7 animate-spin rounded-full border-2 border-primary border-t-transparent"
          aria-hidden
        />
        <span className="sr-only">Henter oversikt …</span>
      </div>
    );
  }

  if (hub === null) {
    return null;
  }

  const gap = hub.candidatesWithoutRosCount;
  const hasOrgScale = hub.candidateCount >= 8 || hub.analysisCount >= 6;

  const overdueBlock =
    reviewSchedule !== undefined && overdueReviewCount > 0 ? (
      <Alert
        className={
          compact
            ? "border-amber-500/40 bg-amber-500/[0.07] py-2.5 [&>svg]:top-2.5"
            : "border-amber-500/40 bg-amber-500/[0.07]"
        }
      >
        <CalendarClock className="size-4 text-amber-800 dark:text-amber-200" />
        <AlertTitle>Planlagt revisjon forfalt</AlertTitle>
        <AlertDescription
          className={compact ? "text-foreground/90 text-xs leading-snug" : "text-foreground/90"}
        >
          {overdueReviewCount === 1
            ? "Én ROS- eller PVV-gjennomgang har passert satt tidspunkt. Åpne analysen eller vurderingen og oppdater dato eller fullfør sjekken."
            : `${overdueReviewCount} ROS- eller PVV-gjennomganger har passert satt tidspunkt. Oppdater dato eller dokumentasjon der det trengs.`}{" "}
          {!compact ? (
            <>E-post sendes også til eier (maks. én gang per uke per sak).</>
          ) : null}
        </AlertDescription>
      </Alert>
    ) : null;

  if (compact) {
    return (
      <div className="space-y-3">
        {overdueBlock}

        <div className="space-y-2.5 rounded-xl border border-border/50 bg-muted/10 px-3 py-2.5">
          <p className="text-muted-foreground text-[11px] leading-snug">
            ROS kan stå alene — kobling til PVV eller prosess er valgfritt.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <p className="text-muted-foreground text-xs tabular-nums sm:text-[13px]">
              <span className="text-foreground font-medium">{hub.analysisCount}</span>{" "}
              {hub.analysisCount === 1 ? "analyse" : "analyser"}
              <span className="mx-1.5 text-border">·</span>
              <span className="text-foreground font-medium">{hub.templateCount}</span>{" "}
              {hub.templateCount === 1 ? "mal" : "maler"}
              <span className="mx-1.5 text-border">·</span>
              <span
                className={
                  gap > 0
                    ? "font-medium text-amber-800 dark:text-amber-200"
                    : "text-foreground font-medium"
                }
              >
                {gap} uten ROS
              </span>
              <span className="mx-1.5 text-border">·</span>
              <span className="text-foreground font-medium">{hub.openRosTasksCount}</span>{" "}
              åpne oppgaver
            </p>
            <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => onTab("analyser")}
              className={buttonVariants({
                variant: "default",
                size: "sm",
                className: "h-7 gap-1 px-2 text-xs",
              })}
            >
              <ClipboardList className="size-3" aria-hidden />
              Alle ROS
            </button>
            <button
              type="button"
              onClick={() => onTab("oversikt")}
              className={buttonVariants({
                variant: "ghost",
                size: "sm",
                className: "h-7 gap-1 px-2 text-xs",
              })}
            >
              <BarChart3 className="size-3" aria-hidden />
              Dashboard
            </button>
            <Link
              href={`/w/${workspaceId}/ros/akser`}
              className={buttonVariants({
                variant: "outline",
                size: "sm",
                className: "h-7 gap-1 px-2 text-xs",
              })}
            >
              <Layers className="size-3" aria-hidden />
              Akser
            </Link>
            <button
              type="button"
              onClick={() => {
                onTab("maler");
                onOpenTemplateDialog();
              }}
              className={buttonVariants({
                variant: "outline",
                size: "sm",
                className: "h-7 gap-1 px-2 text-xs",
              })}
            >
              <Sparkles className="size-3" aria-hidden />
              Ny mal
            </button>
            </div>
          </div>
        </div>

        {gap > 0 ? (
          <div
            className="rounded-lg border border-amber-500/30 bg-amber-500/[0.05] px-3 py-2"
            role="status"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <AlertCircle className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                <p className="text-foreground text-xs font-medium">
                  {gap} prosess{gap === 1 ? "" : "er"} mangler ROS
                </p>
              </div>
              <button
                type="button"
                onClick={() => onTab("analyser")}
                className={buttonVariants({
                  variant: "secondary",
                  size: "sm",
                  className: "h-7 text-xs gap-1",
                })}
              >
                Opprett
                <ArrowRight className="size-3" aria-hidden />
              </button>
            </div>
            <ul className="mt-2 flex max-h-24 flex-wrap gap-1 overflow-y-auto [scrollbar-width:thin]">
              {hub.candidatesWithoutRos.map((c) => (
                <li key={c._id}>
                  <button
                    type="button"
                    onClick={() => onStartAnalysisForCandidate(c._id)}
                    className="border-border/60 bg-card hover:border-primary/40 hover:bg-primary/5 rounded border px-1.5 py-0.5 text-left text-[11px] transition-colors"
                  >
                    <span className="font-medium">{c.name}</span>{" "}
                    <span className="text-muted-foreground font-mono">({c.code})</span>
                  </button>
                </li>
              ))}
            </ul>
            {hub.candidatesWithoutRosCount > hub.candidatesWithoutRos.length ? (
              <p className="text-muted-foreground mt-1.5 text-[10px]">
                +{hub.candidatesWithoutRosCount - hub.candidatesWithoutRos.length}{" "}
                til — se fanen Oversikt
              </p>
            ) : null}
          </div>
        ) : null}

        {hub.recentAnalyses.length > 0 ? (
          <div className="space-y-1.5">
            <p className="text-muted-foreground text-[11px] font-medium">Sist oppdatert</p>
            <div className="flex flex-wrap gap-1.5">
              {hub.recentAnalyses.slice(0, 4).map((r) => (
                <Link
                  key={r.analysisId}
                  href={`/w/${workspaceId}/ros/a/${r.analysisId}`}
                  className="group inline-flex max-w-full items-center gap-1.5 rounded-md border border-border/50 bg-card px-2 py-1.5 text-xs shadow-sm transition-all hover:border-primary/30"
                >
                  <span className="min-w-0 truncate font-medium">{r.title}</span>
                  {r.fromIntake ? (
                    <Badge variant="secondary" className="h-4 shrink-0 border-0 px-1 text-[9px] font-medium">
                      Skjema
                    </Badge>
                  ) : null}
                  {r.candidateCode ? (
                    <span className="text-muted-foreground shrink-0 font-mono text-[10px]">
                      {r.candidateCode}
                    </span>
                  ) : null}
                  <ArrowRight className="size-2.5 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {overdueBlock}
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="font-heading text-base font-semibold tracking-tight">
              Kontrollpanel
            </h2>
            <p className="text-muted-foreground text-xs">
              {hasOrgScale
                ? "Samlet oversikt over risikoarbeidet i arbeidsområdet"
                : "Hurtigknapper og nøkkeltall for ROS-arbeidet"}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5 sm:shrink-0">
            <Link
              href={`/w/${workspaceId}/ros/akser`}
              className={buttonVariants({
                variant: "outline",
                size: "sm",
                className: "gap-1.5 h-8 text-xs",
              })}
            >
              <Layers className="size-3" aria-hidden />
              ROS-akser
            </Link>
            <button
              type="button"
              onClick={() => {
                onTab("maler");
                onOpenTemplateDialog();
              }}
              className={buttonVariants({
                variant: "outline",
                size: "sm",
                className: "gap-1.5 h-8 text-xs",
              })}
            >
              <Sparkles className="size-3" aria-hidden />
              Ny mal
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatTile
            label="ROS-analyser"
            value={hub.analysisCount}
            icon={ClipboardList}
          />
          <StatTile
            label="Maler"
            value={hub.templateCount}
            icon={Grid3x3}
          />
          <StatTile
            label="Uten ROS"
            value={gap}
            icon={AlertCircle}
            tone={gap > 0 ? "warn" : "success"}
          />
          <StatTile
            label="Åpne oppgaver"
            value={hub.openRosTasksCount}
            icon={ListTodo}
            tone={hub.openRosTasksCount > 0 ? "warn" : "muted"}
          />
        </div>
      </div>

      {gap > 0 ? (
        <div
          className="rounded-xl border border-amber-500/30 bg-amber-500/[0.05] px-4 py-3"
          role="status"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <p className="text-foreground text-sm font-medium">
                {gap} prosess{gap === 1 ? "" : "er"} mangler ROS
              </p>
            </div>
            <button
              type="button"
              onClick={() => onTab("analyser")}
              className={buttonVariants({ variant: "secondary", size: "sm", className: "h-7 text-xs gap-1" })}
            >
              Opprett analyse
              <ArrowRight className="size-3" aria-hidden />
            </button>
          </div>
          <ul className="mt-2.5 flex max-h-32 flex-wrap gap-1.5 overflow-y-auto [scrollbar-width:thin]">
            {hub.candidatesWithoutRos.map((c) => (
              <li key={c._id}>
                <button
                  type="button"
                  onClick={() => onStartAnalysisForCandidate(c._id)}
                  className="border-border/60 bg-card hover:border-primary/40 hover:bg-primary/5 rounded-md border px-2 py-1 text-left text-xs transition-colors"
                >
                  <span className="font-medium">{c.name}</span>{" "}
                  <span className="text-muted-foreground font-mono">({c.code})</span>
                </button>
              </li>
            ))}
          </ul>
          {hub.candidatesWithoutRosCount > hub.candidatesWithoutRos.length ? (
            <p className="text-muted-foreground mt-2 text-[10px]">
              +{hub.candidatesWithoutRosCount - hub.candidatesWithoutRos.length} til i full liste
            </p>
          ) : null}
        </div>
      ) : hub.candidateCount > 0 ? (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.04] px-4 py-2.5">
          <div className="flex size-6 items-center justify-center rounded-full bg-emerald-500/15">
            <span className="text-xs text-emerald-700 dark:text-emerald-300">✓</span>
          </div>
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
            Alle prosesser har ROS-analyse
          </p>
        </div>
      ) : null}

      {hub.recentAnalyses.length > 0 ? (
        <div className="space-y-2">
          <p className="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">
            Nylig oppdatert
          </p>
          <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap">
            {hub.recentAnalyses.map((r) => (
              <Link
                key={r.analysisId}
                href={`/w/${workspaceId}/ros/a/${r.analysisId}`}
                className="group inline-flex max-w-full items-center gap-2 rounded-lg border border-border/50 bg-card px-3 py-2 text-sm shadow-sm transition-all hover:border-primary/30 hover:shadow-md"
              >
                <span className="min-w-0 truncate font-medium">{r.title}</span>
                {r.fromIntake ? (
                  <Badge variant="secondary" className="h-5 shrink-0 border-0 px-1.5 text-[10px] font-medium">
                    Skjema
                  </Badge>
                ) : null}
                {r.candidateCode ? (
                  <span className="text-muted-foreground shrink-0 font-mono text-xs">
                    {r.candidateCode}
                  </span>
                ) : null}
                <span className="text-muted-foreground hidden text-xs sm:inline">
                  · {formatShort(r.updatedAt)}
                </span>
                <ArrowRight className="ml-auto size-3 shrink-0 text-muted-foreground/30 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
