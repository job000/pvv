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
  positionRiskLevel,
} from "@/lib/ros-defaults";
import { toast } from "@/lib/app-toast";
import { cellRiskClass } from "@/lib/ros-risk-colors";
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
import { RosLabelLevelsEditor } from "@/components/ros/ros-label-levels-editor";
import { ROS_TEMPLATE_PRESETS, presetToFormState } from "@/lib/ros-template-presets";
import {
  ArrowRight,
  BarChart3,
  ClipboardList,
  Clock,
  Grid3x3,
  HelpCircle,
  Info,
  Plus,
  Search,
  Shield,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

function formatRelative(ts: number | undefined): string {
  if (!ts) return "—";
  const diff = Date.now() - ts;
  if (diff < 0) return "nå";
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "nå";
  if (mins < 60) return `${mins} min siden`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}t siden`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d siden`;
  try {
    return new Intl.DateTimeFormat("nb-NO", { dateStyle: "medium" }).format(new Date(ts));
  } catch {
    return "—";
  }
}

type Tab = "maler" | "analyser" | "oversikt";

const FLOW_STEPS = [
  { id: "maler" as const, n: 1, label: "Maler", icon: Grid3x3, hint: "Definer risikoakser" },
  { id: "analyser" as const, n: 2, label: "Analyser", icon: ClipboardList, hint: "Fyll risikomatrise" },
  { id: "oversikt" as const, n: 3, label: "Oversikt", icon: BarChart3, hint: "Dashboard og rapport" },
] as const;

