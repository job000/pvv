"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FilterToolbar } from "@/components/ui/filter-toolbar";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelectField } from "@/components/ui/native-select-field";
import { SearchInput } from "@/components/ui/search-input";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import {
  effectiveOrgForRosClient,
  orgSubtreeIds,
  orgUnitSearchLabel,
} from "@/lib/org-unit-filter";
import { toast } from "@/lib/app-toast";
import { toastDeleteWithUndo } from "@/lib/toast-delete-undo";
import { cellRiskClass } from "@/lib/ros-risk-colors";
import { useRosWorkspaceUiPrefs } from "@/lib/ros-workspace-ui-prefs";
import { cn } from "@/lib/utils";
import {
  isValidRosSectorPackId,
  listRosSectorPacks,
  type RosSectorPackId,
} from "@/lib/ros-sector-packs";
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
import {
  RosTemplateBuilder,
  type TemplateBuilderMode,
} from "@/components/ros/ros-template-builder";
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
  { id: "analyser" as const, label: "Arbeid", icon: ClipboardList },
  { id: "maler" as const, label: "Maler", icon: Grid3x3 },
  { id: "oversikt" as const, label: "Status", icon: BarChart3 },
  { id: "bibliotek" as const, label: "Stotte", icon: BookMarked },
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
      className="relative -mx-1 flex max-w-full flex-nowrap items-stretch gap-1 overflow-x-auto rounded-2xl border border-border/50 bg-card/70 p-1 shadow-sm [scrollbar-width:none] sm:mx-0 sm:px-1 [&::-webkit-scrollbar]:hidden"
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
              "group relative flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors duration-150",
              active
                ? "bg-background text-foreground shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06]"
                : "text-muted-foreground hover:bg-background/60 hover:text-foreground/80",
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
              <span className="bg-primary absolute inset-x-3 bottom-0 h-0.5 rounded-full" />
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
  const orgUnits = useQuery(api.orgUnits.listByWorkspace, { workspaceId });
  const workspace = useQuery(api.workspaces.get, { workspaceId });

  const createTemplate = useMutation(api.ros.createTemplate);
  const updateTemplate = useMutation(api.ros.updateTemplate);
  const removeTemplate = useMutation(api.ros.removeTemplate);
  const createAnalysis = useMutation(api.ros.createAnalysis);
  const removeAnalysis = useMutation(api.ros.removeAnalysis);
  const updateWorkspace = useMutation(api.workspaces.update);

  const searchParams = useSearchParams();
  const router = useRouter();
  const { prefs: rosUiPrefs, updatePrefs: updateRosUiPrefs } =
    useRosWorkspaceUiPrefs(workspaceId);
  const rawFane = searchParams.get("fane");
  const rawNewTemplate = searchParams.get("nyMal");
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

  const [builderMode, setBuilderMode] = useState<TemplateBuilderMode>("create");
  const [builderInitialData, setBuilderInitialData] = useState<{
    id?: Id<"rosTemplates">;
    name: string;
    description: string;
    rowAxis: string;
    colAxis: string;
    rowLabels: string[];
    colLabels: string[];
    rowDescs: string[];
    colDescs: string[];
    matrixValues: number[][] | null;
  } | undefined>(undefined);

  const [anaTitle, setAnaTitle] = useState("");
  const [anaTemplateId, setAnaTemplateId] = useState<Id<"rosTemplates"> | "">("");
  const [anaCandidateId, setAnaCandidateId] = useState<Id<"candidates"> | "">("");
  const [anaOrgUnitId, setAnaOrgUnitId] = useState<Id<"orgUnits"> | "">("");
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [analysisSearch, setAnalysisSearch] = useState("");
  const [analysisOrgFilter, setAnalysisOrgFilter] = useState<"" | Id<"orgUnits">>(
    "",
  );
  const [analysisSort, setAnalysisSort] = useState<AnalysisSort>("updated");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [anaSectorPackId, setAnaSectorPackId] =
    useState<RosSectorPackId>("general");
  const [rememberDefaultSectorPack, setRememberDefaultSectorPack] =
    useState(false);
  const [scaleRefOpen, setScaleRefOpen] = useState(false);
  const [methodHelpOpen, setMethodHelpOpen] = useState(false);
  const [versionsQuickDialog, setVersionsQuickDialog] = useState<{
    analysisId: Id<"rosAnalyses">;
    title: string;
  } | null>(null);

  useEffect(() => {
    if (!createDialogOpen || !workspace) return;
    const d = workspace.defaultRosSectorPackId?.trim();
    if (d && isValidRosSectorPackId(d)) {
      setAnaSectorPackId(d);
    } else {
      setAnaSectorPackId("general");
    }
  }, [createDialogOpen, workspace]);

  const openBuilderForEdit = useCallback(
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
      setBuilderMode("edit");
      setBuilderInitialData({
        id: t._id,
        name: t.name,
        description: t.description ?? "",
        rowAxis: t.rowAxisTitle,
        colAxis: t.colAxisTitle,
        rowLabels: t.rowLabels,
        colLabels: t.colLabels,
        rowDescs: t.rowDescriptions ?? [],
        colDescs: t.colDescriptions ?? [],
        matrixValues: t.defaultMatrixValues ?? null,
      });
      setTemplateDialogOpen(true);
    },
    [],
  );

  const openBuilderForDuplicate = useCallback(
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
      setBuilderMode("duplicate");
      setBuilderInitialData({
        name: `${t.name} (kopi)`,
        description: t.description ?? "",
        rowAxis: t.rowAxisTitle,
        colAxis: t.colAxisTitle,
        rowLabels: t.rowLabels,
        colLabels: t.colLabels,
        rowDescs: t.rowDescriptions ?? [],
        colDescs: t.colDescriptions ?? [],
        matrixValues: t.defaultMatrixValues ?? null,
      });
      setTemplateDialogOpen(true);
    },
    [],
  );

  const candidateById = useMemo(() => {
    const m = new Map<Id<"candidates">, Doc<"candidates">>();
    for (const c of candidates ?? []) {
      m.set(c._id, c);
    }
    return m;
  }, [candidates]);

  const filteredSortedAnalyses = useMemo(() => {
    const list = analyses ?? [];
    const units = orgUnits ?? [];
    let base = list;
    if (analysisOrgFilter) {
      const subtree = orgSubtreeIds(analysisOrgFilter, units);
      base = base.filter((a) => {
        const eff = effectiveOrgForRosClient(a, candidateById);
        return eff ? subtree.has(eff) : false;
      });
    }
    const q = analysisSearch.trim().toLowerCase();
    const filtered = q
      ? base.filter((a) => {
          const fromIntake = Boolean((a as { fromIntake?: boolean }).fromIntake);
          const effOrg = effectiveOrgForRosClient(a, candidateById);
          const orgBlob = orgUnitSearchLabel(effOrg, units).toLowerCase();
          const blob =
            `${a.title} ${a.candidateName ?? ""} ${a.candidateCode ?? ""} ${fromIntake ? "skjema" : ""} ${orgBlob}`.toLowerCase();
          return blob.includes(q);
        })
      : [...base];
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
  }, [
    analyses,
    analysisSearch,
    analysisSort,
    analysisOrgFilter,
    orgUnits,
    candidateById,
  ]);

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
    setBuilderMode("create");
    setBuilderInitialData(undefined);
    setTemplateDialogOpen(true);
  }, []);

  useEffect(() => {
    if (tab !== "maler" || rawNewTemplate !== "1") {
      return;
    }
    openNewTemplateDialog();
    const params = new URLSearchParams(searchParams.toString());
    params.delete("nyMal");
    params.set("fane", "maler");
    router.replace(`/w/${workspaceId}/ros?${params.toString()}`, {
      scroll: false,
    });
  }, [
    openNewTemplateDialog,
    rawNewTemplate,
    router,
    searchParams,
    tab,
    workspaceId,
  ]);

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

  const handleBuilderSubmit = useCallback(async (data: {
    editingId: Id<"rosTemplates"> | null;
    name: string;
    description: string;
    rowAxis: string;
    colAxis: string;
    rowLabelsRaw: string;
    colLabelsRaw: string;
    rowDescs: string[];
    colDescs: string[];
    matrixValues: number[][] | null;
  }) => {
    setBusy(true);
    try {
      const rowLabels = data.rowLabelsRaw.split("\n").map((s) => s.trim()).filter(Boolean);
      const colLabels = data.colLabelsRaw.split("\n").map((s) => s.trim()).filter(Boolean);
      const useDefault = !data.editingId && rowLabels.length === 0 && colLabels.length === 0;
      if (!useDefault) {
        if (rowLabels.length < 2 || colLabels.length < 2) {
          toast.error("Minst to etiketter for både rader og kolonner.");
          return;
        }
      }
      const rowDescsClean = data.rowDescs.length > 0 ? data.rowDescs : undefined;
      const colDescsClean = data.colDescs.length > 0 ? data.colDescs : undefined;
      if (data.editingId) {
        await updateTemplate({
          templateId: data.editingId,
          name: data.name.trim(),
          description: data.description.trim() || null,
          rowAxisTitle: data.rowAxis.trim(),
          colAxisTitle: data.colAxis.trim(),
          rowLabels,
          colLabels,
          rowDescriptions: rowDescsClean ?? null,
          colDescriptions: colDescsClean ?? null,
          defaultMatrixValues: data.matrixValues ?? null,
        });
        toast.success("Mal oppdatert.");
      } else {
        await createTemplate({
          workspaceId,
          name: data.name.trim(),
          description: data.description.trim() || undefined,
          rowAxisTitle: data.rowAxis.trim(),
          colAxisTitle: data.colAxis.trim(),
          rowLabels: useDefault ? undefined : rowLabels,
          colLabels: useDefault ? undefined : colLabels,
          rowDescriptions: rowDescsClean,
          colDescriptions: colDescsClean,
          defaultMatrixValues: data.matrixValues ?? undefined,
        });
        toast.success(builderMode === "duplicate" ? "Kopi opprettet." : "Mal opprettet.");
      }
      setTemplateDialogOpen(false);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Kunne ikke lagre malen.",
      );
    } finally {
      setBusy(false);
    }
  }, [workspaceId, createTemplate, updateTemplate, builderMode]);

  async function submitAnalysis(e: React.FormEvent) {
    e.preventDefault();
    if (!anaTemplateId || !anaTitle.trim()) return;
    setBusy(true);
    try {
      const id = await createAnalysis({
        workspaceId,
        templateId: anaTemplateId,
        candidateId: anaCandidateId || undefined,
        orgUnitId: anaOrgUnitId || undefined,
        title: anaTitle.trim(),
        sectorPackId: anaSectorPackId,
      });
      if (rememberDefaultSectorPack) {
        await updateWorkspace({
          workspaceId,
          defaultRosSectorPackId: anaSectorPackId,
        });
      }
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
    (templates === undefined ||
      analyses === undefined ||
      (tab === "analyser" &&
        (orgUnits === undefined || candidates === undefined)))
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
  const defaultTemplateLabel =
    hub?.defaultTemplateId && templatesList.length > 0
      ? templatesList.find((template) => template._id === hub.defaultTemplateId)?.name ?? null
      : null;

  return (
    <div className="space-y-6">
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
              Status
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
                  ROS-maler
              </h2>
              <p className="text-muted-foreground mt-0.5 text-sm">
                  Lag noen få enkle maler som andre kan bruke når de starter analyser.
              </p>
            </div>
            <Button
              type="button"
              className="shrink-0 gap-2 rounded-xl"
              onClick={() => openNewTemplateDialog()}
            >
              <Plus className="size-4" aria-hidden />
              Ny mal
            </Button>
          </div>

          {templatesList.length === 0 ? (
            <div className="flex flex-col items-center gap-5 rounded-2xl border border-dashed bg-muted/5 py-16 text-center">
              <div className="bg-primary/10 flex size-16 items-center justify-center rounded-2xl">
                <Grid3x3 className="text-primary size-8" />
              </div>
              <div className="max-w-sm">
                <p className="text-foreground font-semibold">Ingen maler ennå</p>
                <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
                  En mal definerer rutenettet for risikovurderingen — velg matrisestørrelse, navngi aksene og definer nivåbetydninger.
                </p>
              </div>
              <Button
                type="button"
                className="gap-2 rounded-xl"
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
                  className={cn(
                    "group relative flex flex-col overflow-hidden rounded-2xl bg-card text-left shadow-sm outline-none transition-all ring-1 ring-black/[0.04] dark:ring-white/[0.06]",
                    "hover:shadow-lg hover:ring-primary/20",
                  )}
                >
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => openBuilderForEdit(t)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openBuilderForEdit(t);
                      }
                    }}
                    className="flex-1 cursor-pointer p-4 focus-visible:ring-2 focus-visible:ring-primary/40 outline-none"
                  >
                    <div className="mb-3 flex items-start gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 transition-colors group-hover:bg-primary/15">
                        <Grid3x3 className="size-4.5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-foreground truncate font-semibold">
                            {t.name}
                          </h3>
                          <span className="shrink-0 rounded-lg bg-muted px-2 py-0.5 text-[10px] font-bold tabular-nums text-muted-foreground">
                            {t.rowLabels.length}×{t.colLabels.length}
                          </span>
                        </div>
                        {t.description ? (
                          <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs leading-relaxed">
                            {t.description}
                          </p>
                        ) : null}
                        <p className="text-muted-foreground/60 mt-1.5 text-[10px] font-medium uppercase tracking-wider">
                          {t.rowAxisTitle} × {t.colAxisTitle}
                        </p>
                      </div>
                    </div>
                    <RosTemplatePreviewMini
                      rowLabels={t.rowLabels}
                      colLabels={t.colLabels}
                    />
                  </div>
                  <div className="flex items-center gap-1 border-t border-border/30 bg-muted/5 px-3 py-1.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 rounded-lg text-[11px] text-muted-foreground hover:text-primary"
                      onClick={() => openBuilderForEdit(t)}
                    >
                      Rediger
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 rounded-lg text-[11px] text-muted-foreground hover:text-primary"
                      onClick={() => openBuilderForDuplicate(t)}
                    >
                      Dupliser
                    </Button>
                    <div className="flex-1" />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 rounded-lg text-[11px] text-muted-foreground hover:text-destructive"
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

          <RosTemplateBuilder
            open={templateDialogOpen}
            onOpenChange={setTemplateDialogOpen}
            mode={builderMode}
            initialData={builderInitialData}
            onSubmit={handleBuilderSubmit}
            busy={busy}
          />
        </div>
      ) : (
        <>
          <section className="rounded-3xl border border-border/60 bg-gradient-to-br from-card via-card to-muted/20 p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="rounded-full px-2.5 py-1 text-[11px] font-medium">
                    {analysesList.length} analyse{analysesList.length === 1 ? "" : "r"}
                  </Badge>
                  <Badge variant="secondary" className="rounded-full px-2.5 py-1 text-[11px] font-medium">
                    {templatesList.length} mal{templatesList.length === 1 ? "" : "er"}
                  </Badge>
                  {defaultTemplateLabel ? (
                    <Badge variant="secondary" className="rounded-full px-2.5 py-1 text-[11px] font-medium">
                      Standardmal: {defaultTemplateLabel}
                    </Badge>
                  ) : null}
                </div>
                <div className="space-y-1">
                  <h2 className="font-heading text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                    Start eller fortsett ROS
                  </h2>
                  <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
                    Start en analyse, jobb ferdig og kom tilbake senere ved behov. Hold oppstarten enkel.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  className="gap-2 rounded-2xl shadow-sm"
                  onClick={() => setCreateDialogOpen(true)}
                >
                  <Plus className="size-4" aria-hidden />
                  Ny analyse
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-2xl"
                  onClick={() => setTab("maler")}
                >
                  Se maler
                </Button>
              </div>
            </div>
          </section>

          <div className="rounded-2xl border border-border/50 bg-card/55 p-4 shadow-sm">
            <p className="text-sm font-medium text-foreground">Mest brukt flyt</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Start ny ROS fra prosess, GitHub eller tom analyse. Velg mal når du starter.
            </p>
            <div className="mt-4">
              <GithubIssueStartCard
                workspaceId={workspaceId}
                variant="ros"
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-heading text-lg font-semibold tracking-tight">
                Oversikt over analyser
              </h2>
              {analysesList.length > 0 ? (
                <p className="text-muted-foreground mt-0.5 text-sm tabular-nums">
                  {filteredSortedAnalyses.length} av {analysesList.length} analyse
                  {analysesList.length !== 1 ? "r" : ""} vises
                </p>
              ) : null}
            </div>
            <Button
              type="button"
              className="shrink-0 gap-2 rounded-2xl shadow-sm"
              onClick={() => setCreateDialogOpen(true)}
            >
              <Plus className="size-4" aria-hidden />
              Ny analyse
            </Button>
          </div>

          {analysesList.length > 0 ? (
            <div className="rounded-2xl border border-border/50 bg-card/55 p-3 shadow-sm sm:p-4">
              <div className="flex flex-col gap-3">
                <SearchInput
                  value={analysisSearch}
                  onChange={(e) => setAnalysisSearch(e.target.value)}
                  placeholder="Søk i tittel, prosess eller organisasjon …"
                  aria-label="Filtrer analyser"
                />
                <FilterToolbar>
                  <NativeSelectField
                    id="ros-ana-org"
                    label="Organisasjon"
                    value={analysisOrgFilter}
                    onChange={(e) =>
                      setAnalysisOrgFilter(
                        e.target.value === "" ? "" : (e.target.value as Id<"orgUnits">),
                      )
                    }
                    aria-label="Filtrer etter organisasjonsenhet"
                    className="min-w-0 flex-1 sm:min-w-[min(100%,14rem)]"
                  >
                    <option value="">Alle enheter</option>
                    {(orgUnits ?? []).map((u) => (
                      <option key={u._id} value={u._id}>
                        {u.name}
                      </option>
                    ))}
                  </NativeSelectField>
                  <NativeSelectField
                    id="ros-ana-sort"
                    label="Sorter"
                    value={analysisSort}
                    onChange={(e) => setAnalysisSort(e.target.value as AnalysisSort)}
                    aria-label="Sorter analyser"
                    className="min-w-0 sm:w-[min(100%,12rem)]"
                  >
                    <option value="updated">Sist oppdatert</option>
                    <option value="title">Tittel A–Å</option>
                    <option value="candidate">Prosess</option>
                  </NativeSelectField>
                </FilterToolbar>
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
                const fromIntake = Boolean(
                  (a as { fromIntake?: boolean }).fromIntake,
                );
                const versionCount = (a as { versionCount?: number }).versionCount ?? 0;
                const flat = a.matrixValues.flat().map((v) => Math.min(5, Math.max(0, Math.round(v))));
                const maxLvl = Math.max(0, ...flat);
                const highCount = flat.filter((v) => v >= 4).length;
                const riskLabel = maxLvl >= 5 ? "Kritisk" : maxLvl >= 4 ? "Høy" : maxLvl >= 3 ? "Middels" : maxLvl >= 2 ? "Lav" : "Ingen";
                return (
                  <Link
                    key={a._id}
                    href={`/w/${workspaceId}/ros/a/${a._id}`}
                    className="group/card relative flex flex-col overflow-hidden rounded-3xl border border-border/50 bg-card/90 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-primary/20 active:scale-[0.995]"
                  >
                    <div className="flex flex-1 gap-4 p-5">
                      <div className="flex shrink-0 flex-col items-center gap-2">
                        <span
                          className={cn(
                            "flex size-12 items-center justify-center rounded-2xl text-lg font-bold tabular-nums shadow-sm ring-1 ring-black/5 dark:ring-white/10",
                            cellRiskClass(maxLvl),
                          )}
                        >
                          {maxLvl}
                        </span>
                        <span className={cn(
                          "text-[10px] font-semibold",
                          maxLvl >= 4 ? "text-red-600 dark:text-red-400" : maxLvl >= 3 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400",
                        )}>
                          {riskLabel}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-semibold text-foreground group-hover/card:text-primary">
                          {a.title}
                        </p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs">
                          {fromIntake ? (
                            <Badge
                              variant="secondary"
                              className="h-5 border-0 px-1.5 text-[10px] font-medium"
                            >
                              Fra skjema
                            </Badge>
                          ) : null}
                          <p className="text-muted-foreground">
                            {a.candidateName ? (
                              <>
                                {a.candidateName}{" "}
                                <span className="font-mono text-[10px]">({a.candidateCode})</span>
                              </>
                            ) : fromIntake ? (
                              <span className="text-muted-foreground">Koblet til PVV fra skjema</span>
                            ) : (
                              <span className="italic">Frittstående</span>
                            )}
                          </p>
                        </div>

                        <div className="mt-3.5 flex h-2 w-full overflow-hidden rounded-full bg-muted/40">
                          {(() => {
                            const counts = [0, 0, 0, 0, 0, 0];
                            for (const v of flat) counts[v]++;
                            const total = flat.length || 1;
                            return [5, 4, 3, 2, 1, 0].map((lvl) =>
                              counts[lvl] > 0 ? (
                                <div
                                  key={lvl}
                                  className={cn("min-w-[3px] transition-all", cellRiskClass(lvl))}
                                  style={{ width: `${(counts[lvl] / total) * 100}%` }}
                                />
                              ) : null,
                            );
                          })()}
                        </div>

                        <div className="text-muted-foreground mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px]">
                          <span>{a.rowLabels.length}×{a.colLabels.length}</span>
                          {highCount > 0 && (
                            <span className="font-semibold text-red-600 dark:text-red-400">
                              {highCount} høy/kritisk
                            </span>
                          )}
                          <span>{formatRelative(a.updatedAt)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="pointer-events-none flex items-center gap-1.5 border-t border-border/30 bg-muted/10 px-4 py-2.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setVersionsQuickDialog({ analysisId: a._id, title: a.title });
                        }}
                        className="pointer-events-auto inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                      >
                        <History className="size-3" aria-hidden />
                        {versionCount} vers.
                      </button>
                      <span className="flex-1" />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="pointer-events-auto size-8 rounded-xl text-muted-foreground/50 opacity-0 transition-opacity group-hover/card:opacity-100 hover:bg-destructive/10 hover:text-destructive"
                        title="Slett"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          requestRemoveAnalysis(a);
                        }}
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                      </Button>
                    </div>
                  </Link>
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
              Skala
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() => setMethodHelpOpen(true)}
            >
              <HelpCircle className="size-3.5" aria-hidden />
              Metode
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
                    <Label htmlFor="ana-sector">Sektor / metode</Label>
                    <select
                      id="ana-sector"
                      className="border-input bg-background flex h-10 w-full rounded-lg border px-2 text-sm"
                      value={anaSectorPackId}
                      onChange={(e) =>
                        setAnaSectorPackId(e.target.value as RosSectorPackId)
                      }
                    >
                      {listRosSectorPacks().map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <p className="text-muted-foreground text-xs leading-relaxed">
                      {listRosSectorPacks().find((p) => p.id === anaSectorPackId)
                        ?.shortDescription ?? ""}
                    </p>
                    <div className="flex items-start gap-2 pt-1">
                      <Checkbox
                        id="ana-remember-sector"
                        checked={rememberDefaultSectorPack}
                        onCheckedChange={(c) =>
                          setRememberDefaultSectorPack(Boolean(c))
                        }
                      />
                      <Label
                        htmlFor="ana-remember-sector"
                        className="text-muted-foreground cursor-pointer text-xs font-normal leading-snug"
                      >
                        Bruk denne sektoren som standard for nye ROS-analyser i
                        dette arbeidsområdet
                      </Label>
                    </div>
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
                          if (c?.orgUnitId) setAnaOrgUnitId(c.orgUnitId);
                        }
                      }}
                    >
                      <option value="">— Ingen (koble senere) —</option>
                      {(candidates ?? []).map((c) => (
                        <option key={c._id} value={c._id}>{c.name} ({c.code})</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ana-org" className="text-xs">
                      Organisasjonsenhet (valgfritt)
                    </Label>
                    <select
                      id="ana-org"
                      className="border-input bg-background flex h-10 w-full rounded-lg border px-2 text-sm"
                      value={anaOrgUnitId}
                      onChange={(e) =>
                        setAnaOrgUnitId(
                          e.target.value === "" ? "" : (e.target.value as Id<"orgUnits">),
                        )
                      }
                    >
                      <option value="">— Ikke satt —</option>
                      {(orgUnits ?? []).map((u) => (
                        <option key={u._id} value={u._id}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                    <p className="text-muted-foreground text-xs leading-relaxed">
                      Brukes i org.-tre når prosessen mangler enhet. Hvis prosessen har enhet,
                      er det den som teller i oversikter.
                    </p>
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

