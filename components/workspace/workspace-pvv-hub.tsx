"use client";

import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import type { Id } from "@/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useMemo } from "react";

const WorkspaceAssessmentsPanel = dynamic(
  () =>
    import("./workspace-panels").then((mod) => ({
      default: mod.WorkspaceAssessmentsPanel,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[20vh] items-center justify-center">
        <div className="size-7 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
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
        <div className="size-7 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
      </div>
    ),
  },
);

export type PvvHubTab = "vurderinger" | "prosesser";

type Props = {
  workspaceId: Id<"workspaces">;
  activeTab: PvvHubTab;
  initialOrgUnit?: Id<"orgUnits"> | null;
};

export function WorkspacePvvHub({ workspaceId, activeTab, initialOrgUnit }: Props) {
  const router = useRouter();
  const orgUnits = useQuery(api.orgUnits.listByWorkspace, { workspaceId });

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
  const activeOrgUnitName = useMemo(() => {
    if (!initialOrgUnit) return null;
    return orgUnits?.find((u) => u._id === initialOrgUnit)?.name ?? null;
  }, [initialOrgUnit, orgUnits]);
  const clearOrgFilter = useCallback(() => {
    const q = activeTab === "prosesser" ? "?fane=prosesser" : "";
    router.replace(`/w/${workspaceId}/vurderinger${q}`, { scroll: false });
  }, [activeTab, router, workspaceId]);

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground">
            {activeTab === "vurderinger" ? "Vurderinger" : "Prosesser"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {activeTab === "prosesser"
              ? "Registeret for alt som skal vurderes, sikres og designes."
              : "Prioriter, følg status og åpne den neste vurderingen."}
          </p>
        </div>
        <div
          className="inline-flex w-full shrink-0 rounded-full border border-border/50 bg-background p-1 sm:w-auto"
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
              "flex h-10 min-h-[44px] flex-1 items-center justify-center rounded-full px-4 text-sm font-medium transition-colors sm:h-9 sm:min-h-0 sm:flex-initial",
              activeTab === "vurderinger"
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Vurderinger
          </button>
          <button
            id="tab-prosesser"
            type="button"
            role="tab"
            aria-selected={activeTab === "prosesser"}
            onClick={() => setTab("prosesser")}
            className={cn(
              "flex h-10 min-h-[44px] flex-1 items-center justify-center rounded-full px-4 text-sm font-medium transition-colors sm:h-9 sm:min-h-0 sm:flex-initial",
              activeTab === "prosesser"
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Prosesser
          </button>
        </div>
      </header>

      {initialOrgUnit ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">
            Filtrert på{" "}
            <span className="font-medium text-foreground">
              {activeOrgUnitName ?? "valgt enhet"}
            </span>
          </span>
          <button
            type="button"
            onClick={clearOrgFilter}
            className="font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Fjern filter
          </button>
        </div>
      ) : null}

      <div
        role="tabpanel"
        id={activeTab === "vurderinger" ? "panel-vurderinger" : "panel-prosesser"}
        aria-labelledby={
          activeTab === "vurderinger" ? "tab-vurderinger" : "tab-prosesser"
        }
        className="min-h-0"
      >
        {activeTab === "vurderinger" ? (
          <WorkspaceAssessmentsPanel
            workspaceId={workspaceId}
            hubMode
            approvedIntakeForProcessregister={approvedIntakeForProcessregister}
            initialOrgUnit={initialOrgUnit}
          />
        ) : (
          <WorkspaceCandidatesPanel
            workspaceId={workspaceId}
            hubMode
            approvedIntakeForProcessregister={approvedIntakeForProcessregister}
            initialOrgUnit={initialOrgUnit}
          />
        )}
      </div>
    </div>
  );
}
