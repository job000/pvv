"use client";

import {
  ProductEmptyState,
  ProductLoadingBlock,
} from "@/components/product";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  WorkspaceTaskPreviewDialog,
  type WorkspaceTaskPreview,
} from "@/components/workspace/workspace-task-preview-dialog";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "@/lib/app-toast";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowUpRight,
  ClipboardList,
  ListChecks,
  Shield,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

type MyStatus = "pending" | "accepted" | "declined" | "done";
type FilterKey = "all" | MyStatus | "assigned";

const STATUS_LABEL: Record<MyStatus, string> = {
  pending: "Ikke tatt imot",
  accepted: "Tatt imot",
  done: "Utført",
  declined: "Returnert",
};

function statusTone(status: MyStatus) {
  switch (status) {
    case "pending":
      return "bg-amber-500/15 text-amber-800 dark:text-amber-200";
    case "accepted":
      return "bg-sky-500/15 text-sky-800 dark:text-sky-200";
    case "done":
      return "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200";
    case "declined":
      return "bg-muted text-muted-foreground";
  }
}

export function WorkspaceTasksPanel({
  workspaceId,
}: {
  workspaceId: Id<"workspaces">;
}) {
  const data = useQuery(api.workspaceTasks.listMyInWorkspace, { workspaceId });
  const respond = useMutation(api.workspaceTasks.respond);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [busy, setBusy] = useState(false);
  const [previewTask, setPreviewTask] = useState<WorkspaceTaskPreview | null>(
    null,
  );

  const counts = useMemo(() => {
    if (!data) return null;
    const c = { pending: 0, accepted: 0, done: 0, declined: 0 };
    for (const t of data.mine) {
      c[t.myStatus] += 1;
    }
    return c;
  }, [data]);

  const visibleMine = useMemo(() => {
    if (!data) return [];
    if (filter === "all") return data.mine.filter((t) => t.myStatus !== "declined");
    if (filter === "assigned") return [];
    return data.mine.filter((t) => t.myStatus === filter);
  }, [data, filter]);

  const runAction = async (
    kind: "assessment" | "ros",
    taskId: string,
    action: "accept" | "decline" | "complete" | "reopen",
    opts?: {
      note?: string;
      completionJustification?: string;
      completionDueAt?: number | null;
      undoLabel?: string;
    },
  ) => {
    setBusy(true);
    try {
      await respond({
        kind,
        taskId,
        action,
        note: opts?.note,
        completionJustification: opts?.completionJustification,
        completionDueAt: opts?.completionDueAt,
      });
      if (action === "accept") toast.success("Oppgave tatt imot");
      else if (action === "decline")
        toast.success("Oppgave returnert til den som tildelte deg");
      else if (action === "complete") {
        const label = opts?.undoLabel ?? "Angre";
        toast.success("Registrert som utført", {
          description: "Feil? Du kan angre med en gang.",
          action: {
            label,
            onClick: () => {
              void runAction(kind, taskId, "reopen");
            },
          },
          duration: 12_000,
        });
      } else toast.success("Angret — oppgaven er åpen igjen");
      setPreviewTask(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Noe gikk galt");
    } finally {
      setBusy(false);
    }
  };

  if (data === undefined) {
    return <ProductLoadingBlock label="Laster oppgaver …" className="min-h-[30vh]" />;
  }

  const filters: { key: FilterKey; label: string; count?: number }[] = [
    { key: "all", label: "Mine", count: data.mine.filter((t) => t.myStatus !== "declined").length },
    { key: "pending", label: "Venter", count: counts?.pending },
    { key: "accepted", label: "Pågår", count: counts?.accepted },
    { key: "done", label: "Utført", count: counts?.done },
    { key: "assigned", label: "Tildelt av meg", count: data.assignedByMe.length },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={cn(
              "inline-flex min-h-10 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium transition-colors",
              filter === f.key
                ? "bg-foreground text-background"
                : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {f.label}
            {f.count !== undefined ? (
              <span className="tabular-nums opacity-80">{f.count}</span>
            ) : null}
          </button>
        ))}
      </div>

      {filter === "assigned" ? (
        data.assignedByMe.length === 0 ? (
          <ProductEmptyState
            icon={ListChecks}
            title="Ingen oppgaver du har tildelt"
            description="Når du tildeler oppgaver til andre i vurderinger eller ROS, dukker de opp her — med status for hver person."
          />
        ) : (
          <ul className="divide-y divide-border/60 rounded-2xl border border-border/60 bg-card/40">
            {data.assignedByMe.map((task) => (
              <li key={`${task.kind}-${task.taskId}`} className="px-4 py-4 sm:px-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <KindBadge kind={task.kind} />
                      <Link
                        href={task.href}
                        className="font-medium text-foreground underline-offset-4 hover:underline"
                      >
                        {task.title}
                      </Link>
                    </div>
                    <p className="text-sm text-muted-foreground">{task.contextTitle}</p>
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {task.assignees.map((a) => (
                        <li
                          key={a.userId}
                          className={cn(
                            "rounded-full px-2.5 py-0.5 text-xs font-medium",
                            statusTone(a.status),
                          )}
                        >
                          {a.name}: {STATUS_LABEL[a.status]}
                        </li>
                      ))}
                    </ul>
                  </div>
                  {task.dueAt ? (
                    <p className="shrink-0 text-xs text-muted-foreground">
                      Frist {new Date(task.dueAt).toLocaleDateString("nb-NO")}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )
      ) : visibleMine.length === 0 ? (
        <ProductEmptyState
          icon={ClipboardList}
          title={
            filter === "pending"
              ? "Ingen ventende tildelinger"
              : "Ingen oppgaver her"
          }
          description="Oppgaver som er tildelt deg i dette arbeidsområdet vises her. Åpne en oppgave for forhåndsvisning, godta, returner eller merk som utført."
        />
      ) : (
        <ul className="divide-y divide-border/60 rounded-2xl border border-border/60 bg-card/40">
          {visibleMine.map((task) => {
            const rowKey = `${task.kind}:${task.taskId}`;
            return (
              <li key={rowKey} className="px-4 py-4 sm:px-5">
                <div className="flex flex-col gap-3">
                  <button
                    type="button"
                    className="flex w-full flex-col gap-2 rounded-xl text-left transition-colors hover:bg-muted/30 sm:flex-row sm:items-start sm:justify-between -mx-1 px-1 py-1"
                    onClick={() => setPreviewTask(task)}
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <KindBadge kind={task.kind} />
                        {task.work.rosTreatment ? (
                          <span className="rounded-full bg-foreground px-2.5 py-0.5 text-xs font-semibold text-background">
                            {task.work.rosTreatment.kindLabel}
                          </span>
                        ) : null}
                        <span
                          className={cn(
                            "rounded-full px-2.5 py-0.5 text-xs font-medium",
                            statusTone(task.myStatus),
                          )}
                        >
                          {STATUS_LABEL[task.myStatus]}
                        </span>
                      </div>
                      <p className="font-medium text-foreground">{task.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {task.contextTitle}
                      </p>
                      {task.work.rosTreatment ? (
                        <p className="text-sm text-foreground/90">
                          {task.work.rosTreatment.kind === "accept"
                            ? "Din jobb: registrer risikoaksept (begrunnelse + neste gjennomgang)."
                            : task.work.rosTreatment.kind === "mitigate"
                              ? "Din jobb: gjennomfør tiltaket og bekreft her eller i ROS."
                              : task.work.rosTreatment.kind === "transfer"
                                ? "Din jobb: få overføringen på plass og bekreft."
                                : "Din jobb: stopp/endre aktiviteten og bekreft."}
                        </p>
                      ) : null}
                      <p className="text-sm text-foreground/90">
                        <span className="text-muted-foreground">Tildelt til </span>
                        <span className="font-medium">{task.assigneeName}</span>
                        <span className="text-muted-foreground"> · tildelt av </span>
                        <span className="font-medium">{task.assignerName}</span>
                      </p>
                      {task.description ? (
                        <p className="text-sm text-muted-foreground/90 line-clamp-2">
                          {task.description}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 flex-col items-stretch gap-1 sm:items-end">
                      {task.dueAt ? (
                        <p className="text-xs text-muted-foreground">
                          Frist {new Date(task.dueAt).toLocaleDateString("nb-NO")}
                        </p>
                      ) : null}
                      <p className="text-xs text-muted-foreground">P{task.priority}</p>
                    </div>
                  </button>

                  <div className="flex flex-wrap gap-2">
                    {task.myStatus === "done" ? (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() =>
                            void runAction(task.kind, task.taskId, "reopen")
                          }
                          className="gap-1.5"
                        >
                          {task.work.rosTreatment?.kind === "accept"
                            ? "Angre aksept"
                            : "Angre utført"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busy}
                          onClick={() => setPreviewTask(task)}
                        >
                          Vis
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          disabled={busy}
                          onClick={() => setPreviewTask(task)}
                          className="gap-1.5"
                        >
                          {task.work.rosTreatment?.kind === "accept"
                            ? "Åpne og registrer aksept"
                            : task.work.rosTreatment
                              ? `Åpne og ${task.work.rosTreatment.kindLabel.toLowerCase()}`
                              : "Åpne oppgave"}
                        </Button>
                        <Link
                          href={task.work.workHref}
                          className={cn(
                            buttonVariants({ variant: "outline", size: "sm" }),
                            "gap-1.5",
                          )}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {task.work.workLabel}
                          <ArrowUpRight className="size-4" aria-hidden />
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <WorkspaceTaskPreviewDialog
        task={previewTask}
        open={previewTask !== null}
        onOpenChange={(v) => {
          if (!v) setPreviewTask(null);
        }}
        busy={busy}
        onAction={async (action, opts) => {
          if (!previewTask) return;
          const undoLabel =
            previewTask.work.rosTreatment?.kind === "accept"
              ? "Angre aksept"
              : "Angre";
          await runAction(previewTask.kind, previewTask.taskId, action, {
            ...opts,
            undoLabel,
          });
        }}
      />
    </div>
  );
}

function KindBadge({ kind }: { kind: "assessment" | "ros" }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground">
      {kind === "ros" ? (
        <Shield className="size-3" aria-hidden />
      ) : (
        <ClipboardList className="size-3" aria-hidden />
      )}
      {kind === "ros" ? "ROS" : "Vurdering"}
    </span>
  );
}
