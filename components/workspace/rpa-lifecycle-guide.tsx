"use client";

import type { Id } from "@/convex/_generated/dataModel";
import {
  RPA_LIFECYCLE_STAGES,
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
import { useState, type ComponentType } from "react";

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
  /** Forhåndsvalgt steg (f.eks. i prosessdetalj). */
  activeStageId?: RpaLifecycleStageId | null;
  /**
   * @deprecated Live-tellere brukes ikke lenger på hjem — komponenten er en guide.
   * Beholdt valgfritt for bakoverkompatibilitet; ignoreres i UI.
   */
  liveCounts?: Partial<Record<RpaLifecycleStageId, number>> | null;
  /** Ekstra kompakt (f.eks. i dialog). */
  compact?: boolean;
  className?: string;
  onHide?: () => void;
};

export function RpaLifecycleGuide({
  workspaceId,
  activeStageId = null,
  compact = false,
  className,
  onHide,
}: Props) {
  const [pickedId, setPickedId] = useState<RpaLifecycleStageId | null>(null);
  const focusedId = pickedId ?? activeStageId ?? "identify";
  const focused = getRpaLifecycleStage(focusedId);
  const focusedAction = primaryActionForStage(focused.id, workspaceId);

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
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
        <div className="min-w-0 flex-1">
          <h2
            id={compact ? undefined : "rpa-lifecycle-heading"}
            className="text-sm font-semibold tracking-tight text-foreground"
          >
            {compact ? "Livssyklus" : "Slik fungerer RPA i PVV"}
          </h2>
          {!compact ? (
            <p className="text-muted-foreground mt-0.5 text-xs leading-snug">
              Kort oversikt over stegene fra idé til drift. Trykk for å lese mer.
            </p>
          ) : null}
        </div>

        {onHide ? (
          <button
            type="button"
            onClick={onHide}
            className="text-muted-foreground hover:text-foreground min-h-9 shrink-0 text-xs font-medium underline-offset-2 touch-manipulation hover:underline"
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
          const Icon = STAGE_ICONS[stage.id];

          return (
            <li key={stage.id} className="min-w-0 shrink-0 sm:shrink">
              <button
                type="button"
                title={`${stage.index}. ${stage.title}`}
                onClick={() => setPickedId(stage.id)}
                aria-pressed={isFocused}
                className={cn(
                  "flex min-h-11 w-[4.5rem] flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-center transition-colors touch-manipulation",
                  "sm:w-auto sm:min-h-[3.25rem]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                  isFocused
                    ? "bg-foreground text-background shadow-sm"
                    : "bg-background/60 text-muted-foreground hover:bg-background hover:text-foreground",
                )}
              >
                <Icon className="size-3.5 shrink-0" aria-hidden />
                <span className="max-w-full truncate text-[10px] font-medium leading-tight">
                  {SHORT_LABELS[stage.id]}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {!compact ? (
        <div className="mt-3 space-y-2 border-t border-border/40 pt-3">
          <p className="text-sm leading-snug">
            <span className="text-foreground font-medium">
              {focused.index}. {focused.title}
            </span>
            <span className="text-muted-foreground">
              {" — "}
              {focused.summary}
            </span>
          </p>
          <Link
            href={focusedAction.href}
            className={cn(
              "text-foreground inline-flex min-h-9 items-center gap-1 text-xs font-semibold touch-manipulation",
              "underline-offset-4 hover:underline",
            )}
          >
            {focusedAction.label}
            <ChevronRight className="size-3.5 shrink-0 opacity-70" aria-hidden />
          </Link>
        </div>
      ) : (
        <p className="text-muted-foreground mt-1.5 line-clamp-2 text-[11px] leading-snug">
          <span className="text-foreground font-medium">{focused.title}:</span>{" "}
          {focused.summary}
        </p>
      )}
    </section>
  );
}
