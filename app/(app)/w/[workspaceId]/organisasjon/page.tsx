"use client";

import { OrgChartPanel } from "@/components/workspace/org-chart-panel";
import type { Id } from "@/convex/_generated/dataModel";
import { useParams } from "next/navigation";

export default function WorkspaceOrganisasjonPage() {
  const params = useParams();
  const workspaceId = params.workspaceId as Id<"workspaces">;

  return (
    <div className="space-y-4 pb-4">
      <header className="border-border/60 border-b pb-3">
        <h1 className="font-heading text-lg font-semibold tracking-tight text-foreground sm:text-xl">
          Organisasjon
        </h1>
      </header>
      <OrgChartPanel workspaceId={workspaceId} />
    </div>
  );
}
