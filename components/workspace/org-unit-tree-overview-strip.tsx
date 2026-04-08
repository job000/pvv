"use client";

import type { OrgRosRollup } from "@/components/workspace/org-unit-ros-kpi-strip";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { ClipboardList, FileText, Inbox, Layers } from "lucide-react";
import Link from "next/link";

type Item = {
  href: string;
  label: string;
  short: string;
  value: number;
  icon: typeof Layers;
};

/**
 * Fire søyler: prosess, ROS, PVV-vurdering, godkjente inntak (skjema → vurdering).
 * Tall aggregeres for underenheter (samme logikk som ROS-stripe).
 */
export function OrgUnitTreeOverviewStrip({
  workspaceId,
  stats,
  className,
}: {
  workspaceId: Id<"workspaces">;
  stats: OrgRosRollup;
  className?: string;
}) {
  const assessmentCount = stats.assessmentCount ?? 0;
  const intakeSubmissionCount = stats.intakeSubmissionCount ?? 0;
  const { candidateCount, analysisCount } = stats;

  const items: Item[] = [
    {
      href: `/w/${workspaceId}/kandidater`,
      label: "Prosess",
      short: "Pr",
      value: candidateCount,
      icon: Layers,
    },
    {
      href: `/w/${workspaceId}/ros`,
      label: "ROS",
      short: "ROS",
      value: analysisCount,
      icon: FileText,
    },
    {
      href: `/w/${workspaceId}/vurderinger`,
      label: "Vurdering",
      short: "V",
      value: assessmentCount,
      icon: ClipboardList,
    },
    {
      href: `/w/${workspaceId}/skjemaer`,
      label: "Inntak",
      short: "Inn",
      value: intakeSubmissionCount,
      icon: Inbox,
    },
  ];

  return (
    <div
      className={cn(
        "grid grid-cols-4 gap-px rounded-xl bg-border/40 p-px ring-1 ring-border/50",
        className,
      )}
      role="group"
      aria-label="Oversikt: prosess, ROS, vurdering og inntak (inkluderer underenheter)"
    >
      {items.map(({ href, label, short, value, icon: Icon }) => (
        <Link
          key={label}
          href={href}
          className="bg-card/95 hover:bg-muted/50 flex min-h-[3.25rem] flex-col items-center justify-center gap-0.5 rounded-[10px] px-1 py-1.5 text-center transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:min-h-0 sm:py-2"
          title={`${label}: ${value} (samlet for denne enheten og underenheter)`}
        >
          <Icon
            className="text-primary/80 size-3.5 shrink-0 opacity-90 sm:size-4"
            aria-hidden
          />
          <span className="text-foreground text-sm font-bold tabular-nums leading-none sm:text-base">
            {value}
          </span>
          <span className="text-muted-foreground hidden text-[9px] font-medium leading-tight sm:block">
            {label}
          </span>
          <span className="text-muted-foreground text-[9px] font-semibold uppercase tracking-wide sm:hidden">
            {short}
          </span>
        </Link>
      ))}
    </div>
  );
}
