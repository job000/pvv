"use client";

import { type ComponentType, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import {
  PIPELINE_STATUS_LABELS,
  type PipelineStatus,
} from "@/lib/assessment-pipeline";
import { SearchInput } from "@/components/ui/search-input";
import { formatRelativeUpdatedAt } from "@/lib/assessment-ui-helpers";
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
  navigationTarget: PrimaryFocusNavigation;
}) {
  const linkTitle = focusCardLinkTitle(navigationTarget);

  /** Tone styrer visuell prioritet uten sterke signalfarger.
   * Målet er profesjonell, rolig flate med tydelig hierarki. */
  const surface =
    tone === "warning"
      ? "bg-card border-border/60"
      : tone === "action"
        ? "bg-card border-primary/30"
        : "bg-card border-border/60";
  const iconBubble =
    tone === "warning"
      ? "bg-muted text-foreground ring-border/60"
      : tone === "action"
        ? "bg-primary/10 text-primary ring-primary/30"
        : "bg-muted text-foreground ring-border/60";
  const ctaTone =
    tone === "warning"
      ? "bg-foreground text-background hover:opacity-90"
      : tone === "action"
        ? "bg-primary text-primary-foreground hover:bg-primary/90"
        : "bg-foreground text-background hover:opacity-90";
  const eyebrowChip =
    tone === "warning"
      ? "bg-muted text-muted-foreground"
      : tone === "action"
        ? "bg-primary/12 text-primary"
        : "bg-muted text-muted-foreground";

  return (
    <Link
      href={href}
      title={linkTitle}
      className={cn(
        "group relative flex gap-4 overflow-hidden rounded-2xl border p-4 shadow-sm transition-all duration-200 hover:shadow-md sm:gap-5 sm:p-5",
        surface,
      )}
    >
      <div
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-xl shadow-sm ring-1 sm:size-12",
          iconBubble,
        )}
        aria-hidden
      >
        <Icon className="size-5 sm:size-6" />
      </div>
      <div className="min-w-0 flex-1">
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium",
            eyebrowChip,
          )}
        >
          {eyebrow}
        </span>
        <p className="font-heading mt-2 text-lg font-semibold leading-snug tracking-tight text-foreground sm:text-xl">
          {title}
        </p>
        {detail ? (
          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
            {detail}
          </p>
        ) : null}
        <div
          className={cn(
            "mt-4 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-opacity duration-200 group-hover:opacity-90",
            ctaTone,
          )}
        >
          {cta}
          <ArrowRight className="size-3.5" />
        </div>
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
  const [quickListFilter, setQuickListFilter] = useState<
    "all" | "without_ros" | "follow_up"
  >("all");
  const [quickListSearch, setQuickListSearch] = useState("");

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
      {/* Stripped: tidligere et kort-i-kort med eyebrow «Fokus nå» og en
          forklarende setning. FocusActionCard er allerede tydelig styla, så
          vi lar den stå som hero direkte og lister snarveier under som
          rene tekstlenker — uten innpakning. KISS. */}
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
          <div className="flex flex-wrap gap-2" aria-label="Snarveier">
            {primarySpec.key !== "ros" && withoutRosLinkCount > 0 && rosTarget ? (
              <ShortcutChip
                href={`/w/${wid}?kobleRos=1&assessmentId=${rosTarget.assessmentId}`}
                icon={ShieldPlus}
                tone="warning"
                label={`Uten ROS (${withoutRosLinkCount})`}
              />
            ) : null}
            {primarySpec.key !== "followup" && followUpCount > 0 ? (
              <ShortcutChip
                href={
                  followUpRow
                    ? `/w/${wid}/a/${followUpRow.assessmentId}`
                    : `/w/${wid}/vurderinger`
                }
                icon={PlayCircle}
                tone="action"
                label={`Oppfølging (${followUpCount})`}
              />
            ) : null}
            <ShortcutChip
              href={`/w/${wid}/vurderinger`}
              icon={ClipboardList}
              label="Alle vurderinger"
            />
            <ShortcutChip
              href={`/w/${wid}/vurderinger?fane=prosesser`}
              icon={Workflow}
              label="Prosesser"
            />
          </div>
          <div className="grid gap-2 rounded-2xl border border-border/50 bg-card p-3 sm:grid-cols-3">
            <div className="rounded-xl border border-border/50 bg-muted/20 px-3 py-2">
              <p className="text-[11px] text-muted-foreground">Uten ROS</p>
              <p className="text-base font-semibold tabular-nums text-foreground">
                {withoutRosLinkCount}
              </p>
            </div>
            <div className="rounded-xl border border-border/50 bg-muted/20 px-3 py-2">
              <p className="text-[11px] text-muted-foreground">Oppfølging</p>
              <p className="text-base font-semibold tabular-nums text-foreground">
                {followUpCount}
              </p>
            </div>
            <div className="rounded-xl border border-border/50 bg-muted/20 px-3 py-2">
              <p className="text-[11px] text-muted-foreground">Totalt i prioritering</p>
              <p className="text-base font-semibold tabular-nums text-foreground">
                {priorityTop.length}
              </p>
            </div>
          </div>
        </section>
      ) : null}

      {/* Én forenklet liste i stedet for to parallelle kolonner.
          «Høyest prioritet» og «Siste aktivitet» dekker stort sett samme
          vurderinger; vi viser bare én — flettet etter brukerens preferanse
          (recent har forrang fordi det matcher hva folk forventer å finne
          igjen først). Brukeren kan fortsatt skjule listen i Visning-menyen. */}
      {showPriority || showRecent ? (() => {
        const listBase =
          showRecent && recentlyUpdated.length > 0
            ? recentlyUpdated
            : priorityTop;
        const heading =
          showRecent && recentlyUpdated.length > 0
            ? "Siste aktivitet"
            : "Høyest prioritet";
        const quickSearch = quickListSearch.trim().toLowerCase();
        const list = listBase.filter((row) => {
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
        return (
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-heading text-base font-semibold tracking-tight">
                {heading}
              </h2>
              <Link
                href={`/w/${wid}/vurderinger`}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
              >
                Alle
                <ArrowRight className="size-3" />
              </Link>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setQuickListFilter("all")}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[11px] transition-colors",
                    quickListFilter === "all"
                      ? "border-border bg-muted text-foreground"
                      : "border-border/50 bg-card/60 text-muted-foreground hover:text-foreground",
                  )}
                >
                  Alle
                </button>
                <button
                  type="button"
                  onClick={() => setQuickListFilter("without_ros")}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[11px] transition-colors",
                    quickListFilter === "without_ros"
                      ? "border-border bg-muted text-foreground"
                      : "border-border/50 bg-card/60 text-muted-foreground hover:text-foreground",
                  )}
                >
                  Uten ROS
                </button>
                <button
                  type="button"
                  onClick={() => setQuickListFilter("follow_up")}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[11px] transition-colors",
                    quickListFilter === "follow_up"
                      ? "border-border bg-muted text-foreground"
                      : "border-border/50 bg-card/60 text-muted-foreground hover:text-foreground",
                  )}
                >
                  Oppfølging
                </button>
              </div>
              <SearchInput
                value={quickListSearch}
                onChange={(e) => setQuickListSearch(e.target.value)}
                placeholder="Søk i listen …"
                aria-label="Søk i arbeidsområdelisten"
                className="h-8 w-full rounded-full sm:max-w-xs"
              />
            </div>
            {list.length === 0 ? (
              <EmptyState wid={wid} />
            ) : (
              <div className="overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
                <div className="text-muted-foreground hidden grid-cols-[minmax(0,2fr)_9rem_8rem_5.5rem_2.5rem] items-center gap-3 border-b border-border/50 bg-muted/20 px-5 py-2 text-[11px] font-medium sm:grid">
                  <span>Vurdering</span>
                  <span>Status</span>
                  <span>Sist oppdatert</span>
                  <span className="text-center">Prioritet</span>
                  <span className="sr-only">Åpne</span>
                </div>
                <ul className="divide-y divide-border/40">
                  {list.map((row) => (
                    <li key={row.assessmentId}>
                      <AssessmentDashRow wid={wid} row={row} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        );
      })() : null}
    </div>
  );
}

