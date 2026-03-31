"use client";

import { OrgChartPanel } from "@/components/workspace/org-chart-panel";
import type { Id } from "@/convex/_generated/dataModel";
import { useParams } from "next/navigation";

export default function WorkspaceOrganisasjonPage() {
  const params = useParams();
  const workspaceId = params.workspaceId as Id<"workspaces">;

  return (
    <div className="space-y-10">
      <header className="max-w-3xl space-y-3">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Organisasjon
        </h1>
        <p className="text-muted-foreground text-base leading-relaxed">
          Bygg organisasjonskart med helseforetak, avdelinger og seksjoner — slik
          at vurderinger og kandidater kan knyttes til riktig sted. Under hver
          enhet kan du registrere flere merkantile kontakter (typisk flere
          personer i store HF og avdelinger).
        </p>
      </header>
      <OrgChartPanel workspaceId={workspaceId} />
    </div>
  );
}
