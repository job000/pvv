"use client";

import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { riskTreatmentMeta, type RosRiskTreatmentKind } from "@/lib/ros-task-ui";
import { cn } from "@/lib/utils";
import {
  ArrowUpRight,
  Check,
  ClipboardList,
  RotateCcw,
  Shield,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

export type WorkspaceTaskPreview = {
  kind: "assessment" | "ros";
  taskId: string;
  title: string;
  myStatus: "pending" | "accepted" | "declined" | "done";
  assigneeName: string;
  assignerName: string;
  work: {
    kindLabel: string;
    workHref: string;
    workLabel: string;
    fields: { label: string; value: string }[];
    rosTreatment?: {
      kind: RosRiskTreatmentKind;
      kindLabel: string;
      justificationRequired: boolean;
      justificationLabel: string;
      justificationValue: string;
      dateLabel: string;
      dueAt?: number;
      linkedRiskSummary: string | null;
    };
  };
};

type Action = "accept" | "decline" | "complete" | "reopen";

const STATUS_LABEL: Record<WorkspaceTaskPreview["myStatus"], string> = {
  pending: "Ikke tatt imot ennå",
  accepted: "Tatt imot — gjenstår å utføre",
  done: "Utført",
  declined: "Returnert",
};

function statusTone(status: WorkspaceTaskPreview["myStatus"]) {
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

function treatmentCompleteLabel(kind: RosRiskTreatmentKind): string {
  switch (kind) {
    case "accept":
      return "Registrer aksept (ferdig)";
    case "mitigate":
      return "Bekreft tiltak utført";
    case "transfer":
      return "Bekreft overføring aktiv";
    case "avoid":
      return "Bekreft unngått / stoppet";
  }
}

export function WorkspaceTaskPreviewDialog({
  task,
  open,
  onOpenChange,
  busy,
  onAction,
}: {
  task: WorkspaceTaskPreview | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  busy: boolean;
  onAction: (
    action: Action,
    opts?: {
      note?: string;
      completionJustification?: string;
      completionDueAt?: number | null;
    },
  ) => Promise<void>;
}) {
  const treatment = task?.work.rosTreatment;
  const meta = treatment ? riskTreatmentMeta(treatment.kind) : null;
  const [justification, setJustification] = useState("");
  const [dueLocal, setDueLocal] = useState("");
  const [declineNote, setDeclineNote] = useState("");
  const [mode, setMode] = useState<"main" | "decline">("main");

  useEffect(() => {
    if (!task || !open) return;
    setJustification(treatment?.justificationValue ?? "");
    setDueLocal(
      treatment?.dueAt
        ? new Date(treatment.dueAt).toISOString().slice(0, 16)
        : "",
    );
    setDeclineNote("");
    setMode("main");
  }, [task, open, treatment?.justificationValue, treatment?.dueAt]);

  if (!task) return null;

  const KindIcon = task.kind === "ros" ? Shield : ClipboardList;
  const canWork = task.myStatus === "pending" || task.myStatus === "accepted";
  const justMissing =
    Boolean(treatment?.justificationRequired) && !justification.trim();

  const complete = async () => {
    if (justMissing) return;
    const dueMs =
      dueLocal.trim() === "" ? null : new Date(dueLocal).getTime();
    await onAction("complete", {
      completionJustification: justification.trim() || undefined,
      completionDueAt: dueLocal.trim() === "" ? null : dueMs,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <div className="flex flex-wrap items-start gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground">
              <KindIcon className="size-3" aria-hidden />
              {task.work.kindLabel}
            </span>
            {treatment ? (
              <span className="rounded-full bg-foreground px-2.5 py-0.5 text-xs font-semibold text-background">
                Jobb: {treatment.kindLabel}
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
          <h2 className="mt-2 text-lg font-semibold tracking-tight">
            {task.title}
          </h2>
          <p className="text-sm text-muted-foreground">
            Tildelt til{" "}
            <span className="font-medium text-foreground">{task.assigneeName}</span>
            {" · "}
            tildelt av{" "}
            <span className="font-medium text-foreground">{task.assignerName}</span>
          </p>
        </DialogHeader>

        <DialogBody className="space-y-5">
          {treatment && meta ? (
            <div className="space-y-3 rounded-xl border border-foreground/15 bg-muted/25 p-4">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">
                  {meta.formTitle}
                </p>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {meta.planMeaning}
                </p>
              </div>

              <ol className="space-y-2 text-sm">
                <li className="flex gap-2">
                  <span
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                      task.myStatus === "pending"
                        ? "bg-amber-500/20 text-amber-900 dark:text-amber-100"
                        : "bg-emerald-500/20 text-emerald-900 dark:text-emerald-100",
                    )}
                  >
                    1
                  </span>
                  <span>
                    <span className="font-medium">Ta imot oppgaven</span>
                    <span className="text-muted-foreground">
                      {" "}
                      (ikke det samme som ROS-aksept — bare at du påtar deg jobben)
                    </span>
                  </span>
                </li>
                <li className="flex gap-2">
                  <span
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                      task.myStatus === "done"
                        ? "bg-emerald-500/20 text-emerald-900 dark:text-emerald-100"
                        : "bg-sky-500/20 text-sky-900 dark:text-sky-100",
                    )}
                  >
                    2
                  </span>
                  <span>
                    <span className="font-medium">
                      {treatment.kind === "accept"
                        ? "Registrer aksepten"
                        : treatment.kind === "mitigate"
                          ? "Utfør tiltaket og bekreft"
                          : treatment.kind === "transfer"
                            ? "Få overføringen på plass og bekreft"
                            : "Stopp/endre aktiviteten og bekreft"}
                    </span>
                    <span className="text-muted-foreground">
                      {" "}
                      — fyll feltene under, eller åpne ROS for mer kontekst.
                    </span>
                  </span>
                </li>
              </ol>

              {treatment.linkedRiskSummary ? (
                <p className="rounded-lg bg-background/60 px-3 py-2 text-sm">
                  <span className="text-muted-foreground">Koblet risiko: </span>
                  {treatment.linkedRiskSummary}
                </p>
              ) : null}

              {canWork ? (
                <div className="space-y-3 border-t border-border/50 pt-3">
                  {(treatment.justificationRequired ||
                    treatment.kind === "mitigate") && (
                    <div className="space-y-1.5">
                      <Label htmlFor="task-preview-justification">
                        {treatment.kind === "mitigate"
                          ? "Hva ble gjort? (valgfritt)"
                          : `${treatment.justificationLabel} *`}
                      </Label>
                      <Textarea
                        id="task-preview-justification"
                        value={justification}
                        onChange={(e) => setJustification(e.target.value)}
                        rows={3}
                        placeholder={
                          treatment.kind === "accept"
                            ? "Hvorfor er restrisikoen akseptabel? Hvem godkjenner?"
                            : treatment.kind === "mitigate"
                              ? "Kort: hva ble iverksatt?"
                              : treatment.kind === "transfer"
                                ? "Hvem overtar, og hvordan (avtale/forsikring)?"
                                : "Hva ble stoppet eller endret?"
                        }
                      />
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label htmlFor="task-preview-due">{treatment.dateLabel}</Label>
                    <Input
                      id="task-preview-due"
                      type="datetime-local"
                      value={dueLocal}
                      onChange={(e) => setDueLocal(e.target.value)}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <dl className="space-y-3">
              {task.work.fields.map((f) => (
                <div key={`${f.label}-${f.value.slice(0, 24)}`}>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {f.label}
                  </dt>
                  <dd className="mt-0.5 text-sm text-foreground whitespace-pre-wrap">
                    {f.value}
                  </dd>
                </div>
              ))}
            </dl>
          )}

          {treatment ? (
            <details className="text-sm">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                Vis alle detaljer
              </summary>
              <dl className="mt-3 space-y-3">
                {task.work.fields.map((f) => (
                  <div key={`d-${f.label}-${f.value.slice(0, 24)}`}>
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {f.label}
                    </dt>
                    <dd className="mt-0.5 text-sm whitespace-pre-wrap">{f.value}</dd>
                  </div>
                ))}
              </dl>
            </details>
          ) : null}

          {mode === "decline" ? (
            <div className="space-y-2 rounded-xl bg-muted/40 p-3">
              <p className="text-sm text-muted-foreground">
                Returneres til{" "}
                <span className="font-medium text-foreground">
                  {task.assignerName}
                </span>
                .
              </p>
              <Label htmlFor="task-preview-decline">Begrunnelse (valgfritt)</Label>
              <Textarea
                id="task-preview-decline"
                value={declineNote}
                onChange={(e) => setDeclineNote(e.target.value)}
                rows={2}
                placeholder="Hvorfor returnerer du oppgaven?"
              />
            </div>
          ) : null}
        </DialogBody>

        <DialogFooter className="justify-between gap-3 sm:justify-between">
          <Link
            href={task.work.workHref}
            onClick={() => onOpenChange(false)}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "gap-1.5",
            )}
          >
            {task.work.workLabel}
            <ArrowUpRight className="size-4" aria-hidden />
          </Link>

          <div className="flex flex-wrap justify-end gap-2">
            {mode === "decline" ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => setMode("main")}
                >
                  Avbryt
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={busy}
                  className="gap-1.5"
                  onClick={() =>
                    void onAction("decline", { note: declineNote })
                  }
                >
                  <X className="size-4" />
                  Returner til {task.assignerName}
                </Button>
              </>
            ) : (
              <>
                {canWork && treatment ? (
                  <>
                    {task.myStatus === "pending" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        className="gap-1.5"
                        onClick={() => void onAction("accept")}
                      >
                        <Check className="size-4" />
                        Bare ta imot
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      disabled={busy || justMissing}
                      className="gap-1.5"
                      onClick={() => void complete()}
                    >
                      <Check className="size-4" />
                      {treatmentCompleteLabel(treatment.kind)}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      className="gap-1.5"
                      onClick={() => setMode("decline")}
                    >
                      <X className="size-4" />
                      Returner
                    </Button>
                  </>
                ) : null}

                {canWork && !treatment ? (
                  <>
                    {task.myStatus === "pending" ? (
                      <Button
                        size="sm"
                        disabled={busy}
                        className="gap-1.5"
                        onClick={() => void onAction("accept")}
                      >
                        <Check className="size-4" />
                        Ta imot oppgaven
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        disabled={busy}
                        className="gap-1.5"
                        onClick={() => void complete()}
                      >
                        <Check className="size-4" />
                        Merk som utført
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      className="gap-1.5"
                      onClick={() => setMode("decline")}
                    >
                      <X className="size-4" />
                      Returner
                    </Button>
                  </>
                ) : null}

                {task.myStatus === "done" ? (
                  <div className="flex flex-col items-end gap-1.5 sm:flex-row sm:items-center">
                    <p className="text-xs text-muted-foreground max-w-[16rem] text-right">
                      Feil registrering? Angre — begrunnelse beholdes som utkast.
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      className="gap-1.5"
                      onClick={() => void onAction("reopen")}
                    >
                      <RotateCcw className="size-4" />
                      {treatment?.kind === "accept"
                        ? "Angre aksept"
                        : "Angre utført"}
                    </Button>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