function EmptyState({ wid }: { wid: string }) {
  return (
    <div className="rounded-2xl border border-border/50 bg-card px-4 py-10 text-center">
      <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <ClipboardList className="size-5" aria-hidden />
      </div>
      <p className="mt-3 text-sm font-medium text-foreground">
        Ingen vurderinger ennå
      </p>
      <p className="text-muted-foreground mt-1 text-xs">
        Start fra en prosess eller opprett en ny vurdering.
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        <Link
          href={`/w/${wid}/vurderinger`}
          className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background shadow-sm transition-all hover:shadow-md hover:opacity-90"
        >
          Start ny vurdering
          <ArrowRight className="size-3.5" />
        </Link>
        <Link
          href={`/w/${wid}/vurderinger?fane=prosesser`}
          className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/60 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-card"
        >
          Se prosesser
        </Link>
      </div>
    </div>
  );
}

function ShortcutChip({
  href,
  icon: Icon,
  label,
  tone = "neutral",
}: {
  href: string;
  icon: ComponentType<{ className?: string }>;
  label: string;
  tone?: "neutral" | "warning" | "action";
}) {
  const toneClass =
    tone === "warning"
      ? "border-border/60 bg-card/60 text-foreground hover:bg-card hover:border-border"
      : tone === "action"
        ? "border-primary/25 bg-primary/[0.08] text-foreground hover:bg-primary/[0.12] hover:border-primary/35"
        : "border-border/60 bg-card/60 text-muted-foreground hover:bg-card hover:text-foreground hover:border-border backdrop-blur-sm";
  const iconClass =
    tone === "warning"
      ? "text-muted-foreground group-hover:text-foreground"
      : tone === "action"
        ? "text-primary"
        : "text-muted-foreground/80 group-hover:text-foreground";
  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium shadow-xs transition-all duration-200 hover:shadow-sm",
        toneClass,
      )}
    >
      <Icon className={cn("size-3.5 transition-colors", iconClass)} aria-hidden />
      {label}
    </Link>
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

