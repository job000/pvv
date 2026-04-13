"use client";

import type { OrgRosRollup } from "@/components/workspace/org-unit-ros-kpi-strip";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { ClipboardList, FileText, Inbox, Layers, Workflow } from "lucide-react";
import Link from "next/link";

type Item = {
  href: string;
  label: string;
  short: string;
  value: number;
  icon: typeof Layers;
};

/**
 * Fem søyler: prosess, ROS, prosessdesign (PDD), PVV-vurdering, godkjente inntak (skjema → vurdering).
 * Tall aggregeres for underenheter (samme logikk som ROS-stripe).
 */
export function OrgUnitTreeOverviewStrip({
  workspaceId,
  stats,
  className,
  compact = false,
  orgUnitId,
}: {
  workspaceId: Id<"workspaces">;
  stats: OrgRosRollup;
  className?: string;
  /** Kompakt variant for organisasjonskart (mindre kort). */
  compact?: boolean;
  /** When set, appends ?orgUnit= to links for deep-filtering. */
  orgUnitId?: Id<"orgUnits">;
}) {
  const assessmentCount = stats.assessmentCount ?? 0;
  const pddCount = stats.pddCount ?? 0;
  const intakeSubmissionCount = stats.intakeSubmissionCount ?? 0;
  const { candidateCount, analysisCount } = stats;

  const orgSuffix = orgUnitId ? `&orgUnit=${orgUnitId}` : "";

  const items: Item[] = [
    {
      href: `/w/${workspaceId}/vurderinger?fane=prosesser${orgSuffix}`,
      label: "Prosess",
      short: "Pr",
      value: candidateCount,
      icon: Layers,
    },
    {
      href: `/w/${workspaceId}/ros?${orgUnitId ? `orgUnit=${orgUnitId}` : ""}`,
      label: "ROS",
      short: "ROS",
      value: analysisCount,
      icon: FileText,
    },
    {
      href: `/w/${workspaceId}/prosessdesign${orgUnitId ? `?orgUnit=${orgUnitId}` : ""}`,
      label: "PDD",
      short: "PDD",
      value: pddCount,
      icon: Workflow,
    },
    {
      href: `/w/${workspaceId}/vurderinger${orgUnitId ? `?orgUnit=${orgUnitId}` : ""}`,
      label: "Vurdering",
      short: "V",
      value: assessmentCount,
      icon: ClipboardList,
    },
    {
      href: `/w/${workspaceId}/skjemaer${orgUnitId ? `?orgUnit=${orgUnitId}` : ""}`,
      label: "Inntak",
      short: "Inn",
      value: intakeSubmissionCount,
      icon: Inbox,
    },
  ];

  return (
    <div
      className={cn(
        "grid grid-cols-5 gap-1 sm:gap-0 sm:divide-x sm:divide-border/25",
        compact && "gap-0 sm:divide-foreground/15",
        className,
      )}
      role="group"
      aria-label="Oversikt: prosess, ROS, prosessdesign, vurdering og inntak (inkluderer underenheter)"
    >
      {items.map(({ href, label, short, value, icon: Icon }, i) => (
        <Link
          key={label}
          href={href}
          className={cn(
            "hover:bg-muted/40 flex min-h-[2.75rem] flex-col items-center justify-center gap-0.5 rounded-lg px-0.5 py-1 text-center transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:min-h-0 sm:px-2 sm:py-1.5",
            compact &&
              "min-h-[2.125rem] gap-0 px-0.5 py-0.5 sm:min-h-0 sm:px-1 sm:py-1",
            i > 0 && "sm:pl-3",
            compact && i > 0 && "sm:pl-2",
          )}
          title={`${label}: ${value} (samlet for denne enheten og underenheter)`}
        >
          <Icon
            className={cn(
              "text-muted-foreground/80 size-3 shrink-0 sm:size-3.5",
              compact && "size-2.5 sm:size-3",
            )}
            aria-hidden
          />
          <span
            className={cn(
              "text-foreground text-[13px] font-semibold tabular-nums leading-none tracking-tight sm:text-sm",
              compact && "text-xs sm:text-[13px]",
            )}
          >
            {value}
          </span>
          <span
            className={cn(
              "text-muted-foreground hidden text-[10px] font-medium leading-tight sm:block",
              compact && "text-[9px] sm:text-[10px]",
            )}
          >
            {label}
          </span>
          <span
            className={cn(
              "text-muted-foreground text-[9px] font-medium uppercase tracking-wide sm:hidden",
              compact && "text-[8px]",
            )}
          >
            {short}
          </span>
        </Link>
      ))}
    </div>
  );
}
