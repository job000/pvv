"use client";

import { type ComponentType, useEffect, useMemo, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import {
  PIPELINE_STATUS_LABELS,
  type PipelineStatus,
} from "@/lib/assessment-pipeline";
import { SearchInput } from "@/components/ui/search-input";
import { RpaLifecycleGuide } from "@/components/workspace/rpa-lifecycle-guide";
import { formatRelativeUpdatedAt } from "@/lib/assessment-ui-helpers";
import { lifecycleLiveCounts } from "@/lib/rpa-lifecycle";
import { useStickyState } from "@/lib/use-sticky-state";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock3,
  LayoutGrid,
  List,
  PlayCircle,
  ShieldAlert,
  ShieldPlus,
  Table2,
} from "lucide-react";
import Link from "next/link";

const HOME_PAGE_SIZES = [6, 10, 20] as const;
type HomePageSize = (typeof HOME_PAGE_SIZES)[number];
type HomeViewMode = "cards" | "list" | "table";

const selectClass =
  "h-11 appearance-none rounded-2xl border border-border/50 bg-background px-4 pr-10 text-sm outline-none focus:ring-2 focus:ring-foreground/15";

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
  navigationTarget,
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
  const linkTitle = focusCardLinkTitle(navigationTarget);

  return (
    <Link
      href={href}
      title={linkTitle}
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
      <span className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-full bg-foreground px-4 text-sm font-semibold text-background transition-opacity group-hover:opacity-90">
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
}: {
  workspaceId: Id<"workspaces">;
  /** Udefinert felt = synlig (standard). */
  sectionVisibility?: WorkspaceDashboardSectionVisibility;
}) {
  const dash = useQuery(api.assessments.workspaceDashboard, { workspaceId });
  const intakeQueue = useQuery(api.intakeSubmissions.listByWorkspace, {
    workspaceId,
  });
  const viewPrefs = useQuery(api.workspaceViewPrefs.getMyWorkspaceViewPrefs, {
    workspaceId,
  });
  const setHomeListPrefs = useMutation(
    api.workspaceViewPrefs.setMyHomeListPrefs,
  );
  const wid = String(workspaceId);
  const [lifecycleHidden, setLifecycleHidden] = useStickyState(
    `ws:${wid}:rpa-lifecycle-hidden`,
    false,
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash === "#rpa-livssyklus" && lifecycleHidden) {
      setLifecycleHidden(false);
    }
  }, [lifecycleHidden, setLifecycleHidden]);
  const [quickListFilter, setQuickListFilter] = useState<
    "all" | "without_ros" | "follow_up"
  >("all");
  const [quickListSearch, setQuickListSearch] = useState("");
  const [viewMode, setViewMode] = useState<HomeViewMode>("cards");
  const [pageSize, setPageSize] = useState<HomePageSize>(6);
  const [page, setPage] = useState(1);
  const [prefsHydrated, setPrefsHydrated] = useState(false);

  const showMetrics = sectionVisibility?.showMetrics !== false;
  const showPriority = sectionVisibility?.showPrioritySection !== false;
  const showRecent = sectionVisibility?.showRecentSection !== false;

  const liveLifecycleCounts = useMemo(() => {
    if (!dash) return null;
    const pendingIntakeCount = (intakeQueue ?? []).filter(
      (s) => s.status === "submitted" || s.status === "under_review",
    ).length;
    return lifecycleLiveCounts({
      pipelineCounts: dash.pipelineCounts,
      pendingIntakeCount,
    });
  }, [dash, intakeQueue]);

  useEffect(() => {
    if (viewPrefs === undefined) return;
    if (viewPrefs === null) {
      setViewMode("cards");
      setPageSize(6);
      setPrefsHydrated(true);
      return;
    }
    const mode = viewPrefs.homeListViewMode;
    const size = viewPrefs.homeListPageSize;
    if (mode === "cards" || mode === "list" || mode === "table") {
      setViewMode(mode);
    }
    if (size === 6 || size === 10 || size === 20) {
      setPageSize(size);
    }
    setPrefsHydrated(true);
  }, [viewPrefs]);

  async function persistHomeListPrefs(
    nextMode: HomeViewMode,
    nextSize: HomePageSize,
  ) {
    setViewMode(nextMode);
    setPageSize(nextSize);
    try {
      await setHomeListPrefs({
        workspaceId,
        homeListViewMode: nextMode,
        homeListPageSize: nextSize,
      });
    } catch {
      /* preferanse er fortsatt lokalt — neste lagring kan prøves igjen */
    }
  }

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
      {lifecycleHidden ? (
        <button
          type="button"
          onClick={() => setLifecycleHidden(false)}
          className="text-muted-foreground hover:text-foreground inline-flex min-h-9 items-center gap-2 rounded-full border border-border/50 bg-muted/10 px-3 text-xs font-medium touch-manipulation transition-colors hover:bg-muted/25"
        >
          Vis livssyklus
          {liveLifecycleCounts ? (
            <span className="text-foreground tabular-nums">
              {Object.values(liveLifecycleCounts).reduce((a, b) => a + b, 0)} i
              flyt
            </span>
          ) : null}
        </button>
      ) : (
        <RpaLifecycleGuide
          workspaceId={workspaceId}
          liveCounts={liveLifecycleCounts}
          onHide={() => setLifecycleHidden(true)}
        />
      )}

      {showMetrics ? (
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
          <dl className="flex flex-wrap gap-x-8 gap-y-2 border-y border-border/50 py-3 text-sm">
            <div className="flex items-baseline gap-2">
              <dt className="text-muted-foreground">Uten ROS</dt>
              <dd className="font-semibold tabular-nums text-foreground">
                {withoutRosLinkCount}
              </dd>
            </div>
            <div className="flex items-baseline gap-2">
              <dt className="text-muted-foreground">Oppfølging</dt>
              <dd className="font-semibold tabular-nums text-foreground">
                {followUpCount}
              </dd>
            </div>
            <div className="flex items-baseline gap-2">
              <dt className="text-muted-foreground">I prioritering</dt>
              <dd className="font-semibold tabular-nums text-foreground">
                {priorityTop.length}
              </dd>
            </div>
          </dl>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm" aria-label="Snarveier">
            {primarySpec.key !== "ros" && withoutRosLinkCount > 0 && rosTarget ? (
              <Link
                href={`/w/${wid}?kobleRos=1&assessmentId=${rosTarget.assessmentId}`}
                className="font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Koble ROS
              </Link>
            ) : null}
            {primarySpec.key !== "followup" && followUpCount > 0 ? (
              <Link
                href={
                  followUpRow
                    ? `/w/${wid}/a/${followUpRow.assessmentId}`
                    : `/w/${wid}/vurderinger`
                }
                className="font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Oppfølging
              </Link>
            ) : null}
            <Link
              href={`/w/${wid}/vurderinger?fane=prosesser`}
              className="font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Prosesser
            </Link>
            <Link
              href={`/w/${wid}/ros`}
              className="font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              ROS
            </Link>
          </div>
        </section>
      ) : null}

      {/* Én forenklet liste i stedet for to parallelle kolonner.
          «Høyest prioritet» og «Siste aktivitet» dekker stort sett samme
          vurderinger; vi viser bare én — flettet etter brukerens preferanse
          (recent har forrang fordi det matcher hva folk forventer å finne
          igjen først). Brukeren kan fortsatt skjule listen i Visning-menyen. */}
      {showPriority || showRecent ? (
        <HomeActivitySection
          wid={wid}
          heading={
            showRecent && recentlyUpdated.length > 0
              ? "Siste aktivitet"
              : "Høyest prioritet"
          }
          listBase={
            showRecent && recentlyUpdated.length > 0
              ? recentlyUpdated
              : priorityTop
          }
          quickListFilter={quickListFilter}
          setQuickListFilter={setQuickListFilter}
          quickListSearch={quickListSearch}
          setQuickListSearch={setQuickListSearch}
          viewMode={viewMode}
          pageSize={pageSize}
          page={page}
          setPage={setPage}
          prefsReady={prefsHydrated || viewPrefs !== undefined}
          onChangeView={(mode) => void persistHomeListPrefs(mode, pageSize)}
          onChangePageSize={(size) => {
            setPage(1);
            void persistHomeListPrefs(viewMode, size);
          }}
        />
      ) : null}
    </div>
  );
}

