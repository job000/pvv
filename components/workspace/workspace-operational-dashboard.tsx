"use client";

import { type ComponentType, useEffect, useMemo, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { ListViewModeToggle } from "@/components/ui/list-view-mode-toggle";
import { RpaLifecycleGuide } from "@/components/workspace/rpa-lifecycle-guide";
import { formatRelativeUpdatedAt } from "@/lib/assessment-ui-helpers";
import {
  dedupeDashboardRows,
  homeNextActionForAssessment,
  isRosDue,
  sortByHomeUrgency,
} from "@/lib/home-next-action";
import type { ListViewMode } from "@/lib/list-view-mode";
import { RPA_LIFECYCLE_STAGES } from "@/lib/rpa-lifecycle";
import { useStickyState } from "@/lib/use-sticky-state";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  ClipboardList,
  Inbox,
  PlayCircle,
  ShieldPlus,
} from "lucide-react";
import Link from "next/link";

type HomeListPageSize = 6 | 10 | 20;

export type WorkspaceHomeListPrefs = {
  viewMode: ListViewMode;
  pageSize: HomeListPageSize;
};

/**
 * Hvor primærkortet leder:
 * - `ros_dialog` → ROS-popup på oversikten
 * - `assessment` → konkret vurdering
 * - `vurderinger_list` / `intake` → liste / skjemaer
 */
type PrimaryFocusNavigation =
  | "ros_dialog"
  | "assessment"
  | "vurderinger_list"
  | "intake";

type ActionItem = {
  key: string;
  title: string;
  reason: string;
  href: string;
  meta?: string;
};

