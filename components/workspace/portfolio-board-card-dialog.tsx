"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { AssessmentCommentThreads } from "@/components/workspace/assessment-comment-threads";
import { AssessmentTaskIssueTree } from "@/components/workspace/assessment-task-issue-tree";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  PIPELINE_KANBAN_ORDER,
  PIPELINE_STATUS_LABELS,
  type PipelineStatus,
} from "@/lib/assessment-pipeline";
import { toast } from "@/lib/app-toast";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import { ArrowUpRight, Zap } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

export type PortfolioBoardCardSummary = {
  assessmentId: Id<"assessments">;
  title: string;
  pipelineStatus: string;
  modelPriorityScore: number;
  effectivePriority: number;
  hasManualPriority: boolean;
  cachedAp?: number;
  cachedEase?: number;
  cachedEaseLabel?: string;
  cachedCriticality?: number;
  cachedDeliveryConfidence?: number;
  lowHangingFruit: boolean;
  rosStatus: string;
  pddStatus: string;
  openTaskCount: number;
  noteCount: number;
  openAssigneeNames: string[];
};

const STATUS_LABELS: Record<string, string> = {
  not_started: "Ikke startet",
  in_progress: "Pågår",
  done: "Ferdig",
  approved: "Godkjent",
  skipped: "Hoppet over",
};

function statusNb(raw: string) {
  return STATUS_LABELS[raw] ?? raw;
}

