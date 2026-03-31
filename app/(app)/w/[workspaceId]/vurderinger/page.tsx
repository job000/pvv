"use client";

import type { PvvHubTab } from "@/components/workspace/workspace-pvv-hub";
import { WorkspacePvvHub } from "@/components/workspace/workspace-pvv-hub";
import type { Id } from "@/convex/_generated/dataModel";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function VurderingerHubBody() {
  const params = useParams();
  const searchParams = useSearchParams();
  const workspaceId = params.workspaceId as Id<"workspaces">;
  const activeTab: PvvHubTab =
    searchParams.get("fane") === "prosesser" ? "prosesser" : "vurderinger";

  return <WorkspacePvvHub workspaceId={workspaceId} activeTab={activeTab} />;
}

export default function WorkspaceAssessmentsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2">
          <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-muted-foreground text-sm">Laster …</p>
        </div>
      }
    >
      <VurderingerHubBody />
    </Suspense>
  );
}