function FocusActionCard({
  eyebrow,
  title,
  detail,
  href,
  cta,
}: {
  eyebrow: string;
  title: string;
  detail: string;
  href: string;
  cta: string;
  icon: ComponentType<{ className?: string }>;
  tone?: "default" | "warning" | "action";
  navigationTarget: PrimaryFocusNavigation;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-3 rounded-2xl border border-border/50 bg-card px-4 py-4 transition-colors hover:bg-muted/25 sm:flex-row sm:items-center sm:justify-between sm:px-5"
    >
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground">{eyebrow}</p>
        <p className="mt-1 truncate text-base font-semibold tracking-tight text-foreground sm:text-lg">
          {title}
        </p>
        {detail ? (
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
            {detail}
          </p>
        ) : null}
      </div>
      <span className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-full bg-foreground px-4 text-sm font-semibold text-background transition-opacity group-hover:opacity-90 sm:h-10">
        {cta}
        <ArrowRight className="size-3.5" aria-hidden />
      </span>
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
  homeListPrefs,
}: {
  workspaceId: Id<"workspaces">;
  /** Udefinert felt = synlig (standard). */
  sectionVisibility?: WorkspaceDashboardSectionVisibility;
  /** Fra brukerens visningsinnstillinger (kort / liste / tabell). */
  homeListPrefs?: WorkspaceHomeListPrefs;
}) {
  const dash = useQuery(api.assessments.workspaceDashboard, { workspaceId });
  const intakeQueue = useQuery(api.intakeSubmissions.listByWorkspace, {
    workspaceId,
  });
  const setHomeListPrefs = useMutation(
    api.workspaceViewPrefs.setMyHomeListPrefs,
  );
  const wid = String(workspaceId);
  /** Skjult som standard — guide, ikke status. Ny nøkkel så gamle «vis»-valg ikke åpner den. */
  const [lifecycleHidden, setLifecycleHidden] = useStickyState(
    `ws:${wid}:rpa-lifecycle-guide-hidden`,
    true,
  );
  const [viewMode, setViewMode] = useState<ListViewMode>(
    homeListPrefs?.viewMode ?? "list",
  );
  const [pageSize, setPageSize] = useState<HomeListPageSize>(
    homeListPrefs?.pageSize ?? 10,
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash === "#rpa-livssyklus" && lifecycleHidden) {
      setLifecycleHidden(false);
    }
  }, [lifecycleHidden, setLifecycleHidden]);

  useEffect(() => {
    if (!homeListPrefs) return;
    setViewMode(homeListPrefs.viewMode);
    setPageSize(homeListPrefs.pageSize);
  }, [homeListPrefs]);

  const persistHomeList = (next: {
    viewMode: ListViewMode;
    pageSize: HomeListPageSize;
  }) => {
    setViewMode(next.viewMode);
    setPageSize(next.pageSize);
    void setHomeListPrefs({
      workspaceId,
      homeListViewMode: next.viewMode,
      homeListPageSize: next.pageSize,
    });
  };

  const showFocus = sectionVisibility?.showMetrics !== false;
  const showPriority = sectionVisibility?.showPrioritySection !== false;
  const showRecent = sectionVisibility?.showRecentSection !== false;
  const showActions = showPriority || showRecent;

  const pendingIntake = useMemo(
    () =>
      (intakeQueue ?? []).filter(
        (s) => s.status === "submitted" || s.status === "under_review",
      ),
    [intakeQueue],
  );

  if (dash === undefined) {
    return (
      <div className="space-y-4">
        <div className="bg-muted/30 h-24 animate-pulse rounded-2xl" />
        <div className="bg-muted/20 h-20 animate-pulse rounded-2xl" />
        <div className="bg-muted/20 h-40 animate-pulse rounded-2xl" />
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
  const followUpCount = readyForPrioritizationCount + onHoldCount;

  /** Unike saker fra alle køer — én rad per vurdering. */
  const uniqueRows = dedupeDashboardRows([
    ...blockedItems,
    ...readyForPrioritization,
    ...assessmentsWithoutRos,
    ...(showPriority ? priorityTop : []),
    ...(showRecent ? recentlyUpdated : []),
  ]);
  const rankedActions = sortByHomeUrgency(uniqueRows, wid);
  const rosDueRows = uniqueRows
    .filter((r) => isRosDue(r.pipelineStatus, r.rosLinked))
    .sort((a, b) => b.effectivePriority - a.effectivePriority);
  const nextNeedsAssessment =
    rankedActions.find((x) => x.row.pipelineStatus === "not_assessed")?.row ??
    null;
  const nextReadyPrio = readyForPrioritization[0] ?? null;
  const nextRosDue = rosDueRows[0] ?? null;
  const nextOnHold = blockedItems[0] ?? null;

  const primarySpec: {
    key: string;
    navigationTarget: PrimaryFocusNavigation;
    eyebrow: string;
    title: string;
    detail: string;
    href: string;
    cta: string;
    icon: ComponentType<{ className?: string }>;
    tone: "default" | "warning" | "action";
  } = (() => {
    // Livssyklus: forslag → fullfør vurdering → prioriter → ROS/design → …
    if (pendingIntake.length > 0) {
      const first = pendingIntake[0]!;
      return {
        key: "intake",
        navigationTarget: "intake",
        eyebrow: "Steg 1 · Identifisering",
        title:
          pendingIntake.length === 1
            ? first.formTitle || "Nytt forslag"
            : `${pendingIntake.length} forslag venter`,
        detail:
          pendingIntake.length === 1
            ? "Gå gjennom forslaget og opprett vurdering"
            : "Start med det eldste forslaget",
        href: `/w/${wid}/skjemaer`,
        cta: "Åpne forslag",
        icon: Inbox,
        tone: "action",
      };
    }
    if (nextNeedsAssessment) {
      const action = homeNextActionForAssessment(nextNeedsAssessment, wid);
      return {
        key: "assess",
        navigationTarget: "assessment",
        eyebrow: "Gjør dette først",
        title: nextNeedsAssessment.title,
        detail: action.meta,
        href: action.href,
        cta: "Fullfør vurdering",
        icon: ClipboardList,
        tone: "action",
      };
    }
    if (nextReadyPrio) {
      return {
        key: "prioritize",
        navigationTarget: "assessment",
        eyebrow: "Gjør dette først",
        title: nextReadyPrio.title,
        detail: "Vurderingen er ferdig — prioriter neste steg i porteføljen",
        href: `/w/${wid}/a/${nextReadyPrio.assessmentId}`,
        cta: "Prioriter",
        icon: PlayCircle,
        tone: "action",
      };
    }
    if (nextRosDue) {
      if (rosDueRows.length === 1) {
        return {
          key: "ros",
          navigationTarget: "ros_dialog",
          eyebrow: "Steg 3 · Design",
          title: nextRosDue.title,
          detail: "Koble ROS før utvikling",
          href: `/w/${wid}/a/${nextRosDue.assessmentId}?kobleRos=1`,
          cta: "Koble ROS",
          icon: ShieldPlus,
          tone: "warning",
        };
      }
      return {
        key: "ros-list",
        navigationTarget: "vurderinger_list",
        eyebrow: "Steg 3 · Design",
        title: `${rosDueRows.length} vurderinger mangler ROS`,
        detail: "Prioritert arbeid uten ROS-kobling",
        href: `/w/${wid}/vurderinger?utenRos=1`,
        cta: "Se listen",
        icon: ShieldPlus,
        tone: "warning",
      };
    }
    if (nextOnHold) {
      return {
        key: "hold",
        navigationTarget: "assessment",
        eyebrow: "Gjør dette først",
        title: nextOnHold.title,
        detail: nextOnHold.nextStepHint,
        href: `/w/${wid}/a/${nextOnHold.assessmentId}`,
        cta: "Avklar",
        icon: PlayCircle,
        tone: "warning",
      };
    }
    if (latestWork) {
      const action = homeNextActionForAssessment(latestWork, wid);
      return {
        key: "recent",
        navigationTarget: "assessment",
        eyebrow: "Fortsett der du slapp",
        title: latestWork.title,
        detail: action.meta || formatRelativeUpdatedAt(latestWork.updatedAt),
        href: action.href,
        cta: "Åpne",
        icon: ClipboardList,
        tone: "default",
      };
    }
    return {
      key: "start",
      navigationTarget: "vurderinger_list",
      eyebrow: "Kom i gang",
      title: "Opprett en vurdering",
      detail: "Start med steg 2: vurder kandidaten, deretter prioritering og ROS",
      href: `/w/${wid}/vurderinger`,
      cta: "Til vurderinger",
      icon: ClipboardList,
      tone: "default",
    };
  })();

  /** Unngå at samme sak vises både som «gjør først» og i listen under. */
  const primaryAssessmentId =
    primarySpec.key === "assess"
      ? nextNeedsAssessment?.assessmentId
      : primarySpec.key === "prioritize"
        ? nextReadyPrio?.assessmentId
        : primarySpec.key === "ros"
          ? nextRosDue?.assessmentId
          : primarySpec.key === "hold"
            ? nextOnHold?.assessmentId
            : primarySpec.key === "recent"
              ? latestWork?.assessmentId
              : undefined;

  const actionItems: ActionItem[] = [];
  if (pendingIntake.length > 0 && primarySpec.key !== "intake") {
    actionItems.push({
      key: "intake-queue",
      title:
        pendingIntake.length === 1
          ? pendingIntake[0]!.formTitle || "Forslag"
          : `${pendingIntake.length} forslag til gjennomgang`,
      reason: "Steg 1 · Identifisering",
      href: `/w/${wid}/skjemaer`,
      meta: pendingIntake.length === 1 ? "Venter" : undefined,
    });
  }
  for (const { row, action } of rankedActions) {
    if (actionItems.length >= pageSize) break;
    if (
      primaryAssessmentId != null &&
      row.assessmentId === primaryAssessmentId
    ) {
      continue;
    }
    actionItems.push({
      key: String(row.assessmentId),
      title: row.title,
      reason: action.reason,
      href: action.href,
      meta: action.meta,
    });
  }

  const FLOW_SHORT: Record<number, string> = {
    1: "Identifisering",
    2: "Vurdering",
    3: "Design",
    4: "Utvikling",
    5: "Testing",
    6: "Produksjon",
    7: "Drift",
  };

  const overviewStats = [
    {
      label: "Forslag",
      value: pendingIntake.length,
      href: `/w/${wid}/skjemaer`,
      emphasize: pendingIntake.length > 0,
    },
    {
      label: "Uten ROS",
      value: withoutRosLinkCount,
      href:
        withoutRosLinkCount > 0
          ? `/w/${wid}/vurderinger?utenRos=1`
          : `/w/${wid}/ros`,
      /** Fremhev bare når ROS er neste steg (etter prioritering) */
      emphasize: rosDueRows.length > 0,
    },
    {
      label: "Oppfølging",
      value: followUpCount,
      href: nextReadyPrio
        ? `/w/${wid}/a/${nextReadyPrio.assessmentId}`
        : nextOnHold
          ? `/w/${wid}/a/${nextOnHold.assessmentId}`
          : `/w/${wid}/puls`,
      emphasize: followUpCount > 0,
    },
  ] as const;

  const highlightedFlowStage =
    primarySpec.key === "intake"
      ? 1
      : primarySpec.key === "assess" || primarySpec.key === "prioritize"
        ? 2
        : primarySpec.key === "ros" || primarySpec.key === "ros-list"
          ? 3
          : primarySpec.key === "hold"
            ? 2
            : null;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <section
        className="space-y-2"
        aria-labelledby="home-flow-heading"
      >
        <div className="flex items-center justify-between gap-2">
          <h2
            id="home-flow-heading"
            className="text-muted-foreground text-xs font-medium"
          >
            Flyt
            {highlightedFlowStage != null ? (
              <span className="text-foreground">
                {" "}
                · steg {highlightedFlowStage}
              </span>
            ) : null}
          </h2>
          <button
            type="button"
            onClick={() => setLifecycleHidden(!lifecycleHidden)}
            className="text-muted-foreground hover:text-foreground shrink-0 text-xs font-medium underline-offset-2 hover:underline"
          >
            {lifecycleHidden ? "Guide" : "Skjul guide"}
          </button>
        </div>
        <ol className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {RPA_LIFECYCLE_STAGES.map((stage) => (
            <li key={stage.id} className="shrink-0">
              <span
                className={cn(
                  "inline-flex whitespace-nowrap rounded-lg px-2 py-1 text-[11px] font-medium",
                  highlightedFlowStage === stage.index
                    ? "bg-foreground text-background"
                    : "bg-muted/50 text-muted-foreground",
                )}
                title={stage.summary}
              >
                {stage.index}. {FLOW_SHORT[stage.index] ?? stage.title}
              </span>
            </li>
          ))}
        </ol>
      </section>

      {!lifecycleHidden ? (
        <RpaLifecycleGuide
          workspaceId={workspaceId}
          onHide={() => setLifecycleHidden(true)}
        />
      ) : null}

      {showFocus ? (
        <section className="space-y-3" aria-labelledby="workspace-focus-heading">
          <h2 id="workspace-focus-heading" className="sr-only">
            Anbefalt handling
          </h2>
          <FocusActionCard
            eyebrow={primarySpec.eyebrow}
            title={primarySpec.title}
            detail={primarySpec.detail}
            href={primarySpec.href}
            cta={primarySpec.cta}
            icon={primarySpec.icon}
            tone={primarySpec.tone}
            navigationTarget={primarySpec.navigationTarget}
          />

          <div className="flex flex-wrap gap-2">
            {overviewStats.map((s) => (
              <Link
                key={s.label}
                href={s.href}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors",
                  s.emphasize
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                )}
              >
                <span className="tabular-nums font-semibold">{s.value}</span>
                {s.label}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {showActions && actionItems.length > 0 ? (
        <section className="space-y-3" aria-labelledby="home-actions-heading">
          <div className="flex items-center justify-between gap-3">
            <h2
              id="home-actions-heading"
              className="text-sm font-semibold tracking-tight text-foreground"
            >
              Deretter
            </h2>
            <ListViewModeToggle
              value={viewMode}
              onChange={(next) =>
                persistHomeList({ viewMode: next, pageSize })
              }
              showSelect={false}
              showIcons
            />
          </div>

          {viewMode === "cards" ? (
            <ul className="grid gap-2 sm:grid-cols-2">
              {actionItems.map((item) => (
                <li key={item.key} className="min-w-0">
                  <Link
                    href={item.href}
                    className="hover:bg-muted/25 flex h-full flex-col gap-2 rounded-xl border border-border/50 bg-card p-3.5 transition-colors"
                  >
                    <p className="line-clamp-2 text-sm font-semibold">
                      {item.title}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {item.reason}
                      {item.meta ? ` · ${item.meta}` : null}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          ) : viewMode === "table" ? (
            <div className="-mx-1 overflow-x-auto px-1">
              <table className="w-full min-w-[26rem] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-border/50 text-xs text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Sak</th>
                    <th className="px-3 py-2 font-medium">Neste</th>
                  </tr>
                </thead>
                <tbody>
                  {actionItems.map((item) => (
                    <tr
                      key={item.key}
                      className="border-b border-border/30 last:border-0"
                    >
                      <td className="px-3 py-2.5">
                        <Link
                          href={item.href}
                          className="font-medium text-foreground underline-offset-2 hover:underline"
                        >
                          {item.title}
                        </Link>
                      </td>
                      <td className="text-muted-foreground px-3 py-2.5 text-xs">
                        {item.reason}
                        {item.meta ? ` · ${item.meta}` : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <ul className="divide-y divide-border/40 overflow-hidden rounded-xl border border-border/50 bg-card">
              {actionItems.map((item) => (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    className="hover:bg-muted/25 flex min-h-12 items-center gap-3 px-3.5 py-2.5 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {item.title}
                      </p>
                      <p className="text-muted-foreground truncate text-xs">
                        {item.reason}
                        {item.meta ? ` · ${item.meta}` : null}
                      </p>
                    </div>
                    <ArrowRight
                      className="text-muted-foreground size-4 shrink-0 opacity-40"
                      aria-hidden
                    />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {showActions && actionItems.length === 0 && showFocus ? (
        <p className="text-muted-foreground text-center text-sm">
          Ingen flere køer —{" "}
          <Link
            href={`/w/${wid}/vurderinger`}
            className="text-foreground font-medium underline-offset-2 hover:underline"
          >
            alle vurderinger
          </Link>
        </p>
      ) : null}
    </div>
  );
}
