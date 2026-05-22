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
      <section className="rounded-2xl border border-border/50 bg-card p-3.5">
        <p className="text-sm font-medium text-foreground">Start her</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Samme funksjoner som før, men enklere inngang: velg rolle og gå rett
          til riktig arbeidsflate.
        </p>
        <div className="mt-2.5 flex flex-wrap gap-2 text-xs">
          <Link
            href={`/w/${workspaceId}/vurderinger`}
            className="rounded-full border border-border/50 px-2.5 py-1 text-muted-foreground hover:text-foreground"
          >
            Koordinator
          </Link>
          <Link
            href={`/w/${workspaceId}/vurderinger?fane=prosesser`}
            className="rounded-full border border-border/50 px-2.5 py-1 text-muted-foreground hover:text-foreground"
          >
            Prosessdesigner
          </Link>
          <Link
            href={`/w/${workspaceId}/ros`}
            className="rounded-full border border-border/50 px-2.5 py-1 text-muted-foreground hover:text-foreground"
          >
            Utvikler
          </Link>
        </div>
      </section>

      <WorkspaceOperationalDashboard
        workspaceId={workspaceId}
        sectionVisibility={sectionVisibility}
      />
    </ProductStack>
  );
}
