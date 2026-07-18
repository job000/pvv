"use client";

import type { Id } from "@/convex/_generated/dataModel";
import {
  RPA_LIFECYCLE_STAGES,
  getRpaLifecycleStage,
  hottestLifecycleStage,
  primaryActionForStage,
  type RpaLifecycleStageId,
} from "@/lib/rpa-lifecycle";
import { cn } from "@/lib/utils";
import {
  Bot,
  ClipboardCheck,
  FlaskConical,
  HeartPulse,
  Laptop,
  Rocket,
  Search,
} from "lucide-react";
import Link from "next/link";
import type { ComponentType } from "react";

const STAGE_ICONS: Record<
  RpaLifecycleStageId,
  ComponentType<{ className?: string }>
> = {
  identify: Search,
  assess: ClipboardCheck,
  design: Laptop,
  develop: Bot,
  test: FlaskConical,
  deploy: Rocket,
  monitor: HeartPulse,
};

type Props = {
  workspaceId: Id<"workspaces">;
  activeStageId?: RpaLifecycleStageId | null;
  /** Live antall per steg (fra dashboard). */
  liveCounts?: Partial<Record<RpaLifecycleStageId, number>> | null;
  compact?: boolean;
  className?: string;
  onHide?: () => void;
};

export function RpaLifecycleGuide({
  workspaceId,
  activeStageId = null,
  liveCounts = null,
  compact = false,
  className,
  onHide,
}: Props) {
  const hot = liveCounts
    ? hottestLifecycleStage({
        identify: liveCounts.identify ?? 0,
        assess: liveCounts.assess ?? 0,
        design: liveCounts.design ?? 0,
        develop: liveCounts.develop ?? 0,
        test: liveCounts.test ?? 0,
        deploy: liveCounts.deploy ?? 0,
        monitor: liveCounts.monitor ?? 0,
      })
    : null;

  const highlighted = activeStageId ?? hot;

  if (compact) {
    const active = highlighted ? getRpaLifecycleStage(highlighted) : null;
    return (
      <div
        className={cn(
          "rounded-2xl border border-border/50 bg-muted/15 px-3 py-3 sm:px-4",
          className,
        )}
      >
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-foreground">
            RPA-livssyklus
            {active ? (
              <span className="text-muted-foreground font-normal">
                {" "}
                · {active.index}/{RPA_LIFECYCLE_STAGES.length} · {active.title}
              </span>
            ) : null}
          </p>
          <Link
            href={`/w/${workspaceId}#rpa-livssyklus`}
            className="text-muted-foreground text-xs font-medium underline-offset-2 hover:text-foreground hover:underline"
          >
            Se hele
          </Link>
        </div>
        <ol className="grid grid-cols-7 gap-1">
          {RPA_LIFECYCLE_STAGES.map((stage) => {
            const isActive = stage.id === highlighted;
            const Icon = STAGE_ICONS[stage.id];
            const action = primaryActionForStage(stage.id, workspaceId);
            const count = liveCounts?.[stage.id] ?? 0;
            return (
              <li key={stage.id}>
                <Link
                  href={action.href}
                  title={`${stage.index}. ${stage.title}${count > 0 ? ` (${count})` : ""}`}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-xl px-0.5 py-2 text-center transition-colors",
                    isActive
                      ? "bg-foreground text-background"
                      : "bg-background/70 text-muted-foreground hover:bg-background hover:text-foreground",
                  )}
                >
                  <Icon className="size-3.5 shrink-0" aria-hidden />
                  <span className="text-[9px] font-semibold tabular-nums leading-none sm:text-[10px]">
                    {stage.index}
                  </span>
                  {count > 0 ? (
                    <span
                      className={cn(
                        "rounded-full px-1 text-[9px] font-semibold tabular-nums leading-none",
                        isActive ? "bg-background/20" : "bg-muted",
                      )}
                    >
                      {count}
                    </span>
                  ) : (
                    <span className="h-2.5" aria-hidden />
                  )}
                </Link>
              </li>
            );
          })}
        </ol>
        {active ? (
          <p className="text-muted-foreground mt-2 text-xs leading-snug">
            {active.summary}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <section
      id="rpa-livssyklus"
      className={cn("scroll-mt-24 space-y-4", className)}
      aria-labelledby="rpa-lifecycle-heading"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h2
            id="rpa-lifecycle-heading"
            className="font-heading text-lg font-semibold tracking-tight text-foreground"
          >
            RPA-livssyklus
          </h2>
          <p className="text-muted-foreground max-w-xl text-sm leading-relaxed">
            Syv steg fra kandidat til drift. Tallene er live — trykk et steg for å gå dit.
          </p>
        </div>
        {onHide ? (
          <button
            type="button"
            onClick={onHide}
            className="text-muted-foreground text-sm font-medium underline-offset-2 hover:text-foreground hover:underline"
          >
            Skjul veiledning
          </button>
        ) : null}
      </div>

      <ol className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {RPA_LIFECYCLE_STAGES.map((stage, idx) => {
          const isActive = stage.id === highlighted;
          const Icon = STAGE_ICONS[stage.id];
          const action = primaryActionForStage(stage.id, workspaceId);
          const count = liveCounts?.[stage.id] ?? 0;
          const hasWork = count > 0;

          return (
            <li key={stage.id} className="min-w-0">
              <Link
                href={action.href}
                className={cn(
                  "group relative flex h-full flex-col rounded-2xl border p-3.5 transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  isActive
                    ? "border-foreground/25 bg-card shadow-sm"
                    : "border-border/50 bg-muted/10 hover:border-border hover:bg-muted/25",
                )}
              >
                {idx < RPA_LIFECYCLE_STAGES.length - 1 ? (
                  <span
                    className="bg-border/70 absolute top-1/2 -right-1.5 z-10 hidden h-px w-3 xl:block"
                    aria-hidden
                  />
                ) : null}

                <div className="flex items-start justify-between gap-2">
                  <div
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-xl",
                      isActive
                        ? "bg-foreground text-background"
                        : hasWork
                          ? "bg-foreground/10 text-foreground"
                          : "bg-muted/70 text-muted-foreground",
                    )}
                  >
                    <Icon className="size-3.5" aria-hidden />
                  </div>
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="text-muted-foreground text-[10px] font-medium tabular-nums">
                      {stage.index}/{RPA_LIFECYCLE_STAGES.length}
                    </span>
                    {hasWork ? (
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                          isActive
                            ? "bg-foreground text-background"
                            : "bg-foreground/10 text-foreground",
                        )}
                      >
                        {count}
                      </span>
                    ) : null}
                  </div>
                </div>

                <p className="mt-2.5 text-sm font-semibold leading-snug text-foreground">
                  {stage.title}
                </p>
                <p className="text-muted-foreground mt-1 line-clamp-2 flex-1 text-[11px] leading-snug">
                  {stage.summary}
                </p>
                <span className="text-muted-foreground group-hover:text-foreground mt-3 text-xs font-medium">
                  {action.label} →
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
