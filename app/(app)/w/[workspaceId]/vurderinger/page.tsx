"use client";

import type { PvvHubTab } from "@/components/workspace/workspace-pvv-hub";
import type { Id } from "@/convex/_generated/dataModel";
import dynamic from "next/dynamic";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense } from "react";

const WorkspacePvvHub = dynamic(
  () =>
    import("@/components/workspace/workspace-pvv-hub").then((mod) => ({
      default: mod.WorkspacePvvHub,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[20vh] items-center justify-center">
        <div className="size-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    ),
  },
);

function VurderingerHubBody() {
  const params = useParams();
  const searchParams = useSearchParams();
  const workspaceId = params.workspaceId as Id<"workspaces">;
  const activeTab: PvvHubTab =
    searchParams.get("fane") === "prosesser" ? "prosesser" : "vurderinger";
  const orgUnit = searchParams.get("orgUnit") as Id<"orgUnits"> | null;

  return <WorkspacePvvHub workspaceId={workspaceId} activeTab={activeTab} initialOrgUnit={orgUnit} />;
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
