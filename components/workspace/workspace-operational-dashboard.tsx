"use client";

import type { ComponentType } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import {
  PIPELINE_STATUS_LABELS,
  type PipelineStatus,
} from "@/lib/assessment-pipeline";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowRight,
  ClipboardList,
  Clock,
  ShieldAlert,
  Users,
} from "lucide-react";
import Link from "next/link";

function MetricCard({
  title,
  value,
  hint,
  href,
  icon: Icon,
  tone = "default",
}: {
  title: string;
  value: string | number;
  hint: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  tone?: "default" | "amber" | "muted";
}) {
  return (
    <Link href={href} className="group block h-full">
      <Card
        className={cn(
          "h-full rounded-2xl border-border/45 shadow-[0_1px_3px_rgba(0,0,0,0.04)] ring-1 ring-black/[0.03] transition-all duration-200 hover:shadow-md dark:ring-white/[0.05]",
          tone === "amber" &&
            "border-amber-500/30 bg-amber-500/[0.04] hover:border-amber-500/45",
          tone === "muted" && "border-border/40 bg-muted/20",
          tone === "default" && "border-border/40 bg-card",
        )}
      >
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
          <CardTitle className="text-muted-foreground text-[10px] font-semibold uppercase tracking-[0.12em] leading-tight">
            {title}
          </CardTitle>
          <Icon
            className={cn(
              "size-4 shrink-0 opacity-70 transition-transform group-hover:translate-x-0.5",
              tone === "amber" && "text-amber-700 dark:text-amber-400",
            )}
            aria-hidden
          />
        </CardHeader>
        <CardContent>
          <p className="font-heading text-[1.65rem] font-semibold tabular-nums tracking-tight text-foreground sm:text-3xl">
            {value}
          </p>
          <CardDescription className="mt-2 text-[12px] leading-snug sm:text-xs">
            {hint}
          </CardDescription>
        </CardContent>
      </Card>
    </Link>
  );
}

export type WorkspaceDashboardSectionVisibility = {
  showMetrics?: boolean;
  showPrioritySection?: boolean;
  showRecentSection?: boolean;
};

