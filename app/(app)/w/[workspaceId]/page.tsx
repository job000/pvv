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
        title={workspace.name}
        description={
          workspace.notes?.trim()
            ? workspace.notes
            : "Hva som er viktigst å ta tak i nå."
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <WorkspaceOverviewViewSettings workspaceId={workspaceId} />
            <Link
              href={`/w/${workspaceId}/vurderinger`}
              className="text-muted-foreground hover:text-foreground inline-flex h-11 items-center justify-center gap-1.5 rounded-full border border-border/50 px-4 text-sm font-medium transition-colors"
            >
              Alle vurderinger
              <ArrowUpRight className="size-3.5" aria-hidden />
            </Link>
          </div>
        }
      />

      <WorkspaceOperationalDashboard
        workspaceId={workspaceId}
        sectionVisibility={sectionVisibility}
      />
    </ProductStack>
  );
}
