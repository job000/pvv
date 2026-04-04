"use client";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMutation, useQuery } from "convex/react";
import { Info } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

export function AssessmentRosLinkDialog({
  open,
  onOpenChange,
  workspaceId,
  assessmentId,
  assessmentTitle,
  linkedRosAnalysisIds,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: Id<"workspaces">;
  assessmentId: Id<"assessments">;
  assessmentTitle: string;
  linkedRosAnalysisIds: Id<"rosAnalyses">[];
}) {
  const router = useRouter();
  const analyses = useQuery(api.ros.listAnalyses, { workspaceId });
  const templates = useQuery(api.ros.listTemplates, { workspaceId });
  const linkAssessment = useMutation(api.ros.linkAssessment);
  const createAnalysis = useMutation(api.ros.createAnalysis);

  const [selectedAnalysisId, setSelectedAnalysisId] = useState("");
  const [newTitle, setNewTitle] = useState(assessmentTitle);
  const [templateId, setTemplateId] = useState("");
  const [busy, setBusy] = useState(false);

  const linked = useMemo(
    () => new Set(linkedRosAnalysisIds.map((id) => String(id))),
    [linkedRosAnalysisIds],
  );

  const pickableAnalyses = useMemo(() => {
    if (!analyses) return [];
    return [...analyses]
      .filter((a) => !linked.has(String(a._id)))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [analyses, linked]);

  useEffect(() => {
    if (!open) return;
    setNewTitle(assessmentTitle);
    setSelectedAnalysisId("");
  }, [open, assessmentTitle]);

  useEffect(() => {
    if (!open) return;
    if (!templates?.length) {
      setTemplateId("");
      return;
    }
    setTemplateId((prev) => {
      if (prev && templates.some((t) => t._id === prev)) return prev;
      return String(templates[0]!._id);
    });
  }, [open, templates]);

  async function onLinkExisting() {
    if (!selectedAnalysisId) {
      toast.error("Velg en ROS-analyse.");
      return;
    }
    setBusy(true);
    try {
      await linkAssessment({
        analysisId: selectedAnalysisId as Id<"rosAnalyses">,
        assessmentId,
      });
      toast.success("ROS koblet til vurderingen.");
      onOpenChange(false);
      router.push(`/w/${workspaceId}/ros/a/${selectedAnalysisId}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kunne ikke koble.");
    } finally {
      setBusy(false);
    }
  }

  async function onCreateNew() {
    if (!templateId) {
      toast.error("Opprett minst én ROS-mal først.");
      return;
    }
    const title = newTitle.trim();
    if (!title) {
      toast.error("Tittel er påkrevd.");
      return;
    }
    setBusy(true);
    try {
      const id = await createAnalysis({
        workspaceId,
        templateId: templateId as Id<"rosTemplates">,
        title,
        assessmentIds: [assessmentId],
      });
      toast.success("ROS opprettet og koblet.");
      onOpenChange(false);
      router.push(`/w/${workspaceId}/ros/a/${id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kunne ikke opprette ROS.");
    } finally {
      setBusy(false);
    }
  }

  const wid = String(workspaceId);
  const templatesList = templates ?? [];
  const loading = analyses === undefined || templates === undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="lg"
        titleId="assessment-ros-link-title"
        descriptionId="assessment-ros-link-desc"
      >
        <DialogHeader>
          <p
            id="assessment-ros-link-title"
            className="font-heading text-lg font-semibold"
          >
            Koble ROS til vurderingen
          </p>
          <p
            id="assessment-ros-link-desc"
            className="text-muted-foreground text-sm leading-relaxed"
          >
            Velg en analyse som allerede finnes i arbeidsområdet, eller opprett
            en ny som kobles automatisk. Deretter åpnes ROS-arbeidsflaten.
          </p>
        </DialogHeader>
        <DialogBody className="space-y-6">
          {loading ? (
            <p className="text-muted-foreground text-sm">Laster …</p>
          ) : (
            <>
              <section className="space-y-3" aria-labelledby="ros-pick-existing">
                <h3
                  id="ros-pick-existing"
                  className="text-sm font-semibold text-foreground"
                >
                  Koble til eksisterende ROS
                </h3>
                {pickableAnalyses.length === 0 ? (
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    Ingen andre ROS-analyser å koble til ennå. Opprett en ny
                    nedenfor, eller opprett analyse fra{" "}
                    <Link
                      href={`/w/${wid}/ros`}
                      className="text-primary font-medium underline-offset-4 hover:underline"
                    >
                      ROS — arbeidsområde
                    </Link>
                    .
                  </p>
                ) : (
                  <>
                    <div className="space-y-1.5">
                      <Label htmlFor="ros-link-pick">ROS-analyse</Label>
                      <select
                        id="ros-link-pick"
                        className="border-input bg-background flex h-11 w-full rounded-xl border px-3 text-sm"
                        value={selectedAnalysisId}
                        onChange={(e) => setSelectedAnalysisId(e.target.value)}
                      >
                        <option value="">— Velg analyse —</option>
                        {pickableAnalyses.map((a) => (
                          <option key={a._id} value={a._id}>
                            {a.title}
                            {a.candidateCode
                              ? ` · ${a.candidateCode}`
                              : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                    <Button
                      type="button"
                      className="w-full sm:w-auto"
                      disabled={busy || !selectedAnalysisId}
                      onClick={() => void onLinkExisting()}
                    >
                      {busy ? "Kobler …" : "Koble og åpne ROS"}
                    </Button>
                  </>
                )}
              </section>

              <div
                className="border-border/60 border-t pt-2"
                role="presentation"
              />

              <section className="space-y-3" aria-labelledby="ros-create-new">
                <h3
                  id="ros-create-new"
                  className="text-sm font-semibold text-foreground"
                >
                  Opprett ny ROS
                </h3>
                {templatesList.length === 0 ? (
                  <Alert className="border-amber-500/35 bg-amber-500/[0.06]">
                    <Info className="text-amber-700 dark:text-amber-400" />
                    <AlertTitle>Ingen mal</AlertTitle>
                    <AlertDescription>
                      <Link
                        href={`/w/${wid}/ros`}
                        className="text-primary font-medium underline underline-offset-4"
                      >
                        Opprett en ROS-mal
                      </Link>{" "}
                      under ROS — arbeidsområde før du kan lage analyse her.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <>
                    <div className="space-y-1.5">
                      <Label htmlFor="ros-link-title">Tittel på analysen</Label>
                      <Input
                        id="ros-link-title"
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        placeholder="F.eks. ROS — prosessnavn"
                        className="h-11 rounded-xl"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="ros-link-tpl">Mal</Label>
                      <select
                        id="ros-link-tpl"
                        className="border-input bg-background flex h-11 w-full rounded-xl border px-3 text-sm"
                        value={templateId}
                        onChange={(e) => setTemplateId(e.target.value)}
                      >
                        {templatesList.map((t) => (
                          <option key={t._id} value={t._id}>
                            {t.name} ({t.rowLabels.length}×{t.colLabels.length})
                          </option>
                        ))}
                      </select>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      className="w-full sm:w-auto"
                      disabled={
                        busy ||
                        !templateId ||
                        !newTitle.trim() ||
                        templatesList.length === 0
                      }
                      onClick={() => void onCreateNew()}
                    >
                      {busy ? "Oppretter …" : "Opprett og åpne ROS"}
                    </Button>
                  </>
                )}
              </section>
            </>
          )}
        </DialogBody>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Lukk
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
