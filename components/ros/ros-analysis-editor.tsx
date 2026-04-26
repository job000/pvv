"use client";

import { RosJournalPanel } from "@/components/ros/ros-journal-panel";
import { RosVersionsPanel } from "@/components/ros/ros-versions-panel";
import { RosLifecycleCompliancePanel } from "@/components/ros/ros-lifecycle-compliance-panel";
import { RosMatrix } from "@/components/ros/ros-matrix";
import { RosScaleReference } from "@/components/ros/ros-scale-reference";
import { RosLabelLevelsEditor } from "@/components/ros/ros-label-levels-editor";
import { RosRiskRegisterTable } from "@/components/ros/ros-risk-register-table";
import { RosRiskList, type FlatRisk } from "@/components/ros/ros-risk-list";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import {
  collectAllCellRiskPointsForPdf,
  collectIdentifiedRisksForPdf,
  flattenCellItemsMatrixToLegacyNotes,
  maxRiskAmongDocumentedCells,
  newRosCellItemId,
  resizeCellItemsMatrix,
  type RosCellItem,
  type RosCellItemMatrix,
  type RosPoolItem,
} from "@/lib/ros-cell-items";
import {
  DEFAULT_ROS_COL_LABELS,
  DEFAULT_ROS_ROW_LABELS,
  positionRiskLevel,
  RISK_LEVEL_HINTS,
} from "@/lib/ros-defaults";
import {
  parseLabelLines,
  resizeNumberMatrix,
} from "@/lib/ros-matrix-resize";
import {
  advanceRosReviewDate,
  parseRosReviewRecurrenceKind,
  ROS_REVIEW_RECURRENCE_OPTIONS,
  type RosReviewRecurrenceKind,
} from "@/lib/ros-review-schedule";
import { buildRosReviewIcs, downloadTextFile } from "@/lib/ros-review-ics";
import {
  COMPLIANCE_STATUS_LABELS,
  type ComplianceStatusKey,
} from "@/lib/helsesector-labels";
import { ROS_PDD_ALIGNMENT_HINT_NB } from "@/lib/ros-compliance";
import { getRosSectorPack } from "@/lib/ros-sector-packs";
import { toast } from "@/lib/app-toast";
import { toastDeleteWithUndo } from "@/lib/toast-delete-undo";
import { cellRiskClass } from "@/lib/ros-risk-colors";
import { computeMatrixItemStats } from "@/lib/ros-risk-register";
import { cn } from "@/lib/utils";
import type { RosRequirementRef } from "@/lib/ros-requirement-catalog";
import {
  downloadRosAnalysisPdf,
  formatRosRequirementRefLine,
} from "@/lib/ros-pdf";
import {
  buildRosTaskRiskLinkOptions,
  parseRosTaskRiskLink,
  riskTreatmentLabel,
  rosTaskRiskLinkValue,
  ROS_RISK_TREATMENT_OPTIONS,
  ROS_TASK_RISK_LINK_GROUP_LABELS,
  type RosTaskRiskLinkOption,
} from "@/lib/ros-task-ui";
import {
  AlertTriangle,
  ArrowRight,
  BookmarkPlus,
  Building2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  FileDown,
  Link2,
  ListTodo,
  Loader2,
  Pencil,
  Plus,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStickyState } from "@/lib/use-sticky-state";