function RosFlowNav({
  tab,
  onTab,
  counts,
}: {
  tab: Tab;
  onTab: (t: Tab) => void;
  counts?: { maler: number; analyser: number };
}) {
  const activeIdx = FLOW_STEPS.findIndex((s) => s.id === tab);
  return (
    <div className="space-y-1">
      <nav className="flex items-stretch gap-1 rounded-2xl border border-border/60 bg-muted/20 p-1" role="tablist">
        {FLOW_STEPS.map((s, i) => {
          const active = tab === s.id;
          const done = activeIdx > i;
          const Icon = s.icon;
          const count =
            s.id === "maler" ? counts?.maler : s.id === "analyser" ? counts?.analyser : undefined;
          return (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onTab(s.id)}
              className={cn(
                "group relative flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-all sm:justify-start sm:px-4",
                active
                  ? "bg-card text-foreground shadow-sm ring-1 ring-border/50"
                  : "text-muted-foreground hover:bg-card/50 hover:text-foreground",
              )}
            >
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold tabular-nums transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : done
                      ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                      : "bg-muted text-muted-foreground group-hover:bg-muted/80",
                )}
              >
                {done ? "✓" : s.n}
              </span>
              <span className="hidden sm:inline">{s.label}</span>
              <Icon className="size-4 sm:hidden" aria-hidden />
              {count !== undefined && count > 0 ? (
                <span className="ml-auto hidden rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground sm:inline">
                  {count}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>
      <div className="flex items-center justify-center gap-1 px-2 text-[11px] text-muted-foreground">
        <span>{FLOW_STEPS[activeIdx]?.hint}</span>
      </div>
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
  const removeAnalysis = useMutation(api.ros.removeAnalysis);

  const searchParams = useSearchParams();
  const router = useRouter();
  const rawFane = searchParams.get("fane");
  const tab: Tab =
    rawFane === "analyser" || rawFane === "oversikt" ? rawFane : "maler";

  const setTab = useCallback(
    (t: Tab) => {
      const params = new URLSearchParams(searchParams.toString());
      if (t === "maler") {
        params.delete("fane");
      } else {
        params.set("fane", t);
      }
      const qs = params.toString();
      router.replace(`/w/${workspaceId}/ros${qs ? `?${qs}` : ""}`, {
        scroll: false,
      });
    },
    [router, searchParams, workspaceId],
  );

  const [busy, setBusy] = useState(false);

  const [tplName, setTplName] = useState("");
  const [tplDesc, setTplDesc] = useState("");
  const [tplRows, setTplRows] = useState("");
  const [tplCols, setTplCols] = useState("");
  const [tplRowAxis, setTplRowAxis] = useState(DEFAULT_ROS_ROW_AXIS);
  const [tplColAxis, setTplColAxis] = useState(DEFAULT_ROS_COL_AXIS);
  const [tplRowDescs, setTplRowDescs] = useState<string[]>([]);
  const [tplColDescs, setTplColDescs] = useState<string[]>([]);
  const [tplMatrixValues, setTplMatrixValues] = useState<number[][] | null>(null);
  const [editingId, setEditingId] = useState<Id<"rosTemplates"> | null>(null);

  const [anaTitle, setAnaTitle] = useState("");
  const [anaTemplateId, setAnaTemplateId] = useState<Id<"rosTemplates"> | "">("");
  const [anaCandidateId, setAnaCandidateId] = useState<Id<"candidates"> | "">("");
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [analysisSearch, setAnalysisSearch] = useState("");
  const [analysisSort, setAnalysisSort] = useState<AnalysisSort>("updated");

  const resetTemplateForm = useCallback(() => {
    setTplName("");
    setTplDesc("");
    setTplRows("");
    setTplCols("");
    setTplRowAxis(DEFAULT_ROS_ROW_AXIS);
    setTplColAxis(DEFAULT_ROS_COL_AXIS);
    setTplRowDescs([]);
    setTplColDescs([]);
    setTplMatrixValues(null);
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
      rowDescriptions?: string[];
      colDescriptions?: string[];
      defaultMatrixValues?: number[][];
    }) => {
      setEditingId(t._id);
      setTplName(t.name);
      setTplDesc(t.description ?? "");
      setTplRowAxis(t.rowAxisTitle);
      setTplColAxis(t.colAxisTitle);
      setTplRows(t.rowLabels.join("\n"));
      setTplCols(t.colLabels.join("\n"));
      setTplRowDescs(t.rowDescriptions ?? []);
      setTplColDescs(t.colDescriptions ?? []);
      setTplMatrixValues(t.defaultMatrixValues ?? null);
    },
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

  const filteredSortedAnalyses = useMemo(() => {
    const list = analyses ?? [];
    const q = analysisSearch.trim().toLowerCase();
    const filtered = q
      ? list.filter((a) => {
          const blob = `${a.title} ${a.candidateName ?? ""} ${a.candidateCode ?? ""}`.toLowerCase();
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
        (a.candidateName ?? "").localeCompare(b.candidateName ?? "", "nb", {
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
      const c = candidates?.find((x) => x._id === candidateId);
      if (c) setAnaTitle(`ROS — ${c.name} (${c.code})`);
      if (templates && templates.length === 1) {
        setAnaTemplateId(templates[0]!._id);
      } else if (hub?.defaultTemplateId) {
        setAnaTemplateId(hub.defaultTemplateId);
      }
    },
    [templates, hub?.defaultTemplateId, candidates],
  );

  const openNewTemplateDialog = useCallback(() => {
    resetTemplateForm();
    setTemplateDialogOpen(true);
  }, [resetTemplateForm]);

  /** Én mal i arbeidsområdet → forhåndsvelg (mindre friksjon for store organisasjoner). */
  useEffect(() => {
    if (templates === undefined || templates.length !== 1) return;
    setAnaTemplateId((prev) =>
      prev === "" ? templates[0]!._id : prev,
    );
  }, [templates]);

  /** Anker #ros-metode-standarder ligger i lukkede `<details>`; åpne ytre + indre og scroll. */
  useEffect(() => {
    const anchorId = "ros-metode-standarder";
    const outerSelector = "[data-ros-methodology-panel]";

    const openAndScroll = () => {
      if (typeof window === "undefined") return;
      if (window.location.hash !== `#${anchorId}`) return;

      const outer = document.querySelector(outerSelector);
      if (outer instanceof HTMLDetailsElement) {
        outer.open = true;
      }
      const inner = document.getElementById(anchorId);
      if (inner instanceof HTMLDetailsElement) {
        inner.open = true;
      }

      const scroll = () => {
        document.getElementById(anchorId)?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      };
      requestAnimationFrame(() => requestAnimationFrame(scroll));
      window.setTimeout(scroll, 80);
    };

    openAndScroll();
    window.addEventListener("hashchange", openAndScroll);
    return () => window.removeEventListener("hashchange", openAndScroll);
  }, []);

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
          toast.error(
            "Minst to etiketter for både rader og kolonner — eller la begge felt stå tomme for standard 5×5 ved ny mal.",
          );
          return;
        }
      }
      const rowDescsClean = tplRowDescs.length > 0 ? tplRowDescs : undefined;
      const colDescsClean = tplColDescs.length > 0 ? tplColDescs : undefined;
      if (editingId) {
        await updateTemplate({
          templateId: editingId,
          name: tplName.trim(),
          description: tplDesc.trim() || null,
          rowAxisTitle: tplRowAxis.trim(),
          colAxisTitle: tplColAxis.trim(),
          rowLabels,
          colLabels,
          rowDescriptions: rowDescsClean ?? null,
          colDescriptions: colDescsClean ?? null,
          defaultMatrixValues: tplMatrixValues ?? null,
        });
        toast.success("Mal oppdatert.");
      } else {
        await createTemplate({
          workspaceId,
          name: tplName.trim(),
          description: tplDesc.trim() || undefined,
          rowAxisTitle: tplRowAxis.trim(),
          colAxisTitle: tplColAxis.trim(),
          rowLabels: useDefault ? undefined : rowLabels,
          colLabels: useDefault ? undefined : colLabels,
          rowDescriptions: rowDescsClean,
          colDescriptions: colDescsClean,
          defaultMatrixValues: tplMatrixValues ?? undefined,
        });
        toast.success("Mal opprettet.");
      }
      resetTemplateForm();
      setTemplateDialogOpen(false);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Kunne ikke lagre malen.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function submitAnalysis(e: React.FormEvent) {
    e.preventDefault();
    if (!anaTemplateId || !anaTitle.trim()) return;
    setBusy(true);
    try {
      const id = await createAnalysis({
        workspaceId,
        templateId: anaTemplateId,
        candidateId: anaCandidateId || undefined,
        title: anaTitle.trim(),
      });
      window.location.href = `/w/${workspaceId}/ros/a/${id}`;
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Kunne ikke opprette analysen.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (
    (tab === "maler" || tab === "analyser") &&
    (templates === undefined || analyses === undefined)
  ) {
    return (
      <div className="flex min-h-[20vh] flex-col items-center justify-center gap-3">
        <div className="size-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-muted-foreground text-sm">Henter ROS-data …</p>
      </div>
    );
  }

  const templatesList = templates ?? [];
  const analysesList = analyses ?? [];

  return (
    <div className="space-y-6">
      <RosFlowNav
        tab={tab}
        onTab={setTab}
        counts={{ maler: templatesList.length, analyser: analysesList.length }}
      />

      <RosWorkspaceHub
        workspaceId={workspaceId}
        hub={hub}
        activeTab={tab}
        onTab={setTab}
        onStartAnalysisForCandidate={startAnalysisForCandidate}
        onOpenTemplateDialog={openNewTemplateDialog}
      />

      <details
        data-ros-methodology-panel
        className="border-border/60 bg-muted/10 group rounded-2xl border open:bg-muted/15"
      >
        <summary className="hover:bg-muted/30 flex cursor-pointer list-none items-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
          <HelpCircle className="text-primary size-4 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1">
            Metode og retningslinjer (ISO, personvern, kobling til vurderinger)
            <span className="text-muted-foreground ml-1.5 font-normal">
              — valgfritt, anbefales første gang
            </span>
          </span>
          <span className="text-muted-foreground shrink-0 text-xs group-open:hidden">
            Vis
          </span>
          <span className="text-muted-foreground hidden shrink-0 text-xs group-open:inline">
            Skjul
          </span>
        </summary>
        <div className="border-border/50 border-t px-3 pb-3 pt-1">
          <RosMethodologyGuide workspaceId={workspaceId} variant="compact" />
        </div>
      </details>

      {tab === "oversikt" ? (
        <RosDashboardPanel workspaceId={workspaceId} />
      ) : tab === "maler" ? (
        <div className="space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-heading text-lg font-semibold tracking-tight">
                Maler
              </h2>
              <p className="text-muted-foreground mt-0.5 text-sm">
                Definer rader og kolonner for risikovurderingen. Klikk på en mal for å redigere.
              </p>
            </div>
            <Button
              type="button"
              className="shrink-0 gap-2"
              onClick={() => openNewTemplateDialog()}
            >
              <Plus className="size-4" aria-hidden />
              Ny mal
            </Button>
          </div>

          {templatesList.length === 0 ? (
            <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed bg-muted/5 py-16 text-center">
              <div className="bg-primary/10 flex size-14 items-center justify-center rounded-full">
                <Grid3x3 className="text-primary size-7" />
              </div>
              <div>
                <p className="text-foreground text-sm font-medium">Ingen maler ennå</p>
                <p className="text-muted-foreground mt-1 max-w-sm text-xs">
                  En mal definerer rutenettet for risikovurderingen. Opprett din første mal for å komme i gang.
                </p>
              </div>
              <Button
                type="button"
                className="gap-2"
                onClick={() => openNewTemplateDialog()}
              >
                <Plus className="size-4" aria-hidden />
                Opprett første mal
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {templatesList.map((t) => (
                <div
                  key={t._id}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    loadTemplateForEdit(t);
                    setTemplateDialogOpen(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      loadTemplateForEdit(t);
                      setTemplateDialogOpen(true);
                    }
                  }}
                  className={cn(
                    "group flex cursor-pointer flex-col overflow-hidden rounded-xl border border-border/60 bg-card text-left shadow-sm outline-none transition-all",
                    "hover:border-primary/30 hover:shadow-lg",
                    "focus-visible:ring-2 focus-visible:ring-primary/40",
                    "active:scale-[0.99]",
                  )}
                >
                  <div className="flex-1 p-4">
                    <div className="mb-3 flex items-start gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 transition-colors group-hover:bg-primary/15">
                        <Grid3x3 className="size-4 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-foreground truncate text-sm font-semibold">
                            {t.name}
                          </h3>
                          <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
                            {t.rowLabels.length}×{t.colLabels.length}
                          </span>
                        </div>
                        {t.description ? (
                          <p className="text-muted-foreground mt-0.5 line-clamp-1 text-xs">
                            {t.description}
                          </p>
                        ) : null}
                        <p className="text-muted-foreground/70 mt-1 text-[10px]">
                          {t.rowAxisTitle} × {t.colAxisTitle}
                        </p>
                      </div>
                    </div>
                    <RosTemplatePreviewMini
                      rowLabels={t.rowLabels}
                      colLabels={t.colLabels}
                    />
                  </div>
                  <div className="flex items-center justify-between border-t border-border/40 bg-muted/10 px-4 py-2">
                    <span className="text-primary text-xs font-medium opacity-0 transition-opacity group-hover:opacity-100">
                      Rediger
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-destructive h-7 text-[11px]"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (
                          typeof window !== "undefined" &&
                          window.confirm(
                            "Slette denne malen? Eksisterende analyser beholder sin kopi.",
                          )
                        ) {
                          void (async () => {
                            try {
                              await removeTemplate({ templateId: t._id });
                              toast.success("Mal slettet.");
                            } catch (e) {
                              toast.error(
                                e instanceof Error
                                  ? e.message
                                  : "Kunne ikke slette malen.",
                              );
                            }
                          })();
                        }
                      }}
                    >
                      <Trash2 className="mr-1 size-3" />
                      Slett
                    </Button>
                  </div>
                </div>
              ))}
            </div>
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
                  Under finner du forklaring på rader og kolonner. Tomme
                  etikettfelt betyr innebygd 5×5 (du ser resultatet i
                  forhåndsvisning). Fargene følger risikonivå 1–5 (grønn → rød).
                </p>
              </DialogHeader>
              <DialogBody>
                <form
                  id="ros-template-form"
                  onSubmit={(e) => void submitTemplate(e)}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <p className="text-muted-foreground text-xs font-medium">
                      Hurtigstart
                    </p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      {ROS_TEMPLATE_PRESETS.map((p) => (
                        <Button
                          key={p.id}
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-auto min-h-9 w-full flex-col items-start gap-0.5 whitespace-normal py-2.5 text-left"
                          onClick={() => {
                            const s = presetToFormState(p);
                            setTplRowAxis(s.tplRowAxis);
                            setTplColAxis(s.tplColAxis);
                            setTplRows(s.tplRows);
                            setTplCols(s.tplCols);
                          }}
                        >
                          <span className="font-medium">{p.name}</span>
                          <span className="text-muted-foreground text-[11px] font-normal leading-snug">
                            {p.description}
                          </span>
                        </Button>
                      ))}
                    </div>
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
                      <RosLabelLevelsEditor
                        id="tpl-rows"
                        title="Etiketter rader"
                        intro="Rader er ofte sannsynlighet eller «hvor sannsynlig er det uønskede utfallet?»"
                        value={tplRows}
                        onChange={setTplRows}
                        defaultLabels={DEFAULT_ROS_ROW_LABELS}
                        lowEndHint="lavest langs aksen"
                        highEndHint="høyest langs aksen"
                        descriptions={tplRowDescs}
                        onDescriptionsChange={setTplRowDescs}
                      />
                      <RosLabelLevelsEditor
                        id="tpl-cols"
                        title="Etiketter kolonner"
                        intro="Kolonner er ofte konsekvens eller «hvor stort er det negative utfallet?»"
                        value={tplCols}
                        onChange={setTplCols}
                        defaultLabels={DEFAULT_ROS_COL_LABELS}
                        lowEndHint="lavest langs aksen"
                        highEndHint="høyest langs aksen"
                        descriptions={tplColDescs}
                        onDescriptionsChange={setTplColDescs}
                      />
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-muted-foreground text-xs uppercase tracking-wide">
                          Forhåndsvisning
                        </Label>
                        <RosTemplatePreviewMini
                          rowLabels={previewRowLabels}
                          colLabels={previewColLabels}
                        />
                      </div>
                      <TemplateMatrixEditor
                        rowLabels={previewRowLabels}
                        colLabels={previewColLabels}
                        values={tplMatrixValues}
                        onChange={setTplMatrixValues}
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
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="font-heading text-lg font-semibold tracking-tight">
                  Dine ROS-analyser
                </h2>
                <p className="text-muted-foreground mt-0.5 text-sm">
                  {analysesList.length > 0
                    ? `${analysesList.length} analyse${analysesList.length === 1 ? "" : "r"} i dette arbeidsområdet`
                    : "Opprett din første analyse for å komme i gang"}
                </p>
              </div>
            </div>
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
              <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed bg-muted/5 py-14 text-center">
                <div className="flex size-14 items-center justify-center rounded-full bg-primary/10">
                  <ClipboardList className="size-7 text-primary" />
                </div>
                <div className="max-w-sm space-y-1">
                  <p className="text-foreground text-sm font-medium">Ingen analyser ennå</p>
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    Du trenger minst én <strong>mal</strong> og én <strong>kandidat</strong> (prosess).
                    Opprett kandidater under{" "}
                    <Link
                      href={`/w/${workspaceId}/vurderinger?fane=prosesser`}
                      className="text-primary font-medium underline-offset-4 hover:underline"
                    >
                      Kandidater
                    </Link>
                    , deretter fyll ut skjemaet til høyre.
                  </p>
                </div>
              </div>
            ) : filteredSortedAnalyses.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed bg-muted/5 py-10 text-center">
                <Search className="size-8 text-muted-foreground/50" />
                <p className="text-muted-foreground text-sm">
                  Ingen analyser matcher søket.{" "}
                  <button
                    type="button"
                    className="text-primary font-medium underline-offset-4 hover:underline"
                    onClick={() => setAnalysisSearch("")}
                  >
                    Nullstill filter
                  </button>
                </p>
              </div>
            ) : (
              <ul className="space-y-2">
                {filteredSortedAnalyses.map((a) => (
                  <li key={a._id} className="group/card relative">
                    <Link
                      href={`/w/${workspaceId}/ros/a/${a._id}`}
                      className="flex items-center gap-4 rounded-xl border border-border/60 bg-card p-4 shadow-sm transition-all hover:border-primary/30 hover:shadow-md"
                    >
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 transition-colors group-hover/card:bg-primary/15">
                        <Shield className="size-5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{a.title}</p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                          {a.candidateName ? (
                            <span>
                              {a.candidateName}{" "}
                              <span className="font-mono">({a.candidateCode})</span>
                            </span>
                          ) : (
                            <span className="italic">Ingen prosess koblet</span>
                          )}
                          <span className="inline-flex items-center gap-1">
                            <Grid3x3 className="size-3" aria-hidden />
                            {a.rowLabels.length}×{a.colLabels.length}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Clock className="size-3" aria-hidden />
                            {formatRelative(a.updatedAt)}
                          </span>
                        </div>
                      </div>
                      <ArrowRight className="size-4 shrink-0 text-muted-foreground/40 transition-transform group-hover/card:translate-x-0.5 group-hover/card:text-primary" />
                    </Link>
                    <button
                      type="button"
                      className="absolute right-2 top-2 rounded-md p-1.5 text-muted-foreground/50 opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover/card:opacity-100"
                      title="Slett analyse"
                      onClick={() => {
                        if (
                          window.confirm(
                            `Slette «${a.title}»? Matrisedata, oppgaver og koblinger fjernes permanent.`,
                          )
                        ) {
                          void (async () => {
                            try {
                              await removeAnalysis({ analysisId: a._id });
                              toast.success("Analyse slettet.");
                            } catch (e) {
                              toast.error(
                                e instanceof Error
                                  ? e.message
                                  : "Kunne ikke slette analysen.",
                              );
                            }
                          })();
                        }
                      }}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Card className="h-fit border-primary/15 bg-gradient-to-b from-primary/[0.04] to-card shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10">
                  <Plus className="size-4 text-primary" />
                </div>
                Ny ROS-analyse
              </CardTitle>
              <CardDescription className="text-xs">
                Opprett en analyse, koble prosess og PVV etterpå.
              </CardDescription>
            </CardHeader>
            <form onSubmit={(e) => void submitAnalysis(e)}>
              <CardContent className="space-y-3">
                {templatesList.length === 0 ? (
                  <Alert className="border-amber-500/35 bg-amber-500/[0.06]">
                    <Info className="text-amber-700 dark:text-amber-400" />
                    <AlertTitle>Ingen mal</AlertTitle>
                    <AlertDescription>
                      <button
                        type="button"
                        className="text-primary font-medium underline underline-offset-4"
                        onClick={() => setTab("maler")}
                      >
                        Opprett en mal
                      </button>{" "}
                      før du lager analyse.
                    </AlertDescription>
                  </Alert>
                ) : null}
                <div className="space-y-1.5">
                  <Label htmlFor="ana-title">Tittel</Label>
                  <Input
                    id="ana-title"
                    value={anaTitle}
                    onChange={(e) => setAnaTitle(e.target.value)}
                    placeholder="F.eks. ROS — Rekruttering"
                    required
                  />
                </div>
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
                </div>
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                    Koble prosess nå (valgfritt)
                  </summary>
                  <div className="mt-2 space-y-1.5">
                    <Label htmlFor="ana-cand" className="text-xs">Prosess</Label>
                    <select
                      id="ana-cand"
                      className="border-input bg-background flex h-9 w-full rounded-lg border px-2 text-xs"
                      value={anaCandidateId}
                      onChange={(e) => {
                        const val = e.target.value;
                        setAnaCandidateId(val === "" ? "" : (val as Id<"candidates">));
                        if (val && candidates) {
                          const c = candidates.find((x) => x._id === val);
                          if (c && !anaTitle.trim()) {
                            setAnaTitle(`ROS — ${c.name} (${c.code})`);
                          }
                        }
                      }}
                    >
                      <option value="">— Ingen (koble senere) —</option>
                      {(candidates ?? []).map((c) => (
                        <option key={c._id} value={c._id}>
                          {c.name} ({c.code})
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-muted-foreground leading-snug">
                      Du kan koble prosess og PVV inne i analysen etterpå.
                    </p>
                  </div>
                </details>
              </CardContent>
              <CardFooter className="border-t">
                <Button
                  type="submit"
                  className="w-full"
                  disabled={
                    busy ||
                    !anaTemplateId ||
                    !anaTitle.trim() ||
                    templatesList.length === 0
                  }
                >
                  {busy ? "Oppretter …" : "Opprett analyse"}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}

function TemplateMatrixEditor({
  rowLabels,
  colLabels,
  values,
  onChange,
}: {
  rowLabels: string[];
  colLabels: string[];
  values: number[][] | null;
  onChange: (v: number[][] | null) => void;
}) {
  const rows = rowLabels.length;
  const cols = colLabels.length;

  const matrix = useMemo(() => {
    if (!values) return null;
    const m: number[][] = [];
    for (let r = 0; r < rows; r++) {
      const row: number[] = [];
      for (let c = 0; c < cols; c++) {
        row.push(values[r]?.[c] ?? 0);
      }
      m.push(row);
    }
    return m;
  }, [values, rows, cols]);

  const initMatrix = useCallback(() => {
    const m: number[][] = [];
    for (let r = 0; r < rows; r++) {
      const row: number[] = [];
      for (let c = 0; c < cols; c++) {
        row.push(positionRiskLevel(r, c, rows, cols));
      }
      m.push(row);
    }
    onChange(m);
  }, [rows, cols, onChange]);

  const cycleCell = useCallback(
    (r: number, c: number) => {
      if (!matrix) return;
      const next = matrix.map((row) => [...row]);
      next[r]![c] = ((next[r]![c]! % 5) + 1);
      onChange(next);
    },
    [matrix, onChange],
  );

  if (!matrix) {
    return (
      <div className="space-y-2">
        <Label className="text-muted-foreground text-xs uppercase tracking-wide">
          Egne risikoverdier per celle
        </Label>
        <p className="text-muted-foreground text-xs leading-relaxed">
          Standard: poengene beregnes automatisk ut fra celleposisjon.
          Klikk under for å definere egne verdier.
        </p>
        <Button type="button" variant="outline" size="sm" onClick={initMatrix}>
          Definer egne verdier
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-muted-foreground text-xs uppercase tracking-wide">
          Egne risikoverdier (klikk celle for å endre)
        </Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-muted-foreground"
          onClick={() => onChange(null)}
        >
          Fjern (bruk auto)
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="border-separate border-spacing-0.5 text-center text-xs">
          <thead>
            <tr>
              <th />
              {colLabels.map((l, c) => (
                <th
                  key={c}
                  className="max-w-[4rem] truncate px-1 pb-0.5 font-medium text-muted-foreground"
                  title={l}
                >
                  {c + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...Array(rows)].map((_, displayIdx) => {
              const r = rows - 1 - displayIdx;
              return (
                <tr key={r}>
                  <td className="pr-1 text-right font-medium text-muted-foreground">
                    {r + 1}
                  </td>
                  {[...Array(cols)].map((_, c) => {
                    const val = matrix[r]?.[c] ?? 0;
                    return (
                      <td key={c}>
                        <button
                          type="button"
                          className={cn(
                            "flex size-8 items-center justify-center rounded-md border text-xs font-bold transition-all",
                            cellRiskClass(val),
                          )}
                          onClick={() => cycleCell(r, c)}
                          title={`Rad ${r + 1}, Kol ${c + 1}: Verdi ${val}. Klikk for å endre.`}
                        >
                          {val}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-muted-foreground text-[10px]">
        Verdier 1–5 (grønn → rød). Klikk for å bla gjennom.
      </p>
    </div>
  );
}
