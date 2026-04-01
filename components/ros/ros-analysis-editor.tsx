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
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import {
  collectIdentifiedRisksForPdf,
  flattenCellItemsMatrixToLegacyNotes,
  newRosCellItemId,
  resizeCellItemsMatrix,
  type RosCellItem,
  type RosCellItemMatrix,
} from "@/lib/ros-cell-items";
import {
  DEFAULT_ROS_COL_LABELS,
  DEFAULT_ROS_ROW_LABELS,
  positionRiskLevel,
} from "@/lib/ros-defaults";
import {
  parseLabelLines,
  resizeNumberMatrix,
} from "@/lib/ros-matrix-resize";
import {
  COMPLIANCE_STATUS_LABELS,
  type ComplianceStatusKey,
} from "@/lib/helsesector-labels";
import { ROS_PDD_ALIGNMENT_HINT_NB } from "@/lib/ros-compliance";
import { toast } from "@/lib/app-toast";
import { toastDeleteWithUndo } from "@/lib/toast-delete-undo";
import { cellRiskClass } from "@/lib/ros-risk-colors";
import { cn } from "@/lib/utils";
import type { RosRequirementRef } from "@/lib/ros-requirement-catalog";
import { downloadRosAnalysisPdf } from "@/lib/ros-pdf";
import {
  buildRosTaskRiskLinkOptions,
  parseRosTaskRiskLink,
  riskTreatmentLabel,
  ROS_RISK_TREATMENT_OPTIONS,
} from "@/lib/ros-task-ui";
import {
  AlertTriangle,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  FileDown,
  Link2,
  ListTodo,
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

function tsToDatetimeLocal(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
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
    let total = 0;
    let highBefore = 0;
    let criticalBefore = 0;
    let needsAction = 0;
    let highAfter = 0;

    for (let r = 0; r < cellItemsMatrix.length; r++) {
      const row = cellItemsMatrix[r];
      if (!row) continue;
      for (let c = 0; c < row.length; c++) {
        const cell = row[c];
        if (!cell) continue;
        for (const it of cell) {
          if (!it.text.trim()) continue;
          total++;
          const bLvl = positionRiskLevel(r, c, rowLabels.length, colLabels.length);
          if (bLvl >= 4) highBefore++;
          if (bLvl >= 5) criticalBefore++;
          const hasFlag = it.flags?.includes("requires_action");
          if (bLvl >= 4 && !hasFlag) needsAction++;
          const aR = it.afterRow ?? r;
          const aC = it.afterCol ?? c;
          const aLvl = positionRiskLevel(aR, aC, afterRowLabels.length, afterColLabels.length);
          if (aLvl >= 4) highAfter++;
        }
      }
    }

    const maxBefore = Math.max(0, ...matrixValues.flat());
    const maxAfter = Math.max(0, ...matrixAfter.flat());
    const overallLevel = maxBefore >= 5 ? "Kritisk" : maxBefore >= 4 ? "Høy" : maxBefore >= 3 ? "Middels" : maxBefore >= 2 ? "Lav" : "Ingen";
    const overallColor = maxBefore >= 5 ? "text-red-600 dark:text-red-400" : maxBefore >= 4 ? "text-orange-600 dark:text-orange-400" : maxBefore >= 3 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400";

    return { total, highBefore, criticalBefore, needsAction, highAfter, maxBefore, maxAfter, overallLevel, overallColor };
  }, [cellItemsMatrix, matrixValues, matrixAfter, rowLabels, colLabels, afterRowLabels, afterColLabels]);

  if (stats.total === 0) return null;

  const improved = stats.highBefore > stats.highAfter;

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <div className="flex items-center gap-3 rounded-2xl bg-muted/20 px-4 py-3 ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <Shield className="size-5 text-primary" />
        </div>
        <div>
          <p className="text-2xl font-bold tabular-nums leading-none">{stats.total}</p>
          <p className="text-muted-foreground mt-0.5 text-[11px]">Risikoer</p>
        </div>
      </div>

      <div className={cn(
        "flex items-center gap-3 rounded-2xl px-4 py-3 ring-1",
        stats.highBefore > 0
          ? "bg-red-500/[0.06] ring-red-500/15"
          : "bg-emerald-500/[0.06] ring-emerald-500/15",
      )}>
        <div className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-xl",
          stats.highBefore > 0 ? "bg-red-500/15" : "bg-emerald-500/15",
        )}>
          {stats.highBefore > 0
            ? <ShieldAlert className="size-5 text-red-600 dark:text-red-400" />
            : <ShieldCheck className="size-5 text-emerald-600 dark:text-emerald-400" />
          }
        </div>
        <div>
          <p className="text-2xl font-bold tabular-nums leading-none">{stats.highBefore}</p>
          <p className="text-muted-foreground mt-0.5 text-[11px]">Høy/kritisk</p>
        </div>
      </div>

      <div className={cn(
        "flex items-center gap-3 rounded-2xl px-4 py-3 ring-1",
        stats.needsAction > 0
          ? "bg-amber-500/[0.06] ring-amber-500/15"
          : "bg-muted/20 ring-black/[0.04] dark:ring-white/[0.06]",
      )}>
        <div className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-xl",
          stats.needsAction > 0 ? "bg-amber-500/15" : "bg-muted/30",
        )}>
          <AlertTriangle className={cn(
            "size-5",
            stats.needsAction > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground",
          )} />
        </div>
        <div>
          <p className="text-2xl font-bold tabular-nums leading-none">{stats.needsAction}</p>
          <p className="text-muted-foreground mt-0.5 text-[11px]">Trenger tiltak</p>
        </div>
      </div>

      <div className={cn(
        "flex items-center gap-3 rounded-2xl px-4 py-3 ring-1 ring-black/[0.04] dark:ring-white/[0.06]",
        improved ? "bg-emerald-500/[0.06]" : "bg-muted/20",
      )}>
        <div className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold tabular-nums",
          cellRiskClass(stats.maxBefore),
        )}>
          {stats.maxBefore}
        </div>
        <div>
          <p className={cn("text-sm font-bold leading-tight", stats.overallColor)}>
            {stats.overallLevel}
          </p>
          {improved ? (
            <p className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
              <ArrowRight className="size-3" />
              Max {stats.maxAfter} etter
            </p>
          ) : (
            <p className="text-muted-foreground mt-0.5 text-[11px]">Risikonivå</p>
          )}
        </div>
      </div>
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

  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [nextReviewLocal, setNextReviewLocal] = useState("");
  const [reviewRoutineNotes, setReviewRoutineNotes] = useState("");
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
  const [matrix, setMatrix] = useState<number[][]>([]);
  const [cellItemsMatrix, setCellItemsMatrix] =
    useState<RosCellItemMatrix>([]);
  const [matrixAfter, setMatrixAfter] = useState<number[][]>([]);
  const [cellItemsAfterMatrix, setCellItemsAfterMatrix] =
    useState<RosCellItemMatrix>([]);
  const [matrixView, setMatrixView] = useState<"before" | "after">("before");
  const [matrixScaleHelpOpen, setMatrixScaleHelpOpen] = useState(false);
  const [jumpRequest, setJumpRequest] = useState<{
    row: number;
    col: number;
    nonce: number;
  } | null>(null);
  const [highlightCell, setHighlightCell] = useState<[number, number] | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const [addPvId, setAddPvId] = useState<Id<"assessments"> | "">("");

  const analysisRevisionRef = useRef<number | null>(null);
  const rosSaveQueueRef = useRef<Promise<boolean>>(Promise.resolve(true));
  const saveRef = useRef<
    ((opts?: { silent?: boolean }) => Promise<boolean>) | null
  >(null);
  const dirtyRef = useRef(false);
  const canAutosaveRef = useRef(false);
  dirtyRef.current = dirty;

  const [rosSection, setRosSection] = useState(ROS_MATRISE_SECTION_INDEX);

  const [taskTitle, setTaskTitle] = useState("");
  const [taskDesc, setTaskDesc] = useState("");
  const [taskAssignee, setTaskAssignee] = useState<Id<"users"> | "">("");
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
      if (matrixView === "after") {
        setCellItemsAfterMatrix((prev) => {
          const copy = prev.map((r) => r.map((c) => [...c]));
          if (!copy[row]) return prev;
          copy[row][col] = items;
          return copy;
        });
      } else {
        setCellItemsMatrix((prev) => {
          const copy = prev.map((r) => r.map((c) => [...c]));
          if (!copy[row]) return prev;
          copy[row][col] = items;
          return copy;
        });
      }
      setDirty(true);
    },
    [matrixView],
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
      setDirty(true);
    },
    [data],
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

      removeAfterCopyEverywhere(risk.id);
      if (risk.afterRow !== risk.beforeRow || risk.afterCol !== risk.beforeCol) {
        setCellItemsAfterMatrix((prev) => {
          const copy = prev.map((r) => r.map((c) => [...c]));
          if (!copy[risk.afterRow]) return prev;
          if (!copy[risk.afterRow][risk.afterCol])
            copy[risk.afterRow][risk.afterCol] = [];
          copy[risk.afterRow][risk.afterCol].push({
            id: newRosCellItemId(),
            text: risk.text,
            flags: risk.flags,
            sourceItemId: risk.id,
          });
          return copy;
        });
        setMatrixAfter((prev) => {
          const copy = prev.map((r) => [...r]);
          if (!copy[risk.afterRow]) return prev;
          const cur = copy[risk.afterRow][risk.afterCol] ?? 0;
          if (cur <= 0) {
            copy[risk.afterRow][risk.afterCol] = positionRiskLevel(
              risk.afterRow,
              risk.afterCol,
              effectiveAfterRowLabels.length,
              effectiveAfterColLabels.length,
            );
          }
          return copy;
        });
      }

      setDirty(true);
    },
    [data, removeAfterCopyEverywhere, effectiveAfterRowLabels.length, effectiveAfterColLabels.length],
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

  const activeMatrix = matrixView === "after" ? matrixAfter : matrix;

  const matrixStats = useMemo(() => {
    let max = 0;
    let highOrCritical = 0;
    for (const row of activeMatrix) {
      for (const v of row) {
        if (v > max) max = v;
        if (v >= 4) highOrCritical += 1;
      }
    }
    return { max, highOrCritical };
  }, [activeMatrix]);

  const statsFor = useCallback((m: number[][]) => {
    let max = 0;
    let highOrCritical = 0;
    for (const row of m) {
      for (const v of row) {
        if (v > max) max = v;
        if (v >= 4) highOrCritical += 1;
      }
    }
    return { max, highOrCritical };
  }, []);

  const beforeStats = useMemo(() => statsFor(matrix), [matrix, statsFor]);
  const afterStats = useMemo(() => statsFor(matrixAfter), [matrixAfter, statsFor]);

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

  async function flushReviewSchedule() {
    if (!data) return;
    const rev = analysisRevisionRef.current ?? data.revision ?? 0;
    const raw = nextReviewLocal.trim();
    const nextMs = raw === "" ? null : new Date(raw).getTime();
    if (raw !== "" && !Number.isFinite(nextMs)) return;
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
          methodologyStatement: methodologyStatement.trim() || null,
          contextSummary: contextSummary.trim() || null,
          scopeAndCriteria: scopeAndCriteria.trim() || null,
          riskCriteriaVersion: riskCriteriaVersion.trim() || null,
          axisScaleNotes: axisScaleNotes.trim() || null,
          complianceScopeTags:
            complianceScopeTags.length === 0 ? null : complianceScopeTags,
          requirementRefs:
            cleanedRefs.length === 0 ? null : cleanedRefs,
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
    methodologyStatement,
    contextSummary,
    scopeAndCriteria,
    riskCriteriaVersion,
    axisScaleNotes,
    complianceScopeTags,
    requirementRefs,
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
    const taskLinesAll =
      tasks?.map((t) => {
        const due = t.dueAt ? ` · frist ${formatTs(t.dueAt)}` : "";
        return {
          line: `${t.title}${due}`,
          statusLabel: t.status === "open" ? "Åpen" : "Fullført",
        };
      }) ?? [];

    const pvvLinksDetailed = data.linkedAssessments.map((l) => ({
      title: l.title,
      pddLabel:
        COMPLIANCE_STATUS_LABELS[
          (l.pddStatus ?? "not_started") as ComplianceStatusKey
        ],
      linkNote: l.note?.trim() || undefined,
      pvvLinkNote: l.pvvLinkNote?.trim() || undefined,
      flagsText: l.flags?.length ? l.flags.join(", ") : undefined,
      highlightForPvv: Boolean(l.highlightForPvv),
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
      taskLinesAll: taskLinesAll.length > 0 ? taskLinesAll : undefined,
      identifiedRisks:
        identifiedRisks.length > 0 ? identifiedRisks : undefined,
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
        assigneeUserId:
          taskAssignee === "" ? undefined : taskAssignee,
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
      setTaskAssignee("");
      setTaskPriority(3);
      setTaskRiskLink("");
      setTaskRiskTreatment("");
      setTaskResidualNote("");
      setTaskDueAt("");
      toast.success("Oppgave opprettet.");
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Kunne ikke opprette oppgave.",
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
      {/* Sticky header */}
      <div className="sticky top-0 z-20 -mx-1 bg-background/95 px-1 pb-2 pt-2 backdrop-blur-md supports-[backdrop-filter]:bg-background/85">
        <div className="flex items-center gap-3">
          <Link
            href={`/w/${workspaceId}/ros`}
            className="text-muted-foreground hover:text-foreground flex size-9 shrink-0 items-center justify-center rounded-xl transition-colors hover:bg-muted/60"
            title="Tilbake til ROS"
          >
            <ChevronLeft className="size-5" aria-hidden />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="font-heading truncate text-base font-semibold tracking-tight text-foreground sm:text-lg">
              {data.title}
            </h1>
            <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
              {data.candidateName ? (
                <span>
                  {data.candidateName}{" "}
                  <span className="font-mono text-[10px]">({data.candidateCode})</span>
                </span>
              ) : (
                <span className="italic">Frittstående analyse</span>
              )}
              {data.linkedAssessments.length > 0 && (
                <>
                  <span className="text-border">·</span>
                  <span className="flex items-center gap-1">
                    <Link2 className="size-3" aria-hidden />
                    {data.linkedAssessments.map((l, li) => (
                      <span key={l.linkId}>
                        {li > 0 ? ", " : ""}
                        <Link href={`/w/${workspaceId}/a/${l.assessmentId}`} className="text-primary hover:underline">
                          {l.title}
                        </Link>
                      </span>
                    ))}
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              size="sm"
              onClick={() => void save()}
              disabled={saving}
              className="gap-1.5 rounded-xl font-semibold shadow-sm"
            >
              {saving ? "Lagrer …" : dirty ? "Lagre" : "Versjon"}
            </Button>
            <Button type="button" variant="ghost" size="icon" className="size-8 rounded-xl" title="Eksporter PDF" onClick={exportPdf}>
              <FileDown className="size-4" aria-hidden />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 rounded-xl text-muted-foreground hover:text-destructive"
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

        {/* Section tabs */}
        <nav
          className="mt-3 flex gap-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label="ROS-seksjoner"
        >
          <div className="flex w-full gap-1 rounded-2xl bg-muted/25 p-1">
            {ROS_EDITOR_SECTIONS.map((sec, i) => {
              const active = rosSection === i;
              const Icon = sec.icon;
              return (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => setRosSection(i)}
                  className={cn(
                    "relative flex flex-1 shrink-0 items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-200",
                    active
                      ? "bg-card text-foreground shadow-md ring-1 ring-black/[0.06] dark:ring-white/[0.08]"
                      : "text-muted-foreground hover:text-foreground hover:bg-card/40",
                  )}
                >
                  <Icon className={cn("size-4 shrink-0", active ? "text-primary" : "")} aria-hidden />
                  <span className="hidden sm:inline">{sec.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      </div>

      <p className="sr-only">
        Piltastene venstre og høyre bytter del når fokus ikke er i et felt. På
        matrisen er de reservert til matrisen. Bruk knappene under eller Forrige /
        Neste nederst.
      </p>

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
              />
            </div>
          </div>

          {matrix.length > 0 ? (
            <>
            <div className="rounded-2xl bg-card shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
              <div className="flex flex-col gap-3 p-5 pb-3 sm:flex-row sm:items-center sm:justify-between sm:p-6 sm:pb-4">
                <div>
                  <h3 className="text-base font-semibold tracking-tight">
                    Risikomatrise
                  </h3>
                  <p className="text-muted-foreground mt-0.5 text-[13px]">
                    {data.rowAxisTitle} × {data.colAxisTitle} — klikk celler for å redigere
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold",
                    cellRiskClass(beforeStats.max),
                  )}>
                    Før: {beforeStats.max}
                  </span>
                  <ArrowRight className="text-muted-foreground size-3" />
                  <span className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold",
                    cellRiskClass(afterStats.max),
                  )}>
                    Etter: {afterStats.max}
                  </span>
                  {beforeStats.max > afterStats.max && (
                    <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                      ↓ Redusert
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-3 px-5 pb-4 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2 sm:px-6">
                <div
                  className="flex w-full min-w-0 rounded-xl bg-muted/30 p-1 sm:inline-flex sm:w-auto"
                  role="tablist"
                  aria-label="Vis matrise før eller etter tiltak"
                >
                    <button
                      type="button"
                      role="tab"
                      aria-selected={matrixView === "before"}
                      className={cn(
                        "flex-1 rounded-lg px-4 py-2 text-[13px] font-semibold transition-all sm:flex-initial",
                        matrixView === "before"
                          ? "bg-card text-foreground shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06]"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                      onClick={() => setMatrixView("before")}
                    >
                      Før tiltak
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={matrixView === "after"}
                      className={cn(
                        "flex-1 rounded-lg px-4 py-2 text-[13px] font-semibold transition-all sm:flex-initial",
                        matrixView === "after"
                          ? "bg-card text-foreground shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06]"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                      onClick={() => setMatrixView("after")}
                    >
                      Etter tiltak
                    </button>
                  </div>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-primary transition-colors hover:bg-primary/10"
                    onClick={() => setMatrixScaleHelpOpen(true)}
                    aria-expanded={matrixScaleHelpOpen}
                    aria-controls="ros-matrix-scale-help"
                  >
                    <CircleHelp className="size-4 shrink-0" aria-hidden />
                    Skala
                  </button>
                </div>
              <div className="px-5 pb-5 sm:px-6 sm:pb-6">
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

      {/* === Section 1: Oppgaver === */}
      {rosSection === 1 && (
      <div className="space-y-5">
        {/* Task stats */}
        {tasks && tasks.length > 0 && (() => {
          const open = tasks.filter(t => t.status !== "done").length;
          const done = tasks.filter(t => t.status === "done").length;
          const overdue = tasks.filter(t => t.status !== "done" && t.dueAt && t.dueAt < Date.now()).length;
          return (
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <div className="flex items-center gap-3 rounded-2xl bg-muted/20 px-4 py-3.5 ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10">
                  <ListTodo className="size-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold tabular-nums leading-none">{open}</p>
                  <p className="text-muted-foreground mt-0.5 text-[11px]">Åpne</p>
                </div>
              </div>
              <div className={cn(
                "flex items-center gap-3 rounded-2xl px-4 py-3.5 ring-1",
                done > 0 ? "bg-emerald-500/[0.06] ring-emerald-500/15" : "bg-muted/20 ring-black/[0.04] dark:ring-white/[0.06]",
              )}>
                <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", done > 0 ? "bg-emerald-500/15" : "bg-muted/30")}>
                  <ShieldCheck className={cn("size-5", done > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")} />
                </div>
                <div>
                  <p className="text-2xl font-bold tabular-nums leading-none">{done}</p>
                  <p className="text-muted-foreground mt-0.5 text-[11px]">Fullført</p>
                </div>
              </div>
              <div className={cn(
                "flex items-center gap-3 rounded-2xl px-4 py-3.5 ring-1",
                overdue > 0 ? "bg-red-500/[0.06] ring-red-500/15" : "bg-muted/20 ring-black/[0.04] dark:ring-white/[0.06]",
              )}>
                <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", overdue > 0 ? "bg-red-500/15" : "bg-muted/30")}>
                  <AlertTriangle className={cn("size-5", overdue > 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground")} />
                </div>
                <div>
                  <p className="text-2xl font-bold tabular-nums leading-none">{overdue}</p>
                  <p className="text-muted-foreground mt-0.5 text-[11px]">Forfalt</p>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Task list */}
        {tasks === undefined ? (
          <p className="text-muted-foreground text-sm">Henter oppgaver …</p>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl bg-muted/10 px-6 py-12 text-center ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10">
              <ListTodo className="size-7 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">Ingen oppgaver ennå</p>
              <p className="text-muted-foreground mt-1 max-w-xs text-xs">
                Opprett en oppgave for å holde oversikt over tiltak, ansvar og frister.
              </p>
            </div>
          </div>
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
                    {/* Status toggle */}
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
                      {t.status === "done" && <ShieldCheck className="size-3.5" />}
                    </button>

                    {/* Content */}
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <p className={cn(
                        "text-sm font-medium leading-snug",
                        t.status === "done" && "line-through",
                      )}>{t.title}</p>

                      <div className="flex flex-wrap items-center gap-1.5">
                        {riskTreatmentLabel(t.riskTreatmentKind) ? (
                          <span className="inline-flex items-center rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                            {riskTreatmentLabel(t.riskTreatmentKind)}
                          </span>
                        ) : null}
                        <span className={cn(
                          "inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
                          (t.priority ?? 3) <= 2 ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                            : (t.priority ?? 3) >= 4 ? "bg-red-500/10 text-red-600 dark:text-red-400"
                            : "bg-muted text-muted-foreground",
                        )}>
                          P{t.priority ?? 3}
                        </span>
                        {(t as { linkedRiskSummary?: string | null }).linkedRiskSummary && (
                          <span className="text-muted-foreground flex items-center gap-1 text-[10px]">
                            <Link2 className="size-2.5" />
                            {(t as { linkedRiskSummary?: string | null }).linkedRiskSummary}
                          </span>
                        )}
                      </div>

                      {t.description && (
                        <p className="text-muted-foreground text-xs leading-relaxed">{t.description}</p>
                      )}

                      <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-[10px]">
                        {t.assigneeName && <span>{t.assigneeName}</span>}
                        {t.dueAt && (
                          <span className={cn(
                            t.status !== "done" && t.dueAt < Date.now() && "font-semibold text-red-600 dark:text-red-400",
                          )}>
                            Frist {formatTs(t.dueAt)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover/task:opacity-100">
                      <button
                        type="button"
                        className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        onClick={() => setEditingTaskId(t._id)}
                        aria-label="Rediger"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="size-3.5"><path d="M13.488 2.513a1.75 1.75 0 0 0-2.475 0L3.22 10.306a1 1 0 0 0-.26.443l-.884 3.182a.25.25 0 0 0 .306.306l3.182-.884a1 1 0 0 0 .443-.26l7.793-7.793a1.75 1.75 0 0 0 0-2.475l-.312-.312Z" /></svg>
                      </button>
                      <button
                        type="button"
                        className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-600"
                        onClick={() => {
                          if (window.confirm("Slette denne oppgaven?")) {
                            void removeRosTask({ taskId: t._id });
                          }
                        }}
                        aria-label="Slett"
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

        {/* Quick-add form */}
        <form
          onSubmit={(e) => void onCreateTask(e)}
          className="space-y-4 rounded-2xl bg-card p-4 shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06] sm:p-5"
        >
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Ny oppgave</p>
          <div className="flex gap-2">
            <Input
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              placeholder="Hva må gjøres?"
              className="flex-1 rounded-xl"
            />
            <Button type="submit" disabled={taskBusy || !taskTitle.trim()} className="shrink-0 rounded-xl">
              <Plus className="size-4" />
              <span className="hidden sm:inline">Opprett</span>
            </Button>
          </div>

          {/* Collapsed advanced fields */}
          {taskTitle.trim() && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Textarea
                value={taskDesc}
                onChange={(e) => setTaskDesc(e.target.value)}
                rows={2}
                className="min-h-0 rounded-xl text-sm sm:col-span-2"
                placeholder="Beskrivelse (valgfritt)"
              />
              <select
                className="border-input bg-background flex h-9 w-full rounded-xl border px-2 text-xs"
                value={taskRiskLink}
                onChange={(e) => setTaskRiskLink(e.target.value)}
              >
                {taskRiskLinkOptions.map((o) => (
                  <option key={o.value || "opt-none"} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <select
                className="border-input bg-background flex h-9 w-full rounded-xl border px-2 text-xs"
                value={taskRiskTreatment}
                onChange={(e) =>
                  setTaskRiskTreatment(
                    e.target.value === ""
                      ? ""
                      : (e.target.value as "mitigate" | "accept" | "transfer" | "avoid"),
                  )
                }
              >
                {ROS_RISK_TREATMENT_OPTIONS.map((o) => (
                  <option key={o.value || "none"} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              {taskRiskTreatment === "accept" && (
                <Textarea
                  value={taskResidualNote}
                  onChange={(e) => setTaskResidualNote(e.target.value)}
                  rows={2}
                  className="min-h-0 rounded-xl text-sm sm:col-span-2"
                  placeholder="Grunnlag for aksept …"
                />
              )}
              <select
                className="border-input bg-background flex h-9 w-full rounded-xl border px-2 text-xs"
                value={taskAssignee}
                onChange={(e) =>
                  setTaskAssignee(e.target.value === "" ? "" : (e.target.value as Id<"users">))
                }
              >
                <option value="">— Tildel ansvarlig —</option>
                {(members ?? []).map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.name ?? m.email ?? m.userId}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min={1}
                  max={5}
                  value={taskPriority}
                  onChange={(e) =>
                    setTaskPriority(Math.min(5, Math.max(1, Number(e.target.value) || 3)))
                  }
                  className="w-20 rounded-xl text-xs"
                  placeholder="Prio"
                />
                <Input
                  type="datetime-local"
                  value={taskDueAt}
                  onChange={(e) => setTaskDueAt(e.target.value)}
                  className="flex-1 rounded-xl text-xs"
                />
              </div>
            </div>
          )}
        </form>
      </div>
      )}

      {/* === Section 2: Oppsummering === */}
      {rosSection === 2 && (
      <div className="space-y-5">
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

        <div id="ros-risk-register" className="scroll-mt-24">
          {riskRegisterSnapshot ? (
            <RosRiskRegisterTable
              sameLayout={data.rosSummary.sameLayout}
              before={riskRegisterSnapshot.before}
              after={riskRegisterSnapshot.after}
            />
          ) : null}
        </div>

        {data.rosSummary.suggestedLinkFlags.length > 0 && (
          <div className="flex items-center gap-2 rounded-xl bg-amber-500/[0.06] px-4 py-3 ring-1 ring-amber-500/15">
            <Sparkles className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">Foreslåtte PVV-flagg:</span>{" "}
              {data.rosSummary.suggestedLinkFlags.join(", ")}
            </p>
          </div>
        )}
      </div>
      )}

      {/* === Section 3: PVV === */}
      {rosSection === 3 && (
      <div className="space-y-5">
        {pddAlignmentHint && (
          <div className="flex items-start gap-3 rounded-2xl bg-amber-500/[0.06] px-4 py-3.5 ring-1 ring-amber-500/15">
            <ShieldAlert className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="text-sm font-semibold">Samsvar ROS og PDD</p>
              <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
                {ROS_PDD_ALIGNMENT_HINT_NB}
              </p>
            </div>
          </div>
        )}

        {data.legacyAssessmentId && (
          <div className="flex flex-col gap-3 rounded-2xl bg-muted/20 px-4 py-4 ring-1 ring-black/[0.04] dark:ring-white/[0.06] sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm">
              Denne analysen har en <strong>eldre enkeltkobling</strong>. Migrer eller fjern den.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" className="rounded-xl" onClick={() => void migrateLegacyAssessmentToLinks({ analysisId })}>
                Flytt til koblinger
              </Button>
              <Button type="button" size="sm" variant="outline" className="rounded-xl" onClick={() => void clearLegacyAssessment({ analysisId })}>
                Fjern
              </Button>
            </div>
          </div>
        )}

        {data.linkedAssessments.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl bg-muted/10 px-6 py-12 text-center ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10">
              <Link2 className="size-7 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">Ingen PVV-vurderinger koblet</p>
              <p className="text-muted-foreground mt-1 max-w-xs text-xs">
                Koble personvernvurderinger for å spore samsvar mellom risikoanalyse og PDD.
              </p>
            </div>
          </div>
        ) : (
          <ul className="space-y-2">
            {data.linkedAssessments.map((l) => (
              <li
                key={l.linkId}
                className="group/pvv overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-black/[0.04] transition-all duration-200 hover:shadow-md dark:ring-white/[0.06]"
              >
                <div className="flex items-start gap-3 px-4 py-3.5 sm:gap-4">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                    <Link2 className="size-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <Link
                      href={`/w/${workspaceId}/a/${l.assessmentId}`}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      {l.title}
                    </Link>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn(
                        "inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
                        (l.pddStatus ?? "not_started") === "completed" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                          : (l.pddStatus ?? "not_started") === "in_progress" ? "bg-blue-500/10 text-blue-700 dark:text-blue-300"
                          : "bg-muted text-muted-foreground",
                      )}>
                        PDD: {COMPLIANCE_STATUS_LABELS[(l.pddStatus ?? "not_started") as ComplianceStatusKey]}
                      </span>
                      {l.highlightForPvv && (
                        <span className="inline-flex items-center rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                          Viktig for PVV
                        </span>
                      )}
                      {l.pddUrl && (
                        <a href={l.pddUrl} className="text-primary text-[10px] underline-offset-4 hover:underline" target="_blank" rel="noopener noreferrer">
                          PDD-lenke
                        </a>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="rounded-lg p-1.5 text-muted-foreground opacity-0 transition-all hover:bg-red-500/10 hover:text-red-600 group-hover/pvv:opacity-100"
                    onClick={() => void onUnlink(l.linkId)}
                    aria-label="Fjern kobling"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
                <div className="border-t border-border/30 px-4 py-3">
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
              </li>
            ))}
          </ul>
        )}

        {/* Add link */}
        <div className="flex gap-2 rounded-2xl bg-card p-4 shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
          <select
            className="border-input bg-background flex h-9 min-w-0 flex-1 rounded-xl border px-2 text-xs"
            value={addPvId}
            onChange={(e) =>
              setAddPvId(e.target.value === "" ? "" : (e.target.value as Id<"assessments">))
            }
          >
            <option value="">— Koble ny PVV-vurdering —</option>
            {addableAssessments.map((a) => (
              <option key={a._id} value={a._id}>{a.title}</option>
            ))}
          </select>
          <Button type="button" disabled={addPvId === ""} onClick={() => void onAddPv()} className="shrink-0 rounded-xl">
            <Plus className="size-4" />
            Koble
          </Button>
        </div>
      </div>
      )}

      {/* === Section 4: Innstillinger (consolidated) === */}
      {rosSection === 4 && (
      <div className="space-y-5">
        {/* Detaljer */}
        <div className="space-y-4 rounded-2xl bg-card p-5 shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06] sm:p-6">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Detaljer</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="ros-title" className="text-xs">Tittel</Label>
              <Input
                id="ros-title"
                value={title}
                onChange={(e) => { setTitle(e.target.value); setDirty(true); }}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="ros-notes" className="text-xs">Notat</Label>
              <Textarea
                id="ros-notes"
                value={notes}
                onChange={(e) => { setNotes(e.target.value); setDirty(true); }}
                rows={3}
                className="min-h-[4rem] rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ros-next-review" className="text-xs">Neste revisjon</Label>
              <Input
                id="ros-next-review"
                type="datetime-local"
                value={nextReviewLocal}
                onChange={(e) => { setNextReviewLocal(e.target.value); setDirty(true); }}
                onBlur={() => void flushReviewSchedule()}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ros-review-routine" className="text-xs">Rutine</Label>
              <Textarea
                id="ros-review-routine"
                value={reviewRoutineNotes}
                onChange={(e) => { setReviewRoutineNotes(e.target.value); setDirty(true); }}
                onBlur={() => void flushReviewSchedule()}
                rows={2}
                className="min-h-[3rem] rounded-xl"
                placeholder="F.eks. årlig gjennomgang …"
              />
            </div>
          </div>
        </div>

        {/* Livssyklus og krav */}
        <RosLifecycleCompliancePanel
          methodologyStatement={methodologyStatement}
          contextSummary={contextSummary}
          scopeAndCriteria={scopeAndCriteria}
          riskCriteriaVersion={riskCriteriaVersion}
          axisScaleNotes={axisScaleNotes}
          complianceScopeTags={complianceScopeTags}
          requirementRefs={requirementRefs}
          onChange={(patch) => {
            if (patch.methodologyStatement !== undefined) setMethodologyStatement(patch.methodologyStatement);
            if (patch.contextSummary !== undefined) setContextSummary(patch.contextSummary);
            if (patch.scopeAndCriteria !== undefined) setScopeAndCriteria(patch.scopeAndCriteria);
            if (patch.riskCriteriaVersion !== undefined) setRiskCriteriaVersion(patch.riskCriteriaVersion);
            if (patch.axisScaleNotes !== undefined) setAxisScaleNotes(patch.axisScaleNotes);
            if (patch.complianceScopeTags !== undefined) setComplianceScopeTags(patch.complianceScopeTags);
            if (patch.requirementRefs !== undefined) setRequirementRefs(patch.requirementRefs);
            setDirty(true);
          }}
        />

        {/* Etter tiltak — egne akser */}
        <div className="space-y-4 rounded-2xl bg-card p-5 shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06] sm:p-6">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Etter tiltak — egne akser</p>
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
                  setCellItemsAfterMatrix(cellItemsMatrix.map((r) => r.map((c2) => c2.map((it) => ({ ...it })))));
                }
                setUseSeparateAfterAxes(checked);
                setDirty(true);
              }}
            />
            <Label htmlFor="ros-separate-after" className="cursor-pointer text-sm">
              Bruk eget rutenett for etter tiltak
            </Label>
          </div>
          {useSeparateAfterAxes && (
            <div className="space-y-5 border-t border-border/30 pt-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="ros-after-row-axis" className="text-xs">Radakse</Label>
                  <Input id="ros-after-row-axis" value={rowAxisTitleAfter} onChange={(e) => { setRowAxisTitleAfter(e.target.value); setDirty(true); }} className="rounded-xl" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ros-after-col-axis" className="text-xs">Kolonneakse</Label>
                  <Input id="ros-after-col-axis" value={colAxisTitleAfter} onChange={(e) => { setColAxisTitleAfter(e.target.value); setDirty(true); }} className="rounded-xl" />
                </div>
              </div>
              <Button type="button" variant="secondary" size="sm" className="rounded-xl" onClick={() => copyBeforeAxesToAfter()}>
                Kopier fra før-matrise
              </Button>
              <RosLabelLevelsEditor variant="matrixAxes" id="ros-after-rows" title="Rader" intro="Hvert nummer er ett nivå." value={rowLabelsAfterText} onChange={onRowLabelsAfterChange} defaultLabels={DEFAULT_ROS_ROW_LABELS} lowEndHint="lav" highEndHint="høy" />
              <RosLabelLevelsEditor variant="matrixAxes" id="ros-after-cols" title="Kolonner" intro="Hvert nummer er ett nivå." value={colLabelsAfterText} onChange={onColLabelsAfterChange} defaultLabels={DEFAULT_ROS_COL_LABELS} lowEndHint="lav" highEndHint="høy" />
            </div>
          )}
        </div>

        <RosVersionsPanel
          analysisId={analysisId}
          versions={versions}
          onRestored={() => setDirty(false)}
        />

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
      )}

      {/* Bottom navigation */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/85">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5">
          <Button
            type="button"
            variant="ghost"
            className="h-10 gap-1.5 rounded-xl px-4 text-sm font-medium"
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
                  rosSection === i ? "bg-primary scale-125" : "bg-border hover:bg-muted-foreground/50",
                )}
                aria-label={`Gå til del ${i + 1}`}
              />
            ))}
          </div>
          {rosSection >= ROS_EDITOR_SECTIONS.length - 1 ? (
            <Button
              type="button"
              className="h-10 gap-1.5 rounded-xl px-5 text-sm font-semibold shadow-md"
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
              className="h-10 gap-1.5 rounded-xl px-5 text-sm font-semibold shadow-md"
              onClick={() => setRosSection((s) => Math.min(ROS_EDITOR_SECTIONS.length - 1, s + 1))}
            >
              Neste
              <ChevronRight className="size-4" aria-hidden />
            </Button>
          )}
        </div>
      </div>
    </div>
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
  riskLinkOptions: { value: string; label: string }[];
  onCancel: () => void;
  onSave: (patch: {
    title: string;
    description: string | null;
    assigneeUserId: Id<"users"> | null;
    priority: number;
    dueAt: number | null;
    linkedCellItemId: string | null;
    linkedCellItemPhase: "before" | "after" | null;
    riskTreatmentKind: "mitigate" | "accept" | "transfer" | "avoid" | null;
    residualRiskAcceptedNote: string | null;
  }) => Promise<void>;
}) {
  const initialRiskLink =
    task.linkedCellItemId && task.linkedCellItemPhase
      ? `${task.linkedCellItemPhase}:${task.linkedCellItemId}`
      : "";
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
        <select
          className="border-input bg-background flex h-9 w-full rounded-xl border px-2 text-xs"
          value={riskLink}
          onChange={(e) => setRiskLink(e.target.value)}
        >
          {riskLinkOptions.map((o) => (
            <option key={o.value || "opt-none"} value={o.value}>{o.label}</option>
          ))}
        </select>
        <select
          className="border-input bg-background flex h-9 w-full rounded-xl border px-2 text-xs"
          value={treatment}
          onChange={(e) =>
            setTreatment(
              e.target.value === "" ? "" : (e.target.value as "mitigate" | "accept" | "transfer" | "avoid"),
            )
          }
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
      <div className="grid gap-2 sm:grid-cols-3">
        <select
          className="border-input bg-background flex h-9 w-full rounded-xl border px-2 text-xs"
          value={assigneeUserId}
          onChange={(e) => setAssigneeUserId(e.target.value === "" ? "" : (e.target.value as Id<"users">))}
        >
          <option value="">— Tildel —</option>
          {members.map((m) => (
            <option key={m.userId} value={m.userId}>{m.name ?? m.email ?? m.userId}</option>
          ))}
        </select>
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
              assigneeUserId: assigneeUserId === "" ? null : assigneeUserId,
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
