"use client";

import { OrgChartPanel } from "@/components/workspace/org-chart-panel";
import type { Id } from "@/convex/_generated/dataModel";
import { useParams } from "next/navigation";

export default function WorkspaceOrganisasjonPage() {
  const params = useParams();
  const workspaceId = params.workspaceId as Id<"workspaces">;

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-12">
      <header className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Organisasjon
        </h1>
        <p className="text-sm text-muted-foreground">
          Struktur for prosesser, vurderinger og ROS.
        </p>
      </header>
      <OrgChartPanel workspaceId={workspaceId} />
    </div>
  );
}
