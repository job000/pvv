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
    <div className="mx-auto max-w-5xl space-y-4 px-0">
      <Link
        href={`/w/${workspaceId}/vurderinger`}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm font-medium transition-colors"
      >
        ← Til vurderinger
      </Link>
      <AssessmentWizard assessmentId={assessmentId} />
    </div>
  );
}