function AssessmentDashRow({
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
      className="group grid grid-cols-1 gap-1.5 px-4 py-3 transition-colors hover:bg-muted/35 sm:grid-cols-[minmax(0,2fr)_9rem_8rem_5.5rem_2.5rem] sm:items-center sm:gap-3 sm:px-5 sm:py-3.5"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "size-2 shrink-0 rounded-full ring-2 ring-background",
              priorityDotClass(row.effectivePriority),
            )}
            aria-hidden
          />
          <p className="truncate text-sm font-medium text-foreground">
            {row.title}
          </p>
        </div>
        {!rosLinked ? (
          <div className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
            <ShieldAlert className="size-3" aria-hidden />
            Uten ROS
          </div>
        ) : null}
      </div>
      <div className="text-xs text-muted-foreground">
        {PIPELINE_STATUS_LABELS[row.pipelineStatus]}
      </div>
      <div className="text-xs text-muted-foreground tabular-nums">
        <span className="inline-flex items-center gap-1">
          <Clock3 className="size-3 opacity-70" aria-hidden />
          {formatRelativeUpdatedAt(row.updatedAt)}
        </span>
      </div>
      <div className="text-center text-xs tabular-nums">
        <span className="font-semibold text-foreground">
          {row.effectivePriority.toFixed(0)}
        </span>
        <span className="text-muted-foreground"> / 100</span>
      </div>
      <ArrowRight
        className="ml-auto size-4 shrink-0 text-muted-foreground/40 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-foreground"
        aria-hidden
      />
    </Link>
  );
}
