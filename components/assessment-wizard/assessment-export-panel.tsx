"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  COMPLIANCE_STATUS_LABELS,
  type ComplianceStatusKey,
} from "@/lib/helsesector-labels";
import { downloadAssessmentPdf } from "@/lib/assessment-pdf";
import type { AssessmentPayload } from "@/lib/assessment-types";
import {
  PIPELINE_STATUS_LABELS,
  normalizePipelineStatus,
} from "@/lib/assessment-pipeline";
import { useMutation, useQuery } from "convex/react";
import { Copy, FileDown, Link2, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

export function AssessmentExportPanel({
  assessmentId,
  workspaceId,
  canEdit,
}: {
  assessmentId: Id<"assessments">;
  workspaceId: Id<"workspaces">;
  canEdit: boolean;
}) {
  const data = useQuery(api.assessments.getDraft, { assessmentId });
  const workspace = useQuery(api.workspaces.get, { workspaceId });
  const links = useQuery(api.assessmentShareLinks.listByAssessment, {
    assessmentId,
  });
  const createLink = useMutation(api.assessmentShareLinks.create);
  const revokeLink = useMutation(api.assessmentShareLinks.revoke);

  const [hours, setHours] = useState(72);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const pdfReady = data?.computed && data.assessment;

  const complianceLabels = useMemo(() => {
    if (!data?.assessment) return null;
    const a = data.assessment;
    const ros = (a.rosStatus ?? "not_started") as ComplianceStatusKey;
    const pdd = (a.pddStatus ?? "not_started") as ComplianceStatusKey;
    return {
      ros: COMPLIANCE_STATUS_LABELS[ros],
      pdd: COMPLIANCE_STATUS_LABELS[pdd],
    };
  }, [data?.assessment]);

  function handlePdf() {
    if (!data?.computed || !data.assessment || !complianceLabels) return;
    const pl = PIPELINE_STATUS_LABELS[
      normalizePipelineStatus(data.assessment.pipelineStatus)
    ];
    const p = data.draft.payload as AssessmentPayload;
    downloadAssessmentPdf({
      title: data.assessment.title,
      workspaceName: workspace?.name ?? null,
      processName: p.processName ?? "",
      candidateId: p.candidateId ?? "",
      processDescription: p.processDescription,
      processGoal: p.processGoal,
      processActors: p.processActors,
      processSystems: p.processSystems,
      processFlowSummary: p.processFlowSummary,
      processVolumeNotes: p.processVolumeNotes,
      processConstraints: p.processConstraints,
      processFollowUp: p.processFollowUp,
      hfOperationsSupportLevel: p.hfOperationsSupportLevel,
      hfSecurityInformationNotes: p.hfSecurityInformationNotes,
      hfOrganizationalBreadthNotes: p.hfOrganizationalBreadthNotes,
      hfEconomicRationaleNotes: p.hfEconomicRationaleNotes,
      hfCriticalManualGapNotes: p.hfCriticalManualGapNotes,
      hfOperationsSupportNotes: p.hfOperationsSupportNotes,
      pipelineLabel: pl,
      rosLabel: complianceLabels.ros,
      pddLabel: complianceLabels.pdd,
      computed: {
        ap: data.computed.ap,
        criticality: data.computed.criticality,
        priorityScore: data.computed.priorityScore,
        feasible: data.computed.feasible,
        ease: data.computed.ease,
        easeLabel: data.computed.easeLabel,
        benH: data.computed.benH,
        benC: data.computed.benC,
      },
      generatedAt: new Date(),
    });
  }

  async function handleCreateLink() {
    if (!canEdit) return;
    setBusy(true);
    try {
      await createLink({ assessmentId, expiresInHours: hours });
    } finally {
      setBusy(false);
    }
  }

  function shareUrl(token: string) {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/s/${token}`;
  }

  async function copyUrl(token: string) {
    const url = shareUrl(token);
    await navigator.clipboard.writeText(url);
    setCopied(token);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="space-y-4 rounded-2xl border bg-muted/15 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-heading text-sm font-semibold">Eksport og deling</h2>
          <p className="text-muted-foreground text-xs">
            PDF for arkiv og møter. Lenke gir kun lesetilgang til sammendrag og
            slutter å virke når den utløper.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="gap-1.5 shrink-0"
          disabled={!pdfReady}
          onClick={() => handlePdf()}
        >
          <FileDown className="size-4" aria-hidden />
          Last ned PDF
        </Button>
      </div>

      {canEdit ? (
        <div className="border-t pt-4 space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="share-hours" className="text-xs">
                Gyldig i (timer)
              </Label>
              <Input
                id="share-hours"
                type="number"
                min={1}
                max={720}
                className="h-9 w-28"
                value={hours}
                onChange={(e) => setHours(Number(e.target.value) || 24)}
              />
            </div>
            <p className="text-muted-foreground max-w-sm pb-1 text-xs">
              Maks. 720 t (30 d). Kun sammendrag — ikke redigering.
            </p>
            <Button
              type="button"
              size="sm"
              className="gap-1.5"
              disabled={busy}
              onClick={() => void handleCreateLink()}
            >
              <Link2 className="size-4" aria-hidden />
              {busy ? "Oppretter …" : "Opprett ny lenke"}
            </Button>
          </div>

          {(links ?? []).length === 0 ? (
            <p className="text-muted-foreground text-xs">Ingen aktive lenker.</p>
          ) : (
            <ul className="space-y-2">
              {(links ?? []).map((L) => (
                <li
                  key={L._id}
                  className="bg-card flex flex-col gap-2 rounded-lg border px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="text-muted-foreground text-xs">
                      {L.active ? (
                        <>
                          Utløper{" "}
                          {new Date(L.expiresAt).toLocaleString("nb-NO", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </>
                      ) : (
                        <span>Utløpt</span>
                      )}
                    </p>
                    {L.active ? (
                      <code className="text-foreground mt-0.5 block truncate text-xs">
                        {shareUrl(L.token)}
                      </code>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {L.active ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1"
                        onClick={() => void copyUrl(L.token)}
                      >
                        <Copy className="size-3.5" aria-hidden />
                        {copied === L.token ? "Kopiert" : "Kopier"}
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive gap-1"
                      onClick={() => void revokeLink({ linkId: L._id })}
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                      Slett
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <p className="text-muted-foreground border-t pt-3 text-xs">
          Kun redaktører kan opprette tidsbegrensede lenker.
        </p>
      )}
    </div>
  );
}
