import type { Doc } from "@/convex/_generated/dataModel";
import {
  collectAllCellRiskPointsForPdf,
  collectIdentifiedRisksForPdf,
  flattenCellItemsMatrixToLegacyNotes,
  type RosCellItemMatrix,
  type RosPoolItem,
} from "@/lib/ros-cell-items";
import {
  COMPLIANCE_STATUS_LABELS,
  type ComplianceStatusKey,
} from "@/lib/helsesector-labels";
import { formatRosRequirementRefLine, type RosPdfInput } from "@/lib/ros-pdf";
import type { RosRequirementRef } from "@/lib/ros-requirement-catalog";
import { getRosSectorPack } from "@/lib/ros-sector-packs";

function formatTs(ms: number): string {
  try {
    return new Intl.DateTimeFormat("nb-NO", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(ms));
  } catch {
    return String(ms);
  }
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

/** Samme utvidelser som `api.ros.getAnalysis` returnerer. */
export type RosAnalysisForPdfPreview = Doc<"rosAnalyses"> & {
  cellNotes: string[][];
  cellItems: RosCellItemMatrix;
  matrixValuesAfter: number[][];
  cellNotesAfter: string[][];
  cellItemsAfter: RosCellItemMatrix;
  rosSummary: {
    summaryLines: string[];
    suggestedLinkFlags: string[];
  };
  afterAxis: {
    separateLayout: boolean;
    rowAxisTitle: string;
    colAxisTitle: string;
    rowLabels: string[];
    colLabels: string[];
  };
  candidateName: string | null;
  candidateCode: string | null;
  linkedAssessments: Array<{
    title: string;
    note?: string;
    flags?: string[];
    highlightForPvv?: boolean;
    pvvLinkNote?: string;
    requirementRefs?: RosRequirementRef[];
    pddStatus?: string;
    pddUrl?: string;
  }>;
};

type JournalRow = {
  body: string;
  authorName: string;
  createdAt: number;
  linkedRow?: number;
  linkedCol?: number;
  matrixPhase?: "before" | "after";
};

type TaskRow = {
  title: string;
  description?: string | null;
  dueAt?: number | null;
  status: string;
  assigneeName: string | null;
  linkedRiskSummary?: string | null;
  riskTreatmentKind?: string | null;
};

type VersionRow = {
  version: number;
  note?: string;
  createdAt: number;
};

/**
 * Bygger ROS PDF-inndata fra lagret analyse (samme innhold som PDF-eksport i editoren,
 * utenom ulagrede felt i skjemaet).
 */
export function buildRosPdfInputForPreview(args: {
  analysis: RosAnalysisForPdfPreview;
  journalEntries: JournalRow[];
  tasks: TaskRow[];
  versions: VersionRow[];
  workspaceName: string | null;
  templateName: string | null;
}): RosPdfInput {
  const data = args.analysis;
  const matrix = data.matrixValues;
  const cellItemsMatrix = data.cellItems;
  const mvAfterPdf = data.matrixValuesAfter;
  const cellItemsAfterPdf = data.cellItemsAfter;
  const useSeparateAfterAxes = data.afterAxis.separateLayout;
  const afterRowLabelsPdf = data.afterAxis.rowLabels;
  const afterColLabelsPdf = data.afterAxis.colLabels;

  const requirementRefs = (data.requirementRefs ?? []) as RosRequirementRef[];
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

  const taskLinesAll = args.tasks.map((t) => {
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
  });

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

  const nextReviewPdf =
    data.nextReviewAt != null && Number.isFinite(data.nextReviewAt)
      ? formatTs(data.nextReviewAt)
      : undefined;
  const routinePdf = data.reviewRoutineNotes?.trim() || undefined;
  const reviewSchedule =
    nextReviewPdf || routinePdf
      ? { nextReview: nextReviewPdf, routine: routinePdf }
      : undefined;

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
      cellItemsMatrix: cellItemsAfterPdf,
      rowLabels: afterRowLabelsPdf,
      colLabels: afterColLabelsPdf,
      matrixValues: mvAfterPdf,
      phase: "after",
    }),
  ];

  const riskPoolBefore = data.riskPoolBefore ?? [];
  const riskPoolAfter = data.riskPoolAfter ?? [];
  const riskPoolBeforeLines = formatRiskPoolLinesForPdf(riskPoolBefore);
  const riskPoolAfterLines = formatRiskPoolLinesForPdf(riskPoolAfter);

  return {
    title: data.title.trim() || data.title,
    workspaceName: args.workspaceName,
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
      ? data.afterAxis.rowAxisTitle
      : data.rowAxisTitle,
    afterColAxisTitle: useSeparateAfterAxes
      ? data.afterAxis.colAxisTitle
      : data.colAxisTitle,
    afterSeparateLayout: useSeparateAfterAxes,
    analysisNotes: data.notes?.trim() || null,
    summaryLines: summaryLines.length > 0 ? summaryLines : undefined,
    methodologyStatement: data.methodologyStatement?.trim() || null,
    contextSummary: data.contextSummary?.trim() || null,
    scopeAndCriteria: data.scopeAndCriteria?.trim() || null,
    riskCriteriaVersion: data.riskCriteriaVersion?.trim() || null,
    axisScaleNotes: data.axisScaleNotes?.trim() || null,
    complianceScopeTagIds:
      data.complianceScopeTags && data.complianceScopeTags.length > 0
        ? data.complianceScopeTags
        : undefined,
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
    journalEntries: args.journalEntries.slice(0, 100).map((e) => ({
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
      templateName: args.templateName ?? undefined,
    },
    versionSnapshots: args.versions.map((v) => ({
      version: v.version,
      note: v.note?.trim(),
      createdAt: v.createdAt,
    })),
  };
}
