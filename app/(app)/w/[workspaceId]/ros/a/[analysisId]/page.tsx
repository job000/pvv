"use client";

import { RosAnalysisEditor } from "@/components/ros/ros-analysis-editor";
import type { Id } from "@/convex/_generated/dataModel";
import { useParams } from "next/navigation";
import { Suspense } from "react";

export default function RosAnalysisPage() {
  const params = useParams();
  const workspaceId = params.workspaceId as Id<"workspaces">;
  const analysisId = params.analysisId as Id<"rosAnalyses">;

  return (
    <div className="mx-auto w-full max-w-6xl pb-12">
      <Suspense fallback={<p className="text-sm text-muted-foreground">Laster ROS …</p>}>
        <RosAnalysisEditor workspaceId={workspaceId} analysisId={analysisId} />
      </Suspense>
    </div>
  );
}
