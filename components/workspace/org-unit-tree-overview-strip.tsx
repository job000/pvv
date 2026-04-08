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
      href: `/w/${workspaceId}/vurderinger?fane=prosesser`,
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
        "grid grid-cols-4 gap-1 sm:gap-0 sm:divide-x sm:divide-border/25",
        className,
      )}
      role="group"
      aria-label="Oversikt: prosess, ROS, vurdering og inntak (inkluderer underenheter)"
    >
      {items.map(({ href, label, short, value, icon: Icon }, i) => (
        <Link
          key={label}
          href={href}
          className={cn(
            "hover:bg-muted/40 flex min-h-[2.75rem] flex-col items-center justify-center gap-0.5 rounded-lg px-0.5 py-1 text-center transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:min-h-0 sm:px-2 sm:py-1.5",
            i > 0 && "sm:pl-3",
          )}
          title={`${label}: ${value} (samlet for denne enheten og underenheter)`}
        >
          <Icon
            className="text-muted-foreground/80 size-3 shrink-0 sm:size-3.5"
            aria-hidden
          />
          <span className="text-foreground text-[13px] font-semibold tabular-nums leading-none tracking-tight sm:text-sm">
            {value}
          </span>
          <span className="text-muted-foreground hidden text-[10px] font-medium leading-tight sm:block">
            {label}
          </span>
          <span className="text-muted-foreground text-[9px] font-medium uppercase tracking-wide sm:hidden">
            {short}
          </span>
        </Link>
      ))}
    </div>
  );
}
