"use client";

import { IssuesProjectBoard } from "@/components/workspace/issues-project-board";
import { PortfolioPriorityBoard } from "@/components/workspace/portfolio-priority-board";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { useStickyState } from "@/lib/use-sticky-state";
import Link from "next/link";

type BoardView = "saker" | "pipeline";

export function SakerWorkspacePage({
  workspaceId,
}: {
  workspaceId: Id<"workspaces">;
}) {
  const [view, setView] = useStickyState<BoardView>(
    `saker-page:view:${workspaceId}`,
    "saker",
  );

  return (
    <div className="flex min-h-0 min-w-0 flex-col gap-0 overflow-x-clip pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      <div className="space-y-3 border-b border-border/50 pb-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              Saker
            </h1>
            <p className="text-muted-foreground mt-0.5 text-sm">
              {view === "saker"
                ? "Issues og under-saker som egne kort — som i GitHub Projects."
                : "Pipeline for vurderingskandidater gjennom livssyklusen."}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Link
              href={`/w/${workspaceId}/gevinster`}
              className="inline-flex h-8 items-center rounded-md border border-border/60 bg-background px-3 text-xs font-medium text-foreground hover:bg-muted/50"
            >
              Gevinster
            </Link>
            <Link
              href={`/w/${workspaceId}/oppgaver`}
              className="inline-flex h-8 items-center rounded-md border border-border/60 bg-background px-3 text-xs font-medium text-foreground hover:bg-muted/50"
            >
              Oppgaver
            </Link>
          </div>
        </div>

        <div
          role="tablist"
          aria-label="Tavlevisning"
          className="inline-flex rounded-lg border border-border/50 bg-muted/20 p-0.5"
        >
          {(
            [
              ["saker", "Saker"],
              ["pipeline", "Pipeline"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={view === id}
              onClick={() => setView(id)}
              className={cn(
                "h-8 rounded-md px-3 text-xs font-medium transition-colors",
                view === id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 min-w-0">
        {view === "saker" ? (
          <IssuesProjectBoard workspaceId={workspaceId} />
        ) : (
          <PortfolioPriorityBoard
            workspaceId={workspaceId}
            embedded
            title="Pipeline"
          />
        )}
      </div>
    </div>
  );
}
