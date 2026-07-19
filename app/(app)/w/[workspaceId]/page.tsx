"use client";

import {
  ProductLoadingBlock,
  ProductPageHeader,
  ProductStack,
} from "@/components/product";
import { WorkspaceOperationalDashboard } from "@/components/workspace/workspace-operational-dashboard";
import { WorkspaceRosLinkDialogHost } from "@/components/workspace/workspace-ros-link-dialog-host";
import { WorkspaceOverviewViewSettings } from "@/components/workspace/workspace-overview-view-settings";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
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

  return (
    <ProductStack className="pb-4">
      <Suspense fallback={null}>
        <WorkspaceRosLinkDialogHost workspaceId={workspaceId} />
      </Suspense>
      <ProductPageHeader
        className="sm:items-center"
        title={workspace.name}
        description={
          workspace.notes?.trim()
            ? workspace.notes
            : "Neste steg i arbeidsområdet."
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <WorkspaceOverviewViewSettings
              workspaceId={workspaceId}
              compactTrigger
            />
            <Link
              href={`/w/${workspaceId}/vurderinger`}
              className="text-muted-foreground hover:text-foreground inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-border/50 px-3.5 text-sm font-medium transition-colors"
            >
              Vurderinger
              <ArrowUpRight className="size-3.5" aria-hidden />
            </Link>
          </div>
        }
      />

      <WorkspaceOperationalDashboard
        workspaceId={workspaceId}
        sectionVisibility={sectionVisibility}
        homeListPrefs={homeListPrefs}
      />
    </ProductStack>
  );
}
