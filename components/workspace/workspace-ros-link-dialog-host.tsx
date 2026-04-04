"use client";

import { AssessmentRosLinkDialog } from "@/components/assessment-wizard/assessment-ros-link-dialog";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef } from "react";

/**
 * Åpner «Koble ROS»-dialog på arbeidsområde-oversikten (`/w/[workspaceId]`)
 * når URL har `?kobleRos=1&assessmentId=…`. Navigerer ikke til vurderingssiden først.
 *
 * Brukes bare når primærkortet er ROS-saken (`navigationTarget: "ros_dialog"` i
 * `WorkspaceOperationalDashboard`). Oppfølging / «sist arbeid» / «til vurderinger»
 * går direkte til vurdering eller liste — ikke hit.
 */
export function WorkspaceRosLinkDialogHost({
  workspaceId,
}: {
  workspaceId: Id<"workspaces">;
}) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const assessmentIdRaw = searchParams.get("assessmentId");
  const kobleRos = searchParams.get("kobleRos");

  const assessmentId = useMemo((): Id<"assessments"> | null => {
    if (!assessmentIdRaw || assessmentIdRaw.length < 8) return null;
    return assessmentIdRaw as Id<"assessments">;
  }, [assessmentIdRaw]);

  const shouldOpen = kobleRos === "1" && assessmentId !== null;

  const draft = useQuery(
    api.assessments.getDraft,
    shouldOpen && assessmentId ? { assessmentId } : "skip",
  );
  const rosContext = useQuery(
    api.ros.getRosContextForAssessment,
    shouldOpen && assessmentId ? { assessmentId } : "skip",
  );

  const stripDoneRef = useRef(false);

  useEffect(() => {
    stripDoneRef.current = false;
  }, [assessmentIdRaw, kobleRos]);

  const clearParams = useCallback(() => {
    if (stripDoneRef.current) return;
    stripDoneRef.current = true;
    const sp = new URLSearchParams(searchParams.toString());
    sp.delete("kobleRos");
    sp.delete("assessmentId");
    const q = sp.toString();
    router.replace(q ? `${pathname}?${q}` : pathname);
  }, [pathname, router, searchParams]);

  useEffect(() => {
    if (!shouldOpen || rosContext === undefined) return;
    if (rosContext.length > 0) {
      clearParams();
    }
  }, [shouldOpen, rosContext, clearParams]);

  useEffect(() => {
    if (!shouldOpen || draft === undefined) return;
    if (draft === null) {
      clearParams();
      return;
    }
    if (draft.assessment.workspaceId !== workspaceId) {
      clearParams();
    }
  }, [shouldOpen, draft, workspaceId, clearParams]);

  const onOpenChange = useCallback(
    (open: boolean) => {
      if (!open) clearParams();
    },
    [clearParams],
  );

  if (!shouldOpen || !assessmentId) return null;

  if (draft === undefined || rosContext === undefined) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-[1px]"
        role="status"
        aria-live="polite"
      >
        <div className="bg-card text-foreground flex items-center gap-3 rounded-2xl border border-border/60 px-5 py-4 text-sm shadow-lg">
          <div className="border-primary size-8 animate-spin rounded-full border-2 border-t-transparent" />
          Laster vurdering …
        </div>
      </div>
    );
  }

  if (draft === null || rosContext.length > 0) return null;
  if (draft.assessment.workspaceId !== workspaceId) return null;

  return (
    <AssessmentRosLinkDialog
      open
      onOpenChange={onOpenChange}
      workspaceId={workspaceId}
      assessmentId={assessmentId}
      assessmentTitle={draft.assessment.title}
      linkedRosAnalysisIds={rosContext.map((x) => x.rosAnalysisId)}
    />
  );
}
