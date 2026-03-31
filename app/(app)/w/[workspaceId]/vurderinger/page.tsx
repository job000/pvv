"use client";

import { WorkspaceAssessmentsPanel } from "@/components/workspace/workspace-panels";
import type { Id } from "@/convex/_generated/dataModel";
import { useParams } from "next/navigation";

export default function WorkspaceAssessmentsPage() {
  const params = useParams();
  const workspaceId = params.workspaceId as Id<"workspaces">;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Vurderinger</h1>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-relaxed">
          Samle fakta om en prosess, få en foreslått prioritet og følg den videre
          i leveranse. Alt lagres fortløpende; du trenger ikke fullføre alt på én
          gang.
        </p>
      </div>
      <WorkspaceAssessmentsPanel workspaceId={workspaceId} />
    </div>
  );
}
