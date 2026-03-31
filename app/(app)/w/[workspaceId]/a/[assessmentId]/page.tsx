"use client";

import { AssessmentWizard } from "@/components/assessment-wizard/assessment-wizard";
import type { Id } from "@/convex/_generated/dataModel";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function AssessmentPage() {
  const params = useParams();
  const workspaceId = params.workspaceId as Id<"workspaces">;
  const assessmentId = params.assessmentId as Id<"assessments">;

  return (
    <div className="space-y-4">
      <Link
        href={`/w/${workspaceId}/vurderinger`}
        className="text-muted-foreground text-sm hover:text-foreground"
      >
        ← Tilbake til vurderinger
      </Link>
      <AssessmentWizard assessmentId={assessmentId} />
    </div>
  );
}
