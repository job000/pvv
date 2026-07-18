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
import { Textarea } from "@/components/ui/textarea";
import { AssessmentCommentThreads } from "@/components/workspace/assessment-comment-threads";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  PIPELINE_KANBAN_ORDER,
  PIPELINE_STATUS_LABELS,
  type PipelineStatus,
} from "@/lib/assessment-pipeline";
import { toast } from "@/lib/app-toast";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowUpRight,
  CheckCircle2,
  ClipboardList,
  Send,
  UserPlus,
  Zap,
} from "lucide-react";
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
  const members = useQuery(
    api.workspaces.listMembers,
    open ? { workspaceId } : "skip",
  );
  const notes = useQuery(
    api.assessmentNotes.listByAssessment,
    open && assessmentId ? { assessmentId } : "skip",
  );
  const tasks = useQuery(
    api.assessmentTasks.listByAssessment,
    open && assessmentId ? { assessmentId } : "skip",
  );
  const createTask = useMutation(api.assessmentTasks.create);

  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<Id<"users">[]>([]);
  const [priorityDraft, setPriorityDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"oversikt" | "oppgaver" | "kommentarer">(
    "oversikt",
  );

  const memberOptions = useMemo(() => {
    return (members ?? [])
      .map((m) => ({
        userId: m.userId as Id<"users">,
        label: m.name?.trim() || m.email || "Medlem",
      }))
      .sort((a, b) => a.label.localeCompare(b.label, "nb"));
  }, [members]);

  const openTasks = useMemo(
    () => (tasks ?? []).filter((t) => t.status === "open"),
    [tasks],
  );

  const toggleUser = (userId: Id<"users">) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId],
    );
  };

  const resetLocal = () => {
    setTaskTitle("");
    setTaskDescription("");
    setSelectedUserIds([]);
    setPriorityDraft("");
    setTab("oversikt");
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) resetLocal();
    onOpenChange(next);
  };

  if (!card) return null;

  const phase = card.pipelineStatus as PipelineStatus;

  const submitTask = async () => {
    const title = taskTitle.trim();
    if (!title) {
      toast.error("Oppgavetekst mangler");
      return;
    }
    if (selectedUserIds.length === 0) {
      toast.error("Velg minst én person");
      return;
    }
    setBusy(true);
    try {
      await createTask({
        assessmentId: card.assessmentId,
        title,
        description: taskDescription.trim() || undefined,
        assigneeUserIds: selectedUserIds,
      });
      setTaskTitle("");
      setTaskDescription("");
      setSelectedUserIds([]);
      toast.success("Oppgave tildelt — mottakere får varsel under Oppgaver");
      setTab("oppgaver");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kunne ikke opprette oppgave");
    } finally {
      setBusy(false);
    }
  };

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
      <DialogContent size="2xl" titleId="portfolio-card-title">
        <DialogHeader className="space-y-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 space-y-1">
              <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                Kandidat
              </p>
              <h2
                id="portfolio-card-title"
                className="font-heading text-lg font-semibold leading-snug tracking-tight sm:text-xl"
              >
                {card.title}
              </h2>
            </div>
            <Link
              href={`/w/${workspaceId}/a/${card.assessmentId}`}
              className="text-muted-foreground hover:text-foreground inline-flex shrink-0 items-center gap-1 text-xs font-medium underline-offset-2 hover:underline"
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
            className="flex gap-1 rounded-xl border border-border/50 bg-muted/20 p-1"
          >
            {(
              [
                ["oversikt", "Oversikt"],
                ["oppgaver", `Oppgaver (${openTasks.length})`],
                ["kommentarer", `Kommentarer (${notes?.length ?? card.noteCount})`],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={cn(
                  "flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors sm:text-sm",
                  tab === id
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
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
            <div className="space-y-4">
              <div className="space-y-3 rounded-xl border border-border/50 bg-muted/10 p-3.5">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <UserPlus className="size-4 shrink-0" aria-hidden />
                  Tildel oppgave
                </p>
                <div className="space-y-1.5">
                  <Label htmlFor="portfolio-task-title" className="text-sm">
                    Oppgave
                  </Label>
                  <input
                    id="portfolio-task-title"
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    placeholder="F.eks. Gjennomgå ROS før prioritering"
                    className="border-input bg-background h-10 w-full rounded-xl border px-3 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="portfolio-task-desc" className="text-sm">
                    Beskrivelse (valgfritt)
                  </Label>
                  <Textarea
                    id="portfolio-task-desc"
                    value={taskDescription}
                    onChange={(e) => setTaskDescription(e.target.value)}
                    rows={2}
                    className="resize-y text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Til personer (en eller flere)</Label>
                  <div className="flex max-h-40 flex-col gap-1 overflow-y-auto rounded-xl border border-border/50 p-1.5">
                    {memberOptions.length === 0 ? (
                      <p className="text-muted-foreground px-2 py-2 text-sm">
                        Laster medlemmer …
                      </p>
                    ) : (
                      memberOptions.map((m) => {
                        const selected = selectedUserIds.includes(m.userId);
                        return (
                          <button
                            key={m.userId}
                            type="button"
                            onClick={() => toggleUser(m.userId)}
                            className={cn(
                              "flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
                              selected ? "bg-muted" : "hover:bg-muted/50",
                            )}
                          >
                            <span
                              className={cn(
                                "flex size-4 shrink-0 items-center justify-center rounded border",
                                selected
                                  ? "border-foreground bg-foreground text-background"
                                  : "border-border",
                              )}
                              aria-hidden
                            >
                              {selected ? (
                                <CheckCircle2 className="size-3" />
                              ) : null}
                            </span>
                            <span className="truncate">{m.label}</span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button
                    type="button"
                    size="sm"
                    className="rounded-xl"
                    disabled={
                      busy ||
                      !taskTitle.trim() ||
                      selectedUserIds.length === 0
                    }
                    onClick={() => void submitTask()}
                  >
                    <Send className="size-3.5" />
                    Send oppgave
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                  Åpne oppgaver
                </p>
                {openTasks.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    Ingen åpne oppgaver på denne kandidaten.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {openTasks.map((task) => (
                      <li
                        key={task._id}
                        className="flex items-start gap-2 rounded-xl border border-border/50 bg-card px-3 py-2.5 text-sm"
                      >
                        <ClipboardList
                          className="text-muted-foreground mt-0.5 size-3.5 shrink-0"
                          aria-hidden
                        />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium leading-snug">{task.title}</p>
                          <p className="text-muted-foreground mt-0.5 text-xs">
                            {task.assignees?.length
                              ? task.assignees.map((a) => a.name).join(", ")
                              : task.assigneeName ?? "Ikke tildelt"}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                <Link
                  href={`/w/${workspaceId}/oppgaver`}
                  className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs font-medium underline-offset-2 hover:underline"
                >
                  Se alle oppgaver
                  <ArrowUpRight className="size-3" aria-hidden />
                </Link>
              </div>
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
