"use client";

import { PipelineStatusSelect } from "@/components/assessment/pipeline-status-select";
import type { Id } from "@/convex/_generated/dataModel";
import {
  nextStepHint,
  PIPELINE_STATUS_LABELS,
  type PipelineStatus,
} from "@/lib/assessment-pipeline";
import { isProdOrMonitoring } from "@/lib/puls-issue-types";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  Bug,
  ExternalLink,
  GitBranch,
  Kanban,
  RefreshCw,
  Shield,
} from "lucide-react";
import Link from "next/link";

export type AssessmentEvaluationContext =
  | { kind: "loading" }
  | {
      kind: "candidate";
      code: string;
      name: string;
      githubRepoFullName: string | null;
      githubIssueNumber: number | null;
      hasGithubProject: boolean;
    }
  | { kind: "draft_only"; processName: string }
  | { kind: "unset" };

export function AssessmentObjectHeader({
  workspaceId,
  assessmentId,
  pipelineStatus,
  hasRosAnalysisLink,
  firstRosAnalysisId,
  canEditPipeline = false,
  evaluationContext,
  onLinkRos,
  className,
}: {
  workspaceId: Id<"workspaces">;
  assessmentId?: Id<"assessments">;
  pipelineStatus: PipelineStatus;
  /** Beholdt for bakoverkompatibilitet — vises ikke lenger i den slanke headeren. */
  ownerName?: string | null;
  hasRosAnalysisLink: boolean;
  /** Beholdt for bakoverkompatibilitet — hint hentes fra pipelineStatus. */
  nextStepLabel?: string;
  firstRosAnalysisId: Id<"rosAnalyses"> | null;
  /** Når true og assessmentId er satt: nedtrekk for pipeline-status */
  canEditPipeline?: boolean;
  /** Hvilken prosess/sak vurderingen gjelder — alltid synlig kontekst */
  evaluationContext?: AssessmentEvaluationContext;
  /** Åpne dialog for å koble eksisterende eller ny ROS til denne vurderingen. */
  onLinkRos?: () => void;
  className?: string;
}) {
  const wid = String(workspaceId);
  const rosHref = firstRosAnalysisId
    ? `/w/${wid}/ros/a/${firstRosAnalysisId}`
    : `/w/${wid}/ros`;
  const processDesignHref =
    assessmentId != null ? `/w/${wid}/a/${assessmentId}/prosessdesign` : null;
  const pulsHref = `/w/${wid}/tavler`;
  const inOps = isProdOrMonitoring(pipelineStatus);
  const hint = nextStepHint(pipelineStatus);

  const changeHref =
    assessmentId != null
      ? `/w/${wid}/a/${assessmentId}?puls=endring#puls-kort`
      : null;
  const bugHref =
    assessmentId != null
      ? `/w/${wid}/a/${assessmentId}?puls=feil#puls-kort`
      : null;

  const githubIssueHref =
    evaluationContext?.kind === "candidate" &&
    evaluationContext.githubIssueNumber != null &&
    evaluationContext.githubRepoFullName?.trim()
      ? `https://github.com/${evaluationContext.githubRepoFullName.trim()}/issues/${evaluationContext.githubIssueNumber}`
      : null;

  return (
    <section
      aria-label="Vurderingens kontekst"
      className={cn("space-y-2 border-y border-border/50 py-3", className)}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        {canEditPipeline && assessmentId ? (
          <PipelineStatusSelect
            assessmentId={assessmentId}
            value={pipelineStatus}
          />
        ) : (
          <span className="font-medium text-foreground">
            {PIPELINE_STATUS_LABELS[pipelineStatus]}
          </span>
        )}
        <span
          className={cn(
            "inline-flex items-center gap-1.5",
            hasRosAnalysisLink ? "text-muted-foreground" : "text-foreground",
          )}
        >
          {hasRosAnalysisLink ? (
            <Shield className="size-3.5" aria-hidden />
          ) : (
            <AlertCircle className="size-3.5" aria-hidden />
          )}
          {hasRosAnalysisLink ? "ROS koblet" : "ROS mangler"}
        </span>
        {evaluationContext?.kind === "candidate" && githubIssueHref ? (
          <a
            href={githubIssueHref}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 font-medium underline-offset-4 transition-colors hover:underline"
            title="Åpne GitHub-saken"
          >
            <GitBranch className="size-3.5" aria-hidden />
            #{evaluationContext.githubIssueNumber}
            <ExternalLink className="size-3 opacity-70" aria-hidden />
          </a>
        ) : null}

        <div className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-2">
          <Link
            href={pulsHref}
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 font-medium underline-offset-4 transition-colors hover:underline"
          >
            <Kanban className="size-3.5" aria-hidden />
            Åpne Tavler
          </Link>
          {processDesignHref ? (
            <Link
              href={processDesignHref}
              className="text-muted-foreground hover:text-foreground font-medium underline-offset-4 transition-colors hover:underline"
            >
              Prosessdesign
            </Link>
          ) : null}
          {hasRosAnalysisLink ? (
            <Link
              href={rosHref}
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Åpne ROS
            </Link>
          ) : onLinkRos ? (
            <button
              type="button"
              onClick={onLinkRos}
              className="inline-flex h-9 items-center rounded-full bg-foreground px-3.5 text-xs font-semibold text-background touch-manipulation hover:opacity-90"
            >
              Koble ROS
            </button>
          ) : (
            <Link
              href={rosHref}
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Gå til ROS
            </Link>
          )}
        </div>
      </div>

      {evaluationContext?.kind === "loading" ? (
        <div className="bg-muted/40 h-4 w-64 max-w-full animate-pulse rounded-full" />
      ) : evaluationContext?.kind === "candidate" ? (
        <p className="text-foreground truncate text-[13px] leading-snug">
          <span className="text-muted-foreground font-mono text-[11px]">
            {evaluationContext.code}
          </span>{" "}
          <span className="font-medium">{evaluationContext.name}</span>
        </p>
      ) : evaluationContext?.kind === "draft_only" ? (
        <p
          className="text-foreground truncate text-[13px] leading-snug"
          title="Koble til prosess fra registeret under steget «Prosess» (valgfritt)."
        >
          <span className="font-medium">{evaluationContext.processName}</span>
        </p>
      ) : evaluationContext?.kind === "unset" ? (
        <p className="text-muted-foreground text-xs">
          Ingen prosess valgt — velg under steget «Prosess».
        </p>
      ) : null}

      {inOps && assessmentId ? (
        <div className="bg-muted/25 flex flex-col gap-2.5 rounded-xl border border-border/40 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground min-w-0 text-xs leading-snug sm:text-[13px]">
            {hint}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {changeHref ? (
              <Link
                href={changeHref}
                className="bg-background hover:bg-muted inline-flex h-9 items-center gap-1.5 rounded-full border border-border/50 px-3 text-xs font-semibold text-foreground touch-manipulation"
              >
                <RefreshCw className="size-3.5" aria-hidden />
                Endringsønske
              </Link>
            ) : null}
            {bugHref ? (
              <Link
                href={bugHref}
                className="bg-background hover:bg-muted inline-flex h-9 items-center gap-1.5 rounded-full border border-border/50 px-3 text-xs font-semibold text-foreground touch-manipulation"
              >
                <Bug className="size-3.5" aria-hidden />
                Feil
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
