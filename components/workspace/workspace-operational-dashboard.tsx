"use client";

import { type ComponentType, useEffect, useMemo, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { ListViewModeToggle } from "@/components/ui/list-view-mode-toggle";
import { RpaLifecycleGuide } from "@/components/workspace/rpa-lifecycle-guide";
import { formatRelativeUpdatedAt } from "@/lib/assessment-ui-helpers";
import type { ListViewMode } from "@/lib/list-view-mode";
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
    homeListPrefs?.viewMode ?? "cards",
  );
  const [pageSize, setPageSize] = useState<HomeListPageSize>(
    homeListPrefs?.pageSize ?? 6,
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
  const rosTarget = assessmentsWithoutRos[0] ?? null;
  const followUpCount = readyForPrioritizationCount + onHoldCount;
  const nextFollowUp =
    readyForPrioritization[0] ?? blockedItems[0] ?? null;

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
    // Flaskehals først: ventende forslag før ROS/oppfølging
    if (pendingIntake.length > 0) {
      const first = pendingIntake[0]!;
      return {
        key: "intake",
        navigationTarget: "intake",
        eyebrow: "Gjør dette først",
        title:
          pendingIntake.length === 1
            ? first.formTitle || "Nytt forslag"
            : `${pendingIntake.length} forslag venter`,
        detail:
          pendingIntake.length === 1
            ? "Til gjennomgang i skjemaer"
            : "Start med det eldste — identifisering er først i flyten",
        href: `/w/${wid}/skjemaer`,
        cta: "Åpne forslag",
        icon: Inbox,
        tone: "action",
      };
    }
    if (withoutRosLinkCount > 0 && rosTarget) {
      // Én sak → koblingsdialog. Flere → liste (ikke anta hvilken av N).
      if (withoutRosLinkCount === 1) {
        return {
          key: "ros",
          navigationTarget: "ros_dialog",
          eyebrow: "Gjør dette først",
          title: rosTarget.title,
          detail: "Mangler ROS-kobling",
          href: `/w/${wid}/a/${rosTarget.assessmentId}?kobleRos=1`,
          cta: "Koble ROS",
          icon: ShieldPlus,
          tone: "warning",
        };
      }
      return {
        key: "ros-list",
        navigationTarget: "vurderinger_list",
        eyebrow: "Gjør dette først",
        title: `${withoutRosLinkCount} vurderinger uten ROS`,
        detail: "Åpne listen og velg hvilken vurdering du vil koble.",
        href: `/w/${wid}/vurderinger?utenRos=1`,
        cta: "Se listen",
        icon: ShieldPlus,
        tone: "warning",
      };
    }
    if (followUpCount > 0 && nextFollowUp) {
      return {
        key: "followup",
        navigationTarget: "assessment",
        eyebrow: "Gjør dette først",
        title: nextFollowUp.title,
        detail: nextFollowUp.nextStepHint,
        href: `/w/${wid}/a/${nextFollowUp.assessmentId}`,
        cta: "Fortsett",
        icon: PlayCircle,
        tone: "action",
      };
    }
    if (latestWork) {
      return {
        key: "recent",
        navigationTarget: "assessment",
        eyebrow: "Fortsett der du slapp",
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

  /** Kø + valgfritt prioritet/aktivitet, begrenset av sidevisning. */
  const actionItems: ActionItem[] = [];
  const seen = new Set<string>();

  const push = (item: ActionItem) => {
    if (actionItems.length >= pageSize) return;
    if (seen.has(item.key)) return;
    seen.add(item.key);
    actionItems.push(item);
  };

  if (pendingIntake.length > 0) {
    push({
      key: "intake-queue",
      title:
        pendingIntake.length === 1
          ? pendingIntake[0]!.formTitle || "Forslag"
          : `${pendingIntake.length} forslag til gjennomgang`,
      reason: "Identifisering",
      href: `/w/${wid}/skjemaer`,
      meta: pendingIntake.length === 1 ? "Venter" : undefined,
    });
  }

  for (const row of assessmentsWithoutRos) {
    push({
      key: `ros-${row.assessmentId}`,
      title: row.title,
      reason: "Mangler ROS",
      href: `/w/${wid}/a/${row.assessmentId}?kobleRos=1`,
      meta: "Koble ROS",
    });
  }

  for (const row of readyForPrioritization) {
    push({
      key: `prio-${row.assessmentId}`,
      title: row.title,
      reason: "Klar for prioritering",
      href: `/w/${wid}/a/${row.assessmentId}`,
      meta: row.nextStepHint,
    });
  }

  for (const row of blockedItems) {
    push({
      key: `hold-${row.assessmentId}`,
      title: row.title,
      reason: "På vent / blokkert",
      href: `/w/${wid}/a/${row.assessmentId}`,
      meta: row.nextStepHint,
    });
  }

  if (showPriority) {
    for (const row of priorityTop) {
      push({
        key: `top-${row.assessmentId}`,
        title: row.title,
        reason: "Prioritet",
        href: `/w/${wid}/a/${row.assessmentId}`,
        meta: row.nextStepHint,
      });
    }
  }

  if (showRecent) {
    for (const row of recentlyUpdated) {
      push({
        key: `recent-${row.assessmentId}`,
        title: row.title,
        reason: "Sist oppdatert",
        href: `/w/${wid}/a/${row.assessmentId}`,
        meta: formatRelativeUpdatedAt(row.updatedAt),
      });
    }
  }
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
      emphasize: withoutRosLinkCount > 0,
    },
    {
      label: "Oppfølging",
      value: followUpCount,
      href: nextFollowUp
        ? `/w/${wid}/a/${nextFollowUp.assessmentId}`
        : `/w/${wid}/puls`,
      emphasize: followUpCount > 0,
    },
  ] as const;

  return (
    <div
      className={cn(
        "mx-auto space-y-5 sm:space-y-6",
        viewMode === "table" ? "max-w-4xl" : "max-w-2xl",
      )}
    >
      {lifecycleHidden ? (
        <button
          type="button"
          onClick={() => setLifecycleHidden(false)}
          className="text-muted-foreground hover:text-foreground inline-flex min-h-9 items-center gap-2 rounded-full border border-border/40 px-3 text-xs font-medium touch-manipulation"
        >
          Vis guide: slik fungerer RPA
        </button>
      ) : (
        <RpaLifecycleGuide
          workspaceId={workspaceId}
          onHide={() => setLifecycleHidden(true)}
        />
      )}

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

          <div className="grid grid-cols-3 gap-2">
            {overviewStats.map((s) => (
              <Link
                key={s.label}
                href={s.href}
                className={cn(
                  "rounded-xl border px-3 py-2.5 text-center transition-colors touch-manipulation",
                  s.emphasize
                    ? "border-foreground/20 bg-card hover:bg-muted/30"
                    : "border-border/40 bg-muted/10 text-muted-foreground hover:bg-muted/20",
                )}
              >
                <p
                  className={cn(
                    "text-lg font-semibold tabular-nums",
                    s.emphasize ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {s.value}
                </p>
                <p className="text-[11px] font-medium">{s.label}</p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {showActions ? (
        <section className="space-y-3" aria-labelledby="home-actions-heading">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <h2
                id="home-actions-heading"
                className="font-heading text-base font-semibold tracking-tight"
              >
                Ta tak i først
              </h2>
              <p className="text-muted-foreground text-xs">
                Kø etter hva som stopper flyten — ikke hele tavlen.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ListViewModeToggle
                value={viewMode}
                onChange={(next) =>
                  persistHomeList({ viewMode: next, pageSize })
                }
              />
              <Link
                href={`/w/${wid}/puls`}
                className="text-muted-foreground hover:text-foreground shrink-0 text-xs font-medium underline-offset-2 hover:underline"
              >
                Puls
              </Link>
            </div>
          </div>

          {actionItems.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/50 px-4 py-8 text-center">
              <p className="text-sm font-medium text-foreground">
                Ingen kritiske køer akkurat nå
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                Fortsett i vurderinger eller Puls når du er klar.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <Link
                  href={`/w/${wid}/vurderinger`}
                  className="inline-flex h-10 items-center rounded-full bg-foreground px-4 text-xs font-semibold text-background"
                >
                  Vurderinger
                </Link>
                <Link
                  href={`/w/${wid}/puls`}
                  className="inline-flex h-10 items-center rounded-full border border-border/50 px-4 text-xs font-medium"
                >
                  Puls
                </Link>
              </div>
            </div>
          ) : viewMode === "cards" ? (
            <ul className="grid gap-3 sm:grid-cols-2">
              {actionItems.map((item) => (
                <li key={item.key} className="min-w-0">
                  <Link
                    href={item.href}
                    className="hover:bg-muted/25 flex h-full min-h-24 flex-col justify-between gap-3 rounded-2xl border border-border/50 bg-card p-4 touch-manipulation transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="line-clamp-2 text-sm font-semibold">
                        {item.title}
                      </p>
                      <p className="text-muted-foreground mt-1.5 text-xs">
                        {item.reason}
                        {item.meta ? ` · ${item.meta}` : null}
                      </p>
                    </div>
                    <span className="text-muted-foreground inline-flex items-center gap-1 text-xs font-medium">
                      Åpne
                      <ArrowRight className="size-3.5 opacity-60" aria-hidden />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : viewMode === "table" ? (
            <div className="-mx-1 overflow-x-auto overscroll-x-contain px-1">
              <table className="w-full min-w-[28rem] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-border/50 text-xs text-muted-foreground">
                    <th className="px-3 py-2.5 font-medium">Sak</th>
                    <th className="px-3 py-2.5 font-medium">Hvorfor</th>
                    <th className="px-3 py-2.5 font-medium">Detalj</th>
                  </tr>
                </thead>
                <tbody>
                  {actionItems.map((item) => (
                    <tr
                      key={item.key}
                      className="border-b border-border/30 last:border-0"
                    >
                      <td className="px-3 py-3">
                        <Link
                          href={item.href}
                          className="font-semibold text-foreground underline-offset-2 hover:underline"
                        >
                          {item.title}
                        </Link>
                      </td>
                      <td className="text-muted-foreground px-3 py-3 whitespace-nowrap">
                        {item.reason}
                      </td>
                      <td className="text-muted-foreground px-3 py-3">
                        {item.meta ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <ul className="divide-y divide-border/40 overflow-hidden rounded-2xl border border-border/50 bg-card">
              {actionItems.map((item) => (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    className="hover:bg-muted/25 flex min-h-14 items-center gap-3 px-3.5 py-3 touch-manipulation transition-colors sm:px-4"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {item.title}
                      </p>
                      <p className="text-muted-foreground mt-0.5 truncate text-xs">
                        {item.reason}
                        {item.meta ? ` · ${item.meta}` : null}
                      </p>
                    </div>
                    <ArrowRight
                      className="text-muted-foreground size-4 shrink-0 opacity-50"
                      aria-hidden
                    />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
