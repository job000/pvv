"use client";

import { OrgChartPanel } from "@/components/workspace/org-chart-panel";
import type { Id } from "@/convex/_generated/dataModel";
import { useParams } from "next/navigation";

export default function WorkspaceOrganisasjonPage() {
  const params = useParams();
  const workspaceId = params.workspaceId as Id<"workspaces">;

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-12 sm:max-w-4xl sm:space-y-8">
      <header className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Organisasjon
        </h1>
        <p className="text-muted-foreground max-w-xl text-sm leading-relaxed">
          Jobb ut fra enhet: se hva som mangler vurdering eller ROS, og ta neste
          steg. Strukturen ligger under når du trenger den.
        </p>
      </header>
      <OrgChartPanel workspaceId={workspaceId} />
    </div>
  );
}
