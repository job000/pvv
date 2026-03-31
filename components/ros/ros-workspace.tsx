"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  DEFAULT_ROS_COL_AXIS,
  DEFAULT_ROS_ROW_AXIS,
} from "@/lib/ros-defaults";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import {
  ClipboardList,
  Grid3x3,
  Info,
  Plus,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

type Tab = "maler" | "analyser";

export function RosWorkspace({ workspaceId }: { workspaceId: Id<"workspaces"> }) {
  const templates = useQuery(api.ros.listTemplates, { workspaceId });
  const analyses = useQuery(api.ros.listAnalyses, { workspaceId });
  const candidates = useQuery(api.candidates.listByWorkspace, { workspaceId });

  const createTemplate = useMutation(api.ros.createTemplate);
  const updateTemplate = useMutation(api.ros.updateTemplate);
  const removeTemplate = useMutation(api.ros.removeTemplate);
  const createAnalysis = useMutation(api.ros.createAnalysis);

  const [tab, setTab] = useState<Tab>("maler");
  const [busy, setBusy] = useState(false);

  const [tplName, setTplName] = useState("");
  const [tplDesc, setTplDesc] = useState("");
  const [tplRows, setTplRows] = useState("");
  const [tplCols, setTplCols] = useState("");
  const [tplRowAxis, setTplRowAxis] = useState(DEFAULT_ROS_ROW_AXIS);
  const [tplColAxis, setTplColAxis] = useState(DEFAULT_ROS_COL_AXIS);
  const [editingId, setEditingId] = useState<Id<"rosTemplates"> | null>(null);

  const [anaTitle, setAnaTitle] = useState("");
  const [anaTemplateId, setAnaTemplateId] = useState<Id<"rosTemplates"> | "">("");
  const [anaCandidateId, setAnaCandidateId] = useState<Id<"candidates"> | "">(
    "",
  );
  /** Valgte PVV-koblinger (mange-til-mange) */
  const [selectedAssessmentIds, setSelectedAssessmentIds] = useState<
    Id<"assessments">[]
  >([]);
  const [extraAssessmentPickerKey, setExtraAssessmentPickerKey] = useState(0);

  const matchingAssessments = useQuery(
    api.ros.listMatchingAssessments,
    anaCandidateId
      ? { workspaceId, candidateId: anaCandidateId }
      : "skip",
  );
  const allWorkspaceAssessments = useQuery(
    api.ros.listAssessmentsForWorkspace,
    tab === "analyser" ? { workspaceId } : "skip",
  );

  const toggleAssessment = useCallback((id: Id<"assessments">) => {
    setSelectedAssessmentIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);

  const addAssessmentFromList = useCallback((id: Id<"assessments">) => {
    setSelectedAssessmentIds((prev) =>
      prev.includes(id) ? prev : [...prev, id],
    );
    setExtraAssessmentPickerKey((k) => k + 1);
  }, []);

  const resetTemplateForm = useCallback(() => {
    setTplName("");
    setTplDesc("");
    setTplRows("");
    setTplCols("");
    setTplRowAxis(DEFAULT_ROS_ROW_AXIS);
    setTplColAxis(DEFAULT_ROS_COL_AXIS);
    setEditingId(null);
  }, []);

  const loadTemplateForEdit = useCallback(
    (t: {
      _id: Id<"rosTemplates">;
      name: string;
      description?: string;
      rowAxisTitle: string;
      colAxisTitle: string;
      rowLabels: string[];
      colLabels: string[];
    }) => {
      setEditingId(t._id);
      setTplName(t.name);
      setTplDesc(t.description ?? "");
      setTplRowAxis(t.rowAxisTitle);
      setTplColAxis(t.colAxisTitle);
      setTplRows(t.rowLabels.join("\n"));
      setTplCols(t.colLabels.join("\n"));
    },
    [],
  );

  const defaultLabelsHint = useMemo(
    () =>
      "Én etikett per linje. La feltet stå tomt for standard 5×5 (sannsynlighet × konsekvens).",
    [],
  );

  async function submitTemplate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const rowLabels = tplRows
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      const colLabels = tplCols
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      const useDefault =
        !editingId && rowLabels.length === 0 && colLabels.length === 0;
      if (!useDefault) {
        if (rowLabels.length < 2 || colLabels.length < 2) {
          window.alert(
            "Minst to etiketter for både rader og kolonner — eller la begge felt stå tomme for standard 5×5 ved ny mal.",
          );
          return;
        }
      }
      if (editingId) {
        await updateTemplate({
          templateId: editingId,
          name: tplName.trim(),
          description: tplDesc.trim() || null,
          rowAxisTitle: tplRowAxis.trim(),
          colAxisTitle: tplColAxis.trim(),
          rowLabels,
          colLabels,
        });
      } else {
        await createTemplate({
          workspaceId,
          name: tplName.trim(),
          description: tplDesc.trim() || undefined,
          rowAxisTitle: tplRowAxis.trim(),
          colAxisTitle: tplColAxis.trim(),
          rowLabels: useDefault ? undefined : rowLabels,
          colLabels: useDefault ? undefined : colLabels,
        });
      }
      resetTemplateForm();
    } finally {
      setBusy(false);
    }
  }

  async function submitAnalysis(e: React.FormEvent) {
    e.preventDefault();
    if (!anaTemplateId || !anaCandidateId || !anaTitle.trim()) return;
    setBusy(true);
    try {
      const id = await createAnalysis({
        workspaceId,
        templateId: anaTemplateId,
        candidateId: anaCandidateId,
        title: anaTitle.trim(),
        assessmentIds:
          selectedAssessmentIds.length > 0
            ? selectedAssessmentIds
            : undefined,
      });
      window.location.href = `/w/${workspaceId}/ros/a/${id}`;
    } finally {
      setBusy(false);
    }
  }

  if (templates === undefined || analyses === undefined) {
    return (
      <p className="text-muted-foreground text-sm">Henter ROS-maler …</p>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-2 rounded-2xl border border-border/60 bg-muted/20 p-1">
        {(
          [
            ["maler", "Maler", Grid3x3],
            ["analyser", "ROS-analyser", ClipboardList],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all sm:flex-initial sm:justify-start",
              tab === id
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </button>
        ))}
      </div>

      {tab === "maler" ? (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
          <div className="space-y-4">
            <h2 className="font-heading text-lg font-semibold">
              Gjenbrukbare maler
            </h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Hver mal definerer rader (typisk sannsynlighet) og kolonner
              (typisk konsekvens). Analyser kopierer strukturen slik at maler kan
              endres uten å ødelegge eldre analyser.
            </p>
            {templates.length === 0 ? (
              <p className="text-muted-foreground rounded-xl border border-dashed py-8 text-center text-sm">
                Ingen maler ennå — bruk skjemaet til høyre for å opprette en
                standard 5×5 eller tilpasset matrise.
              </p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {templates.map((t) => (
                  <li key={t._id}>
                    <Card className="h-full border-border/70 shadow-sm transition-shadow hover:shadow-md">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">{t.name}</CardTitle>
                        <CardDescription className="line-clamp-2 text-xs">
                          {t.description || "Ingen beskrivelse"}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="text-muted-foreground text-xs">
                        {t.rowLabels.length} × {t.colLabels.length} ·{" "}
                        {t.rowAxisTitle} / {t.colAxisTitle}
                      </CardContent>
                      <CardFooter className="flex flex-wrap gap-2 border-t pt-3">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => loadTemplateForEdit(t)}
                        >
                          Rediger
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => {
                            if (
                              typeof window !== "undefined" &&
                              window.confirm(
                                "Slette denne malen? Eksisterende analyser beholder sin kopi.",
                              )
                            ) {
                              void removeTemplate({ templateId: t._id });
                            }
                          }}
                        >
                          <Trash2 className="size-3.5" />
                          Slett
                        </Button>
                      </CardFooter>
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Card className="border-primary/20 bg-gradient-to-b from-primary/[0.04] to-card shadow-md">
            <CardHeader>
              <CardTitle className="text-base">
                {editingId ? "Rediger mal" : "Ny mal"}
              </CardTitle>
              <CardDescription className="text-xs leading-relaxed">
                {defaultLabelsHint}
              </CardDescription>
            </CardHeader>
            <form onSubmit={(e) => void submitTemplate(e)}>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="tpl-name">Navn</Label>
                  <Input
                    id="tpl-name"
                    value={tplName}
                    onChange={(e) => setTplName(e.target.value)}
                    placeholder="F.eks. Standard ROS 5×5"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tpl-desc">Beskrivelse (valgfritt)</Label>
                  <Textarea
                    id="tpl-desc"
                    value={tplDesc}
                    onChange={(e) => setTplDesc(e.target.value)}
                    rows={2}
                    className="min-h-0 resize-y"
                  />
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="tpl-row-axis">Akse rader</Label>
                    <Input
                      id="tpl-row-axis"
                      value={tplRowAxis}
                      onChange={(e) => setTplRowAxis(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="tpl-col-axis">Akse kolonner</Label>
                    <Input
                      id="tpl-col-axis"
                      value={tplColAxis}
                      onChange={(e) => setTplColAxis(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tpl-rows">Etiketter rader (én per linje)</Label>
                  <Textarea
                    id="tpl-rows"
                    value={tplRows}
                    onChange={(e) => setTplRows(e.target.value)}
                    rows={5}
                    placeholder="Tom = standard 5 nivåer"
                    className="font-mono text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tpl-cols">Etiketter kolonner (én per linje)</Label>
                  <Textarea
                    id="tpl-cols"
                    value={tplCols}
                    onChange={(e) => setTplCols(e.target.value)}
                    rows={5}
                    placeholder="Tom = standard 5 nivåer"
                    className="font-mono text-xs"
                  />
                </div>
              </CardContent>
              <CardFooter className="flex flex-wrap gap-2 border-t">
                <Button type="submit" disabled={busy || !tplName.trim()}>
                  {editingId ? "Lagre endringer" : "Opprett mal"}
                </Button>
                {editingId ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={resetTemplateForm}
                  >
                    Avbryt
                  </Button>
                ) : null}
              </CardFooter>
            </form>
          </Card>
        </div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
          <div className="space-y-4">
            <h2 className="font-heading text-lg font-semibold">
              Dine ROS-analyser
            </h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Hver analyse er koblet til en <strong>kandidat</strong> (prosess).
              Du kan koble <strong>én eller flere PVV-vurderinger</strong>{" "}
              (matcher kandidatkode og/eller andre i arbeidsområdet).
            </p>
            {analyses.length === 0 ? (
              <p className="text-muted-foreground rounded-xl border border-dashed py-8 text-center text-sm leading-relaxed">
                Ingen analyser ennå. Du trenger minst én{" "}
                <strong>mal</strong> og én <strong>kandidat</strong> (prosess)
                — opprett kandidater under{" "}
                <Link
                  href={`/w/${workspaceId}/kandidater`}
                  className="text-primary font-medium underline-offset-4 hover:underline"
                >
                  Kandidater
                </Link>
                , deretter fyll ut skjemaet (på store skjermer til høyre, på
                mobil under).
              </p>
            ) : (
              <ul className="space-y-2">
                {analyses.map((a) => (
                  <li key={a._id}>
                    <Link
                      href={`/w/${workspaceId}/ros/a/${a._id}`}
                      className="hover:border-primary/30 flex flex-col gap-1 rounded-xl border bg-card p-4 shadow-sm transition-all hover:shadow-md sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="font-medium">{a.title}</p>
                        <p className="text-muted-foreground text-xs">
                          {a.candidateName}{" "}
                          <span className="font-mono">({a.candidateCode})</span>
                          {" · "}
                          {a.rowLabels.length}×{a.colLabels.length}
                        </p>
                      </div>
                      <span className="text-primary text-sm font-medium">
                        Åpne →
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Card className="h-fit border-emerald-500/20 bg-gradient-to-b from-emerald-500/[0.05] to-card shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Plus className="size-4" />
                Ny ROS-analyse
              </CardTitle>
              <CardDescription className="text-xs">
                Velg mal og kandidat. Kryss av PVV som matcher kandidaten, eller
                legg til flere fra hele arbeidsområdet.
              </CardDescription>
            </CardHeader>
            <form onSubmit={(e) => void submitAnalysis(e)}>
              <CardContent className="space-y-3">
                {templates.length === 0 ? (
                  <Alert className="border-amber-500/35 bg-amber-500/[0.06]">
                    <Info className="text-amber-700 dark:text-amber-400" />
                    <AlertTitle>Ingen ROS-mal</AlertTitle>
                    <AlertDescription>
                      Opprett først en mal under fanen{" "}
                      <button
                        type="button"
                        className="text-primary font-medium underline underline-offset-4"
                        onClick={() => setTab("maler")}
                      >
                        Maler
                      </button>
                      .
                    </AlertDescription>
                  </Alert>
                ) : null}
                {candidates !== undefined && candidates.length === 0 ? (
                  <Alert className="border-amber-500/35 bg-amber-500/[0.06]">
                    <Info className="text-amber-700 dark:text-amber-400" />
                    <AlertTitle>Ingen kandidat å koble til</AlertTitle>
                    <AlertDescription>
                      ROS-analyse må knyttes til en <strong>kandidat</strong>{" "}
                      (PVV-prosess). Opprett minst én under{" "}
                      <Link
                        href={`/w/${workspaceId}/kandidater`}
                        className="text-primary font-medium"
                      >
                        Kandidater
                      </Link>
                      . Når den finnes, velger du den i listen under — deretter
                      kan du eventuelt koble PVV-vurderinger.
                    </AlertDescription>
                  </Alert>
                ) : null}
                <div className="space-y-1.5">
                  <Label htmlFor="ana-tpl">Mal</Label>
                  <select
                    id="ana-tpl"
                    className="border-input bg-background flex h-10 w-full rounded-lg border px-2 text-sm"
                    value={anaTemplateId}
                    onChange={(e) =>
                      setAnaTemplateId(
                        e.target.value === ""
                          ? ""
                          : (e.target.value as Id<"rosTemplates">),
                      )
                    }
                    required
                  >
                    <option value="">— Velg mal —</option>
                    {templates.map((t) => (
                      <option key={t._id} value={t._id}>
                        {t.name} ({t.rowLabels.length}×{t.colLabels.length})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ana-cand">Kandidat (PVV-prosess)</Label>
                  <select
                    id="ana-cand"
                    className="border-input bg-background flex h-10 w-full rounded-lg border px-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                    value={anaCandidateId}
                    disabled={
                      candidates === undefined ||
                      candidates.length === 0
                    }
                    onChange={(e) => {
                      setAnaCandidateId(
                        e.target.value === ""
                          ? ""
                          : (e.target.value as Id<"candidates">),
                      );
                      setSelectedAssessmentIds([]);
                      setExtraAssessmentPickerKey((k) => k + 1);
                    }}
                    required
                  >
                    <option value="">
                      {candidates === undefined
                        ? "— Henter kandidater … —"
                        : candidates.length === 0
                          ? "— Ingen kandidater i arbeidsområdet —"
                          : "— Velg kandidat —"}
                    </option>
                    {(candidates ?? []).map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                  {candidates !== undefined &&
                  candidates.length > 0 &&
                  anaCandidateId === "" ? (
                    <p className="text-muted-foreground text-[11px] leading-snug">
                      Velg hvilken prosess denne ROS-en gjelder. PVV-koblinger
                      vises når du har valgt kandidat.
                    </p>
                  ) : null}
                </div>
                {anaCandidateId ? (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label>PVV som matcher kandidaten (valgfritt)</Label>
                      {(matchingAssessments ?? []).length === 0 ? (
                        <p className="text-muted-foreground text-xs">
                          Ingen vurderinger med samme referansekode som denne
                          kandidaten — bruk listen under for å koble PVV.
                        </p>
                      ) : (
                        <ul className="max-h-40 space-y-2 overflow-y-auto rounded-lg border p-2">
                          {(matchingAssessments ?? []).map((x) => (
                            <li
                              key={x._id}
                              className="flex items-center gap-2 text-sm"
                            >
                              <input
                                type="checkbox"
                                id={`ana-asm-${x._id}`}
                                checked={selectedAssessmentIds.includes(x._id)}
                                onChange={() => toggleAssessment(x._id)}
                                className="border-input size-4 rounded"
                              />
                              <label
                                htmlFor={`ana-asm-${x._id}`}
                                className="cursor-pointer leading-tight"
                              >
                                {x.title}
                              </label>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="ana-asm-extra">
                        Legg til annen PVV fra arbeidsområdet
                      </Label>
                      <select
                        key={extraAssessmentPickerKey}
                        id="ana-asm-extra"
                        className="border-input bg-background flex h-10 w-full rounded-lg border px-2 text-sm"
                        defaultValue=""
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v)
                            addAssessmentFromList(v as Id<"assessments">);
                        }}
                      >
                        <option value="">
                          {allWorkspaceAssessments === undefined
                            ? "— Henter vurderinger … —"
                            : "— Velg for å legge til —"}
                        </option>
                        {(allWorkspaceAssessments ?? [])
                          .filter((a) => !selectedAssessmentIds.includes(a._id))
                          .map((a) => (
                            <option key={a._id} value={a._id}>
                              {a.title}
                            </option>
                          ))}
                      </select>
                      {allWorkspaceAssessments !== undefined &&
                      allWorkspaceAssessments.length === 0 ? (
                        <p className="text-muted-foreground text-[11px] leading-snug">
                          Ingen PVV-vurderinger i arbeidsområdet ennå. Opprett
                          under{" "}
                          <Link
                            href={`/w/${workspaceId}/vurderinger`}
                            className="text-primary font-medium underline-offset-4 hover:underline"
                          >
                            Vurderinger
                          </Link>
                          .
                        </p>
                      ) : null}
                      {selectedAssessmentIds.length > 0 ? (
                        <ul className="text-muted-foreground flex flex-wrap gap-1 text-xs">
                          {selectedAssessmentIds.map((id) => {
                            const title =
                              (allWorkspaceAssessments ?? []).find(
                                (a) => a._id === id,
                              )?.title ??
                              (matchingAssessments ?? []).find(
                                (a) => a._id === id,
                              )?.title ??
                              id;
                            return (
                              <li
                                key={id}
                                className="bg-muted inline-flex items-center gap-1 rounded-full px-2 py-0.5"
                              >
                                <span className="max-w-[14rem] truncate">
                                  {title}
                                </span>
                                <button
                                  type="button"
                                  className="text-destructive hover:underline"
                                  onClick={() => toggleAssessment(id)}
                                >
                                  ×
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      ) : null}
                    </div>
                  </div>
                ) : null}
                <div className="space-y-1.5">
                  <Label htmlFor="ana-title">Tittel på analysen</Label>
                  <Input
                    id="ana-title"
                    value={anaTitle}
                    onChange={(e) => setAnaTitle(e.target.value)}
                    placeholder="F.eks. ROS — fakturaflyt Q1"
                    required
                  />
                </div>
              </CardContent>
              <CardFooter className="border-t">
                <Button
                  type="submit"
                  className="w-full"
                  disabled={
                    busy ||
                    !anaTemplateId ||
                    !anaCandidateId ||
                    !anaTitle.trim() ||
                    templates.length === 0 ||
                    (candidates?.length ?? 0) === 0
                  }
                >
                  Opprett og åpne matrise
                </Button>
                {(candidates?.length ?? 0) === 0 ||
                templates.length === 0 ? (
                  <p className="text-muted-foreground pt-1 text-center text-[11px]">
                    {[
                      (candidates?.length ?? 0) === 0
                        ? "Opprett kandidat før knappen aktiveres."
                        : null,
                      templates.length === 0
                        ? "Opprett mal under fanen Maler først."
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  </p>
                ) : null}
              </CardFooter>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
