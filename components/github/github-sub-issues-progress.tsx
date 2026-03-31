"use client";

import { cn } from "@/lib/utils";

export type GithubSubIssuesSummaryDisplay = {
  total: number;
  completed: number;
  percentCompleted: number | null;
};

type Props = {
  summary: GithubSubIssuesSummaryDisplay;
  className?: string;
};

/**
 * Fremdrift på GitHub under-saker (lukket/totalt). Brukes kun når prosjektkortet
 * peker på et **repo-issue** — utkast (draft) har ikke under-saker i GitHub API.
 */
export function GithubSubIssuesProgress({ summary, className }: Props) {
  const pct =
    summary.percentCompleted ??
    (summary.total > 0
      ? Math.round((summary.completed / summary.total) * 100)
      : 0);
  const clamped = Math.min(100, Math.max(0, pct));
  return (
    <div className={cn("space-y-1", className)}>
      <p className="text-muted-foreground text-[11px] font-medium">
        Under-saker (GitHub)
      </p>
      <div className="flex items-center gap-2">
        <div
          className="bg-muted h-2 min-w-0 flex-1 overflow-hidden rounded-full"
          role="progressbar"
          aria-valuenow={clamped}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${summary.completed} av ${summary.total} under-saker lukket`}
        >
          <div
            className="bg-primary h-full rounded-full transition-[width]"
            style={{ width: `${clamped}%` }}
          />
        </div>
        <span className="text-foreground shrink-0 text-[11px] font-medium tabular-nums">
          {summary.completed}/{summary.total}
        </span>
      </div>
    </div>
  );
}