export function PortfolioBoardCardDialog({
  open,
  onOpenChange,
  workspaceId,
  card,
  onMovePhase,
  onSetPriority,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: Id<"workspaces">;
  card: PortfolioBoardCardSummary | null;
  onMovePhase: (
    assessmentId: Id<"assessments">,
    toStatus: PipelineStatus,
  ) => Promise<void>;
  onSetPriority: (
    assessmentId: Id<"assessments">,
    value: number | null,
  ) => Promise<void>;
}) {
  const assessmentId = card?.assessmentId;
  const notes = useQuery(
    api.assessmentNotes.listByAssessment,
    open && assessmentId ? { assessmentId } : "skip",
  );
  const tasks = useQuery(
    api.assessmentTasks.listByAssessment,
    open && assessmentId ? { assessmentId } : "skip",
  );

  const [priorityDraft, setPriorityDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"oversikt" | "oppgaver" | "kommentarer">(
    "oversikt",
  );

  const openIssueCount = useMemo(
    () => (tasks ?? []).filter((t) => t.status === "open" && !t.parentTaskId).length,
    [tasks],
  );

  const resetLocal = () => {
    setPriorityDraft("");
    setTab("oversikt");
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) resetLocal();
    onOpenChange(next);
  };

  if (!card) return null;

  const phase = card.pipelineStatus as PipelineStatus;

  const savePriority = async () => {
    const trimmed = priorityDraft.trim();
    if (trimmed === "") {
      await onSetPriority(card.assessmentId, null);
      return;
    }
    const n = Number(trimmed);
    if (Number.isNaN(n)) {
      toast.error("Ugyldig tall");
      return;
    }
    await onSetPriority(card.assessmentId, n);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        size="2xl"
        titleId="portfolio-card-title"
        className="max-sm:max-h-[min(92dvh,100%)]"
      >
        <DialogHeader className="space-y-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-1">
              <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                Kandidat
              </p>
              <h2
                id="portfolio-card-title"
                className="font-heading text-lg font-semibold leading-snug tracking-tight break-words sm:text-xl"
              >
                {card.title}
              </h2>
            </div>
            <Link
              href={`/w/${workspaceId}/a/${card.assessmentId}`}
              className="text-muted-foreground hover:text-foreground inline-flex min-h-10 shrink-0 items-center gap-1 text-xs font-medium underline-offset-2 touch-manipulation hover:underline"
            >
              Åpne full vurdering
              <ArrowUpRight className="size-3.5" aria-hidden />
            </Link>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {card.lowHangingFruit ? (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 dark:text-emerald-200">
                <Zap className="size-3" aria-hidden />
                Rask gevinst
              </span>
            ) : null}
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium">
              {PIPELINE_STATUS_LABELS[phase] ?? phase}
            </span>
            {card.hasManualPriority ? (
              <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-[11px] font-semibold text-sky-900 dark:text-sky-100">
                Manuell prio {Math.round(card.effectivePriority)}
              </span>
            ) : (
              <span className="text-muted-foreground rounded-full bg-muted px-2 py-0.5 text-[11px]">
                Modell {Math.round(card.modelPriorityScore)}
              </span>
            )}
          </div>
          <div
            role="tablist"
            className="grid grid-cols-3 gap-1 rounded-xl border border-border/50 bg-muted/20 p-1"
          >
            {(
              [
                ["oversikt", "Oversikt", "Info"],
                ["oppgaver", `Kort (${openIssueCount})`, `Kort (${openIssueCount})`],
                [
                  "kommentarer",
                  `Kommentarer (${notes?.length ?? card.noteCount})`,
                  `Chat (${notes?.length ?? card.noteCount})`,
                ],
              ] as const
            ).map(([id, label, shortLabel]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={cn(
                  "min-h-11 rounded-lg px-1.5 py-2 text-center text-[11px] font-medium leading-tight touch-manipulation transition-colors sm:min-h-9 sm:px-2 sm:text-sm",
                  tab === id
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span className="sm:hidden">{shortLabel}</span>
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
        </DialogHeader>

        <DialogBody className="space-y-5">
          {tab === "oversikt" ? (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Metric label="AP" value={`${Math.round(card.cachedAp ?? 0)}%`} />
                <Metric
                  label="Viktighet"
                  value={
                    card.cachedCriticality != null
                      ? String(Math.round(card.cachedCriticality))
                      : "—"
                  }
                />
                <Metric
                  label="Enkelhet"
                  value={card.cachedEaseLabel ?? (card.cachedEase != null ? String(Math.round(card.cachedEase)) : "—")}
                />
                <Metric
                  label="Leveranse"
                  value={
                    card.cachedDeliveryConfidence != null
                      ? String(Math.round(card.cachedDeliveryConfidence))
                      : "—"
                  }
                />
              </div>

              <p className="text-muted-foreground text-xs">
                ROS: {statusNb(card.rosStatus)} · Prosessdesign:{" "}
                {statusNb(card.pddStatus)}
                {card.openAssigneeNames.length > 0
                  ? ` · Tildelt: ${card.openAssigneeNames.join(", ")}`
                  : ""}
              </p>

              <div className="space-y-2">
                <Label htmlFor="portfolio-phase" className="text-sm">
                  Flytt til fase
                </Label>
                <select
                  id="portfolio-phase"
                  className="border-input bg-background h-10 w-full rounded-xl border px-3 text-sm"
                  value={phase}
                  disabled={busy}
                  onChange={(e) => {
                    const next = e.target.value as PipelineStatus;
                    if (next === phase) return;
                    void (async () => {
                      setBusy(true);
                      try {
                        await onMovePhase(card.assessmentId, next);
                        toast.success(
                          `Flyttet til ${PIPELINE_STATUS_LABELS[next]}`,
                        );
                      } catch (err) {
                        toast.error(
                          err instanceof Error
                            ? err.message
                            : "Kunne ikke flytte",
                        );
                      } finally {
                        setBusy(false);
                      }
                    })();
                  }}
                >
                  {PIPELINE_KANBAN_ORDER.map((s) => (
                    <option key={s} value={s}>
                      {PIPELINE_STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
                <p className="text-muted-foreground text-[11px]">
                  Samme som å dra kortet mellom kolonner — nyttig på mobil.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="portfolio-prio" className="text-sm">
                  Manuell porteføljeprioritet (0–100)
                </Label>
                <div className="flex flex-wrap gap-2">
                  <input
                    id="portfolio-prio"
                    type="number"
                    min={0}
                    max={100}
                    placeholder={String(Math.round(card.modelPriorityScore))}
                    value={priorityDraft}
                    onChange={(e) => setPriorityDraft(e.target.value)}
                    className="border-input bg-background h-10 w-28 rounded-xl border px-3 text-sm tabular-nums"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="rounded-xl"
                    disabled={busy}
                    onClick={() => void savePriority()}
                  >
                    Lagre prioritet
                  </Button>
                  {card.hasManualPriority ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => void onSetPriority(card.assessmentId, null)}
                    >
                      Bruk modell-score
                    </Button>
                  ) : null}
                </div>
              </div>
            </>
          ) : null}

          {tab === "oppgaver" ? (
            <div className="space-y-3">
              <AssessmentTaskIssueTree
                assessmentId={card.assessmentId}
                workspaceId={workspaceId}
                canEdit
              />
              <Link
                href={`/w/${workspaceId}/puls`}
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs font-medium underline-offset-2 hover:underline"
              >
                Åpne Puls
                <ArrowUpRight className="size-3" aria-hidden />
              </Link>
            </div>
          ) : null}

          {tab === "kommentarer" ? (
            <AssessmentCommentThreads
              workspaceId={workspaceId}
              assessmentId={card.assessmentId}
            />
          ) : null}
        </DialogBody>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            onClick={() => handleOpenChange(false)}
          >
            Lukk
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/40 bg-muted/15 px-3 py-2">
      <p className="text-muted-foreground text-[10px] font-medium uppercase tracking-wide">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}