function tsToDatetimeLocal(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatRiskPoolLinesForPdf(pool: RosPoolItem[]): string[] {
  return pool.map((it) => {
    const zone =
      it.status === "on_hold"
        ? "På vent"
        : it.status === "not_relevant"
          ? "Ikke relevant"
          : "I kø";
    const bands = [it.economicBand, it.frequencyBand]
      .map((s) => s?.trim())
      .filter(Boolean)
      .join(" · ");
    const body = it.text.trim() || "(ingen tekst)";
    return bands ? `${zone}: ${body} — ${bands}` : `${zone}: ${body}`;
  });
}

function cloneCellItemsMatrix(m: RosCellItemMatrix): RosCellItemMatrix {
  return m.map((r) => r.map((c) => [...c]));
}

/** Synk innhold fra før-tiltak-punkt til tilhørende kopi(er) i etter-matrisen (kilde-id eller samme id). */
function syncAfterMatrixFromBeforeCellItem(
  prev: RosCellItemMatrix,
  beforeItem: RosCellItem,
  beforeRow: number,
  beforeCol: number,
  br: number,
  bc: number,
): RosCellItemMatrix {
  const ar =
    beforeItem.afterRow !== undefined ? beforeItem.afterRow : beforeRow;
  const ac =
    beforeItem.afterCol !== undefined ? beforeItem.afterCol : beforeCol;
  const copy = cloneCellItemsMatrix(prev);
  let found = false;
  for (let r = 0; r < br; r++) {
    for (let c = 0; c < bc; c++) {
      const cell = copy[r]?.[c];
      if (!cell) continue;
      for (let i = 0; i < cell.length; i++) {
        const a = cell[i]!;
        if (a.sourceItemId === beforeItem.id || a.id === beforeItem.id) {
          found = true;
          cell[i] = {
            ...a,
            text: beforeItem.text,
            flags: beforeItem.flags,
            economicBand: beforeItem.economicBand,
            frequencyBand: beforeItem.frequencyBand,
            afterChangeNote: beforeItem.afterChangeNote,
          };
        }
      }
    }
  }
  if (!found && ar >= 0 && ac >= 0 && ar < br && ac < bc) {
    const row = copy[ar];
    if (!row) return copy;
    row[ac] = [
      ...(row[ac] ?? []),
      {
        id: newRosCellItemId(),
        text: beforeItem.text,
        flags: beforeItem.flags,
        sourceItemId: beforeItem.id,
        afterChangeNote: beforeItem.afterChangeNote,
        economicBand: beforeItem.economicBand,
        frequencyBand: beforeItem.frequencyBand,
      },
    ];
  }
  return copy;
}

/** Etter redigering i etter-matrise: oppdater tilsvarende punkt i før-matrisen. */
function patchBeforeMatrixFromAfterCellItems(
  prev: RosCellItemMatrix,
  afterItems: RosCellItem[],
): RosCellItemMatrix {
  const copy = prev.map((r) => r.map((c) => c.map((it) => ({ ...it }))));
  for (const a of afterItems) {
    const targetId = a.sourceItemId ?? a.id;
    let found = false;
    for (let r = 0; r < copy.length && !found; r++) {
      for (let c = 0; c < (copy[r]?.length ?? 0); c++) {
        const idx = copy[r][c].findIndex((it) => it.id === targetId);
        if (idx >= 0) {
          copy[r][c][idx] = {
            ...copy[r][c][idx],
            text: a.text,
            flags: a.flags,
            economicBand: a.economicBand,
            frequencyBand: a.frequencyBand,
            afterChangeNote: a.afterChangeNote,
          };
          found = true;
          break;
        }
      }
    }
  }
  return copy;
}

/** Én skygge-rad per identifisert risiko i etter-matrisen (også når målcelle = før-celle). */
function upsertAfterShadowForFlatRisk(
  prev: RosCellItemMatrix,
  risk: {
    id: string;
    text: string;
    flags?: string[];
    afterRow: number;
    afterCol: number;
    afterChangeNote?: string;
  },
  br: number,
  bc: number,
): RosCellItemMatrix {
  const prevRows = prev.length;
  const prevCols = prev[0]?.length ?? 0;
  const sized = resizeCellItemsMatrix(prev, prevRows, prevCols, br, bc);
  let reuseId: string | null = null;
  outer: for (const row of sized) {
    for (const cell of row) {
      for (const it of cell) {
        if (it.sourceItemId === risk.id) {
          reuseId = it.id;
          break outer;
        }
      }
    }
  }
  const copy = sized.map((r) =>
    r.map((c) => c.filter((it) => it.sourceItemId !== risk.id)),
  );
  if (
    risk.afterRow < 0 ||
    risk.afterCol < 0 ||
    risk.afterRow >= br ||
    risk.afterCol >= bc
  ) {
    return copy;
  }
  const destRow = copy[risk.afterRow];
  if (!destRow) return copy;
  destRow[risk.afterCol] = [
    ...(destRow[risk.afterCol] ?? []),
    {
      id: reuseId ?? newRosCellItemId(),
      text: risk.text,
      flags: risk.flags,
      sourceItemId: risk.id,
      afterChangeNote: risk.afterChangeNote,
    },
  ];
  return copy;
}

const ROS_EDITOR_SECTIONS = [
  { id: "risikoer", label: "Risikoer", icon: Shield },
  { id: "oppgaver", label: "Tiltak", icon: ListTodo },
  { id: "oppsummering", label: "Oversikt", icon: ArrowRight },
  { id: "pvv", label: "PVV", icon: Link2 },
  { id: "innstillinger", label: "Innstillinger", icon: CircleHelp },
] as const;

function RiskSummaryBar({
  cellItemsMatrix,
  matrixValues,
  matrixAfter,
  cellItemsAfterMatrix,
  rowLabels,
  colLabels,
  afterRowLabels,
  afterColLabels,
}: {
  cellItemsMatrix: RosCellItemMatrix;
  matrixValues: number[][];
  matrixAfter: number[][];
  cellItemsAfterMatrix: RosCellItemMatrix;
  rowLabels: string[];
  colLabels: string[];
  afterRowLabels: string[];
  afterColLabels: string[];
}) {
  const stats = useMemo(() => {
    const item = computeMatrixItemStats(
      cellItemsMatrix,
      rowLabels,
      colLabels,
      afterRowLabels,
      afterColLabels,
    );
    const maxBefore = maxRiskAmongDocumentedCells(
      matrixValues,
      cellItemsMatrix,
    ).max;
    const maxAfter = maxRiskAmongDocumentedCells(
      matrixAfter,
      cellItemsAfterMatrix,
    ).max;
    const overallLevel = maxBefore >= 5 ? "Kritisk" : maxBefore >= 4 ? "Høy" : maxBefore >= 3 ? "Middels" : maxBefore >= 2 ? "Lav" : "Ingen";
    const overallColor = maxBefore >= 5 ? "text-red-600 dark:text-red-400" : maxBefore >= 4 ? "text-orange-600 dark:text-orange-400" : maxBefore >= 3 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400";

    return {
      total: item.textItemCount,
      highBefore: item.highOrCriticalBefore,
      criticalBefore: item.criticalBefore,
      needsAction: item.needsAction,
      highAfter: item.highAfter,
      maxBefore,
      maxAfter,
      overallLevel,
      overallColor,
    };
  }, [
    cellItemsMatrix,
    cellItemsAfterMatrix,
    matrixValues,
    matrixAfter,
    rowLabels,
    colLabels,
    afterRowLabels,
    afterColLabels,
  ]);

  if (stats.total === 0) return null;

  const improved = stats.highBefore > stats.highAfter;

  return (
    <div className="bg-card/60 ring-border/40 flex flex-wrap items-center gap-2 rounded-2xl px-3 py-2 ring-1 backdrop-blur-sm sm:gap-3 sm:px-4">
      <span
        className={cn(
          "inline-flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold tabular-nums shadow-sm",
          cellRiskClass(stats.maxBefore),
        )}
        aria-hidden
      >
        {stats.maxBefore > 0 ? stats.maxBefore : "—"}
      </span>
      <span className={cn("text-sm font-semibold", stats.overallColor)}>
        {stats.overallLevel}
      </span>
      <span className="text-border" aria-hidden>
        ·
      </span>
      <span className="text-foreground/90 inline-flex items-center gap-1.5 text-xs">
        <Shield className="text-muted-foreground size-3.5" aria-hidden />
        <span className="tabular-nums font-semibold">{stats.total}</span>
        <span className="text-muted-foreground">risikoer</span>
      </span>
      {stats.highBefore > 0 && (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-xs text-red-700 ring-1 ring-red-500/15 dark:text-red-300">
          <ShieldAlert className="size-3" aria-hidden />
          <span className="tabular-nums font-semibold">{stats.highBefore}</span> høy/kritisk
        </span>
      )}
      {stats.needsAction > 0 && (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-700 ring-1 ring-amber-500/15 dark:text-amber-300">
          <AlertTriangle className="size-3" aria-hidden />
          <span className="tabular-nums font-semibold">{stats.needsAction}</span> trenger tiltak
        </span>
      )}
      {improved && (
        <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-500/15 dark:text-emerald-300">
          <ArrowRight className="size-3" aria-hidden />
          Max {stats.maxAfter} etter tiltak
        </span>
      )}
    </div>
  );
}

const ROS_MATRISE_SECTION_INDEX = 0;

const ROS_INNSTILLINGER_SECTION_INDEX = ROS_EDITOR_SECTIONS.findIndex(
  (s) => s.id === "innstillinger",
);

function RosPvvLinkFields({
  linkId,
  flags,
  highlightForPvv,
  pvvLinkNote,
  suggestedFlags,
  onSave,
}: {
  linkId: Id<"rosAnalysisAssessments">;
  flags?: string[];
  highlightForPvv?: boolean;
  pvvLinkNote?: string;
  suggestedFlags: string[];
  onSave: (patch: {
    flags?: string[];
    highlightForPvv?: boolean;
    pvvLinkNote?: string | null;
  }) => Promise<void>;
}) {
  const [flagsText, setFlagsText] = useState(() => flags?.join(", ") ?? "");
  const [highlight, setHighlight] = useState(() => Boolean(highlightForPvv));
  const [note, setNote] = useState(() => pvvLinkNote ?? "");

  useEffect(() => {
    setFlagsText(flags?.join(", ") ?? "");
    setHighlight(Boolean(highlightForPvv));
    setNote(pvvLinkNote ?? "");
  }, [linkId, flags, highlightForPvv, pvvLinkNote]);

  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Checkbox
          id={`pvv-hi-${linkId}`}
          checked={highlight}
          onCheckedChange={(c) => {
            const v = Boolean(c);
            setHighlight(v);
            void onSave({ highlightForPvv: v });
          }}
        />
        <Label htmlFor={`pvv-hi-${linkId}`} className="cursor-pointer text-xs font-normal">
          Viktig for PVV
        </Label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`pvv-flags-${linkId}`} className="text-[10px]">Flagg</Label>
          <div className="flex gap-2">
            <Input
              id={`pvv-flags-${linkId}`}
              value={flagsText}
              onChange={(e) => setFlagsText(e.target.value)}
              onBlur={(e) => {
                const v = e.currentTarget.value;
                void onSave({
                  flags: v.split(",").map((s) => s.trim()).filter(Boolean),
                });
              }}
              placeholder="rest_risk_elevated, …"
              className="rounded-lg text-xs"
            />
            {suggestedFlags.length > 0 && (
              <button
                type="button"
                className="shrink-0 rounded-lg p-2 text-amber-600 transition-colors hover:bg-amber-500/10 dark:text-amber-400"
                onClick={() => {
                  const merged = [
                    ...new Set([
                      ...flagsText.split(",").map((s) => s.trim()).filter(Boolean),
                      ...suggestedFlags,
                    ]),
                  ];
                  setFlagsText(merged.join(", "));
                  void onSave({ flags: merged });
                }}
                title="Slå inn forslag"
              >
                <Sparkles className="size-4" />
              </button>
            )}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`pvv-note-${linkId}`} className="text-[10px]">Notat til PVV</Label>
          <Textarea
            id={`pvv-note-${linkId}`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={(e) => {
              const v = e.currentTarget.value.trim();
              void onSave({ pvvLinkNote: v === "" ? null : v });
            }}
            rows={2}
            className="min-h-0 rounded-lg text-xs"
          />
        </div>
      </div>
    </div>
  );
}

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
  const router = useRouter();
  const data = useQuery(api.ros.getAnalysis, { analysisId });
  const workspace = useQuery(api.workspaces.get, { workspaceId });
  const [isDeleting, setIsDeleting] = useState(false);
  /** Etter sletting (eller mens den pågår) — ikke abonner på child-queries som kaster. */
  const rosChildQueryArgs =
    data === null || isDeleting ? ("skip" as const) : { analysisId };
  const journalEntries = useQuery(
    api.ros.listJournalEntries,
    rosChildQueryArgs,
  );
  const allAssessments = useQuery(api.ros.listAssessmentsForWorkspace, {
    workspaceId,
  });
  const versions = useQuery(api.ros.listVersions, rosChildQueryArgs);
  const tasks = useQuery(api.ros.listTasksByRosAnalysis, rosChildQueryArgs);
  const members = useQuery(api.workspaces.listMembers, { workspaceId });
  const rosTemplates = useQuery(api.ros.listTemplates, { workspaceId });
  const orgUnits = useQuery(api.orgUnits.listByWorkspace, { workspaceId });

  const updateAnalysis = useMutation(api.ros.updateAnalysis);
  const removeAnalysis = useMutation(api.ros.removeAnalysis);
  const linkAssessment = useMutation(api.ros.linkAssessment);
  const unlinkAssessment = useMutation(api.ros.unlinkAssessment);
  const updateRosAssessmentLink = useMutation(api.ros.updateRosAssessmentLink);
  const migrateLegacyAssessmentToLinks = useMutation(
    api.ros.migrateLegacyAssessmentToLinks,
  );
  const clearLegacyAssessment = useMutation(api.ros.clearLegacyAssessment);
  const createRosTask = useMutation(api.ros.createRosTask);
  const updateRosTask = useMutation(api.ros.updateRosTask);
  const removeRosTask = useMutation(api.ros.removeRosTask);
  const setRosTaskStatus = useMutation(api.ros.setRosTaskStatus);
  const createLibraryItem = useMutation(api.rosLibrary.createLibraryItem);
  const libraryCategories = useQuery(api.rosLibrary.listLibraryCategories, {
    workspaceId,
  });

  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [nextReviewLocal, setNextReviewLocal] = useState("");
  const [reviewRoutineNotes, setReviewRoutineNotes] = useState("");
  const [reviewEmailRemindersEnabled, setReviewEmailRemindersEnabled] =
    useState(true);
  const [reviewScheduleActive, setReviewScheduleActive] = useState(true);
  const [reviewRecurrenceKind, setReviewRecurrenceKind] =
    useState<RosReviewRecurrenceKind>("none");
  const [reviewMetaSaving, setReviewMetaSaving] = useState(false);
  const [methodologyStatement, setMethodologyStatement] = useState("");
  const [contextSummary, setContextSummary] = useState("");
  const [scopeAndCriteria, setScopeAndCriteria] = useState("");
  const [riskCriteriaVersion, setRiskCriteriaVersion] = useState("");
  const [axisScaleNotes, setAxisScaleNotes] = useState("");
  const [complianceScopeTags, setComplianceScopeTags] = useState<string[]>(
    [],
  );
  const [requirementRefs, setRequirementRefs] = useState<RosRequirementRef[]>(
    [],
  );
  const [riskPoolBefore, setRiskPoolBefore] = useState<RosPoolItem[]>([]);
  const [riskPoolAfter, setRiskPoolAfter] = useState<RosPoolItem[]>([]);
  const [orgUnitLocal, setOrgUnitLocal] = useState<Id<"orgUnits"> | "">("");
  const [matrix, setMatrix] = useState<number[][]>([]);
  const [cellItemsMatrix, setCellItemsMatrix] =
    useState<RosCellItemMatrix>([]);
  const [matrixAfter, setMatrixAfter] = useState<number[][]>([]);
  const [cellItemsAfterMatrix, setCellItemsAfterMatrix] =
    useState<RosCellItemMatrix>([]);
  const [matrixView, setMatrixView] = useStickyState<"before" | "after">(`ros:${analysisId}:matrixView`, "before");
  const [matrixScaleHelpOpen, setMatrixScaleHelpOpen] = useState(false);
  const [jumpRequest, setJumpRequest] = useState<{
    row: number;
    col: number;
    nonce: number;
  } | null>(null);
  const [highlightCell, setHighlightCell] = useState<[number, number] | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  const [addPvId, setAddPvId] = useState<Id<"assessments"> | "">("");

  const analysisRevisionRef = useRef<number | null>(null);
  const rosSaveQueueRef = useRef<Promise<boolean>>(Promise.resolve(true));
  const saveRef = useRef<
    ((opts?: { silent?: boolean }) => Promise<boolean>) | null
  >(null);
  const dirtyRef = useRef(false);
  const canAutosaveRef = useRef(false);
  dirtyRef.current = dirty;

  const [rosSection, setRosSection] = useStickyState(`ros:${analysisId}:section`, ROS_MATRISE_SECTION_INDEX);

  const [taskTitle, setTaskTitle] = useState("");
  const [taskDesc, setTaskDesc] = useState("");
  const [taskAssignees, setTaskAssignees] = useState<Id<"users">[]>([]);
  const [taskPriority, setTaskPriority] = useState(3);
  const [taskRiskLink, setTaskRiskLink] = useState("");
  const [taskRiskTreatment, setTaskRiskTreatment] = useState<
    "" | "mitigate" | "accept" | "transfer" | "avoid"
  >("");
  const [taskResidualNote, setTaskResidualNote] = useState("");
  const [taskDueAt, setTaskDueAt] = useState("");
  const [taskBusy, setTaskBusy] = useState(false);

  const [editingTaskId, setEditingTaskId] = useState<Id<"rosTasks"> | null>(
    null,
  );

  const [savingTaskToLibrary, setSavingTaskToLibrary] = useState<{
    taskId: Id<"rosTasks">;
    title: string;
    description?: string;
    riskText: string;
    riskFlags?: string[];
    riskLocation?: string;
  } | null>(null);
  const [saveLibTitle, setSaveLibTitle] = useState("");
  const [saveLibTiltak, setSaveLibTiltak] = useState("");
  const [saveLibCategoryId, setSaveLibCategoryId] = useState<
    Id<"rosLibraryCategories"> | ""
  >("");
  const [saveLibVisibility, setSaveLibVisibility] = useState<
    "workspace" | "shared"
  >("workspace");
  const [saveLibBusy, setSaveLibBusy] = useState(false);

  const [useSeparateAfterAxes, setUseSeparateAfterAxes] = useState(false);
  const [rowAxisTitleAfter, setRowAxisTitleAfter] = useState("");
  const [colAxisTitleAfter, setColAxisTitleAfter] = useState("");
  const [rowLabelsAfterText, setRowLabelsAfterText] = useState("");
  const [colLabelsAfterText, setColLabelsAfterText] = useState("");

  useEffect(() => {
    analysisRevisionRef.current = data?.revision ?? 0;
  }, [data?._id, data?.revision]);

  useEffect(() => {
    rosSaveQueueRef.current = Promise.resolve(true);
  }, [analysisId]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (rosSection === ROS_MATRISE_SECTION_INDEX) return;
      const t = e.target;
      if (
        t instanceof HTMLInputElement ||
        t instanceof HTMLTextAreaElement ||
        t instanceof HTMLSelectElement ||
        (t instanceof HTMLElement && t.isContentEditable)
      ) {
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setRosSection((s) => Math.max(0, s - 1));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setRosSection((s) =>
          Math.min(ROS_EDITOR_SECTIONS.length - 1, s + 1),
        );
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [rosSection]);

  /** Liste-lenke «Versjoner» (#versjoner) → steget Innstillinger + scroll til panel. */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const go = () => {
      if (window.location.hash !== "#versjoner") return;
      if (ROS_INNSTILLINGER_SECTION_INDEX < 0) return;
      setRosSection(ROS_INNSTILLINGER_SECTION_INDEX);
      requestAnimationFrame(() => {
        document.getElementById("ros-versjoner")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    };
    go();
    window.addEventListener("hashchange", go);
    return () => window.removeEventListener("hashchange", go);
  }, []);

  useEffect(() => {
    if (!data) return;
    setTitle(data.title);
    setNotes(data.notes ?? "");
    setMatrix(data.matrixValues.map((r) => [...r]));
    setCellItemsMatrix(
      (data.cellItems ?? []).map((r) =>
        r.map((c) => c.map((it) => ({ ...it }))),
      ),
    );
    setMatrixAfter(data.matrixValuesAfter.map((r) => [...r]));
    setCellItemsAfterMatrix(
      (data.cellItemsAfter ?? []).map((r) =>
        r.map((c) => c.map((it) => ({ ...it }))),
      ),
    );
    setUseSeparateAfterAxes(data.afterAxis.separateLayout);
    setRowAxisTitleAfter(data.afterAxis.rowAxisTitle);
    setColAxisTitleAfter(data.afterAxis.colAxisTitle);
    setRowLabelsAfterText(data.afterAxis.rowLabels.join("\n"));
    setColLabelsAfterText(data.afterAxis.colLabels.join("\n"));
    setNextReviewLocal(
      data.nextReviewAt != null ? tsToDatetimeLocal(data.nextReviewAt) : "",
    );
    setReviewRoutineNotes(data.reviewRoutineNotes ?? "");
    setReviewEmailRemindersEnabled(data.reviewEmailRemindersEnabled !== false);
    setReviewScheduleActive(data.reviewScheduleActive !== false);
    setReviewRecurrenceKind(
      parseRosReviewRecurrenceKind(data.reviewRecurrenceKind),
    );
    setMethodologyStatement(data.methodologyStatement ?? "");
    setContextSummary(data.contextSummary ?? "");
    setScopeAndCriteria(data.scopeAndCriteria ?? "");
    setRiskCriteriaVersion(data.riskCriteriaVersion ?? "");
    setAxisScaleNotes(data.axisScaleNotes ?? "");
    setComplianceScopeTags(
      data.complianceScopeTags ? [...data.complianceScopeTags] : [],
    );
    setRequirementRefs(
      data.requirementRefs
        ? data.requirementRefs.map((r) => ({ ...r }))
        : [],
    );
    setRiskPoolBefore(
      (data.riskPoolBefore ?? []).map((x) => ({ ...x })),
    );
    setRiskPoolAfter(
      (data.riskPoolAfter ?? []).map((x) => ({ ...x })),
    );
    setOrgUnitLocal(data.orgUnitId ?? "");
    setDirty(false);
  // Synk kun ved server-oppdatering (id/tidsstempel), ikke ved hver query-referanse
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?._id, data?.updatedAt]);

  const effectiveAfterRowLabels = useMemo(() => {
    if (!data) return [];
    if (useSeparateAfterAxes) {
      const p = parseLabelLines(rowLabelsAfterText);
      return p.length >= 2 ? p : data.afterAxis.rowLabels;
    }
    return data.rowLabels;
  }, [data, useSeparateAfterAxes, rowLabelsAfterText]);

  const effectiveAfterColLabels = useMemo(() => {
    if (!data) return [];
    if (useSeparateAfterAxes) {
      const p = parseLabelLines(colLabelsAfterText);
      return p.length >= 2 ? p : data.afterAxis.colLabels;
    }
    return data.colLabels;
  }, [data, useSeparateAfterAxes, colLabelsAfterText]);

  const taskRiskLinkOptions = useMemo(() => {
    if (!data) {
      return [{ value: "", label: "— Ingen kobling —" }];
    }
    return buildRosTaskRiskLinkOptions({
      cellItemsMatrix,
      cellItemsAfterMatrix,
      rowLabels: data.rowLabels,
      colLabels: data.colLabels,
      afterRowLabels: effectiveAfterRowLabels,
      afterColLabels: effectiveAfterColLabels,
    });
  }, [
    data,
    cellItemsMatrix,
    cellItemsAfterMatrix,
    effectiveAfterRowLabels,
    effectiveAfterColLabels,
  ]);

  /**
   * Oppslag fra «phase:id» til den underliggende risiko-/celleteksten,
   * brukt både til visning (chip på tiltak) og «lagre i bibliotek»
   * der vi trenger fullstendig risikotekst og posisjon.
   */
  const linkedRiskLookup = useMemo(() => {
    const map = new Map<
      string,
      {
        text: string;
        flags?: string[];
        rowLabel: string;
        colLabel: string;
        phase: "before" | "after";
        level: number;
      }
    >();
    if (!data) return map;
    const before = cellItemsMatrix;
    const after = cellItemsAfterMatrix;
    for (let r = 0; r < before.length; r++) {
      const row = before[r];
      if (!row) continue;
      for (let c = 0; c < row.length; c++) {
        const cell = row[c];
        if (!cell) continue;
        for (const it of cell) {
          map.set(`before:${it.id}`, {
            text: it.text,
            flags: it.flags,
            rowLabel: data.rowLabels[r] ?? `R${r + 1}`,
            colLabel: data.colLabels[c] ?? `K${c + 1}`,
            phase: "before",
            level: matrix[r]?.[c] ?? 0,
          });
        }
      }
    }
    for (let r = 0; r < after.length; r++) {
      const row = after[r];
      if (!row) continue;
      for (let c = 0; c < row.length; c++) {
        const cell = row[c];
        if (!cell) continue;
        for (const it of cell) {
          map.set(`after:${it.id}`, {
            text: it.text,
            flags: it.flags,
            rowLabel: effectiveAfterRowLabels[r] ?? `R${r + 1}`,
            colLabel: effectiveAfterColLabels[c] ?? `K${c + 1}`,
            phase: "after",
            level: matrixAfter[r]?.[c] ?? 0,
          });
        }
      }
    }
    return map;
  }, [
    data,
    cellItemsMatrix,
    cellItemsAfterMatrix,
    effectiveAfterRowLabels,
    effectiveAfterColLabels,
    matrix,
    matrixAfter,
  ]);

  /** Revisjonspåminnelse på e-post går til `createdByUserId` (Convex `reminderInternal`). */
  const rosReviewReminderRecipientLine = useMemo(() => {
    if (!data) return null;
    const creatorId = data.createdByUserId;
    const m = members?.find((row) => row.userId === creatorId);
    const name = m?.name?.trim() || null;
    const email = m?.email?.trim() || null;
    if (name && email) return `${name} (${email})`;
    if (email) return email;
    if (name) {
      return `${name} — ingen e-post registrert på kontoen (ingen e-post sendes).`;
    }
    return null;
  }, [data, members]);

  /**
   * Identifiserer risikopunkter i før-matrisen som ikke har et tiltak knyttet
   * til seg. Følger NS 5814 / ISO 31000: alle høye/kritiske risikoer skal
   * enten behandles eller formelt aksepteres. Liste sorteres på risikonivå
   * (høyest først) og brukes til varsel-banner i Tiltak-fanen.
   */
  type UncoveredRisk = {
    id: string;
    text: string;
    rowLabel: string;
    colLabel: string;
    level: number;
  };
  const uncoveredBeforeRisks = useMemo<UncoveredRisk[]>(() => {
    if (!data || !tasks) return [];
    const covered = new Set<string>();
    for (const t of tasks) {
      if (t.linkedCellItemId && t.linkedCellItemPhase === "before") {
        covered.add(t.linkedCellItemId);
      }
    }
    const out: UncoveredRisk[] = [];
    for (let r = 0; r < cellItemsMatrix.length; r++) {
      const row = cellItemsMatrix[r];
      if (!row) continue;
      for (let c = 0; c < row.length; c++) {
        const cell = row[c];
        if (!cell) continue;
        const lvl = matrix[r]?.[c] ?? 0;
        for (const it of cell) {
          if (covered.has(it.id)) continue;
          out.push({
            id: it.id,
            text: it.text,
            rowLabel: data.rowLabels[r] ?? `R${r + 1}`,
            colLabel: data.colLabels[c] ?? `K${c + 1}`,
            level: lvl,
          });
        }
      }
    }
    out.sort((a, b) => b.level - a.level);
    return out;
  }, [data, tasks, cellItemsMatrix, matrix]);

  function startAddTaskForRisk(riskId: string) {
    setTaskRiskLink(`before:${riskId}`);
    if (!taskRiskTreatment) setTaskRiskTreatment("mitigate");
    requestAnimationFrame(() => {
      const el = document.getElementById(
        "ros-quick-task-title",
      ) as HTMLInputElement | null;
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
      el?.focus();
    });
  }

  /** Auto-lagring: ikke forsøk hvis skjema ville avvist manuell lagring (unngå støy). */
  const canAutosave = useMemo(() => {
    if (!data) return false;
    if (useSeparateAfterAxes) {
      const tr = parseLabelLines(rowLabelsAfterText).length;
      const tc = parseLabelLines(colLabelsAfterText).length;
      if (tr < 2 || tc < 2) return false;
    }
    const rawNext = nextReviewLocal.trim();
    if (rawNext !== "") {
      const parsed = new Date(rawNext).getTime();
      if (!Number.isFinite(parsed)) return false;
    }
    return true;
  }, [
    data,
    useSeparateAfterAxes,
    rowLabelsAfterText,
    colLabelsAfterText,
    nextReviewLocal,
  ]);
  canAutosaveRef.current = canAutosave;

  /** Liste + PDF-lignende tabell (før/etter) — samme data som matrisen. */
  const riskRegisterSnapshot = useMemo(() => {
    if (!data) return null;
    const br = effectiveAfterRowLabels.length;
    const bc = effectiveAfterColLabels.length;
    if (br < 1 || bc < 1) return null;
    const matrixAfterSized = resizeNumberMatrix(matrixAfter, br, bc);
    const cellItemsAfterSized = resizeCellItemsMatrix(
      cellItemsAfterMatrix,
      matrixAfter.length,
      matrixAfter[0]?.length ?? 0,
      br,
      bc,
    );
    return {
      before: {
        rowLabels: data.rowLabels,
        colLabels: data.colLabels,
        matrixValues: matrix,
        cellItems: cellItemsMatrix,
      },
      after: {
        rowLabels: effectiveAfterRowLabels,
        colLabels: effectiveAfterColLabels,
        matrixValues: matrixAfterSized,
        cellItems: cellItemsAfterSized,
      },
    };
  }, [
    data,
    matrix,
    cellItemsMatrix,
    matrixAfter,
    cellItemsAfterMatrix,
    effectiveAfterRowLabels,
    effectiveAfterColLabels,
  ]);

  const syncAfterMatrixToParsedLabels = useCallback(
    (rowOverride?: string, colOverride?: string) => {
      if (!useSeparateAfterAxes || !data) return;
      const rl = parseLabelLines(rowOverride ?? rowLabelsAfterText);
      const cl = parseLabelLines(colOverride ?? colLabelsAfterText);
      if (rl.length < 2 || cl.length < 2) return;
      setMatrixAfter((prev) => resizeNumberMatrix(prev, rl.length, cl.length));
      setCellItemsAfterMatrix((prev) =>
        resizeCellItemsMatrix(
          prev,
          prev.length,
          prev[0]?.length ?? 0,
          rl.length,
          cl.length,
        ),
      );
      setDirty(true);
    },
    [useSeparateAfterAxes, data, rowLabelsAfterText, colLabelsAfterText],
  );

  const onRowLabelsAfterChange = useCallback(
    (next: string) => {
      setRowLabelsAfterText(next);
      setDirty(true);
      syncAfterMatrixToParsedLabels(next, colLabelsAfterText);
    },
    [colLabelsAfterText, syncAfterMatrixToParsedLabels],
  );

  const onColLabelsAfterChange = useCallback(
    (next: string) => {
      setColLabelsAfterText(next);
      setDirty(true);
      syncAfterMatrixToParsedLabels(rowLabelsAfterText, next);
    },
    [rowLabelsAfterText, syncAfterMatrixToParsedLabels],
  );

  const copyBeforeAxesToAfter = useCallback(() => {
    if (!data) return;
    const r = data.rowLabels.join("\n");
    const c = data.colLabels.join("\n");
    setRowLabelsAfterText(r);
    setColLabelsAfterText(c);
    setRowAxisTitleAfter(data.rowAxisTitle);
    setColAxisTitleAfter(data.colAxisTitle);
    setDirty(true);
    if (useSeparateAfterAxes) {
      syncAfterMatrixToParsedLabels(r, c);
    }
  }, [data, useSeparateAfterAxes, syncAfterMatrixToParsedLabels]);

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
      if (matrixView === "after") {
        setMatrixAfter((prev) => {
          const copy = prev.map((r) => [...r]);
          if (!copy[row]) return prev;
          copy[row][col] = next;
          return copy;
        });
      } else {
        setMatrix((prev) => {
          const copy = prev.map((r) => [...r]);
          if (!copy[row]) return prev;
          copy[row][col] = next;
          return copy;
        });
      }
      setDirty(true);
    },
    [matrixView],
  );

  const onCellItemsChange = useCallback(
    (row: number, col: number, items: RosCellItem[]) => {
      const br = effectiveAfterRowLabels.length;
      const bc = effectiveAfterColLabels.length;

      if (matrixView === "after") {
        setCellItemsAfterMatrix((prev) => {
          const copy = prev.map((r) => r.map((c) => [...c]));
          if (!copy[row]) return prev;
          copy[row][col] = items;
          return copy;
        });
        setCellItemsMatrix((prev) =>
          patchBeforeMatrixFromAfterCellItems(prev, items),
        );
      } else {
        const prevCell = cellItemsMatrix[row]?.[col] ?? [];
        const removedIds = prevCell
          .filter((p) => !items.some((i) => i.id === p.id))
          .map((p) => p.id);

        setCellItemsMatrix((prev) => {
          const copy = prev.map((r) => r.map((c) => [...c]));
          if (!copy[row]) return prev;
          copy[row][col] = items;
          return copy;
        });

        if (br >= 1 && bc >= 1) {
          setCellItemsAfterMatrix((prev) => {
            const prevRows = prev.length;
            const prevCols = prev[0]?.length ?? 0;
            const filtered = prev.map((r) =>
              r.map((c) =>
                c.filter(
                  (it) =>
                    !removedIds.includes(it.id) &&
                    !(it.sourceItemId &&
                      removedIds.includes(it.sourceItemId)),
                ),
              ),
            );
            let copy = resizeCellItemsMatrix(
              filtered,
              prevRows,
              prevCols,
              br,
              bc,
            );
            for (const it of items) {
              copy = syncAfterMatrixFromBeforeCellItem(
                copy,
                it,
                row,
                col,
                br,
                bc,
              );
            }
            return copy;
          });
        }

        setMatrixAfter((prev) => {
          if (br < 1 || bc < 1) return prev;
          const copy = resizeNumberMatrix(prev, br, bc);
          for (const it of items) {
            const ar = it.afterRow !== undefined ? it.afterRow : row;
            const ac = it.afterCol !== undefined ? it.afterCol : col;
            if (ar < 0 || ac < 0 || ar >= br || ac >= bc) continue;
            const cur = copy[ar][ac] ?? 0;
            if (cur <= 0) {
              copy[ar][ac] = positionRiskLevel(ar, ac, br, bc);
            }
          }
          return copy;
        });
      }
      setDirty(true);
    },
    [
      matrixView,
      cellItemsMatrix,
      effectiveAfterColLabels.length,
      effectiveAfterRowLabels.length,
    ],
  );

  const moveMatrixCellContents = useCallback(
    (fromRow: number, fromCol: number, toRow: number, toCol: number) => {
      if (fromRow === toRow && fromCol === toCol) return;

      if (matrixView === "after") {
        const br = effectiveAfterRowLabels.length;
        const bc = effectiveAfterColLabels.length;
        if (
          toRow < 0 ||
          toCol < 0 ||
          toRow >= br ||
          toCol >= bc ||
          fromRow < 0 ||
          fromCol < 0 ||
          fromRow >= br ||
          fromCol >= bc
        ) {
          return;
        }
        setCellItemsAfterMatrix((prev) => {
          const moving = prev[fromRow]?.[fromCol] ?? [];
          if (moving.length === 0) return prev;

          const copy = prev.map((r) => r.map((c) => [...c]));
          const dest = copy[toRow]?.[toCol] ?? [];
          copy[fromRow][fromCol] = [];
          copy[toRow][toCol] = [...dest, ...moving];
          const mergedDest = copy[toRow][toCol];

          const sourceIds = moving
            .map((it) => it.sourceItemId)
            .filter((id): id is string => Boolean(id));
          if (sourceIds.length > 0) {
            const idSet = new Set(sourceIds);
            setCellItemsMatrix((prevB) => {
              const bCopy = prevB.map((r) =>
                r.map((c) => c.map((it) => ({ ...it }))),
              );
              for (let r = 0; r < bCopy.length; r++) {
                for (let c = 0; c < bCopy[r].length; c++) {
                  for (let k = 0; k < bCopy[r][c].length; k++) {
                    const it = bCopy[r][c][k];
                    if (idSet.has(it.id)) {
                      bCopy[r][c][k] = {
                        ...it,
                        afterRow: toRow,
                        afterCol: toCol,
                      };
                    }
                  }
                }
              }
              return bCopy;
            });
          }

          setMatrixAfter((prevM) => {
            const m = resizeNumberMatrix(prevM, br, bc);
            m[fromRow][fromCol] = 0;
            if (mergedDest.length > 0) {
              const cur = m[toRow][toCol] ?? 0;
              if (cur <= 0) {
                m[toRow][toCol] = positionRiskLevel(toRow, toCol, br, bc);
              }
            }
            return m;
          });
          return copy;
        });
        setDirty(true);
        return;
      }

      if (!data) return;
      const br = data.rowLabels.length;
      const bc = data.colLabels.length;
      if (
        toRow < 0 ||
        toCol < 0 ||
        toRow >= br ||
        toCol >= bc ||
        fromRow < 0 ||
        fromCol < 0 ||
        fromRow >= br ||
        fromCol >= bc
      ) {
        return;
      }

      setCellItemsMatrix((prev) => {
        const moving = prev[fromRow]?.[fromCol] ?? [];
        if (moving.length === 0) return prev;

        const copy = prev.map((r) => r.map((c) => [...c]));
        const dest = copy[toRow]?.[toCol] ?? [];
        copy[fromRow][fromCol] = [];
        copy[toRow][toCol] = [...dest, ...moving];
        const mergedDest = copy[toRow][toCol];

        setMatrix((prevM) => {
          const m = resizeNumberMatrix(prevM, br, bc);
          m[fromRow][fromCol] = 0;
          if (mergedDest.length > 0) {
            const cur = m[toRow][toCol] ?? 0;
            if (cur <= 0) {
              m[toRow][toCol] = positionRiskLevel(toRow, toCol, br, bc);
            }
          }
          return m;
        });
        return copy;
      });
      setDirty(true);
    },
    [
      data,
      matrixView,
      effectiveAfterRowLabels.length,
      effectiveAfterColLabels.length,
    ],
  );

  /** Removes any existing after-copy of a before-item from ALL cells and clears the before-item's afterRow/afterCol */
  const removeAfterCopyEverywhere = useCallback(
    (itemId: string) => {
      setCellItemsAfterMatrix((prev) =>
        prev.map((r) =>
          r.map((c) => c.filter((it) => it.sourceItemId !== itemId)),
        ),
      );
      setCellItemsMatrix((prev) =>
        prev.map((r) =>
          r.map((c) =>
            c.map((it) =>
              it.id === itemId
                ? { ...it, afterRow: undefined, afterCol: undefined }
                : it,
            ),
          ),
        ),
      );
    },
    [],
  );

  const onPlaceInAfter = useCallback(
    (
      itemId: string,
      itemText: string,
      itemFlags: string[] | undefined,
      afterRow: number,
      afterCol: number,
    ) => {
      removeAfterCopyEverywhere(itemId);

      setCellItemsAfterMatrix((prev) => {
        const copy = prev.map((r) => r.map((c) => [...c]));
        if (!copy[afterRow]) return prev;
        copy[afterRow][afterCol] = [
          ...(copy[afterRow][afterCol] ?? []),
          {
            id: newRosCellItemId(),
            text: itemText,
            flags: itemFlags,
            sourceItemId: itemId,
          },
        ];
        return copy;
      });
      setMatrixAfter((prev) => {
        const copy = prev.map((r) => [...r]);
        if (!copy[afterRow]) return prev;
        const cur = copy[afterRow][afterCol] ?? 0;
        if (cur <= 0) {
          copy[afterRow][afterCol] = positionRiskLevel(
            afterRow,
            afterCol,
            effectiveAfterRowLabels.length,
            effectiveAfterColLabels.length,
          );
        }
        return copy;
      });
      setDirty(true);
    },
    [removeAfterCopyEverywhere, effectiveAfterRowLabels.length, effectiveAfterColLabels.length],
  );

  const onRemoveAfterPlacement = useCallback(
    (itemId: string) => {
      removeAfterCopyEverywhere(itemId);
      setDirty(true);
    },
    [removeAfterCopyEverywhere],
  );

  const onAssignBeforeItem = useCallback(
    (
      itemId: string,
      sourceRow: number,
      sourceCol: number,
      afterRow: number,
      afterCol: number,
    ) => {
      const beforeItem = cellItemsMatrix[sourceRow]?.[sourceCol]?.find(
        (it) => it.id === itemId,
      );
      if (!beforeItem) return;

      removeAfterCopyEverywhere(itemId);

      setCellItemsMatrix((prev) => {
        const copy = prev.map((r) => r.map((c) => c.map((it) => ({ ...it }))));
        const cell = copy[sourceRow]?.[sourceCol];
        if (!cell) return prev;
        const idx = cell.findIndex((it) => it.id === itemId);
        if (idx >= 0) {
          cell[idx] = { ...cell[idx], afterRow, afterCol };
        }
        return copy;
      });

      setCellItemsAfterMatrix((prev) => {
        const copy = prev.map((r) => r.map((c) => [...c]));
        if (!copy[afterRow]) return prev;
        copy[afterRow][afterCol] = [
          ...(copy[afterRow][afterCol] ?? []),
          {
            id: newRosCellItemId(),
            text: beforeItem.text,
            flags: beforeItem.flags ? [...beforeItem.flags] : undefined,
            sourceItemId: itemId,
          },
        ];
        return copy;
      });

      setMatrixAfter((prev) => {
        const copy = prev.map((r) => [...r]);
        if (!copy[afterRow]) return prev;
        const cur = copy[afterRow][afterCol] ?? 0;
        if (cur <= 0) {
          copy[afterRow][afterCol] = positionRiskLevel(
            afterRow,
            afterCol,
            effectiveAfterRowLabels.length,
            effectiveAfterColLabels.length,
          );
        }
        return copy;
      });

      setDirty(true);
    },
    [cellItemsMatrix, removeAfterCopyEverywhere, effectiveAfterRowLabels.length, effectiveAfterColLabels.length],
  );

  const handleJumpToCell = useCallback(
    (row: number, col: number, phase?: "before" | "after") => {
      setMatrixView(phase ?? "before");
      setJumpRequest({ row, col, nonce: Date.now() });
    },
    [],
  );

  const onAddRisk = useCallback(
    (risk: FlatRisk) => {
      setCellItemsMatrix((prev) => {
        const copy = prev.map((r) => r.map((c) => [...c]));
        if (!copy[risk.beforeRow]) return prev;
        if (!copy[risk.beforeRow][risk.beforeCol])
          copy[risk.beforeRow][risk.beforeCol] = [];
        copy[risk.beforeRow][risk.beforeCol].push({
          id: risk.id,
          text: risk.text,
          flags: risk.flags,
          afterRow: risk.afterRow,
          afterCol: risk.afterCol,
          afterChangeNote: risk.afterChangeNote,
        });
        return copy;
      });
      setMatrix((prev) => {
        const copy = prev.map((r) => [...r]);
        if (!copy[risk.beforeRow]) return prev;
        const cur = copy[risk.beforeRow][risk.beforeCol] ?? 0;
        if (cur <= 0 && data) {
          copy[risk.beforeRow][risk.beforeCol] = positionRiskLevel(
            risk.beforeRow,
            risk.beforeCol,
            data.rowLabels.length,
            data.colLabels.length,
          );
        }
        return copy;
      });
      const br = effectiveAfterRowLabels.length;
      const bc = effectiveAfterColLabels.length;
      if (br >= 1 && bc >= 1) {
        setCellItemsAfterMatrix((prev) =>
          upsertAfterShadowForFlatRisk(prev, risk, br, bc),
        );
        setMatrixAfter((prev) => {
          const copy = resizeNumberMatrix(prev, br, bc);
          if (
            risk.afterRow >= 0 &&
            risk.afterCol >= 0 &&
            risk.afterRow < br &&
            risk.afterCol < bc
          ) {
            const cur = copy[risk.afterRow][risk.afterCol] ?? 0;
            if (cur <= 0) {
              copy[risk.afterRow][risk.afterCol] = positionRiskLevel(
                risk.afterRow,
                risk.afterCol,
                br,
                bc,
              );
            }
          }
          return copy;
        });
      }
      setDirty(true);
    },
    [
      data,
      effectiveAfterColLabels.length,
      effectiveAfterRowLabels.length,
    ],
  );

  const onUpdateRisk = useCallback(
    (risk: FlatRisk) => {
      setCellItemsMatrix((prev) => {
        const copy = prev.map((r) => r.map((c) => [...c]));
        let found = false;
        for (let r = 0; r < copy.length; r++) {
          for (let c = 0; c < (copy[r]?.length ?? 0); c++) {
            const idx = copy[r][c].findIndex((it) => it.id === risk.id);
            if (idx >= 0) {
              found = true;
              if (r === risk.beforeRow && c === risk.beforeCol) {
                copy[r][c][idx] = {
                  ...copy[r][c][idx],
                  text: risk.text,
                  flags: risk.flags,
                  afterRow: risk.afterRow,
                  afterCol: risk.afterCol,
                  afterChangeNote: risk.afterChangeNote,
                };
              } else {
                const [item] = copy[r][c].splice(idx, 1);
                if (!copy[risk.beforeRow]) return prev;
                if (!copy[risk.beforeRow][risk.beforeCol])
                  copy[risk.beforeRow][risk.beforeCol] = [];
                copy[risk.beforeRow][risk.beforeCol].push({
                  ...item,
                  text: risk.text,
                  flags: risk.flags,
                  afterRow: risk.afterRow,
                  afterCol: risk.afterCol,
                  afterChangeNote: risk.afterChangeNote,
                });
              }
              break;
            }
          }
          if (found) break;
        }
        return copy;
      });

      if (data) {
        setMatrix((prev) => {
          const copy = prev.map((r) => [...r]);
          if (!copy[risk.beforeRow]) return prev;
          const cur = copy[risk.beforeRow][risk.beforeCol] ?? 0;
          if (cur <= 0) {
            copy[risk.beforeRow][risk.beforeCol] = positionRiskLevel(
              risk.beforeRow,
              risk.beforeCol,
              data.rowLabels.length,
              data.colLabels.length,
            );
          }
          return copy;
        });
      }

      /**
       * Ikke bruk `removeAfterCopyEverywhere` her — den nullstiller `afterRow`/`afterCol`
       * på kilden og overskriver nettopp lagrede målceller (dropdown + matrise «etter tiltak»).
       * Én skygge-kopi i etter-matrisen per risiko (også når målcelle = før-celle).
       */
      const br = effectiveAfterRowLabels.length;
      const bc = effectiveAfterColLabels.length;

      if (br >= 1 && bc >= 1) {
        setCellItemsAfterMatrix((prev) =>
          upsertAfterShadowForFlatRisk(prev, risk, br, bc),
        );
      }

      setMatrixAfter((prev) => {
        if (br < 1 || bc < 1) return prev;
        const copy = resizeNumberMatrix(prev, br, bc);
        if (
          risk.afterRow >= 0 &&
          risk.afterCol >= 0 &&
          risk.afterRow < br &&
          risk.afterCol < bc
        ) {
          const cur = copy[risk.afterRow][risk.afterCol] ?? 0;
          if (cur <= 0) {
            copy[risk.afterRow][risk.afterCol] = positionRiskLevel(
              risk.afterRow,
              risk.afterCol,
              br,
              bc,
            );
          }
        }
        return copy;
      });

      setDirty(true);
    },
    [data, effectiveAfterRowLabels.length, effectiveAfterColLabels.length],
  );

  const onDeleteRisk = useCallback(
    (riskId: string, beforeRow: number, beforeCol: number) => {
      setCellItemsMatrix((prev) => {
        const copy = prev.map((r) => r.map((c) => [...c]));
        if (copy[beforeRow]?.[beforeCol]) {
          copy[beforeRow][beforeCol] = copy[beforeRow][beforeCol].filter(
            (it) => it.id !== riskId,
          );
        }
        return copy;
      });
      removeAfterCopyEverywhere(riskId);
      setDirty(true);
    },
    [removeAfterCopyEverywhere],
  );

  const copyBeforeToAfter = useCallback(() => {
    if (!data) return;
    if (useSeparateAfterAxes) {
      const rl = parseLabelLines(rowLabelsAfterText);
      const cl = parseLabelLines(colLabelsAfterText);
      if (rl.length < 2 || cl.length < 2) {
        toast.error(
          "Angi minst to rader og to kolonner i etter-akser før du kopierer.",
        );
        return;
      }
      const m = resizeNumberMatrix(matrix, rl.length, cl.length);
      const ci = resizeCellItemsMatrix(
        cellItemsMatrix,
        matrix.length,
        matrix[0]?.length ?? 0,
        rl.length,
        cl.length,
      );
      setMatrixAfter(m);
      setCellItemsAfterMatrix(ci);
    } else {
      setMatrixAfter(matrix.map((r) => [...r]));
      setCellItemsAfterMatrix(
        cellItemsMatrix.map((r) =>
          r.map((c) => c.map((it) => ({ ...it }))),
        ),
      );
    }
    setDirty(true);
  }, [
    data,
    matrix,
    cellItemsMatrix,
    useSeparateAfterAxes,
    rowLabelsAfterText,
    colLabelsAfterText,
  ]);

  const beforeStats = useMemo(
    () => maxRiskAmongDocumentedCells(matrix, cellItemsMatrix),
    [matrix, cellItemsMatrix],
  );
  const afterStats = useMemo(
    () => maxRiskAmongDocumentedCells(matrixAfter, cellItemsAfterMatrix),
    [matrixAfter, cellItemsAfterMatrix],
  );

  const pddAlignmentHint = useMemo(() => {
    if (!data) return false;
    const high = beforeStats.max >= 4 || afterStats.max >= 4;
    if (!high) return false;
    return data.linkedAssessments.some((l) => {
      const s = l.pddStatus ?? "not_started";
      return s === "not_started" || s === "in_progress";
    });
  }, [data, beforeStats.max, afterStats.max]);

  const afterMatrixInvalid =
    matrixView === "after" &&
    useSeparateAfterAxes &&
    (effectiveAfterRowLabels.length < 2 || effectiveAfterColLabels.length < 2);

  const matrixRowAxisTitle =
    !data || matrixView === "before" || !useSeparateAfterAxes
      ? data?.rowAxisTitle ?? ""
      : rowAxisTitleAfter;
  const matrixColAxisTitle =
    !data || matrixView === "before" || !useSeparateAfterAxes
      ? data?.colAxisTitle ?? ""
      : colAxisTitleAfter;
  const matrixRowLabels =
    !data || matrixView === "before" || !useSeparateAfterAxes
      ? data?.rowLabels ?? []
      : effectiveAfterRowLabels;
  const matrixColLabels =
    !data || matrixView === "before" || !useSeparateAfterAxes
      ? data?.colLabels ?? []
      : effectiveAfterColLabels;

  async function flushOrgUnit() {
    if (!data) return;
    const desired =
      orgUnitLocal === "" ? null : orgUnitLocal;
    const current = data.orgUnitId ?? null;
    if (desired === current) return;
    const rev = analysisRevisionRef.current ?? data.revision ?? 0;
    try {
      const result = await updateAnalysis({
        analysisId,
        expectedRevision: rev,
        orgUnitId: desired,
      });
      if (result.ok) {
        analysisRevisionRef.current = result.revision;
        toast.success("Organisasjonsenhet lagret.");
      } else {
        toast.error(
          "ROS-analysen er allerede oppdatert på serveren. Last siden på nytt og prøv igjen.",
        );
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kunne ikke lagre.");
    }
  }

  async function patchRosReviewFields(patch: {
    reviewEmailRemindersEnabled?: boolean | null;
    reviewScheduleActive?: boolean | null;
    reviewRecurrenceKind?: RosReviewRecurrenceKind | null;
    lastFormalReviewCompletedAt?: number | null;
    nextReviewAt?: number | null;
    reviewRoutineNotes?: string | null;
  }): Promise<boolean> {
    if (!data) return false;
    const rev = analysisRevisionRef.current ?? data.revision ?? 0;
    setReviewMetaSaving(true);
    try {
      const result = await updateAnalysis({
        analysisId,
        expectedRevision: rev,
        ...patch,
      });
      if (result.ok) {
        analysisRevisionRef.current = result.revision;
        return true;
      }
      toast.error(
        "ROS-analysen er allerede oppdatert på serveren. Last siden på nytt og prøv igjen.",
      );
      return false;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kunne ikke lagre.");
      return false;
    } finally {
      setReviewMetaSaving(false);
    }
  }

  async function flushReviewSchedule(nextReviewOverride?: number | null) {
    if (!data) return;
    const rev = analysisRevisionRef.current ?? data.revision ?? 0;
    let nextMs: number | null;
    if (nextReviewOverride !== undefined) {
      nextMs = nextReviewOverride;
    } else {
      const raw = nextReviewLocal.trim();
      nextMs = raw === "" ? null : new Date(raw).getTime();
      if (raw !== "" && !Number.isFinite(nextMs)) return;
    }
    try {
      const result = await updateAnalysis({
        analysisId,
        expectedRevision: rev,
        nextReviewAt: nextMs === null ? null : nextMs,
        reviewRoutineNotes: reviewRoutineNotes.trim() || null,
      });
      if (result.ok) {
        analysisRevisionRef.current = result.revision;
        toast.success("Revisjonsplan lagret.");
      } else {
        toast.error(
          "ROS-analysen er allerede oppdatert på serveren. Last siden på nytt og prøv igjen.",
        );
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kunne ikke lagre.");
    }
  }

  async function save(opts?: { silent?: boolean }): Promise<boolean> {
    if (!data) return false;
    const targetRows = useSeparateAfterAxes
      ? parseLabelLines(rowLabelsAfterText).length
      : data.rowLabels.length;
    const targetCols = useSeparateAfterAxes
      ? parseLabelLines(colLabelsAfterText).length
      : data.colLabels.length;
    if (useSeparateAfterAxes && (targetRows < 2 || targetCols < 2)) {
      if (!opts?.silent) {
        toast.error(
          "Etter-tiltak med egne akser krever minst to rader og to kolonner (én etikett per linje).",
        );
      }
      return false;
    }
    const matrixAfterToSave = resizeNumberMatrix(
      matrixAfter,
      targetRows,
      targetCols,
    );
    const cellItemsAfterToSave = resizeCellItemsMatrix(
      cellItemsAfterMatrix,
      matrixAfter.length,
      matrixAfter[0]?.length ?? 0,
      targetRows,
      targetCols,
    );
    setSaving(true);
    try {
      const runSave = async (): Promise<boolean> => {
        if (!data) return false;
        const rawNext = nextReviewLocal.trim();
        const parsedNextMs =
          rawNext === "" ? null : new Date(rawNext).getTime();
        if (
          rawNext !== "" &&
          (parsedNextMs === null || !Number.isFinite(parsedNextMs))
        ) {
          if (!opts?.silent) {
            toast.error("Ugyldig dato/tid for neste revisjon.");
          }
          return false;
        }
        const rev = analysisRevisionRef.current ?? data.revision ?? 0;
        const cleanedRefs = requirementRefs.map((r) => ({
          source: r.source,
          article: r.article?.trim() || undefined,
          note: r.note?.trim() || undefined,
          documentationUrl: r.documentationUrl?.trim() || undefined,
        }));
        const result = await updateAnalysis({
          analysisId,
          expectedRevision: rev,
          title: title.trim(),
          notes: notes.trim() || null,
          nextReviewAt: parsedNextMs === null ? null : parsedNextMs,
          reviewRoutineNotes: reviewRoutineNotes.trim() || null,
          reviewEmailRemindersEnabled,
          reviewScheduleActive,
          reviewRecurrenceKind:
            reviewRecurrenceKind === "none" ? null : reviewRecurrenceKind,
          methodologyStatement: methodologyStatement.trim() || null,
          contextSummary: contextSummary.trim() || null,
          scopeAndCriteria: scopeAndCriteria.trim() || null,
          riskCriteriaVersion: riskCriteriaVersion.trim() || null,
          axisScaleNotes: axisScaleNotes.trim() || null,
          complianceScopeTags:
            complianceScopeTags.length === 0 ? null : complianceScopeTags,
          requirementRefs:
            cleanedRefs.length === 0 ? null : cleanedRefs,
          riskPoolBefore,
          riskPoolAfter,
          matrixValues: matrix,
          cellItems: cellItemsMatrix,
          matrixValuesAfter: matrixAfterToSave,
          cellItemsAfter: cellItemsAfterToSave,
          rowAxisTitleAfter: useSeparateAfterAxes
            ? rowAxisTitleAfter.trim()
            : undefined,
          colAxisTitleAfter: useSeparateAfterAxes
            ? colAxisTitleAfter.trim()
            : undefined,
          rowLabelsAfter: useSeparateAfterAxes
            ? parseLabelLines(rowLabelsAfterText)
            : [],
          colLabelsAfter: useSeparateAfterAxes
            ? parseLabelLines(colLabelsAfterText)
            : [],
          /** Eksplisitt «Lagre» — lag versjon; autosave (silent) gjør ikke det. */
          saveVersionSnapshot: !opts?.silent,
        });
        if (result.ok) {
          analysisRevisionRef.current = result.revision;
          setDirty(false);
          setLastSavedAt(Date.now());
          if (!opts?.silent) {
            const sv = result.snapshotVersion;
            toast.success(
              sv !== undefined
                ? `ROS-analysen er lagret (versjon ${sv}).`
                : "ROS-analysen er lagret.",
            );
          }
          return true;
        }
        toast.error(
          "ROS-analysen er allerede oppdatert på serveren (annen bruker, annen fane eller journal). Last siden på nytt og prøv igjen.",
        );
        return false;
      };
      rosSaveQueueRef.current = rosSaveQueueRef.current
        .catch((): boolean => false)
        .then(() => runSave());
      const ok = await rosSaveQueueRef.current;
      return ok;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kunne ikke lagre.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  saveRef.current = save;

  function downloadRosReviewCalendarFile() {
    const raw = nextReviewLocal.trim();
    const nextMs = raw === "" ? null : new Date(raw).getTime();
    if (nextMs === null || !Number.isFinite(nextMs)) {
      toast.error("Sett en gyldig dato for neste revisjon først.");
      return;
    }
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    const safeTitle = data?.title?.trim() || "ROS";
    const ics = buildRosReviewIcs({
      uid: `ros-${String(analysisId)}-${nextMs}@pvv.local`,
      title: `ROS-revisjon: ${safeTitle}`,
      startMs: nextMs,
      description: reviewRoutineNotes.trim() || undefined,
      url: `${origin}/w/${workspaceId}/ros/a/${analysisId}`,
    });
    downloadTextFile(
      `ros-revisjon-${String(analysisId).slice(0, 8)}.ics`,
      ics,
      "text/calendar;charset=utf-8",
    );
    toast.success(
      "Kalenderfil lastet ned — importer i Outlook, Google eller Apple Kalender.",
    );
  }

  async function markFormalReviewDone() {
    const kind = reviewRecurrenceKind;
    const patch: {
      lastFormalReviewCompletedAt: number;
      nextReviewAt?: number | null;
    } = { lastFormalReviewCompletedAt: Date.now() };
    if (kind !== "none") {
      patch.nextReviewAt = advanceRosReviewDate(Date.now(), kind);
    }
    const ok = await patchRosReviewFields(patch);
    if (ok) {
      if (kind !== "none" && patch.nextReviewAt != null) {
        setNextReviewLocal(tsToDatetimeLocal(patch.nextReviewAt));
      }
      toast.success("Revisjon merket som gjennomført.");
    }
  }

  async function applyNextReviewFromToday() {
    if (reviewRecurrenceKind === "none") {
      toast.error("Velg et intervall (uke, måned, …) først.");
      return;
    }
    const next = advanceRosReviewDate(Date.now(), reviewRecurrenceKind);
    setNextReviewLocal(tsToDatetimeLocal(next));
    await flushReviewSchedule(next);
  }

  /** Auto-lagre ulagret arbeid så matrise/risiko ikke tapes ved navigasjon. */
  useEffect(() => {
    if (!dirty || !data || !canAutosave) return;
    const t = window.setTimeout(() => {
      void saveRef.current?.({ silent: true });
    }, 1200);
    return () => window.clearTimeout(t);
  }, [
    dirty,
    data,
    canAutosave,
    matrix,
    cellItemsMatrix,
    matrixAfter,
    cellItemsAfterMatrix,
    title,
    notes,
    nextReviewLocal,
    reviewRoutineNotes,
    reviewEmailRemindersEnabled,
    reviewScheduleActive,
    reviewRecurrenceKind,
    methodologyStatement,
    contextSummary,
    scopeAndCriteria,
    riskCriteriaVersion,
    axisScaleNotes,
    complianceScopeTags,
    requirementRefs,
    riskPoolBefore,
    riskPoolAfter,
    useSeparateAfterAxes,
    rowAxisTitleAfter,
    colAxisTitleAfter,
    rowLabelsAfterText,
    colLabelsAfterText,
  ]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== "hidden") return;
      if (!dirtyRef.current || !canAutosaveRef.current) return;
      void saveRef.current?.({ silent: true });
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  function exportPdf() {
    if (!data) return;
    const pdfRows = useSeparateAfterAxes
      ? parseLabelLines(rowLabelsAfterText).length
      : data.rowLabels.length;
    const pdfCols = useSeparateAfterAxes
      ? parseLabelLines(colLabelsAfterText).length
      : data.colLabels.length;
    if (useSeparateAfterAxes && (pdfRows < 2 || pdfCols < 2)) {
      toast.error(
        "Angi minst to rader og to kolonner for etter-matrisen før PDF-eksport.",
      );
      return;
    }
    const mvAfterPdf = resizeNumberMatrix(matrixAfter, pdfRows, pdfCols);
    const cellItemsAfterPdf = resizeCellItemsMatrix(
      cellItemsAfterMatrix,
      matrixAfter.length,
      matrixAfter[0]?.length ?? 0,
      pdfRows,
      pdfCols,
    );
    const requirementRefLines = requirementRefs.map((r) => {
      const src =
        r.source === "gdpr"
          ? "GDPR"
          : r.source === "nis2"
            ? "NIS2"
            : r.source === "iso31000"
              ? "ISO 31000"
              : r.source === "iso27005"
                ? "ISO/IEC 27005"
                : r.source === "norwegian_law"
                  ? "Norsk lov"
                  : "Internt";
      return [src, r.article, r.note, r.documentationUrl]
        .filter(Boolean)
        .join(" · ");
    });
    const riskTreatmentNb: Record<string, string> = {
      mitigate: "Reduksjon",
      accept: "Akseptere",
      transfer: "Overføre",
      avoid: "Unngå",
    };
    const taskLinesAll =
      tasks?.map((t) => {
        const due = t.dueAt ? ` · frist ${formatTs(t.dueAt)}` : "";
        return {
          line: `${t.title}${due}`,
          statusLabel: t.status === "open" ? "Åpen" : "Fullført",
          description: t.description?.trim() || undefined,
          assigneeName: t.assigneeName ?? null,
          linkedRiskSummary: t.linkedRiskSummary ?? null,
          riskTreatmentLabel:
            t.riskTreatmentKind != null
              ? riskTreatmentNb[t.riskTreatmentKind] ?? t.riskTreatmentKind
              : undefined,
        };
      }) ?? [];

    const pvvLinksDetailed = data.linkedAssessments.map((l) => ({
      title: l.title,
      pddLabel:
        COMPLIANCE_STATUS_LABELS[
          (l.pddStatus ?? "not_started") as ComplianceStatusKey
        ],
      pddUrl: l.pddUrl?.trim() || undefined,
      linkNote: l.note?.trim() || undefined,
      pvvLinkNote: l.pvvLinkNote?.trim() || undefined,
      flagsText: l.flags?.length ? l.flags.join(", ") : undefined,
      highlightForPvv: Boolean(l.highlightForPvv),
      requirementRefLines:
        l.requirementRefs && l.requirementRefs.length > 0
          ? l.requirementRefs.map((r) => formatRosRequirementRefLine(r))
          : undefined,
    }));

    const summaryLines = [
      ...data.rosSummary.summaryLines,
      ...(data.rosSummary.suggestedLinkFlags.length > 0
        ? [
            `Forslag til PVV-flagg: ${data.rosSummary.suggestedLinkFlags.join(", ")}`,
          ]
        : []),
    ];

    const rawNext = nextReviewLocal.trim();
    const nextReviewPdf =
      rawNext === ""
        ? undefined
        : (() => {
            const ms = new Date(rawNext).getTime();
            return Number.isFinite(ms) ? formatTs(ms) : rawNext;
          })();
    const routinePdf = reviewRoutineNotes.trim() || undefined;
    const reviewSchedule =
      nextReviewPdf || routinePdf
        ? { nextReview: nextReviewPdf, routine: routinePdf }
        : undefined;

    const afterRowLabelsPdf = useSeparateAfterAxes
      ? parseLabelLines(rowLabelsAfterText)
      : data.rowLabels;
    const afterColLabelsPdf = useSeparateAfterAxes
      ? parseLabelLines(colLabelsAfterText)
      : data.colLabels;
    const identifiedRisks = collectIdentifiedRisksForPdf({
      cellItemsMatrix,
      rowLabels: data.rowLabels,
      colLabels: data.colLabels,
      matrixValues: matrix,
      afterRowLabels: afterRowLabelsPdf,
      afterColLabels: afterColLabelsPdf,
      matrixValuesAfter: mvAfterPdf,
    });

    const cellRiskPointsComplete = [
      ...collectAllCellRiskPointsForPdf({
        cellItemsMatrix,
        rowLabels: data.rowLabels,
        colLabels: data.colLabels,
        matrixValues: matrix,
        phase: "before",
      }),
      ...collectAllCellRiskPointsForPdf({
        cellItemsMatrix: cellItemsAfterMatrix,
        rowLabels: afterRowLabelsPdf,
        colLabels: afterColLabelsPdf,
        matrixValues: mvAfterPdf,
        phase: "after",
      }),
    ];

    const templateName =
      data.templateId && rosTemplates
        ? rosTemplates.find((x) => x._id === data.templateId)?.name ?? null
        : null;

    const riskPoolBeforeLines = formatRiskPoolLinesForPdf(riskPoolBefore);
    const riskPoolAfterLines = formatRiskPoolLinesForPdf(riskPoolAfter);

    downloadRosAnalysisPdf({
      title: title.trim() || data.title,
      workspaceName: workspace?.name ?? null,
      candidateName: data.candidateName,
      candidateCode: data.candidateCode,
      rowAxisTitle: data.rowAxisTitle,
      colAxisTitle: data.colAxisTitle,
      rowLabels: data.rowLabels,
      colLabels: data.colLabels,
      matrixValues: matrix,
      cellNotes: flattenCellItemsMatrixToLegacyNotes(cellItemsMatrix),
      matrixValuesAfter: mvAfterPdf,
      cellNotesAfter: flattenCellItemsMatrixToLegacyNotes(cellItemsAfterPdf),
      afterRowLabels: afterRowLabelsPdf,
      afterColLabels: afterColLabelsPdf,
      afterRowAxisTitle: useSeparateAfterAxes
        ? rowAxisTitleAfter.trim()
        : data.rowAxisTitle,
      afterColAxisTitle: useSeparateAfterAxes
        ? colAxisTitleAfter.trim()
        : data.colAxisTitle,
      afterSeparateLayout: useSeparateAfterAxes,
      analysisNotes: notes.trim() || null,
      summaryLines: summaryLines.length > 0 ? summaryLines : undefined,
      methodologyStatement: methodologyStatement.trim() || null,
      contextSummary: contextSummary.trim() || null,
      scopeAndCriteria: scopeAndCriteria.trim() || null,
      riskCriteriaVersion: riskCriteriaVersion.trim() || null,
      axisScaleNotes: axisScaleNotes.trim() || null,
      complianceScopeTagIds:
        complianceScopeTags.length > 0 ? complianceScopeTags : undefined,
      requirementRefLines:
        requirementRefLines.length > 0 ? requirementRefLines : undefined,
      reviewSchedule,
      taskLinesAll,
      identifiedRisks:
        identifiedRisks.length > 0 ? identifiedRisks : undefined,
      cellRiskPointsComplete:
        cellRiskPointsComplete.length > 0 ? cellRiskPointsComplete : undefined,
      sectorPackLabel:
        data.rosSectorPackId != null
          ? getRosSectorPack(data.rosSectorPackId)?.name ?? null
          : null,
      riskPoolBeforeLines:
        riskPoolBeforeLines.length > 0 ? riskPoolBeforeLines : undefined,
      riskPoolAfterLines:
        riskPoolAfterLines.length > 0 ? riskPoolAfterLines : undefined,
      linkedPvvTitles: data.linkedAssessments.map((l) => l.title),
      pvvLinksDetailed:
        pvvLinksDetailed.length > 0 ? pvvLinksDetailed : undefined,
      journalEntries: (journalEntries ?? []).map((e) => ({
        body: e.body,
        authorName: e.authorName,
        createdAt: e.createdAt,
        linkedRow: e.linkedRow,
        linkedCol: e.linkedCol,
        matrixPhase: e.matrixPhase,
      })),
      generatedAt: new Date(),
      metadata: {
        revision: data.revision ?? undefined,
        createdAtMs: data.createdAt,
        updatedAtMs: data.updatedAt,
        templateName: templateName ?? undefined,
      },
      versionSnapshots: (versions ?? []).map((v) => ({
        version: v.version,
        note: v.note?.trim(),
        createdAt: v.createdAt,
      })),
    });
  }

  async function onAddPv() {
    if (addPvId === "") return;
    try {
      await linkAssessment({ analysisId, assessmentId: addPvId });
      setAddPvId("");
      toast.success("PVV koblet til analysen.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kunne ikke koble.");
    }
  }

  async function onUnlink(linkId: Id<"rosAnalysisAssessments">) {
    try {
      await unlinkAssessment({ linkId });
      toast.success("PVV-kobling fjernet.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kunne ikke fjerne.");
    }
  }

  /**
   * Lagre tiltak (med tilknyttet risikotekst) i ROS-biblioteket for gjenbruk
   * på tvers av analyser. Følger ISO 31000-tankegangen om at tiltak alltid
   * relateres til en konkret risiko.
   */
  function openSaveTaskToLibrary(task: {
    _id: Id<"rosTasks">;
    title: string;
    description?: string;
    linkedCellItemId?: string;
    linkedCellItemPhase?: "before" | "after";
  }) {
    if (!task.linkedCellItemId || !task.linkedCellItemPhase) {
      toast.error(
        "Koble tiltaket til en risiko først for å lagre det i biblioteket.",
      );
      return;
    }
    const key = `${task.linkedCellItemPhase}:${task.linkedCellItemId}`;
    const found = linkedRiskLookup.get(key);
    if (!found || !found.text.trim()) {
      toast.error("Risikoteksten er tom — kan ikke lagres i biblioteket.");
      return;
    }
    const tiltakText = [task.title.trim(), task.description?.trim()]
      .filter(Boolean)
      .join("\n\n");
    setSavingTaskToLibrary({
      taskId: task._id,
      title: task.title,
      description: task.description,
      riskText: found.text,
      riskFlags: found.flags,
      riskLocation: `${found.phase === "before" ? "Før" : "Etter"} · ${found.rowLabel} × ${found.colLabel}`,
    });
    setSaveLibTitle(task.title.trim());
    setSaveLibTiltak(tiltakText);
    setSaveLibCategoryId("");
    setSaveLibVisibility("workspace");
  }

  async function confirmSaveTaskToLibrary() {
    if (!savingTaskToLibrary) return;
    const t = saveLibTitle.trim();
    const r = savingTaskToLibrary.riskText.trim();
    if (!t || !r) {
      toast.error("Tittel og risikotekst er påkrevd.");
      return;
    }
    setSaveLibBusy(true);
    try {
      await createLibraryItem({
        workspaceId,
        title: t,
        riskText: r,
        tiltakText: saveLibTiltak.trim() || undefined,
        flags: savingTaskToLibrary.riskFlags,
        visibility: saveLibVisibility,
        categoryId:
          saveLibCategoryId === "" ? undefined : saveLibCategoryId,
      });
      toast.success(
        "Lagret i biblioteket — tiltaket kan nå gjenbrukes på andre analyser.",
      );
      setSavingTaskToLibrary(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kunne ikke lagre.");
    } finally {
      setSaveLibBusy(false);
    }
  }

  async function onCreateTask(e: React.FormEvent) {
    e.preventDefault();
    const t = taskTitle.trim();
    if (!t) return;
    const risk = parseRosTaskRiskLink(taskRiskLink);
    const dueMs =
      taskDueAt.trim() === ""
        ? undefined
        : new Date(taskDueAt).getTime();
    if (taskDueAt.trim() !== "" && !Number.isFinite(dueMs)) {
      toast.error("Ugyldig frist.");
      return;
    }
    setTaskBusy(true);
    try {
      await createRosTask({
        analysisId,
        title: t,
        description: taskDesc.trim() || undefined,
        assigneeUserIds:
          taskAssignees.length > 0 ? taskAssignees : undefined,
        priority: taskPriority,
        dueAt: dueMs,
        linkedCellItemId: risk?.linkedCellItemId,
        linkedCellItemPhase: risk?.linkedCellItemPhase,
        riskTreatmentKind:
          taskRiskTreatment === "" ? undefined : taskRiskTreatment,
        residualRiskAcceptedNote:
          taskRiskTreatment === "accept"
            ? taskResidualNote.trim() || undefined
            : undefined,
      });
      setTaskTitle("");
      setTaskDesc("");
      setTaskAssignees([]);
      setTaskPriority(3);
      setTaskRiskLink("");
      setTaskRiskTreatment("");
      setTaskResidualNote("");
      setTaskDueAt("");
      toast.success("Tiltak opprettet.");
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Kunne ikke opprette tiltak.",
      );
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
    <div className="space-y-5 pb-24">
      {/* Sticky header — slim, modern, action-pills */}
      <div className="bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky top-0 z-20 -mx-1 px-1 pb-3 pt-2 backdrop-blur-md">
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href={`/w/${workspaceId}/ros`}
            className="text-muted-foreground hover:bg-muted/60 hover:text-foreground flex size-9 shrink-0 items-center justify-center rounded-full ring-1 ring-border/40 transition-colors"
            title="Tilbake til ROS"
          >
            <ChevronLeft className="size-4" aria-hidden />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="font-heading text-foreground truncate text-base font-semibold leading-tight tracking-tight sm:text-lg">
              {data.title}
            </h1>
            <div className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
              {data.candidateName ? (
                <span className="truncate">
                  {data.candidateName}{" "}
                  <span className="text-muted-foreground/80 font-mono text-[10px]">
                    ({data.candidateCode})
                  </span>
                </span>
              ) : (
                <span className="italic">Frittstående</span>
              )}
              {data.linkedAssessments.length > 0 && (
                <>
                  <span className="text-border">·</span>
                  <span className="flex items-center gap-1">
                    <Link2 className="size-3" aria-hidden />
                    {data.linkedAssessments.map((l, li) => (
                      <span key={l.linkId}>
                        {li > 0 ? ", " : ""}
                        <Link
                          href={`/w/${workspaceId}/a/${l.assessmentId}`}
                          className="text-primary hover:underline"
                        >
                          {l.title}
                        </Link>
                      </span>
                    ))}
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Button
              type="button"
              size="sm"
              onClick={() => void save()}
              disabled={saving}
              className="h-9 gap-1.5 rounded-full px-4 text-sm font-semibold shadow-sm"
            >
              {saving ? "Lagrer …" : dirty ? "Lagre" : "Versjon"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="hover:bg-muted/60 size-9 rounded-full ring-1 ring-border/40"
              title="Eksporter PDF"
              onClick={exportPdf}
            >
              <FileDown className="size-4" aria-hidden />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive size-9 rounded-full ring-1 ring-border/40"
              title="Slett analyse"
              disabled={isDeleting}
              onClick={() => {
                if (!data) return;
                toastDeleteWithUndo({
                  title: "Sletter ROS-analyse",
                  itemLabel: data.title,
                  onCommit: async () => {
                    setIsDeleting(true);
                    await removeAnalysis({ analysisId });
                    router.replace(`/w/${workspaceId}/ros`);
                  },
                  onFailed: () => setIsDeleting(false),
                });
              }}
            >
              <Trash2 className="size-4" aria-hidden />
            </Button>
          </div>
        </div>

        {/* Section chips — rounded-full, samme språk som vurderingsveiviseren */}
        <nav
          className="mt-3 flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label="ROS-seksjoner"
        >
          {ROS_EDITOR_SECTIONS.map((sec, i) => {
            const active = rosSection === i;
            const Icon = sec.icon;
            return (
              <button
                key={sec.id}
                type="button"
                onClick={() => setRosSection(i)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-all",
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground bg-card/60 ring-1 ring-border/40 backdrop-blur-sm hover:bg-card",
                )}
              >
                <Icon className="size-3.5 shrink-0" aria-hidden />
                <span>{sec.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <p className="sr-only">
        Piltastene venstre og høyre bytter del når fokus ikke er i et felt. På
        matrisen er de reservert til matrisen. Bruk knappene under eller Forrige /
        Neste nederst.
      </p>

      {(() => {
        const scheduleOn = data.reviewScheduleActive !== false;
        const nextAt = data.nextReviewAt;
        const now = Date.now();
        const overdue =
          scheduleOn &&
          nextAt != null &&
          Number.isFinite(nextAt) &&
          nextAt < now;
        const stale =
          data.lastFormalReviewCompletedAt != null &&
          data.updatedAt > data.lastFormalReviewCompletedAt + 60_000;
        if (!overdue && !stale) return null;
        return (
          <div className="space-y-2">
            {stale ? (
              <div className="ring-border/40 flex items-start gap-2.5 rounded-2xl bg-sky-500/[0.07] px-3.5 py-2.5 ring-1 sm:px-4">
                <AlertTriangle
                  className="mt-0.5 size-4 shrink-0 text-sky-700 dark:text-sky-400"
                  aria-hidden
                />
                <p className="text-foreground/90 text-xs leading-relaxed">
                  <span className="font-semibold">Analysen er endret</span> etter
                  siste merkede revisjon. Vurder om ROS bør gjennomgås på nytt, eller
                  merk revisjon som gjennomført igjen etter at endringene er
                  kvalitetssikret.
                </p>
              </div>
            ) : null}
            {overdue ? (
              <div className="ring-border/40 flex items-start gap-2.5 rounded-2xl bg-amber-500/[0.08] px-3.5 py-2.5 ring-1 sm:px-4">
                <AlertTriangle
                  className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-400"
                  aria-hidden
                />
                <p className="text-foreground/90 text-xs leading-relaxed">
                  <span className="font-semibold">Planlagt revisjon er passert.</span>{" "}
                  Oppdater neste frist under Innstillinger, eller marker revisjon som
                  gjennomført.
                  {data.reviewEmailRemindersEnabled === false ? (
                    <span className="text-muted-foreground">
                      {" "}
                      (E-postvarsler er av — du ser dette kun her i appen.)
                    </span>
                  ) : null}
                </p>
              </div>
            ) : null}
          </div>
        );
      })()}

      {/* === Section 0: Risikovurdering — punkter først, matrise som visning === */}
      {rosSection === 0 && (
        <div className="space-y-6">
          <RiskSummaryBar
            cellItemsMatrix={cellItemsMatrix}
            matrixValues={matrix}
            matrixAfter={matrixAfter}
            cellItemsAfterMatrix={cellItemsAfterMatrix}
            rowLabels={data.rowLabels}
            colLabels={data.colLabels}
            afterRowLabels={effectiveAfterRowLabels}
            afterColLabels={effectiveAfterColLabels}
          />

          <div className="rounded-2xl bg-card shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
            <div className="p-5 sm:p-6">
              <RosRiskList
                workspaceId={workspaceId}
                rowLabels={data.rowLabels}
                colLabels={data.colLabels}
                rowAxisTitle={data.rowAxisTitle}
                colAxisTitle={data.colAxisTitle}
                cellItemsMatrix={cellItemsMatrix}
                matrixValues={matrix}
                matrixAfter={matrixAfter}
                cellItemsAfterMatrix={cellItemsAfterMatrix}
                afterRowLabels={effectiveAfterRowLabels}
                afterColLabels={effectiveAfterColLabels}
                onAddRisk={onAddRisk}
                onUpdateRisk={onUpdateRisk}
                onDeleteRisk={onDeleteRisk}
                highlightCell={highlightCell}
                rosTasks={tasks ?? undefined}
                onGoToTasks={() => setRosSection(1)}
                saveStatus={{ saving, dirty, lastSavedAt }}
              />
            </div>
          </div>

          {matrix.length > 0 ? (
            <>
            <div className="rounded-2xl bg-card shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
              <div className="flex flex-col gap-3 p-4 pb-2 sm:flex-row sm:items-center sm:justify-between sm:p-5 sm:pb-3">
                <div className="min-w-0">
                  <h3 className="text-foreground text-sm font-semibold tracking-tight">
                    Risikomatrise
                  </h3>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {data.rowAxisTitle} × {data.colAxisTitle} · klikk celler for å redigere
                  </p>
                </div>
                <div
                  className="bg-card/80 ring-border/40 inline-flex shrink-0 items-center gap-1 rounded-full p-1 ring-1"
                  role="tablist"
                  aria-label="Vis matrise før eller etter tiltak"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={matrixView === "before"}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-semibold transition-all",
                      matrixView === "before"
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                    onClick={() => setMatrixView("before")}
                  >
                    Før
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={matrixView === "after"}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-semibold transition-all",
                      matrixView === "after"
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                    onClick={() => setMatrixView("after")}
                  >
                    Etter
                  </button>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-primary inline-flex items-center justify-center rounded-full px-2 py-1 transition-colors"
                    onClick={() => setMatrixScaleHelpOpen(true)}
                    aria-expanded={matrixScaleHelpOpen}
                    aria-controls="ros-matrix-scale-help"
                    title="Skala 1–5"
                  >
                    <CircleHelp className="size-3.5 shrink-0" aria-hidden />
                  </button>
                </div>
              </div>
              <div className="min-w-0 px-5 pb-5 sm:px-6 sm:pb-6">
                {afterMatrixInvalid ? (
                  <Alert>
                    <AlertTitle>Ugyldig etter-matrise</AlertTitle>
                    <AlertDescription>
                      Angi minst to rader og to kolonner i innstillinger,
                      eller bruk samme rutenett som før tiltak.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <RosMatrix
                    key={`${matrixView}-${useSeparateAfterAxes}`}
                    rowAxisTitle={matrixRowAxisTitle}
                    colAxisTitle={matrixColAxisTitle}
                    rowLabels={matrixRowLabels}
                    colLabels={matrixColLabels}
                    matrixValues={matrixView === "after" ? matrixAfter : matrix}
                    cellItems={matrixView === "after" ? cellItemsAfterMatrix : cellItemsMatrix}
                    onCellItemsChange={onCellItemsChange}
                    onCellChange={onCellChange}
                    jumpRequest={jumpRequest}
                    onJumpHandled={() => setJumpRequest(null)}
                    currentPhase={matrixView}
                    otherPhaseValues={matrixView === "after" ? matrix : matrixAfter}
                    otherPhaseCellItems={matrixView === "after" ? cellItemsMatrix : cellItemsAfterMatrix}
                    onSwitchPhase={(row, col) => {
                      const nextPhase = matrixView === "before" ? "after" : "before";
                      setMatrixView(nextPhase as "before" | "after");
                      setJumpRequest({ row, col, nonce: Date.now() });
                    }}
                    afterRowLabels={effectiveAfterRowLabels}
                    afterColLabels={effectiveAfterColLabels}
                    onPlaceInAfter={matrixView === "before" ? onPlaceInAfter : undefined}
                    onRemoveAfterPlacement={matrixView === "before" ? onRemoveAfterPlacement : undefined}
                    beforeRowLabels={data?.rowLabels}
                    beforeColLabels={data?.colLabels}
                    onAssignBeforeItem={matrixView === "after" ? onAssignBeforeItem : undefined}
                    onMoveCellContents={moveMatrixCellContents}
                  />
                )}
              </div>
            </div>

            <Sheet open={matrixScaleHelpOpen} onOpenChange={setMatrixScaleHelpOpen}>
              <SheetContent
                side="right"
                showOnDesktop
                className="w-full max-w-lg border-l"
              >
                <div
                  id="ros-matrix-scale-help"
                  className="flex h-full min-h-0 flex-col px-3 sm:px-4"
                >
                  <div className="border-border/60 shrink-0 border-b px-1 pb-4 pt-1">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1 pr-1">
                        <h2
                          id="ros-matrix-scale-help-title"
                          className="font-heading text-lg font-semibold tracking-tight"
                        >
                          Hjelp: skala 1–5
                        </h2>
                        <p className="text-muted-foreground mt-1 text-sm leading-snug">
                          Standard forklaring av nivå 1–5; malen kan tilpasse akser, nivåtekster og
                          egen definisjon under Livsløp og etterlevelse. Gjelder både før og etter tiltak.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-foreground -mr-1 shrink-0"
                        aria-label="Lukk hjelp"
                        onClick={() => setMatrixScaleHelpOpen(false)}
                      >
                        <X className="size-5" aria-hidden />
                      </Button>
                    </div>
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto px-0 pb-6 pt-3">
                    <RosScaleReference
                      variant="embedded"
                      axisScaleNotes={axisScaleNotes}
                    />
                  </div>
                </div>
              </SheetContent>
            </Sheet>
            </>
          ) : null}
        </div>
      )}

      {/* === Section 1: Tiltak === */}
      {rosSection === 1 && (
      <div className="space-y-5">
        {/* Varsel: risikoer i før-matrisen uten tiltak.
            NS 5814 / ISO 31000: alle høye/kritiske risikoer skal enten
            behandles eller formelt aksepteres. Vi viser de mest alvorlige
            øverst og lar brukeren raskt opprette tiltak for dem. */}
        {uncoveredBeforeRisks.length > 0 && (() => {
          const critical = uncoveredBeforeRisks.filter((r) => r.level >= 5);
          const high = uncoveredBeforeRisks.filter((r) => r.level === 4);
          const moderate = uncoveredBeforeRisks.filter((r) => r.level === 3);
          const lower = uncoveredBeforeRisks.filter(
            (r) => r.level > 0 && r.level <= 2,
          );
          const unrated = uncoveredBeforeRisks.filter((r) => r.level === 0);
          const needAttention = critical.length + high.length;
          const tone =
            critical.length > 0
              ? ("critical" as const)
              : high.length > 0
                ? ("high" as const)
                : ("info" as const);
          const toneClasses =
            tone === "critical"
              ? "bg-red-500/[0.07] ring-red-500/20"
              : tone === "high"
                ? "bg-amber-500/[0.07] ring-amber-500/20"
                : "bg-muted/30 ring-border/40";
          const iconClass =
            tone === "critical"
              ? "text-red-600 dark:text-red-400"
              : tone === "high"
                ? "text-amber-600 dark:text-amber-400"
                : "text-muted-foreground";
          return (
            <details
              className={cn(
                "group/uncovered rounded-2xl ring-1 transition-all",
                toneClasses,
              )}
              open={tone === "critical" || tone === "high"}
            >
              <summary className="flex cursor-pointer list-none items-start gap-3 rounded-2xl px-4 py-3 [&::-webkit-details-marker]:hidden sm:px-5">
                <AlertTriangle
                  className={cn("mt-0.5 size-5 shrink-0", iconClass)}
                  aria-hidden
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-foreground text-sm font-semibold">
                    {needAttention > 0 ? (
                      <>
                        {needAttention}{" "}
                        {needAttention === 1
                          ? "risiko trenger oppmerksomhet"
                          : "risikoer trenger oppmerksomhet"}
                      </>
                    ) : (
                      <>
                        {uncoveredBeforeRisks.length}{" "}
                        {uncoveredBeforeRisks.length === 1
                          ? "risiko mangler tiltak"
                          : "risikoer mangler tiltak"}
                      </>
                    )}
                  </p>
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    {needAttention > 0 ? (
                      <>
                        I tråd med ISO 31000 / NS 5814 bør høye og kritiske
                        risikoer behandles, overføres, unngås eller{" "}
                        <span className="font-medium">formelt aksepteres</span>.
                      </>
                    ) : (
                      <>
                        Lavere risikoer kan ofte aksepteres uten tiltak — men
                        det bør være en bevisst beslutning.
                      </>
                    )}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {critical.length > 0 && (
                      <span className="inline-flex items-center rounded-full bg-red-500/15 px-2 py-0.5 text-[11px] font-semibold text-red-700 ring-1 ring-red-500/20 dark:text-red-300">
                        {critical.length} kritisk{critical.length > 1 && "e"}
                      </span>
                    )}
                    {high.length > 0 && (
                      <span className="inline-flex items-center rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-500/20 dark:text-amber-300">
                        {high.length} høy{high.length > 1 && "e"}
                      </span>
                    )}
                    {moderate.length > 0 && (
                      <span className="bg-muted/60 ring-border/40 text-foreground/80 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1">
                        {moderate.length} middels
                      </span>
                    )}
                    {(lower.length > 0 || unrated.length > 0) && (
                      <span className="bg-muted/60 ring-border/40 text-muted-foreground inline-flex items-center rounded-full px-2 py-0.5 text-[11px] ring-1">
                        {lower.length + unrated.length} lav/uvurdert
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight
                  className="text-muted-foreground mt-1 size-4 shrink-0 transition-transform group-open/uncovered:rotate-90"
                  aria-hidden
                />
              </summary>
              <ul className="border-border/30 max-h-96 divide-y divide-border/30 overflow-y-auto border-t">
                {uncoveredBeforeRisks.slice(0, 30).map((r) => {
                  const sev =
                    r.level >= 5
                      ? "critical"
                      : r.level >= 4
                        ? "high"
                        : r.level >= 3
                          ? "moderate"
                          : r.level >= 1
                            ? "low"
                            : "unrated";
                  const dotClass =
                    sev === "critical"
                      ? "bg-red-500"
                      : sev === "high"
                        ? "bg-amber-500"
                        : sev === "moderate"
                          ? "bg-yellow-500"
                          : sev === "low"
                            ? "bg-emerald-500"
                            : "bg-muted-foreground/40";
                  return (
                    <li
                      key={r.id}
                      className="flex items-start gap-3 px-4 py-2.5 sm:px-5"
                    >
                      <span
                        className={cn(
                          "mt-1.5 size-2 shrink-0 rounded-full",
                          dotClass,
                        )}
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-foreground/90 text-xs font-medium leading-snug">
                          {r.text.trim() || "(uten tekst)"}
                        </p>
                        <p className="text-muted-foreground mt-0.5 text-[10px]">
                          {r.rowLabel} × {r.colLabel}
                          {r.level > 0 && (
                            <>
                              {" "}
                              · nivå <span className="tabular-nums">{r.level}</span>
                            </>
                          )}
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 shrink-0 gap-1 rounded-full px-2.5 text-[11px]"
                        onClick={() => startAddTaskForRisk(r.id)}
                      >
                        <Plus className="size-3" aria-hidden />
                        Tiltak
                      </Button>
                    </li>
                  );
                })}
                {uncoveredBeforeRisks.length > 30 && (
                  <li className="text-muted-foreground px-4 py-2 text-center text-[11px] sm:px-5">
                    … og {uncoveredBeforeRisks.length - 30} til.
                  </li>
                )}
              </ul>
            </details>
          );
        })()}

        {/* Quick-add — risikokobling er førsteklasses (ISO 31000:
            tiltak skal alltid være knyttet til en identifisert risiko). */}
        <form
          onSubmit={(e) => void onCreateTask(e)}
          className="bg-card ring-border/40 space-y-3 rounded-2xl p-4 shadow-sm ring-1 sm:p-5"
        >
          <div className="space-y-1">
            <p className="text-foreground text-sm font-semibold">
              Nytt tiltak
            </p>
            <p className="text-muted-foreground text-xs leading-relaxed">
              Beskriv hva som settes i verk og hvilken risiko det
              behandler. Tiltak kan lagres i biblioteket for gjenbruk
              senere.
            </p>
          </div>

          {/* Tittel + Legg til */}
          <div className="flex gap-2">
            <Input
              id="ros-quick-task-title"
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              placeholder="F.eks. «Kryptere personopplysninger ved overføring»"
              className="h-10 flex-1 rounded-xl"
              aria-label="Tittel på tiltaket"
            />
            <Button
              type="submit"
              disabled={taskBusy || !taskTitle.trim()}
              className="h-10 shrink-0 gap-1.5 rounded-full px-4 font-semibold"
            >
              <Plus className="size-4" />
              <span className="hidden sm:inline">Legg til</span>
            </Button>
          </div>

          {/* Synlig bekreftelse av valgt risiko — gir brukeren tydelig
              tilbakemelding om HVILKEN risiko tiltaket faktisk knyttes til,
              spesielt etter at de klikket «+ Tiltak» fra varselbanneret. */}
          {(() => {
            if (!taskRiskLink) return null;
            const linked = linkedRiskLookup.get(taskRiskLink);
            if (!linked) return null;
            const phaseLabel =
              linked.phase === "after"
                ? "Restrisiko etter tiltak"
                : "Risiko før tiltak (iboende)";
            return (
              <div
                className={cn(
                  "ring-primary/20 bg-primary/[0.04] flex items-start gap-3 rounded-2xl px-3.5 py-3 ring-1 sm:px-4",
                )}
                role="status"
                aria-live="polite"
              >
                <span
                  className={cn(
                    "inline-flex size-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold tabular-nums shadow-sm",
                    cellRiskClass(linked.level),
                  )}
                  aria-hidden
                >
                  {linked.level || "–"}
                </span>
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="text-muted-foreground flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider">
                    <Link2 className="size-3" aria-hidden />
                    Tiltak for denne risikoen
                  </p>
                  <p className="text-foreground line-clamp-2 text-sm font-semibold leading-snug">
                    {linked.text.trim() || "(uten tekst)"}
                  </p>
                  <p className="text-muted-foreground text-[11px] leading-relaxed">
                    {phaseLabel} ·{" "}
                    <span className="tabular-nums">
                      {linked.rowLabel} × {linked.colLabel}
                    </span>
                    {linked.level > 0 && (
                      <>
                        {" · "}
                        <span className="font-medium">
                          {RISK_LEVEL_HINTS[linked.level] ?? `nivå ${linked.level}`}
                        </span>
                      </>
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-destructive shrink-0 rounded-full p-1 transition-colors"
                  onClick={() => {
                    setTaskRiskLink("");
                    setTaskRiskTreatment("");
                  }}
                  title="Fjern kobling til risiko"
                  aria-label="Fjern kobling til risiko"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </div>
            );
          })()}

          {/* Risikokobling — alltid synlig som primært felt */}
          <div className="space-y-1.5">
            <Label
              htmlFor="ros-quick-task-risk-link"
              className="text-muted-foreground flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider"
            >
              <Link2 className="size-3" aria-hidden />
              {taskRiskLink ? "Bytt risiko" : "Hvilken risiko reduseres?"}
            </Label>
            <RiskLinkSelect
              id="ros-quick-task-risk-link"
              value={taskRiskLink}
              onChange={(v) => {
                setTaskRiskLink(v);
                if (v && !taskRiskTreatment) {
                  setTaskRiskTreatment("mitigate");
                }
              }}
              options={taskRiskLinkOptions}
              className="border-input bg-background h-10 w-full rounded-xl border px-3 text-sm"
              ariaLabel="Koble til risiko"
              disabled={taskRiskLinkOptions.length <= 1}
            />
            <p className="text-muted-foreground text-[11px] leading-relaxed">
              {taskRiskLinkOptions.length <= 1 ? (
                <>
                  Legg inn risikoer i{" "}
                  <span className="font-medium">Risikoer</span>-fanen først,
                  så kan tiltakene kobles til konkrete punkter.
                </>
              ) : (
                <>
                  Koble normalt til <span className="font-medium">risiko før tiltak</span>{" "}
                  (iboende). Velg <span className="font-medium">restrisiko</span> kun hvis
                  tiltaket håndterer det som er igjen etter andre kontroller.
                </>
              )}
            </p>
          </div>

          {/* Behandlingstype — segmented pill-control. Profesjonell ROS
              krever at tiltak klassifiseres etter strategi. */}
          {taskRiskLink && (
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-[11px] font-medium uppercase tracking-wider">
                Behandlingsstrategi
              </Label>
              <div className="bg-muted/30 ring-border/40 flex flex-wrap gap-1 rounded-full p-1 ring-1">
                {ROS_RISK_TREATMENT_OPTIONS.filter((o) => o.value !== "").map(
                  (o) => (
                    <button
                      key={o.value}
                      type="button"
                      title={o.description}
                      onClick={() =>
                        setTaskRiskTreatment(
                          taskRiskTreatment === o.value
                            ? ""
                            : (o.value as
                                | "mitigate"
                                | "accept"
                                | "transfer"
                                | "avoid"),
                        )
                      }
                      className={cn(
                        "h-7 rounded-full px-3 text-[11px] font-medium transition-colors",
                        taskRiskTreatment === o.value
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {o.label}
                    </button>
                  ),
                )}
              </div>
              {taskRiskTreatment === "accept" && (
                <Textarea
                  value={taskResidualNote}
                  onChange={(e) => setTaskResidualNote(e.target.value)}
                  rows={2}
                  className="min-h-0 rounded-xl text-sm"
                  placeholder="Grunnlag for aksept (f.eks. styrebeslutning, kost/nytte) …"
                  aria-label="Grunnlag for aksept"
                />
              )}
            </div>
          )}

          {/* Avanserte felt */}
          {taskTitle.trim() && (
            <details className="group/adv border-border/40 rounded-xl border">
              <summary className="text-muted-foreground hover:text-foreground flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-xs font-medium transition-colors [&::-webkit-details-marker]:hidden">
                <span>Flere detaljer · ansvarlig, frist, prioritet</span>
                <ChevronRight
                  className="size-3.5 transition-transform group-open/adv:rotate-90"
                  aria-hidden
                />
              </summary>
              <div className="border-border/40 space-y-3 border-t p-3">
                <Textarea
                  value={taskDesc}
                  onChange={(e) => setTaskDesc(e.target.value)}
                  rows={2}
                  className="min-h-0 rounded-xl text-sm"
                  placeholder="Utdypende beskrivelse (valgfritt)"
                />
                <div className="space-y-1.5">
                  {taskAssignees.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {taskAssignees.map((uid) => {
                        const m = (members ?? []).find(
                          (wm) => wm.userId === uid,
                        );
                        return (
                          <span
                            key={uid}
                            className="bg-card shadow-xs inline-flex items-center gap-1 rounded-full border py-0.5 pl-2 pr-1 text-[11px]"
                          >
                            {m?.name ?? m?.email ?? uid}
                            <button
                              type="button"
                              className="text-muted-foreground hover:text-destructive p-0.5"
                              onClick={() =>
                                setTaskAssignees((ids) =>
                                  ids.filter((id) => id !== uid),
                                )
                              }
                            >
                              ×
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  ) : null}
                  <select
                    className="border-input bg-background flex h-9 w-full rounded-xl border px-3 text-xs"
                    value=""
                    onChange={(e) => {
                      const uid = e.target.value as Id<"users">;
                      if (uid && !taskAssignees.includes(uid)) {
                        setTaskAssignees((ids) => [...ids, uid]);
                      }
                    }}
                    aria-label="Legg til ansvarlig"
                  >
                    <option value="">— Legg til ansvarlig —</option>
                    {(members ?? [])
                      .filter((m) => !taskAssignees.includes(m.userId))
                      .map((m) => (
                        <option key={m.userId} value={m.userId}>
                          {m.name ?? m.email ?? m.userId}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="grid gap-2 sm:grid-cols-[7rem_1fr]">
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-[11px]">
                      Prioritet 1–5
                    </Label>
                    <Input
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
                      className="h-9 rounded-xl text-xs"
                      aria-label="Prioritet 1–5"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-[11px]">
                      Frist
                    </Label>
                    <Input
                      type="datetime-local"
                      value={taskDueAt}
                      onChange={(e) => setTaskDueAt(e.target.value)}
                      className="h-9 rounded-xl text-xs"
                      aria-label="Frist"
                    />
                  </div>
                </div>
              </div>
            </details>
          )}

          {/* Tydelig handling-bar nederst i skjemaet. Brukere som scroller
              gjennom detaljer trenger en åpenbar «Lagre»-knapp i bunn — ikke
              bare den lille øverst ved tittelen. */}
          {(taskTitle.trim() ||
            taskRiskLink ||
            taskRiskTreatment ||
            taskDesc.trim() ||
            taskAssignees.length > 0 ||
            taskDueAt) && (
            <div className="border-border/40 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground rounded-full px-3 py-1.5 text-xs transition-colors"
                onClick={() => {
                  setTaskTitle("");
                  setTaskDesc("");
                  setTaskAssignees([]);
                  setTaskPriority(3);
                  setTaskRiskLink("");
                  setTaskRiskTreatment("");
                  setTaskResidualNote("");
                  setTaskDueAt("");
                }}
              >
                Tøm skjema
              </button>
              <Button
                type="submit"
                disabled={taskBusy || !taskTitle.trim()}
                className="h-10 gap-1.5 rounded-full px-5 font-semibold shadow-sm"
              >
                {taskBusy ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Plus className="size-4" aria-hidden />
                )}
                {taskBusy ? "Lagrer …" : "Lagre tiltak"}
              </Button>
            </div>
          )}
        </form>

        {/* Task stats — kun når det finnes tiltak */}
        {tasks && tasks.length > 0 && (() => {
          const open = tasks.filter((t) => t.status !== "done").length;
          const done = tasks.filter((t) => t.status === "done").length;
          const overdue = tasks.filter(
            (t) => t.status !== "done" && t.dueAt && t.dueAt < Date.now(),
          ).length;
          return (
            <div className="bg-card/60 ring-border/40 flex flex-wrap items-center gap-2 rounded-2xl px-3 py-2 ring-1 backdrop-blur-sm sm:gap-3 sm:px-4">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs text-blue-700 ring-1 ring-blue-500/15 dark:text-blue-300">
                <ListTodo className="size-3" aria-hidden />
                <span className="tabular-nums font-semibold">{open}</span> åpne
              </span>
              {done > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs text-emerald-700 ring-1 ring-emerald-500/15 dark:text-emerald-300">
                  <ShieldCheck className="size-3" aria-hidden />
                  <span className="tabular-nums font-semibold">{done}</span> fullført
                </span>
              )}
              {overdue > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-2.5 py-0.5 text-xs text-red-700 ring-1 ring-red-500/15 dark:text-red-300">
                  <AlertTriangle className="size-3" aria-hidden />
                  <span className="tabular-nums font-semibold">{overdue}</span> forfalt
                </span>
              )}
            </div>
          );
        })()}

        {/* Task list — eller diskret tom-tekst */}
        {tasks === undefined ? (
          <p className="text-muted-foreground text-sm">Henter tiltak …</p>
        ) : tasks.length === 0 ? (
          <p className="text-muted-foreground py-2 text-center text-xs">
            Ingen tiltak lagt til ennå.
          </p>
        ) : (
          <ul className="space-y-2">
            {tasks.map((t) => (
              <li
                key={t._id}
                className={cn(
                  "group/task overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-black/[0.04] transition-all duration-200 hover:shadow-md dark:ring-white/[0.06]",
                  t.status === "done" && "opacity-60",
                )}
              >
                {editingTaskId === t._id ? (
                  <div className="p-4 sm:p-5">
                    <TaskEditForm
                      task={t}
                      members={members ?? []}
                      riskLinkOptions={taskRiskLinkOptions}
                      onCancel={() => setEditingTaskId(null)}
                      onSave={async (patch) => {
                        await updateRosTask({ taskId: t._id, ...patch });
                        setEditingTaskId(null);
                      }}
                    />
                  </div>
                ) : (
                  <div className="flex items-start gap-3 px-4 py-3.5 sm:gap-4">
                    <button
                      type="button"
                      className={cn(
                        "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition-all",
                        t.status === "done"
                          ? "border-emerald-500 bg-emerald-500 text-white"
                          : "border-border hover:border-emerald-400 hover:bg-emerald-500/10",
                      )}
                      onClick={() =>
                        void setRosTaskStatus({
                          taskId: t._id,
                          status: t.status === "done" ? "open" : "done",
                        })
                      }
                      aria-label={t.status === "done" ? "Gjenåpne" : "Fullfør"}
                    >
                      {t.status === "done" && (
                        <ShieldCheck className="size-3.5" />
                      )}
                    </button>

                    <div className="min-w-0 flex-1 space-y-2">
                      <p
                        className={cn(
                          "text-sm font-medium leading-snug",
                          t.status === "done" && "line-through",
                        )}
                      >
                        {t.title}
                      </p>

                      {(t as { linkedRiskSummary?: string | null })
                        .linkedRiskSummary ? (
                        <div
                          className="bg-primary/5 ring-primary/15 text-primary/90 inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] ring-1"
                          title={
                            t.linkedCellItemPhase === "after"
                              ? "Restrisiko etter tiltak"
                              : "Risiko før tiltak (iboende)"
                          }
                        >
                          <Link2 className="size-3 shrink-0" aria-hidden />
                          <span className="text-primary truncate font-semibold">
                            {t.linkedCellItemPhase === "after"
                              ? "Restrisiko"
                              : "Risiko"}
                          </span>
                          <span className="text-primary/60">·</span>
                          <span className="truncate">
                            {(
                              (t as { linkedRiskSummary?: string | null })
                                .linkedRiskSummary ?? ""
                            ).replace(/^(Før|Etter)\s·\s/, "")}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground/80 inline-flex items-center gap-1 text-[11px] italic">
                          <Link2 className="size-3 shrink-0" aria-hidden />
                          Ikke koblet til en konkret risiko
                        </span>
                      )}

                      <div className="flex flex-wrap items-center gap-1.5">
                        {riskTreatmentLabel(t.riskTreatmentKind) ? (
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1",
                              t.riskTreatmentKind === "mitigate" &&
                                "bg-blue-500/10 text-blue-700 ring-blue-500/15 dark:text-blue-300",
                              t.riskTreatmentKind === "accept" &&
                                "bg-amber-500/10 text-amber-700 ring-amber-500/15 dark:text-amber-300",
                              t.riskTreatmentKind === "transfer" &&
                                "bg-violet-500/10 text-violet-700 ring-violet-500/15 dark:text-violet-300",
                              t.riskTreatmentKind === "avoid" &&
                                "bg-red-500/10 text-red-700 ring-red-500/15 dark:text-red-300",
                            )}
                          >
                            {riskTreatmentLabel(t.riskTreatmentKind)}
                          </span>
                        ) : null}
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1",
                            (t.priority ?? 3) <= 2
                              ? "bg-blue-500/10 text-blue-700 ring-blue-500/15 dark:text-blue-300"
                              : (t.priority ?? 3) >= 4
                                ? "bg-red-500/10 text-red-700 ring-red-500/15 dark:text-red-300"
                                : "bg-muted/60 text-muted-foreground ring-border/40",
                          )}
                        >
                          P{t.priority ?? 3}
                        </span>
                      </div>

                      {t.description && (
                        <p className="text-muted-foreground text-xs leading-relaxed">
                          {t.description}
                        </p>
                      )}

                      <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-[10px]">
                        {t.assigneeName && <span>{t.assigneeName}</span>}
                        {t.dueAt && (
                          <span
                            className={cn(
                              t.status !== "done" &&
                                t.dueAt < Date.now() &&
                                "font-semibold text-red-600 dark:text-red-400",
                            )}
                          >
                            Frist {formatTs(t.dueAt)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover/task:opacity-100 focus-within:opacity-100">
                      {t.linkedCellItemId && t.linkedCellItemPhase && (
                        <button
                          type="button"
                          className="text-muted-foreground hover:bg-emerald-500/10 hover:text-emerald-600 rounded-lg p-1.5 transition-colors"
                          onClick={() =>
                            openSaveTaskToLibrary({
                              _id: t._id,
                              title: t.title,
                              description: t.description,
                              linkedCellItemId: t.linkedCellItemId,
                              linkedCellItemPhase: t.linkedCellItemPhase,
                            })
                          }
                          aria-label="Lagre i biblioteket for gjenbruk"
                          title="Lagre i biblioteket for gjenbruk"
                        >
                          <BookmarkPlus className="size-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-lg p-1.5 transition-colors"
                        onClick={() => setEditingTaskId(t._id)}
                        aria-label="Rediger"
                        title="Rediger"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        className="text-muted-foreground hover:bg-red-500/10 hover:text-red-600 rounded-lg p-1.5 transition-colors"
                        onClick={() => {
                          if (window.confirm("Slette dette tiltaket?")) {
                            void removeRosTask({ taskId: t._id });
                          }
                        }}
                        aria-label="Slett"
                        title="Slett"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      )}

      {/* === Section 2: Oversikt === */}
      {rosSection === 2 && (
      <div className="space-y-5">
        <div className="space-y-1">
          <h2 className="text-foreground text-base font-semibold tracking-tight">
            Oversikt over risikoene
          </h2>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Hele risikoregisteret samlet — før og etter tiltak side om side.
            Bruk dette som dokumentasjon ved eksport eller revisjon.
          </p>
        </div>

        {data.rosSummary.suggestedLinkFlags.length > 0 && (
          <div className="ring-amber-500/15 flex items-start gap-2 rounded-2xl bg-amber-500/[0.06] px-4 py-3 ring-1">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <p className="text-foreground/90 text-xs leading-relaxed">
              <span className="font-semibold">Foreslåtte PVV-flagg:</span>{" "}
              <span className="text-muted-foreground">
                {data.rosSummary.suggestedLinkFlags.join(", ")}
              </span>
            </p>
          </div>
        )}

        {(() => {
          const hasAnyRisk =
            !!riskRegisterSnapshot &&
            (riskRegisterSnapshot.before.cellItems.some((row) =>
              row.some((cell) => cell.length > 0),
            ) ||
              riskRegisterSnapshot.after.cellItems.some((row) =>
                row.some((cell) => cell.length > 0),
              ));
          return (
        <div id="ros-risk-register" className="scroll-mt-24">
          {riskRegisterSnapshot && hasAnyRisk ? (
            <RosRiskRegisterTable
              sameLayout={data.rosSummary.sameLayout}
              rowAxisTitle={data.rowAxisTitle}
              colAxisTitle={data.colAxisTitle}
              before={riskRegisterSnapshot.before}
              after={riskRegisterSnapshot.after}
            />
          ) : (
            <div className="from-primary/[0.06] via-card to-card border-border/40 flex flex-col items-center gap-3 rounded-3xl border bg-gradient-to-br px-6 py-10 text-center shadow-sm">
              <div className="bg-primary/15 ring-primary/20 flex size-12 items-center justify-center rounded-2xl ring-1">
                <Shield className="text-primary size-6" />
              </div>
              <div className="space-y-1">
                <p className="text-foreground text-sm font-semibold">
                  Ingen risikoer registrert ennå
                </p>
                <p className="text-muted-foreground mx-auto max-w-xs text-xs leading-relaxed">
                  Gå til <span className="font-medium">Risikoer</span> og legg
                  inn punkter — så bygges oversikten her automatisk.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-1 rounded-full"
                onClick={() => setRosSection(0)}
              >
                Gå til risikoer
                <ChevronRight className="ml-1 size-3.5" aria-hidden />
              </Button>
            </div>
          )}
        </div>
          );
        })()}
      </div>
      )}

      {/* === Section 3: PVV === */}
      {rosSection === 3 && (
      <div className="space-y-5">
        <div className="space-y-1">
          <h2 className="text-foreground text-base font-semibold tracking-tight">
            Koble PVV-vurderinger
          </h2>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Koble personvernvurderinger til denne ROS-analysen for å spore
            samsvar mellom risiko, vurdering og prosessdesign.
          </p>
        </div>

        {pddAlignmentHint && (
          <div className="ring-amber-500/15 flex items-start gap-2 rounded-2xl bg-amber-500/[0.06] px-3 py-2.5 ring-1">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <p className="text-foreground/90 text-xs leading-relaxed">
              <span className="font-semibold">Samsvar ROS og PDD:</span>{" "}
              <span className="text-muted-foreground">
                {ROS_PDD_ALIGNMENT_HINT_NB}
              </span>
            </p>
          </div>
        )}

        {/* Koble ny PVV-vurdering — øverst, kompakt chip-form */}
        {addableAssessments.length > 0 && (
          <div className="bg-card ring-border/40 flex gap-2 rounded-2xl p-3 shadow-sm ring-1">
            <select
              className="border-input bg-background h-9 min-w-0 flex-1 rounded-full border px-3 text-xs"
              value={addPvId}
              onChange={(e) =>
                setAddPvId(
                  e.target.value === ""
                    ? ""
                    : (e.target.value as Id<"assessments">),
                )
              }
              aria-label="Velg PVV-vurdering å koble"
            >
              <option value="">— Velg PVV-vurdering å koble —</option>
              {addableAssessments.map((a) => (
                <option key={a._id} value={a._id}>
                  {a.title}
                </option>
              ))}
            </select>
            <Button
              type="button"
              disabled={addPvId === ""}
              onClick={() => void onAddPv()}
              className="h-9 shrink-0 gap-1.5 rounded-full px-4 font-semibold"
            >
              <Plus className="size-4" />
              <span className="hidden sm:inline">Koble</span>
            </Button>
          </div>
        )}

        {data.legacyAssessmentId && (
          <div className="bg-muted/20 ring-border/40 flex flex-col gap-3 rounded-2xl px-4 py-3 ring-1 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-foreground/90 text-xs">
              Denne analysen har en <strong>eldre enkeltkobling</strong>.
              Migrer eller fjern den.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                className="h-8 rounded-full"
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
                className="h-8 rounded-full"
                onClick={() => void clearLegacyAssessment({ analysisId })}
              >
                Fjern
              </Button>
            </div>
          </div>
        )}

        {data.linkedAssessments.length === 0 ? (
          <div className="from-primary/[0.06] via-card to-card border-border/40 flex flex-col items-center gap-3 rounded-3xl border bg-gradient-to-br px-6 py-10 text-center shadow-sm">
            <div className="bg-primary/15 ring-primary/20 flex size-12 items-center justify-center rounded-2xl ring-1">
              <Link2 className="text-primary size-6" />
            </div>
            <div className="space-y-1">
              <p className="text-foreground text-sm font-semibold">
                Ingen PVV-vurderinger koblet
              </p>
              <p className="text-muted-foreground mx-auto max-w-xs text-xs leading-relaxed">
                {addableAssessments.length > 0
                  ? "Velg en vurdering i feltet over for å koble den."
                  : "Opprett en personvernvurdering først, så kan du koble den hit."}
              </p>
            </div>
          </div>
        ) : (
          <ul className="bg-card/80 ring-border/40 divide-y divide-border/40 overflow-hidden rounded-2xl shadow-sm ring-1">
            {data.linkedAssessments.map((l) => {
              const status = (l.pddStatus ?? "not_started") as ComplianceStatusKey;
              return (
                <li key={l.linkId} className="group/pvv">
                  <div className="flex items-start gap-3 px-4 py-3 sm:px-5">
                    <Link2
                      className="text-primary mt-1 size-4 shrink-0"
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <Link
                          href={`/w/${workspaceId}/a/${l.assessmentId}`}
                          className="text-primary truncate text-sm font-semibold hover:underline"
                        >
                          {l.title}
                        </Link>
                        <Link
                          href={`/w/${workspaceId}/a/${l.assessmentId}/prosessdesign`}
                          className="text-muted-foreground hover:text-primary text-[11px] font-medium underline-offset-4 hover:underline"
                        >
                          Åpne PDD
                        </Link>
                        {l.pddUrl && (
                          <a
                            href={l.pddUrl}
                            className="text-muted-foreground hover:text-primary text-[11px] underline-offset-4 hover:underline"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Ekstern lenke
                          </a>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold",
                            status === "completed"
                              ? "bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/15 dark:text-emerald-300"
                              : status === "in_progress"
                                ? "bg-blue-500/10 text-blue-700 ring-1 ring-blue-500/15 dark:text-blue-300"
                                : "bg-muted/60 text-muted-foreground ring-1 ring-border/40",
                          )}
                        >
                          PDD: {COMPLIANCE_STATUS_LABELS[status]}
                        </span>
                        {l.highlightForPvv && (
                          <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-amber-500/15 dark:text-amber-300">
                            Viktig for PVV
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive size-8 shrink-0 rounded-full p-0 opacity-0 transition-all group-hover/pvv:opacity-100"
                      onClick={() => void onUnlink(l.linkId)}
                      aria-label="Fjern kobling"
                    >
                      <Trash2 className="mx-auto size-3.5" />
                    </button>
                  </div>
                  <details className="group/pvv-fields border-border/30 border-t">
                    <summary className="text-muted-foreground hover:text-foreground flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-2 text-[11px] font-medium transition-colors [&::-webkit-details-marker]:hidden sm:px-5">
                      <span>Flagg, notater og vekting</span>
                      <ChevronRight
                        className="size-3.5 transition-transform group-open/pvv-fields:rotate-90"
                        aria-hidden
                      />
                    </summary>
                    <div className="px-4 pb-3 pt-1 sm:px-5">
                      <RosPvvLinkFields
                        linkId={l.linkId}
                        flags={l.flags}
                        highlightForPvv={l.highlightForPvv}
                        pvvLinkNote={l.pvvLinkNote}
                        suggestedFlags={data.rosSummary.suggestedLinkFlags}
                        onSave={async (patch) => {
                          await updateRosAssessmentLink({
                            linkId: l.linkId,
                            ...patch,
                          });
                        }}
                      />
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      )}

      {/* === Section 4: Innstillinger === */}
      {rosSection === 4 && (
      <div className="space-y-5">
        <div className="space-y-1">
          <h2 className="text-foreground text-base font-semibold tracking-tight">
            Innstillinger
          </h2>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Tittel, notater og avansert oppsett. Revisjon og varsling ligger øverst;
            «Detaljer» under — resten er valgfritt.
          </p>
        </div>

        {/* Revisjon og varsling — planlagt oppfølging etter ROS (ISO 31000 / NS 5814) */}
        <div className="from-primary/[0.04] via-card to-card ring-border/40 space-y-4 rounded-2xl bg-gradient-to-br p-4 shadow-sm ring-1 sm:p-5">
          <div className="flex items-start gap-2.5">
            <Calendar
              className="text-primary mt-0.5 size-4 shrink-0"
              aria-hidden
            />
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-foreground text-sm font-semibold tracking-tight">
                Revisjon og varsling
              </p>
              <p className="text-muted-foreground text-[11px] leading-relaxed">
                Sett når ROS skal gjennomgås på nytt etter at arbeidet er utført.
                Du kan legge hendelsen i kalender (.ics), velge gjentakelse, og slå
                av e-postvarsler uten å fjerne selve fristen.
              </p>
            </div>
          </div>

          <div className="border-border/40 space-y-3 rounded-xl border bg-card/70 px-3 py-3 sm:px-4">
            <label className="flex cursor-pointer items-start gap-3">
              <Checkbox
                checked={reviewScheduleActive}
                disabled={reviewMetaSaving}
                onCheckedChange={(c) => {
                  const checked = Boolean(c);
                  void (async () => {
                    const prev = reviewScheduleActive;
                    setReviewScheduleActive(checked);
                    const ok = await patchRosReviewFields({
                      reviewScheduleActive: checked,
                    });
                    if (!ok) {
                      setReviewScheduleActive(prev);
                      return;
                    }
                    toast.success(
                      checked
                        ? "Planlagt revisjon er aktiv."
                        : "Planlagt revisjon er pauset (ingen liste/e-post for denne analysen).",
                    );
                  })();
                }}
                className="mt-0.5"
              />
              <span>
                <span className="text-sm font-medium">Planlagt revisjon</span>
                <span className="text-muted-foreground block text-[11px] leading-snug">
                  Neste frist vises i arbeidsområdets revisjonsoversikt når dette er
                  på.
                </span>
              </span>
            </label>

            <label className="flex cursor-pointer items-start gap-3">
              <Checkbox
                checked={reviewEmailRemindersEnabled}
                disabled={reviewMetaSaving || !reviewScheduleActive}
                onCheckedChange={(c) => {
                  const checked = Boolean(c);
                  void (async () => {
                    const prev = reviewEmailRemindersEnabled;
                    setReviewEmailRemindersEnabled(checked);
                    const ok = await patchRosReviewFields({
                      reviewEmailRemindersEnabled: checked,
                    });
                    if (!ok) {
                      setReviewEmailRemindersEnabled(prev);
                      return;
                    }
                    toast.success(
                      checked
                        ? "E-post påminnelse ved forfalt frist er på."
                        : "E-post påminnelse er av (fristen vises fortsatt i appen).",
                    );
                  })();
                }}
                className="mt-0.5"
              />
              <span>
                <span className="text-sm font-medium">E-postvarsling</span>
                <span className="text-muted-foreground block text-[11px] leading-snug">
                  Sendes når fristen er passert (maks. én gang i uken per analyse).
                  Krever e-post konfigurert i drift.
                </span>
                <span className="text-foreground/90 mt-1.5 block text-[11px] leading-snug">
                  <span className="font-semibold">Mottaker:</span>{" "}
                  {rosReviewReminderRecipientLine ??
                    "Den som opprettet denne ROS-analysen — samme e-postadresse som på brukerkontoen (ikke valgfritt mottaker i dag)."}
                </span>
              </span>
            </label>
          </div>

          {!reviewScheduleActive ? (
            <p className="text-muted-foreground text-[11px] leading-relaxed">
              Skru på «Planlagt revisjon» over for å sette dato, intervall og
              kalenderfil.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="ros-next-review" className="text-xs">
                    Neste revisjon (dato og klokkeslett)
                  </Label>
                  <Input
                    id="ros-next-review"
                    type="datetime-local"
                    value={nextReviewLocal}
                    disabled={reviewMetaSaving}
                    onChange={(e) => {
                      setNextReviewLocal(e.target.value);
                      setDirty(true);
                    }}
                    onBlur={() => void flushReviewSchedule()}
                    className="h-10 rounded-xl"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="ros-review-recurrence" className="text-xs">
                    Intervall etter «revisjon gjennomført»
                  </Label>
                  <select
                    id="ros-review-recurrence"
                    className="border-input bg-background flex h-10 w-full rounded-xl border px-3 text-sm disabled:opacity-50"
                    value={reviewRecurrenceKind}
                    disabled={reviewMetaSaving}
                    onChange={(e) => {
                      const nextKind = parseRosReviewRecurrenceKind(
                        e.target.value,
                      );
                      const prevKind = reviewRecurrenceKind;
                      setReviewRecurrenceKind(nextKind);
                      void (async () => {
                        const ok = await patchRosReviewFields({
                          reviewRecurrenceKind:
                            nextKind === "none" ? null : nextKind,
                        });
                        if (!ok) setReviewRecurrenceKind(prevKind);
                      })();
                    }}
                  >
                    {ROS_REVIEW_RECURRENCE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-muted-foreground text-[11px] leading-relaxed">
                    Med intervall annet enn «Kun manuell frist» oppdateres neste
                    revisjonsdato automatisk når du trykker «Merk revisjon
                    gjennomført».
                  </p>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="ros-review-routine" className="text-xs">
                    Rutine / huskeliste
                  </Label>
                  <Textarea
                    id="ros-review-routine"
                    value={reviewRoutineNotes}
                    disabled={reviewMetaSaving}
                    onChange={(e) => {
                      setReviewRoutineNotes(e.target.value);
                      setDirty(true);
                    }}
                    onBlur={() => void flushReviewSchedule()}
                    rows={2}
                    className="min-h-[2.5rem] rounded-xl"
                    placeholder="F.eks. årlig gjennomgang i sikkerhetsforum, eier bytter …"
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={reviewMetaSaving}
                  className="h-9 gap-1.5 rounded-full px-4 text-xs font-semibold"
                  onClick={() => void applyNextReviewFromToday()}
                >
                  Sett neste frist fra i dag
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={reviewMetaSaving}
                  className="h-9 gap-1.5 rounded-full px-4 text-xs font-semibold"
                  onClick={downloadRosReviewCalendarFile}
                >
                  <Calendar className="size-3.5" aria-hidden />
                  Last ned .ics
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={reviewMetaSaving}
                  className="h-9 gap-1.5 rounded-full px-4 text-xs font-semibold"
                  onClick={() => void markFormalReviewDone()}
                >
                  Merk revisjon gjennomført
                </Button>
              </div>
              {data.lastFormalReviewCompletedAt != null ? (
                <p className="text-muted-foreground text-[11px]">
                  Sist merket gjennomført:{" "}
                  {new Date(data.lastFormalReviewCompletedAt).toLocaleString(
                    "nb-NO",
                    { dateStyle: "short", timeStyle: "short" },
                  )}
                </p>
              ) : null}
            </div>
          )}
        </div>

        {/* Detaljer — alltid synlig */}
        <div className="bg-card ring-border/40 space-y-4 rounded-2xl p-4 shadow-sm ring-1 sm:p-5">
          <p className="text-foreground text-sm font-semibold">Detaljer</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="ros-title" className="text-xs">
                Tittel
              </Label>
              <Input
                id="ros-title"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setDirty(true);
                }}
                className="h-10 rounded-xl"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="ros-notes" className="text-xs">
                Notat
              </Label>
              <Textarea
                id="ros-notes"
                value={notes}
                onChange={(e) => {
                  setNotes(e.target.value);
                  setDirty(true);
                }}
                rows={3}
                className="min-h-[4rem] rounded-xl"
                placeholder="Frittekst om kontekst, beslutninger eller forutsetninger …"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label
                htmlFor="ros-org-unit"
                className="flex items-center gap-1.5 text-xs"
              >
                <Building2
                  className="text-muted-foreground size-3.5"
                  aria-hidden
                />
                Organisasjonsenhet
              </Label>
              <select
                id="ros-org-unit"
                className="border-input bg-background flex h-10 w-full rounded-xl border px-3 text-sm"
                value={orgUnitLocal}
                onChange={(e) => {
                  const v = e.target.value;
                  setOrgUnitLocal(v === "" ? "" : (v as Id<"orgUnits">));
                }}
                onBlur={() => void flushOrgUnit()}
              >
                <option value="">— Ikke satt (bruker prosessens enhet) —</option>
                {(orgUnits ?? []).map((u) => (
                  <option key={u._id} value={u._id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Avansert: livssyklus og krav */}
        <details className="group/sec bg-card ring-border/40 rounded-2xl shadow-sm ring-1">
          <summary className="hover:bg-muted/30 flex cursor-pointer list-none items-center justify-between gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition-colors [&::-webkit-details-marker]:hidden sm:px-5">
            <span className="flex items-center gap-2">
              <span>Livssyklus og krav</span>
              <span className="text-muted-foreground text-[11px] font-normal">
                · metode, kontekst, regelverk
              </span>
            </span>
            <ChevronRight
              className="text-muted-foreground size-4 transition-transform group-open/sec:rotate-90"
              aria-hidden
            />
          </summary>
          <div className="border-border/30 border-t px-4 py-4 sm:px-5">
            <RosLifecycleCompliancePanel
              methodologyStatement={methodologyStatement}
              contextSummary={contextSummary}
              scopeAndCriteria={scopeAndCriteria}
              riskCriteriaVersion={riskCriteriaVersion}
              axisScaleNotes={axisScaleNotes}
              complianceScopeTags={complianceScopeTags}
              requirementRefs={requirementRefs}
              sectorPackLabel={
                data.rosSectorPackId
                  ? getRosSectorPack(data.rosSectorPackId)?.name ?? null
                  : null
              }
              onChange={(patch) => {
                if (patch.methodologyStatement !== undefined)
                  setMethodologyStatement(patch.methodologyStatement);
                if (patch.contextSummary !== undefined)
                  setContextSummary(patch.contextSummary);
                if (patch.scopeAndCriteria !== undefined)
                  setScopeAndCriteria(patch.scopeAndCriteria);
                if (patch.riskCriteriaVersion !== undefined)
                  setRiskCriteriaVersion(patch.riskCriteriaVersion);
                if (patch.axisScaleNotes !== undefined)
                  setAxisScaleNotes(patch.axisScaleNotes);
                if (patch.complianceScopeTags !== undefined)
                  setComplianceScopeTags(patch.complianceScopeTags);
                if (patch.requirementRefs !== undefined)
                  setRequirementRefs(patch.requirementRefs);
                setDirty(true);
              }}
            />
          </div>
        </details>

        {/* Avansert: etter tiltak — egne akser */}
        <details
          className="group/sec bg-card ring-border/40 rounded-2xl shadow-sm ring-1"
          open={useSeparateAfterAxes}
        >
          <summary className="hover:bg-muted/30 flex cursor-pointer list-none items-center justify-between gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition-colors [&::-webkit-details-marker]:hidden sm:px-5">
            <span className="flex items-center gap-2">
              <span>Etter tiltak — egne akser</span>
              <span className="text-muted-foreground text-[11px] font-normal">
                · sjelden brukt
              </span>
            </span>
            <ChevronRight
              className="text-muted-foreground size-4 transition-transform group-open/sec:rotate-90"
              aria-hidden
            />
          </summary>
          <div className="border-border/30 space-y-4 border-t px-4 py-4 sm:px-5">
            <div className="flex items-start gap-3">
              <Checkbox
                id="ros-separate-after"
                checked={useSeparateAfterAxes}
                onCheckedChange={(c) => {
                  const checked = Boolean(c);
                  if (checked && data) {
                    setRowLabelsAfterText(data.rowLabels.join("\n"));
                    setColLabelsAfterText(data.colLabels.join("\n"));
                    setRowAxisTitleAfter(data.rowAxisTitle);
                    setColAxisTitleAfter(data.colAxisTitle);
                    setMatrixAfter(matrix.map((r) => [...r]));
                    setCellItemsAfterMatrix(
                      cellItemsMatrix.map((r) =>
                        r.map((c2) => c2.map((it) => ({ ...it }))),
                      ),
                    );
                  }
                  setUseSeparateAfterAxes(checked);
                  setDirty(true);
                }}
              />
              <Label
                htmlFor="ros-separate-after"
                className="cursor-pointer text-sm"
              >
                Bruk eget rutenett for etter tiltak
                <span className="text-muted-foreground mt-0.5 block text-[11px] font-normal">
                  Skru på dersom akser eller skala skal være ulike før/etter.
                </span>
              </Label>
            </div>
            {useSeparateAfterAxes && (
              <div className="border-border/30 space-y-4 border-t pt-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="ros-after-row-axis" className="text-xs">
                      Radakse
                    </Label>
                    <Input
                      id="ros-after-row-axis"
                      value={rowAxisTitleAfter}
                      onChange={(e) => {
                        setRowAxisTitleAfter(e.target.value);
                        setDirty(true);
                      }}
                      className="h-10 rounded-xl"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ros-after-col-axis" className="text-xs">
                      Kolonneakse
                    </Label>
                    <Input
                      id="ros-after-col-axis"
                      value={colAxisTitleAfter}
                      onChange={(e) => {
                        setColAxisTitleAfter(e.target.value);
                        setDirty(true);
                      }}
                      className="h-10 rounded-xl"
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="rounded-full"
                  onClick={() => copyBeforeAxesToAfter()}
                >
                  Kopier fra før-matrise
                </Button>
                <RosLabelLevelsEditor
                  variant="matrixAxes"
                  id="ros-after-rows"
                  title="Rader"
                  intro="Hvert nummer er ett nivå."
                  value={rowLabelsAfterText}
                  onChange={onRowLabelsAfterChange}
                  defaultLabels={DEFAULT_ROS_ROW_LABELS}
                  lowEndHint="lav"
                  highEndHint="høy"
                />
                <RosLabelLevelsEditor
                  variant="matrixAxes"
                  id="ros-after-cols"
                  title="Kolonner"
                  intro="Hvert nummer er ett nivå."
                  value={colLabelsAfterText}
                  onChange={onColLabelsAfterChange}
                  defaultLabels={DEFAULT_ROS_COL_LABELS}
                  lowEndHint="lav"
                  highEndHint="høy"
                />
              </div>
            )}
          </div>
        </details>

        {/* Avansert: versjoner */}
        <details className="group/sec bg-card ring-border/40 rounded-2xl shadow-sm ring-1">
          <summary className="hover:bg-muted/30 flex cursor-pointer list-none items-center justify-between gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition-colors [&::-webkit-details-marker]:hidden sm:px-5">
            <span className="flex items-center gap-2">
              <span>Versjoner</span>
              {versions && versions.length > 0 && (
                <span className="text-muted-foreground text-[11px] font-normal">
                  · {versions.length} lagret
                </span>
              )}
            </span>
            <ChevronRight
              className="text-muted-foreground size-4 transition-transform group-open/sec:rotate-90"
              aria-hidden
            />
          </summary>
          <div className="border-border/30 border-t px-4 py-4 sm:px-5">
            <RosVersionsPanel
              analysisId={analysisId}
              versions={versions}
              onRestored={() => setDirty(false)}
            />
          </div>
        </details>

        {/* Avansert: journal */}
        <details className="group/sec bg-card ring-border/40 rounded-2xl shadow-sm ring-1">
          <summary className="hover:bg-muted/30 flex cursor-pointer list-none items-center justify-between gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition-colors [&::-webkit-details-marker]:hidden sm:px-5">
            <span className="flex items-center gap-2">
              <span>Journal</span>
              <span className="text-muted-foreground text-[11px] font-normal">
                · endringslogg
              </span>
            </span>
            <ChevronRight
              className="text-muted-foreground size-4 transition-transform group-open/sec:rotate-90"
              aria-hidden
            />
          </summary>
          <div className="border-border/30 border-t px-4 py-4 sm:px-5">
            <RosJournalPanel
              analysisId={analysisId}
              expectedRevision={data.revision ?? 0}
              rowLabels={data.rowLabels}
              colLabels={data.colLabels}
              afterRowLabels={effectiveAfterRowLabels}
              afterColLabels={effectiveAfterColLabels}
              afterSeparate={useSeparateAfterAxes}
              onJumpToCell={handleJumpToCell}
              onJournalConflict={() =>
                toast.error(
                  "Journalen kunne ikke lagres: analysen har nyere revisjon på serveren. Oppdater siden og prøv igjen.",
                )
              }
            />
          </div>
        </details>
      </div>
      )}

      {/* Bottom navigation — slank pill-rad */}
      <div className="bg-background/95 supports-[backdrop-filter]:bg-background/80 fixed bottom-0 left-0 right-0 z-30 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5">
          <Button
            type="button"
            variant="ghost"
            className="text-muted-foreground hover:text-foreground h-9 gap-1.5 rounded-full px-3 text-sm font-medium"
            onClick={() => setRosSection((s) => Math.max(0, s - 1))}
            disabled={rosSection <= 0}
          >
            <ChevronLeft className="size-4" aria-hidden />
            Forrige
          </Button>
          <div className="flex items-center gap-1.5">
            {ROS_EDITOR_SECTIONS.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setRosSection(i)}
                className={cn(
                  "size-2 rounded-full transition-all duration-200",
                  rosSection === i
                    ? "bg-primary scale-125"
                    : "bg-border hover:bg-muted-foreground/50",
                )}
                aria-label={`Gå til del ${i + 1}`}
              />
            ))}
          </div>
          {rosSection >= ROS_EDITOR_SECTIONS.length - 1 ? (
            <Button
              type="button"
              className="h-9 gap-1.5 rounded-full px-5 text-sm font-semibold shadow-sm"
              disabled={saving}
              onClick={async () => {
                const ok = await save();
                if (!ok) return;
                router.push(`/w/${workspaceId}/ros`);
              }}
            >
              {saving ? "Lagrer …" : "Ferdig"}
              <ChevronRight className="size-4" aria-hidden />
            </Button>
          ) : (
            <Button
              type="button"
              className="h-9 gap-1.5 rounded-full px-5 text-sm font-semibold shadow-sm"
              onClick={() =>
                setRosSection((s) =>
                  Math.min(ROS_EDITOR_SECTIONS.length - 1, s + 1),
                )
              }
            >
              Neste
              <ChevronRight className="size-4" aria-hidden />
            </Button>
          )}
        </div>
      </div>

      {/* === Lagre tiltak (med risiko) i bibliotek === */}
      <Dialog
        open={savingTaskToLibrary !== null}
        onOpenChange={(open) => {
          if (!open) setSavingTaskToLibrary(null);
        }}
      >
        <DialogContent size="md" titleId="ros-task-save-lib-title">
          <DialogHeader>
            <h2
              id="ros-task-save-lib-title"
              className="font-heading text-lg font-semibold"
            >
              Lagre tiltak i bibliotek
            </h2>
            <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
              Tiltaket lagres sammen med risikoen det reduserer, slik at
              du kan gjenbruke paret i andre ROS-analyser.
            </p>
          </DialogHeader>
          <DialogBody>
            <div className="space-y-3">
              {savingTaskToLibrary?.riskLocation && (
                <div className="bg-primary/[0.06] ring-primary/15 rounded-xl px-3 py-2 ring-1">
                  <p className="text-muted-foreground text-[11px] font-medium uppercase tracking-wider">
                    Tilknyttet risiko
                  </p>
                  <p className="text-primary mt-0.5 text-[11px] font-semibold">
                    {savingTaskToLibrary.riskLocation}
                  </p>
                  <p className="text-foreground/90 mt-1 line-clamp-3 text-xs leading-relaxed">
                    {savingTaskToLibrary.riskText}
                  </p>
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="ros-task-save-lib-name">Tittel</Label>
                <Input
                  id="ros-task-save-lib-name"
                  value={saveLibTitle}
                  onChange={(e) => setSaveLibTitle(e.target.value)}
                  placeholder="Kort, gjenkjennelig navn"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ros-task-save-lib-tiltak">
                  Tiltakstekst
                </Label>
                <Textarea
                  id="ros-task-save-lib-tiltak"
                  value={saveLibTiltak}
                  onChange={(e) => setSaveLibTiltak(e.target.value)}
                  rows={3}
                  className="min-h-0"
                  placeholder="Hva må gjøres? (bruk gjerne flere linjer)"
                />
                <p className="text-muted-foreground text-[11px]">
                  Vises sammen med risikoen når noen henter forslaget fra
                  biblioteket.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="ros-task-save-lib-cat">
                    Kategori (valgfritt)
                  </Label>
                  <select
                    id="ros-task-save-lib-cat"
                    className="border-input bg-background flex h-10 w-full rounded-lg border px-2 text-sm"
                    value={saveLibCategoryId}
                    onChange={(e) =>
                      setSaveLibCategoryId(
                        (e.target.value || "") as
                          | Id<"rosLibraryCategories">
                          | "",
                      )
                    }
                  >
                    <option value="">— Ingen —</option>
                    {(libraryCategories ?? []).map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ros-task-save-lib-vis">Synlighet</Label>
                  <select
                    id="ros-task-save-lib-vis"
                    className="border-input bg-background flex h-10 w-full rounded-lg border px-2 text-sm"
                    value={saveLibVisibility}
                    onChange={(e) =>
                      setSaveLibVisibility(
                        e.target.value as "workspace" | "shared",
                      )
                    }
                  >
                    <option value="workspace">
                      Kun dette arbeidsområdet
                    </option>
                    <option value="shared">
                      Delt — alle mine arbeidsområder
                    </option>
                  </select>
                </div>
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={() => setSavingTaskToLibrary(null)}
            >
              Avbryt
            </Button>
            <Button
              type="button"
              className="gap-1.5 rounded-full font-semibold"
              disabled={
                saveLibBusy ||
                !saveLibTitle.trim() ||
                !savingTaskToLibrary?.riskText.trim()
              }
              onClick={() => void confirmSaveTaskToLibrary()}
            >
              <BookmarkPlus className="size-4" aria-hidden />
              {saveLibBusy ? "Lagrer …" : "Lagre i biblioteket"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Risikokoblings-select: gruppert med <optgroup> slik at brukeren tydelig
 * ser at «Før» = iboende risiko, og «Etter» = restrisiko etter tiltak.
 * Tom verdi i topp = «Ikke koblet».
 */
function RiskLinkSelect({
  id,
  value,
  onChange,
  options,
  className,
  ariaLabel,
  disabled,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: RosTaskRiskLinkOption[];
  className?: string;
  ariaLabel?: string;
  disabled?: boolean;
}) {
  const beforeOptions = options.filter((o) => o.group === "before");
  const afterOptions = options.filter((o) => o.group === "after");
  const noneOption = options.find((o) => !o.group);
  return (
    <select
      id={id}
      className={className}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={ariaLabel}
      disabled={disabled}
    >
      {noneOption && (
        <option value={noneOption.value}>{noneOption.label}</option>
      )}
      {beforeOptions.length > 0 && (
        <optgroup label={ROS_TASK_RISK_LINK_GROUP_LABELS.before}>
          {beforeOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </optgroup>
      )}
      {afterOptions.length > 0 && (
        <optgroup label={ROS_TASK_RISK_LINK_GROUP_LABELS.after}>
          {afterOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </optgroup>
      )}
    </select>
  );
}

function TaskEditForm({
  task,
  members,
  riskLinkOptions,
  onCancel,
  onSave,
}: {
  task: {
    _id: Id<"rosTasks">;
    title: string;
    description?: string;
    assigneeUserId?: Id<"users">;
    assigneeUserIds?: Id<"users">[];
    priority?: number;
    dueAt?: number;
    linkedCellItemId?: string;
    linkedCellItemPhase?: "before" | "after";
    riskTreatmentKind?: "mitigate" | "accept" | "transfer" | "avoid";
    residualRiskAcceptedNote?: string;
  };
  members: Array<{
    userId: Id<"users">;
    name?: string | null;
    email?: string | null;
  }>;
  riskLinkOptions: RosTaskRiskLinkOption[];
  onCancel: () => void;
  onSave: (patch: {
    title: string;
    description: string | null;
    assigneeUserIds: Id<"users">[] | null;
    priority: number;
    dueAt: number | null;
    linkedCellItemId: string | null;
    linkedCellItemPhase: "before" | "after" | null;
    riskTreatmentKind: "mitigate" | "accept" | "transfer" | "avoid" | null;
    residualRiskAcceptedNote: string | null;
  }) => Promise<void>;
}) {
  const initialRiskLink = rosTaskRiskLinkValue(
    task.linkedCellItemId,
    task.linkedCellItemPhase,
  );
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const initialAssignees =
    task.assigneeUserIds && task.assigneeUserIds.length > 0
      ? task.assigneeUserIds
      : task.assigneeUserId
        ? [task.assigneeUserId]
        : [];
  const [assigneeIds, setAssigneeIds] = useState<Id<"users">[]>(initialAssignees);
  const [priority, setPriority] = useState(task.priority ?? 3);
  const [dueAt, setDueAt] = useState(
    task.dueAt
      ? new Date(task.dueAt).toISOString().slice(0, 16)
      : "",
  );
  const [riskLink, setRiskLink] = useState(initialRiskLink);
  const [treatment, setTreatment] = useState<
    "" | "mitigate" | "accept" | "transfer" | "avoid"
  >(task.riskTreatmentKind ?? "");
  const [acceptNote, setAcceptNote] = useState(
    task.residualRiskAcceptedNote ?? "",
  );
  const [busy, setBusy] = useState(false);

  return (
    <div className="space-y-3">
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Tittel"
        className="rounded-xl font-medium"
      />
      <Textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
        className="min-h-0 rounded-xl text-sm"
        placeholder="Beskrivelse (valgfritt)"
      />
      <div className="grid gap-2 sm:grid-cols-2">
        <RiskLinkSelect
          value={riskLink}
          onChange={setRiskLink}
          options={riskLinkOptions}
          className="border-input bg-background flex h-9 w-full rounded-xl border px-2 text-xs"
          ariaLabel="Hvilken risiko reduseres?"
        />
        <select
          className="border-input bg-background flex h-9 w-full rounded-xl border px-2 text-xs"
          value={treatment}
          onChange={(e) =>
            setTreatment(
              e.target.value === "" ? "" : (e.target.value as "mitigate" | "accept" | "transfer" | "avoid"),
            )
          }
          aria-label="Behandlingsstrategi"
        >
          {ROS_RISK_TREATMENT_OPTIONS.map((o) => (
            <option key={o.value || "none"} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
      {treatment === "accept" && (
        <Textarea
          value={acceptNote}
          onChange={(e) => setAcceptNote(e.target.value)}
          rows={2}
          className="min-h-0 rounded-xl text-sm"
          placeholder="Grunnlag for aksept …"
        />
      )}
      <div className="space-y-1.5">
        {assigneeIds.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {assigneeIds.map((uid) => {
              const m = members.find((wm) => wm.userId === uid);
              return (
                <span key={uid} className="bg-card inline-flex items-center gap-1 rounded-full border py-0.5 pr-1 pl-2 text-[11px] shadow-xs">
                  {m?.name ?? m?.email ?? uid}
                  <button type="button" className="text-muted-foreground hover:text-destructive p-0.5" onClick={() => setAssigneeIds((ids) => ids.filter((id) => id !== uid))}>×</button>
                </span>
              );
            })}
          </div>
        ) : null}
        <select
          className="border-input bg-background flex h-9 w-full rounded-xl border px-2 text-xs"
          value=""
          onChange={(e) => {
            const uid = e.target.value as Id<"users">;
            if (uid && !assigneeIds.includes(uid)) {
              setAssigneeIds((ids) => [...ids, uid]);
            }
          }}
        >
          <option value="">— Legg til ansvarlig —</option>
          {members
            .filter((m) => !assigneeIds.includes(m.userId))
            .map((m) => (
              <option key={m.userId} value={m.userId}>{m.name ?? m.email ?? m.userId}</option>
            ))}
        </select>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Input
          type="number"
          min={1}
          max={5}
          value={priority}
          onChange={(e) => setPriority(Math.min(5, Math.max(1, Number(e.target.value) || 3)))}
          className="rounded-xl text-xs"
          placeholder="Prioritet"
        />
        <Input
          type="datetime-local"
          value={dueAt}
          onChange={(e) => setDueAt(e.target.value)}
          className="rounded-xl text-xs"
        />
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          className="rounded-xl"
          disabled={busy || !title.trim()}
          onClick={() => {
            setBusy(true);
            const dueMs = dueAt === "" ? null : new Date(dueAt).getTime();
            const risk = parseRosTaskRiskLink(riskLink);
            void onSave({
              title: title.trim(),
              description: description.trim() || null,
              assigneeUserIds: assigneeIds.length > 0 ? assigneeIds : null,
              priority,
              dueAt: dueMs,
              linkedCellItemId: risk ? risk.linkedCellItemId : null,
              linkedCellItemPhase: risk ? risk.linkedCellItemPhase : null,
              riskTreatmentKind: treatment === "" ? null : treatment,
              residualRiskAcceptedNote: treatment === "accept" ? acceptNote.trim() || null : null,
            }).finally(() => setBusy(false));
          }}
        >
          Lagre
        </Button>
        <Button type="button" size="sm" variant="ghost" className="rounded-xl" onClick={onCancel}>
          Avbryt
        </Button>
      </div>
    </div>
  );
}
