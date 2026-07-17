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
            : "Fortsett der du slapp — vurderinger, ROS og prosesser."
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <WorkspaceOverviewViewSettings workspaceId={workspaceId} />
            <Link
              href={`/w/${workspaceId}/vurderinger`}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-foreground px-5 text-sm font-semibold text-background transition-opacity hover:opacity-90"
            >
              Til vurderinger
              <ArrowUpRight className="size-4" aria-hidden />
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
