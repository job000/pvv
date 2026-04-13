"use client";

import { OrgChartPanel } from "@/components/workspace/org-chart-panel";
import type { Id } from "@/convex/_generated/dataModel";
import { useParams } from "next/navigation";

export default function WorkspaceOrganisasjonPage() {
  const params = useParams();
  const workspaceId = params.workspaceId as Id<"workspaces">;

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-lg font-semibold tracking-tight sm:text-xl">
        Organisasjonskart
      </h1>
      <OrgChartPanel workspaceId={workspaceId} />
    </div>
  );
}
