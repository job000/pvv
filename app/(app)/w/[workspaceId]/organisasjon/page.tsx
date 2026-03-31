"use client";

import { OrgChartPanel } from "@/components/workspace/org-chart-panel";
import type { Id } from "@/convex/_generated/dataModel";
import { Building2 } from "lucide-react";
import { useParams } from "next/navigation";

export default function WorkspaceOrganisasjonPage() {
  const params = useParams();
  const workspaceId = params.workspaceId as Id<"workspaces">;

  return (
    <div className="space-y-10">
      <header className="max-w-3xl space-y-4">
        <div className="bg-muted/50 flex size-12 items-center justify-center rounded-2xl border border-border/60">
          <Building2 className="text-foreground size-6" aria-hidden />
        </div>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Organisasjon
        </h1>
        <p className="text-muted-foreground text-base leading-relaxed">
          Bygg et enkelt <strong className="text-foreground">kart over virksomheten</strong>{" "}
          — fra ett enkelt selskap til konsern med avdelinger og team. Det passer
          både små bedrifter, kommuner, helseforetak og industri: dere velger
          navn som speiler deres egen struktur. Kartet brukes til å knytte
          prosesser og vurderinger til riktig sted for spørsmål og ansvar.
        </p>
      </header>
      <OrgChartPanel workspaceId={workspaceId} />
    </div>
  );
}
