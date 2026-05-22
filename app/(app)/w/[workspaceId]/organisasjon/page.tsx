"use client";

import { OrgChartPanel } from "@/components/workspace/org-chart-panel";
import type { Id } from "@/convex/_generated/dataModel";
import { useParams } from "next/navigation";

export default function WorkspaceOrganisasjonPage() {
  const params = useParams();
  const workspaceId = params.workspaceId as Id<"workspaces">;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border/40 bg-card p-4 shadow-sm sm:p-5">
        <h1 className="font-heading text-lg font-semibold tracking-tight sm:text-xl">
          Organisasjon
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Bygg struktur én gang, og hopp direkte til Prosesser, Vurderinger og
          ROS per enhet.
        </p>
      </div>
      <OrgChartPanel workspaceId={workspaceId} />
    </div>
  );
}
