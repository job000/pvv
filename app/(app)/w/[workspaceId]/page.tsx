"use client";

import {
  ProductLoadingBlock,
  ProductStack,
} from "@/components/product";
import { WorkspaceOperationalDashboard } from "@/components/workspace/workspace-operational-dashboard";
import { WorkspaceRosLinkDialogHost } from "@/components/workspace/workspace-ros-link-dialog-host";
import { WorkspaceOverviewViewSettings } from "@/components/workspace/workspace-overview-view-settings";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { useParams } from "next/navigation";
import { Suspense, useMemo } from "react";

export default function WorkspaceOverviewPage() {
  const params = useParams();
  const workspaceId = params.workspaceId as Id<"workspaces">;
  const workspace = useQuery(api.workspaces.get, { workspaceId });
  const membership = useQuery(api.workspaces.getMyMembership, { workspaceId });
  const viewPrefs = useQuery(api.workspaceViewPrefs.getMyWorkspaceViewPrefs, {
    workspaceId,
  });

  const sectionVisibility = useMemo(() => {
    if (!viewPrefs) {
      return undefined;
    }
    return {
      showMetrics: viewPrefs.showMetrics,
      showPrioritySection: viewPrefs.showPrioritySection,
      showRecentSection: viewPrefs.showRecentSection,
    };
  }, [viewPrefs]);

  const homeListPrefs = useMemo(() => {
    if (!viewPrefs) {
      return undefined;
    }
    return {
      viewMode:
        viewPrefs.homeListViewMode === "list" ||
        viewPrefs.homeListViewMode === "table"
          ? viewPrefs.homeListViewMode
          : ("cards" as const),
      pageSize:
        viewPrefs.homeListPageSize === 10 || viewPrefs.homeListPageSize === 20
          ? viewPrefs.homeListPageSize
          : (6 as const),
      queueScope:
        viewPrefs.homeQueueScope === "all"
          ? ("all" as const)
          : ("mine" as const),
    };
  }, [viewPrefs]);

  if (workspace === undefined || membership === undefined) {
    return (
      <ProductLoadingBlock
        label="Laster arbeidsområde …"
        className="min-h-[30vh]"
      />
    );
  }

  if (workspace === null) {
    return (
      <p className="text-destructive text-sm">Fant ikke arbeidsområdet.</p>
    );
  }

  const placeNote = workspace.notes?.trim();

  return (
    <ProductStack className="relative px-1 pb-10 sm:px-2 lg:px-3">
      <div
        className="pointer-events-none absolute inset-x-0 -top-2 h-44 rounded-[2rem] bg-gradient-to-b from-muted/50 via-muted/20 to-transparent sm:h-52"
        aria-hidden
      />
      <Suspense fallback={null}>
        <WorkspaceRosLinkDialogHost workspaceId={workspaceId} />
      </Suspense>

      <header className="relative flex items-start justify-between gap-4 pt-2 sm:pt-3">
        <div className="min-w-0 space-y-1.5">
          <p className="text-muted-foreground text-[11px] font-semibold tracking-[0.14em] uppercase">
            Oversikt
          </p>
          <h1 className="font-heading text-[1.75rem] font-semibold tracking-[-0.04em] text-foreground sm:text-[2.1rem]">
            {workspace.name}
          </h1>
          <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
            {placeNote?.trim()
              ? placeNote
              : "Status, neste steg og snarveier — fortsett der det haster mest."}
          </p>
        </div>
        <WorkspaceOverviewViewSettings
          workspaceId={workspaceId}
          compactTrigger
        />
      </header>

      <WorkspaceOperationalDashboard
        workspaceId={workspaceId}
        sectionVisibility={sectionVisibility}
        homeListPrefs={homeListPrefs}
      />
    </ProductStack>
  );
}
