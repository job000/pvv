"use client";

import { RosWorkspace } from "@/components/ros/ros-workspace";
import type { Id } from "@/convex/_generated/dataModel";
import { useParams } from "next/navigation";
import { Suspense } from "react";

function RosPageBody() {
  const params = useParams();
  const workspaceId = params.workspaceId as Id<"workspaces">;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 pb-16">
      <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        ROS
      </h1>
      <RosWorkspace workspaceId={workspaceId} />
    </div>
  );
}

export default function RosPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2">
          <div className="size-8 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
          <p className="text-sm text-muted-foreground">Laster …</p>
        </div>
      }
    >
      <RosPageBody />
    </Suspense>
  );
}
