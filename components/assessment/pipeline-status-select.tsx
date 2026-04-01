"use client";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "@/lib/app-toast";
import {
  PIPELINE_KANBAN_ORDER,
  PIPELINE_STATUS_LABELS,
  type PipelineStatus,
} from "@/lib/assessment-pipeline";
import { cn } from "@/lib/utils";
import { useMutation } from "convex/react";

type Props = {
  assessmentId: Id<"assessments">;
  value: PipelineStatus;
  disabled?: boolean;
  className?: string;
  /** Mindre tekst og padding (kort og tabeller) */
  compact?: boolean;
};

/**
 * Velger pipeline-status for en vurdering (erstatter tidligere Leveranse-tavle).
 * Stopper propagasjon slik at den kan ligge inne i klikkbare kort/lenker.
 */
export function PipelineStatusSelect({
  assessmentId,
  value,
  disabled = false,
  className,
  compact = false,
}: Props) {
  const setStatus = useMutation(api.assessments.setPipelineStatus);

  return (
    <select
      aria-label="Pipeline-status for vurdering"
      disabled={disabled}
      value={value}
      className={cn(
        compact
          ? [
              "border-input bg-background text-foreground w-full max-w-none rounded-lg border font-medium shadow-xs",
              /* Mobil: større tekst og tappflate (≥44px); unngår iOS-zoom ved fokus (≥16px) */
              "min-h-11 px-3 py-2 text-base sm:min-h-0 sm:w-auto sm:max-w-[12rem] sm:rounded-md sm:px-2 sm:py-1 sm:text-[11px]",
            ]
          : "border-input bg-background text-foreground min-h-11 rounded-lg border px-3 py-2 text-base font-medium shadow-xs sm:min-h-0 sm:px-2.5 sm:py-1.5 sm:text-sm",
        "touch-manipulation",
        className,
      )}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      onChange={async (e) => {
        const next = e.target.value as PipelineStatus;
        if (next === value) return;
        try {
          await setStatus({ assessmentId, status: next });
          toast.success("Status oppdatert.");
        } catch (err) {
          toast.error(
            err instanceof Error ? err.message : "Kunne ikke oppdatere status.",
          );
        }
      }}
    >
      {PIPELINE_KANBAN_ORDER.map((s) => (
        <option key={s} value={s}>
          {PIPELINE_STATUS_LABELS[s]}
        </option>
      ))}
    </select>
  );
}
