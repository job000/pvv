"use client";

import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import type { Id } from "@/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { ClipboardList, Users } from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback } from "react";

const WorkspaceAssessmentsPanel = dynamic(
  () =>
    import("./workspace-panels").then((mod) => ({
      default: mod.WorkspaceAssessmentsPanel,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[20vh] items-center justify-center">
        <div className="size-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    ),
  },
);

const WorkspaceCandidatesPanel = dynamic(
  () =>
    import("./workspace-panels").then((mod) => ({
      default: mod.WorkspaceCandidatesPanel,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[20vh] items-center justify-center">
        <div className="size-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    ),
  },
);

export type PvvHubTab = "vurderinger" | "prosesser";

type Props = {
  workspaceId: Id<"workspaces">;
  activeTab: PvvHubTab;
};

export function WorkspacePvvHub({ workspaceId, activeTab }: Props) {
  const router = useRouter();

  /** Alltid abonnert — ikke bare når Prosessregister-fanen er aktiv (unngår tom liste ved bytte av fane). */
  const approvedIntakeForProcessregister = useQuery(
    api.intakeSubmissions.listApprovedForProcessregister,
    { workspaceId },
  );

  const setTab = useCallback(
    (next: PvvHubTab) => {
      const q = next === "prosesser" ? "?fane=prosesser" : "";
      router.replace(`/w/${workspaceId}/vurderinger${q}`, { scroll: false });
    },
    [router, workspaceId],
  );

  return (
    <div className="space-y-5 pb-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-heading text-xl font-semibold tracking-tight text-foreground">
          {activeTab === "vurderinger" ? "Vurderinger" : "Prosesser"}
        </h1>
        <div
          className="flex w-full shrink-0 gap-1 rounded-xl border border-border/40 bg-muted/30 p-1 sm:w-auto"
          role="tablist"
          aria-label="Vis vurderinger eller prosesser"
        >
          <button
            id="tab-vurderinger"
            type="button"
            role="tab"
            aria-selected={activeTab === "vurderinger"}
            onClick={() => setTab("vurderinger")}
            className={cn(
              "flex h-10 min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors sm:h-9 sm:min-h-0 sm:flex-initial sm:px-4",
              activeTab === "vurderinger"
                ? "bg-background text-foreground shadow-sm ring-1 ring-border/50"
                : "text-muted-foreground hover:text-foreground",
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
              "flex h-10 min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors sm:h-9 sm:min-h-0 sm:flex-initial sm:px-4",
              activeTab === "prosesser"
                ? "bg-background text-foreground shadow-sm ring-1 ring-border/50"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Users className="size-4 shrink-0 opacity-80" aria-hidden />
            Prosesser
          </button>
        </div>
      </header>

      <div
        role="tabpanel"
        id={activeTab === "vurderinger" ? "panel-vurderinger" : "panel-prosesser"}
        aria-labelledby={activeTab === "vurderinger" ? "tab-vurderinger" : "tab-prosesser"}
        className="min-h-0"
      >
        {activeTab === "vurderinger" ? (
          <WorkspaceAssessmentsPanel
            workspaceId={workspaceId}
            hubMode
            approvedIntakeForProcessregister={approvedIntakeForProcessregister}
          />
        ) : (
          <WorkspaceCandidatesPanel
            workspaceId={workspaceId}
            hubMode
            approvedIntakeForProcessregister={approvedIntakeForProcessregister}
          />
        )}
      </div>
    </div>
  );
}
