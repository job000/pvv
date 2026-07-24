"use client";

import { AssessmentVersionsBlock } from "@/components/assessment-wizard/assessment-versions-block";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
} from "@/components/ui/dialog";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { AssessmentPayload } from "@/lib/assessment-types";
import { useQuery } from "convex/react";
import { History, X } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assessmentId: Id<"assessments">;
  assessmentTitle: string;
  canEdit: boolean;
  previewRequestVersion?: number | null;
  onPreviewRequestConsumed?: () => void;
  onDraftRestored?: (
    payload: AssessmentPayload,
    meta?: { revision: number },
  ) => void;
};

export function AssessmentVersionsQuickDialog({
  open,
  onOpenChange,
  assessmentId,
  assessmentTitle,
  canEdit,
  previewRequestVersion,
  onPreviewRequestConsumed,
  onDraftRestored,
}: Props) {
  const versions = useQuery(
    api.assessments.listVersions,
    open ? { assessmentId } : "skip",
  );

  const titleId = "assessment-quick-versions-title";
  const descId = "assessment-quick-versions-desc";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="2xl"
        titleId={titleId}
        descriptionId={descId}
        className="max-h-[min(94dvh,52rem)]"
      >
        <DialogHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p
                id={titleId}
                className="text-foreground flex items-center gap-2 text-base font-semibold tracking-tight"
              >
                <History className="text-primary size-5 shrink-0" aria-hidden />
                <span className="truncate">Versjoner</span>
              </p>
              <p id={descId} className="text-muted-foreground mt-1 text-sm">
                <span className="text-foreground font-medium">
                  {assessmentTitle || "Vurdering"}
                </span>
                {" · "}
                Se, gjenopprett eller lagre milepæler.
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-9 shrink-0"
              aria-label="Lukk"
              onClick={() => onOpenChange(false)}
            >
              <X className="size-4" />
            </Button>
          </div>
        </DialogHeader>
        <DialogBody className="min-h-0 space-y-3 overflow-y-auto overscroll-contain pb-2">
          <AssessmentVersionsBlock
            assessmentId={assessmentId}
            versions={versions}
            canEdit={canEdit}
            embedded
            previewRequestVersion={previewRequestVersion}
            onPreviewRequestConsumed={onPreviewRequestConsumed}
            onDraftRestored={onDraftRestored}
          />
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
