"use client";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button-variants";
import type { Id } from "@/convex/_generated/dataModel";
import {
  PIPELINE_STATUS_LABELS,
  type PipelineStatus,
} from "@/lib/assessment-pipeline";
import { cn } from "@/lib/utils";
import { AlertCircle, Link2, Shield, User } from "lucide-react";
import Link from "next/link";

export function AssessmentObjectHeader({
  workspaceId,
  pipelineStatus,
  ownerName,
  hasRosAnalysisLink,
  nextStepLabel,
  firstRosAnalysisId,
  className,
}: {
  workspaceId: Id<"workspaces">;
  pipelineStatus: PipelineStatus;
  ownerName: string | null;
  hasRosAnalysisLink: boolean;
  nextStepLabel: string;
  firstRosAnalysisId: Id<"rosAnalyses"> | null;
  className?: string;
}) {
  const wid = String(workspaceId);
  const rosHref = firstRosAnalysisId
    ? `/w/${wid}/ros/a/${firstRosAnalysisId}`
    : `/w/${wid}/ros`;

  return (
    <div
      className={cn(
        "rounded-xl border border-border/60 bg-gradient-to-br from-muted/30 via-card to-card p-4 shadow-sm",
        className,
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <p className="text-muted-foreground text-[0.65rem] font-semibold uppercase tracking-[0.14em]">
            RPA-vurdering
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="font-medium">
              {PIPELINE_STATUS_LABELS[pipelineStatus]}
            </Badge>
            {hasRosAnalysisLink ? (
              <Badge
                variant="outline"
                className="gap-1 border-emerald-600/35 text-emerald-900 dark:text-emerald-100"
              >
                <Shield className="size-3" aria-hidden />
                ROS koblet
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="gap-1 border-amber-500/45 text-amber-950 dark:text-amber-100"
              >
                <AlertCircle className="size-3" aria-hidden />
                ROS mangler
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground max-w-prose text-sm leading-relaxed">
            <span className="text-foreground font-medium">Neste steg: </span>
            {nextStepLabel}
            {!hasRosAnalysisLink ? (
              <>
                {" "}
                Opprett eller koble en ROS-analyse fra ROS-siden eller fra
                kortet lenger ned i vurderingen.
              </>
            ) : null}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
          {ownerName ? (
            <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
              <User className="size-3.5 shrink-0 opacity-80" aria-hidden />
              <span>
                Opprettet av <span className="text-foreground">{ownerName}</span>
              </span>
            </p>
          ) : null}
          <Link
            href={rosHref}
            className={buttonVariants({
              variant: "outline",
              size: "sm",
              className: "inline-flex gap-1.5",
            })}
          >
            <Link2 className="size-3.5" aria-hidden />
            {hasRosAnalysisLink ? "Åpne ROS-analyse" : "Gå til ROS"}
          </Link>
        </div>
      </div>
    </div>
  );
}
