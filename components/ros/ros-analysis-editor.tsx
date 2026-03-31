"use client";

import { RosAxisOverview } from "@/components/ros/ros-axis-overview";
import { RosComplianceNotice } from "@/components/ros/ros-compliance-notice";
import { RosJournalPanel } from "@/components/ros/ros-journal-panel";
import { RosLifecycleCompliancePanel } from "@/components/ros/ros-lifecycle-compliance-panel";
import { RosMatrix } from "@/components/ros/ros-matrix";
import { RosLabelLevelsEditor } from "@/components/ros/ros-label-levels-editor";
import { RosMethodologyGuide } from "@/components/ros/ros-methodology-guide";
import { RosRiskRegisterTable } from "@/components/ros/ros-risk-register-table";
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
import { useMutation, useQuery } from "convex/react";
import {
  flattenCellItemsMatrixToLegacyNotes,
  resizeCellItemsMatrix,
  type RosCellItem,
  type RosCellItemMatrix,
} from "@/lib/ros-cell-items";
import {
  DEFAULT_ROS_COL_LABELS,
  DEFAULT_ROS_ROW_LABELS,
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
import { cn } from "@/lib/utils";
import type { RosRequirementRef } from "@/lib/ros-requirement-catalog";
import { downloadRosAnalysisPdf } from "@/lib/ros-pdf";
import {
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  FileDown,
  History,
  Layers,
  Link2,
  ListTodo,
  Plus,
  Sparkles,
  Trash2,
  Undo2,
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
  { id: "detaljer", label: "Detaljer", hint: "Tittel, notat, revisjon" },
  {
    id: "livssyklus",
    label: "Livssyklus og krav",
    hint: "ISO 31000, rammer, EU/EØS",
  },
  { id: "oppsummering", label: "Oppsummering", hint: "Auto fra matriser" },
  { id: "pvv", label: "PVV-koblinger", hint: "Koble vurderinger" },
  { id: "versjoner", label: "Versjoner", hint: "Snapshot" },
  { id: "oppgaver", label: "Oppgaver", hint: "Oppfølging" },
  { id: "etter-akser", label: "Etter tiltak", hint: "Egne akser" },
  { id: "matrise", label: "Matrise", hint: "Hovedarbeid" },
  { id: "journal", label: "Journal", hint: "Logg" },
] as const;

/** Standard: land på matrisen — der risiko settes (minst klikk for vanlig bruk). */
const ROS_MATRISE_SECTION_INDEX = ROS_EDITOR_SECTIONS.findIndex(
  (s) => s.id === "matrise",
);

/** Hovedvalg (enkel flyt — som «fyll ut → rapport» i KS-løsninger, her for IKT/ROS). */
const ROS_PRIMARY_NAV: readonly {
  id: string;
  sectionIndex: number;
  label: string;
  short: string;
}[] = [
  {
    id: "matrise",
    sectionIndex: 7,
    label: "Risikomatrise",
    short: "Sett nivå i cellene",
  },
  {
    id: "oppsummering",
    sectionIndex: 2,
    label: "Liste & tall",
    short: "Oppsummering og register",
  },
  {
    id: "pvv",
    sectionIndex: 3,
    label: "PVV-koblinger",
    short: "Koble personvern",
  },
] as const;

const ROS_MORE_NAV: readonly {
  sectionIndex: number;
  label: string;
}[] = [
  { sectionIndex: 0, label: "Kontekst" },
  { sectionIndex: 1, label: "Livssyklus" },
  { sectionIndex: 6, label: "Etter tiltak" },
  { sectionIndex: 4, label: "Versjoner" },
  { sectionIndex: 5, label: "Oppgaver" },
  { sectionIndex: 8, label: "Journal" },
] as const;

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

  const analysisRevisionRef = useRef<number | null>(null);
  const rosSaveQueueRef = useRef(Promise.resolve());
  const deletingRef = useRef(false);

  const [rosSection, setRosSection] = useState(ROS_MATRISE_SECTION_INDEX);

  const [taskTitle, setTaskTitle] = useState("");
  const [taskDesc, setTaskDesc] = useState("");
  const [taskAssignee, setTaskAssignee] = useState<Id<"users"> | "">("");
  const [taskPriority, setTaskPriority] = useState(3);
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

  const handleJumpToCell = useCallback(
    (row: number, col: number, phase?: "before" | "after") => {
      setMatrixView(phase ?? "before");
      setJumpRequest({ row, col, nonce: Date.now() });
    },
    [],
  );

  const copyBeforeToAfter = useCallback(() => {
    if (!data) return;
    if (useSeparateAfterAxes) {
      const rl = parseLabelLines(rowLabelsAfterText);
      const cl = parseLabelLines(colLabelsAfterText);
      if (rl.length < 2 || cl.length < 2) {
        window.alert(
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
      } else {
        window.alert(
          "ROS-analysen er allerede oppdatert på serveren. Last siden på nytt og prøv igjen.",
        );
      }
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Kunne ikke lagre.");
    }
  }

  async function save() {
    if (!data) return;
    const targetRows = useSeparateAfterAxes
      ? parseLabelLines(rowLabelsAfterText).length
      : data.rowLabels.length;
    const targetCols = useSeparateAfterAxes
      ? parseLabelLines(colLabelsAfterText).length
      : data.colLabels.length;
    if (useSeparateAfterAxes && (targetRows < 2 || targetCols < 2)) {
      window.alert(
        "Etter-tiltak med egne akser krever minst to rader og to kolonner (én etikett per linje).",
      );
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
          window.alert("Ugyldig dato/tid for neste revisjon.");
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
        } else {
          window.alert(
            "ROS-analysen er allerede oppdatert på serveren (annen bruker, annen fane eller journal). Last siden på nytt og prøv igjen.",
          );
        }
      };
      rosSaveQueueRef.current = rosSaveQueueRef.current
        .catch(() => undefined)
        .then(runSave);
      await rosSaveQueueRef.current;
    } finally {
      setSaving(false);
    }
  }

  function exportPdf() {
    if (!data) return;
    const pdfRows = useSeparateAfterAxes
      ? parseLabelLines(rowLabelsAfterText).length
      : data.rowLabels.length;
    const pdfCols = useSeparateAfterAxes
      ? parseLabelLines(colLabelsAfterText).length
      : data.colLabels.length;
    if (useSeparateAfterAxes && (pdfRows < 2 || pdfCols < 2)) {
      window.alert(
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
    const openTaskLines =
      tasks?.filter((t) => t.status === "open").map((t) => {
        const due = t.dueAt ? ` · frist ${formatTs(t.dueAt)}` : "";
        return `${t.title}${due}`;
      }) ?? [];

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
      afterRowLabels: useSeparateAfterAxes
        ? parseLabelLines(rowLabelsAfterText)
        : data.rowLabels,
      afterColLabels: useSeparateAfterAxes
        ? parseLabelLines(colLabelsAfterText)
        : data.colLabels,
      afterRowAxisTitle: useSeparateAfterAxes
        ? rowAxisTitleAfter.trim()
        : data.rowAxisTitle,
      afterColAxisTitle: useSeparateAfterAxes
        ? colAxisTitleAfter.trim()
        : data.colAxisTitle,
      afterSeparateLayout: useSeparateAfterAxes,
      analysisNotes: notes.trim() || null,
      methodologyStatement: methodologyStatement.trim() || null,
      contextSummary: contextSummary.trim() || null,
      scopeAndCriteria: scopeAndCriteria.trim() || null,
      riskCriteriaVersion: riskCriteriaVersion.trim() || null,
      axisScaleNotes: axisScaleNotes.trim() || null,
      complianceScopeTagIds:
        complianceScopeTags.length > 0 ? complianceScopeTags : undefined,
      requirementRefLines:
        requirementRefLines.length > 0 ? requirementRefLines : undefined,
      openTaskLines: openTaskLines.length > 0 ? openTaskLines : undefined,
      linkedPvvTitles: data.linkedAssessments.map((l) => l.title),
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
    <div className="space-y-4 pb-24">
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
            title="Laster ned PDF med tittel, notat, PVV-koblinger, risikologg (siste 40) og matrise slik den vises nå (inkl. ulagrede celler)."
            onClick={exportPdf}
          >
            <FileDown className="mr-2 size-4" aria-hidden />
            Eksporter PDF
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={isDeleting}
            onClick={() => {
              if (
                typeof window !== "undefined" &&
                window.confirm("Slette denne ROS-analysen?")
              ) {
                deletingRef.current = true;
                setIsDeleting(true);
                router.replace(`/w/${workspaceId}/ros`);
                void removeAnalysis({ analysisId });
              }
            }}
          >
            {isDeleting ? "Sletter…" : "Slett"}
          </Button>
        </div>
      </div>

      <p className="sr-only">
        Piltastene venstre og høyre bytter del når fokus ikke er i et felt. På
        matrisen er de reservert til matrisen. Bruk knappene under eller Forrige /
        Neste nederst.
      </p>

      <div className="border-border/60 bg-card space-y-4 rounded-2xl border p-4 shadow-sm">
        <div className="space-y-1">
          <p className="text-foreground text-sm font-medium leading-snug">
            ROS for IKT-løsning
          </p>
          <p className="text-muted-foreground max-w-3xl text-xs leading-relaxed">
            Tre steg som i en enkel avviks-/KS-flyt:{" "}
            <strong className="text-foreground">vurder risiko</strong> i matrisen,{" "}
            <strong className="text-foreground">se liste og tall</strong>,{" "}
            <strong className="text-foreground">koble PVV</strong> der det trengs.
            Alt annet ligger under «Mer» — versjon, journal, kontekst.
          </p>
        </div>

        <details className="border-border/60 group rounded-xl border bg-muted/15">
          <summary className="hover:bg-muted/40 flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-xs font-medium [&::-webkit-details-marker]:hidden">
            <span className="text-muted-foreground shrink-0 group-open:hidden">
              Vis
            </span>
            <span className="text-muted-foreground hidden shrink-0 group-open:inline">
              Skjul
            </span>
            <span>
              Krav, ISO og personvern{" "}
              <span className="text-muted-foreground font-normal">
                (anbefales ved revisjon)
              </span>
            </span>
          </summary>
          <div className="border-border/50 border-t px-2 pb-3 pt-2">
            <RosComplianceNotice
              standardsDetailHref={`/w/${workspaceId}/ros#ros-metode-standarder`}
            />
          </div>
        </details>

        <nav
          className="flex flex-col gap-3"
          aria-label="Hoveddel av ROS-analysen"
        >
          <div className="grid gap-2 sm:grid-cols-3">
            {ROS_PRIMARY_NAV.map((item) => {
              const active = rosSection === item.sectionIndex;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setRosSection(item.sectionIndex)}
                  className={cn(
                    "flex flex-col items-start gap-0.5 rounded-xl border px-4 py-3 text-left transition-all",
                    active
                      ? "border-primary bg-primary text-primary-foreground shadow-md"
                      : "border-border/70 bg-background hover:border-primary/35 hover:bg-muted/30",
                  )}
                >
                  <span className="text-sm font-semibold">{item.label}</span>
                  <span
                    className={cn(
                      "text-xs leading-snug",
                      active ? "text-primary-foreground/90" : "text-muted-foreground",
                    )}
                  >
                    {item.short}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-x-1 gap-y-1 border-t border-border/40 pt-3 text-xs">
            <span className="text-muted-foreground mr-1 font-medium">Mer</span>
            {ROS_MORE_NAV.map((item, i) => (
              <span key={item.label} className="inline-flex items-center">
                {i > 0 ? (
                  <span className="text-muted-foreground/50 mx-1" aria-hidden>
                    ·
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => setRosSection(item.sectionIndex)}
                  className={cn(
                    "rounded-md px-1.5 py-0.5 font-medium underline-offset-4 hover:underline",
                    rosSection === item.sectionIndex
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {item.label}
                </button>
              </span>
            ))}
          </div>
        </nav>

        <label htmlFor="ros-section-jump" className="sr-only">
          Alle deler (komplett liste)
        </label>
        <select
          id="ros-section-jump"
          className="border-input bg-muted/20 h-9 w-full max-w-md rounded-lg border px-2 text-xs shadow-xs"
          value={rosSection}
          onChange={(e) => setRosSection(Number(e.target.value))}
        >
          {ROS_EDITOR_SECTIONS.map((sec, i) => (
            <option key={sec.id} value={i}>
              {sec.label}
              {sec.hint ? ` — ${sec.hint}` : ""}
            </option>
          ))}
        </select>
      </div>

      {rosSection === 0 && (
        <>
      <details className="border-border/60 bg-muted/10 group mb-4 rounded-xl border open:bg-muted/15">
        <summary className="hover:bg-muted/30 flex cursor-pointer list-none items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
          <CircleHelp className="text-primary size-4 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1">
            Metode og retningslinjer (ISO, personvern, PVV)
            <span className="text-muted-foreground ml-1.5 block text-xs font-normal sm:inline sm:ml-1">
              Valgfritt — samme innhold som under ROS i arbeidsområdet
            </span>
          </span>
          <span className="text-muted-foreground shrink-0 text-xs group-open:hidden">
            Vis
          </span>
          <span className="text-muted-foreground hidden shrink-0 text-xs group-open:inline">
            Skjul
          </span>
        </summary>
        <div className="border-border/50 border-t px-2 pb-3 pt-1">
          <RosMethodologyGuide variant="compact" workspaceId={workspaceId} />
        </div>
      </details>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Detaljer</CardTitle>
          <CardDescription>
            Tittel og notat (metode, forutsetninger). PVV kobles under eget
            avsnitt. Lagring og journal bruker{" "}
            <strong className="text-foreground">revisjon</strong> (som PVV) slik
            at samtidige endringer ikke overskriver hverandre uten varsel.
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
          <div className="space-y-2 border-t pt-4 sm:col-span-2">
            <Label htmlFor="ros-next-review">Neste revisjon / gjennomgang</Label>
            <p className="text-muted-foreground text-xs leading-relaxed">
              Plan når analysen skal gjennomgås på nytt. Du får e-post når
              tidspunktet er passert (maks. én gang per uke per analyse).
            </p>
            <Input
              id="ros-next-review"
              type="datetime-local"
              value={nextReviewLocal}
              onChange={(e) => {
                setNextReviewLocal(e.target.value);
                setDirty(true);
              }}
              onBlur={() => void flushReviewSchedule()}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="ros-review-routine">Rutine / hva som skal sjekkes</Label>
            <Textarea
              id="ros-review-routine"
              value={reviewRoutineNotes}
              onChange={(e) => {
                setReviewRoutineNotes(e.target.value);
                setDirty(true);
              }}
              onBlur={() => void flushReviewSchedule()}
              rows={2}
              className="min-h-[4rem]"
              placeholder="F.eks. årlig gjennomgang, ny vurdering ved systemendring …"
            />
          </div>
        </CardContent>
      </Card>
        </>
      )}

      {rosSection === 1 && (
        <RosLifecycleCompliancePanel
          methodologyStatement={methodologyStatement}
          contextSummary={contextSummary}
          scopeAndCriteria={scopeAndCriteria}
          riskCriteriaVersion={riskCriteriaVersion}
          axisScaleNotes={axisScaleNotes}
          complianceScopeTags={complianceScopeTags}
          requirementRefs={requirementRefs}
          onChange={(patch) => {
            if (patch.methodologyStatement !== undefined) {
              setMethodologyStatement(patch.methodologyStatement);
            }
            if (patch.contextSummary !== undefined) {
              setContextSummary(patch.contextSummary);
            }
            if (patch.scopeAndCriteria !== undefined) {
              setScopeAndCriteria(patch.scopeAndCriteria);
            }
            if (patch.riskCriteriaVersion !== undefined) {
              setRiskCriteriaVersion(patch.riskCriteriaVersion);
            }
            if (patch.axisScaleNotes !== undefined) {
              setAxisScaleNotes(patch.axisScaleNotes);
            }
            if (patch.complianceScopeTags !== undefined) {
              setComplianceScopeTags(patch.complianceScopeTags);
            }
            if (patch.requirementRefs !== undefined) {
              setRequirementRefs(patch.requirementRefs);
            }
            setDirty(true);
          }}
        />
      )}

      {rosSection === 2 && (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Oppsummering og risikoliste</CardTitle>
          <CardDescription>
            Tall fra matrisene (automatisk) og tabell over alle celler med innhold
            — tilsvarende «risikoanalyse»-tabell og risikobilde i klassiske ROS-dokumenter.
            Bruk flagg under PVV-koblinger for å synliggjøre hva som er viktig i PVV.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <Alert>
            <AlertTitle className="text-sm">To måter å jobbe på</AlertTitle>
            <AlertDescription className="text-muted-foreground text-sm leading-relaxed">
              <strong className="text-foreground">Matrise først:</strong> klikk celler
              og sett nivå 0–5, eventuelt punkter i celle.{" "}
              <strong className="text-foreground">Tekst først:</strong> åpne en celle og
              skriv trusler/kommentar som i kolonnen «Trussel» i ROS-rapport — sett nivå
              når dere er enige. Begge gir samme resultat under; listen under samler
              alle celler med nivå eller tekst.
            </AlertDescription>
          </Alert>
          <div>
            <h3 className="text-foreground mb-2 text-sm font-semibold">
              Tall fra matrisene
            </h3>
            <ul className="list-inside list-disc space-y-1 text-sm leading-relaxed">
              {data.rosSummary.summaryLines.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </div>
          {!data.rosSummary.sameLayout ? (
            <p className="text-muted-foreground text-sm leading-relaxed">
              Før- og etter-matrisen har ulike akser eller dimensjoner — detaljert
              celle-for-celle-sammenligning er begrenset; oppsummeringen viser blant
              annet høyeste nivå og høy risiko per matrise.
            </p>
          ) : null}
          {data.rosSummary.suggestedLinkFlags.length > 0 ? (
            <p className="text-muted-foreground text-xs leading-relaxed">
              <span className="text-foreground font-medium">Forslag til flagg</span>{" "}
              på koblingene under:{" "}
              {data.rosSummary.suggestedLinkFlags.join(", ")} — legg inn under hver
              PVV-kobling ved behov.
            </p>
          ) : null}
          <div id="ros-risk-register" className="space-y-2 scroll-mt-24">
            <h3 className="text-foreground text-sm font-semibold">
              Risikoregister (alle celler med nivå eller punkter)
            </h3>
            {riskRegisterSnapshot ? (
              <RosRiskRegisterTable
                before={riskRegisterSnapshot.before}
                after={riskRegisterSnapshot.after}
              />
            ) : null}
          </div>
        </CardContent>
      </Card>
      )}

      {rosSection === 3 && (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Link2 className="size-4" />
            PVV-vurderinger (mange-til-mange)
          </CardTitle>
          <CardDescription>
            Koble én eller flere PVV-vurderinger i arbeidsområdet til denne
            ROS-analysen. Marker hva som er viktig for PVV, og noter koblingen
            mellom ROS og personvern.
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

      {rosSection === 4 && (
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
      )}

      {rosSection === 5 && (
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
                        {t.matrixRow != null &&
                        t.matrixCol != null &&
                        t.matrixPhase ? (
                          <p className="text-muted-foreground text-xs">
                            Matrise: rad {t.matrixRow + 1}, kol {t.matrixCol + 1}{" "}
                            ({t.matrixPhase === "before" ? "før tiltak" : "etter tiltak"})
                          </p>
                        ) : null}
                        {t.riskTreatmentKind ? (
                          <p className="text-muted-foreground text-xs">
                            Behandling:{" "}
                            {t.riskTreatmentKind === "mitigate"
                              ? "Redusere"
                              : t.riskTreatmentKind === "accept"
                                ? "Akseptere rest"
                                : t.riskTreatmentKind === "transfer"
                                  ? "Overføre"
                                  : "Unngå"}
                          </p>
                        ) : null}
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
      )}

      {rosSection === 6 && (
      <Card className="overflow-hidden border-border/70 shadow-md">
        <CardHeader className="border-border/50 space-y-3 border-b bg-gradient-to-br from-violet-500/[0.07] via-background to-cyan-500/[0.06] pb-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
            <div className="bg-primary/12 flex size-11 shrink-0 items-center justify-center rounded-2xl shadow-sm">
              <Layers className="text-primary size-5" aria-hidden />
            </div>
            <div className="min-w-0 space-y-1.5">
              <CardTitle className="text-lg tracking-tight">
                Etter tiltak — egne akser
              </CardTitle>
              <CardDescription className="text-sm leading-relaxed">
                Valgfritt eget rutenett for <strong className="text-foreground">restrisiko</strong>{" "}
                når etiketter for «etter» skal skille seg fra før-matrisen. Rediger ett
                nivå per rad — samme mønster som ved opprettelse av mal. Gjenbrukbare
                akser finner du under{" "}
                <Link
                  href={`/w/${workspaceId}/ros/akser`}
                  className="text-primary font-medium underline-offset-4 hover:underline"
                >
                  ROS-akser
                </Link>
                .
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <div className="border-border/60 bg-muted/15 flex min-w-0 flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-start sm:gap-4">
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
                      r.map((c) => c.map((it) => ({ ...it }))),
                    ),
                  );
                }
                setUseSeparateAfterAxes(checked);
                setDirty(true);
              }}
              className="mt-0.5"
            />
            <div className="min-w-0 space-y-1">
              <Label
                htmlFor="ros-separate-after"
                className="text-foreground cursor-pointer text-sm font-medium"
              >
                Bruk eget rutenett for etter tiltak
              </Label>
              <p className="text-muted-foreground text-xs leading-relaxed">
                Slå på for å definere egne akser og nivåer. Når av er, bruker
                etter-matrisen samme rutenett som før tiltak.
              </p>
            </div>
          </div>
          {useSeparateAfterAxes ? (
            <div className="space-y-8">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="ros-after-row-axis">Navn på radakse</Label>
                  <Input
                    id="ros-after-row-axis"
                    value={rowAxisTitleAfter}
                    onChange={(e) => {
                      setRowAxisTitleAfter(e.target.value);
                      setDirty(true);
                    }}
                    className="h-11 rounded-xl border-border/60 bg-background shadow-sm"
                    placeholder="f.eks. Sannsynlighet"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ros-after-col-axis">Navn på kolonneakse</Label>
                  <Input
                    id="ros-after-col-axis"
                    value={colAxisTitleAfter}
                    onChange={(e) => {
                      setColAxisTitleAfter(e.target.value);
                      setDirty(true);
                    }}
                    className="h-11 rounded-xl border-border/60 bg-background shadow-sm"
                    placeholder="f.eks. Konsekvens"
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="rounded-lg"
                  onClick={() => copyBeforeAxesToAfter()}
                >
                  Kopier etiketter fra før-matrise
                </Button>
                <span className="text-muted-foreground text-xs">
                  Overstyrer rader/kolonner nedenfor med nåværende før-matrise.
                </span>
              </div>
              <RosLabelLevelsEditor
                variant="matrixAxes"
                id="ros-after-rows"
                title="Rader (sannsynlighet langs denne aksen)"
                intro="Hvert nummer er ett nivå i matrisen — fra lav til høy risiko."
                value={rowLabelsAfterText}
                onChange={onRowLabelsAfterChange}
                defaultLabels={DEFAULT_ROS_ROW_LABELS}
                lowEndHint="lav"
                highEndHint="høy"
              />
              <RosLabelLevelsEditor
                variant="matrixAxes"
                id="ros-after-cols"
                title="Kolonner (konsekvens langs denne aksen)"
                intro="Hvert nummer er ett nivå — samme logikk som i malen."
                value={colLabelsAfterText}
                onChange={onColLabelsAfterChange}
                defaultLabels={DEFAULT_ROS_COL_LABELS}
                lowEndHint="lav konsekvens"
                highEndHint="høy konsekvens"
              />
            </div>
          ) : (
            <p className="text-muted-foreground text-sm leading-relaxed">
              Skru på «Bruk eget rutenett» over for å sette opp etter-tiltak-akser med
              tydelige nivåfelt i stedet for fri tekstblokk.
            </p>
          )}
        </CardContent>
      </Card>
      )}

      {rosSection === 7 && (
      <Card className="overflow-hidden border-primary/15">
        <CardHeader className="border-b border-border/50 bg-muted/20">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="text-base">Risikomatrise</CardTitle>
              <CardDescription>
                {matrixView === "after" && useSeparateAfterAxes ? (
                  <>
                    <span className="text-foreground font-medium">
                      {matrixRowAxisTitle}
                    </span>{" "}
                    (rader) ×{" "}
                    <span className="text-foreground font-medium">
                      {matrixColAxisTitle}
                    </span>{" "}
                    (kolonner) — <strong className="text-foreground">etter tiltak</strong>{" "}
                    med eget rutenett.
                  </>
                ) : (
                  <>
                    {data.rowAxisTitle} (rader) × {data.colAxisTitle} (kolonner).
                  </>
                )}{" "}
                <strong className="text-foreground">Klikk en celle</strong> for nivå{" "}
                <span className="tabular-nums">0–5</span> og punktnotat. Bytt fane{" "}
                <strong className="text-foreground">før / etter tiltak</strong> under.
                Lagre øverst — nivåendringer loggføres i journal.
              </CardDescription>
            </div>
            {matrix.length > 0 ? (
              <div className="flex flex-col items-end gap-2 text-xs">
                <div className="flex flex-wrap justify-end gap-2">
                  <Badge variant="outline" className="font-normal">
                    Før: max{" "}
                    <span className="text-foreground font-semibold tabular-nums">
                      {beforeStats.max}
                    </span>
                  </Badge>
                  <Badge variant="outline" className="font-normal">
                    Etter: max{" "}
                    <span className="text-foreground font-semibold tabular-nums">
                      {afterStats.max}
                    </span>
                  </Badge>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <Badge variant="secondary" className="font-normal">
                    Aktiv fane — høyeste:{" "}
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
                      Ingen celler på nivå 4–5 (aktiv fane)
                    </Badge>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          <div className="space-y-3">
            <RosAxisOverview
              rowAxisTitle={data.rowAxisTitle}
              colAxisTitle={data.colAxisTitle}
              rowLabels={data.rowLabels}
              colLabels={data.colLabels}
            />
            <Alert>
              <AlertTitle className="text-sm">Spørsmål og akser</AlertTitle>
              <AlertDescription className="text-muted-foreground text-sm leading-relaxed">
                Radene og kolonnene kommer fra malen — de tilsvarer akseptkriterier
                (sannsynlighet × konsekvens) som i ROS-dokumenter. Du kan{" "}
                <strong className="text-foreground">fylle celler direkte</strong> eller{" "}
                <strong className="text-foreground">skrive punkter i cellen først</strong>{" "}
                og sette nivå etterpå; full liste finnes under{" "}
                <button
                  type="button"
                  className="text-primary font-medium underline-offset-4 hover:underline"
                  onClick={() => setRosSection(1)}
                >
                  Oppsummering
                </button>
                .
              </AlertDescription>
            </Alert>
          </div>
          {matrix.length > 0 ? (
            <>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <div
                  className="bg-muted/40 inline-flex rounded-lg border p-1"
                  role="tablist"
                  aria-label="Velg matrise: før eller etter tiltak"
                >
                  <Button
                    type="button"
                    role="tab"
                    aria-selected={matrixView === "before"}
                    variant={matrixView === "before" ? "secondary" : "ghost"}
                    size="sm"
                    className="rounded-md"
                    onClick={() => setMatrixView("before")}
                  >
                    Før tiltak
                  </Button>
                  <Button
                    type="button"
                    role="tab"
                    aria-selected={matrixView === "after"}
                    variant={matrixView === "after" ? "secondary" : "ghost"}
                    size="sm"
                    className="rounded-md"
                    onClick={() => setMatrixView("after")}
                  >
                    Etter tiltak (rest)
                  </Button>
                </div>
                {matrixView === "after" ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={copyBeforeToAfter}
                  >
                    Kopier nivåer og notater fra «før tiltak»
                  </Button>
                ) : null}
              </div>
              {afterMatrixInvalid ? (
                <Alert>
                  <AlertTitle>Ugyldig etter-matrise</AlertTitle>
                  <AlertDescription>
                    Angi minst to rader og to kolonner (én etikett per linje) i
                    «Etter tiltak — egne akser», eller fjern avkryssingen for å bruke
                    samme rutenett som før tiltak.
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
                  cellItems={
                    matrixView === "after"
                      ? cellItemsAfterMatrix
                      : cellItemsMatrix
                  }
                  onCellItemsChange={onCellItemsChange}
                  onCellChange={onCellChange}
                  jumpRequest={jumpRequest}
                  onJumpHandled={() => setJumpRequest(null)}
                />
              )}
            </>
          ) : null}
        </CardContent>
      </Card>
      )}

      {rosSection === 8 && (
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
          window.alert(
            "Journalen kunne ikke lagres: analysen har nyere revisjon på serveren. Oppdater siden og prøv igjen.",
          )
        }
      />
      )}

      <div className="fixed bottom-0 left-0 right-0 z-30 border-t bg-background/95 p-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto grid max-w-6xl grid-cols-[1fr_minmax(0,auto)_1fr] items-center gap-3 px-4">
          <div className="flex justify-start">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={() => setRosSection((s) => Math.max(0, s - 1))}
              disabled={rosSection <= 0}
            >
              <ChevronLeft className="size-4" />
              Forrige
            </Button>
          </div>
          <div className="flex min-w-0 flex-col items-center justify-center gap-0.5 px-2 text-center">
            <span className="text-foreground max-w-[min(100%,12rem)] truncate text-xs font-medium sm:max-w-none">
              {ROS_EDITOR_SECTIONS[rosSection]?.label ?? ""}
            </span>
            <span className="text-muted-foreground text-[11px]">
              ROS for IKT · bruk knappene over for å hoppe
            </span>
          </div>
          <div className="flex justify-end">
            {rosSection >= ROS_EDITOR_SECTIONS.length - 1 ? (
              <Button
                type="button"
                variant="default"
                size="sm"
                className="gap-1"
                onClick={() => router.push(`/w/${workspaceId}/ros`)}
              >
                Ferdig
                <ChevronRight className="size-4" aria-hidden />
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() =>
                  setRosSection((s) =>
                    Math.min(ROS_EDITOR_SECTIONS.length - 1, s + 1),
                  )
                }
              >
                Neste
                <ChevronRight className="size-4" />
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
