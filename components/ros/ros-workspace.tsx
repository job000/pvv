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
  DEFAULT_ROS_COL_LABELS,
  DEFAULT_ROS_ROW_AXIS,
  DEFAULT_ROS_ROW_LABELS,
} from "@/lib/ros-defaults";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import { RosDashboardPanel } from "@/components/ros/ros-dashboard-panel";
import { RosMethodologyGuide } from "@/components/ros/ros-methodology-guide";
import { RosWorkspaceHub } from "@/components/ros/ros-workspace-hub";
import {
  RosTemplatePreviewMini,
} from "@/components/ros/ros-template-preview";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import { ROS_TEMPLATE_PRESETS, presetToFormState } from "@/lib/ros-template-presets";
import {
  BarChart3,
  ClipboardList,
  Grid3x3,
  HelpCircle,
  Info,
  LayoutGrid,
  Plus,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type Tab = "maler" | "analyser" | "oversikt";

function RosFlowStrip({ tab }: { tab: Tab }) {
  const steps = [
    {
      id: "maler" as const,
      n: 1,
      label: "Maler",
      hint: "Definer akser og spørsmål (rader × kolonner)",
    },
    {
      id: "analyser" as const,
      n: 2,
      label: "Analyser",
      hint: "Koble prosess og PVV, fyll fargekodet matrise",
    },
    {
      id: "oversikt" as const,
      n: 3,
      label: "Oversikt",
      hint: "Dashboard, søyler og sammenligning",
    },
  ];
  const activeIdx = steps.findIndex((s) => s.id === tab);
  return (
    <div className="border-border/60 bg-muted/15 rounded-2xl border p-4">
      <p className="text-muted-foreground mb-3 text-xs font-medium tracking-wide uppercase">
        Arbeidsflyt
      </p>
      <ol className="flex list-none flex-row flex-nowrap items-start gap-0 overflow-x-auto pb-1 pl-0 [scrollbar-width:thin]">
        {steps.map((s, i) => {
          const active = tab === s.id;
          const done = activeIdx > i;
          return (
            <li
              key={s.id}
              className="flex shrink-0 flex-row items-start"
            >
              <div className="flex min-w-[min(260px,78vw)] max-w-[280px] flex-row items-start gap-3 pr-1 sm:min-w-[200px] sm:max-w-none">
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold tabular-nums",
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : done
                        ? "bg-emerald-500/20 text-emerald-800 dark:text-emerald-200"
                        : "bg-muted text-muted-foreground",
                  )}
                >
                  {done ? "✓" : s.n}
                </span>
                <div className="min-w-0">
                  <p
                    className={cn(
                      "font-medium leading-tight",
                      active && "text-foreground",
                    )}
                  >
                    {s.label}
                  </p>
                  <p className="text-muted-foreground mt-0.5 text-xs leading-snug">
                    {s.hint}
                  </p>
                </div>
              </div>
              {i < steps.length - 1 ? (
                <div
                  className="text-muted-foreground/45 flex shrink-0 items-center self-center px-2 pt-1"
                  aria-hidden
                >
                  →
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

type AnalysisSort = "updated" | "title" | "candidate";

export function RosWorkspace({ workspaceId }: { workspaceId: Id<"workspaces"> }) {
  const templates = useQuery(api.ros.listTemplates, { workspaceId });
  const analyses = useQuery(api.ros.listAnalyses, { workspaceId });
  const hub = useQuery(api.ros.workspaceHub, { workspaceId });
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
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  /** Når true: tittel på ny analyse oppdateres automatisk fra valgt kandidat */
  const [anaTitleAuto, setAnaTitleAuto] = useState(true);
  const [analysisSearch, setAnalysisSearch] = useState("");
  const [analysisSort, setAnalysisSort] = useState<AnalysisSort>("updated");

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

  const previewRowLabels = useMemo(() => {
    const rowLabels = tplRows
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    if (rowLabels.length >= 2) return rowLabels;
    return [...DEFAULT_ROS_ROW_LABELS];
  }, [tplRows]);

  const previewColLabels = useMemo(() => {
    const colLabels = tplCols
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    if (colLabels.length >= 2) return colLabels;
    return [...DEFAULT_ROS_COL_LABELS];
  }, [tplCols]);

  const selectedTemplateForAnalysis = useMemo(
    () => (templates ?? []).find((t) => t._id === anaTemplateId),
    [templates, anaTemplateId],
  );

  const filteredSortedAnalyses = useMemo(() => {
    const list = analyses ?? [];
    const q = analysisSearch.trim().toLowerCase();
    const filtered = q
      ? list.filter((a) => {
          const blob = `${a.title} ${a.candidateName} ${a.candidateCode}`.toLowerCase();
          return blob.includes(q);
        })
      : [...list];
    const rows = [...filtered];
    if (analysisSort === "title") {
      rows.sort((a, b) =>
        a.title.localeCompare(b.title, "nb", { sensitivity: "base" }),
      );
    } else if (analysisSort === "candidate") {
      rows.sort((a, b) =>
        a.candidateName.localeCompare(b.candidateName, "nb", {
          sensitivity: "base",
        }),
      );
    } else {
      rows.sort((a, b) => b.updatedAt - a.updatedAt);
    }
    return rows;
  }, [analyses, analysisSearch, analysisSort]);

  const startAnalysisForCandidate = useCallback(
    (candidateId: Id<"candidates">) => {
      setTab("analyser");
      setAnaCandidateId(candidateId);
      setSelectedAssessmentIds([]);
      setExtraAssessmentPickerKey((k) => k + 1);
      setAnaTitleAuto(true);
      if (templates && templates.length === 1) {
        setAnaTemplateId(templates[0]!._id);
      } else if (hub?.defaultTemplateId) {
        setAnaTemplateId(hub.defaultTemplateId);
      }
    },
    [templates, hub?.defaultTemplateId],
  );

  const openNewTemplateDialog = useCallback(() => {
    resetTemplateForm();
    setTemplateDialogOpen(true);
  }, [resetTemplateForm]);

  useEffect(() => {
    if (!anaTitleAuto || !anaCandidateId || !candidates) return;
    const c = candidates.find((x) => x._id === anaCandidateId);
    if (!c) return;
    setAnaTitle(`ROS — ${c.name} (${c.code})`);
  }, [anaTitleAuto, anaCandidateId, candidates]);

  /** Én mal i arbeidsområdet → forhåndsvelg (mindre friksjon for store organisasjoner). */
  useEffect(() => {
    if (templates === undefined || templates.length !== 1) return;
    setAnaTemplateId((prev) =>
      prev === "" ? templates[0]!._id : prev,
    );
  }, [templates]);

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
      setTemplateDialogOpen(false);
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

  if (
    (tab === "maler" || tab === "analyser") &&
    (templates === undefined || analyses === undefined)
  ) {
    return (
      <p className="text-muted-foreground text-sm">Henter ROS-data …</p>
    );
  }

  const templatesList = templates ?? [];
  const analysesList = analyses ?? [];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-2 rounded-2xl border border-border/60 bg-muted/20 p-1">
        {(
          [
            ["maler", "Maler", Grid3x3],
            ["analyser", "ROS-analyser", ClipboardList],
            ["oversikt", "Oversikt", BarChart3],
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

      <RosWorkspaceHub
        workspaceId={workspaceId}
        hub={hub}
        activeTab={tab}
        onTab={setTab}
        onStartAnalysisForCandidate={startAnalysisForCandidate}
        onOpenTemplateDialog={openNewTemplateDialog}
      />

      <RosFlowStrip tab={tab} />

      <RosMethodologyGuide workspaceId={workspaceId} variant="compact" />

      {tab === "oversikt" ? (
        <RosDashboardPanel workspaceId={workspaceId} />
      ) : tab === "maler" ? (
        <div className="space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-heading text-lg font-semibold">
                Gjenbrukbare maler
              </h2>
              <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-relaxed">
                Hver mal definerer rader og kolonner (typisk sannsynlighet ×
                konsekvens). Analyser kopierer strukturen. Bruk veiledningen i
                dialogen for hurtigstart og fargeforhåndsvisning.
              </p>
            </div>
            <Button
              type="button"
              className="shrink-0 gap-2"
              onClick={() => {
                openNewTemplateDialog();
              }}
            >
              <LayoutGrid className="size-4" aria-hidden />
              Ny mal
            </Button>
          </div>

          {templatesList.length === 0 ? (
            <div className="rounded-2xl border border-dashed bg-muted/10 py-12 text-center">
              <p className="text-muted-foreground text-sm">
                Ingen maler ennå.
              </p>
              <Button
                type="button"
                variant="secondary"
                className="mt-4 gap-2"
                onClick={() => {
                  openNewTemplateDialog();
                }}
              >
                <Sparkles className="size-4" aria-hidden />
                Opprett første mal med veiledning
              </Button>
            </div>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {templatesList.map((t) => (
                <li key={t._id}>
                  <Card className="flex h-full flex-col overflow-hidden border-border/70 shadow-sm transition-shadow hover:shadow-md">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">{t.name}</CardTitle>
                      <CardDescription className="line-clamp-2 text-xs">
                        {t.description || "Ingen beskrivelse"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-1 flex-col gap-3 text-xs">
                      <RosTemplatePreviewMini
                        rowLabels={t.rowLabels}
                        colLabels={t.colLabels}
                        className="shrink-0"
                      />
                      <p className="text-muted-foreground">
                        {t.rowLabels.length} × {t.colLabels.length} ·{" "}
                        {t.rowAxisTitle} / {t.colAxisTitle}
                      </p>
                    </CardContent>
                    <CardFooter className="mt-auto flex flex-wrap gap-2 border-t pt-3">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          loadTemplateForEdit(t);
                          setTemplateDialogOpen(true);
                        }}
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

          <Dialog
            open={templateDialogOpen}
            onOpenChange={(open) => {
              setTemplateDialogOpen(open);
              if (!open) resetTemplateForm();
            }}
          >
            <DialogContent
              size="2xl"
              titleId="ros-tpl-dialog-title"
              descriptionId="ros-tpl-dialog-desc"
            >
              <DialogHeader>
                <p
                  id="ros-tpl-dialog-title"
                  className="font-heading text-lg font-semibold"
                >
                  {editingId ? "Rediger mal" : "Ny ROS-mal"}
                </p>
                <p
                  id="ros-tpl-dialog-desc"
                  className="text-muted-foreground text-sm leading-relaxed"
                >
                  {defaultLabelsHint} Fargene i forhåndsvisningen følger
                  risikonivå 1–5 (grønn → rød).
                </p>
              </DialogHeader>
              <DialogBody>
                <form
                  id="ros-template-form"
                  onSubmit={(e) => void submitTemplate(e)}
                  className="space-y-4"
                >
                  <div className="flex flex-wrap gap-2">
                    <p className="text-muted-foreground w-full text-xs font-medium">
                      Hurtigstart
                    </p>
                    {ROS_TEMPLATE_PRESETS.map((p) => (
                      <Button
                        key={p.id}
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-auto min-h-9 flex-col items-start gap-0.5 py-2 text-left"
                        onClick={() => {
                          const s = presetToFormState(p);
                          setTplRowAxis(s.tplRowAxis);
                          setTplColAxis(s.tplColAxis);
                          setTplRows(s.tplRows);
                          setTplCols(s.tplCols);
                        }}
                      >
                        <span className="font-medium">{p.name}</span>
                        <span className="text-muted-foreground max-w-[14rem] text-[11px] font-normal leading-snug">
                          {p.description}
                        </span>
                      </Button>
                    ))}
                  </div>

                  <details className="border-border/60 bg-muted/15 rounded-xl border px-3 py-2">
                    <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium [&::-webkit-details-marker]:hidden">
                      <HelpCircle className="text-muted-foreground size-4" />
                      Hva er rader og kolonner?
                    </summary>
                    <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
                      <strong className="text-foreground">Rader</strong> er ofte
                      sannsynlighet eller sannsynlig utfall.{" "}
                      <strong className="text-foreground">Kolonner</strong> er
                      ofte konsekvens eller påvirkning. Du kan bruke egne
                      betegnelser — det viktige er at teamet forstår skalaen.
                      Celleverdier 0–5 i analysen angir risiko etter at mal er
                      lagret.
                    </p>
                  </details>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="tpl-name">Navn på mal</Label>
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
                        <Label htmlFor="tpl-rows">
                          Etiketter rader (én per linje)
                        </Label>
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
                        <Label htmlFor="tpl-cols">
                          Etiketter kolonner (én per linje)
                        </Label>
                        <Textarea
                          id="tpl-cols"
                          value={tplCols}
                          onChange={(e) => setTplCols(e.target.value)}
                          rows={5}
                          placeholder="Tom = standard 5 nivåer"
                          className="font-mono text-xs"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-muted-foreground text-xs uppercase tracking-wide">
                        Forhåndsvisning (farger)
                      </Label>
                      <RosTemplatePreviewMini
                        rowLabels={previewRowLabels}
                        colLabels={previewColLabels}
                      />
                    </div>
                  </div>
                </form>
              </DialogBody>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    resetTemplateForm();
                    setTemplateDialogOpen(false);
                  }}
                >
                  Avbryt
                </Button>
                <Button
                  type="submit"
                  form="ros-template-form"
                  disabled={busy || !tplName.trim()}
                >
                  {busy
                    ? "Lagrer …"
                    : editingId
                      ? "Lagre endringer"
                      : "Opprett mal"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
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
            {analysesList.length > 0 ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
                <div className="relative min-w-[12rem] flex-1">
                  <Search className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" />
                  <Input
                    type="search"
                    value={analysisSearch}
                    onChange={(e) => setAnalysisSearch(e.target.value)}
                    placeholder="Søk i tittel eller prosess …"
                    className="pl-9"
                    aria-label="Filtrer analyser"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="ros-ana-sort" className="text-muted-foreground shrink-0 text-xs">
                    Sorter
                  </Label>
                  <select
                    id="ros-ana-sort"
                    className="border-input bg-background flex h-10 rounded-lg border px-2 text-sm"
                    value={analysisSort}
                    onChange={(e) =>
                      setAnalysisSort(e.target.value as AnalysisSort)
                    }
                  >
                    <option value="updated">Sist oppdatert</option>
                    <option value="title">Tittel A–Å</option>
                    <option value="candidate">Prosess</option>
                  </select>
                </div>
              </div>
            ) : null}
            {analysesList.length === 0 ? (
              <p className="text-muted-foreground rounded-xl border border-dashed py-8 text-center text-sm leading-relaxed">
                Ingen analyser ennå. Du trenger minst én{" "}
                <strong>mal</strong> og én <strong>kandidat</strong> (prosess)
                — opprett kandidater under{" "}
                <Link
                  href={`/w/${workspaceId}/vurderinger?fane=prosesser`}
                  className="text-primary font-medium underline-offset-4 hover:underline"
                >
                  Kandidater
                </Link>
                , deretter fyll ut skjemaet (på store skjermer til høyre, på
                mobil under).
              </p>
            ) : filteredSortedAnalyses.length === 0 ? (
              <p className="text-muted-foreground rounded-xl border border-dashed py-8 text-center text-sm">
                Ingen analyser matcher søket.{" "}
                <button
                  type="button"
                  className="text-primary font-medium underline-offset-4 hover:underline"
                  onClick={() => setAnalysisSearch("")}
                >
                  Nullstill filter
                </button>
              </p>
            ) : (
              <ul className="space-y-2">
                {filteredSortedAnalyses.map((a) => (
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
                {templatesList.length === 0 ? (
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
                        href={`/w/${workspaceId}/vurderinger?fane=prosesser`}
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
                    {templatesList.map((t) => (
                      <option key={t._id} value={t._id}>
                        {t.name} ({t.rowLabels.length}×{t.colLabels.length})
                      </option>
                    ))}
                  </select>
                  {selectedTemplateForAnalysis ? (
                    <div className="pt-1">
                      <p className="text-muted-foreground mb-1 text-[11px] font-medium uppercase tracking-wide">
                        Malens rutenett
                      </p>
                      <RosTemplatePreviewMini
                        rowLabels={selectedTemplateForAnalysis.rowLabels}
                        colLabels={selectedTemplateForAnalysis.colLabels}
                      />
                    </div>
                  ) : null}
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
                      setAnaTitleAuto(true);
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
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Label>PVV som matcher kandidaten (valgfritt)</Label>
                        {(matchingAssessments ?? []).length > 0 ? (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() =>
                              setSelectedAssessmentIds((prev) => {
                                const s = new Set(
                                  (matchingAssessments ?? []).map((x) => x._id),
                                );
                                for (const id of prev) s.add(id);
                                return [...s];
                              })
                            }
                          >
                            Koble alle som matcher
                          </Button>
                        ) : null}
                      </div>
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
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Label htmlFor="ana-title">Tittel på analysen</Label>
                    {anaCandidateId && candidates ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground h-7 text-xs"
                        onClick={() => {
                          const c = candidates.find(
                            (x) => x._id === anaCandidateId,
                          );
                          if (c) {
                            setAnaTitle(`ROS — ${c.name} (${c.code})`);
                            setAnaTitleAuto(true);
                          }
                        }}
                      >
                        Fyll fra kandidat
                      </Button>
                    ) : null}
                  </div>
                  <Input
                    id="ana-title"
                    value={anaTitle}
                    onChange={(e) => {
                      setAnaTitle(e.target.value);
                      setAnaTitleAuto(false);
                    }}
                    placeholder="Fylles automatisk fra kandidat — eller skriv egen"
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
                    templatesList.length === 0 ||
                    (candidates?.length ?? 0) === 0
                  }
                >
                  Opprett og åpne matrise
                </Button>
                {(candidates?.length ?? 0) === 0 ||
                templatesList.length === 0 ? (
                  <p className="text-muted-foreground pt-1 text-center text-[11px]">
                    {[
                      (candidates?.length ?? 0) === 0
                        ? "Opprett kandidat før knappen aktiveres."
                        : null,
                      templatesList.length === 0
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
