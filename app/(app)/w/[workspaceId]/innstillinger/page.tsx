"use client";

import { WorkspaceAdminGate } from "@/components/workspace/workspace-admin-gate";
import { WorkspaceSettingsPanel } from "@/components/workspace/workspace-panels";
import type { Id } from "@/convex/_generated/dataModel";
import { useParams } from "next/navigation";

export default function WorkspaceSettingsPage() {
  const params = useParams();
  const workspaceId = params.workspaceId as Id<"workspaces">;

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-12">
      <header className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Innstillinger
        </h1>
        <p className="text-sm text-muted-foreground">
          Navn, detaljer og integrasjoner for arbeidsområdet.
        </p>
      </header>
      <WorkspaceAdminGate
        workspaceId={workspaceId}
        title="Innstillinger styres av administratorer"
      >
        <WorkspaceSettingsPanel workspaceId={workspaceId} />
      </WorkspaceAdminGate>
    </div>
  );
}
