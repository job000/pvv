"use client";

import { WorkspaceTeamPanel } from "@/components/workspace/workspace-panels";
import type { Id } from "@/convex/_generated/dataModel";
import { useParams } from "next/navigation";

export default function WorkspaceSharingPage() {
  const params = useParams();
  const workspaceId = params.workspaceId as Id<"workspaces">;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-lg font-semibold tracking-tight sm:text-xl">
          Teammedlemmer
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Administrer hvem som har tilgang til dette arbeidsområdet.
        </p>
      </div>

      <WorkspaceTeamPanel workspaceId={workspaceId} />
    </div>
  );
}
