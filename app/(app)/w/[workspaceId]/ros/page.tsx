"use client";

import { RosWorkspace } from "@/components/ros/ros-workspace";
import type { Id } from "@/convex/_generated/dataModel";
import { useParams } from "next/navigation";
import { Suspense } from "react";

function RosPageBody() {
  const params = useParams();
  const workspaceId = params.workspaceId as Id<"workspaces">;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 pb-16">
      <header className="border-border/60 border-b pb-3">
        <h1 className="font-heading text-lg font-semibold tracking-tight text-foreground sm:text-xl">
          Risiko og sårbarhet
        </h1>
      </header>
      <RosWorkspace workspaceId={workspaceId} />
    </div>
  );
}

export default function RosPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2">
          <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-muted-foreground text-sm">Laster …</p>
        </div>
      }
    >
      <RosPageBody />
    </Suspense>
  );
}
