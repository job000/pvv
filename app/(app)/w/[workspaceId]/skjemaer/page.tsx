"use client";

import { IntakeWorkspacePage } from "@/components/intake-form/intake-workspace-page";
import type { Id } from "@/convex/_generated/dataModel";
import { useParams } from "next/navigation";

export default function WorkspaceIntakeFormsPage() {
  const params = useParams();
  const workspaceId = params.workspaceId as Id<"workspaces">;
  return <IntakeWorkspacePage workspaceId={workspaceId} />;
}
