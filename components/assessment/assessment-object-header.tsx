"use client";

import { PipelineStatusSelect } from "@/components/assessment/pipeline-status-select";
import { Badge } from "@/components/ui/badge";
import type { Id } from "@/convex/_generated/dataModel";
import {
  PIPELINE_STATUS_LABELS,
  type PipelineStatus,
} from "@/lib/assessment-pipeline";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  ExternalLink,
  FileText,
  GitBranch,
  Link2,
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
      className={cn(
        "rounded-2xl bg-card/60 px-3 py-2.5 ring-1 ring-border/40 sm:px-4",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        {canEditPipeline && assessmentId ? (
          <PipelineStatusSelect
            assessmentId={assessmentId}
            value={pipelineStatus}
          />
        ) : (
          <Badge
            variant="secondary"
            className="rounded-full font-medium"
          >
            {PIPELINE_STATUS_LABELS[pipelineStatus]}
          </Badge>
        )}
        {hasRosAnalysisLink ? (
          <Badge
            variant="outline"
            className="gap-1 rounded-full border-emerald-600/30 bg-emerald-500/[0.08] text-emerald-900 dark:text-emerald-100"
          >
            <Shield className="size-3" aria-hidden />
            ROS koblet
          </Badge>
        ) : (
          <Badge
            variant="outline"
            className="gap-1 rounded-full border-amber-500/40 bg-amber-500/[0.08] text-amber-950 dark:text-amber-100"
          >
            <AlertCircle className="size-3" aria-hidden />
            ROS mangler
          </Badge>
        )}
        {evaluationContext?.kind === "candidate" && githubIssueHref ? (
          <a
            href={githubIssueHref}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:bg-muted hover:text-foreground inline-flex items-center gap-1 rounded-full bg-muted/60 px-2 py-0.5 text-[11px] font-medium transition-colors"
            title="Åpne GitHub-saken"
          >
            <GitBranch className="size-3" aria-hidden />
            #{evaluationContext.githubIssueNumber}
            <ExternalLink className="size-3 opacity-70" aria-hidden />
          </a>
        ) : null}

        <div className="ml-auto flex flex-wrap items-center gap-1.5 text-xs">
          {processDesignHref ? (
            <Link
              href={processDesignHref}
              className="text-muted-foreground hover:bg-muted hover:text-foreground inline-flex items-center gap-1 rounded-full px-2 py-1 font-medium transition-colors"
            >
              <FileText className="size-3.5" aria-hidden />
              Prosessdesign
            </Link>
          ) : null}
          <Link
            href={rosHref}
            className="text-muted-foreground hover:bg-muted hover:text-foreground inline-flex items-center gap-1 rounded-full px-2 py-1 font-medium transition-colors"
          >
            <Link2 className="size-3.5" aria-hidden />
            {hasRosAnalysisLink ? "Åpne ROS" : "Gå til ROS"}
          </Link>
        </div>
      </div>

      {evaluationContext?.kind === "loading" ? (
        <div className="bg-muted/40 mt-2 h-4 w-64 max-w-full animate-pulse rounded-full" />
      ) : evaluationContext?.kind === "candidate" ? (
        <p className="text-foreground mt-1.5 truncate text-[13px] leading-snug">
          <span className="text-muted-foreground font-mono text-[11px]">
            {evaluationContext.code}
          </span>{" "}
          <span className="font-medium">{evaluationContext.name}</span>
        </p>
      ) : evaluationContext?.kind === "draft_only" ? (
        <p
          className="text-foreground mt-1.5 truncate text-[13px] leading-snug"
          title="Koble til prosess fra registeret under steget «Prosess» (valgfritt)."
        >
          <span className="font-medium">{evaluationContext.processName}</span>
        </p>
      ) : evaluationContext?.kind === "unset" ? (
        <p className="text-muted-foreground mt-1.5 text-[11px]">
          Ingen prosess valgt — velg under steget «Prosess».
        </p>
      ) : null}
    </section>
  );
}
