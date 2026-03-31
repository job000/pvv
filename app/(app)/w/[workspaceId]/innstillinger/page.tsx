"use client";

import { WorkspaceSettingsPanel } from "@/components/workspace/workspace-panels";
import type { Id } from "@/convex/_generated/dataModel";
import { useParams } from "next/navigation";

export default function WorkspaceSettingsPage() {
  const params = useParams();
  const workspaceId = params.workspaceId as Id<"workspaces">;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Innstillinger</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Navn, virksomhetsdata og notater for arbeidsområdet (synlig for alle med
          tilgang).
        </p>
      </div>
      <WorkspaceSettingsPanel workspaceId={workspaceId} />
    </div>
  );
}
