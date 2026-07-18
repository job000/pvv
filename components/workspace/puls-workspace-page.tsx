"use client";

import { IssuesProjectBoard } from "@/components/workspace/issues-project-board";
import { PortfolioPriorityBoard } from "@/components/workspace/portfolio-priority-board";
import type { Id } from "@/convex/_generated/dataModel";
import { pulsBoardCopy } from "@/lib/puls-board-copy";
import { cn } from "@/lib/utils";
import { useStickyState } from "@/lib/use-sticky-state";
import { Activity } from "lucide-react";

type BoardView = "tavle" | "pipeline";

export function PulsWorkspacePage({
  workspaceId,
}: {
  workspaceId: Id<"workspaces">;
}) {
  const [view, setView] = useStickyState<BoardView>(
    `puls-page:view:${workspaceId}`,
    "tavle",
  );

  return (
    <div className="flex min-h-0 min-w-0 flex-col gap-0 overflow-x-clip pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      <div className="relative overflow-hidden rounded-2xl border border-border/40 bg-gradient-to-br from-sky-500/[0.07] via-background to-violet-500/[0.06] px-4 py-4 sm:px-5 sm:py-5">
        <div
          className="pointer-events-none absolute -top-16 right-0 size-48 rounded-full bg-sky-400/10 blur-3xl"
          aria-hidden
        />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="mb-1.5 flex items-center gap-2">
              <span className="bg-sky-500/15 text-sky-900 dark:text-sky-100 inline-flex size-8 items-center justify-center rounded-xl">
                <Activity className="size-4" aria-hidden />
              </span>
              <p className="text-muted-foreground text-[11px] font-medium tracking-[0.14em] uppercase">
                Arbeidsrytme
              </p>
            </div>
            <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {pulsBoardCopy.pageTitle}
            </h1>
            <p className="text-muted-foreground mt-1 max-w-xl text-sm leading-relaxed">
              {view === "tavle"
                ? pulsBoardCopy.pageSubtitle
                : pulsBoardCopy.pipelineSubtitle}
            </p>
          </div>

          <div
            role="tablist"
            aria-label="Visning"
            className="bg-background/80 inline-flex w-fit rounded-xl border border-border/50 p-1 shadow-xs backdrop-blur-sm"
          >
            {(
              [
                ["tavle", pulsBoardCopy.tabBoard],
                ["pipeline", pulsBoardCopy.tabPipeline],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={view === id}
                onClick={() => setView(id)}
                className={cn(
                  "h-9 min-w-[5.5rem] rounded-lg px-3 text-sm font-medium transition-colors touch-manipulation",
                  view === id
                    ? "bg-foreground text-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 min-w-0">
        {view === "tavle" ? (
          <IssuesProjectBoard workspaceId={workspaceId} />
        ) : (
          <PortfolioPriorityBoard
            workspaceId={workspaceId}
            embedded
            title={pulsBoardCopy.tabPipeline}
          />
        )}
      </div>
    </div>
  );
}
