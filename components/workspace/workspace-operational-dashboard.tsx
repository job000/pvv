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
  ArrowRight,
  ClipboardList,
  Clock3,
  PlayCircle,
  ShieldAlert,
  ShieldPlus,
  Workflow,
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

function dashboardMetricTone(tone: "warning" | "action" | "neutral"): string {
  switch (tone) {
    case "warning":
      return "bg-amber-500/[0.08] ring-amber-500/25";
    case "action":
      return "bg-primary/[0.06] ring-primary/20";
    default:
      return "bg-card ring-black/[0.04] dark:ring-white/[0.06]";
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
  /** Kort forklaring for skjermleser / tooltip — ikke vises som avsnitt (mindre støy). */
  hint: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  tone: "warning" | "action" | "neutral";
}) {
  return (
    <Link
      href={href}
      title={hint}
      className={cn(
        "group block rounded-2xl p-4 shadow-sm ring-1 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
        dashboardMetricTone(tone),
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {title}
          </p>
          <p className="font-heading mt-2 text-3xl font-semibold tracking-tight text-foreground">
            {value}
          </p>
          <p className="mt-2 text-xs font-medium text-muted-foreground">{status}</p>
        </div>
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-background/80 shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.08]">
          <Icon className="size-4.5 text-foreground/80 transition-transform group-hover:scale-110" />
        </div>
      </div>
    </Link>
  );
}

/**
 * Hvor primærkortet «Én ting å gjøre nå» leder:
 * - `ros_dialog` → bli på dashboard, ROS-popup (`?kobleRos=1`) — ikke vurderingssiden.
 * - `assessment` → åpne konkret vurdering (`/w/.../a/...`).
 * - `vurderinger_list` → listen over vurderinger.
 */
type PrimaryFocusNavigation =
  | "ros_dialog"
  | "assessment"
  | "vurderinger_list";

function focusCardLinkTitle(target: PrimaryFocusNavigation): string {
  switch (target) {
    case "ros_dialog":
      return "Koble ROS: dialog på oversikten. Oppfølging og «sist arbeid» åpner vurderingen direkte.";
    case "assessment":
      return "Åpne vurderingen";
    case "vurderinger_list":
      return "Gå til vurderinger";
  }
}

function FocusActionCard({
  eyebrow,
  title,
  detail,
  href,
  cta,
  icon: Icon,
  tone = "default",
  emphasize,
  navigationTarget,
}: {
  eyebrow: string;
  title: string;
  /** Valgfri — skjul når tom for mindre tekstmasse */
  detail: string;
  href: string;
  cta: string;
  icon: ComponentType<{ className?: string }>;
  tone?: "default" | "warning" | "action";
  /** Primærkort — større type og tydeligere CTA */
  emphasize?: boolean;
  navigationTarget: PrimaryFocusNavigation;
}) {
  const linkTitle = focusCardLinkTitle(navigationTarget);
  const iconWrapClass =
    tone === "warning"
      ? "bg-amber-500/10 text-amber-900 ring-amber-500/20 dark:text-amber-100"
      : tone === "action"
        ? "bg-primary/10 text-primary ring-primary/20"
        : "bg-muted/80 text-foreground ring-border/60";

  if (emphasize) {
    return (
      <Link
        href={href}
        title={linkTitle}
        className={cn(
          "group bg-card flex gap-4 rounded-2xl border p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md sm:gap-5 sm:p-5",
          tone === "warning"
            ? "border-amber-500/35"
            : tone === "action"
              ? "border-primary/25"
              : "border-border/70",
        )}
      >
        <div
          className={cn(
            "flex size-12 shrink-0 items-center justify-center rounded-2xl ring-1 sm:size-14",
            iconWrapClass,
          )}
          aria-hidden
        >
          <Icon className="size-6 sm:size-7 transition-transform duration-200 group-hover:scale-105" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {eyebrow}
          </p>
          <p className="mt-2 text-base font-semibold leading-snug text-foreground sm:text-lg">
            {title}
          </p>
          {detail ? (
            <p className="mt-1.5 line-clamp-2 text-xs leading-snug text-muted-foreground sm:text-sm">
              {detail}
            </p>
          ) : null}
          <div className="mt-4 inline-flex items-center gap-1 text-base font-semibold text-foreground">
            {cta}
            <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={href}
      title={linkTitle}
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
          {detail ? (
            <p className="mt-1.5 line-clamp-2 text-xs leading-snug text-muted-foreground">
              {detail}
            </p>
          ) : null}
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
    withoutRosLinkCount,
    onHoldCount,
    readyForPrioritizationCount,
    assessmentsWithoutRos,
    readyForPrioritization,
    blockedItems,
    priorityTop,
    recentlyUpdated,
  } = dash;

  const latestWork = recentlyUpdated[0] ?? priorityTop[0] ?? null;
  const rosTarget = assessmentsWithoutRos[0] ?? null;
  const nextActionTarget =
    readyForPrioritization[0] ?? assessmentsWithoutRos[0] ?? priorityTop[0] ?? null;
  /** Oppfølging uten å falle tilbake til samme sak som ROS-kortet når det finnes egne «neste steg». */
  const followUpRow =
    readyForPrioritization[0] ??
    blockedItems[0] ??
    null;

  const followUpCount = readyForPrioritizationCount + onHoldCount;

  type PrimaryKey = "ros" | "followup" | "recent" | "start";
  const primarySpec: {
    key: PrimaryKey;
    /** Styrer href — kun `ros` bruker ROS-dialog på dashboard; ikke bland med vurderingslenker. */
    navigationTarget: PrimaryFocusNavigation;
    eyebrow: string;
    title: string;
    detail: string;
    href: string;
    cta: string;
    icon: ComponentType<{ className?: string }>;
    tone: "default" | "warning" | "action";
  } = (() => {
    if (withoutRosLinkCount > 0 && rosTarget) {
      return {
        key: "ros",
        navigationTarget: "ros_dialog",
        eyebrow: "Gjør dette først",
        title: rosTarget.title,
        detail:
          withoutRosLinkCount === 1
            ? "Mangler ROS-kobling"
            : `${withoutRosLinkCount} vurderinger uten ROS`,
        href: `/w/${wid}?kobleRos=1&assessmentId=${rosTarget.assessmentId}`,
        cta: "Koble ROS",
        icon: ShieldPlus,
        tone: "warning",
      };
    }
    if (followUpCount > 0 && nextActionTarget) {
      return {
        key: "followup",
        navigationTarget: "assessment",
        eyebrow: "Gjør dette først",
        title: nextActionTarget.title,
        detail: nextActionTarget.nextStepHint,
        href: `/w/${wid}/a/${nextActionTarget.assessmentId}`,
        cta: "Fortsett",
        icon: PlayCircle,
        tone: "action",
      };
    }
    if (latestWork) {
      return {
        key: "recent",
        navigationTarget: "assessment",
        eyebrow: "Sist du jobbet med",
        title: latestWork.title,
        detail: formatRelativeUpdatedAt(latestWork.updatedAt),
        href: `/w/${wid}/a/${latestWork.assessmentId}`,
        cta: "Åpne",
        icon: ClipboardList,
        tone: "default",
      };
    }
    return {
      key: "start",
      navigationTarget: "vurderinger_list",
      eyebrow: "Kom i gang",
      title: "Opprett eller åpne en vurdering",
      detail: "",
      href: `/w/${wid}/vurderinger`,
      cta: "Til vurderinger",
      icon: ClipboardList,
      tone: "default",
    };
  })();

  return (
    <div className="space-y-6">
      {showMetrics ? (
        <section className="space-y-4" aria-labelledby="workspace-focus-heading">
          <div className="rounded-3xl border border-border/50 bg-card/80 p-4 shadow-sm sm:p-5">
            <div className="space-y-4">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h2
                  id="workspace-focus-heading"
                  className="font-heading text-lg font-semibold tracking-tight text-foreground sm:text-xl"
                >
                  Fokus nå
                </h2>
                <p className="text-sm text-muted-foreground">
                  Én anbefalt handling og noen få nøkkeltall.
                </p>
              </div>

              <FocusActionCard
                eyebrow={primarySpec.eyebrow}
                title={primarySpec.title}
                detail={primarySpec.detail}
                href={primarySpec.href}
                cta={primarySpec.cta}
                icon={primarySpec.icon}
                tone={primarySpec.tone}
                navigationTarget={primarySpec.navigationTarget}
                emphasize
              />

              <div
                className="flex flex-wrap gap-x-5 gap-y-2 border-t border-black/[0.06] pt-4 text-sm dark:border-white/[0.08]"
                aria-label="Andre snarveier"
              >
                {primarySpec.key !== "ros" && withoutRosLinkCount > 0 && rosTarget ? (
                  <Link
                    href={`/w/${wid}?kobleRos=1&assessmentId=${rosTarget.assessmentId}`}
                    className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 font-medium transition-colors"
                  >
                    <ShieldPlus className="size-3.5 text-amber-600 dark:text-amber-400" aria-hidden />
                    Uten ROS ({withoutRosLinkCount})
                    <ArrowRight className="size-3.5 opacity-60" aria-hidden />
                  </Link>
                ) : null}
                {primarySpec.key !== "followup" && followUpCount > 0 ? (
                  <Link
                    href={
                      followUpRow
                        ? `/w/${wid}/a/${followUpRow.assessmentId}`
                        : `/w/${wid}/vurderinger`
                    }
                    className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 font-medium transition-colors"
                  >
                    <PlayCircle className="size-3.5 text-primary" aria-hidden />
                    Trenger oppfølging ({followUpCount})
                    <ArrowRight className="size-3.5 opacity-60" aria-hidden />
                  </Link>
                ) : null}
                {primarySpec.key !== "recent" && latestWork ? (
                  <Link
                    href={`/w/${wid}/a/${latestWork.assessmentId}`}
                    className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 font-medium transition-colors"
                  >
                    <ClipboardList className="size-3.5" aria-hidden />
                    Sist arbeid
                    <ArrowRight className="size-3.5 opacity-60" aria-hidden />
                  </Link>
                ) : null}
                {withoutRosLinkCount === 0 ? (
                  <Link
                    href={`/w/${wid}/ros`}
                    className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 font-medium transition-colors"
                  >
                    ROS-oversikt
                    <ArrowRight className="size-3.5 opacity-60" aria-hidden />
                  </Link>
                ) : null}
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <DashboardMetricCard
              title="Uten ROS"
              value={withoutRosLinkCount}
              status={withoutRosLinkCount > 0 ? "Trenger handling" : "Ingen åpne mangler"}
              hint={
                withoutRosLinkCount > 0
                  ? "Vurderinger som mangler ROS-kobling — klikk for liste."
                  : "Alle synlige vurderinger har ROS der det trengs."
              }
              href={`/w/${wid}/vurderinger`}
              icon={ShieldAlert}
              tone={withoutRosLinkCount > 0 ? "warning" : "neutral"}
            />
            <DashboardMetricCard
              title="Neste steg"
              value={readyForPrioritizationCount}
              status={readyForPrioritizationCount > 0 ? "Klar for prioritering" : "Ingen åpne"}
              hint={
                readyForPrioritizationCount > 0
                  ? "Klare for prioritering eller beslutning."
                  : "Ingen vurderinger venter på neste steg."
              }
              href={`/w/${wid}/vurderinger`}
              icon={PlayCircle}
              tone={readyForPrioritizationCount > 0 ? "action" : "neutral"}
            />
            <DashboardMetricCard
              title="Prosesser"
              value="Åpne"
              status="Register og dokumentasjon"
              hint={
                onHoldCount > 0
                  ? "Prosessregisteret med prosesser, dokumentasjon og koblinger."
                  : "Prosessregisteret med prosesser, dokumentasjon og koblinger."
              }
              href={`/w/${wid}/vurderinger?fane=prosesser`}
              icon={Workflow}
              tone="neutral"
            />
          </div>
        </section>
      ) : null}

      {showPriority || showRecent ? (
        <div
          className={
            showPriority && showRecent
              ? "grid gap-4 xl:grid-cols-2"
              : "grid max-w-3xl gap-4"
          }
        >
          {showPriority ? (
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-heading text-base font-semibold tracking-tight">
                  Prioriter nå
                </h2>
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
                <h2 className="font-heading text-base font-semibold tracking-tight">
                  Sist jobbet med
                </h2>
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
          <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </div>
      </div>

      <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
        <span>{PIPELINE_STATUS_LABELS[row.pipelineStatus]}</span>
        {row.ownerName ? <span>{row.ownerName}</span> : null}
      </div>

      <div className="bg-muted/25 flex items-start gap-2 rounded-xl px-3 py-2">
        {rosLinked ? (
          <PlayCircle className="text-primary mt-0.5 size-3.5 shrink-0" aria-hidden />
        ) : (
          <ShieldAlert
            className="mt-0.5 size-3.5 shrink-0 text-amber-700 dark:text-amber-300"
            aria-hidden
          />
        )}
        <p className="line-clamp-2 text-xs leading-snug text-foreground/90 sm:line-clamp-1">
          {row.nextStepHint}
        </p>
      </div>
    </Link>
  );
}
