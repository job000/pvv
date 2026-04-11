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
      rpaExpectedBenefitVsEffort: p.rpaExpectedBenefitVsEffort,
      rpaQuickWinPotential: p.rpaQuickWinPotential,
      rpaProcessSpecificity: p.rpaProcessSpecificity,
      rpaBarrierSelfAssessment: p.rpaBarrierSelfAssessment,
      rpaBarrierNotes: p.rpaBarrierNotes,
      rpaSimilarAutomationExists: p.rpaSimilarAutomationExists,
      rpaImplementationDifficulty: p.rpaImplementationDifficulty,
      rpaLifecycleContact: p.rpaLifecycleContact,
      rpaManualFallbackWhenRobotFails: p.rpaManualFallbackWhenRobotFails,
      implementationBuildCost: p.implementationBuildCost,
      annualRunCost: p.annualRunCost,
      rpaBenefitKindsAndOperationsNotes: p.rpaBenefitKindsAndOperationsNotes,
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
        deliveryConfidence: data.computed.deliveryConfidence,
        economicCaseScore: data.computed.economicCaseScore,
        readinessScore: data.computed.readinessScore,
        benH: data.computed.benH,
        benC: data.computed.benC,
        benFte: data.computed.benFte,
        annualRunCost: data.computed.annualRunCost,
        buildCost: data.computed.buildCost,
        netBenefitAnnual: data.computed.netBenefitAnnual,
        paybackMonths: data.computed.paybackMonths,
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
    <div className="rounded-xl border bg-muted/15 p-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        <h2 className="font-heading text-sm font-semibold">Eksport og deling</h2>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="h-8 gap-1.5 shrink-0 px-2.5 text-xs"
          disabled={!pdfReady}
          onClick={() => handlePdf()}
        >
          <FileDown className="size-3.5" aria-hidden />
          Last ned PDF
        </Button>
      </div>
      <p className="text-muted-foreground mt-1 text-[11px] leading-snug">
        PDF til arkiv/møter. Delingslenker: kun sammendrag (les), utløper
        automatisk.
      </p>

      {canEdit ? (
        <div className="mt-2 border-t border-border/50 pt-2">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <div className="flex items-center gap-1.5">
              <Label
                htmlFor="share-hours"
                className="text-muted-foreground whitespace-nowrap text-xs"
              >
                Timer
              </Label>
              <Input
                id="share-hours"
                type="number"
                min={1}
                max={720}
                className="h-8 w-[4.25rem] px-2 text-xs"
                value={hours}
                onChange={(e) => setHours(Number(e.target.value) || 24)}
                aria-describedby="share-hours-hint"
              />
            </div>
            <Button
              type="button"
              size="sm"
              className="h-8 gap-1 px-2.5 text-xs"
              disabled={busy}
              onClick={() => void handleCreateLink()}
            >
              <Link2 className="size-3.5" aria-hidden />
              {busy ? "Oppretter …" : "Ny lenke"}
            </Button>
            <span
              id="share-hours-hint"
              className="text-muted-foreground text-[11px] leading-tight sm:max-w-[14rem]"
            >
              Maks 720 t. Ikke redigering.
            </span>
          </div>

          {(links ?? []).length === 0 ? (
            <p className="text-muted-foreground mt-1.5 text-[11px]">
              Ingen aktive lenker.
            </p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {(links ?? []).map((L) => (
                <li
                  key={L._id}
                  className="bg-card flex flex-col gap-1.5 rounded-md border px-2.5 py-1.5 text-sm sm:flex-row sm:items-center sm:justify-between"
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
        <p className="text-muted-foreground mt-2 border-t border-border/50 pt-2 text-[11px] leading-snug">
          Kun redaktører kan opprette tidsbegrensede lenker.
        </p>
      )}
    </div>
  );
}
