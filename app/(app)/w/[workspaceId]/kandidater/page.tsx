"use client";

import { WorkspaceCandidatesPanel } from "@/components/workspace/workspace-panels";
import type { Id } from "@/convex/_generated/dataModel";
import { useParams } from "next/navigation";

export default function WorkspaceCandidatesPage() {
  const params = useParams();
  const workspaceId = params.workspaceId as Id<"workspaces">;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Kandidater</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Oversikt over registrerte prosesser/kandidater i dette
          arbeidsområdet. Kodene brukes som referanse i vurderinger.
        </p>
      </div>
      <WorkspaceCandidatesPanel workspaceId={workspaceId} />
    </div>
  );
}
