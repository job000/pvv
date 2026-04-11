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

  if (workspace === undefined || membership === undefined) {
    return <ProductLoadingBlock label="Laster arbeidsområde ..." className="min-h-[30vh]" />;
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
        title={workspace.name}
        description={
          workspace.notes ? (
            <span className="text-muted-foreground text-sm leading-snug">
              {workspace.notes}
            </span>
          ) : null
        }
        actions={<WorkspaceOverviewViewSettings workspaceId={workspaceId} />}
      />

      <WorkspaceOperationalDashboard
        workspaceId={workspaceId}
        sectionVisibility={sectionVisibility}
      />
    </ProductStack>
  );
}
