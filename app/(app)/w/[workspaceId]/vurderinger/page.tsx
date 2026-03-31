"use client";

import { WorkspaceAssessmentsPanel } from "@/components/workspace/workspace-panels";
import type { Id } from "@/convex/_generated/dataModel";
import { useParams } from "next/navigation";

export default function WorkspaceAssessmentsPage() {
  const params = useParams();
  const workspaceId = params.workspaceId as Id<"workspaces">;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-10 pb-8">
      <header className="space-y-3 border-b border-border/60 pb-8">
        <h1 className="font-heading text-3xl font-semibold tracking-tight md:text-4xl">
          Vurderinger
        </h1>
        <p className="text-muted-foreground max-w-2xl text-base leading-relaxed">
          Samle fakta om prosessen, tall og risiko — få modellerte anbefalinger
          for automasjon og prioritering. Alt lagres fortløpende; du trenger ikke
          fullføre alt på én gang. Når dere er klare, flytter dere saken i{" "}
          <span className="text-foreground/90 font-medium">leveranse</span>.
        </p>
      </header>
      <WorkspaceAssessmentsPanel workspaceId={workspaceId} />
    </div>
  );
}
