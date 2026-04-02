"use client";

import type { ComponentType } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import {
  PIPELINE_STATUS_LABELS,
  type PipelineStatus,
} from "@/lib/assessment-pipeline";
import {
  formatRelativeUpdatedAt,
  priorityBandBadgeClass,
  priorityBandLabel,
  priorityBorderAccentClass,
} from "@/lib/assessment-ui-helpers";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  ClipboardList,
  Clock3,
  PauseCircle,
  PlayCircle,
  ShieldAlert,
  ShieldPlus,
  Sparkles,
  Users,
} from "lucide-react";
import Link from "next/link";

type DashboardRow = {
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

function dashboardMetricTone(
  tone: "good" | "warning" | "action" | "neutral",
): string {
  switch (tone) {
    case "good":
      return "bg-emerald-500/[0.07] ring-emerald-500/20";
    case "warning":
      return "bg-amber-500/[0.08] ring-amber-500/25";
    case "action":
      return "bg-primary/[0.06] ring-primary/20";
    default:
      return "bg-card ring-black/[0.04] dark:ring-white/[0.06]";
  }
}

function metricStatusClass(tone: "good" | "warning" | "action" | "neutral") {
  switch (tone) {
    case "good":
      return "bg-emerald-500/12 text-emerald-900 dark:text-emerald-100";
    case "warning":
      return "bg-amber-500/14 text-amber-950 dark:text-amber-100";
    case "action":
      return "bg-primary/12 text-primary";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function DashboardMetricCard({
  title,
  value,
  status,
  hint,
  href,
  icon: Icon,
  tone,
}: {
  title: string;
  value: string | number;
  status: string;
  hint: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  tone: "good" | "warning" | "action" | "neutral";
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group block rounded-2xl p-4 shadow-sm ring-1 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
        dashboardMetricTone(tone),
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {title}
          </p>
          <p className="font-heading mt-2 text-3xl font-semibold tracking-tight text-foreground">
            {value}
          </p>
        </div>
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-background/80 shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.08]">
          <Icon className="size-4.5 text-foreground/80 transition-transform group-hover:scale-110" />
        </div>
      </div>
      <div className="mt-3 space-y-2">
        <span
          className={cn(
            "inline-flex rounded-lg px-2 py-1 text-[10px] font-semibold",
            metricStatusClass(tone),
          )}
        >
          {status}
        </span>
        <p className="text-sm leading-snug text-muted-foreground">{hint}</p>
      </div>
    </Link>
  );
}

function FocusActionCard({
  eyebrow,
  title,
  detail,
  href,
  cta,
  icon: Icon,
  tone = "default",
}: {
  eyebrow: string;
  title: string;
  detail: string;
  href: string;
  cta: string;
  icon: ComponentType<{ className?: string }>;
  tone?: "default" | "warning" | "action";
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group rounded-2xl p-4 ring-1 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
        tone === "warning"
          ? "bg-amber-500/[0.07] ring-amber-500/20"
          : tone === "action"
            ? "bg-primary/[0.06] ring-primary/20"
            : "bg-background/85 ring-black/[0.04] dark:ring-white/[0.06]",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {eyebrow}
          </p>
          <p className="mt-2 text-sm font-semibold leading-snug text-foreground">
            {title}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {detail}
          </p>
        </div>
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-card shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.08]">
          <Icon className="size-4.5 text-foreground/80 transition-transform group-hover:scale-110" />
        </div>
      </div>
      <div className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-foreground">
        {cta}
        <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
      </div>
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
    readyForPrioritizationCount,
    assessmentsWithoutRos,
    readyForPrioritization,
    priorityTop,
    recentlyUpdated,
  } = dash;

  const latestWork = recentlyUpdated[0] ?? priorityTop[0] ?? null;
  const rosTarget = assessmentsWithoutRos[0] ?? null;
  const nextActionTarget =
    readyForPrioritization[0] ?? assessmentsWithoutRos[0] ?? priorityTop[0] ?? null;

  const followUpCount = readyForPrioritizationCount + onHoldCount;

  return (
    <div className="space-y-8">
      {showMetrics ? (
        <section className="space-y-4" aria-labelledby="workspace-focus-heading">
          <div className="rounded-3xl bg-gradient-to-br from-primary/[0.08] via-background to-amber-500/[0.05] p-5 shadow-sm ring-1 ring-black/[0.05] dark:ring-white/[0.06]">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-2xl space-y-3">
                <div className="inline-flex items-center gap-2 rounded-full bg-background/80 px-3 py-1 text-[11px] font-semibold text-muted-foreground shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.08]">
                  <Sparkles className="size-3.5 text-primary" />
                  Fokus nå
                </div>
                <div>
                  <h2
                    id="workspace-focus-heading"
                    className="font-heading text-xl font-semibold tracking-tight text-foreground sm:text-2xl"
                  >
                    Her er det viktigste å gjøre videre
                  </h2>
                  <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
                    Dashboardet er prioritert rundt neste steg: arbeid som mangler ROS,
                    vurderinger som trenger oppfølging og det siste du jobbet med.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 lg:w-[38rem]">
                <FocusActionCard
                  eyebrow="Mangler ROS"
                  title={
                    withoutRosLinkCount > 0
                      ? `${withoutRosLinkCount} vurdering${withoutRosLinkCount === 1 ? "" : "er"} uten ROS`
                      : "Alle vurderinger har ROS koblet"
                  }
                  detail={
                    rosTarget
                      ? `Neste forslag: ${rosTarget.title}`
                      : "Ingen åpne ROS-koblinger å følge opp akkurat nå."
                  }
                  href={
                    rosTarget
                      ? `/w/${wid}/a/${rosTarget.assessmentId}`
                      : `/w/${wid}/ros`
                  }
                  cta={withoutRosLinkCount > 0 ? "Legg til ROS" : "Åpne ROS"}
                  icon={ShieldPlus}
                  tone={withoutRosLinkCount > 0 ? "warning" : "default"}
                />
                <FocusActionCard
                  eyebrow="Trenger oppfølging"
                  title={
                    followUpCount > 0
                      ? `${followUpCount} vurdering${followUpCount === 1 ? "" : "er"} trenger neste steg`
                      : "Ingen saker står i kø akkurat nå"
                  }
                  detail={
                    nextActionTarget
                      ? nextActionTarget.nextStepHint
                      : "Teamet er ajour med synlige vurderinger."
                  }
                  href={
                    nextActionTarget
                      ? `/w/${wid}/a/${nextActionTarget.assessmentId}`
                      : `/w/${wid}/vurderinger`
                  }
                  cta="Fortsett vurdering"
                  icon={PlayCircle}
                  tone={followUpCount > 0 ? "action" : "default"}
                />
                <FocusActionCard
                  eyebrow="Sist arbeid"
                  title={
                    latestWork
                      ? `Fortsett med ${latestWork.title}`
                      : "Start den første vurderingen"
                  }
                  detail={
                    latestWork
                      ? formatRelativeUpdatedAt(latestWork.updatedAt)
                      : "Opprett en vurdering og bygg porteføljen videre."
                  }
                  href={
                    latestWork
                      ? `/w/${wid}/a/${latestWork.assessmentId}`
                      : `/w/${wid}/vurderinger`
                  }
                  cta={latestWork ? "Åpne siste arbeid" : "Start ny vurdering"}
                  icon={ClipboardList}
                  tone="default"
                />
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <DashboardMetricCard
              title="Uten ROS"
              value={withoutRosLinkCount}
              status={withoutRosLinkCount > 0 ? "Trenger handling" : "Bra"}
              hint={
                withoutRosLinkCount > 0
                  ? "Disse vurderingene bør kobles til ROS før de blir liggende."
                  : "Ingen åpne vurderinger mangler ROS-kobling."
              }
              href={`/w/${wid}/vurderinger`}
              icon={ShieldAlert}
              tone={withoutRosLinkCount > 0 ? "warning" : "good"}
            />
            <DashboardMetricCard
              title="Klar for neste steg"
              value={readyForPrioritizationCount}
              status={readyForPrioritizationCount > 0 ? "Gå videre" : "Ingen kø"}
              hint={
                readyForPrioritizationCount > 0
                  ? "Vurderinger som er modne for prioritering eller videre beslutning."
                  : "Ingen vurderinger venter på neste beslutning akkurat nå."
              }
              href={`/w/${wid}/vurderinger`}
              icon={PlayCircle}
              tone={readyForPrioritizationCount > 0 ? "action" : "neutral"}
            />
            <DashboardMetricCard
              title="På vent"
              value={onHoldCount}
              status={onHoldCount > 0 ? "Blokkert" : "Under kontroll"}
              hint={
                onHoldCount > 0
                  ? "Saker som står stille og trenger oppklaring."
                  : "Ingen synlige vurderinger er satt på vent."
              }
              href={`/w/${wid}/vurderinger`}
              icon={PauseCircle}
              tone={onHoldCount > 0 ? "warning" : "good"}
            />
            <DashboardMetricCard
              title="Prosesser"
              value="Åpne"
              status="Navigasjon"
              hint="Gå til prosessregisteret før du starter nye vurderinger."
              href={`/w/${wid}/vurderinger?fane=prosesser`}
              icon={Users}
              tone="neutral"
            />
          </div>
        </section>
      ) : null}

      {showPriority || showRecent ? (
        <div
          className={
            showPriority && showRecent
              ? "grid gap-6 xl:grid-cols-2"
              : "grid max-w-3xl gap-6"
          }
        >
          {showPriority ? (
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Prioritering
                  </p>
                  <h2 className="font-heading mt-1 text-base font-semibold tracking-tight">
                    Høyeste prioritet
                  </h2>
                </div>
                <Link
                  href={`/w/${wid}/vurderinger`}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
                >
                  Alle
                  <ArrowRight className="size-3" />
                </Link>
              </div>
              {priorityTop.length === 0 ? (
                <EmptyState wid={wid} />
              ) : (
                <ul className="space-y-3">
                  {priorityTop.map((row, index) => (
                    <li key={row.assessmentId}>
                      <AssessmentDashRow
                        wid={wid}
                        row={row}
                        emphasize={index === 0}
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
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Aktivitet
                  </p>
                  <h2 className="font-heading mt-1 text-base font-semibold tracking-tight">
                    Sist oppdatert
                  </h2>
                </div>
                <Link
                  href={`/w/${wid}/vurderinger`}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
                >
                  Alle
                  <ArrowRight className="size-3" />
                </Link>
              </div>
              {recentlyUpdated.length === 0 ? (
                <EmptyState wid={wid} />
              ) : (
                <ul className="space-y-3">
                  {recentlyUpdated.map((row, index) => (
                    <li key={`r-${row.assessmentId}`}>
                      <AssessmentDashRow
                        wid={wid}
                        row={row}
                        showTime
                        emphasize={index === 0}
                      />
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

function EmptyState({ wid }: { wid: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border/50 bg-muted/10 px-4 py-8 text-center ring-1 ring-black/[0.03] dark:ring-white/[0.05]">
      <p className="text-sm text-muted-foreground">Ingen vurderinger ennå.</p>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
        <Link
          href={`/w/${wid}/vurderinger`}
          className="inline-flex items-center gap-1 rounded-xl bg-foreground px-3 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-90"
        >
          Start ny vurdering
          <ArrowRight className="size-3.5" />
        </Link>
        <Link
          href={`/w/${wid}/vurderinger?fane=prosesser`}
          className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          Se prosesser
        </Link>
      </div>
    </div>
  );
}

function AssessmentDashRow({
  wid,
  row,
  showTime,
  emphasize,
}: {
  wid: string;
  row: DashboardRow;
  showTime?: boolean;
  emphasize?: boolean;
}) {
  const priority = priorityBandLabel(row.effectivePriority);
  const rosLinked = row.rosLinked ?? row.hasRosLink;

  return (
    <Link
      href={`/w/${wid}/a/${row.assessmentId}`}
      className={cn(
        "group flex min-h-[88px] flex-col gap-3 rounded-2xl border-l-4 bg-card p-4 shadow-sm ring-1 ring-black/[0.04] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:ring-white/[0.06]",
        priorityBorderAccentClass(row.effectivePriority),
        emphasize
          ? "ring-primary/20 shadow-md"
          : "border-border/40",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "rounded-lg border px-2 py-1 text-[10px] font-semibold",
                priorityBandBadgeClass(row.effectivePriority),
              )}
            >
              {priority.short}
            </span>
            {!rosLinked ? (
              <span className="rounded-lg bg-amber-500/12 px-2 py-1 text-[10px] font-semibold text-amber-950 dark:text-amber-100">
                Uten ROS
              </span>
            ) : null}
            {showTime ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                <Clock3 className="size-3" />
                {formatRelativeUpdatedAt(row.updatedAt)}
              </span>
            ) : null}
          </div>
          <p className="mt-2 line-clamp-2 text-sm font-semibold leading-snug text-foreground">
            {row.title}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {row.effectivePriority.toFixed(1)}
          </span>
          <ArrowUpRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
        <span>{PIPELINE_STATUS_LABELS[row.pipelineStatus]}</span>
        <span>· {rosLinked ? "ROS koblet" : "ROS mangler"}</span>
        {row.ownerName ? <span>· {row.ownerName}</span> : null}
      </div>

      <div className="flex items-start gap-2 rounded-xl bg-muted/25 px-3 py-2">
        {rosLinked ? (
          <PlayCircle className="mt-0.5 size-3.5 shrink-0 text-primary" />
        ) : (
          <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-amber-700 dark:text-amber-300" />
        )}
        <p className="line-clamp-2 text-xs leading-relaxed text-foreground/90">
          {row.nextStepHint}
        </p>
      </div>
    </Link>
  );
}
