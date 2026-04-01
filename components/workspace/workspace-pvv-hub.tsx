"use client";

import { cn } from "@/lib/utils";
import type { Id } from "@/convex/_generated/dataModel";
import { ClipboardList, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback } from "react";

import {
  WorkspaceAssessmentsPanel,
  WorkspaceCandidatesPanel,
} from "./workspace-panels";

export type PvvHubTab = "vurderinger" | "prosesser";

type Props = {
  workspaceId: Id<"workspaces">;
  activeTab: PvvHubTab;
};

export function WorkspacePvvHub({ workspaceId, activeTab }: Props) {
  const router = useRouter();

  const setTab = useCallback(
    (next: PvvHubTab) => {
      const q = next === "prosesser" ? "?fane=prosesser" : "";
      router.replace(`/w/${workspaceId}/vurderinger${q}`, { scroll: false });
    },
    [router, workspaceId],
  );

  return (
    <div className="space-y-4 pb-4">
      <header className="border-border/60 border-b pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="font-heading text-lg font-semibold tracking-tight text-foreground sm:text-xl">
            Vurderinger og prosessregister
          </h1>
          <div
            className="flex w-full shrink-0 gap-0.5 rounded-2xl border border-border/50 bg-muted/40 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-sm dark:bg-muted/25 sm:w-auto sm:min-w-0"
            role="tablist"
            aria-label="Vis vurderinger eller prosessregister"
          >
            <button
              id="tab-vurderinger"
              type="button"
              role="tab"
              aria-selected={activeTab === "vurderinger"}
              onClick={() => setTab("vurderinger")}
              className={cn(
                "flex h-11 min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg px-3 text-[13px] font-medium transition-[color,box-shadow] duration-200 sm:h-10 sm:min-h-0 sm:flex-initial sm:px-4",
                activeTab === "vurderinger"
                  ? "bg-card text-foreground shadow-[0_1px_3px_rgba(0,0,0,0.08)] ring-1 ring-black/[0.06] dark:shadow-[0_1px_3px_rgba(0,0,0,0.35)] dark:ring-white/[0.08]"
                  : "text-muted-foreground hover:bg-card/60 hover:text-foreground",
              )}
            >
              <ClipboardList className="size-4 shrink-0 opacity-80" aria-hidden />
              Vurderinger
            </button>
            <button
              id="tab-prosesser"
              type="button"
              role="tab"
              aria-selected={activeTab === "prosesser"}
              onClick={() => setTab("prosesser")}
              className={cn(
                "flex h-11 min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg px-3 text-[13px] font-medium transition-[color,box-shadow] duration-200 sm:h-10 sm:min-h-0 sm:flex-initial sm:px-4",
                activeTab === "prosesser"
                  ? "bg-card text-foreground shadow-[0_1px_3px_rgba(0,0,0,0.08)] ring-1 ring-black/[0.06] dark:shadow-[0_1px_3px_rgba(0,0,0,0.35)] dark:ring-white/[0.08]"
                  : "text-muted-foreground hover:bg-card/60 hover:text-foreground",
              )}
            >
              <Users className="size-4 shrink-0 opacity-80" aria-hidden />
              Prosessregister
            </button>
          </div>
        </div>
      </header>

      <div
        role="tabpanel"
        id={
          activeTab === "vurderinger"
            ? "panel-vurderinger"
            : "panel-prosesser"
        }
        aria-labelledby={
          activeTab === "vurderinger" ? "tab-vurderinger" : "tab-prosesser"
        }
        className="min-h-0"
      >
        {activeTab === "vurderinger" ? (
          <WorkspaceAssessmentsPanel workspaceId={workspaceId} hubMode />
        ) : (
          <WorkspaceCandidatesPanel workspaceId={workspaceId} hubMode />
        )}
      </div>
    </div>
  );
}
