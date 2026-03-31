"use client";

import type { ComponentType } from "react";
import { buttonVariants } from "@/components/ui/button";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
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
  }>;
};

type Tab = "maler" | "analyser" | "oversikt";

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
  tone?: "default" | "warn" | "muted";
}) {
  return (
    <div
      className={cn(
        "border-border/60 bg-card flex min-w-0 flex-col gap-1 rounded-xl border px-4 py-3 shadow-sm",
        tone === "warn" && "border-amber-500/35 bg-amber-500/[0.06]",
        tone === "muted" && "bg-muted/25",
      )}
    >
      <div className="text-muted-foreground flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide">
        <Icon className="size-3.5 shrink-0 opacity-80" aria-hidden />
        {label}
      </div>
      <p className="font-heading text-2xl font-semibold tabular-nums tracking-tight">
        {value}
      </p>
    </div>
  );
}

export function RosWorkspaceHub({
  workspaceId,
  hub,
  activeTab,
  onTab,
  onStartAnalysisForCandidate,
  onOpenTemplateDialog,
}: {
  workspaceId: Id<"workspaces">;
  hub: RosWorkspaceHubData | null | undefined;
  activeTab: Tab;
  onTab: (t: Tab) => void;
  onStartAnalysisForCandidate: (candidateId: Id<"candidates">) => void;
  onOpenTemplateDialog: () => void;
}) {
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

  return (
    <div className="space-y-4">
      <div className="border-border/60 from-muted/25 via-card to-card rounded-2xl border bg-gradient-to-br p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-1">
            <h2 className="font-heading text-lg font-semibold tracking-tight">
              ROS-kontroll for arbeidsområdet
            </h2>
            <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
              {hasOrgScale ? (
                <>
                  Samlet bilde av maler, analyser og prosesser som mangler ROS —
                  slik at ledergruppe og fag kan prioritere uten å lete i lister.
                </>
              ) : (
                <>
                  Én flyt: mal → analyse i matrisen → oversikt. Bruk hurtigknapper
                  under for å hoppe rett dit dere trenger.
                </>
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 lg:shrink-0 lg:pt-0.5">
            <button
              type="button"
              onClick={() => onTab("analyser")}
              className={cn(
                buttonVariants({
                  variant: activeTab === "analyser" ? "default" : "secondary",
                  size: "sm",
                  className: "gap-1.5",
                }),
              )}
            >
              <ClipboardList className="size-3.5" aria-hidden />
              Ny / liste analyser
            </button>
            <button
              type="button"
              onClick={() => onTab("oversikt")}
              className={cn(
                buttonVariants({
                  variant: activeTab === "oversikt" ? "default" : "outline",
                  size: "sm",
                  className: "gap-1.5",
                }),
              )}
            >
              <BarChart3 className="size-3.5" aria-hidden />
              Oversikt
            </button>
            <Link
              href={`/w/${workspaceId}/ros/akser`}
              className={buttonVariants({
                variant: "outline",
                size: "sm",
                className: "gap-1.5",
              })}
            >
              <Layers className="size-3.5" aria-hidden />
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
                className: "gap-1.5",
              })}
            >
              <Sparkles className="size-3.5" aria-hidden />
              Ny mal
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
            label="Prosesser uten ROS"
            value={gap}
            icon={AlertCircle}
            tone={gap > 0 ? "warn" : "default"}
          />
          <StatTile
            label="Åpne oppgaver (i analyser)"
            value={hub.openRosTasksCount}
            icon={ListTodo}
            tone={hub.openRosTasksCount > 0 ? "warn" : "muted"}
          />
        </div>

        {hub.axisListCount > 0 ? (
          <p className="text-muted-foreground mt-3 text-xs">
            {hub.axisListCount} gjenbrukbar{hub.axisListCount === 1 ? "" : "e"}{" "}
            akse-liste
            {hub.axisListCount === 1 ? "" : "r"} under{" "}
            <Link
              href={`/w/${workspaceId}/ros/akser`}
              className="text-primary font-medium underline-offset-4 hover:underline"
            >
              ROS-akser
            </Link>
            .
          </p>
        ) : (
          <p className="text-muted-foreground mt-3 text-xs">
            Tips: vedlikehold{" "}
            <Link
              href={`/w/${workspaceId}/ros/akser`}
              className="text-primary font-medium underline-offset-4 hover:underline"
            >
              ROS-akser
            </Link>{" "}
            for felles etiketter og beskrivelser på tvers av team.
          </p>
        )}
      </div>

      {gap > 0 ? (
        <div
          className="border-amber-500/30 bg-amber-500/[0.07] rounded-2xl border px-4 py-3"
          role="status"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-foreground text-sm font-medium">
                {gap} prosess
                {gap === 1 ? "" : "er"} uten ROS-analyse
              </p>
              <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
                Klikk en rad for å åpne skjemaet «Ny analyse» med prosessen
                forhåndsvalgt og (ved én mal) mal satt automatisk.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onTab("analyser")}
              className={buttonVariants({ variant: "secondary", size: "sm" })}
            >
              Gå til analyser
              <ArrowRight className="size-3.5" aria-hidden />
            </button>
          </div>
          <ul className="mt-3 flex max-h-40 flex-wrap gap-2 overflow-y-auto">
            {hub.candidatesWithoutRos.map((c) => (
              <li key={c._id}>
                <button
                  type="button"
                  onClick={() => onStartAnalysisForCandidate(c._id)}
                  className="border-border/60 bg-card hover:border-primary/40 hover:bg-muted/40 rounded-lg border px-2.5 py-1.5 text-left text-xs transition-colors"
                >
                  <span className="font-medium">{c.name}</span>{" "}
                  <span className="text-muted-foreground font-mono">({c.code})</span>
                </button>
              </li>
            ))}
          </ul>
          {hub.candidatesWithoutRosCount > hub.candidatesWithoutRos.length ? (
            <p className="text-muted-foreground mt-2 text-[11px]">
              Viser {hub.candidatesWithoutRos.length} av {hub.candidatesWithoutRosCount}{" "}
              — resten finner du i listen når du oppretter analyse.
            </p>
          ) : null}
        </div>
      ) : hub.candidateCount > 0 ? (
        <p className="text-muted-foreground flex items-center gap-2 text-xs">
          <span className="text-emerald-600 dark:text-emerald-400 font-medium">
            Alle registrerte prosesser har minst én ROS-analyse.
          </span>
        </p>
      ) : null}

      {hub.recentAnalyses.length > 0 ? (
        <div className="border-border/60 bg-muted/10 rounded-xl border px-4 py-3">
          <p className="text-muted-foreground mb-2 text-[11px] font-medium uppercase tracking-wide">
            Sist oppdatert
          </p>
          <ul className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap">
            {hub.recentAnalyses.map((r) => (
              <li key={r.analysisId}>
                <Link
                  href={`/w/${workspaceId}/ros/a/${r.analysisId}`}
                  className="border-border/50 bg-card hover:border-primary/35 inline-flex max-w-full items-center gap-2 rounded-lg border px-3 py-1.5 text-sm shadow-sm transition-colors"
                >
                  <span className="min-w-0 truncate font-medium">{r.title}</span>
                  {r.candidateCode ? (
                    <span className="text-muted-foreground shrink-0 font-mono text-xs">
                      {r.candidateCode}
                    </span>
                  ) : null}
                  <span className="text-muted-foreground hidden text-xs sm:inline">
                    · {formatShort(r.updatedAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
