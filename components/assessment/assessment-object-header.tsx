"use client";

import { PipelineStatusSelect } from "@/components/assessment/pipeline-status-select";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button-variants";
import type { Id } from "@/convex/_generated/dataModel";
import {
  PIPELINE_STATUS_LABELS,
  type PipelineStatus,
} from "@/lib/assessment-pipeline";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  ClipboardList,
  ExternalLink,
  FolderKanban,
  GitBranch,
  Link2,
  Shield,
  User,
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
  ownerName,
  hasRosAnalysisLink,
  nextStepLabel,
  firstRosAnalysisId,
  canEditPipeline = false,
  evaluationContext,
  className,
}: {
  workspaceId: Id<"workspaces">;
  assessmentId?: Id<"assessments">;
  pipelineStatus: PipelineStatus;
  ownerName: string | null;
  hasRosAnalysisLink: boolean;
  nextStepLabel: string;
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
  const processRegisterHref = `/w/${wid}/vurderinger?fane=prosesser`;

  const githubIssueHref =
    evaluationContext?.kind === "candidate" &&
    evaluationContext.githubIssueNumber != null &&
    evaluationContext.githubRepoFullName?.trim()
      ? `https://github.com/${evaluationContext.githubRepoFullName.trim()}/issues/${evaluationContext.githubIssueNumber}`
      : null;

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
            {canEditPipeline && assessmentId ? (
              <PipelineStatusSelect
                assessmentId={assessmentId}
                value={pipelineStatus}
              />
            ) : (
              <Badge variant="secondary" className="font-medium">
                {PIPELINE_STATUS_LABELS[pipelineStatus]}
              </Badge>
            )}
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
          {evaluationContext?.kind === "loading" ? (
            <div className="border-border/50 mt-3 border-t pt-3">
              <p className="text-muted-foreground text-[0.65rem] font-semibold uppercase tracking-[0.12em]">
                Sak / prosess
              </p>
              <div className="bg-muted/40 mt-2 h-9 max-w-md animate-pulse rounded-lg" />
            </div>
          ) : evaluationContext?.kind === "candidate" ? (
            <div className="border-border/50 mt-3 space-y-2 border-t pt-3">
              <p className="text-muted-foreground text-[0.65rem] font-semibold uppercase tracking-[0.12em]">
                Du vurderer nå
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <p className="text-foreground font-heading text-lg font-semibold leading-snug tracking-tight sm:text-xl">
                    <span className="text-muted-foreground font-mono text-base font-semibold sm:text-lg">
                      {evaluationContext.code}
                    </span>{" "}
                    <span className="break-words">{evaluationContext.name}</span>
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {githubIssueHref ? (
                      <a
                        href={githubIssueHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex"
                      >
                        <Badge
                          variant="secondary"
                          className="gap-1 bg-slate-500/10 text-[11px] font-medium text-slate-800 hover:bg-slate-500/15 dark:text-slate-200"
                        >
                          <GitBranch className="size-3" aria-hidden />
                          GitHub #{evaluationContext.githubIssueNumber}
                          <ExternalLink className="size-3 opacity-70" aria-hidden />
                        </Badge>
                      </a>
                    ) : null}
                    {evaluationContext.hasGithubProject ? (
                      <Badge
                        variant="secondary"
                        className="gap-1 bg-violet-500/10 text-[11px] font-medium text-violet-900 dark:text-violet-100"
                      >
                        <FolderKanban className="size-3" aria-hidden />
                        Tavle
                      </Badge>
                    ) : null}
                    {!githubIssueHref && !evaluationContext.hasGithubProject ? (
                      <Badge variant="outline" className="text-[11px] font-normal">
                        Opprettet i PVV
                      </Badge>
                    ) : null}
                  </div>
                </div>
                <Link
                  href={processRegisterHref}
                  className={buttonVariants({
                    variant: "ghost",
                    size: "sm",
                    className:
                      "shrink-0 gap-1.5 self-start text-muted-foreground hover:text-foreground",
                  })}
                >
                  <ClipboardList className="size-3.5" aria-hidden />
                  Prosessregister
                </Link>
              </div>
            </div>
          ) : evaluationContext?.kind === "draft_only" ? (
            <div className="border-border/50 mt-3 space-y-1 border-t pt-3">
              <p className="text-muted-foreground text-[0.65rem] font-semibold uppercase tracking-[0.12em]">
                Du vurderer nå
              </p>
              <p
                className="text-foreground font-heading text-base font-semibold leading-snug sm:text-lg"
                title="Koble til prosess fra registeret under steget «Prosess» (valgfritt)."
              >
                {evaluationContext.processName}
              </p>
            </div>
          ) : evaluationContext?.kind === "unset" ? (
            <div className="border-border/50 mt-3 border-t border-dashed pt-3">
              <p className="text-muted-foreground text-[0.65rem] font-semibold uppercase tracking-[0.12em]">
                Prosess
              </p>
              <p className="text-muted-foreground mt-1 text-sm">
                Velg under steget «Prosess» eller i{" "}
                <Link
                  href={processRegisterHref}
                  className="text-primary font-medium underline-offset-4 hover:underline"
                >
                  prosessregisteret
                </Link>
                .
              </p>
            </div>
          ) : null}
          <p className="text-muted-foreground text-sm leading-snug">
            {nextStepLabel}
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
