"use client";

import { UserAvatar } from "@/components/user-avatar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { formatUserFacingError } from "@/lib/user-facing-error";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import {
  CalendarDays,
  CheckCircle2,
  CircleDot,
  MessageSquareText,
  Share2,
  Users,
} from "lucide-react";
import { useCallback, useState } from "react";

const COLLAB_ROLE_NB: Record<string, string> = {
  owner: "Eier",
  editor: "Redaktør",
  reviewer: "Gjennomganger",
  viewer: "Visning",
};

const PRIORITY_LABEL: Record<number, string> = {
  1: "Høyest",
  2: "Høy",
  3: "Middels",
  4: "Lav",
  5: "Lavest",
};

type Props = {
  assessmentId: Id<"assessments">;
  workspaceId: Id<"workspaces">;
  canEdit: boolean;
};

export function AssessmentCollaborationPanel({
  assessmentId,
  workspaceId,
  canEdit,
}: Props) {
  const access = useQuery(api.assessments.getMyAccess, { assessmentId });
  const versions = useQuery(api.assessments.listVersions, { assessmentId });
  const collaborators = useQuery(api.assessments.listCollaborators, {
    assessmentId,
  });
  const workspaceMembers = useQuery(api.workspaces.listMembers, {
    workspaceId,
  });
  const assessmentTasks = useQuery(api.assessmentTasks.listByAssessment, {
    assessmentId,
  });
  const notes = useQuery(api.assessmentNotes.listByAssessment, {
    assessmentId,
  });

  const invite = useMutation(api.assessments.inviteCollaborator);
  const setShare = useMutation(api.assessments.setShareWithWorkspace);
  const createVersion = useMutation(api.assessments.createVersion);
  const restoreDraftFromVersion = useMutation(
    api.assessments.restoreDraftFromVersion,
  );
  const createAssessmentTask = useMutation(api.assessmentTasks.create);
  const setAssessmentTaskStatus = useMutation(api.assessmentTasks.setStatus);
  const addNote = useMutation(api.assessmentNotes.add);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<
    "editor" | "reviewer" | "viewer"
  >("reviewer");
  const [versionNote, setVersionNote] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskAssignee, setTaskAssignee] = useState<Id<"users"> | "">("");
  const [taskPriority, setTaskPriority] = useState(3);
  const [taskDue, setTaskDue] = useState(""); // yyyy-mm-dd for input
  const [noteBody, setNoteBody] = useState("");
  const [noteError, setNoteError] = useState<string | null>(null);

  const submitNote = useCallback(async () => {
    setNoteError(null);
    const body = noteBody.trim();
    if (!body) return;
    try {
      await addNote({ assessmentId, body });
      setNoteBody("");
    } catch (e) {
      setNoteError(formatUserFacingError(e));
    }
  }, [addNote, assessmentId, noteBody]);

  const taskDueMs = taskDue
    ? new Date(`${taskDue}T12:00:00`).getTime()
    : undefined;

  return (
    <div className="space-y-6">
      {/* Team — tydelig hvem som er med */}
      <Card className="overflow-hidden border-border/70 shadow-sm">
        <CardHeader className="border-border/50 bg-muted/25 pb-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="bg-primary/10 flex size-9 items-center justify-center rounded-xl">
                <Users className="text-primary size-5" />
              </div>
              <div>
                <CardTitle className="text-base">Team på denne vurderingen</CardTitle>
                <CardDescription>
                  Alle som er invitert ser aktivitet, oppgaver og notater her.
                </CardDescription>
              </div>
            </div>
            <Badge variant="secondary" className="shrink-0">
              {(collaborators ?? []).length}{" "}
              {(collaborators ?? []).length === 1 ? "person" : "personer"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {(collaborators ?? []).length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Ingen er invitert ennå — bruk skjemaet under for å legge til.
            </p>
          ) : (
            <ul className="flex flex-wrap gap-3">
              {(collaborators ?? []).map((c) => {
                const label =
                  COLLAB_ROLE_NB[c.role] ?? c.role;
                const display = c.name ?? c.email ?? String(c.userId);
                return (
                  <li
                    key={c._id}
                    className="bg-card flex min-w-[200px] flex-1 items-center gap-3 rounded-2xl border px-3 py-2.5 shadow-xs"
                  >
                    <UserAvatar name={display} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{display}</p>
                      <p className="text-muted-foreground text-xs">{label}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Invitasjon + deling */}
      <div className="rounded-2xl border border-border/60 bg-card/80 p-4 shadow-xs">
        <div className="mb-3 flex items-center gap-2">
          <Share2 className="text-muted-foreground size-4" />
          <p className="font-medium text-sm">Tilgang og deling</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1 space-y-2">
            <Label htmlFor="collab-email">E-post</Label>
            <Input
              id="collab-email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="kollega@firma.no"
              disabled={!canEdit}
              autoComplete="email"
            />
          </div>
          <div className="space-y-2 sm:w-44">
            <Label htmlFor="collab-role">Rolle</Label>
            <select
              id="collab-role"
              className="border-input bg-background flex h-9 w-full rounded-lg border px-2 text-sm"
              value={inviteRole}
              onChange={(e) =>
                setInviteRole(
                  e.target.value as "editor" | "reviewer" | "viewer",
                )
              }
              disabled={!canEdit}
            >
              <option value="editor">Redaktør</option>
              <option value="reviewer">Gjennomganger</option>
              <option value="viewer">Visning</option>
            </select>
          </div>
          <Button
            disabled={!canEdit || !inviteEmail.trim()}
            onClick={() =>
              void invite({
                assessmentId,
                email: inviteEmail.trim(),
                role: inviteRole,
              }).then(() => setInviteEmail(""))
            }
          >
            Inviter
          </Button>
        </div>
        <div className="mt-4 flex items-start gap-3">
          <Checkbox
            id="share-ws"
            checked={access?.shareWithWorkspace ?? false}
            onCheckedChange={(c) =>
              canEdit &&
              void setShare({
                assessmentId,
                shareWithWorkspace: c === true,
              })
            }
            disabled={!canEdit}
          />
          <Label htmlFor="share-ws" className="cursor-pointer leading-snug">
            Synlig for alle med tilgang til arbeidsområdet (som i en gruppe på
            Facebook — alle i rommet ser innholdet).
          </Label>
        </div>
      </div>

      {/* Oppgaver — hvem gjør hva */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="text-primary size-5" />
          <div>
            <h3 className="font-heading text-base font-semibold">Oppgaver</h3>
            <p className="text-muted-foreground text-sm">
              Tildel ansvar, sett frist og prioritet. Alle med tilgang ser
              status.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {(assessmentTasks ?? []).length === 0 ? (
            <p className="text-muted-foreground rounded-xl border border-dashed px-4 py-8 text-center text-sm">
              Ingen oppgaver ennå — opprett den første under.
            </p>
          ) : (
            <ul className="space-y-2.5">
              {(assessmentTasks ?? []).map((t) => {
                const prio = Math.min(5, Math.max(1, t.priority ?? 3));
                return (
                  <li
                    key={t._id}
                    className={cn(
                      "flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-xs sm:flex-row sm:items-start sm:justify-between",
                      t.status === "done" && "opacity-80",
                    )}
                  >
                    <div className="flex min-w-0 flex-1 gap-3">
                      <UserAvatar
                        name={t.assigneeName ?? "Ikke tildelt"}
                        className={cn(!t.assigneeName && "opacity-60")}
                      />
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p
                            className={cn(
                              "font-medium",
                              t.status === "done" &&
                                "text-muted-foreground line-through",
                            )}
                          >
                            {t.title}
                          </p>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px] font-semibold uppercase tracking-wide",
                              prio <= 2 && "border-amber-500/50 text-amber-800",
                              prio >= 4 && "text-muted-foreground",
                            )}
                          >
                            P{prio} · {PRIORITY_LABEL[prio] ?? prio}
                          </Badge>
                          {t.status === "done" ? (
                            <Badge className="gap-0.5 text-[10px]">
                              <CheckCircle2 className="size-3" /> Fullført
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px]">
                              Åpen
                            </Badge>
                          )}
                        </div>
                        {t.description ? (
                          <p className="text-muted-foreground text-sm leading-relaxed">
                            {t.description}
                          </p>
                        ) : null}
                        <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
                          {t.assigneeName ? (
                            <span className="flex items-center gap-1">
                              <CircleDot className="size-3.5 shrink-0" />
                              <strong className="text-foreground/90 font-medium">
                                Ansvar:
                              </strong>{" "}
                              {t.assigneeName}
                            </span>
                          ) : (
                            <span>Ingen tildeling</span>
                          )}
                          {t.creatorName ? (
                            <span>
                              <strong className="text-foreground/90 font-medium">
                                Opprettet av
                              </strong>{" "}
                              {t.creatorName}
                            </span>
                          ) : null}
                          {t.dueAt ? (
                            <span className="flex items-center gap-1">
                              <CalendarDays className="size-3.5" />
                              Frist{" "}
                              {new Date(t.dueAt).toLocaleDateString("nb-NO")}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant={t.status === "done" ? "outline" : "default"}
                      className="shrink-0 self-start"
                      disabled={!canEdit}
                      onClick={() =>
                        void setAssessmentTaskStatus({
                          taskId: t._id,
                          status: t.status === "open" ? "done" : "open",
                        })
                      }
                    >
                      {t.status === "done" ? "Gjenåpne" : "Marker fullført"}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="bg-muted/15 space-y-4 rounded-2xl border p-4">
            <p className="font-medium text-sm">Ny oppgave</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="new-task-title">Tittel</Label>
                <Input
                  id="new-task-title"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="F.eks. Ferdigstill ROS-analyse"
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="new-task-desc">Beskrivelse (valgfritt)</Label>
                <Textarea
                  id="new-task-desc"
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  placeholder="Kort om hva som forventes levert …"
                  disabled={!canEdit}
                  className="min-h-[72px]"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-task-assignee">Tildelt til</Label>
                <select
                  id="new-task-assignee"
                  className="border-input bg-background flex h-9 w-full rounded-lg border px-2 text-sm"
                  value={taskAssignee}
                  onChange={(e) =>
                    setTaskAssignee(
                      e.target.value === ""
                        ? ""
                        : (e.target.value as Id<"users">),
                    )
                  }
                  disabled={!canEdit}
                >
                  <option value="">— Velg person —</option>
                  {(workspaceMembers ?? []).map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.name ?? m.email ?? m.userId}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-task-prio">Prioritet</Label>
                <select
                  id="new-task-prio"
                  className="border-input bg-background flex h-9 w-full rounded-lg border px-2 text-sm"
                  value={taskPriority}
                  onChange={(e) =>
                    setTaskPriority(Number.parseInt(e.target.value, 10))
                  }
                  disabled={!canEdit}
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      P{n} — {PRIORITY_LABEL[n]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-task-due">Frist (valgfritt)</Label>
                <Input
                  id="new-task-due"
                  type="date"
                  value={taskDue}
                  onChange={(e) => setTaskDue(e.target.value)}
                  disabled={!canEdit}
                />
              </div>
            </div>
            <Button
              type="button"
              className="w-full sm:w-auto"
              disabled={
                !canEdit || !taskTitle.trim() || workspaceMembers === undefined
              }
              onClick={() => {
                const title = taskTitle.trim();
                if (!title) return;
                void createAssessmentTask({
                  assessmentId,
                  title,
                  description: taskDescription.trim() || undefined,
                  assigneeUserId:
                    taskAssignee === "" ? undefined : taskAssignee,
                  priority: taskPriority,
                  dueAt: taskDueMs,
                }).then(() => {
                  setTaskTitle("");
                  setTaskDescription("");
                  setTaskAssignee("");
                  setTaskPriority(3);
                  setTaskDue("");
                });
              }}
            >
              Legg til oppgave
            </Button>
          </div>
        </div>
      </div>

      <Separator />

      {/* Notater — kort feed */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <MessageSquareText className="text-primary size-5" />
          <div>
            <h3 className="font-heading text-base font-semibold">
              Notater og avklaringer
            </h3>
            <p className="text-muted-foreground text-sm">
              Korte meldinger til teamet (ikke versjonert utkast — bruk
              versjonspunkter for milepæler).
            </p>
          </div>
        </div>

        {noteError ? (
          <Alert variant="destructive">
            <AlertTitle>Kunne ikke lagre</AlertTitle>
            <AlertDescription>{noteError}</AlertDescription>
          </Alert>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="note-composer" className="sr-only">
            Nytt notat
          </Label>
          <Textarea
            id="note-composer"
            value={noteBody}
            onChange={(e) => {
              setNoteBody(e.target.value);
              setNoteError(null);
            }}
            placeholder="Skriv et notat til teamet …"
            disabled={!canEdit}
            className="min-h-[88px]"
          />
          <div className="flex justify-end">
            <Button
              type="button"
              disabled={!canEdit || !noteBody.trim()}
              onClick={() => void submitNote()}
            >
              Publiser notat
            </Button>
          </div>
        </div>

        <ul className="max-h-[min(420px,50vh)] space-y-3 overflow-y-auto pr-1">
          {(notes ?? []).length === 0 ? (
            <li className="text-muted-foreground rounded-xl border border-dashed px-4 py-6 text-center text-sm">
              Ingen notater ennå.
            </li>
          ) : (
            (notes ?? []).map((n) => (
              <li
                key={n._id}
                className="rounded-2xl border bg-card p-4 shadow-xs"
              >
                <div className="flex gap-3">
                  <UserAvatar name={n.authorName} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="font-medium">{n.authorName}</span>
                      <time
                        className="text-muted-foreground text-xs"
                        dateTime={new Date(n.createdAt).toISOString()}
                      >
                        {new Date(n.createdAt).toLocaleString("nb-NO", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </time>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
                      {n.body}
                    </p>
                  </div>
                </div>
              </li>
            ))
          )}
        </ul>
      </div>

      <Separator />

      {/* Versjoner */}
      <div className="space-y-3">
        <div>
          <h3 className="font-heading text-base font-semibold">
            Versjonspunkter
          </h3>
          <p className="text-muted-foreground text-sm">
            Lag et «snapshot» du kan gå tilbake til. Historikken slettes ikke.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="version-note">Notat til versjon (valgfritt)</Label>
          <Input
            id="version-note"
            value={versionNote}
            onChange={(e) => setVersionNote(e.target.value)}
            placeholder="F.eks. Etter workshop uke 12"
            disabled={!canEdit}
          />
          <Button
            variant="secondary"
            disabled={!canEdit}
            onClick={() =>
              void createVersion({
                assessmentId,
                note: versionNote || undefined,
              }).then(() => setVersionNote(""))
            }
          >
            Lagre versjon nå
          </Button>
        </div>

        <div id="versjoner" className="scroll-mt-28 space-y-2">
          <p className="font-medium text-sm">Historikk</p>
          <ul className="max-h-60 space-y-2 overflow-y-auto text-sm">
            {(versions ?? []).length === 0 ? (
              <li className="text-muted-foreground">Ingen versjoner ennå.</li>
            ) : (
              (versions ?? []).map((ver) => (
                <li
                  key={ver._id}
                  className="bg-muted/15 flex flex-col gap-2 rounded-xl border px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <span className="font-semibold">v{ver.version}</span>
                    <span className="text-muted-foreground ml-2 text-xs">
                      {new Date(ver.createdAt).toLocaleString("nb-NO")}
                    </span>
                    {ver.note ? (
                      <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                        {ver.note}
                      </p>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="shrink-0"
                    disabled={!canEdit}
                    onClick={() => {
                      if (
                        typeof window !== "undefined" &&
                        window.confirm(
                          `Gjenopprette utkast fra v${ver.version}? Nåværende utkast i skjemaet erstattes.`,
                        )
                      ) {
                        void restoreDraftFromVersion({
                          assessmentId,
                          version: ver.version,
                        });
                      }
                    }}
                  >
                    Gjenopprett utkast
                  </Button>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
