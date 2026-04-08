"use client";

import { OrgChartPanel } from "@/components/workspace/org-chart-panel";
import type { Id } from "@/convex/_generated/dataModel";
import { useParams } from "next/navigation";

export default function WorkspaceOrganisasjonPage() {
  const params = useParams();
  const workspaceId = params.workspaceId as Id<"workspaces">;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-lg font-semibold tracking-tight sm:text-xl">
          Organisasjonskart
        </h1>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-relaxed">
          Bygg hierarkiet som styrer hvor prosesser knyttes — fra hovedenhet ned til team.
          Hver enhet viser et sammendrag av ROS (risiko og konsekvens) for prosesser
          under denne grenen og underenheter.
        </p>
      </div>
      <OrgChartPanel workspaceId={workspaceId} />
    </div>
  );
}
