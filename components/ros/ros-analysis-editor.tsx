"use client";

import { RosJournalPanel } from "@/components/ros/ros-journal-panel";
import { RosMatrix } from "@/components/ros/ros-matrix";
import { RosMethodologyGuide } from "@/components/ros/ros-methodology-guide";
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
  parseLabelLines,
  resizeNumberMatrix,
} from "@/lib/ros-matrix-resize";
import { cn } from "@/lib/utils";
import { downloadRosAnalysisPdf } from "@/lib/ros-pdf";
import {
  ChevronLeft,
  ChevronRight,
  FileDown,
  History,
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

const ROS_EDITOR_SECTIONS = [
  { id: "detaljer", label: "Detaljer" },
  { id: "oppsummering", label: "Oppsummering" },
  { id: "pvv", label: "PVV-koblinger" },
  { id: "versjoner", label: "Versjoner" },
  { id: "oppgaver", label: "Oppgaver" },
  { id: "etter-akser", label: "Etter tiltak" },
  { id: "matrise", label: "Matrise" },
  { id: "journal", label: "Journal" },
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
  const journalEntries = useQuery(api.ros.listJournalEntries, { analysisId });
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

  const [rosSection, setRosSection] = useState(0);

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
      if (rosSection === 6) return;
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

  const syncAfterMatrixToParsedLabels = useCallback(() => {
    if (!useSeparateAfterAxes || !data) return;
    const rl = parseLabelLines(rowLabelsAfterText);
    const cl = parseLabelLines(colLabelsAfterText);
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
  }, [
    useSeparateAfterAxes,
    data,
    rowLabelsAfterText,
    colLabelsAfterText,
  ]);

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
        const rev = analysisRevisionRef.current ?? data.revision ?? 0;
        const result = await updateAnalysis({
          analysisId,
          expectedRevision: rev,
          title: title.trim(),
          notes: notes.trim() || null,
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

      <p className="sr-only">
        Piltastene venstre og høyre bytter steg når fokus ikke er i et felt. På
        matrise-steget er de reservert til matrisen. Bruk Forrige og Neste nederst
        som i vurderingsveiviseren.
      </p>

      <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-gradient-to-r from-muted/40 via-card to-muted/30 p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <nav
          className="flex flex-1 flex-wrap items-center justify-center gap-2 sm:justify-start"
          aria-label="Hovedsteg i ROS-analysen"
        >
          {ROS_EDITOR_SECTIONS.map((sec, i) => (
            <button
              key={sec.id}
              type="button"
              aria-label={`Gå til ${sec.label}`}
              aria-current={rosSection === i ? "step" : undefined}
              onClick={() => setRosSection(i)}
              className={cn(
                "size-2.5 rounded-full transition-all",
                rosSection === i
                  ? "bg-primary ring-primary ring-offset-background scale-125 ring-2 ring-offset-2"
                  : i < rosSection
                    ? "bg-primary/45 hover:bg-primary/60"
                    : "bg-muted-foreground/25 hover:bg-muted-foreground/40",
              )}
            />
          ))}
        </nav>
        <div className="flex min-w-0 flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:gap-2">
          <p className="text-foreground text-center text-sm font-medium sm:min-w-0 sm:flex-1 sm:text-left">
            <span className="text-muted-foreground font-normal">
              Steg {rosSection + 1} av {ROS_EDITOR_SECTIONS.length} ·{" "}
            </span>
            <span className="break-words">
              {ROS_EDITOR_SECTIONS[rosSection].label}
            </span>
          </p>
          <label htmlFor="ros-section-jump" className="sr-only">
            Hopp til steg
          </label>
          <select
            id="ros-section-jump"
            className="border-input bg-background h-9 w-full min-w-0 shrink-0 rounded-lg border px-2 text-sm shadow-xs sm:w-[min(100%,14rem)]"
            value={rosSection}
            onChange={(e) => setRosSection(Number(e.target.value))}
          >
            {ROS_EDITOR_SECTIONS.map((sec, i) => (
              <option key={sec.id} value={i}>
                {i + 1}. {sec.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {rosSection === 0 && (
        <>
      <RosMethodologyGuide
        variant="compact"
        workspaceId={workspaceId}
      />

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
        </CardContent>
      </Card>
        </>
      )}

      {rosSection === 1 && (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Oppsummering før / etter tiltak</CardTitle>
          <CardDescription>
            Automatisk ut fra matrisene. Bruk flagg og notat under PVV-koblinger
            for å synliggjøre hva som er viktig i PVV fra ROS (og omvendt).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <ul className="list-inside list-disc space-y-1 text-sm leading-relaxed">
            {data.rosSummary.summaryLines.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
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
        </CardContent>
      </Card>
      )}

      {rosSection === 2 && (
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

      {rosSection === 3 && (
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

      {rosSection === 4 && (
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
      )}

      {rosSection === 5 && (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Etter tiltak — egne akser (valgfritt)</CardTitle>
          <CardDescription>
            Du kan bruke <strong className="text-foreground">eget rutenett</strong> for
            restrisiko (andre etiketter enn «før tiltak»). Gjenbrukbare lister med
            beskrivelser administreres under{" "}
            <Link
              href={`/w/${workspaceId}/ros/akser`}
              className="text-primary font-medium underline-offset-4 hover:underline"
            >
              ROS-akser
            </Link>
            .
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
                  setCellItemsAfterMatrix(
                    cellItemsMatrix.map((r) =>
                      r.map((c) => c.map((it) => ({ ...it }))),
                    ),
                  );
                }
                setUseSeparateAfterAxes(checked);
                setDirty(true);
              }}
            />
            <div className="space-y-1">
              <Label htmlFor="ros-separate-after" className="cursor-pointer font-normal">
                Eget rutenett for etter tiltak (ulikt «før»)
              </Label>
              <p className="text-muted-foreground text-xs leading-relaxed">
                Når avkrysset får du egne aksetitler og rader/kolonner for
                etter-matrisen. Oppsummeringen over tilpasses automatisk.
              </p>
            </div>
          </div>
          {useSeparateAfterAxes ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ros-after-row-axis">Radakse (etter)</Label>
                <Input
                  id="ros-after-row-axis"
                  value={rowAxisTitleAfter}
                  onChange={(e) => {
                    setRowAxisTitleAfter(e.target.value);
                    setDirty(true);
                  }}
                  onBlur={syncAfterMatrixToParsedLabels}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ros-after-col-axis">Kolonneakse (etter)</Label>
                <Input
                  id="ros-after-col-axis"
                  value={colAxisTitleAfter}
                  onChange={(e) => {
                    setColAxisTitleAfter(e.target.value);
                    setDirty(true);
                  }}
                  onBlur={syncAfterMatrixToParsedLabels}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="ros-after-rows">Rader (én etikett per linje)</Label>
                <Textarea
                  id="ros-after-rows"
                  value={rowLabelsAfterText}
                  onChange={(e) => {
                    setRowLabelsAfterText(e.target.value);
                    setDirty(true);
                  }}
                  onBlur={syncAfterMatrixToParsedLabels}
                  rows={5}
                  className="min-h-[5rem] font-mono text-sm"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="ros-after-cols">Kolonner (én etikett per linje)</Label>
                <Textarea
                  id="ros-after-cols"
                  value={colLabelsAfterText}
                  onChange={(e) => {
                    setColLabelsAfterText(e.target.value);
                    setDirty(true);
                  }}
                  onBlur={syncAfterMatrixToParsedLabels}
                  rows={5}
                  className="min-h-[5rem] font-mono text-sm"
                />
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
      )}

      {rosSection === 6 && (
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
                Vurder{" "}
                <strong className="text-foreground">før tiltak</strong> (utgangspunkt) og{" "}
                <strong className="text-foreground">etter tiltak</strong> (rest) i fanene
                under. Klikk en celle for nivå 0–5 og valgfritt notat. Lagre øverst for å
                skrive til server og loggføre nivåendringer.
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

      {rosSection === 7 && (
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
          <div className="flex min-w-0 flex-col items-center justify-center gap-0.5 text-center">
            <span className="text-muted-foreground text-xs tabular-nums">
              Steg {rosSection + 1} av {ROS_EDITOR_SECTIONS.length}
            </span>
            {rosSection >= ROS_EDITOR_SECTIONS.length - 1 ? (
              <span className="text-muted-foreground text-[11px] font-medium">
                Siste steg
              </span>
            ) : null}
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
