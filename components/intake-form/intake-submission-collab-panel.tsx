"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "@/lib/app-toast";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import {
  CheckCircle2,
  ClipboardList,
  MessageSquare,
  Send,
  UserPlus,
} from "lucide-react";
import { useMemo, useState } from "react";

type RequestKind = "review" | "decide" | "general";

const REQUEST_OPTIONS: Array<{
  id: RequestKind;
  label: string;
  hint: string;
}> = [
  {
    id: "decide",
    label: "Godkjenn eller avslå",
    hint: "Mottaker avgjør forslaget",
  },
  {
    id: "review",
    label: "Gjennomgå",
    hint: "Se over og kommenter",
  },
  {
    id: "general",
    label: "Annen oppgave",
    hint: "Fri tekst / oppfølging",
  },
];

export function IntakeSubmissionCollabPanel({
  workspaceId,
  submissionId,
  canAct,
}: {
  workspaceId: Id<"workspaces">;
  submissionId: Id<"intakeSubmissions">;
  canAct: boolean;
}) {
  const members = useQuery(api.workspaces.listMembers, { workspaceId });
  const notes = useQuery(api.intakeSubmissionNotes.listBySubmission, {
    submissionId,
  });
  const tasks = useQuery(api.intakeReviewTasks.listBySubmission, {
    submissionId,
  });
  const addNote = useMutation(api.intakeSubmissionNotes.add);
  const createTask = useMutation(api.intakeReviewTasks.create);

  const [comment, setComment] = useState("");
  const [delegateOpen, setDelegateOpen] = useState(canAct);
  const [requestKind, setRequestKind] = useState<RequestKind>("decide");
  const [selectedUserIds, setSelectedUserIds] = useState<Id<"users">[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const memberOptions = useMemo(() => {
    return (members ?? [])
      .map((m) => ({
        userId: m.userId as Id<"users">,
        label: m.name?.trim() || m.email || "Medlem",
      }))
      .sort((a, b) => a.label.localeCompare(b.label, "nb"));
  }, [members]);

  const toggleUser = (userId: Id<"users">) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId],
    );
  };

  const submitComment = async () => {
    const body = comment.trim();
    if (!body) return;
    setBusy(true);
    try {
      await addNote({ submissionId, body });
      setComment("");
      toast.success("Kommentar lagret");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kunne ikke lagre kommentar");
    } finally {
      setBusy(false);
    }
  };

  const submitDelegate = async () => {
    if (selectedUserIds.length === 0) {
      toast.error("Velg minst én person");
      return;
    }
    setBusy(true);
    try {
      await createTask({
        submissionId,
        assigneeUserIds: selectedUserIds,
        requestKind,
        description: message.trim() || undefined,
      });
      setDelegateOpen(false);
      setSelectedUserIds([]);
      setMessage("");
      toast.success("Oppgave sendt — mottaker får varsel under Oppgaver");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kunne ikke delegere");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-4 rounded-2xl border border-foreground/15 bg-card p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-base font-semibold">
            <UserPlus className="size-4 shrink-0" aria-hidden />
            Deleger gjennomgang
          </p>
          <p className="text-muted-foreground mt-0.5 text-xs sm:text-sm">
            Send forslaget som oppgave til en kollega — de får varsel under Oppgaver.
          </p>
        </div>
        {canAct ? (
          <Button
            type="button"
            variant={delegateOpen ? "outline" : "default"}
            size="sm"
            className="rounded-xl"
            onClick={() => setDelegateOpen((v) => !v)}
          >
            <UserPlus className="size-4" />
            {delegateOpen ? "Skjul" : "Deleger til kollega"}
          </Button>
        ) : (
          <p className="text-muted-foreground text-xs">
            Krever medlemsrettigheter for å delegere.
          </p>
        )}
      </div>

      {delegateOpen && canAct ? (
        <div className="space-y-3 rounded-xl border border-border/60 bg-card p-3.5 sm:p-4">
          <div className="grid gap-2 sm:grid-cols-3">
            {REQUEST_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setRequestKind(opt.id)}
                className={cn(
                  "rounded-xl border px-3 py-2.5 text-left transition-colors",
                  requestKind === opt.id
                    ? "border-foreground/30 bg-foreground text-background"
                    : "border-border/50 hover:bg-muted/40",
                )}
              >
                <p className="text-sm font-medium leading-snug">{opt.label}</p>
                <p
                  className={cn(
                    "mt-0.5 text-[11px] leading-snug",
                    requestKind === opt.id
                      ? "text-background/80"
                      : "text-muted-foreground",
                  )}
                >
                  {opt.hint}
                </p>
              </button>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">Til personer</Label>
            <div className="flex max-h-36 flex-col gap-1 overflow-y-auto rounded-xl border border-border/50 p-1.5">
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
                        {selected ? <CheckCircle2 className="size-3" /> : null}
                      </span>
                      <span className="truncate">{m.label}</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="intake-delegate-msg" className="text-sm">
              Melding (valgfritt)
            </Label>
            <Textarea
              id="intake-delegate-msg"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={2}
              placeholder="F.eks. sjekk persondata-signalet før du avgjør …"
              className="resize-y text-sm"
            />
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setDelegateOpen(false)}
            >
              Avbryt
            </Button>
            <Button
              type="button"
              size="sm"
              className="rounded-xl"
              disabled={busy || selectedUserIds.length === 0}
              onClick={() => void submitDelegate()}
            >
              <Send className="size-3.5" />
              Send oppgave
            </Button>
          </div>
        </div>
      ) : null}

      {(tasks?.length ?? 0) > 0 ? (
        <div className="space-y-2">
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
            Tildelte oppgaver
          </p>
          <ul className="space-y-1.5">
            {tasks!.map((task) => (
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
                    {task.createdByName}
                    {task.assignees.length > 0
                      ? ` → ${task.assignees.map((a) => a.name).join(", ")}`
                      : ""}
                    {" · "}
                    {task.status === "done" ? "Utført" : "Åpen"}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="space-y-2 border-t border-border/50 pt-3">
        <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide">
          <MessageSquare className="size-3.5" aria-hidden />
          Kommentarer
        </p>
        {(notes?.length ?? 0) === 0 ? (
          <p className="text-muted-foreground text-sm">Ingen kommentarer ennå.</p>
        ) : (
          <ul className="space-y-2">
            {notes!.map((n) => (
              <li
                key={n._id}
                className="rounded-xl border border-border/40 bg-card/80 px-3 py-2.5"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-medium">{n.authorName}</p>
                  <p className="text-muted-foreground text-[11px] tabular-nums">
                    {new Date(n.createdAt).toLocaleString("nb-NO")}
                  </p>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">
                  {n.body}
                </p>
              </li>
            ))}
          </ul>
        )}

        {canAct ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              placeholder="Skriv en kommentar til teamet …"
              className="min-h-[4rem] flex-1 resize-y text-sm"
            />
            <Button
              type="button"
              size="sm"
              className="h-10 shrink-0 rounded-xl sm:self-stretch"
              disabled={busy || !comment.trim()}
              onClick={() => void submitComment()}
            >
              <Send className="size-3.5" />
              Legg til
            </Button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
