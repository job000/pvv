"use client";

import { Sheet, SheetContent } from "@/components/ui/sheet";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "@/lib/app-toast";
import {
  PIPELINE_KANBAN_ORDER,
  PIPELINE_STATUS_LABELS,
  PIPELINE_STATUS_TONES,
  readinessLabel,
  type PipelineStatus,
} from "@/lib/assessment-pipeline";
import { cn } from "@/lib/utils";
import { useMutation } from "convex/react";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import {
  useCallback,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from "react";

type Props = {
  assessmentId: Id<"assessments">;
  value: PipelineStatus;
  disabled?: boolean;
  className?: string;
  /** Mindre pill (kort og lister) */
  compact?: boolean;
};

export function PipelineStatusBadge({
  value,
  className,
  compact = false,
}: {
  value: PipelineStatus;
  className?: string;
  compact?: boolean;
}) {
  const tone = PIPELINE_STATUS_TONES[value];
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full font-semibold ring-1",
        compact
          ? "px-2 py-0.5 text-[11px] leading-none"
          : "px-2.5 py-1 text-xs leading-none",
        tone.pill,
        className,
      )}
    >
      <span
        className={cn("size-1.5 shrink-0 rounded-full", tone.dot)}
        aria-hidden
      />
      <span className="truncate">{PIPELINE_STATUS_LABELS[value]}</span>
    </span>
  );
}

/**
 * Pipeline-status for en vurdering.
 * Én stil overalt: bottom sheet (unngår flimmer fra Menu/isDesktop-bytte).
 * Stopper propagasjon slik at den kan ligge i klikkbare kort/lenker.
 */
export function PipelineStatusSelect({
  assessmentId,
  value,
  disabled = false,
  className,
  compact = false,
}: Props) {
  const setStatus = useMutation(api.assessments.setPipelineStatus);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const applyStatus = useCallback(
    async (next: PipelineStatus) => {
      if (next === value || busy || disabled) return;
      setBusy(true);
      try {
        const res = await setStatus({ assessmentId, status: next });
        if (res.deliveryTasksCreated) {
          toast.success(
            "Leveranse klar: ROS/PDD opprettet ved behov, oppgaver på tavlen, involverte varslet.",
          );
        } else {
          toast.success(`Status: ${PIPELINE_STATUS_LABELS[next]}`);
        }
        setOpen(false);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Kunne ikke oppdatere status.",
        );
      } finally {
        setBusy(false);
      }
    },
    [assessmentId, busy, disabled, setStatus, value],
  );

  const stopCardNav = {
    onClick: (e: MouseEvent) => e.stopPropagation(),
    onPointerDown: (e: PointerEvent) => e.stopPropagation(),
    onKeyDown: (e: KeyboardEvent) => e.stopPropagation(),
  } as const;

  return (
    <div className="inline-flex max-w-full min-w-0" {...stopCardNav}>
      <button
        type="button"
        disabled={disabled || busy}
        aria-label={`Pipeline-status: ${PIPELINE_STATUS_LABELS[value]}. Trykk for å endre.`}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          "inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-full font-semibold ring-1 touch-manipulation",
          "hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "disabled:pointer-events-none disabled:opacity-50",
          compact
            ? "h-8 max-w-[9.5rem] px-2.5 text-[11px] sm:max-w-[11rem] sm:h-7"
            : "h-10 min-h-10 max-w-[14rem] px-3 text-sm sm:h-9 sm:min-h-0",
          PIPELINE_STATUS_TONES[value].pill,
          className,
        )}
        onClick={() => setOpen(true)}
      >
        {busy ? (
          <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden />
        ) : (
          <span
            className={cn(
              "size-1.5 shrink-0 rounded-full",
              PIPELINE_STATUS_TONES[value].dot,
            )}
            aria-hidden
          />
        )}
        <span className="min-w-0 truncate">
          {PIPELINE_STATUS_LABELS[value]}
        </span>
        <ChevronDown className="size-3.5 shrink-0 opacity-70" aria-hidden />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" showOnDesktop className="gap-0 px-0">
          <div className="border-border/50 border-b px-4 pb-3">
            <p className="font-heading text-base font-semibold tracking-tight">
              Sett status
            </p>
            <p className="text-muted-foreground mt-0.5 text-sm">
              Hvor er vurderingen i livssyklusen?
            </p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-3">
            <ul
              className="space-y-0.5 p-1.5"
              role="listbox"
              aria-label="Velg status"
            >
              {PIPELINE_KANBAN_ORDER.map((s) => {
                const active = s === value;
                const tone = PIPELINE_STATUS_TONES[s];
                return (
                  <li key={s} role="option" aria-selected={active}>
                    <button
                      type="button"
                      disabled={busy || disabled}
                      className={cn(
                        "flex w-full min-h-12 items-start gap-2.5 rounded-xl px-3 py-2.5 text-left touch-manipulation transition-colors sm:min-h-0",
                        "hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none active:bg-muted/80",
                        active && "bg-foreground/[0.06]",
                      )}
                      onClick={() => void applyStatus(s)}
                    >
                      <span
                        className={cn(
                          "mt-1.5 size-2 shrink-0 rounded-full",
                          tone.dot,
                        )}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1">
                        <span className="text-foreground block text-sm font-medium">
                          {PIPELINE_STATUS_LABELS[s]}
                        </span>
                        <span className="text-muted-foreground mt-0.5 block text-xs leading-snug">
                          {readinessLabel(s)}
                        </span>
                      </span>
                      <Check
                        className={cn(
                          "mt-0.5 size-4 shrink-0",
                          active
                            ? "text-foreground opacity-100"
                            : "opacity-0",
                        )}
                        aria-hidden
                      />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