export function WorkspaceOperationalDashboard({
  workspaceId,
  sectionVisibility,
}: {
  workspaceId: Id<"workspaces">;
  /** Udefinert felt = synlig (standard). */
  sectionVisibility?: WorkspaceDashboardSectionVisibility;
}) {
  const dash = useQuery(api.assessments.workspaceDashboard, { workspaceId });
  const wid = String(workspaceId);

  const showMetrics = sectionVisibility?.showMetrics !== false;
  const showPriority = sectionVisibility?.showPrioritySection !== false;
  const showRecent = sectionVisibility?.showRecentSection !== false;

  if (dash === undefined) {
    return (
      <div className="space-y-8">
        {showMetrics ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-28 animate-pulse rounded-2xl border border-border/40 bg-muted/40 ring-1 ring-black/[0.03]"
              />
            ))}
          </div>
        ) : null}
        {showPriority || showRecent ? (
          <div
            className={
              showPriority && showRecent
                ? "grid gap-6 lg:grid-cols-2"
                : "grid max-w-2xl gap-6"
            }
          >
            {showPriority ? (
              <div className="bg-muted/20 h-40 animate-pulse rounded-2xl border border-border/40" />
            ) : null}
            {showRecent ? (
              <div className="bg-muted/20 h-40 animate-pulse rounded-2xl border border-border/40" />
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  if (dash === null) {
    return null;
  }

  const {
    assessmentCount,
    withoutRosLinkCount,
    onHoldCount,
    priorityTop,
    recentlyUpdated,
  } = dash;

  return (
    <div className="space-y-8">
      {showMetrics ? (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Vurderinger"
          value={assessmentCount}
          hint="Antall du har tilgang til"
          href={`/w/${wid}/vurderinger`}
          icon={ClipboardList}
        />
        <MetricCard
          title="Uten ROS-kobling"
          value={withoutRosLinkCount}
          hint={
            withoutRosLinkCount > 0
              ? "Koble ROS fra ROS-siden eller fra saken"
              : "Alle synlige saker har ROS-kobling"
          }
          href={`/w/${wid}/vurderinger`}
          icon={ShieldAlert}
          tone={withoutRosLinkCount > 0 ? "amber" : "default"}
        />
        <MetricCard
          title="På vent"
          value={onHoldCount}
          hint="Saker med status «På vent»"
          href={`/w/${wid}/vurderinger`}
          icon={AlertTriangle}
          tone={onHoldCount > 0 ? "amber" : "muted"}
        />
        <MetricCard
          title="Prosessregister"
          value="Åpne"
          hint="Prosesser med ID før nye saker"
          href={`/w/${wid}/vurderinger?fane=prosesser`}
          icon={Users}
        />
      </div>
      ) : null}

      {showPriority || showRecent ? (
      <div
        className={
          showPriority && showRecent
            ? "grid gap-6 lg:grid-cols-2"
            : "grid max-w-2xl gap-6"
        }
      >
        {showPriority ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-heading text-base font-semibold tracking-tight">
              Høyeste prioritet
            </h2>
            <Link
              href={`/w/${wid}/vurderinger`}
              className="text-muted-foreground hover:text-foreground inline-flex min-h-[44px] items-center gap-1 rounded-lg px-2 text-xs font-semibold sm:min-h-0"
            >
              Alle
              <ArrowRight className="size-3" aria-hidden />
            </Link>
          </div>
          {priorityTop.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/50 bg-muted/15 px-4 py-8 text-center ring-1 ring-black/[0.03] dark:ring-white/[0.05]">
              <p className="text-muted-foreground text-sm leading-relaxed">
                Ingen vurderinger ennå.
              </p>
              <Link
                href={`/w/${wid}/vurderinger`}
                className="text-primary mt-3 inline-flex items-center gap-1 text-sm font-semibold underline-offset-4 hover:underline"
              >
                Opprett vurdering
                <ArrowRight className="size-3.5" aria-hidden />
              </Link>
              <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
                Felles prosess-ID først?{" "}
                <Link
                  href={`/w/${wid}/vurderinger?fane=prosesser`}
                  className="text-foreground font-medium underline-offset-4 hover:underline"
                >
                  Prosessregister
                </Link>
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {priorityTop.map((row) => (
                <li key={row.assessmentId}>
                  <AssessmentDashRow
                    wid={wid}
                    row={row}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
        ) : null}

        {showRecent ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-heading text-base font-semibold tracking-tight">
              Sist oppdatert
            </h2>
            <Link
              href={`/w/${wid}/vurderinger`}
              className="text-muted-foreground hover:text-foreground inline-flex min-h-[44px] items-center gap-1 rounded-lg px-2 text-xs font-semibold sm:min-h-0"
            >
              Alle
              <ArrowRight className="size-3" aria-hidden />
            </Link>
          </div>
          {recentlyUpdated.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/50 bg-muted/15 px-4 py-6 text-center ring-1 ring-black/[0.03] dark:ring-white/[0.05]">
              <p className="text-muted-foreground text-sm">
                Ingen aktivitet ennå — opprett en vurdering.
              </p>
              <Link
                href={`/w/${wid}/vurderinger`}
                className="text-primary mt-2 inline-flex text-sm font-medium underline-offset-4 hover:underline"
              >
                Opprett vurdering
              </Link>
            </div>
          ) : (
            <ul className="space-y-2">
              {recentlyUpdated.map((row) => (
                <li key={`r-${row.assessmentId}`}>
                  <AssessmentDashRow wid={wid} row={row} showTime />
                </li>
              ))}
            </ul>
          )}
        </section>
        ) : null}
      </div>
      ) : null}
    </div>
  );
}

function AssessmentDashRow({
  wid,
  row,
  showTime,
}: {
  wid: string;
  row: {
    assessmentId: Id<"assessments">;
    title: string;
    updatedAt: number;
    pipelineStatus: PipelineStatus;
    effectivePriority: number;
    rosLinked?: boolean;
    hasRosLink: boolean;
    ownerName: string | null;
    nextStepHint: string;
  };
  showTime?: boolean;
}) {
  return (
    <Link
      href={`/w/${wid}/a/${row.assessmentId}`}
      className="hover:border-primary/30 flex min-h-[52px] flex-col gap-1 rounded-2xl border border-border/45 bg-card p-3 text-left shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-black/[0.03] transition-all hover:bg-muted/30 dark:ring-white/[0.05]"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="line-clamp-2 min-w-0 font-medium leading-snug">
          {row.title}
        </span>
        <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
          {row.effectivePriority.toFixed(1)}
        </span>
      </div>
      <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
        <span>{PIPELINE_STATUS_LABELS[row.pipelineStatus]}</span>
        {!(row.rosLinked ?? row.hasRosLink) ? (
          <span className="text-amber-800 dark:text-amber-200">· Uten ROS</span>
        ) : (
          <span>· ROS koblet</span>
        )}
        {row.ownerName ? <span>· {row.ownerName}</span> : null}
        {showTime ? (
          <span className="inline-flex items-center gap-0.5">
            <Clock className="size-3 opacity-70" aria-hidden />
            {new Date(row.updatedAt).toLocaleString("nb-NO", {
              dateStyle: "short",
              timeStyle: "short",
            })}
          </span>
        ) : null}
      </div>
      <p className="text-muted-foreground line-clamp-2 text-xs leading-snug">
        {row.nextStepHint}
      </p>
    </Link>
  );
}
