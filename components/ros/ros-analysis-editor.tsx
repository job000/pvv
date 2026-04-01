"use client";

import { RosJournalPanel } from "@/components/ros/ros-journal-panel";
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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
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
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  FileDown,
  History,
  Link2,
  ListTodo,
  Plus,
  Sparkles,
  Trash2,
  Undo2,
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
  { id: "risikoer", label: "Risikovurdering", hint: "Punkter først, matrise viser" },
  { id: "oppgaver", label: "Oppgaver", hint: "Tiltak og oppfølging" },
  { id: "oppsummering", label: "Oppsummering", hint: "Før/etter oversikt" },
  { id: "pvv", label: "PVV-koblinger", hint: "Koble vurderinger" },
  { id: "innstillinger", label: "Innstillinger", hint: "Detaljer, akser, versjon" },
] as const;

const ROS_MATRISE_SECTION_INDEX = 0;

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
    <div className="bg-muted/20 space-y-3 rounded-lg border p-3 text-sm">
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
        <Label htmlFor={`pvv-hi-${linkId}`} className="cursor-pointer font-normal">
          Viktig for PVV (synlig på vurderingen)
        </Label>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`pvv-flags-${linkId}`}>Flagg (kommaseparert)</Label>
        <Input
          id={`pvv-flags-${linkId}`}
          value={flagsText}
          onChange={(e) => setFlagsText(e.target.value)}
          onBlur={(e) => {
            const v = e.currentTarget.value;
            void onSave({
              flags: v
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            });
          }}
          placeholder="f.eks. rest_risk_elevated, residual_high_or_critical"
        />
        {suggestedFlags.length > 0 ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-1"
            onClick={() => {
              const merged = [
                ...new Set([
                  ...flagsText
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                  ...suggestedFlags,
                ]),
              ];
              setFlagsText(merged.join(", "));
              void onSave({ flags: merged });
            }}
          >
            <Sparkles className="mr-2 size-3.5" />
            Slå inn forslag fra oppsummering
          </Button>
        ) : null}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`pvv-note-${linkId}`}>Notat til PVV (ROS → personvern)</Label>
        <Textarea
          id={`pvv-note-${linkId}`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={(e) => {
            const v = e.currentTarget.value.trim();
            void onSave({ pvvLinkNote: v === "" ? null : v });
          }}
          rows={2}
          className="min-h-0"
        />
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
  const createVersion = useMutation(api.ros.createVersion);
  const restoreVersion = useMutation(api.ros.restoreVersion);
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
  const [versionNote, setVersionNote] = useState("");
  const [snapshotBusy, setSnapshotBusy] = useState(false);

  const analysisRevisionRef = useRef<number | null>(null);
  const rosSaveQueueRef = useRef(Promise.resolve());
  const saveRef = useRef<
    ((opts?: { silent?: boolean }) => Promise<void>) | null
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
    rosSaveQueueRef.current = Promise.resolve();
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

  async function save(opts?: { silent?: boolean }) {
    if (!data) return;
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
      return;
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
      const runSave = async () => {
        if (!data) return;
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
          return;
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
        });
        if (result.ok) {
          analysisRevisionRef.current = result.revision;
          setDirty(false);
          if (!opts?.silent) {
            toast.success("ROS-analysen er lagret.");
          }
        } else {
          toast.error(
            "ROS-analysen er allerede oppdatert på serveren (annen bruker, annen fane eller journal). Last siden på nytt og prøv igjen.",
          );
        }
      };
      rosSaveQueueRef.current = rosSaveQueueRef.current
        .catch(() => undefined)
        .then(runSave);
      await rosSaveQueueRef.current;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kunne ikke lagre.");
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

  async function onSnapshot() {
    setSnapshotBusy(true);
    try {
      await createVersion({
        analysisId,
        note: versionNote.trim() || undefined,
      });
      setVersionNote("");
      toast.success("Versjon lagret.");
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Kunne ikke lagre versjon.",
      );
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
      toast.success(`Versjon ${version} er gjenopprettet.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gjenoppretting feilet.");
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
    <div className="space-y-6 pb-28">
      <div className="relative overflow-hidden rounded-3xl border border-border/40 bg-card shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_40px_-12px_rgba(0,0,0,0.08)] ring-1 ring-black/[0.04] dark:shadow-[0_1px_0_rgba(255,255,255,0.06)_inset] dark:ring-white/[0.06]">
        <div className="from-primary/[0.07] pointer-events-none absolute inset-0 bg-gradient-to-br via-transparent to-muted/30" />
        <div className="relative flex flex-col gap-5 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-7">
          <div className="min-w-0">
            <Link
              href={`/w/${workspaceId}/ros`}
              className="text-muted-foreground hover:text-foreground mb-3 inline-flex items-center gap-1.5 text-[13px] font-medium transition-colors"
            >
              <ChevronLeft className="size-4 opacity-70" aria-hidden />
              Tilbake til ROS
            </Link>
            <p className="text-muted-foreground text-[11px] font-semibold uppercase tracking-[0.12em]">
              ROS-analyse
            </p>
            <h1 className="font-heading mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-[1.75rem]">
              {data.title}
            </h1>
            <p className="text-muted-foreground mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[14px] leading-relaxed">
              {data.candidateName ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-muted/40 px-3 py-1 text-[13px] ring-1 ring-black/[0.03] dark:ring-white/[0.05]">
                  <span className="text-muted-foreground">Prosess</span>
                  <span className="text-foreground font-medium">
                    {data.candidateName}
                  </span>
                  <span className="font-mono text-xs opacity-90">({data.candidateCode})</span>
                </span>
              ) : (
                <span className="italic">Ingen prosess koblet</span>
              )}
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
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button
              type="button"
              onClick={() => void save()}
              disabled={saving || !dirty}
              className="min-w-[7.5rem] font-semibold shadow-sm"
            >
              {saving ? "Lagrer …" : dirty ? "Lagre endringer" : "Lagret"}
            </Button>
            <Button
              type="button"
              variant="outline"
              title="PDF med alle faner: risiko, oppgaver, oppsummering, PVV-detaljer, innstillinger, logg og matriser (nåværende visning, inkl. ulagrede celler)."
              onClick={exportPdf}
            >
              <FileDown className="mr-2 size-4" aria-hidden />
              Eksporter PDF
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isDeleting || data === undefined || data === null}
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
              {isDeleting ? "Sletter…" : "Slett"}
            </Button>
          </div>
        </div>
      </div>

      <details className="group border-border/60 bg-muted/25 text-muted-foreground rounded-xl border px-3 py-2 text-xs leading-relaxed">
        <summary className="cursor-pointer list-none font-medium text-foreground marker:hidden [&::-webkit-details-marker]:hidden">
          <span className="inline-flex items-center gap-1.5">
            Autosave
            <ChevronRight className="size-3.5 transition-transform group-open:rotate-90" />
          </span>
        </summary>
        <p className="mt-2 pl-0.5">
          Lagring skjer automatisk etter kort pause og ved fanebytte. «Lagre
          endringer» tvinger lagring med én gang. Nettleseren kan advare ved lukking
          hvis det fortsatt er ulagrede endringer.
        </p>
      </details>

      <p className="sr-only">
        Piltastene venstre og høyre bytter del når fokus ikke er i et felt. På
        matrisen er de reservert til matrisen. Bruk knappene under eller Forrige /
        Neste nederst.
      </p>

      <nav
        className="flex gap-1 overflow-x-auto rounded-2xl border border-border/45 bg-muted/35 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] [-ms-overflow-style:none] [scrollbar-width:none] backdrop-blur-sm dark:bg-muted/20 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] [&::-webkit-scrollbar]:hidden"
        aria-label="ROS-seksjoner"
      >
        {ROS_EDITOR_SECTIONS.map((sec, i) => {
          const active = rosSection === i;
          return (
            <button
              key={sec.id}
              type="button"
              onClick={() => setRosSection(i)}
              className={cn(
                "shrink-0 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-[color,box-shadow,background] duration-200 sm:min-w-0 sm:px-4",
                active
                  ? "bg-card text-foreground shadow-[0_1px_3px_rgba(0,0,0,0.08)] ring-1 ring-black/[0.06] dark:shadow-[0_1px_3px_rgba(0,0,0,0.35)] dark:ring-white/[0.08]"
                  : "text-muted-foreground hover:bg-card/50 hover:text-foreground",
              )}
            >
              <span className="block leading-tight">{sec.label}</span>
              <span
                className={cn(
                  "mt-0.5 hidden text-[11px] font-normal leading-snug sm:block",
                  active ? "text-muted-foreground" : "text-muted-foreground/80",
                )}
              >
                {sec.hint}
              </span>
            </button>
          );
        })}
      </nav>

      {/* === Section 0: Risikovurdering — punkter først, matrise som visning === */}
      {rosSection === 0 && (
        <div className="space-y-6">
          {/* Identifiserte risikoer først (anbefalt flyt); matrisen fylles ut automatisk */}
          <Card className="overflow-hidden border-border/40 shadow-[0_1px_3px_rgba(0,0,0,0.04)] ring-1 ring-black/[0.03] dark:ring-white/[0.05]">
            <CardContent className="pt-6">
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
            </CardContent>
          </Card>

          {matrix.length > 0 ? (
            <>
            <Card className="overflow-hidden border-border/40 shadow-[0_1px_3px_rgba(0,0,0,0.04)] ring-1 ring-black/[0.03] dark:ring-white/[0.05]">
              <CardHeader className="border-b border-border/45 bg-gradient-to-b from-muted/40 to-muted/15 pb-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="text-base font-semibold tracking-tight">
                      Risikomatrise
                    </CardTitle>
                    <CardDescription className="max-w-prose text-[13px] leading-relaxed">
                      {data.rowAxisTitle} × {data.colAxisTitle} — synkroniseres med listen over;
                      klikk celler for å redigere.
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge variant="outline" className="font-normal">
                      Før: max <span className="text-foreground font-semibold tabular-nums">{beforeStats.max}</span>
                    </Badge>
                    <Badge variant="outline" className="font-normal">
                      Etter: max <span className="text-foreground font-semibold tabular-nums">{afterStats.max}</span>
                    </Badge>
                    {beforeStats.highOrCritical > 0 && (
                      <Badge variant="outline" className="border-orange-500/40 bg-orange-500/10 font-normal">
                        {beforeStats.highOrCritical} celle{beforeStats.highOrCritical !== 1 ? "r" : ""} nivå 4–5
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="mt-4 flex flex-col gap-3 sm:mt-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
                  <div
                    className="flex w-full min-w-0 rounded-xl border border-border/45 bg-muted/30 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:inline-flex sm:w-auto"
                    role="tablist"
                    aria-label="Vis matrise før eller etter tiltak"
                  >
                    <Button
                      type="button"
                      role="tab"
                      aria-selected={matrixView === "before"}
                      variant={matrixView === "before" ? "default" : "ghost"}
                      className={cn(
                        "h-11 min-h-[44px] flex-1 rounded-lg px-4 text-[13px] font-semibold shadow-sm sm:h-10 sm:min-h-0 sm:flex-initial",
                        matrixView !== "before" && "text-muted-foreground hover:text-foreground",
                      )}
                      onClick={() => setMatrixView("before")}
                    >
                      Før tiltak
                    </Button>
                    <Button
                      type="button"
                      role="tab"
                      aria-selected={matrixView === "after"}
                      variant={matrixView === "after" ? "default" : "ghost"}
                      className={cn(
                        "h-11 min-h-[44px] flex-1 rounded-lg px-4 text-[13px] font-semibold shadow-sm sm:h-10 sm:min-h-0 sm:flex-initial",
                        matrixView !== "after" && "text-muted-foreground hover:text-foreground",
                      )}
                      onClick={() => setMatrixView("after")}
                    >
                      Etter tiltak
                    </Button>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-11 min-h-[44px] shrink-0 gap-2 px-3 text-[13px] font-medium text-primary hover:bg-primary/10 hover:text-primary sm:h-10 sm:min-h-0"
                    onClick={() => setMatrixScaleHelpOpen(true)}
                    aria-expanded={matrixScaleHelpOpen}
                    aria-controls="ros-matrix-scale-help"
                  >
                    <CircleHelp className="size-4 shrink-0" aria-hidden />
                    <span className="underline-offset-4 hover:underline">
                      Hjelp med skala
                    </span>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
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
              </CardContent>
            </Card>

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
      <Card className="border-border/60 overflow-hidden shadow-sm">
        <CardHeader className="border-b border-border/50 bg-gradient-to-br from-muted/40 to-background pb-4">
          <CardTitle className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <span className="bg-primary/12 text-primary flex size-9 items-center justify-center rounded-xl">
              <ListTodo className="size-4" aria-hidden />
            </span>
            Oppgaver og tiltak
          </CardTitle>
          <CardDescription className="text-sm leading-relaxed">
            Koble hver oppgave til det risiko- eller tiltakspunktet du har skrevet under
            risikovurdering (samme tekst som i listen over matrisen). Velg risikohåndtering
            etter ISO 31000. Oppgaver ligger før oppsummering slik at oppfølging planlegges før
            den samlede før/etter-oversikten.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8 pt-6">
          <form
            onSubmit={(e) => void onCreateTask(e)}
            className="space-y-5 rounded-2xl border border-border/60 bg-muted/15 p-4 sm:p-5"
          >
            <div>
              <p className="text-foreground text-sm font-semibold">Ny oppgave</p>
              <p className="text-muted-foreground mt-0.5 text-xs">
                Koble til et konkret risiko-/tiltakspunkt og strategi — eller la oppgaven være generell.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="rt-title">Tittel</Label>
                <Input
                  id="rt-title"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="F.eks. Iverksett tiltak X …"
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
                  placeholder="Detaljer, ansvar, forutsetninger …"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label
                  htmlFor="rt-risk"
                  className="inline-flex items-center gap-1.5"
                >
                  <Link2 className="text-muted-foreground size-3.5" aria-hidden />
                  Kobling til risiko / tiltak
                </Label>
                <select
                  id="rt-risk"
                  className="border-input bg-background flex h-10 w-full rounded-lg border px-2 text-sm"
                  value={taskRiskLink}
                  onChange={(e) => setTaskRiskLink(e.target.value)}
                >
                  {taskRiskLinkOptions.map((o) => (
                    <option key={o.value || "opt-none"} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <p className="text-muted-foreground text-[11px] leading-snug">
                  Listen bygges fra punktene du har lagt inn under «Identifiserte risikoer» (før og etter tiltak).
                </p>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="rt-treatment">Risikohåndtering (valgfritt)</Label>
                <select
                  id="rt-treatment"
                  className="border-input bg-background flex h-10 w-full rounded-lg border px-2 text-sm"
                  value={taskRiskTreatment}
                  onChange={(e) =>
                    setTaskRiskTreatment(
                      e.target.value === ""
                        ? ""
                        : (e.target.value as
                            | "mitigate"
                            | "accept"
                            | "transfer"
                            | "avoid"),
                    )
                  }
                >
                  {ROS_RISK_TREATMENT_OPTIONS.map((o) => (
                    <option key={o.value || "none"} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                {taskRiskTreatment ? (
                  <p className="text-muted-foreground text-[11px] leading-snug">
                    {
                      ROS_RISK_TREATMENT_OPTIONS.find(
                        (o) => o.value === taskRiskTreatment,
                      )?.description
                    }
                  </p>
                ) : null}
              </div>
              {taskRiskTreatment === "accept" ? (
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="rt-accept-note">Grunnlag for aksept (valgfritt)</Label>
                  <Textarea
                    id="rt-accept-note"
                    value={taskResidualNote}
                    onChange={(e) => setTaskResidualNote(e.target.value)}
                    rows={2}
                    className="min-h-0"
                    placeholder="Kort begrunnelse for rest risiko …"
                  />
                </div>
              ) : null}
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
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="rt-due">Frist (valgfritt)</Label>
                <Input
                  id="rt-due"
                  type="datetime-local"
                  value={taskDueAt}
                  onChange={(e) => setTaskDueAt(e.target.value)}
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
            <div className="border-border/40 text-muted-foreground rounded-xl border border-dashed px-4 py-8 text-center text-sm">
              Ingen oppgaver ennå. Opprett én over, eller gå tilbake til
              risikovurdering og legg inn risikoer først.
            </div>
          ) : (
            <ul className="space-y-3">
              {tasks.map((t) => (
                <li
                  key={t._id}
                  className={cn(
                    "rounded-xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md",
                    (t.linkedCellItemId ||
                      t.matrixRow !== undefined) &&
                      "border-l-primary border-l-4",
                  )}
                >
                  {editingTaskId === t._id ? (
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
                  ) : (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{t.title}</p>
                          <Badge variant={t.status === "done" ? "secondary" : "default"}>
                            {t.status === "done" ? "Fullført" : "Åpen"}
                          </Badge>
                          <span className="text-muted-foreground text-xs tabular-nums">
                            P{t.priority ?? 3}
                          </span>
                          {riskTreatmentLabel(t.riskTreatmentKind) ? (
                            <Badge variant="outline" className="font-normal">
                              {riskTreatmentLabel(t.riskTreatmentKind)}
                            </Badge>
                          ) : null}
                        </div>
                        {(t as { linkedRiskSummary?: string | null }).linkedRiskSummary ? (
                          <p className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-xs">
                            <Link2 className="text-primary size-3.5 shrink-0" aria-hidden />
                            <span>
                              {(t as { linkedRiskSummary?: string | null }).linkedRiskSummary}
                            </span>
                          </p>
                        ) : null}
                        {t.description ? (
                          <p className="text-muted-foreground text-sm whitespace-pre-wrap">{t.description}</p>
                        ) : null}
                        <p className="text-muted-foreground text-xs">
                          {t.assigneeName ? `Tildelt: ${t.assigneeName}` : "Ikke tildelt"}
                          {t.dueAt ? ` · Frist ${formatTs(t.dueAt)}` : ""}
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
                        <Button type="button" size="sm" variant="secondary" onClick={() => setEditingTaskId(t._id)}>
                          Rediger
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => {
                            if (window.confirm("Slette denne oppgaven?")) {
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
      )}

      {/* === Section 2: Oppsummering === */}
      {rosSection === 2 && (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Oppsummering og risikoreduksjon</CardTitle>
          <CardDescription>
            Register før/etter tiltak — sammenlign celler og trender.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div id="ros-risk-register" className="space-y-3 scroll-mt-24">
            {riskRegisterSnapshot ? (
              <RosRiskRegisterTable
                sameLayout={data.rosSummary.sameLayout}
                before={riskRegisterSnapshot.before}
                after={riskRegisterSnapshot.after}
              />
            ) : null}
          </div>
          {data.rosSummary.suggestedLinkFlags.length > 0 ? (
            <p className="text-muted-foreground text-xs leading-relaxed">
              <span className="text-foreground font-medium">PVV-flagg:</span>{" "}
              {data.rosSummary.suggestedLinkFlags.join(", ")}
            </p>
          ) : null}
        </CardContent>
      </Card>
      )}

      {/* === Section 3: PVV === */}
      {rosSection === 3 && (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Link2 className="size-4" />
            PVV-vurderinger (mange-til-mange)
          </CardTitle>
          <CardDescription>
            Koble PVV-vurderinger og noter hva som er relevant for personvern.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {pddAlignmentHint ? (
            <Alert className="border-amber-500/35 bg-amber-500/[0.06]">
              <AlertTitle className="text-sm">Samsvar ROS og PDD</AlertTitle>
              <AlertDescription className="text-muted-foreground text-sm leading-relaxed">
                {ROS_PDD_ALIGNMENT_HINT_NB} Status for personvern (PDD) på hver
                koblet vurdering vises nedenfor — én sannhetskilde i PVV-skjemaet.
              </AlertDescription>
            </Alert>
          ) : null}
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
            <ul className="space-y-4">
              {data.linkedAssessments.map((l) => (
                <li
                  key={l.linkId}
                  className="space-y-3 rounded-lg border px-3 py-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0 space-y-1">
                      <Link
                        href={`/w/${workspaceId}/a/${l.assessmentId}`}
                        className="text-primary font-medium hover:underline"
                      >
                        {l.title}
                      </Link>
                      <p className="text-muted-foreground text-xs">
                        PDD (PVV):{" "}
                        <span className="text-foreground font-medium">
                          {COMPLIANCE_STATUS_LABELS[
                            (l.pddStatus ??
                              "not_started") as ComplianceStatusKey
                          ]}
                        </span>
                        {l.pddUrl ? (
                          <>
                            {" "}
                            ·{" "}
                            <a
                              href={l.pddUrl}
                              className="text-primary underline-offset-4 hover:underline"
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              lenke
                            </a>
                          </>
                        ) : null}
                      </p>
                    </div>
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
                  </div>
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
      )}

      {/* === Section 4: Innstillinger (consolidated) === */}
      {rosSection === 4 && (
      <div className="space-y-4">
        {/* Detaljer */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Detaljer</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="ros-title">Tittel</Label>
              <Input
                id="ros-title"
                value={title}
                onChange={(e) => { setTitle(e.target.value); setDirty(true); }}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="ros-notes">Notat</Label>
              <Textarea
                id="ros-notes"
                value={notes}
                onChange={(e) => { setNotes(e.target.value); setDirty(true); }}
                rows={3}
                className="min-h-[4rem]"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="ros-next-review">Neste revisjon</Label>
              <Input
                id="ros-next-review"
                type="datetime-local"
                value={nextReviewLocal}
                onChange={(e) => { setNextReviewLocal(e.target.value); setDirty(true); }}
                onBlur={() => void flushReviewSchedule()}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="ros-review-routine">Rutine</Label>
              <Textarea
                id="ros-review-routine"
                value={reviewRoutineNotes}
                onChange={(e) => { setReviewRoutineNotes(e.target.value); setDirty(true); }}
                onBlur={() => void flushReviewSchedule()}
                rows={2}
                className="min-h-[3rem]"
                placeholder="F.eks. årlig gjennomgang …"
              />
            </div>
          </CardContent>
        </Card>

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
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Etter tiltak — egne akser</CardTitle>
            <CardDescription>
              Valgfritt eget rutenett for restrisiko.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
            {useSeparateAfterAxes ? (
              <div className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="ros-after-row-axis">Radakse</Label>
                    <Input id="ros-after-row-axis" value={rowAxisTitleAfter} onChange={(e) => { setRowAxisTitleAfter(e.target.value); setDirty(true); }} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ros-after-col-axis">Kolonneakse</Label>
                    <Input id="ros-after-col-axis" value={colAxisTitleAfter} onChange={(e) => { setColAxisTitleAfter(e.target.value); setDirty(true); }} />
                  </div>
                </div>
                <Button type="button" variant="secondary" size="sm" onClick={() => copyBeforeAxesToAfter()}>
                  Kopier fra før-matrise
                </Button>
                <RosLabelLevelsEditor variant="matrixAxes" id="ros-after-rows" title="Rader" intro="Hvert nummer er ett nivå." value={rowLabelsAfterText} onChange={onRowLabelsAfterChange} defaultLabels={DEFAULT_ROS_ROW_LABELS} lowEndHint="lav" highEndHint="høy" />
                <RosLabelLevelsEditor variant="matrixAxes" id="ros-after-cols" title="Kolonner" intro="Hvert nummer er ett nivå." value={colLabelsAfterText} onChange={onColLabelsAfterChange} defaultLabels={DEFAULT_ROS_COL_LABELS} lowEndHint="lav" highEndHint="høy" />
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* Versjoner */}
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

        {/* Journal */}
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

      {/* Dead old sections removed — bottom nav follows */}

      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-border/60 bg-background/95 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-md supports-[backdrop-filter]:bg-background/85">
        <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_minmax(0,auto)_minmax(0,1fr)] items-center gap-2 px-3 sm:gap-3 sm:px-4">
          <div className="flex justify-start">
            <Button
              type="button"
              variant="outline"
              className="h-11 min-h-[44px] gap-1.5 px-3 text-[13px] font-medium sm:h-10 sm:min-h-0 sm:px-4"
              onClick={() => setRosSection((s) => Math.max(0, s - 1))}
              disabled={rosSection <= 0}
            >
              <ChevronLeft className="size-4 shrink-0" aria-hidden />
              Forrige
            </Button>
          </div>
          <div className="flex min-w-0 flex-col items-center justify-center gap-0 px-1 text-center">
            <span className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">
              Steg {rosSection + 1} av {ROS_EDITOR_SECTIONS.length}
            </span>
            <span className="text-foreground max-w-[min(100%,14rem)] truncate text-xs font-semibold sm:max-w-none sm:text-[13px]">
              {ROS_EDITOR_SECTIONS[rosSection]?.label ?? ""}
            </span>
          </div>
          <div className="flex justify-end">
            {rosSection >= ROS_EDITOR_SECTIONS.length - 1 ? (
              <Button
                type="button"
                className="h-11 min-h-[44px] gap-1.5 px-4 text-[13px] font-semibold shadow-sm sm:h-10 sm:min-h-0"
                onClick={() => router.push(`/w/${workspaceId}/ros`)}
              >
                Ferdig
                <ChevronRight className="size-4 shrink-0" aria-hidden />
              </Button>
            ) : (
              <Button
                type="button"
                className="h-11 min-h-[44px] gap-1.5 px-4 text-[13px] font-semibold shadow-sm sm:h-10 sm:min-h-0"
                onClick={() =>
                  setRosSection((s) =>
                    Math.min(ROS_EDITOR_SECTIONS.length - 1, s + 1),
                  )
                }
              >
                Neste
                <ChevronRight className="size-4 shrink-0" aria-hidden />
              </Button>
            )}
          </div>
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
      <div className="space-y-1.5">
        <Label>Kobling til risiko / tiltak</Label>
        <select
          className="border-input bg-background flex h-10 w-full rounded-lg border px-2 text-sm"
          value={riskLink}
          onChange={(e) => setRiskLink(e.target.value)}
        >
          {riskLinkOptions.map((o) => (
            <option key={o.value || "opt-none"} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label>Risikohåndtering</Label>
        <select
          className="border-input bg-background flex h-10 w-full rounded-lg border px-2 text-sm"
          value={treatment}
          onChange={(e) =>
            setTreatment(
              e.target.value === ""
                ? ""
                : (e.target.value as
                    | "mitigate"
                    | "accept"
                    | "transfer"
                    | "avoid"),
            )
          }
        >
          {ROS_RISK_TREATMENT_OPTIONS.map((o) => (
            <option key={o.value || "none"} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      {treatment === "accept" ? (
        <div className="space-y-1.5">
          <Label>Grunnlag for aksept (valgfritt)</Label>
          <Textarea
            value={acceptNote}
            onChange={(e) => setAcceptNote(e.target.value)}
            rows={2}
          />
        </div>
      ) : null}
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
            const risk = parseRosTaskRiskLink(riskLink);
            void onSave({
              title: title.trim(),
              description: description.trim() || null,
              assigneeUserId:
                assigneeUserId === "" ? null : assigneeUserId,
              priority,
              dueAt: dueMs,
              linkedCellItemId: risk ? risk.linkedCellItemId : null,
              linkedCellItemPhase: risk ? risk.linkedCellItemPhase : null,
              riskTreatmentKind: treatment === "" ? null : treatment,
              residualRiskAcceptedNote:
                treatment === "accept"
                  ? acceptNote.trim() || null
                  : null,
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
