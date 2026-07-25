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
  ChartColumn,
  ClipboardList,
  FolderKanban,
  Inbox,
  Kanban,
  ListChecks,
  PlayCircle,
  ScrollText,
  Shield,
  ShieldPlus,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

type HomeListPageSize = 6 | 10 | 20;
/** Flere pek enn før — oversikten skal føles som en cockpit, ikke én sak. */
const OVERVIEW_FOCUS_STACK = 5;
const OVERVIEW_TASK_PEEK = 4;

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
  | "intake"
  | "tasks";

type FocusSpec = {
  key: string;
  navigationTarget: PrimaryFocusNavigation;
  eyebrow: string;
  title: string;
  detail: string;
  href: string;
  cta: string;
  icon: ComponentType<{ className?: string }>;
  tone: "default" | "warning" | "action";
  assessmentId?: Id<"assessments">;
};

function formatMoneyCompact(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "0 kr";
  if (Math.abs(n) >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1).replace(".", ",")} mill.`;
  }
  if (Math.abs(n) >= 10_000) {
    return `${Math.round(n / 1000).toLocaleString("nb-NO")}k kr`;
  }
  return `${Math.round(n).toLocaleString("nb-NO")} kr`;
}

function FocusActionCard({
  eyebrow,
  title,
  detail,
  href,
  cta,
  icon: Icon,
  tone = "default",
  rank,
}: {
  eyebrow: string;
  title: string;
  detail: string;
  href: string;
  cta: string;
  icon: ComponentType<{ className?: string }>;
  tone?: "default" | "warning" | "action";
  navigationTarget: PrimaryFocusNavigation;
  rank?: number;
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
          : "border-border/50 bg-gradient-to-br from-primary/[0.07] via-card to-card",
      )}
    >
      <div
        className="pointer-events-none absolute -right-8 -top-10 size-40 rounded-full bg-foreground/[0.03] blur-2xl"
        aria-hidden
      />
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
            {rank != null ? `${rank}. ${eyebrow}` : eyebrow}
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

function SecondaryFocusCard({
  rank,
  title,
  detail,
  href,
  cta,
  tone = "default",
}: {
  rank: number;
  title: string;
  detail: string;
  href: string;
  cta: string;
  tone?: "default" | "warning" | "action";
}) {
  const warning = tone === "warning";
  return (
    <Link
      href={href}
      className={cn(
        "group flex min-h-[7.5rem] flex-col justify-between rounded-2xl border px-4 py-4 transition-[border-color,background-color,transform] touch-manipulation hover:-translate-y-0.5",
        warning
          ? "border-amber-500/20 bg-amber-500/[0.06] hover:bg-amber-500/[0.1]"
          : "border-border/45 bg-card/70 hover:border-border hover:bg-card",
      )}
    >
      <div className="min-w-0 space-y-1">
        <p className="text-muted-foreground text-[11px] font-semibold tabular-nums">
          Neste {rank}
        </p>
        <p className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
          {title}
        </p>
        {detail ? (
          <p className="text-muted-foreground line-clamp-2 text-xs leading-relaxed">
            {detail}
          </p>
        ) : null}
      </div>
      <span className="text-muted-foreground mt-3 inline-flex items-center gap-1 text-xs font-medium group-hover:text-foreground">
        {cta}
        <ArrowRight
          className="size-3.5 transition-transform group-hover:translate-x-0.5"
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

export type WorkspaceHomeListPrefs = {
  viewMode: ListViewMode;
  pageSize: HomeListPageSize;
  queueScope: HomeQueueScope;
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
  const tasks = useQuery(api.workspaceTasks.listMyInWorkspace, { workspaceId });
  const benefits = useQuery(api.portfolioBenefits.workspacePortfolio, {
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

  const openTasks = useMemo(() => {
    if (!tasks) return [];
    return tasks.mine.filter(
      (t) => t.myStatus === "pending" || t.myStatus === "accepted",
    );
  }, [tasks]);

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
    assessmentCount,
    withoutRosLinkCount,
    onHoldCount,
    readyForPrioritizationCount,
    assessmentsWithoutRos,
    readyForPrioritization,
    blockedItems,
    priorityTop,
    recentlyUpdated,
    pipelineCounts,
  } = dash;

  const followUpCount = readyForPrioritizationCount + onHoldCount;
  const inDeliveryCount =
    (pipelineCounts.development ?? 0) +
    (pipelineCounts.uat ?? 0) +
    (pipelineCounts.production ?? 0) +
    (pipelineCounts.monitoring ?? 0);

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
  const nextReadyPrio = scopedReady[0] ?? null;
  const nextOnHold = scopedBlocked[0] ?? null;

  /** Bygg en stabel med flere konkrete neste steg — ikke bare én hero. */
  const focusStack: FocusSpec[] = [];
  const usedAssessmentIds = new Set<string>();

  const pushFocus = (spec: FocusSpec) => {
    if (focusStack.length >= OVERVIEW_FOCUS_STACK) return;
    if (spec.assessmentId && usedAssessmentIds.has(String(spec.assessmentId))) {
      return;
    }
    if (spec.assessmentId) {
      usedAssessmentIds.add(String(spec.assessmentId));
    }
    focusStack.push(spec);
  };

  if (openTasks.length > 0) {
    const first = openTasks[0]!;
    pushFocus({
      key: "task",
      navigationTarget: "tasks",
      eyebrow:
        openTasks.length === 1
          ? "Oppgave venter"
          : `${openTasks.length} oppgaver venter`,
      title: first.title,
      detail:
        openTasks.length === 1
          ? first.contextTitle || "Ta imot eller fullfør oppgaven"
          : `Først: ${first.title}. Se hele køen under Oppgaver.`,
      href: `/w/${wid}/oppgaver`,
      cta: openTasks.length === 1 ? "Åpne oppgave" : "Se oppgavene",
      icon: ListChecks,
      tone: "action",
    });
  }

  if (pendingIntake.length > 0) {
    const first = pendingIntake[0]!;
    pushFocus({
      key: "intake",
      navigationTarget: "intake",
      eyebrow:
        pendingIntake.length === 1
          ? "Steg 1 · Identifisering"
          : `${pendingIntake.length} forslag venter`,
      title:
        pendingIntake.length === 1
          ? first.formTitle || "Nytt forslag"
          : `${pendingIntake.length} forslag til gjennomgang`,
      detail:
        pendingIntake.length === 1
          ? "Gå gjennom forslaget og opprett vurdering"
          : "Start med det eldste forslaget",
      href: `/w/${wid}/skjemaer`,
      cta: "Åpne forslag",
      icon: Inbox,
      tone: "action",
    });
  }

  for (const { row, action } of rankedActions) {
    if (focusStack.length >= OVERVIEW_FOCUS_STACK) break;
    pushFocus({
      key: `assess-${row.assessmentId}`,
      navigationTarget:
        action.urgency === 3 && isRosDue(row.pipelineStatus, row.rosLinked)
          ? "ros_dialog"
          : "assessment",
      eyebrow: action.reason,
      title: row.title,
      detail: action.meta || row.nextStepHint,
      href: action.href,
      cta:
        row.pipelineStatus === "not_assessed"
          ? "Fullfør vurdering"
          : row.pipelineStatus === "assessed"
            ? "Prioriter"
            : isRosDue(row.pipelineStatus, row.rosLinked)
              ? "Koble ROS"
              : "Åpne",
      icon:
        isRosDue(row.pipelineStatus, row.rosLinked)
          ? ShieldPlus
          : row.pipelineStatus === "assessed"
            ? PlayCircle
            : ClipboardList,
      tone:
        row.pipelineStatus === "on_hold" ||
        isRosDue(row.pipelineStatus, row.rosLinked)
          ? "warning"
          : "action",
      assessmentId: row.assessmentId,
    });
  }

  if (focusStack.length === 0 && latestWork) {
    const action = homeNextActionForAssessment(latestWork, wid);
    pushFocus({
      key: "recent",
      navigationTarget: "assessment",
      eyebrow: "Fortsett der du slapp",
      title: latestWork.title,
      detail: action.meta || formatRelativeUpdatedAt(latestWork.updatedAt),
      href: action.href,
      cta: "Åpne",
      icon: ClipboardList,
      tone: "default",
      assessmentId: latestWork.assessmentId,
    });
  }

  if (focusStack.length === 0) {
    pushFocus({
      key: "start",
      navigationTarget: "vurderinger_list",
      eyebrow: "Kom i gang",
      title: "Opprett en vurdering",
      detail:
        "Start med steg 2: vurder kandidaten, deretter prioritering og ROS",
      href: `/w/${wid}/vurderinger`,
      cta: "Til vurderinger",
      icon: ClipboardList,
      tone: "default",
    });
  }

  const primarySpec = focusStack[0]!;
  const secondaryFocus = focusStack.slice(1);

  const recentPeek = scopedRecent
    .filter((r) => !usedAssessmentIds.has(String(r.assessmentId)))
    .slice(0, 4)
    .map((r) => ({
      key: String(r.assessmentId),
      title: r.title,
      href: `/w/${wid}/a/${r.assessmentId}`,
      meta: formatRelativeUpdatedAt(r.updatedAt),
    }));

  const pulseStats = [
    {
      label: "Mine oppgaver",
      value: openTasks.length,
      href: `/w/${wid}/oppgaver`,
      emphasize: openTasks.length > 0,
    },
    {
      label: "Vurderinger",
      value: assessmentCount,
      href: `/w/${wid}/vurderinger`,
      emphasize: false,
    },
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
      emphasize: rosDueRows.length > 0,
    },
    {
      label: "I leveranse",
      value: inDeliveryCount,
      href: `/w/${wid}/tavler`,
      emphasize: inDeliveryCount > 0,
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

  const benefitCurrency = benefits?.totals.currencySavedPerYear ?? 0;
  const benefitHours = benefits?.totals.hoursSavedPerYear ?? 0;

  const destinations = [
    {
      label: "Oppgaver",
      href: `/w/${wid}/oppgaver`,
      hint: openTasks.length > 0 ? `${openTasks.length} åpne` : "Din kø",
      icon: ListChecks,
    },
    {
      label: "Vurderinger",
      href: `/w/${wid}/vurderinger`,
      hint: `${assessmentCount} i porteføljen`,
      icon: ClipboardList,
    },
    {
      label: "Tavler",
      href: `/w/${wid}/tavler`,
      hint: "Leveranse og flyt",
      icon: Kanban,
    },
    {
      label: "Gevinster",
      href: `/w/${wid}/gevinster`,
      hint:
        benefitCurrency > 0
          ? formatMoneyCompact(benefitCurrency)
          : "Potensial og tall",
      icon: ChartColumn,
    },
    {
      label: "Risiko",
      href: `/w/${wid}/ros`,
      hint: withoutRosLinkCount > 0 ? `${withoutRosLinkCount} uten ROS` : "ROS",
      icon: Shield,
    },
    {
      label: "Prosessdesign",
      href: `/w/${wid}/prosessdesign`,
      hint: "PDD og dokumentasjon",
      icon: ScrollText,
    },
    {
      label: "Skjemaer",
      href: `/w/${wid}/skjemaer`,
      hint:
        pendingIntake.length > 0
          ? `${pendingIntake.length} venter`
          : "Forslag inn",
      icon: Inbox,
    },
    {
      label: "Organisasjon",
      href: `/w/${wid}/organisasjon`,
      hint: "Enheter og ansvar",
      icon: FolderKanban,
    },
  ] as const;

  return (
    <div className="relative mx-auto w-full max-w-6xl space-y-8 sm:space-y-10">
      {showFocus ? (
        <section
          className="product-rise space-y-5"
          style={{ "--rise-delay": "0.05s" } as CSSProperties}
          aria-labelledby="workspace-focus-heading"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h2
                id="workspace-focus-heading"
                className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase"
              >
                Status nå
              </h2>
              <p className="text-muted-foreground mt-0.5 text-xs sm:text-sm">
                {queueScope === "mine"
                  ? "Ditt bilde av området — bytt til hele området for felles kø."
                  : "Hele områdets kø og tall."}
              </p>
            </div>
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
                    "min-h-9 rounded-full px-3.5 text-xs font-medium transition-colors touch-manipulation",
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

          <div className="-mx-1 flex gap-2 overflow-x-auto overscroll-x-contain px-1 pb-0.5 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 lg:grid-cols-6 [&::-webkit-scrollbar]:hidden">
            {pulseStats.map((s) => (
              <Link
                key={s.label}
                href={s.href}
                className={cn(
                  "min-w-[7.25rem] shrink-0 rounded-2xl border px-3 py-3 transition-colors touch-manipulation sm:min-w-0",
                  s.emphasize
                    ? "border-primary/25 bg-primary/[0.07] hover:bg-primary/[0.12]"
                    : "border-border/40 bg-muted/25 hover:bg-muted/45",
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

      {showFocus ? (
        <section
          className="product-rise space-y-3"
          style={{ "--rise-delay": "0.08s" } as CSSProperties}
          aria-labelledby="workspace-next-heading"
        >
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div className="min-w-0">
              <h2
                id="workspace-next-heading"
                className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase"
              >
                Neste steg
              </h2>
              <p className="text-muted-foreground mt-0.5 text-xs">
                {focusStack.length > 1
                  ? `${focusStack.length} ting å ta tak i — start øverst`
                  : "Én tydelig start"}
              </p>
            </div>
            {rankedActions.length > focusStack.length ? (
              <Link
                href={`/w/${wid}/vurderinger`}
                className="text-muted-foreground hover:text-foreground inline-flex min-h-9 items-center gap-1 text-xs font-medium"
              >
                Se alle vurderinger
                <ArrowRight className="size-3" aria-hidden />
              </Link>
            ) : null}
          </div>

          <FocusActionCard
            eyebrow={
              focusStack.length > 1
                ? "Gjør dette først"
                : primarySpec.eyebrow
            }
            title={primarySpec.title}
            detail={primarySpec.detail}
            href={primarySpec.href}
            cta={primarySpec.cta}
            icon={primarySpec.icon}
            tone={primarySpec.tone}
            navigationTarget={primarySpec.navigationTarget}
            rank={focusStack.length > 1 ? 1 : undefined}
          />

          {showPriority && secondaryFocus.length > 0 ? (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {secondaryFocus.map((item, idx) => (
                <SecondaryFocusCard
                  key={item.key}
                  rank={idx + 2}
                  title={item.title}
                  detail={item.detail || item.eyebrow}
                  href={item.href}
                  cta={item.cta}
                  tone={item.tone}
                />
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <section
          className="product-rise rounded-3xl border border-border/40 bg-card/50 p-4 sm:p-5"
          style={{ "--rise-delay": "0.11s" } as CSSProperties}
          aria-labelledby="overview-tasks-heading"
        >
          <div className="flex items-center justify-between gap-3">
            <h2
              id="overview-tasks-heading"
              className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase"
            >
              <ListChecks className="size-3.5" aria-hidden />
              Mine oppgaver
            </h2>
            <Link
              href={`/w/${wid}/oppgaver`}
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs font-medium"
            >
              Alle
              <ArrowRight className="size-3" aria-hidden />
            </Link>
          </div>
          {tasks === undefined ? (
            <div className="bg-muted/30 mt-4 h-24 animate-pulse rounded-2xl" />
          ) : openTasks.length === 0 ? (
            <p className="text-muted-foreground mt-4 text-sm leading-relaxed">
              Ingen åpne oppgaver tildelt deg akkurat nå.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-border/35">
              {openTasks.slice(0, OVERVIEW_TASK_PEEK).map((t) => (
                <li key={t.taskId}>
                  <Link
                    href={`/w/${wid}/oppgaver`}
                    className="group flex min-h-12 items-center gap-3 py-2.5 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {t.title}
                      </p>
                      <p className="text-muted-foreground truncate text-xs">
                        {t.myStatus === "pending" ? "Venter" : "Pågår"}
                        {t.contextTitle ? ` · ${t.contextTitle}` : ""}
                      </p>
                    </div>
                    <ArrowRight
                      className="text-muted-foreground size-4 shrink-0 opacity-30 transition-all group-hover:translate-x-0.5 group-hover:opacity-70"
                      aria-hidden
                    />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section
          className="product-rise relative overflow-hidden rounded-3xl border border-border/40 bg-gradient-to-br from-emerald-500/[0.08] via-card/80 to-card p-4 sm:p-5"
          style={{ "--rise-delay": "0.13s" } as CSSProperties}
          aria-labelledby="overview-benefits-heading"
        >
          <div
            className="pointer-events-none absolute -right-6 -bottom-8 size-36 rounded-full bg-emerald-500/10 blur-2xl"
            aria-hidden
          />
          <div className="relative flex items-center justify-between gap-3">
            <h2
              id="overview-benefits-heading"
              className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase"
            >
              <Sparkles className="size-3.5" aria-hidden />
              Gevinster
            </h2>
            <Link
              href={`/w/${wid}/gevinster`}
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs font-medium"
            >
              Åpne
              <ArrowRight className="size-3" aria-hidden />
            </Link>
          </div>
          {benefits === undefined ? (
            <div className="bg-muted/30 relative mt-4 h-24 animate-pulse rounded-2xl" />
          ) : benefits === null ? (
            <p className="text-muted-foreground relative mt-4 text-sm leading-relaxed">
              Kunne ikke laste gevinster.
            </p>
          ) : (
            <div className="relative mt-4 space-y-3">
              <div>
                <p className="text-muted-foreground text-xs">Årlig potensial</p>
                <p className="font-heading mt-0.5 text-3xl font-semibold tracking-tight tabular-nums text-foreground">
                  {formatMoneyCompact(benefitCurrency)}
                </p>
              </div>
              <p className="text-muted-foreground text-sm">
                {Math.round(benefitHours).toLocaleString("nb-NO")} t frigjort /
                år
                {benefits.assessmentCount > 0
                  ? ` · ${benefits.assessmentCount} kandidater`
                  : ""}
              </p>
              <Link
                href={`/w/${wid}/gevinster`}
                className="bg-foreground text-background inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold touch-manipulation"
              >
                Se gevinster
                <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            </div>
          )}
        </section>
      </div>

      {showRecent && recentPeek.length > 0 ? (
        <section
          className="product-rise space-y-3"
          style={{ "--rise-delay": "0.15s" } as CSSProperties}
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
                  className="hover:border-border hover:bg-card inline-flex max-w-full items-center gap-2 rounded-full border border-border/40 bg-muted/25 py-2 pr-3.5 pl-3.5 text-sm transition-colors touch-manipulation"
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
        style={{ "--rise-delay": "0.17s" } as CSSProperties}
        aria-label="Gå videre i området"
      >
        <h2 className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
          Utforsk
        </h2>
        <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {destinations.map((d) => {
            const Icon = d.icon;
            return (
              <li key={d.href}>
                <Link
                  href={d.href}
                  className="group flex h-full min-h-[5.5rem] flex-col justify-between rounded-2xl border border-border/40 bg-card/55 px-3.5 py-3.5 transition-colors hover:border-border hover:bg-card touch-manipulation"
                >
                  <span className="bg-muted/60 text-foreground mb-2 grid size-9 place-items-center rounded-xl ring-1 ring-border/40">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <span>
                    <span className="block text-sm font-medium text-foreground">
                      {d.label}
                    </span>
                    <span className="text-muted-foreground mt-0.5 block text-[11px] leading-snug">
                      {d.hint}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {!lifecycleHidden ? (
        <div
          className="product-rise"
          style={{ "--rise-delay": "0.19s" } as CSSProperties}
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
