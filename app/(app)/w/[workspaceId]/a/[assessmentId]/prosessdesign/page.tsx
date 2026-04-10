"use client";

import { ProcessDesignDocPage } from "@/components/process-design/process-design-doc-page";
import type { Id } from "@/convex/_generated/dataModel";
import { useParams } from "next/navigation";

export default function ProcessDesignRoutePage() {
  const params = useParams();
  const workspaceId = params.workspaceId as Id<"workspaces">;
  const assessmentId = params.assessmentId as Id<"assessments">;

  return (
    <ProcessDesignDocPage workspaceId={workspaceId} assessmentId={assessmentId} />
  );
}
