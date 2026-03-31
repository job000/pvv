"use client";

import { RosJournalPanel } from "@/components/ros/ros-journal-panel";
import { RosMatrix } from "@/components/ros/ros-matrix";
import { RosMethodologyGuide } from "@/components/ros/ros-methodology-guide";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import {
  History,
  Link2,
  ListTodo,
  Plus,
  Trash2,
  Undo2,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

function formatTs(ms: number) {
  try {
    return new Intl.DateTimeFormat("nb-NO", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(ms));
  } catch {
    return String(ms);
  }
}

export function RosAnalysisEditor({
  workspaceId,
  analysisId,
}: {
  workspaceId: Id<"workspaces">;
  analysisId: Id<"rosAnalyses">;
}) {
  const data = useQuery(api.ros.getAnalysis, { analysisId });
  const allAssessments = useQuery(api.ros.listAssessmentsForWorkspace, {
    workspaceId,
  });
  const versions = useQuery(api.ros.listVersions, { analysisId });
  const tasks = useQuery(api.ros.listTasksByRosAnalysis, { analysisId });
  const members = useQuery(api.workspaces.listMembers, { workspaceId });

  const updateAnalysis = useMutation(api.ros.updateAnalysis);
  const removeAnalysis = useMutation(api.ros.removeAnalysis);
  const linkAssessment = useMutation(api.ros.linkAssessment);
  const unlinkAssessment = useMutation(api.ros.unlinkAssessment);
  const migrateLegacyAssessmentToLinks = useMutation(
    api.ros.migrateLegacyAssessmentToLinks,
  );
  const clearLegacyAssessment = useMutation(api.ros.clearLegacyAssessment);
  const createVersion = useMutation(api.ros.createVersion);
  const restoreVersion = useMutation(api.ros.restoreVersion);
  const createRosTask = useMutation(api.ros.createRosTask);
  const updateRosTask = useMutation(api.ros.updateRosTask);
  const removeRosTask = useMutation(api.ros.removeRosTask);
  const setRosTaskStatus = useMutation(api.ros.setRosTaskStatus);

  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [matrix, setMatrix] = useState<number[][]>([]);
  const [cellNotes, setCellNotes] = useState<string[][]>([]);
  const [jumpRequest, setJumpRequest] = useState<{
    row: number;
    col: number;
    nonce: number;
  } | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const [addPvId, setAddPvId] = useState<Id<"assessments"> | "">("");
  const [versionNote, setVersionNote] = useState("");
  const [snapshotBusy, setSnapshotBusy] = useState(false);

  const [taskTitle, setTaskTitle] = useState("");
  const [taskDesc, setTaskDesc] = useState("");
  const [taskAssignee, setTaskAssignee] = useState<Id<"users"> | "">("");
  const [taskPriority, setTaskPriority] = useState(3);
  const [taskBusy, setTaskBusy] = useState(false);

  const [editingTaskId, setEditingTaskId] = useState<Id<"rosTasks"> | null>(
    null,
  );

  useEffect(() => {
    if (!data) return;
    setTitle(data.title);
    setNotes(data.notes ?? "");
    setMatrix(data.matrixValues.map((r) => [...r]));
    setCellNotes(data.cellNotes.map((r) => [...r]));
    setDirty(false);
  // Synk kun ved server-oppdatering (id/tidsstempel), ikke ved hver query-referanse
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?._id, data?.updatedAt]);

  const linkedIds = useMemo(() => {
    if (!data?.linkedAssessments) return new Set<string>();
    return new Set(data.linkedAssessments.map((l) => l.assessmentId));
  }, [data?.linkedAssessments]);

  const addableAssessments = useMemo(() => {
    if (!allAssessments) return [];
    return allAssessments.filter((a) => !linkedIds.has(a._id));
  }, [allAssessments, linkedIds]);

  const onCellChange = useCallback(
    (row: number, col: number, next: number) => {
      setMatrix((prev) => {
        const copy = prev.map((r) => [...r]);
        if (!copy[row]) return prev;
        copy[row][col] = next;
        return copy;
      });
      setDirty(true);
    },
    [],
  );

  const onCellNoteChange = useCallback(
    (row: number, col: number, text: string) => {
      setCellNotes((prev) => {
        const copy = prev.map((r) => [...r]);
        if (!copy[row]) return prev;
        copy[row][col] = text;
        return copy;
      });
      setDirty(true);
    },
    [],
  );

  const handleJumpToCell = useCallback((row: number, col: number) => {
    setJumpRequest({ row, col, nonce: Date.now() });
  }, []);

  const matrixStats = useMemo(() => {
    let max = 0;
    let highOrCritical = 0;
    for (const row of matrix) {
      for (const v of row) {
        if (v > max) max = v;
        if (v >= 4) highOrCritical += 1;
      }
    }
    return { max, highOrCritical };
  }, [matrix]);

  async function save() {
    if (!data) return;
    setSaving(true);
    try {
      await updateAnalysis({
        analysisId,
        title: title.trim(),
        notes: notes.trim() || null,
        matrixValues: matrix,
        cellNotes,
      });
      setDirty(false);
    } finally {
      setSaving(false);
    }
  }

  async function onAddPv() {
    if (addPvId === "") return;
    try {
      await linkAssessment({ analysisId, assessmentId: addPvId });
      setAddPvId("");
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Kunne ikke koble.");
    }
  }

  async function onUnlink(linkId: Id<"rosAnalysisAssessments">) {
    try {
      await unlinkAssessment({ linkId });
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Kunne ikke fjerne.");
    }
  }

  async function onSnapshot() {
    setSnapshotBusy(true);
    try {
      await createVersion({
        analysisId,
        note: versionNote.trim() || undefined,
      });
      setVersionNote("");
    } finally {
      setSnapshotBusy(false);
    }
  }

  async function onRestore(version: number) {
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        `Gjenopprette versjon ${version}? Nåværende matrise og notat overskrives (ikke slettet — lag ny versjon først om du vil beholde dagens stand).`,
      )
    ) {
      return;
    }
    try {
      await restoreVersion({ analysisId, version });
      setDirty(false);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Gjenoppretting feilet.");
    }
  }

  async function onCreateTask(e: React.FormEvent) {
    e.preventDefault();
    const t = taskTitle.trim();
    if (!t) return;
    setTaskBusy(true);
    try {
      await createRosTask({
        analysisId,
        title: t,
        description: taskDesc.trim() || undefined,
        assigneeUserId:
          taskAssignee === "" ? undefined : taskAssignee,
        priority: taskPriority,
      });
      setTaskTitle("");
      setTaskDesc("");
      setTaskAssignee("");
      setTaskPriority(3);
    } finally {
      setTaskBusy(false);
    }
  }

  if (data === undefined) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center">
        <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (data === null) {
    return (
      <p className="text-destructive text-sm">Fant ikke analysen.</p>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href={`/w/${workspaceId}/ros`}
            className="text-muted-foreground hover:text-foreground mb-2 inline-flex text-sm"
          >
            ← Tilbake til ROS
          </Link>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            {data.title}
          </h1>
          <p className="text-muted-foreground mt-1 flex flex-wrap items-center gap-2 text-sm">
            <span>
              Kandidat:{" "}
              <span className="text-foreground font-medium">
                {data.candidateName}
              </span>{" "}
              <span className="font-mono">({data.candidateCode})</span>
            </span>
            {data.linkedAssessments.length > 0 ? (
              <span className="flex flex-wrap items-center gap-1.5">
                <Link2 className="text-muted-foreground size-3.5" aria-hidden />
                {data.linkedAssessments.map((l) => (
                  <Link
                    key={l.linkId}
                    href={`/w/${workspaceId}/a/${l.assessmentId}`}
                    className="text-primary font-medium hover:underline"
                  >
                    {l.title}
                  </Link>
                ))}
              </span>
            ) : null}
            {data.legacyAssessmentId && data.legacyAssessmentTitle ? (
              <Badge variant="outline" className="font-normal">
                Eldre kobling: {data.legacyAssessmentTitle}
              </Badge>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={() => void save()}
            disabled={saving || !dirty}
          >
            {saving ? "Lagrer …" : dirty ? "Lagre endringer" : "Lagret"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (
                typeof window !== "undefined" &&
                window.confirm("Slette denne ROS-analysen?")
              ) {
                void removeAnalysis({ analysisId }).then(() => {
                  window.location.href = `/w/${workspaceId}/ros`;
                });
              }
            }}
          >
            Slett
          </Button>
        </div>
      </div>

      <RosMethodologyGuide
        variant="compact"
        workspaceId={workspaceId}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Detaljer</CardTitle>
          <CardDescription>
            Tittel og notat (metode, forutsetninger). PVV kobles under eget
            avsnitt.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="ros-title">Tittel</Label>
            <Input
              id="ros-title"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setDirty(true);
              }}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="ros-notes">
              Notat (metode, forutsetninger, referanser)
            </Label>
            <Textarea
              id="ros-notes"
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                setDirty(true);
              }}
              rows={4}
              className="min-h-[6rem]"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Link2 className="size-4" />
            PVV-vurderinger (mange-til-mange)
          </CardTitle>
          <CardDescription>
            Koble én eller flere PVV-vurderinger i arbeidsområdet til denne
            ROS-analysen.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.legacyAssessmentId ? (
            <div className="bg-muted/40 flex flex-col gap-2 rounded-xl border p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <p>
                Denne analysen har en <strong>eldre enkeltkobling</strong> til
                PVV. Du kan flytte den til koblingstabellen eller fjerne feltet.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    void migrateLegacyAssessmentToLinks({ analysisId })
                  }
                >
                  Flytt til koblinger
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void clearLegacyAssessment({ analysisId })
                  }
                >
                  Fjern eldre felt
                </Button>
              </div>
            </div>
          ) : null}

          {data.linkedAssessments.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Ingen PVV koblet ennå — velg under.
            </p>
          ) : (
            <ul className="space-y-2">
              {data.linkedAssessments.map((l) => (
                <li
                  key={l.linkId}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2"
                >
                  <Link
                    href={`/w/${workspaceId}/a/${l.assessmentId}`}
                    className="text-primary font-medium hover:underline"
                  >
                    {l.title}
                  </Link>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => void onUnlink(l.linkId)}
                  >
                    <Trash2 className="size-3.5" />
                    Fjern
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1 space-y-1.5">
              <Label htmlFor="ros-add-pv">Legg til PVV</Label>
              <select
                id="ros-add-pv"
                className="border-input bg-background flex h-10 w-full rounded-lg border px-2 text-sm"
                value={addPvId}
                onChange={(e) =>
                  setAddPvId(
                    e.target.value === ""
                      ? ""
                      : (e.target.value as Id<"assessments">),
                  )
                }
              >
                <option value="">— Velg vurdering —</option>
                {addableAssessments.map((a) => (
                  <option key={a._id} value={a._id}>
                    {a.title}
                  </option>
                ))}
              </select>
            </div>
            <Button
              type="button"
              disabled={addPvId === ""}
              onClick={() => void onAddPv()}
            >
              <Plus className="size-4" />
              Koble
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="size-4" />
            Versjonskontroll
          </CardTitle>
          <CardDescription>
            Bruk versjoner til å dokumentere <strong className="text-foreground">før og
            etter</strong> tiltak: lagre et bilde før endring, oppdater matrisen, lagre
            ny versjon. Gjenopprett eldre stand ved behov.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1 space-y-1.5">
              <Label htmlFor="snap-note">Notat til versjon (valgfritt)</Label>
              <Input
                id="snap-note"
                value={versionNote}
                onChange={(e) => setVersionNote(e.target.value)}
                placeholder="F.eks. Før endring av akser"
              />
            </div>
            <Button
              type="button"
              disabled={snapshotBusy}
              onClick={() => void onSnapshot()}
            >
              {snapshotBusy ? "Lagrer …" : "Lagre versjon"}
            </Button>
          </div>
          <Separator />
          {versions === undefined ? (
            <p className="text-muted-foreground text-sm">Henter versjoner …</p>
          ) : versions.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Ingen lagrede versjoner ennå.
            </p>
          ) : (
            <ul className="max-h-64 space-y-2 overflow-y-auto pr-1">
              {versions.map((v) => (
                <li
                  key={v._id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
                >
                  <div>
                    <span className="font-medium">v{v.version}</span>
                    <span className="text-muted-foreground">
                      {" "}
                      · {formatTs(v.createdAt)}
                    </span>
                    {v.note ? (
                      <p className="text-muted-foreground mt-0.5">{v.note}</p>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void onRestore(v.version)}
                  >
                    <Undo2 className="size-3.5" />
                    Gjenopprett
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ListTodo className="size-4" />
            Oppgaver
          </CardTitle>
          <CardDescription>
            Oppfølgingspunkter for denne ROS-analysen — tildeling og status.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form
            onSubmit={(e) => void onCreateTask(e)}
            className="space-y-3 rounded-xl border border-dashed p-4"
          >
            <p className="text-sm font-medium">Ny oppgave</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="rt-title">Tittel</Label>
                <Input
                  id="rt-title"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="rt-desc">Beskrivelse (valgfritt)</Label>
                <Textarea
                  id="rt-desc"
                  value={taskDesc}
                  onChange={(e) => setTaskDesc(e.target.value)}
                  rows={2}
                  className="min-h-0"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rt-assign">Tildelt</Label>
                <select
                  id="rt-assign"
                  className="border-input bg-background flex h-10 w-full rounded-lg border px-2 text-sm"
                  value={taskAssignee}
                  onChange={(e) =>
                    setTaskAssignee(
                      e.target.value === ""
                        ? ""
                        : (e.target.value as Id<"users">),
                    )
                  }
                >
                  <option value="">— Ikke tildelt —</option>
                  {(members ?? []).map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.name ?? m.email ?? m.userId}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rt-prio">Prioritet (1–5)</Label>
                <Input
                  id="rt-prio"
                  type="number"
                  min={1}
                  max={5}
                  value={taskPriority}
                  onChange={(e) =>
                    setTaskPriority(
                      Math.min(
                        5,
                        Math.max(1, Number(e.target.value) || 3),
                      ),
                    )
                  }
                />
              </div>
            </div>
            <Button type="submit" disabled={taskBusy || !taskTitle.trim()}>
              {taskBusy ? "Oppretter …" : "Opprett oppgave"}
            </Button>
          </form>

          <Separator />

          {tasks === undefined ? (
            <p className="text-muted-foreground text-sm">Henter oppgaver …</p>
          ) : tasks.length === 0 ? (
            <p className="text-muted-foreground text-sm">Ingen oppgaver ennå.</p>
          ) : (
            <ul className="space-y-4">
              {tasks.map((t) => (
                <li
                  key={t._id}
                  className="rounded-xl border p-4 shadow-sm"
                >
                  {editingTaskId === t._id ? (
                    <TaskEditForm
                      task={t}
                      members={members ?? []}
                      onCancel={() => setEditingTaskId(null)}
                      onSave={async (patch) => {
                        await updateRosTask({ taskId: t._id, ...patch });
                        setEditingTaskId(null);
                      }}
                    />
                  ) : (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{t.title}</p>
                          <Badge
                            variant={
                              t.status === "done" ? "secondary" : "default"
                            }
                          >
                            {t.status === "done" ? "Fullført" : "Åpen"}
                          </Badge>
                          <span className="text-muted-foreground text-xs">
                            P{t.priority}
                          </span>
                        </div>
                        {t.description ? (
                          <p className="text-muted-foreground text-sm whitespace-pre-wrap">
                            {t.description}
                          </p>
                        ) : null}
                        <p className="text-muted-foreground text-xs">
                          {t.assigneeName
                            ? `Tildelt: ${t.assigneeName}`
                            : "Ikke tildelt"}
                          {t.dueAt
                            ? ` · Frist ${formatTs(t.dueAt)}`
                            : ""}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            void setRosTaskStatus({
                              taskId: t._id,
                              status: t.status === "done" ? "open" : "done",
                            })
                          }
                        >
                          {t.status === "done" ? "Gjenåpne" : "Fullfør"}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => setEditingTaskId(t._id)}
                        >
                          Rediger
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => {
                            if (
                              window.confirm("Slette denne oppgaven?")
                            ) {
                              void removeRosTask({ taskId: t._id });
                            }
                          }}
                        >
                          Slett
                        </Button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-primary/15">
        <CardHeader className="border-b border-border/50 bg-muted/20">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="text-base">Risikomatrise</CardTitle>
              <CardDescription>
                {data.rowAxisTitle} (rader) × {data.colAxisTitle} (kolonner). Klikk en
                celle for nivå 0–5 og valgfritt tekstnotat i samme popup. Ikon på cellen
                viser om det finnes notat. Lagre øverst for å skrive til server og
                loggføre nivåendringer.
              </CardDescription>
            </div>
            {matrix.length > 0 ? (
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="secondary" className="font-normal">
                  Høyeste nivå i matrise:{" "}
                  <span className="text-foreground font-semibold tabular-nums">
                    {matrixStats.max}
                  </span>
                </Badge>
                {matrixStats.highOrCritical > 0 ? (
                  <Badge
                    variant="outline"
                    className="border-orange-500/40 bg-orange-500/10 font-normal"
                  >
                    {matrixStats.highOrCritical} celle
                    {matrixStats.highOrCritical === 1 ? "" : "r"} med nivå 4–5
                  </Badge>
                ) : (
                  <Badge variant="outline" className="font-normal">
                    Ingen celler på nivå 4–5
                  </Badge>
                )}
              </div>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {matrix.length > 0 ? (
            <RosMatrix
              rowAxisTitle={data.rowAxisTitle}
              colAxisTitle={data.colAxisTitle}
              rowLabels={data.rowLabels}
              colLabels={data.colLabels}
              matrixValues={matrix}
              cellNotes={cellNotes}
              onCellNoteChange={onCellNoteChange}
              onCellChange={onCellChange}
              jumpRequest={jumpRequest}
              onJumpHandled={() => setJumpRequest(null)}
            />
          ) : null}
        </CardContent>
      </Card>

      <RosJournalPanel
        analysisId={analysisId}
        rowLabels={data.rowLabels}
        colLabels={data.colLabels}
        onJumpToCell={handleJumpToCell}
      />
    </div>
  );
}

function TaskEditForm({
  task,
  members,
  onCancel,
  onSave,
}: {
  task: {
    _id: Id<"rosTasks">;
    title: string;
    description?: string;
    assigneeUserId?: Id<"users">;
    priority?: number;
    dueAt?: number;
  };
  members: Array<{
    userId: Id<"users">;
    name?: string | null;
    email?: string | null;
  }>;
  onCancel: () => void;
  onSave: (patch: {
    title: string;
    description: string | null;
    assigneeUserId: Id<"users"> | null;
    priority: number;
    dueAt: number | null;
  }) => Promise<void>;
}) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [assigneeUserId, setAssigneeUserId] = useState<
    Id<"users"> | ""
  >(task.assigneeUserId ?? "");
  const [priority, setPriority] = useState(task.priority ?? 3);
  const [dueAt, setDueAt] = useState(
    task.dueAt
      ? new Date(task.dueAt).toISOString().slice(0, 16)
      : "",
  );
  const [busy, setBusy] = useState(false);

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label>Tittel</Label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Beskrivelse</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Tildelt</Label>
          <select
            className="border-input bg-background flex h-10 w-full rounded-lg border px-2 text-sm"
            value={assigneeUserId}
            onChange={(e) =>
              setAssigneeUserId(
                e.target.value === ""
                  ? ""
                  : (e.target.value as Id<"users">),
              )
            }
          >
            <option value="">— Ikke tildelt —</option>
            {members.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.name ?? m.email ?? m.userId}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>Prioritet (1–5)</Label>
          <Input
            type="number"
            min={1}
            max={5}
            value={priority}
            onChange={(e) =>
              setPriority(
                Math.min(5, Math.max(1, Number(e.target.value) || 3)),
              )
            }
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Frist (valgfritt)</Label>
        <Input
          type="datetime-local"
          value={dueAt}
          onChange={(e) => setDueAt(e.target.value)}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={busy || !title.trim()}
          onClick={() => {
            setBusy(true);
            const dueMs =
              dueAt === ""
                ? null
                : new Date(dueAt).getTime();
            void onSave({
              title: title.trim(),
              description: description.trim() || null,
              assigneeUserId:
                assigneeUserId === "" ? null : assigneeUserId,
              priority,
              dueAt: dueMs,
            }).finally(() => setBusy(false));
          }}
        >
          Lagre
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Avbryt
        </Button>
      </div>
    </div>
  );
}
