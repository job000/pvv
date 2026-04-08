"use client";

import type { Id } from "@/convex/_generated/dataModel";
import { cellRiskClass } from "@/lib/ros-risk-colors";
import { cn } from "@/lib/utils";
import { FileText, Layers, Shield } from "lucide-react";
import Link from "next/link";
import { Fragment, type ReactNode } from "react";

export type OrgRosRollup = {
  candidateCount: number;
  analysisCount: number;
  maxBefore: number;
  maxAfter: number;
  /** PVV-vurderinger (aggregeres i org-tre-query) */
  assessmentCount?: number;
  /** Godkjente inntak via vurdering (aggregeres i org-tre-query) */
  intakeSubmissionCount?: number;
  /** Inntaksskjema direkte knyttet til enhet (aggregeres i org-tre-query) */
  intakeFormCount?: number;
};

function MiniLevel({
  label,
  level,
}: {
  label: string;
  level: number;
}) {
  const cls =
    level > 0 ? cellRiskClass(level) : "bg-muted/80 text-muted-foreground border-border/50";
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-muted-foreground truncate text-[9px] font-medium uppercase tracking-wide">
        {label}
      </span>
      <span
        className={cn(
          "inline-flex min-h-[1.75rem] items-center justify-center rounded-lg border px-2 text-sm font-bold tabular-nums",
          cls,
        )}
      >
        {level > 0 ? level : "—"}
      </span>
    </div>
  );
}

/** Kompakt ROS-/konsekvenssammendrag for én organisasjonsenhet (inkl. underenheter). */
export function OrgUnitRosKpiStrip({
  workspaceId,
  stats,
  variant = "full",
  /** Når true: brukes inni accordion — skjul egen tittelrad (brukeren ser tittel i summary). */
  embedded = false,
}: {
  workspaceId: Id<"workspaces">;
  stats: OrgRosRollup;
  variant?: "full" | "inline";
  embedded?: boolean;
}) {
  const { candidateCount, analysisCount, maxBefore, maxAfter } = stats;
  const assessmentCount = stats.assessmentCount ?? 0;
  const intakeSubmissionCount = stats.intakeSubmissionCount ?? 0;
  const intakeFormCount = stats.intakeFormCount ?? 0;
  const hasActivity = candidateCount > 0 || analysisCount > 0;
  const hasExtended =
    assessmentCount > 0 ||
    intakeSubmissionCount > 0 ||
    intakeFormCount > 0;

  if (variant === "inline") {
    if (!hasActivity) return null;
    return (
      <span className="text-muted-foreground inline-flex flex-wrap items-center gap-1.5 text-[10px] font-medium">
        <span className="inline-flex items-center gap-0.5 rounded-md bg-primary/12 px-1.5 py-0.5 text-primary">
          <FileText className="size-3 shrink-0" aria-hidden />
          {analysisCount} ROS
        </span>
        <span className="text-border" aria-hidden>
          ·
        </span>
        <span className="tabular-nums">
          max {maxBefore || "—"} → {maxAfter || "—"}
        </span>
      </span>
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl border border-border/50 bg-muted/20 px-3 py-3 ring-1 ring-black/[0.03] dark:bg-muted/10 dark:ring-white/[0.05]",
        embedded &&
          "border-0 bg-transparent px-0 py-0 ring-0 shadow-none dark:bg-transparent",
      )}
    >
      {!embedded ? (
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Risiko og konsekvens (ROS)
          </p>
          <Link
            href={`/w/${workspaceId}/ros`}
            className="text-primary text-[10px] font-semibold hover:underline"
          >
            Åpne ROS
          </Link>
        </div>
      ) : null}
      {!hasActivity ? (
        <p className="text-muted-foreground text-xs leading-relaxed">
          Ingen prosesser med ROS i denne delen av treet ennå. Knytt prosesser til enheten under
          «Prosesser», og opprett ROS fra ROS-arbeidsflaten.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="flex items-start gap-2 rounded-lg bg-card/80 px-2.5 py-2 ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Layers className="size-4" aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="text-lg font-bold tabular-nums leading-none">{candidateCount}</p>
              <p className="text-muted-foreground mt-0.5 text-[10px] font-medium leading-tight">
                Prosesser
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2 rounded-lg bg-card/80 px-2.5 py-2 ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FileText className="size-4" aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="text-lg font-bold tabular-nums leading-none">{analysisCount}</p>
              <p className="text-muted-foreground mt-0.5 text-[10px] font-medium leading-tight">
                ROS-analyser
              </p>
            </div>
          </div>
          <MiniLevel label="Høyeste før tiltak" level={maxBefore} />
          <MiniLevel label="Høyeste etter tiltak" level={maxAfter} />
        </div>
      )}
      {hasActivity && maxAfter > 0 && maxAfter < maxBefore ? (
        <p className="text-muted-foreground mt-2 text-[10px] leading-snug">
          <Shield className="mr-1 inline size-3 text-emerald-600 dark:text-emerald-400" aria-hidden />
          Restnivå lavere enn utgangspunktet i minst én analyse under denne enheten.
        </p>
      ) : null}
      {hasExtended ? (
        <p className="text-muted-foreground mt-2 border-t border-border/40 pt-2 text-[10px] leading-snug">
          {(() => {
            const chunks: ReactNode[] = [];
            if (assessmentCount > 0) {
              chunks.push(
                <Fragment key="assess">
                  <span className="text-foreground font-medium">{assessmentCount}</span>{" "}
                  PVV-vurdering{assessmentCount === 1 ? "" : "er"} i treet
                </Fragment>,
              );
            }
            if (intakeSubmissionCount > 0) {
              chunks.push(
                <Fragment key="sub">
                  <span className="text-foreground font-medium">{intakeSubmissionCount}</span>{" "}
                  godkjent inntak knyttet til vurdering i treet
                </Fragment>,
              );
            }
            if (intakeFormCount > 0) {
              chunks.push(
                <Fragment key="forms">
                  <span className="text-foreground font-medium">{intakeFormCount}</span>{" "}
                  inntaksskjema knyttet til enhet i treet
                </Fragment>,
              );
            }
            return chunks.map((node, i) => (
              <Fragment key={i}>
                {i > 0 ? " · " : null}
                {node}
              </Fragment>
            ));
          })()}
        </p>
      ) : null}
    </div>
  );
}
