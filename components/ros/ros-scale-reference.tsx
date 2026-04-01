"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { cellRiskClass } from "@/lib/ros-risk-colors";
import {
  DEFAULT_ROS_CONSEQUENCE_REFERENCE,
  DEFAULT_ROS_PROBABILITY_REFERENCE,
  ROS_SCALE_REFERENCE_META,
} from "@/lib/ros-scale-reference";
import { FileText, Scale3d } from "lucide-react";
import { useId, useState } from "react";

type Axis = "probability" | "consequence";

function LevelBadge({ level }: { level: number }) {
  return (
    <span
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-lg border text-sm font-bold tabular-nums",
        cellRiskClass(level),
      )}
    >
      {level}
    </span>
  );
}

export function RosScaleReference({
  className,
  variant = "default",
  /** Fra mal/analyse: «Definisjon av nivå 0–5» — vises når utfylt */
  axisScaleNotes,
  /** Styrt utenfra (f.eks. lagret brukerpreferanse på ROS-forsiden) */
  axis: controlledAxis,
  onAxisChange,
}: {
  className?: string;
  /** I matrise-editor: litt tettere ramme uten ekstra skygge */
  variant?: "default" | "embedded";
  axisScaleNotes?: string | null;
  axis?: Axis;
  onAxisChange?: (axis: Axis) => void;
}) {
  const [uncontrolledAxis, setUncontrolledAxis] = useState<Axis>("probability");
  const controlled =
    controlledAxis !== undefined && typeof onAxisChange === "function";
  const axis = controlled ? controlledAxis! : uncontrolledAxis;
  const setAxis = controlled ? onAxisChange! : setUncontrolledAxis;
  const baseId = useId();
  const embedded = variant === "embedded";
  const customScale = axisScaleNotes?.trim() ?? "";

  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border backdrop-blur-sm",
        embedded
          ? "border-border/40 bg-muted/15 shadow-none"
          : "border-border/50 bg-card/80 shadow-sm",
        className,
      )}
      aria-labelledby={`${baseId}-title`}
    >
      <div
        className={cn(
          "border-border/40 border-b bg-gradient-to-r from-primary/[0.04] to-card",
          embedded ? "px-3 py-2.5 sm:px-4" : "px-4 py-3 sm:px-5",
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "bg-primary/12 text-primary flex shrink-0 items-center justify-center rounded-xl",
                embedded ? "size-8" : "size-9",
              )}
            >
              <Scale3d className={embedded ? "size-3.5" : "size-4"} aria-hidden />
            </div>
            <div className="min-w-0">
              <h3
                id={`${baseId}-title`}
                className={cn(
                  "font-heading font-semibold tracking-tight",
                  embedded ? "text-sm" : "text-sm sm:text-base",
                )}
              >
                {ROS_SCALE_REFERENCE_META.title}
              </h3>
              <p className="text-muted-foreground mt-0.5 text-[11px] leading-snug sm:text-xs">
                {ROS_SCALE_REFERENCE_META.shortNote} På hver akse er nivå{" "}
                <strong className="text-foreground">1</strong> lavest og{" "}
                <strong className="text-foreground">5</strong> høyest.
              </p>
            </div>
          </div>
          <div
            className="bg-muted/60 flex shrink-0 rounded-lg p-0.5"
            role="tablist"
            aria-label="Velg akse"
          >
            <button
              type="button"
              role="tab"
              aria-selected={axis === "probability"}
              className={cn(
                "rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors sm:px-3 sm:text-xs",
                axis === "probability"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setAxis("probability")}
            >
              Sannsynlighet
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={axis === "consequence"}
              className={cn(
                "rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors sm:px-3 sm:text-xs",
                axis === "consequence"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setAxis("consequence")}
            >
              Konsekvens
            </button>
          </div>
        </div>
      </div>

      <div
        className={cn(
          "overflow-y-auto px-3 py-3 sm:px-4 sm:py-4",
          embedded
            ? "max-h-[min(75vh,26rem)]"
            : "max-h-[min(85vh,36rem)]",
        )}
      >
        {customScale ? (
          <Alert className="border-primary/25 bg-primary/[0.06] mb-4">
            <FileText className="text-primary" aria-hidden />
            <AlertTitle className="text-sm">
              Gjeldende definisjon i denne analysen (fra mal)
            </AlertTitle>
            <AlertDescription className="text-foreground/90 whitespace-pre-wrap text-sm leading-relaxed">
              {customScale}
            </AlertDescription>
          </Alert>
        ) : null}
        {customScale ? (
          <p className="text-muted-foreground mb-3 text-[11px] leading-snug sm:text-xs">
            Under følger <strong className="text-foreground">standard</strong>{" "}
            referanse som tilleggsveiledning.
          </p>
        ) : null}
        {axis === "probability" ? (
          <ul className="space-y-3">
            {DEFAULT_ROS_PROBABILITY_REFERENCE.map((row) => (
              <li
                key={row.level}
                className="border-border/40 bg-muted/10 rounded-xl border p-3 sm:p-3.5"
              >
                <div className="flex gap-3">
                  <LevelBadge level={row.level} />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <p className="text-foreground text-sm font-semibold leading-tight">
                      {row.level} — {row.label}
                    </p>
                    <p className="text-muted-foreground text-xs leading-relaxed">
                      {row.description}
                    </p>
                    <p className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] tabular-nums sm:text-xs">
                      <span>
                        <span className="text-foreground/80 font-medium">
                          Frekvens:{" "}
                        </span>
                        {row.frequency}
                      </span>
                      <span>
                        <span className="text-foreground/80 font-medium">
                          Omtrentlig sannsynlighet:{" "}
                        </span>
                        {row.percentageRange}
                      </span>
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="space-y-3">
            {DEFAULT_ROS_CONSEQUENCE_REFERENCE.map((row) => (
              <li
                key={row.level}
                className="border-border/40 bg-muted/10 rounded-xl border p-3 sm:p-3.5"
              >
                <div className="flex gap-3">
                  <LevelBadge level={row.level} />
                  <div className="min-w-0 flex-1 space-y-2.5">
                    <p className="text-foreground text-sm font-semibold leading-tight">
                      {row.level} — {row.label}
                    </p>
                    <div className="space-y-1.5">
                      <p className="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">
                        Konsekvens (virksomhet)
                      </p>
                      <p className="text-muted-foreground text-xs leading-relaxed">
                        {row.general}
                      </p>
                    </div>
                    <div className="space-y-1.5 border-t border-border/30 pt-2">
                      <p className="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">
                        Informasjonssikkerhet
                      </p>
                      <p className="text-muted-foreground text-xs leading-relaxed">
                        {row.informationSecurity}
                      </p>
                    </div>
                    <div className="space-y-1.5 border-t border-border/30 pt-2">
                      <p className="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">
                        Datasikkerhet
                      </p>
                      <p className="text-muted-foreground text-xs leading-relaxed">
                        {row.dataSecurity}
                      </p>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
