"use client";

import {
  type ComponentType,
  type CSSProperties,
  useEffect,
  useMemo,
  useState,
} from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { RpaLifecycleGuide } from "@/components/workspace/rpa-lifecycle-guide";
import { formatRelativeUpdatedAt } from "@/lib/assessment-ui-helpers";
import {
  dedupeDashboardRows,
  filterHomeRowsByScope,
  homeNextActionForAssessment,
  type HomeQueueScope,
  isRosDue,
  sortByHomeUrgency,
} from "@/lib/home-next-action";
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
/** Oversikt er sted — kort pek, ikke full arbeidskø. */
const OVERVIEW_PEEK = 3;

export type WorkspaceHomeListPrefs = {
  viewMode: ListViewMode;
  pageSize: HomeListPageSize;
  queueScope: HomeQueueScope;
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
  navigationTarget: PrimaryFocusNavigation;
}) {
  const warning = tone === "warning";
  return (
    <Link
      href={href}
      className={cn(
        "group relative flex flex-col gap-5 overflow-hidden rounded-[1.75rem] border px-5 py-5 transition-[border-color,box-shadow,transform] sm:flex-row sm:items-center sm:justify-between sm:gap-8 sm:px-7 sm:py-7",
        "hover:-translate-y-0.5 hover:shadow-[var(--shadow-elevated)]",
        warning
          ? "border-amber-500/25 bg-gradient-to-br from-amber-500/[0.08] via-card to-card"
          : "border-border/50 bg-gradient-to-br from-primary/[0.06] via-card to-card",
      )}
    >
      <div className="relative flex min-w-0 flex-1 items-start gap-4 sm:items-center">
        <span
          className={cn(
            "mt-0.5 grid size-12 shrink-0 place-items-center rounded-2xl shadow-sm ring-1 ring-black/[0.04] sm:mt-0 dark:ring-white/[0.06]",
            warning
              ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
              : "bg-background/90 text-foreground",
          )}
          aria-hidden
        >
          <Icon className="size-5 sm:size-[1.35rem]" />
        </span>
        <div className="min-w-0 space-y-1.5">
          <p
            className={cn(
              "text-[11px] font-semibold tracking-[0.08em] uppercase",
              warning
                ? "text-amber-700 dark:text-amber-400"
                : "text-muted-foreground",
            )}
          >
            {eyebrow}
          </p>
          <p className="line-clamp-2 text-xl font-semibold tracking-[-0.02em] text-foreground sm:text-2xl">
            {title}
          </p>
          {detail ? (
            <p className="line-clamp-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
              {detail}
            </p>
          ) : null}
        </div>
      </div>
      <span
        className={cn(
          "relative inline-flex h-12 w-full shrink-0 items-center justify-center gap-2 rounded-2xl px-6 text-sm font-semibold transition-opacity sm:w-auto sm:rounded-full",
          warning
            ? "bg-amber-600 text-white group-hover:opacity-95 dark:bg-amber-500"
            : "bg-foreground text-background group-hover:opacity-90",
        )}
      >
        {cta}
        <ArrowRight
          className="size-4 transition-transform group-hover:translate-x-0.5"
          aria-hidden
        />
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
  const myProfile = useQuery(api.users.getMyProfile);
  const myUserId = myProfile?.user?._id as Id<"users"> | undefined;
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
    homeListPrefs?.pageSize ?? 6,
  );
  const [queueScope, setQueueScope] = useState<HomeQueueScope>(
    homeListPrefs?.queueScope ?? "mine",
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
    setQueueScope(homeListPrefs.queueScope);
  }, [homeListPrefs]);

  const persistHomeList = (next: {
    viewMode: ListViewMode;
    pageSize: HomeListPageSize;
    queueScope: HomeQueueScope;
  }) => {
    setViewMode(next.viewMode);
    setPageSize(next.pageSize);
    setQueueScope(next.queueScope);
    void setHomeListPrefs({
      workspaceId,
      homeListViewMode: next.viewMode,
      homeListPageSize: next.pageSize,
      homeQueueScope: next.queueScope,
    });
  };

  const showFocus = sectionVisibility?.showMetrics !== false;
  const showPriority = sectionVisibility?.showPrioritySection !== false;
  const showRecent = sectionVisibility?.showRecentSection !== false;

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

  const followUpCount = readyForPrioritizationCount + onHoldCount;

  /** Unike saker fra alle køer — én rad per vurdering. */
  const uniqueRows = dedupeDashboardRows([
    ...blockedItems,
    ...readyForPrioritization,
    ...assessmentsWithoutRos,
    ...(showPriority ? priorityTop : []),
    ...(showRecent ? recentlyUpdated : []),
  ]);
  /** Personlig kø som standard — unngår støy når mange jobber i samme område. */
  const scopedRows = filterHomeRowsByScope(uniqueRows, queueScope, myUserId);
  const rankedActions = sortByHomeUrgency(scopedRows, wid);
  const rosDueRows = scopedRows
    .filter((r) => isRosDue(r.pipelineStatus, r.rosLinked))
    .sort((a, b) => b.effectivePriority - a.effectivePriority);
  const scopedReady = filterHomeRowsByScope(
    readyForPrioritization,
    queueScope,
    myUserId,
  );
  const scopedBlocked = filterHomeRowsByScope(
    blockedItems,
    queueScope,
    myUserId,
  );
  const scopedRecent = filterHomeRowsByScope(
    recentlyUpdated,
    queueScope,
    myUserId,
  );
  const scopedPriority = filterHomeRowsByScope(
    priorityTop,
    queueScope,
    myUserId,
  );
  const latestWork = scopedRecent[0] ?? scopedPriority[0] ?? null;
  const nextNeedsAssessment =
    rankedActions.find((x) => x.row.pipelineStatus === "not_assessed")?.row ??
    null;
  const nextReadyPrio = scopedReady[0] ?? null;
  const nextRosDue = rosDueRows[0] ?? null;
  const nextOnHold = scopedBlocked[0] ?? null;
  const totalScopedActions = rankedActions.length;

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
  // Forslag er områdesak — vis aggregat i Deretter bare når man ser hele området.
  if (
    queueScope === "all" &&
    pendingIntake.length > 0 &&
    primarySpec.key !== "intake"
  ) {
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
  let skippedPrimary = false;
  for (const { row, action } of rankedActions) {
    if (actionItems.length >= OVERVIEW_PEEK) break;
    if (
      primaryAssessmentId != null &&
      row.assessmentId === primaryAssessmentId
    ) {
      skippedPrimary = true;
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
  const remainingAfterCap = Math.max(
    0,
    totalScopedActions -
      (skippedPrimary ? 1 : 0) -
      actionItems.filter((i) => i.key !== "intake-queue").length,
  );

  const actionKeys = new Set(actionItems.map((i) => i.key));
  const recentPeek = scopedRecent
    .filter((r) => r.assessmentId !== primaryAssessmentId)
    .filter((r) => !actionKeys.has(String(r.assessmentId)))
    .slice(0, OVERVIEW_PEEK)
    .map((r) => ({
      key: String(r.assessmentId),
      title: r.title,
      href: `/w/${wid}/a/${r.assessmentId}`,
      meta: formatRelativeUpdatedAt(r.updatedAt),
    }));

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
          : `/w/${wid}/tavler`,
      emphasize: followUpCount > 0,
    },
  ] as const;

  const destinations = [
    { label: "Vurderinger", href: `/w/${wid}/vurderinger`, hint: "Saker og status" },
    { label: "Oppgaver", href: `/w/${wid}/oppgaver`, hint: "Det du skal gjøre" },
    { label: "Organisasjon", href: `/w/${wid}/organisasjon`, hint: "Enheter og struktur" },
    { label: "Risiko", href: `/w/${wid}/ros`, hint: "ROS og analyser" },
  ] as const;

  return (
    <div className="relative mx-auto max-w-2xl space-y-8 sm:max-w-3xl sm:space-y-10 lg:max-w-4xl">
      {showFocus ? (
        <section
          className="product-rise space-y-4"
          style={{ "--rise-delay": "0.05s" } as CSSProperties}
          aria-labelledby="workspace-focus-heading"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2
              id="workspace-focus-heading"
              className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase"
            >
              Neste steg
            </h2>
            <div
              role="group"
              aria-label="Visning"
              className="bg-muted/70 inline-flex rounded-full p-0.5 ring-1 ring-border/40"
            >
              {(
                [
                  ["mine", "Mine"],
                  ["all", "Hele området"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={queueScope === id}
                  onClick={() =>
                    persistHomeList({
                      viewMode,
                      pageSize,
                      queueScope: id,
                    })
                  }
                  className={cn(
                    "min-h-8 rounded-full px-3 text-xs font-medium transition-colors touch-manipulation",
                    queueScope === id
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
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
          />

          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {overviewStats.map((s) => (
              <Link
                key={s.label}
                href={s.href}
                className={cn(
                  "rounded-2xl border px-3 py-3 transition-colors sm:px-4 sm:py-3.5",
                  s.emphasize
                    ? "border-primary/20 bg-primary/[0.06] hover:bg-primary/[0.1]"
                    : "border-border/40 bg-muted/30 hover:bg-muted/50",
                )}
              >
                <p className="text-muted-foreground text-[11px] font-medium tracking-wide">
                  {s.label}
                </p>
                <p
                  className={cn(
                    "mt-1 text-2xl font-semibold tracking-tight tabular-nums",
                    s.emphasize ? "text-foreground" : "text-foreground/85",
                  )}
                >
                  {s.value}
                </p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {showPriority && actionItems.length > 0 ? (
        <section
          className="product-rise space-y-3"
          style={{ "--rise-delay": "0.1s" } as CSSProperties}
          aria-labelledby="overview-also-heading"
        >
          <div className="flex items-baseline justify-between gap-3">
            <h2
              id="overview-also-heading"
              className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase"
            >
              Også aktuelt
            </h2>
            {remainingAfterCap > 0 ? (
              <Link
                href={`/w/${wid}/vurderinger`}
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs font-medium"
              >
                Alle
                <ArrowRight className="size-3" aria-hidden />
              </Link>
            ) : null}
          </div>
          <ul className="overflow-hidden rounded-2xl border border-border/40 bg-card/60">
            {actionItems.map((item, i) => (
              <li
                key={item.key}
                className={cn(i > 0 && "border-t border-border/30")}
              >
                <Link
                  href={item.href}
                  className="group flex min-h-14 items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/40"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {item.title}
                    </p>
                    <p className="text-muted-foreground mt-0.5 truncate text-xs">
                      {item.reason}
                      {item.meta ? ` · ${item.meta}` : null}
                    </p>
                  </div>
                  <ArrowRight
                    className="text-muted-foreground size-4 shrink-0 opacity-25 transition-all group-hover:translate-x-0.5 group-hover:opacity-70"
                    aria-hidden
                  />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {showRecent && recentPeek.length > 0 ? (
        <section
          className="product-rise space-y-3"
          style={{ "--rise-delay": "0.14s" } as CSSProperties}
          aria-labelledby="overview-recent-heading"
        >
          <h2
            id="overview-recent-heading"
            className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase"
          >
            Sist i arbeid
          </h2>
          <ul className="flex flex-wrap gap-2">
            {recentPeek.map((item) => (
              <li key={item.key}>
                <Link
                  href={item.href}
                  className="hover:border-border hover:bg-card inline-flex max-w-full items-center gap-2 rounded-full border border-border/40 bg-muted/25 py-1.5 pr-3 pl-3 text-sm transition-colors"
                >
                  <span className="truncate font-medium text-foreground">
                    {item.title}
                  </span>
                  {item.meta ? (
                    <span className="text-muted-foreground shrink-0 text-[11px]">
                      {item.meta}
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <nav
        className="product-rise"
        style={{ "--rise-delay": "0.16s" } as CSSProperties}
        aria-label="Gå videre i området"
      >
        <h2 className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
          Utforsk
        </h2>
        <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {destinations.map((d) => (
            <li key={d.href}>
              <Link
                href={d.href}
                className="group flex h-full flex-col justify-between rounded-2xl border border-border/40 bg-card/50 px-3.5 py-3 transition-colors hover:border-border hover:bg-card"
              >
                <span className="text-sm font-medium text-foreground">
                  {d.label}
                </span>
                <span className="text-muted-foreground mt-1 text-[11px] leading-snug">
                  {d.hint}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {!lifecycleHidden ? (
        <div
          className="product-rise"
          style={{ "--rise-delay": "0.18s" } as CSSProperties}
        >
          <RpaLifecycleGuide
            workspaceId={workspaceId}
            onHide={() => setLifecycleHidden(true)}
          />
        </div>
      ) : (
        <p className="product-rise text-center">
          <button
            type="button"
            onClick={() => setLifecycleHidden(false)}
            className="text-muted-foreground/70 hover:text-muted-foreground text-[11px] underline-offset-2 touch-manipulation hover:underline"
          >
            Slik fungerer RPA-flyten
          </button>
        </p>
      )}
    </div>
  );
}
