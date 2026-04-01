"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
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
import { toastDeleteWithUndo } from "@/lib/toast-delete-undo";
import { cellRiskClass } from "@/lib/ros-risk-colors";
import { useRosWorkspaceUiPrefs } from "@/lib/ros-workspace-ui-prefs";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import { RosDashboardPanel } from "@/components/ros/ros-dashboard-panel";
import { RosMethodologyGuide } from "@/components/ros/ros-methodology-guide";
import { RosScaleReference } from "@/components/ros/ros-scale-reference";
import { RosLibraryPanel } from "@/components/ros/ros-library-panel";
import { GithubIssueStartCard } from "@/components/github/github-issue-start-card";
import { RosAnalysisVersionsQuickDialog } from "@/components/ros/ros-analysis-versions-quick-dialog";
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
  BarChart3,
  BookMarked,
  ClipboardList,
  Grid3x3,
  HelpCircle,
  History,
  Info,
  Plus,
  Search,
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

type Tab = "maler" | "analyser" | "oversikt" | "bibliotek";

const FLOW_TABS = [
  { id: "analyser" as const, label: "Analyser", icon: ClipboardList },
  { id: "maler" as const, label: "Maler", icon: Grid3x3 },
  { id: "oversikt" as const, label: "Dashboard", icon: BarChart3 },
  { id: "bibliotek" as const, label: "Bibliotek", icon: BookMarked },
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
  return (
    <nav
      className="relative -mx-1 flex max-w-full flex-nowrap items-stretch gap-1 overflow-x-auto border-b border-border/50 px-1 pb-0 [scrollbar-width:none] sm:mx-0 sm:gap-0 sm:px-0 [&::-webkit-scrollbar]:hidden"
      role="tablist"
      aria-label="ROS-faner"
    >
      {FLOW_TABS.map((s) => {
        const active = tab === s.id;
        const Icon = s.icon;
        const count =
          s.id === "maler"
            ? counts?.maler
            : s.id === "analyser"
              ? counts?.analyser
              : undefined;
        return (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onTab(s.id)}
            className={cn(
              "group relative flex shrink-0 items-center gap-2 px-4 pb-3 pt-2 text-sm font-medium transition-colors duration-150",
              active
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground/80",
            )}
          >
            <Icon
              className={cn(
                "size-4 shrink-0 transition-colors",
                active ? "text-primary" : "text-muted-foreground/70 group-hover:text-foreground/60",
              )}
              aria-hidden
            />
            <span>{s.label}</span>
            {count !== undefined && count > 0 ? (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums leading-none",
                  active
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {count}
              </span>
            ) : null}
            {active ? (
              <span className="bg-primary absolute inset-x-0 -bottom-px h-0.5 rounded-full" />
            ) : null}
          </button>
        );
      })}
    </nav>
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
  const { prefs: rosUiPrefs, updatePrefs: updateRosUiPrefs } =
    useRosWorkspaceUiPrefs(workspaceId);
  const rawFane = searchParams.get("fane");
  const tab: Tab = useMemo(() => {
    if (
      rawFane === "analyser" ||
      rawFane === "oversikt" ||
      rawFane === "bibliotek"
    ) {
      return rawFane;
    }
    if (rawFane === "maler") {
      return "maler";
    }
    return "analyser";
  }, [rawFane]);

  useEffect(() => {
    if (rawFane !== null) {
      return;
    }
    if (analyses === undefined) {
      return;
    }
    router.replace(`/w/${workspaceId}/ros?fane=analyser`, { scroll: false });
  }, [rawFane, analyses, workspaceId, router]);

  const setTab = useCallback(
    (t: Tab) => {
      const params = new URLSearchParams(searchParams.toString());
      // Alltid sett fane eksplisitt — «maler» kan ikke kodes som manglende param,
      // fordi tom URL trigget useEffect som erstatter med ?fane=analyser.
      params.set("fane", t);
      const qs = params.toString();
      router.replace(`/w/${workspaceId}/ros?${qs}`, { scroll: false });
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
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [scaleRefOpen, setScaleRefOpen] = useState(false);
  const [methodHelpOpen, setMethodHelpOpen] = useState(false);
  const [versionsQuickDialog, setVersionsQuickDialog] = useState<{
    analysisId: Id<"rosAnalyses">;
    title: string;
  } | null>(null);

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

  const requestRemoveAnalysis = useCallback(
    (a: { _id: Id<"rosAnalyses">; title: string }) => {
      toastDeleteWithUndo({
        title: "Sletter ROS-analyse",
        itemLabel: a.title,
        onCommit: async () => {
          await removeAnalysis({ analysisId: a._id });
        },
      });
    },
    [removeAnalysis],
  );

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
    [setTab, templates, hub?.defaultTemplateId, candidates],
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

    const openAndScroll = () => {
      if (typeof window === "undefined") return;
      if (window.location.hash !== `#${anchorId}`) return;

      updateRosUiPrefs({ helpMethodologyOpen: true });

      const scroll = () => {
        const inner = document.getElementById(anchorId);
        if (inner instanceof HTMLDetailsElement) {
          inner.open = true;
        }
        document.getElementById(anchorId)?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      };
      requestAnimationFrame(() => requestAnimationFrame(scroll));
      window.setTimeout(scroll, 120);
    };

    openAndScroll();
    window.addEventListener("hashchange", openAndScroll);
    return () => window.removeEventListener("hashchange", openAndScroll);
  }, [updateRosUiPrefs]);

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
    <div className="space-y-5">
      <RosFlowNav
        tab={tab}
        onTab={setTab}
        counts={{ maler: templatesList.length, analyser: analysesList.length }}
      />

      {tab === "bibliotek" ? (
        <section aria-labelledby="ros-bibliotek-heading" className="space-y-4">
          <RosLibraryPanel workspaceId={workspaceId} />
        </section>
      ) : tab === "oversikt" ? (
        <section aria-labelledby="ros-dashboard-heading" className="space-y-6">
          <div className="rounded-2xl border border-border/50 bg-card/50 px-4 py-4 sm:px-5">
            <h2
              id="ros-dashboard-heading"
              className="font-heading text-lg font-semibold tracking-tight text-foreground"
            >
              Dashboard
            </h2>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
              Oversikt over analyser, prosessdekning og nøkkeltall — uten startskjema for nye ROS.
            </p>
          </div>
          <RosWorkspaceHub
            workspaceId={workspaceId}
            hub={hub}
            compact={false}
            onTab={setTab}
            onStartAnalysisForCandidate={startAnalysisForCandidate}
            onOpenTemplateDialog={openNewTemplateDialog}
          />
          <RosDashboardPanel workspaceId={workspaceId} />
        </section>
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
        <>
          <GithubIssueStartCard
            workspaceId={workspaceId}
            variant="ros"
            defaultTemplateId={hub?.defaultTemplateId ?? null}
          />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-heading text-lg font-semibold tracking-tight">
                Alle ROS-analyser
              </h2>
              {analysesList.length > 0 ? (
                <p className="text-muted-foreground mt-0.5 text-sm tabular-nums">
                  {analysesList.length} analyse{analysesList.length !== 1 ? "r" : ""} i arbeidsområdet
                </p>
              ) : null}
            </div>
            <Button
              type="button"
              className="shrink-0 gap-2 shadow-sm"
              onClick={() => setCreateDialogOpen(true)}
            >
              <Plus className="size-4" aria-hidden />
              Ny analyse
            </Button>
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
                  onChange={(e) => setAnalysisSort(e.target.value as AnalysisSort)}
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
              <div className="max-w-md space-y-1">
                <p className="text-foreground text-sm font-medium">Ingen analyser ennå</p>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  Opprett en <strong className="text-foreground">mal</strong> under «Maler», deretter
                  klikk «Ny analyse».
                </p>
              </div>
              <Button type="button" className="gap-2" onClick={() => setCreateDialogOpen(true)}>
                <Plus className="size-4" aria-hidden />
                Opprett første analyse
              </Button>
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
                  Nullstill
                </button>
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filteredSortedAnalyses.map((a) => {
                const versionCount = (a as { versionCount?: number }).versionCount ?? 0;
                const maxLvl = Math.max(0, ...a.matrixValues.flat().map((v) => Math.min(5, Math.max(0, Math.round(v)))));
                return (
                  <div
                    key={a._id}
                    className="group/card relative flex flex-col overflow-hidden rounded-xl border border-border/50 bg-card shadow-sm transition-all hover:border-primary/25 hover:shadow-md"
                  >
                    <Link
                      href={`/w/${workspaceId}/ros/a/${a._id}`}
                      className="flex flex-1 items-start gap-3 p-4"
                    >
                      <span
                        className={cn(
                          "flex size-10 shrink-0 items-center justify-center rounded-xl text-base font-bold tabular-nums",
                          cellRiskClass(maxLvl),
                        )}
                      >
                        {maxLvl}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold group-hover/card:text-primary">
                          {a.title}
                        </p>
                        <p className="text-muted-foreground mt-0.5 text-xs">
                          {a.candidateName ? (
                            <>
                              {a.candidateName}{" "}
                              <span className="font-mono text-[10px]">({a.candidateCode})</span>
                            </>
                          ) : (
                            <span className="italic">Ingen prosess</span>
                          )}
                        </p>
                        <div className="mt-2 flex h-1.5 w-full overflow-hidden rounded-full bg-muted/50">
                          {(() => {
                            const flat = a.matrixValues.flat().map((v) => Math.min(5, Math.max(0, Math.round(v))));
                            const counts = [0, 0, 0, 0, 0, 0];
                            for (const v of flat) counts[v]++;
                            const total = flat.length || 1;
                            return [5, 4, 3, 2, 1, 0].map((lvl) =>
                              counts[lvl] > 0 ? (
                                <div
                                  key={lvl}
                                  className={cn("min-w-[2px]", cellRiskClass(lvl))}
                                  style={{ width: `${(counts[lvl] / total) * 100}%` }}
                                />
                              ) : null,
                            );
                          })()}
                        </div>
                        <div className="text-muted-foreground mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px]">
                          <span>{a.rowLabels.length}×{a.colLabels.length}</span>
                          <span>{formatRelative(a.updatedAt)}</span>
                        </div>
                      </div>
                    </Link>
                    <div className="flex items-center gap-1.5 border-t border-border/40 bg-muted/10 px-3 py-2">
                      <button
                        type="button"
                        onClick={() => setVersionsQuickDialog({ analysisId: a._id, title: a.title })}
                        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] transition-colors hover:bg-muted/60"
                      >
                        <History className="size-3" aria-hidden />
                        {versionCount} vers.
                      </button>
                      <span className="flex-1" />
                      <Link
                        href={`/w/${workspaceId}/ros/a/${a._id}`}
                        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-7 text-xs")}
                      >
                        Åpne
                      </Link>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7 text-muted-foreground/60 hover:bg-destructive/10 hover:text-destructive"
                        title="Slett"
                        onClick={() => requestRemoveAnalysis(a)}
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() => setScaleRefOpen(true)}
            >
              <Info className="size-3.5 text-primary" aria-hidden />
              Skalareferanse
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() => setMethodHelpOpen(true)}
            >
              <HelpCircle className="size-3.5" aria-hidden />
              Hjelp og metode
            </Button>
          </div>

          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogContent size="lg" titleId="ros-create-title" descriptionId="ros-create-desc">
              <DialogHeader>
                <p id="ros-create-title" className="font-heading text-lg font-semibold">
                  Ny ROS-analyse
                </p>
                <p id="ros-create-desc" className="text-muted-foreground text-sm">
                  Opprett en analyse, koble prosess og PVV etterpå.
                </p>
              </DialogHeader>
              <DialogBody>
                <form id="ros-create-form" onSubmit={(e) => void submitAnalysis(e)} className="space-y-4">
                  {templatesList.length === 0 ? (
                    <Alert className="border-amber-500/35 bg-amber-500/[0.06]">
                      <Info className="text-amber-700 dark:text-amber-400" />
                      <AlertTitle>Ingen mal</AlertTitle>
                      <AlertDescription>
                        <button
                          type="button"
                          className="text-primary font-medium underline underline-offset-4"
                          onClick={() => { setCreateDialogOpen(false); setTab("maler"); }}
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
                        setAnaTemplateId(e.target.value === "" ? "" : (e.target.value as Id<"rosTemplates">))
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
                  <div className="space-y-1.5">
                    <Label htmlFor="ana-cand" className="text-xs">Prosess (valgfritt)</Label>
                    <select
                      id="ana-cand"
                      className="border-input bg-background flex h-10 w-full rounded-lg border px-2 text-sm"
                      value={anaCandidateId}
                      onChange={(e) => {
                        const val = e.target.value;
                        setAnaCandidateId(val === "" ? "" : (val as Id<"candidates">));
                        if (val && candidates) {
                          const c = candidates.find((x) => x._id === val);
                          if (c && !anaTitle.trim()) setAnaTitle(`ROS — ${c.name} (${c.code})`);
                        }
                      }}
                    >
                      <option value="">— Ingen (koble senere) —</option>
                      {(candidates ?? []).map((c) => (
                        <option key={c._id} value={c._id}>{c.name} ({c.code})</option>
                      ))}
                    </select>
                  </div>
                </form>
              </DialogBody>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Avbryt
                </Button>
                <Button
                  type="submit"
                  form="ros-create-form"
                  disabled={busy || !anaTemplateId || !anaTitle.trim() || templatesList.length === 0}
                >
                  {busy ? "Oppretter …" : "Opprett analyse"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={scaleRefOpen} onOpenChange={setScaleRefOpen}>
            <DialogContent size="lg" titleId="ros-scale-title" descriptionId="ros-scale-desc">
              <DialogHeader>
                <p id="ros-scale-title" className="font-heading text-lg font-semibold">Skalareferanse</p>
                <p id="ros-scale-desc" className="text-muted-foreground text-sm">
                  Hva betyr tallene 1, 2, 3 … på aksene i risikomatrisen.
                </p>
              </DialogHeader>
              <DialogBody>
                <RosScaleReference
                  axis={rosUiPrefs.scaleReferenceAxis}
                  onAxisChange={(axis) => updateRosUiPrefs({ scaleReferenceAxis: axis })}
                />
              </DialogBody>
            </DialogContent>
          </Dialog>

          <Dialog open={methodHelpOpen} onOpenChange={setMethodHelpOpen}>
            <DialogContent size="lg" titleId="ros-method-title" descriptionId="ros-method-desc">
              <DialogHeader>
                <p id="ros-method-title" className="font-heading text-lg font-semibold">Hjelp og metode</p>
                <p id="ros-method-desc" className="text-muted-foreground text-sm">
                  Metodikk, begreper og veiledning for ROS-analyse.
                </p>
              </DialogHeader>
              <DialogBody>
                <RosMethodologyGuide workspaceId={workspaceId} variant="compact" />
              </DialogBody>
            </DialogContent>
          </Dialog>
      </>
      )}

      <RosAnalysisVersionsQuickDialog
        open={versionsQuickDialog !== null}
        onOpenChange={(o) => {
          if (!o) setVersionsQuickDialog(null);
        }}
        workspaceId={workspaceId}
        analysisId={versionsQuickDialog?.analysisId ?? null}
        analysisTitle={versionsQuickDialog?.title ?? ""}
      />
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