function HomeActivitySection({
  wid,
  heading,
  listBase,
  quickListFilter,
  setQuickListFilter,
  quickListSearch,
  setQuickListSearch,
  viewMode,
  pageSize,
  page,
  setPage,
  prefsReady,
  onChangeView,
  onChangePageSize,
}: {
  wid: string;
  heading: string;
  listBase: DashboardRow[];
  quickListFilter: "all" | "without_ros" | "follow_up";
  setQuickListFilter: (v: "all" | "without_ros" | "follow_up") => void;
  quickListSearch: string;
  setQuickListSearch: (v: string) => void;
  viewMode: HomeViewMode;
  pageSize: HomePageSize;
  page: number;
  setPage: (n: number | ((p: number) => number)) => void;
  prefsReady: boolean;
  onChangeView: (mode: HomeViewMode) => void;
  onChangePageSize: (size: HomePageSize) => void;
}) {
  const quickSearch = quickListSearch.trim().toLowerCase();
  const list = useMemo(() => {
    return listBase.filter((row) => {
      if (quickListFilter === "without_ros" && row.hasRosLink) return false;
      if (
        quickListFilter === "follow_up" &&
        row.pipelineStatus !== "assessed" &&
        row.pipelineStatus !== "on_hold"
      ) {
        return false;
      }
      if (!quickSearch) return true;
      return (
        row.title.toLowerCase().includes(quickSearch) ||
        (row.ownerName ?? "").toLowerCase().includes(quickSearch) ||
        row.nextStepHint.toLowerCase().includes(quickSearch)
      );
    });
  }, [listBase, quickListFilter, quickSearch]);

  useEffect(() => {
    setPage(1);
  }, [quickListFilter, quickListSearch, pageSize, setPage]);

  const totalPages = Math.max(1, Math.ceil(list.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageItems = list.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize,
  );
  const rangeStart = list.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const rangeEnd = Math.min(safePage * pageSize, list.length);

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h2 className="font-heading text-lg font-semibold tracking-tight">
            {heading}
          </h2>
          <p className="text-sm text-muted-foreground">
            Visning og antall huskes for deg i dette området.
          </p>
        </div>
        <Link
          href={`/w/${wid}/vurderinger`}
          className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Alle vurderinger
          <ArrowRight className="size-3.5" />
        </Link>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              { id: "all", label: "Alle" },
              { id: "without_ros", label: "Uten ROS" },
              { id: "follow_up", label: "Oppfølging" },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setQuickListFilter(f.id)}
              className={cn(
                "rounded-full border px-3.5 py-2 text-xs font-medium transition-colors",
                quickListFilter === f.id
                  ? "border-border bg-muted text-foreground"
                  : "border-border/50 bg-card/60 text-muted-foreground hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <SearchInput
            value={quickListSearch}
            onChange={(e) => setQuickListSearch(e.target.value)}
            placeholder="Søk i listen …"
            aria-label="Søk i arbeidsområdelisten"
            className="w-full sm:max-w-xs"
            inputClassName="h-11 min-h-11 rounded-2xl md:h-11 md:min-h-11 md:rounded-2xl"
          />
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Visningsmodus"
              value={viewMode}
              disabled={!prefsReady}
              onChange={(e) => onChangeView(e.target.value as HomeViewMode)}
              className={cn(selectClass, "min-w-[8.5rem]")}
            >
              <option value="cards">Kort</option>
              <option value="list">Liste</option>
              <option value="table">Tabell</option>
            </select>
            <select
              aria-label="Antall per side"
              value={pageSize}
              disabled={!prefsReady}
              onChange={(e) =>
                onChangePageSize(Number(e.target.value) as HomePageSize)
              }
              className={cn(selectClass, "min-w-[5.5rem]")}
            >
              {HOME_PAGE_SIZES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <div
              className="hidden items-center gap-0.5 rounded-2xl border border-border/50 bg-muted/30 p-1 sm:inline-flex"
              role="group"
              aria-label="Hurtigvisning"
            >
              {(
                [
                  { value: "cards", label: "Kort", Icon: LayoutGrid },
                  { value: "list", label: "Liste", Icon: List },
                  { value: "table", label: "Tabell", Icon: Table2 },
                ] as const
              ).map(({ value, label, Icon }) => (
                <button
                  key={value}
                  type="button"
                  title={label}
                  aria-label={label}
                  aria-pressed={viewMode === value}
                  disabled={!prefsReady}
                  className={cn(
                    "flex size-9 items-center justify-center rounded-xl transition-colors",
                    viewMode === value
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  onClick={() => onChangeView(value)}
                >
                  <Icon className="size-4" aria-hidden />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {list.length === 0 ? (
        <EmptyState wid={wid} />
      ) : (
        <>
          {viewMode === "cards" ? (
            <ul className="grid gap-3 sm:grid-cols-2">
              {pageItems.map((row) => (
                <li key={row.assessmentId}>
                  <AssessmentDashCard wid={wid} row={row} />
                </li>
              ))}
            </ul>
          ) : null}

          {viewMode === "list" ? (
            <ul className="flex flex-col gap-3">
              {pageItems.map((row) => (
                <li key={row.assessmentId}>
                  <AssessmentDashListRow wid={wid} row={row} />
                </li>
              ))}
            </ul>
          ) : null}

          {viewMode === "table" ? (
            <div className="overflow-hidden rounded-3xl border border-border/50 bg-card shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[32rem] text-left text-sm">
                  <thead className="border-b border-border/50 bg-muted/30 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-5 py-3.5 font-medium">Vurdering</th>
                      <th className="px-5 py-3.5 font-medium">Status</th>
                      <th className="px-5 py-3.5 font-medium">Oppdatert</th>
                      <th className="px-5 py-3.5 text-right font-medium">
                        Prioritet
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageItems.map((row) => (
                      <tr
                        key={row.assessmentId}
                        className="border-b border-border/40 last:border-0 transition-colors hover:bg-muted/25"
                      >
                        <td className="px-5 py-4">
                          <Link
                            href={`/w/${wid}/a/${row.assessmentId}`}
                            className="flex min-w-0 items-center gap-2.5 font-medium text-foreground"
                          >
                            <span
                              className={cn(
                                "size-2 shrink-0 rounded-full",
                                priorityDotClass(row.effectivePriority),
                              )}
                              aria-hidden
                            />
                            <span className="truncate">{row.title}</span>
                          </Link>
                          {!(row.rosLinked ?? row.hasRosLink) ? (
                            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                              <ShieldAlert className="size-3" aria-hidden />
                              Uten ROS
                            </p>
                          ) : null}
                        </td>
                        <td className="px-5 py-4 text-muted-foreground">
                          {PIPELINE_STATUS_LABELS[row.pipelineStatus]}
                        </td>
                        <td className="px-5 py-4 text-muted-foreground tabular-nums">
                          {formatRelativeUpdatedAt(row.updatedAt)}
                        </td>
                        <td className="px-5 py-4 text-right tabular-nums">
                          <span className="font-semibold text-foreground">
                            {row.effectivePriority.toFixed(0)}
                          </span>
                          <span className="text-muted-foreground"> / 100</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          <div className="flex flex-col gap-3 border-t border-border/40 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground" aria-live="polite">
              Viser {rangeStart}–{rangeEnd} av {list.length}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="inline-flex h-10 items-center gap-1.5 rounded-2xl border border-border/50 bg-background px-3.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/50 disabled:pointer-events-none disabled:opacity-40"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="size-4" aria-hidden />
                Forrige
              </button>
              <span className="min-w-[5.5rem] text-center text-sm tabular-nums text-muted-foreground">
                Side {safePage} / {totalPages}
              </span>
              <button
                type="button"
                className="inline-flex h-10 items-center gap-1.5 rounded-2xl border border-border/50 bg-background px-3.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/50 disabled:pointer-events-none disabled:opacity-40"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Neste
                <ChevronRight className="size-4" aria-hidden />
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function EmptyState({ wid }: { wid: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-border/60 px-8 py-14 text-center">
      <p className="text-base font-medium text-foreground">Ingen vurderinger ennå</p>
      <p className="mx-auto mt-2 max-w-sm text-[15px] leading-relaxed text-muted-foreground">
        Start fra en prosess eller opprett en ny vurdering.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <Link
          href={`/w/${wid}/vurderinger`}
          className="inline-flex h-11 items-center gap-1.5 rounded-2xl bg-foreground px-5 text-sm font-semibold text-background"
        >
          Start vurdering
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
        <Link
          href={`/w/${wid}/vurderinger?fane=prosesser`}
          className="inline-flex h-11 items-center gap-1.5 rounded-2xl border border-border/60 px-5 text-sm font-medium text-foreground transition-colors hover:bg-muted/40"
        >
          Se prosesser
        </Link>
      </div>
    </div>
  );
}

/** Liten farget prikk som indikator i stedet for tykk venstre-kant.
 * Mer moderne, mindre visuell støy, fungerer like godt som signal. */
function priorityDotClass(score: number): string {
  if (!Number.isFinite(score)) return "bg-slate-400/60";
  if (score >= 70) return "bg-primary";
  if (score >= 45) return "bg-foreground/50";
  return "bg-slate-400/70";
}

function AssessmentDashCard({
  wid,
  row,
}: {
  wid: string;
  row: DashboardRow;
}) {
  const rosLinked = row.rosLinked ?? row.hasRosLink;
  return (
    <Link
      href={`/w/${wid}/a/${row.assessmentId}`}
      className="group flex min-h-[7.5rem] flex-col justify-between rounded-3xl border border-border/50 bg-card p-5 shadow-sm transition-colors hover:bg-muted/30"
    >
      <div className="min-w-0 space-y-2">
        <div className="flex items-start gap-2.5">
          <span
            className={cn(
              "mt-1.5 size-2.5 shrink-0 rounded-full",
              priorityDotClass(row.effectivePriority),
            )}
            aria-hidden
          />
          <p className="line-clamp-2 text-[15px] font-semibold tracking-tight text-foreground">
            {row.title}
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          {PIPELINE_STATUS_LABELS[row.pipelineStatus]}
          {!rosLinked ? " · Uten ROS" : null}
        </p>
      </div>
      <div className="mt-4 flex items-center justify-between gap-2 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1.5 tabular-nums">
          <Clock3 className="size-3.5 opacity-70" aria-hidden />
          {formatRelativeUpdatedAt(row.updatedAt)}
        </span>
        <span className="tabular-nums">
          <span className="font-semibold text-foreground">
            {row.effectivePriority.toFixed(0)}
          </span>
          {" / 100"}
        </span>
      </div>
    </Link>
  );
}

function AssessmentDashListRow({
  wid,
  row,
}: {
  wid: string;
  row: DashboardRow;
}) {
  const rosLinked = row.rosLinked ?? row.hasRosLink;
  return (
    <Link
      href={`/w/${wid}/a/${row.assessmentId}`}
      className="group flex items-center gap-4 rounded-3xl border border-border/50 bg-card px-5 py-4 shadow-sm transition-colors hover:bg-muted/25"
    >
      <span
        className={cn(
          "size-2.5 shrink-0 rounded-full",
          priorityDotClass(row.effectivePriority),
        )}
        aria-hidden
      />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="truncate text-[15px] font-semibold tracking-tight text-foreground">
          {row.title}
        </p>
        <p className="truncate text-sm text-muted-foreground">
          {PIPELINE_STATUS_LABELS[row.pipelineStatus]}
          {!rosLinked ? " · Uten ROS" : null}
          {" · "}
          {formatRelativeUpdatedAt(row.updatedAt)}
        </p>
      </div>
      <span className="shrink-0 rounded-xl bg-muted/70 px-2.5 py-1 text-xs font-semibold tabular-nums text-foreground">
        {row.effectivePriority.toFixed(0)}
      </span>
      <ArrowRight
        className="size-4 shrink-0 text-muted-foreground/35 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
        aria-hidden
      />
    </Link>
  );
}
