"use client";

import type { Id } from "@/convex/_generated/dataModel";
import {
  RPA_LIFECYCLE_STAGES,
  focusLifecycleStage,
  getRpaLifecycleStage,
  primaryActionForStage,
  type RpaLifecycleStageId,
} from "@/lib/rpa-lifecycle";
import { cn } from "@/lib/utils";
import {
  Bot,
  ChevronRight,
  ClipboardCheck,
  FlaskConical,
  HeartPulse,
  Laptop,
  Rocket,
  Search,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type ComponentType } from "react";

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

/** Korte etiketter for smal stripe */
const SHORT_LABELS: Record<RpaLifecycleStageId, string> = {
  identify: "Ident.",
  assess: "Vurder",
  design: "Design",
  develop: "Utvik.",
  test: "Test",
  deploy: "Prod.",
  monitor: "Drift",
};

type Props = {
  workspaceId: Id<"workspaces">;
  activeStageId?: RpaLifecycleStageId | null;
  /** Live antall per steg (fra dashboard). */
  liveCounts?: Partial<Record<RpaLifecycleStageId, number>> | null;
  /** Ekstra kompakt (f.eks. i dialog) — samme stripe, uten header-CTA. */
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
  const bottleneck = liveCounts
    ? focusLifecycleStage({
        identify: liveCounts.identify ?? 0,
        assess: liveCounts.assess ?? 0,
        design: liveCounts.design ?? 0,
        develop: liveCounts.develop ?? 0,
        test: liveCounts.test ?? 0,
        deploy: liveCounts.deploy ?? 0,
        monitor: liveCounts.monitor ?? 0,
      })
    : null;

  const defaultFocus = activeStageId ?? bottleneck;
  const [pickedId, setPickedId] = useState<RpaLifecycleStageId | null>(null);
  const focusedId = pickedId ?? defaultFocus;

  const focused = focusedId ? getRpaLifecycleStage(focusedId) : null;
  const focusedAction = focused
    ? primaryActionForStage(focused.id, workspaceId)
    : null;
  const focusedCount = focusedId ? (liveCounts?.[focusedId] ?? 0) : 0;

  const totalInFlow = useMemo(() => {
    if (!liveCounts) return 0;
    return RPA_LIFECYCLE_STAGES.reduce(
      (sum, s) => sum + (liveCounts[s.id] ?? 0),
      0,
    );
  }, [liveCounts]);

  return (
    <section
      id={compact ? undefined : "rpa-livssyklus"}
      className={cn(
        "scroll-mt-24 rounded-2xl border border-border/50 bg-muted/10",
        compact ? "px-3 py-2.5" : "px-3 py-3 sm:px-4",
        className,
      )}
      aria-labelledby={compact ? undefined : "rpa-lifecycle-heading"}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <h2
              id={compact ? undefined : "rpa-lifecycle-heading"}
              className="text-sm font-semibold tracking-tight text-foreground"
            >
              RPA-livssyklus
            </h2>
            {totalInFlow > 0 ? (
              <span className="text-muted-foreground text-xs tabular-nums">
                {totalInFlow} i flyt
              </span>
            ) : (
              <span className="text-muted-foreground text-xs">
                Trykk et steg for å gå dit
              </span>
            )}
          </div>
        </div>

        {!compact && focused && focusedAction ? (
          <Link
            href={focusedAction.href}
            className={cn(
              "inline-flex min-h-9 max-w-full items-center gap-1 rounded-full px-3 text-xs font-semibold touch-manipulation",
              "bg-foreground text-background hover:opacity-90",
            )}
          >
            <span className="truncate">
              {focusedCount > 0 && focusedId === bottleneck && !pickedId
                ? `Start her · ${focusedCount} i ${SHORT_LABELS[focused.id].toLowerCase()}`
                : focusedCount > 0
                  ? `${focusedCount} · ${focusedAction.label}`
                  : focusedAction.label}
            </span>
            <ChevronRight className="size-3.5 shrink-0 opacity-80" aria-hidden />
          </Link>
        ) : null}

        {onHide ? (
          <button
            type="button"
            onClick={onHide}
            className="text-muted-foreground hover:text-foreground min-h-9 text-xs font-medium underline-offset-2 touch-manipulation hover:underline"
          >
            Skjul
          </button>
        ) : null}
      </div>

      <ol
        className={cn(
          "-mx-0.5 mt-2.5 flex gap-1 overflow-x-auto overscroll-x-contain pb-0.5",
          "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          "sm:grid sm:grid-cols-7 sm:gap-1 sm:overflow-visible sm:pb-0",
        )}
      >
        {RPA_LIFECYCLE_STAGES.map((stage) => {
          const isFocused = stage.id === focusedId;
          const isBottleneck = stage.id === bottleneck && !pickedId;
          const Icon = STAGE_ICONS[stage.id];
          const action = primaryActionForStage(stage.id, workspaceId);
          const count = liveCounts?.[stage.id] ?? 0;
          const hasWork = count > 0;

          return (
            <li key={stage.id} className="min-w-0 shrink-0 sm:shrink">
              <Link
                href={action.href}
                title={`${stage.index}. ${stage.title}${hasWork ? ` — ${count}` : ""}${isBottleneck ? " · første steg med saker" : ""}`}
                onClick={() => setPickedId(stage.id)}
                className={cn(
                  "flex min-h-11 w-[4.5rem] flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-center transition-colors touch-manipulation",
                  "sm:w-auto sm:min-h-[3.25rem]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                  isFocused
                    ? "bg-foreground text-background shadow-sm"
                    : hasWork
                      ? "bg-background text-foreground ring-1 ring-foreground/15 hover:bg-muted/60"
                      : "bg-background/60 text-muted-foreground hover:bg-background hover:text-foreground",
                )}
              >
                <span className="flex items-center gap-1">
                  <Icon className="size-3.5 shrink-0" aria-hidden />
                  {hasWork ? (
                    <span
                      className={cn(
                        "rounded-full px-1 text-[10px] font-semibold tabular-nums leading-none",
                        isFocused ? "bg-background/20" : "bg-foreground/10",
                      )}
                    >
                      {count}
                    </span>
                  ) : null}
                </span>
                <span className="max-w-full truncate text-[10px] font-medium leading-tight">
                  {SHORT_LABELS[stage.id]}
                </span>
                {isBottleneck ? (
                  <span className="sr-only">Første steg med saker</span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ol>

      {focused && focusedAction && !compact ? (
        <p className="text-muted-foreground mt-2 line-clamp-2 text-xs leading-snug">
          <span className="text-foreground font-medium">
            {focused.index}. {focused.title}
          </span>
          {" — "}
          {focused.summary}
        </p>
      ) : null}

      {focused && focusedAction && compact ? (
        <p className="text-muted-foreground mt-1.5 line-clamp-1 text-[11px] leading-snug">
          {focused.title}: {focused.summary}
        </p>
      ) : null}
    </section>
  );
}
