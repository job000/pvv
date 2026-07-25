"use client";

import { AssessmentWizard } from "@/components/assessment-wizard/assessment-wizard";
import type { Id } from "@/convex/_generated/dataModel";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense } from "react";

function AssessmentPageBody() {
  const params = useParams();
  const workspaceId = params.workspaceId as Id<"workspaces">;
  const assessmentId = params.assessmentId as Id<"assessments">;

  return (
    <div className="mx-auto max-w-5xl space-y-2 px-0 sm:space-y-4">
      <Link
        href={`/w/${workspaceId}/vurderinger`}
        className="text-muted-foreground hover:text-foreground inline-flex min-h-9 items-center gap-1.5 text-sm font-medium transition-colors"
      >
        ← <span className="sm:hidden">Tilbake</span>
        <span className="hidden sm:inline">Til vurderinger</span>
      </Link>
      <AssessmentWizard assessmentId={assessmentId} />
    </div>
  );
}

export default function AssessmentPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[30vh] items-center justify-center">
          <div className="border-primary size-8 animate-spin rounded-full border-2 border-t-transparent" />
        </div>
      }
    >
      <AssessmentPageBody />
    </Suspense>
  );
}
