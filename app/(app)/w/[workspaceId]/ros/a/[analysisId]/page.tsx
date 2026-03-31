"use client";

import { RosAnalysisEditor } from "@/components/ros/ros-analysis-editor";
import type { Id } from "@/convex/_generated/dataModel";
import { useParams } from "next/navigation";

export default function RosAnalysisPage() {
  const params = useParams();
  const workspaceId = params.workspaceId as Id<"workspaces">;
  const analysisId = params.analysisId as Id<"rosAnalyses">;

  return (
    <div className="mx-auto w-full max-w-6xl pb-12">
      <RosAnalysisEditor workspaceId={workspaceId} analysisId={analysisId} />
    </div>
  );
}
