"use client";

import { WorkspaceSettingsPanel } from "@/components/workspace/workspace-panels";
import type { Id } from "@/convex/_generated/dataModel";
import { useParams } from "next/navigation";

export default function WorkspaceSettingsPage() {
  const params = useParams();
  const workspaceId = params.workspaceId as Id<"workspaces">;

  return (
    <div className="space-y-4">
      <header className="border-border/60 border-b pb-3">
        <h1 className="font-heading text-lg font-semibold tracking-tight text-foreground sm:text-xl">
          Innstillinger
        </h1>
      </header>
      <WorkspaceSettingsPanel workspaceId={workspaceId} />
    </div>
  );
}
