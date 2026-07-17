"use client";

import { PipelineStatusSelect } from "@/components/assessment/pipeline-status-select";
import type { Id } from "@/convex/_generated/dataModel";
import {
  PIPELINE_STATUS_LABELS,
  type PipelineStatus,
} from "@/lib/assessment-pipeline";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  ExternalLink,
  GitBranch,
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
  className,
}: {
  workspaceId: Id<"workspaces">;
  assessmentId?: Id<"assessments">;
  pipelineStatus: PipelineStatus;
  /** Beholdt for bakoverkompatibilitet — vises ikke lenger i den slanke headeren. */
  ownerName?: string | null;
  hasRosAnalysisLink: boolean;
  /** Beholdt for bakoverkompatibilitet — vises ikke lenger som egen tekst. */
  nextStepLabel?: string;
  firstRosAnalysisId: Id<"rosAnalyses"> | null;
  /** Når true og assessmentId er satt: nedtrekk for pipeline-status */
  canEditPipeline?: boolean;
  /** Hvilken prosess/sak vurderingen gjelder — alltid synlig kontekst */
  evaluationContext?: AssessmentEvaluationContext;
  className?: string;
}) {
  const wid = String(workspaceId);
  const rosHref = firstRosAnalysisId
    ? `/w/${wid}/ros/a/${firstRosAnalysisId}`
    : `/w/${wid}/ros`;
  const processDesignHref =
    assessmentId != null ? `/w/${wid}/a/${assessmentId}/prosessdesign` : null;

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

        <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-2">
          {processDesignHref ? (
            <Link
              href={processDesignHref}
              className="text-muted-foreground hover:text-foreground font-medium underline-offset-4 transition-colors hover:underline"
            >
              Prosessdesign
            </Link>
          ) : null}
          <Link
            href={rosHref}
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            {hasRosAnalysisLink ? "Åpne ROS" : "Gå til ROS"}
          </Link>
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
    </section>
  );
}
