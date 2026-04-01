"use client";

import { OrgChartPanel } from "@/components/workspace/org-chart-panel";
import type { Id } from "@/convex/_generated/dataModel";
import { useParams } from "next/navigation";

export default function WorkspaceOrganisasjonPage() {
  const params = useParams();
  const workspaceId = params.workspaceId as Id<"workspaces">;

  return (
    <div className="relative pb-8">
      <div
        className="pointer-events-none absolute inset-x-0 -top-2 -z-10 h-48 overflow-hidden"
        aria-hidden
      >
        <div className="absolute -left-[10%] top-0 h-[70%] w-[55%] rounded-full bg-primary/[0.06] blur-3xl" />
        <div className="absolute -right-[5%] top-[20%] h-[50%] w-[45%] rounded-full bg-sky-500/[0.05] blur-3xl" />
      </div>
      <header className="border-border/50 space-y-1.5 border-b pb-6">
        <h1 className="font-heading text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          Organisasjon
        </h1>
        <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed sm:text-[15px]">
          Bygg hierarkiet som styrer hvor prosesser og vurderinger kan knyttes — fra
          hovedenhet ned til team.
        </p>
      </header>
      <div className="mt-8">
        <OrgChartPanel workspaceId={workspaceId} />
      </div>
    </div>
  );
}
