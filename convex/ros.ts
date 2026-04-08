import { v } from "convex/values";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Doc, Id } from "./_generated/dataModel";
import {
  canReadAssessment,
  requireUserId,
  requireWorkspaceMember,
} from "./lib/access";
import { loadIntakeApprovedDerivedIds } from "./lib/intakeDerivedIds";
import { cascadeDeleteRosAnalysisData } from "./lib/cascadeDeletePvv";
import {
  cellHasAttention,
  flattenCellItemsMatrixToLegacyNotes,
  normalizeCellItems,
  resizeCellItemsMatrix,
  type RosCellItem,
  type RosCellItemMatrix,
} from "../lib/ros-cell-items";
import {
  computeRosSummary,
  type RosSummary,
} from "../lib/ros-summary";
import { rosRequirementRefValidator } from "./schema";
import {
  DEFAULT_ROS_COL_AXIS,
  DEFAULT_ROS_COL_LABELS,
  DEFAULT_ROS_ROW_AXIS,
  DEFAULT_ROS_ROW_LABELS,
  emptyMatrix,
  emptyStringMatrix,
} from "../lib/ros-defaults";

const MIN_DIM = 2;
const MAX_DIM = 12;

function trimLabels(labels: string[]): string[] {
  return labels.map((s) => s.trim()).filter(Boolean);
}

function validateLabelArrays(rows: string[], cols: string[]) {
  if (rows.length < MIN_DIM || rows.length > MAX_DIM) {
    throw new Error(
      `Rader må være mellom ${MIN_DIM} og ${MAX_DIM} (ikke tomme etiketter).`,
    );
  }
  if (cols.length < MIN_DIM || cols.length > MAX_DIM) {
    throw new Error(
      `Kolonner må være mellom ${MIN_DIM} og ${MAX_DIM} (ikke tomme etiketter).`,
    );
  }
}

function normalizeCellNotes(
  matrix: number[][],
  existing?: string[][],
): string[][] {
  const rows = matrix.length;
  const out: string[][] = [];
  for (let i = 0; i < rows; i++) {
    const cols = matrix[i]?.length ?? 0;
    const row: string[] = [];
    for (let j = 0; j < cols; j++) {
      row.push(existing?.[i]?.[j] ?? "");
    }
    out.push(row);
  }
  return out;
}

function assertNotesShape(
  notes: string[][],
  rowCount: number,
  colCount: number,
) {
  if (notes.length !== rowCount) {
    throw new Error("Celle-notater matcher ikke antall rader.");
  }
  for (const row of notes) {
    if (row.length !== colCount) {
      throw new Error("Celle-notater matcher ikke antall kolonner.");
    }
  }
}

function assertCellItemsShape(
  items: RosCellItemMatrix,
  rowCount: number,
  colCount: number,
) {
  if (items.length !== rowCount) {
    throw new Error("Celle-punkter matcher ikke antall rader.");
  }
  for (const row of items) {
    if (row.length !== colCount) {
      throw new Error("Celle-punkter matcher ikke antall kolonner.");
    }
    for (const cell of row) {
      for (const it of cell) {
        if (!it.id?.trim()) {
          throw new Error("Hvert punkt må ha en id.");
        }
        if (it.text.length > 8000) {
          throw new Error("Cellepunkt er for langt.");
        }
        if (it.afterChangeNote && it.afterChangeNote.length > 8000) {
          throw new Error("Begrunnelse for endring etter tiltak er for lang.");
        }
      }
    }
  }
}

function assertMatrixShape(
  values: number[][],
  rowCount: number,
  colCount: number,
) {
  if (values.length !== rowCount) {
    throw new Error("Matrisen matcher ikke antall rader.");
  }
  for (const row of values) {
    if (row.length !== colCount) {
      throw new Error("Matrisen matcher ikke antall kolonner.");
    }
    for (const c of row) {
      if (!Number.isInteger(c) || c < 0 || c > 5) {
        throw new Error("Hver celle må være et heltall 0–5.");
      }
    }
  }
}

function hasSeparateAfterLayout(row: Doc<"rosAnalyses">): boolean {
  const rl = trimLabels(row.rowLabelsAfter ?? []);
  const cl = trimLabels(row.colLabelsAfter ?? []);
  return rl.length >= MIN_DIM && cl.length >= MIN_DIM;
}

/** Dimensjon og etiketter for «etter tiltak»-matrise (egen layout eller lik som før). */
function afterDimensions(row: Doc<"rosAnalyses">): {
  rows: number;
  cols: number;
  rowLabels: string[];
  colLabels: string[];
  rowAxisTitle: string;
  colAxisTitle: string;
} {
  if (hasSeparateAfterLayout(row)) {
    const rl = trimLabels(row.rowLabelsAfter!);
    const cl = trimLabels(row.colLabelsAfter!);
    return {
      rows: rl.length,
      cols: cl.length,
      rowLabels: rl,
      colLabels: cl,
      rowAxisTitle: (row.rowAxisTitleAfter ?? row.rowAxisTitle).trim(),
      colAxisTitle: (row.colAxisTitleAfter ?? row.colAxisTitle).trim(),
    };
  }
  return {
    rows: row.rowLabels.length,
    cols: row.colLabels.length,
    rowLabels: row.rowLabels,
    colLabels: row.colLabels,
    rowAxisTitle: row.rowAxisTitle,
    colAxisTitle: row.colAxisTitle,
  };
}

function resizeNumberMatrix(
  old: number[][] | undefined,
  oldR: number,
  oldC: number,
  newR: number,
  newC: number,
): number[][] {
  const prev = old ?? emptyMatrix(oldR, oldC);
  const out: number[][] = [];
  for (let i = 0; i < newR; i++) {
    const row: number[] = [];
    for (let j = 0; j < newC; j++) {
      const v =
        i < oldR && j < oldC && prev[i]?.[j] !== undefined
          ? (prev[i]![j] ?? 0)
          : 0;
      row.push(Math.min(5, Math.max(0, Math.round(v))));
    }
    out.push(row);
  }
  return out;
}

/** Restrisiko-matrise: tom 0-matrise hvis felt mangler (eldre dokumenter). */
function normalizedAfterMatrices(row: Doc<"rosAnalyses">): {
  matrixValuesAfter: number[][];
  cellNotesAfter: string[][];
  cellItemsAfter: RosCellItemMatrix;
} {
  const { rows, cols } = afterDimensions(row);
  const base = emptyMatrix(rows, cols);
  const raw = row.matrixValuesAfter;
  let matrixValuesAfter: number[][];
  if (!raw || raw.length !== rows || !raw[0] || raw[0].length !== cols) {
    matrixValuesAfter = base.map((r) => [...r]);
  } else {
    matrixValuesAfter = raw.map((r) => [...r]);
  }
  const cellItemsAfter = normalizeCellItems(
    matrixValuesAfter,
    row.cellNotesAfter,
    row.cellItemsAfter as RosCellItemMatrix | undefined,
  );
  const cellNotesAfter = flattenCellItemsMatrixToLegacyNotes(cellItemsAfter);
  return { matrixValuesAfter, cellNotesAfter, cellItemsAfter };
}

function findRosCellItemInAnalysis(
  analysis: Doc<"rosAnalyses">,
  cellItemId: string,
  phase: "before" | "after",
): { item: RosCellItem; row: number; col: number } | null {
  if (phase === "before") {
    const cellItems = normalizeCellItems(
      analysis.matrixValues,
      analysis.cellNotes,
      analysis.cellItems as RosCellItemMatrix | undefined,
    );
    for (let r = 0; r < cellItems.length; r++) {
      const row = cellItems[r];
      if (!row) continue;
      for (let c = 0; c < row.length; c++) {
        const cell = row[c];
        if (!cell) continue;
        for (const it of cell) {
          if (it.id === cellItemId) return { item: it, row: r, col: c };
        }
      }
    }
  } else {
    const { cellItemsAfter } = normalizedAfterMatrices(analysis);
    for (let r = 0; r < cellItemsAfter.length; r++) {
      const row = cellItemsAfter[r];
      if (!row) continue;
      for (let c = 0; c < row.length; c++) {
        const cell = row[c];
        if (!cell) continue;
        for (const it of cell) {
          if (it.id === cellItemId) return { item: it, row: r, col: c };
        }
      }
    }
  }
  return null;
}

function clampRosPriority(p: number | undefined): number {
  if (p === undefined) return 3;
  return Math.min(5, Math.max(1, Math.round(p)));
}

/** Lesetilgang uten kast når dokumentet er slettet (unngår feil i abonnement etter sletting). */
async function optionalRosAnalysisRead(
  ctx: QueryCtx,
  analysisId: Id<"rosAnalyses">,
  userId: Id<"users">,
): Promise<Doc<"rosAnalyses"> | null> {
  const row = await ctx.db.get(analysisId);
  if (!row) {
    return null;
  }
  await requireWorkspaceMember(ctx, row.workspaceId, userId, "viewer");
  return row;
}

async function requireRosAnalysisEdit(
  ctx: MutationCtx,
  analysisId: Id<"rosAnalyses">,
  userId: Id<"users">,
): Promise<Doc<"rosAnalyses">> {
  const row = await ctx.db.get(analysisId);
  if (!row) {
    throw new Error("ROS-analyse finnes ikke.");
  }
  await requireWorkspaceMember(ctx, row.workspaceId, userId, "member");
  return row;
}

async function enrichRosTask(
  ctx: QueryCtx,
  row: Doc<"rosTasks">,
) {
  const assignee = row.assigneeUserId
    ? await ctx.db.get(row.assigneeUserId)
    : null;
  const creator = await ctx.db.get(row.createdByUserId);
  const analysis = await ctx.db.get(row.rosAnalysisId);
  let linkedRiskSummary: string | null = null;
  if (analysis) {
    if (row.linkedCellItemId && row.linkedCellItemPhase) {
      const found = findRosCellItemInAnalysis(
        analysis,
        row.linkedCellItemId,
        row.linkedCellItemPhase,
      );
      if (found) {
        const phaseNb = row.linkedCellItemPhase === "before" ? "Før" : "Etter";
        const dim =
          row.linkedCellItemPhase === "before"
            ? {
                rl: analysis.rowLabels,
                cl: analysis.colLabels,
              }
            : (() => {
                const d = afterDimensions(analysis);
                return { rl: d.rowLabels, cl: d.colLabels };
              })();
        const rlab = dim.rl[found.row] ?? `R${found.row + 1}`;
        const clab = dim.cl[found.col] ?? `K${found.col + 1}`;
        const raw = found.item.text.trim();
        const excerpt =
          raw.length > 100 ? `${raw.slice(0, 100)}…` : raw;
        linkedRiskSummary = excerpt
          ? `${phaseNb} · ${rlab} × ${clab} — ${excerpt}`
          : `${phaseNb} · ${rlab} × ${clab} — (tomt punkt)`;
      }
    } else if (
      row.matrixRow !== undefined &&
      row.matrixCol !== undefined &&
      row.matrixPhase
    ) {
      const phaseNb = row.matrixPhase === "before" ? "Før" : "Etter";
      const dim =
        row.matrixPhase === "after"
          ? afterDimensions(analysis)
          : {
              rowLabels: analysis.rowLabels,
              colLabels: analysis.colLabels,
            };
      const rlab = dim.rowLabels[row.matrixRow] ?? `R${row.matrixRow + 1}`;
      const clab = dim.colLabels[row.matrixCol] ?? `K${row.matrixCol + 1}`;
      linkedRiskSummary = `${phaseNb} · ${rlab} × ${clab} (eldre cellekobling)`;
    }
  }
  return {
    ...row,
    assigneeName: assignee?.name ?? assignee?.email ?? null,
    creatorName: creator?.name ?? creator?.email ?? null,
    linkedRiskSummary,
  };
}

export const listTemplates = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }
    await requireWorkspaceMember(ctx, args.workspaceId, userId, "viewer");
    return await ctx.db
      .query("rosTemplates")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
  },
});

export const listAnalyses = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }
    await requireWorkspaceMember(ctx, args.workspaceId, userId, "viewer");
    const { rosAnalysisIds: intakeRosIds } = await loadIntakeApprovedDerivedIds(
      ctx,
      args.workspaceId,
    );
    const rows = await ctx.db
      .query("rosAnalyses")
      .withIndex("by_workspace_updated", (q) =>
        q.eq("workspaceId", args.workspaceId),
      )
      .order("desc")
      .collect();
    const tplIds = new Set<Id<"rosTemplates">>();
    for (const r of rows) {
      if (r.templateId) {
        tplIds.add(r.templateId);
      }
    }
    const templateNameById = new Map<Id<"rosTemplates">, string>();
    for (const tid of tplIds) {
      const t = await ctx.db.get(tid);
      if (t) {
        templateNameById.set(tid, t.name);
      }
    }

    const out = [];
    for (const r of rows) {
      const cand = r.candidateId ? await ctx.db.get(r.candidateId) : null;
      const versionRows = await ctx.db
        .query("rosAnalysisVersions")
        .withIndex("by_ros_analysis", (q) => q.eq("rosAnalysisId", r._id))
        .collect();
      out.push({
        ...r,
        candidateName: cand?.name ?? null,
        candidateCode: cand?.code ?? null,
        templateName: r.templateId
          ? (templateNameById.get(r.templateId) ?? null)
          : null,
        versionCount: versionRows.length,
        fromIntake: intakeRosIds.has(r._id),
      });
    }
    return out;
  },
});

/**
 * Lettvekts «kommandosenter» for ROS-arbeidsflaten: tellere, hull i dekning,
 * siste aktivitet — uten å lese hele matrisen (billig abonnement).
 */
export const workspaceHub = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }
    await requireWorkspaceMember(ctx, args.workspaceId, userId, "viewer");

    const { rosAnalysisIds: intakeRosIds } = await loadIntakeApprovedDerivedIds(
      ctx,
      args.workspaceId,
    );

    const templateRows = await ctx.db
      .query("rosTemplates")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    const analysisRows = await ctx.db
      .query("rosAnalyses")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    const axisRows = await ctx.db
      .query("rosAxisLists")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    const candidateRows = await ctx.db
      .query("candidates")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    const covered = new Set<Id<"candidates">>();
    for (const a of analysisRows) {
      if (a.candidateId) covered.add(a.candidateId);
    }

    const withoutRos = candidateRows
      .filter((c) => !covered.has(c._id))
      .sort((a, b) =>
        a.name.localeCompare(b.name, "nb", { sensitivity: "base" }),
      );

    const taskRows = await ctx.db
      .query("rosTasks")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    const openRosTasksCount = taskRows.filter((t) => t.status === "open").length;

    const candById = new Map(
      candidateRows.map((c) => [c._id, c] as const),
    );
    const recent = [...analysisRows]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 8)
      .map((r) => {
        const cand = r.candidateId ? candById.get(r.candidateId) : undefined;
        return {
          analysisId: r._id,
          title: r.title,
          candidateCode: cand?.code ?? "",
          updatedAt: r.updatedAt,
          fromIntake: intakeRosIds.has(r._id),
        };
      });

    return {
      templateCount: templateRows.length,
      analysisCount: analysisRows.length,
      axisListCount: axisRows.length,
      candidateCount: candidateRows.length,
      candidatesWithoutRosCount: withoutRos.length,
      candidatesWithoutRos: withoutRos.slice(0, 16).map((c) => ({
        _id: c._id,
        name: c.name,
        code: c.code,
      })),
      openRosTasksCount,
      /** Når kun én mal finnes — brukes til forhåndsvalg ved ny analyse. */
      defaultTemplateId:
        templateRows.length === 1 ? templateRows[0]!._id : null,
      recentAnalyses: recent,
    };
  },
});

/** Aggregerer matrisedata for oversikt og sammenligning på tvers av ROS-analyser. */
export const workspaceDashboard = query({
  args: {
    workspaceId: v.id("workspaces"),
    /** Minste celle-nivå som vises som «oppmerksomhet» (standard 4 = høy/kritisk). */
    minAlertLevel: v.optional(v.number()),
    /** Ta med celler der et punkt er flagget for varsel/handling selv om nivå er lavere. */
    includeTaggedRiskItems: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }
    await requireWorkspaceMember(ctx, args.workspaceId, userId, "viewer");
    const rows = await ctx.db
      .query("rosAnalyses")
      .withIndex("by_workspace_updated", (q) =>
        q.eq("workspaceId", args.workspaceId),
      )
      .order("desc")
      .collect();

    const minAlertLevel = Math.min(
      5,
      Math.max(0, Math.round(args.minAlertLevel ?? 4)),
    );
    const includeTagged =
      args.includeTaggedRiskItems === undefined
        ? true
        : args.includeTaggedRiskItems;

    const workspaceCounts = [0, 0, 0, 0, 0, 0] as [
      number,
      number,
      number,
      number,
      number,
      number,
    ];
    let maxAcrossAll = 0;

    const analyses: Array<{
      analysisId: Id<"rosAnalyses">;
      title: string;
      candidateName: string;
      candidateCode: string;
      updatedAt: number;
      linkedPvvCount: number;
      cellCount: number;
      assessedCells: number;
      maxLevel: number;
      avgAssessed: number;
      highRiskCells: number;
      counts: [number, number, number, number, number, number];
      nextReviewAt: number | undefined;
      reviewRoutineNotes: string | null;
      openTasksCount: number;
    }> = [];

    const attentionItems: Array<{
      analysisId: Id<"rosAnalyses">;
      title: string;
      candidateName: string;
      candidateCode: string;
      phase: "before" | "after";
      rowIndex: number;
      colIndex: number;
      rowLabel: string;
      colLabel: string;
      level: number;
      reasons: Array<"level_ge_4" | "watch" | "requires_action">;
      flaggedTexts: string[];
    }> = [];

    function pushAttention(
      r: Doc<"rosAnalyses">,
      candName: string,
      candCode: string,
      phase: "before" | "after",
      i: number,
      j: number,
      rowLabels: string[],
      colLabels: string[],
      level: number,
      items: RosCellItem[],
    ) {
      const { reasons, flaggedTexts } = cellHasAttention(level, items);
      if (reasons.length === 0) return;
      const highEnough = level >= minAlertLevel;
      const tagged =
        includeTagged &&
        reasons.some((x) => x === "watch" || x === "requires_action");
      if (!highEnough && !tagged) return;
      attentionItems.push({
        analysisId: r._id,
        title: r.title,
        candidateName: candName,
        candidateCode: candCode,
        phase,
        rowIndex: i,
        colIndex: j,
        rowLabel: rowLabels[i] ?? `Rad ${i + 1}`,
        colLabel: colLabels[j] ?? `Kol ${j + 1}`,
        level,
        reasons,
        flaggedTexts,
      });
    }

    for (const r of rows) {
      const cand = r.candidateId ? await ctx.db.get(r.candidateId) : null;
      const links = await ctx.db
        .query("rosAnalysisAssessments")
        .withIndex("by_ros_analysis", (q) =>
          q.eq("rosAnalysisId", r._id),
        )
        .collect();
      let linkedPvvCount = 0;
      for (const l of links) {
        const a = await ctx.db.get(l.assessmentId);
        if (a && (await canReadAssessment(ctx, a, userId))) {
          linkedPvvCount++;
        }
      }

      const counts = [0, 0, 0, 0, 0, 0] as [
        number,
        number,
        number,
        number,
        number,
        number,
      ];
      let maxLevel = 0;
      let assessedCells = 0;
      let sumAssessed = 0;
      let highRiskCells = 0;
      let cellCount = 0;
      const afterNorm = normalizedAfterMatrices(r);
      const afterM = afterNorm.matrixValuesAfter;
      const beforeM = r.matrixValues;
      const cellItemsBefore = normalizeCellItems(
        beforeM,
        r.cellNotes,
        r.cellItems as RosCellItemMatrix | undefined,
      );
      const rowsB = beforeM.length;
      const colsB = beforeM[0]?.length ?? 0;
      const rowsA = afterM.length;
      const colsA = afterM[0]?.length ?? 0;
      const rMax = Math.max(rowsB, rowsA);
      const cMax = Math.max(colsB, colsA);
      for (let i = 0; i < rMax; i++) {
        for (let j = 0; j < cMax; j++) {
          cellCount++;
          const b =
            i < rowsB && j < (beforeM[i]?.length ?? 0)
              ? Math.min(5, Math.max(0, Math.round(beforeM[i]![j] ?? 0)))
              : 0;
          const a =
            i < rowsA && j < (afterM[i]?.length ?? 0)
              ? Math.min(5, Math.max(0, Math.round(afterM[i]![j] ?? 0)))
              : 0;
          const v = Math.max(b, a);
          counts[v]++;
          workspaceCounts[v]++;
          if (v > maxLevel) maxLevel = v;
          if (v > 0) {
            assessedCells++;
            sumAssessed += v;
            if (v >= 4) highRiskCells++;
          }
        }
      }

      for (let i = 0; i < rowsB; i++) {
        for (let j = 0; j < colsB; j++) {
          const level = Math.min(
            5,
            Math.max(0, Math.round(beforeM[i]![j] ?? 0)),
          );
          const items = cellItemsBefore[i]?.[j] ?? [];
          pushAttention(
            r,
            cand?.name ?? "—",
            cand?.code ?? "",
            "before",
            i,
            j,
            r.rowLabels,
            r.colLabels,
            level,
            items,
          );
        }
      }
      const dimAfter = afterDimensions(r);
      for (let i = 0; i < rowsA; i++) {
        for (let j = 0; j < colsA; j++) {
          const level = Math.min(
            5,
            Math.max(0, Math.round(afterM[i]![j] ?? 0)),
          );
          const items = afterNorm.cellItemsAfter[i]?.[j] ?? [];
          pushAttention(
            r,
            cand?.name ?? "—",
            cand?.code ?? "",
            "after",
            i,
            j,
            dimAfter.rowLabels,
            dimAfter.colLabels,
            level,
            items,
          );
        }
      }
      if (maxLevel > maxAcrossAll) maxAcrossAll = maxLevel;

      const rosTasksForA = await ctx.db
        .query("rosTasks")
        .withIndex("by_ros_analysis", (q) =>
          q.eq("rosAnalysisId", r._id),
        )
        .collect();
      const openTasksCount = rosTasksForA.filter((t) => t.status === "open")
        .length;

      analyses.push({
        analysisId: r._id,
        title: r.title,
        candidateName: cand?.name ?? "—",
        candidateCode: cand?.code ?? "",
        updatedAt: r.updatedAt,
        linkedPvvCount,
        cellCount,
        assessedCells,
        maxLevel,
        avgAssessed:
          assessedCells > 0 ? Math.round((sumAssessed / assessedCells) * 10) / 10 : 0,
        highRiskCells,
        counts,
        nextReviewAt: r.nextReviewAt,
        reviewRoutineNotes: r.reviewRoutineNotes?.trim() || null,
        openTasksCount,
      });
    }

    const totalCells = workspaceCounts.reduce((a, b) => a + b, 0);
    const assessedWorkspace = workspaceCounts
      .map((c, i) => (i > 0 ? c : 0))
      .reduce((a, b) => a + b, 0);

    attentionItems.sort((x, y) => y.level - x.level);

    return {
      analysisCount: analyses.length,
      totalCells,
      assessedCells: assessedWorkspace,
      notAssessedCells: workspaceCounts[0],
      maxAcrossAll,
      workspaceCounts,
      analyses,
      attentionItems,
      minAlertLevel,
      includeTaggedRiskItems: includeTagged,
    };
  },
});

/** Antall celler per risikonivå 0–5 (for diagrammer). */
function countMatrixLevelHistogram(m: number[][]): [
  number,
  number,
  number,
  number,
  number,
  number,
] {
  const c: [number, number, number, number, number, number] = [0, 0, 0, 0, 0, 0];
  for (const row of m) {
    for (const v of row) {
      const n = Math.min(5, Math.max(0, Math.round(v)));
      c[n]++;
    }
  }
  return c;
}

/**
 * Sammenlign risiko-oppsummering (før/etter tiltak) mellom to ROS-analyser i samme arbeidsområde.
 */
export const compareRosAnalyses = query({
  args: {
    workspaceId: v.id("workspaces"),
    analysisIdA: v.id("rosAnalyses"),
    analysisIdB: v.id("rosAnalyses"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }
    await requireWorkspaceMember(ctx, args.workspaceId, userId, "viewer");
    const rowA = await ctx.db.get(args.analysisIdA);
    const rowB = await ctx.db.get(args.analysisIdB);
    if (
      !rowA ||
      !rowB ||
      rowA.workspaceId !== args.workspaceId ||
      rowB.workspaceId !== args.workspaceId
    ) {
      return null;
    }
    const candA = rowA.candidateId ? await ctx.db.get(rowA.candidateId) : null;
    const candB = rowB.candidateId ? await ctx.db.get(rowB.candidateId) : null;
    const afterA = normalizedAfterMatrices(rowA);
    const afterB = normalizedAfterMatrices(rowB);
    const summaryA = computeRosSummary({
      matrixBefore: rowA.matrixValues,
      matrixAfter: afterA.matrixValuesAfter,
    });
    const summaryB = computeRosSummary({
      matrixBefore: rowB.matrixValues,
      matrixAfter: afterB.matrixValuesAfter,
    });
    return {
      a: {
        analysisId: rowA._id,
        title: rowA.title,
        candidateName: candA?.name ?? "—",
        candidateCode: candA?.code ?? "",
        summary: summaryA,
        levelCountsBefore: countMatrixLevelHistogram(rowA.matrixValues),
        levelCountsAfter: countMatrixLevelHistogram(afterA.matrixValuesAfter),
      },
      b: {
        analysisId: rowB._id,
        title: rowB.title,
        candidateName: candB?.name ?? "—",
        candidateCode: candB?.code ?? "",
        summary: summaryB,
        levelCountsBefore: countMatrixLevelHistogram(rowB.matrixValues),
        levelCountsAfter: countMatrixLevelHistogram(afterB.matrixValuesAfter),
      },
    };
  },
});

export const getAnalysis = query({
  args: { analysisId: v.id("rosAnalyses") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }
    const row = await ctx.db.get(args.analysisId);
    if (!row) {
      return null;
    }
    await requireWorkspaceMember(ctx, row.workspaceId, userId, "viewer");
    const cand = row.candidateId ? await ctx.db.get(row.candidateId) : null;
    const links = await ctx.db
      .query("rosAnalysisAssessments")
      .withIndex("by_ros_analysis", (q) =>
        q.eq("rosAnalysisId", args.analysisId),
      )
      .collect();
    const linkedAssessments: Array<{
      linkId: Id<"rosAnalysisAssessments">;
      assessmentId: Id<"assessments">;
      title: string;
      note: string | undefined;
      flags: string[] | undefined;
      highlightForPvv: boolean | undefined;
      pvvLinkNote: string | undefined;
      requirementRefs: Doc<"rosAnalysisAssessments">["requirementRefs"];
      pddStatus: string | undefined;
      pddUrl: string | undefined;
    }> = [];
    for (const l of links) {
      const a = await ctx.db.get(l.assessmentId);
      if (!a || !(await canReadAssessment(ctx, a, userId))) {
        continue;
      }
      linkedAssessments.push({
        linkId: l._id,
        assessmentId: l.assessmentId,
        title: a.title,
        note: l.note,
        flags: l.flags,
        highlightForPvv: l.highlightForPvv,
        pvvLinkNote: l.pvvLinkNote,
        requirementRefs: l.requirementRefs,
        pddStatus: a.pddStatus,
        pddUrl: a.pddUrl,
      });
    }
    let legacyAssessmentTitle: string | null = null;
    if (row.assessmentId) {
      const a = await ctx.db.get(row.assessmentId);
      legacyAssessmentTitle = a?.title ?? null;
    }
    const { matrixValuesAfter, cellNotesAfter, cellItemsAfter } =
      normalizedAfterMatrices(row);
    const cellItems = normalizeCellItems(
      row.matrixValues,
      row.cellNotes,
      row.cellItems as RosCellItemMatrix | undefined,
    );
    const cellNotes = flattenCellItemsMatrixToLegacyNotes(cellItems);
    const rosSummary = computeRosSummary({
      matrixBefore: row.matrixValues,
      matrixAfter: matrixValuesAfter,
    });
    const dimAfter = afterDimensions(row);
    const afterAxis = {
      separateLayout: hasSeparateAfterLayout(row),
      rowAxisTitle: dimAfter.rowAxisTitle,
      colAxisTitle: dimAfter.colAxisTitle,
      rowLabels: dimAfter.rowLabels,
      colLabels: dimAfter.colLabels,
    };
    return {
      ...row,
      cellNotes,
      cellItems,
      matrixValuesAfter,
      cellNotesAfter,
      cellItemsAfter,
      rosSummary,
      afterAxis,
      candidateName: cand?.name ?? null,
      candidateCode: cand?.code ?? null,
      linkedAssessments,
      legacyAssessmentId: row.assessmentId ?? null,
      legacyAssessmentTitle,
    };
  },
});

export const listJournalEntries = query({
  args: { analysisId: v.id("rosAnalyses") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }
    if (!(await optionalRosAnalysisRead(ctx, args.analysisId, userId))) {
      return [];
    }
    const rows = await ctx.db
      .query("rosAnalysisJournalEntries")
      .withIndex("by_ros_analysis", (q) =>
        q.eq("rosAnalysisId", args.analysisId),
      )
      .collect();
    rows.sort((a, b) => b.createdAt - a.createdAt);
    const out = [];
    for (const r of rows) {
      const u = await ctx.db.get(r.createdByUserId);
      out.push({
        ...r,
        authorName: u?.name ?? u?.email ?? "—",
      });
    }
    return out;
  },
});

/** PVV-vurderinger som matcher kandidatens kode (for kobling til ROS). */
export const listMatchingAssessments = query({
  args: {
    workspaceId: v.id("workspaces"),
    candidateId: v.id("candidates"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }
    const cand = await ctx.db.get(args.candidateId);
    if (!cand || cand.workspaceId !== args.workspaceId) {
      return [];
    }
    await requireWorkspaceMember(ctx, args.workspaceId, userId, "viewer");
    const code = cand.code;
    const assessments = await ctx.db
      .query("assessments")
      .withIndex("by_workspace", (q) =>
        q.eq("workspaceId", args.workspaceId),
      )
      .collect();
    const out: Array<{ _id: Id<"assessments">; title: string }> = [];
    for (const a of assessments) {
      if (!(await canReadAssessment(ctx, a, userId))) {
        continue;
      }
      const draft = await ctx.db
        .query("assessmentDrafts")
        .withIndex("by_assessment", (q) => q.eq("assessmentId", a._id))
        .unique();
      const ref = draft
        ? String((draft.payload as Record<string, unknown>).candidateId ?? "")
        : "";
      if (ref === code) {
        out.push({ _id: a._id, title: a.title });
      }
    }
    out.sort((x, y) => y.title.localeCompare(x.title));
    return out;
  },
});

/** Alle PVV-vurderinger i arbeidsområdet du kan lese — for kobling til ROS (mange-til-mange). */
export const listAssessmentsForWorkspace = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }
    await requireWorkspaceMember(ctx, args.workspaceId, userId, "viewer");
    const assessments = await ctx.db
      .query("assessments")
      .withIndex("by_workspace", (q) =>
        q.eq("workspaceId", args.workspaceId),
      )
      .collect();
    const out: Array<{ _id: Id<"assessments">; title: string }> = [];
    for (const a of assessments) {
      if (!(await canReadAssessment(ctx, a, userId))) {
        continue;
      }
      out.push({ _id: a._id, title: a.title });
    }
    out.sort((x, y) => x.title.localeCompare(y.title));
    return out;
  },
});

export const createTemplate = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.string(),
    description: v.optional(v.string()),
    rowAxisTitle: v.optional(v.string()),
    colAxisTitle: v.optional(v.string()),
    rowLabels: v.optional(v.array(v.string())),
    colLabels: v.optional(v.array(v.string())),
    rowDescriptions: v.optional(v.array(v.string())),
    colDescriptions: v.optional(v.array(v.string())),
    defaultMatrixValues: v.optional(v.array(v.array(v.number()))),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireWorkspaceMember(ctx, args.workspaceId, userId, "member");
    const name = args.name.trim();
    if (!name) {
      throw new Error("Navn på mal er påkrevd.");
    }
    const rowLabels = trimLabels(
      args.rowLabels ?? [...DEFAULT_ROS_ROW_LABELS],
    );
    const colLabels = trimLabels(
      args.colLabels ?? [...DEFAULT_ROS_COL_LABELS],
    );
    validateLabelArrays(rowLabels, colLabels);
    if (args.defaultMatrixValues) {
      assertMatrixShape(args.defaultMatrixValues, rowLabels.length, colLabels.length);
    }
    const now = Date.now();
    return await ctx.db.insert("rosTemplates", {
      workspaceId: args.workspaceId,
      name,
      description: args.description?.trim() || undefined,
      rowAxisTitle: (args.rowAxisTitle ?? DEFAULT_ROS_ROW_AXIS).trim(),
      colAxisTitle: (args.colAxisTitle ?? DEFAULT_ROS_COL_AXIS).trim(),
      rowLabels,
      colLabels,
      rowDescriptions: args.rowDescriptions?.map((d) => d.trim()),
      colDescriptions: args.colDescriptions?.map((d) => d.trim()),
      defaultMatrixValues: args.defaultMatrixValues,
      createdByUserId: userId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateTemplate = mutation({
  args: {
    templateId: v.id("rosTemplates"),
    name: v.optional(v.string()),
    description: v.optional(v.union(v.string(), v.null())),
    rowAxisTitle: v.optional(v.string()),
    colAxisTitle: v.optional(v.string()),
    rowLabels: v.optional(v.array(v.string())),
    colLabels: v.optional(v.array(v.string())),
    rowDescriptions: v.optional(v.union(v.array(v.string()), v.null())),
    colDescriptions: v.optional(v.union(v.array(v.string()), v.null())),
    defaultMatrixValues: v.optional(v.union(v.array(v.array(v.number())), v.null())),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const row = await ctx.db.get(args.templateId);
    if (!row) {
      throw new Error("Mal finnes ikke.");
    }
    await requireWorkspaceMember(ctx, row.workspaceId, userId, "member");
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.name !== undefined) {
      const n = args.name.trim();
      if (!n) throw new Error("Navn kan ikke være tomt.");
      patch.name = n;
    }
    if (args.description !== undefined) {
      patch.description =
        args.description === null ? undefined : args.description.trim() || undefined;
    }
    if (args.rowAxisTitle !== undefined) {
      patch.rowAxisTitle = args.rowAxisTitle.trim();
    }
    if (args.colAxisTitle !== undefined) {
      patch.colAxisTitle = args.colAxisTitle.trim();
    }
    if (args.rowLabels !== undefined || args.colLabels !== undefined) {
      const rl =
        args.rowLabels !== undefined ? trimLabels(args.rowLabels) : row.rowLabels;
      const cl =
        args.colLabels !== undefined ? trimLabels(args.colLabels) : row.colLabels;
      validateLabelArrays(rl, cl);
      patch.rowLabels = rl;
      patch.colLabels = cl;
    }
    if (args.rowDescriptions !== undefined) {
      patch.rowDescriptions =
        args.rowDescriptions === null ? undefined : args.rowDescriptions.map((d) => d.trim());
    }
    if (args.colDescriptions !== undefined) {
      patch.colDescriptions =
        args.colDescriptions === null ? undefined : args.colDescriptions.map((d) => d.trim());
    }
    if (args.defaultMatrixValues !== undefined) {
      if (args.defaultMatrixValues === null) {
        patch.defaultMatrixValues = undefined;
      } else {
        const rl = (patch.rowLabels as string[] | undefined) ?? row.rowLabels;
        const cl = (patch.colLabels as string[] | undefined) ?? row.colLabels;
        assertMatrixShape(args.defaultMatrixValues, rl.length, cl.length);
        patch.defaultMatrixValues = args.defaultMatrixValues;
      }
    }
    await ctx.db.patch(args.templateId, patch);
    return null;
  },
});

export const removeTemplate = mutation({
  args: { templateId: v.id("rosTemplates") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const row = await ctx.db.get(args.templateId);
    if (!row) {
      throw new Error("Mal finnes ikke.");
    }
    await requireWorkspaceMember(ctx, row.workspaceId, userId, "member");
    await ctx.db.delete(args.templateId);
    return null;
  },
});

export const createAnalysis = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    templateId: v.id("rosTemplates"),
    candidateId: v.optional(v.id("candidates")),
    /** Brukes når prosess mangler enhet, eller som eksplisitt kobling til treet. */
    orgUnitId: v.optional(v.id("orgUnits")),
    title: v.string(),
    /** Én eldre enkeltkobling (valgfritt); bruk assessmentIds for flere PVV */
    assessmentId: v.optional(v.id("assessments")),
    assessmentIds: v.optional(v.array(v.id("assessments"))),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireWorkspaceMember(ctx, args.workspaceId, userId, "member");
    if (args.candidateId) {
      const cand = await ctx.db.get(args.candidateId);
      if (!cand || cand.workspaceId !== args.workspaceId) {
        throw new Error("Ugyldig kandidat.");
      }
    }
    if (args.orgUnitId) {
      const unit = await ctx.db.get(args.orgUnitId);
      if (!unit || unit.workspaceId !== args.workspaceId) {
        throw new Error("Ugyldig organisasjonsenhet.");
      }
    }
    const tpl = await ctx.db.get(args.templateId);
    if (!tpl || tpl.workspaceId !== args.workspaceId) {
      throw new Error("Ugyldig mal.");
    }
    const title = args.title.trim();
    if (!title) {
      throw new Error("Tittel er påkrevd.");
    }
    const idSet = new Set<string>();
    const addIds = [...(args.assessmentIds ?? [])];
    if (args.assessmentId) {
      addIds.push(args.assessmentId);
    }
    for (const aid of addIds) {
      idSet.add(aid);
    }
    for (const aid of idSet) {
      const a = await ctx.db.get(aid as Id<"assessments">);
      if (!a || a.workspaceId !== args.workspaceId) {
        throw new Error("Ugyldig vurdering.");
      }
      if (!(await canReadAssessment(ctx, a, userId))) {
        throw new Error("Ingen tilgang til vurderingen.");
      }
    }
    const matrixValues = tpl.defaultMatrixValues
      ? tpl.defaultMatrixValues.map((r) => [...r])
      : emptyMatrix(tpl.rowLabels.length, tpl.colLabels.length);
    const cellNotes = emptyStringMatrix(
      tpl.rowLabels.length,
      tpl.colLabels.length,
    );
    const now = Date.now();
    const matrixValuesAfter = emptyMatrix(
      tpl.rowLabels.length,
      tpl.colLabels.length,
    );
    const cellNotesAfter = emptyStringMatrix(
      tpl.rowLabels.length,
      tpl.colLabels.length,
    );
    const analysisId = await ctx.db.insert("rosAnalyses", {
      workspaceId: args.workspaceId,
      templateId: args.templateId,
      title,
      rowAxisTitle: tpl.rowAxisTitle,
      colAxisTitle: tpl.colAxisTitle,
      rowLabels: [...tpl.rowLabels],
      colLabels: [...tpl.colLabels],
      matrixValues,
      cellNotes,
      matrixValuesAfter,
      cellNotesAfter,
      candidateId: args.candidateId ?? undefined,
      orgUnitId: args.orgUnitId ?? undefined,
      assessmentId: undefined,
      notes: args.notes?.trim() || undefined,
      createdByUserId: userId,
      createdAt: now,
      updatedAt: now,
      revision: 1,
    });
    for (const aid of idSet) {
      const existing = await ctx.db
        .query("rosAnalysisAssessments")
        .withIndex("by_ros_and_assessment", (q) =>
          q.eq("rosAnalysisId", analysisId).eq("assessmentId", aid as Id<"assessments">),
        )
        .unique();
      if (existing) {
        continue;
      }
      await ctx.db.insert("rosAnalysisAssessments", {
        workspaceId: args.workspaceId,
        rosAnalysisId: analysisId,
        assessmentId: aid as Id<"assessments">,
        createdByUserId: userId,
        createdAt: now,
      });
    }
    return analysisId;
  },
});

/** Må matche `rosCellItemValidator` i schema.ts (plassering før/etter i matrisen). */
const rosCellItemV = v.object({
  id: v.string(),
  text: v.string(),
  flags: v.optional(v.array(v.string())),
  afterRow: v.optional(v.number()),
  afterCol: v.optional(v.number()),
  sourceItemId: v.optional(v.string()),
  afterChangeNote: v.optional(v.string()),
});
const rosCellItemsMatrixV = v.array(v.array(v.array(rosCellItemV)));

export const updateAnalysis = mutation({
  args: {
    analysisId: v.id("rosAnalyses"),
    /** Må matche `revision` på analysen (0 hvis eldre dokument uten felt) */
    expectedRevision: v.number(),
    matrixValues: v.optional(v.array(v.array(v.number()))),
    cellNotes: v.optional(v.array(v.array(v.string()))),
    cellItems: v.optional(rosCellItemsMatrixV),
    matrixValuesAfter: v.optional(v.array(v.array(v.number()))),
    cellNotesAfter: v.optional(v.array(v.array(v.string()))),
    cellItemsAfter: v.optional(rosCellItemsMatrixV),
    rowAxisTitleAfter: v.optional(v.string()),
    colAxisTitleAfter: v.optional(v.string()),
    rowLabelsAfter: v.optional(v.array(v.string())),
    colLabelsAfter: v.optional(v.array(v.string())),
    title: v.optional(v.string()),
    candidateId: v.optional(v.union(v.id("candidates"), v.null())),
    orgUnitId: v.optional(v.union(v.id("orgUnits"), v.null())),
    notes: v.optional(v.union(v.string(), v.null())),
    nextReviewAt: v.optional(v.union(v.number(), v.null())),
    reviewRoutineNotes: v.optional(v.union(v.string(), v.null())),
    methodologyStatement: v.optional(v.union(v.string(), v.null())),
    contextSummary: v.optional(v.union(v.string(), v.null())),
    scopeAndCriteria: v.optional(v.union(v.string(), v.null())),
    riskCriteriaVersion: v.optional(v.union(v.string(), v.null())),
    axisScaleNotes: v.optional(v.union(v.string(), v.null())),
    complianceScopeTags: v.optional(v.union(v.array(v.string()), v.null())),
    requirementRefs: v.optional(
      v.union(v.array(rosRequirementRefValidator), v.null()),
    ),
    /** Etter vellykket lagring: lag versjonsøyeblikksbilde (brukes ved eksplisitt «Lagre», ikke autosave). */
    saveVersionSnapshot: v.optional(v.boolean()),
    versionSnapshotNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const row = await requireRosAnalysisEdit(ctx, args.analysisId, userId);
    const patch: Record<string, unknown> = { updatedAt: Date.now() };

    if (args.rowAxisTitleAfter !== undefined) {
      patch.rowAxisTitleAfter = args.rowAxisTitleAfter.trim();
    }
    if (args.colAxisTitleAfter !== undefined) {
      patch.colAxisTitleAfter = args.colAxisTitleAfter.trim();
    }
    if (args.rowLabelsAfter !== undefined || args.colLabelsAfter !== undefined) {
      const rl = trimLabels(args.rowLabelsAfter ?? row.rowLabelsAfter ?? []);
      const cl = trimLabels(args.colLabelsAfter ?? row.colLabelsAfter ?? []);
      if (rl.length < MIN_DIM || cl.length < MIN_DIM) {
        patch.rowLabelsAfter = undefined;
        patch.colLabelsAfter = undefined;
        patch.rowAxisTitleAfter = undefined;
        patch.colAxisTitleAfter = undefined;
        const oldDim = afterDimensions(row);
        const br = row.rowLabels.length;
        const bc = row.colLabels.length;
        const prevMv = normalizedAfterMatrices(row).matrixValuesAfter;
        const prevItems = normalizeCellItems(
          prevMv,
          row.cellNotesAfter,
          row.cellItemsAfter as RosCellItemMatrix | undefined,
        );
        patch.matrixValuesAfter = resizeNumberMatrix(
          prevMv,
          oldDim.rows,
          oldDim.cols,
          br,
          bc,
        );
        patch.cellItemsAfter = resizeCellItemsMatrix(
          prevItems,
          oldDim.rows,
          oldDim.cols,
          br,
          bc,
        );
        patch.cellNotesAfter = flattenCellItemsMatrixToLegacyNotes(
          patch.cellItemsAfter as RosCellItemMatrix,
        );
      } else {
        validateLabelArrays(rl, cl);
        patch.rowLabelsAfter = rl;
        patch.colLabelsAfter = cl;
        const oldDim = afterDimensions(row);
        const newR = rl.length;
        const newC = cl.length;
        if (oldDim.rows !== newR || oldDim.cols !== newC) {
          const prevMv = normalizedAfterMatrices(row).matrixValuesAfter;
          const prevItems = normalizeCellItems(
            prevMv,
            row.cellNotesAfter,
            row.cellItemsAfter as RosCellItemMatrix | undefined,
          );
          patch.matrixValuesAfter = resizeNumberMatrix(
            prevMv,
            oldDim.rows,
            oldDim.cols,
            newR,
            newC,
          );
          patch.cellItemsAfter = resizeCellItemsMatrix(
            prevItems,
            oldDim.rows,
            oldDim.cols,
            newR,
            newC,
          );
          patch.cellNotesAfter = flattenCellItemsMatrixToLegacyNotes(
            patch.cellItemsAfter as RosCellItemMatrix,
          );
        }
      }
    }

    const preview = { ...row, ...patch } as Doc<"rosAnalyses">;
    const dimAfter = afterDimensions(preview);

    if (args.matrixValues !== undefined) {
      assertMatrixShape(
        args.matrixValues,
        row.rowLabels.length,
        row.colLabels.length,
      );
      const oldM = row.matrixValues;
      const newM = args.matrixValues;
      for (let i = 0; i < newM.length; i++) {
        for (let j = 0; j < (newM[i]?.length ?? 0); j++) {
          const o = oldM[i]?.[j] ?? 0;
          const n = newM[i][j];
          if (o !== n) {
            const rl = row.rowLabels[i] ?? `Rad ${i + 1}`;
            const cl = row.colLabels[j] ?? `Kol ${j + 1}`;
            await ctx.db.insert("rosAnalysisJournalEntries", {
              workspaceId: row.workspaceId,
              rosAnalysisId: args.analysisId,
              body: `Før tiltak · Nivå endret · ${rl.slice(0, 120)} × ${cl.slice(0, 120)}: ${o} → ${n}`,
              matrixPhase: "before",
              linkedRow: i,
              linkedCol: j,
              createdByUserId: userId,
              createdAt: Date.now(),
            });
          }
        }
      }
      patch.matrixValues = args.matrixValues;
    }
    if (args.cellItems !== undefined) {
      const mv = (args.matrixValues ?? row.matrixValues) as number[][];
      assertMatrixShape(mv, row.rowLabels.length, row.colLabels.length);
      assertCellItemsShape(
        args.cellItems as RosCellItemMatrix,
        row.rowLabels.length,
        row.colLabels.length,
      );
      patch.cellItems = (args.cellItems as RosCellItemMatrix).map((r) =>
        r.map((c) => c.map((x) => ({ ...x }))),
      );
      patch.cellNotes = flattenCellItemsMatrixToLegacyNotes(
        args.cellItems as RosCellItemMatrix,
      );
    } else if (args.cellNotes !== undefined) {
      const mv = (args.matrixValues ?? row.matrixValues) as number[][];
      assertNotesShape(
        args.cellNotes,
        row.rowLabels.length,
        row.colLabels.length,
      );
      assertMatrixShape(mv, row.rowLabels.length, row.colLabels.length);
      patch.cellNotes = args.cellNotes.map((r) => [...r]);
    }
    if (args.matrixValuesAfter !== undefined) {
      assertMatrixShape(
        args.matrixValuesAfter,
        dimAfter.rows,
        dimAfter.cols,
      );
      const { matrixValuesAfter: prevAfter } = normalizedAfterMatrices(row);
      const newM = args.matrixValuesAfter;
      for (let i = 0; i < newM.length; i++) {
        for (let j = 0; j < (newM[i]?.length ?? 0); j++) {
          const o = prevAfter[i]?.[j] ?? 0;
          const n = newM[i][j];
          if (o !== n) {
            const rl = dimAfter.rowLabels[i] ?? `Rad ${i + 1}`;
            const cl = dimAfter.colLabels[j] ?? `Kol ${j + 1}`;
            await ctx.db.insert("rosAnalysisJournalEntries", {
              workspaceId: row.workspaceId,
              rosAnalysisId: args.analysisId,
              body: `Etter tiltak · Nivå endret · ${rl.slice(0, 120)} × ${cl.slice(0, 120)}: ${o} → ${n}`,
              matrixPhase: "after",
              linkedRow: i,
              linkedCol: j,
              createdByUserId: userId,
              createdAt: Date.now(),
            });
          }
        }
      }
      patch.matrixValuesAfter = args.matrixValuesAfter;
    }
    if (args.cellItemsAfter !== undefined) {
      const mv = (args.matrixValuesAfter ??
        (patch.matrixValuesAfter as number[][] | undefined) ??
        normalizedAfterMatrices(preview).matrixValuesAfter) as number[][];
      assertMatrixShape(mv, dimAfter.rows, dimAfter.cols);
      assertCellItemsShape(
        args.cellItemsAfter as RosCellItemMatrix,
        dimAfter.rows,
        dimAfter.cols,
      );
      patch.cellItemsAfter = (args.cellItemsAfter as RosCellItemMatrix).map(
        (r) => r.map((c) => c.map((x) => ({ ...x }))),
      );
      patch.cellNotesAfter = flattenCellItemsMatrixToLegacyNotes(
        args.cellItemsAfter as RosCellItemMatrix,
      );
    } else if (args.cellNotesAfter !== undefined) {
      const mv = (args.matrixValuesAfter ??
        (patch.matrixValuesAfter as number[][] | undefined) ??
        normalizedAfterMatrices(preview).matrixValuesAfter) as number[][];
      assertNotesShape(
        args.cellNotesAfter,
        dimAfter.rows,
        dimAfter.cols,
      );
      assertMatrixShape(mv, dimAfter.rows, dimAfter.cols);
      patch.cellNotesAfter = args.cellNotesAfter.map((r) => [...r]);
    }
    if (args.title !== undefined) {
      const t = args.title.trim();
      if (!t) throw new Error("Tittel kan ikke være tom.");
      patch.title = t;
    }
    if (args.candidateId !== undefined) {
      if (args.candidateId === null) {
        patch.candidateId = undefined;
      } else {
        const cand = await ctx.db.get(args.candidateId);
        if (!cand || cand.workspaceId !== row.workspaceId) {
          throw new Error("Ugyldig kandidat.");
        }
        patch.candidateId = args.candidateId;
      }
    }
    if (args.orgUnitId !== undefined) {
      if (args.orgUnitId === null) {
        patch.orgUnitId = undefined;
      } else {
        const unit = await ctx.db.get(args.orgUnitId);
        if (!unit || unit.workspaceId !== row.workspaceId) {
          throw new Error("Ugyldig organisasjonsenhet.");
        }
        patch.orgUnitId = args.orgUnitId;
      }
    }
    if (args.notes !== undefined) {
      patch.notes =
        args.notes === null ? undefined : args.notes.trim() || undefined;
    }
    if (args.nextReviewAt !== undefined) {
      patch.nextReviewAt =
        args.nextReviewAt === null ? undefined : args.nextReviewAt;
    }
    if (args.reviewRoutineNotes !== undefined) {
      patch.reviewRoutineNotes =
        args.reviewRoutineNotes === null
          ? undefined
          : args.reviewRoutineNotes.trim() || undefined;
    }
    if (args.methodologyStatement !== undefined) {
      patch.methodologyStatement =
        args.methodologyStatement === null
          ? undefined
          : args.methodologyStatement.trim() || undefined;
    }
    if (args.contextSummary !== undefined) {
      patch.contextSummary =
        args.contextSummary === null
          ? undefined
          : args.contextSummary.trim() || undefined;
    }
    if (args.scopeAndCriteria !== undefined) {
      patch.scopeAndCriteria =
        args.scopeAndCriteria === null
          ? undefined
          : args.scopeAndCriteria.trim() || undefined;
    }
    if (args.riskCriteriaVersion !== undefined) {
      patch.riskCriteriaVersion =
        args.riskCriteriaVersion === null
          ? undefined
          : args.riskCriteriaVersion.trim() || undefined;
    }
    if (args.axisScaleNotes !== undefined) {
      patch.axisScaleNotes =
        args.axisScaleNotes === null
          ? undefined
          : args.axisScaleNotes.trim() || undefined;
    }
    if (args.complianceScopeTags !== undefined) {
      patch.complianceScopeTags =
        args.complianceScopeTags === null
          ? undefined
          : args.complianceScopeTags.filter(Boolean).slice(0, 32);
    }
    if (args.requirementRefs !== undefined) {
      patch.requirementRefs =
        args.requirementRefs === null
          ? undefined
          : args.requirementRefs.slice(0, 48).map((r) => ({
              source: r.source,
              article: r.article?.trim() || undefined,
              note: r.note?.trim() || undefined,
              documentationUrl: r.documentationUrl?.trim() || undefined,
            }));
    }
    const fresh = await ctx.db.get(args.analysisId);
    if (!fresh) {
      throw new Error("ROS-analysen finnes ikke.");
    }
    if (
      !Number.isInteger(args.expectedRevision) ||
      args.expectedRevision < 0
    ) {
      throw new Error("Ugyldig revisjon.");
    }
    const serverRev = fresh.revision ?? 0;
    if (args.expectedRevision !== serverRev) {
      return {
        ok: false as const,
        conflict: {
          serverRevision: serverRev,
          updatedAt: fresh.updatedAt,
        },
      };
    }
    const newRev = serverRev + 1;
    patch.revision = newRev;
    await ctx.db.patch(args.analysisId, patch);
    let snapshotVersion: number | undefined;
    if (args.saveVersionSnapshot) {
      const updated = await ctx.db.get(args.analysisId);
      if (!updated) {
        throw new Error("ROS-analysen finnes ikke.");
      }
      const snap = await insertRosAnalysisVersionSnapshot(
        ctx,
        updated,
        userId,
        args.versionSnapshotNote?.trim() || undefined,
      );
      snapshotVersion = snap.version;
    }
    return {
      ok: true as const,
      revision: newRev,
      ...(snapshotVersion !== undefined ? { snapshotVersion } : {}),
    };
  },
});

export const appendJournalEntry = mutation({
  args: {
    analysisId: v.id("rosAnalyses"),
    expectedRevision: v.number(),
    body: v.string(),
    matrixPhase: v.optional(
      v.union(v.literal("before"), v.literal("after")),
    ),
    linkedRow: v.optional(v.number()),
    linkedCol: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const row = await requireRosAnalysisEdit(ctx, args.analysisId, userId);
    const text = args.body.trim();
    if (!text) {
      throw new Error("Tekst kan ikke være tom.");
    }
    const hasR = args.linkedRow !== undefined;
    const hasC = args.linkedCol !== undefined;
    if (hasR !== hasC) {
      throw new Error("Oppgi både rad og kolonne for cellekobling, eller ingen.");
    }
    if (hasR && hasC) {
      const i = args.linkedRow!;
      const j = args.linkedCol!;
      if (args.matrixPhase === "after") {
        const dim = afterDimensions(row);
        if (i < 0 || j < 0 || i >= dim.rows || j >= dim.cols) {
          throw new Error("Ugyldig cellekobling.");
        }
      } else {
        if (
          i < 0 ||
          j < 0 ||
          i >= row.rowLabels.length ||
          j >= row.colLabels.length
        ) {
          throw new Error("Ugyldig cellekobling.");
        }
      }
    }
    if (
      !Number.isInteger(args.expectedRevision) ||
      args.expectedRevision < 0
    ) {
      throw new Error("Ugyldig revisjon.");
    }
    const fresh = await ctx.db.get(args.analysisId);
    if (!fresh) {
      throw new Error("ROS-analysen finnes ikke.");
    }
    const serverRev = fresh.revision ?? 0;
    if (args.expectedRevision !== serverRev) {
      return {
        ok: false as const,
        conflict: {
          serverRevision: serverRev,
          updatedAt: fresh.updatedAt,
        },
      };
    }
    const now = Date.now();
    const newRev = serverRev + 1;
    await ctx.db.insert("rosAnalysisJournalEntries", {
      workspaceId: row.workspaceId,
      rosAnalysisId: args.analysisId,
      body: text,
      matrixPhase: args.matrixPhase,
      linkedRow: args.linkedRow,
      linkedCol: args.linkedCol,
      createdByUserId: userId,
      createdAt: now,
    });
    await ctx.db.patch(args.analysisId, {
      updatedAt: now,
      revision: newRev,
    });
    return { ok: true as const, revision: newRev };
  },
});

export const removeJournalEntry = mutation({
  args: { entryId: v.id("rosAnalysisJournalEntries") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const e = await ctx.db.get(args.entryId);
    if (!e) {
      throw new Error("Logginnlegg finnes ikke.");
    }
    await requireRosAnalysisEdit(ctx, e.rosAnalysisId, userId);
    await ctx.db.delete(args.entryId);
    return null;
  },
});

export const removeAnalysis = mutation({
  args: { analysisId: v.id("rosAnalyses") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireRosAnalysisEdit(ctx, args.analysisId, userId);
    await cascadeDeleteRosAnalysisData(ctx, args.analysisId);
    return null;
  },
});

export const linkAssessment = mutation({
  args: {
    analysisId: v.id("rosAnalyses"),
    assessmentId: v.id("assessments"),
    note: v.optional(v.string()),
    flags: v.optional(v.array(v.string())),
    highlightForPvv: v.optional(v.boolean()),
    pvvLinkNote: v.optional(v.string()),
    requirementRefs: v.optional(v.array(rosRequirementRefValidator)),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const analysis = await requireRosAnalysisEdit(ctx, args.analysisId, userId);
    const a = await ctx.db.get(args.assessmentId);
    if (!a || a.workspaceId !== analysis.workspaceId) {
      throw new Error("Ugyldig vurdering.");
    }
    if (!(await canReadAssessment(ctx, a, userId))) {
      throw new Error("Ingen tilgang til vurderingen.");
    }
    const existing = await ctx.db
      .query("rosAnalysisAssessments")
      .withIndex("by_ros_and_assessment", (q) =>
        q
          .eq("rosAnalysisId", args.analysisId)
          .eq("assessmentId", args.assessmentId),
      )
      .unique();
    if (existing) {
      throw new Error("Denne PVV-vurderingen er allerede koblet.");
    }
    const now = Date.now();
    const refs = args.requirementRefs?.slice(0, 48).map((r) => ({
      source: r.source,
      article: r.article?.trim() || undefined,
      note: r.note?.trim() || undefined,
      documentationUrl: r.documentationUrl?.trim() || undefined,
    }));
    return await ctx.db.insert("rosAnalysisAssessments", {
      workspaceId: analysis.workspaceId,
      rosAnalysisId: args.analysisId,
      assessmentId: args.assessmentId,
      note: args.note?.trim() || undefined,
      flags: args.flags,
      highlightForPvv: args.highlightForPvv,
      pvvLinkNote: args.pvvLinkNote?.trim() || undefined,
      requirementRefs: refs,
      createdByUserId: userId,
      createdAt: now,
    });
  },
});

export const updateRosAssessmentLink = mutation({
  args: {
    linkId: v.id("rosAnalysisAssessments"),
    note: v.optional(v.union(v.string(), v.null())),
    flags: v.optional(v.array(v.string())),
    highlightForPvv: v.optional(v.boolean()),
    pvvLinkNote: v.optional(v.union(v.string(), v.null())),
    requirementRefs: v.optional(
      v.union(v.array(rosRequirementRefValidator), v.null()),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const link = await ctx.db.get(args.linkId);
    if (!link) {
      throw new Error("Kobling finnes ikke.");
    }
    await requireRosAnalysisEdit(ctx, link.rosAnalysisId, userId);
    const patch: Record<string, unknown> = {};
    if (args.note !== undefined) {
      patch.note = args.note === null ? undefined : args.note.trim() || undefined;
    }
    if (args.flags !== undefined) {
      patch.flags = args.flags;
    }
    if (args.highlightForPvv !== undefined) {
      patch.highlightForPvv = args.highlightForPvv;
    }
    if (args.pvvLinkNote !== undefined) {
      patch.pvvLinkNote =
        args.pvvLinkNote === null ? undefined : args.pvvLinkNote.trim() || undefined;
    }
    if (args.requirementRefs !== undefined) {
      patch.requirementRefs =
        args.requirementRefs === null
          ? undefined
          : args.requirementRefs.slice(0, 48).map((r) => ({
              source: r.source,
              article: r.article?.trim() || undefined,
              note: r.note?.trim() || undefined,
              documentationUrl: r.documentationUrl?.trim() || undefined,
            }));
    }
    await ctx.db.patch(args.linkId, patch);
    return null;
  },
});

/** PVV-siden: sammendrag av koblede ROS-analyser (risiko, flagg, notat). */
export const getRosContextForAssessment = query({
  args: { assessmentId: v.id("assessments") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }
    const a = await ctx.db.get(args.assessmentId);
    if (!a) {
      return [];
    }
    await requireWorkspaceMember(ctx, a.workspaceId, userId, "viewer");
    const links = await ctx.db
      .query("rosAnalysisAssessments")
      .withIndex("by_assessment", (q) => q.eq("assessmentId", args.assessmentId))
      .collect();
    const out: Array<{
      linkId: Id<"rosAnalysisAssessments">;
      rosAnalysisId: Id<"rosAnalyses">;
      title: string;
      note: string | undefined;
      flags: string[] | undefined;
      highlightForPvv: boolean | undefined;
      pvvLinkNote: string | undefined;
      rosSummary: RosSummary;
      separateAfterLayout: boolean;
    }> = [];
    for (const l of links) {
      const ros = await ctx.db.get(l.rosAnalysisId);
      if (!ros || ros.workspaceId !== a.workspaceId) {
        continue;
      }
      const { matrixValuesAfter } = normalizedAfterMatrices(ros);
      const rosSummary = computeRosSummary({
        matrixBefore: ros.matrixValues,
        matrixAfter: matrixValuesAfter,
      });
      out.push({
        linkId: l._id,
        rosAnalysisId: ros._id,
        title: ros.title,
        note: l.note,
        flags: l.flags,
        highlightForPvv: l.highlightForPvv,
        pvvLinkNote: l.pvvLinkNote,
        rosSummary,
        separateAfterLayout: hasSeparateAfterLayout(ros),
      });
    }
    return out;
  },
});

export const unlinkAssessment = mutation({
  args: { linkId: v.id("rosAnalysisAssessments") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const link = await ctx.db.get(args.linkId);
    if (!link) {
      throw new Error("Kobling finnes ikke.");
    }
    await requireRosAnalysisEdit(ctx, link.rosAnalysisId, userId);
    await ctx.db.delete(args.linkId);
    return null;
  },
});

export const clearLegacyAssessment = mutation({
  args: { analysisId: v.id("rosAnalyses") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireRosAnalysisEdit(ctx, args.analysisId, userId);
    await ctx.db.patch(args.analysisId, { assessmentId: undefined });
    return null;
  },
});

export const migrateLegacyAssessmentToLinks = mutation({
  args: { analysisId: v.id("rosAnalyses") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const analysis = await requireRosAnalysisEdit(ctx, args.analysisId, userId);
    if (!analysis.assessmentId) {
      return null;
    }
    const aid = analysis.assessmentId;
    const existing = await ctx.db
      .query("rosAnalysisAssessments")
      .withIndex("by_ros_and_assessment", (q) =>
        q.eq("rosAnalysisId", args.analysisId).eq("assessmentId", aid),
      )
      .unique();
    const now = Date.now();
    if (!existing) {
      await ctx.db.insert("rosAnalysisAssessments", {
        workspaceId: analysis.workspaceId,
        rosAnalysisId: args.analysisId,
        assessmentId: aid,
        createdByUserId: userId,
        createdAt: now,
      });
    }
    await ctx.db.patch(args.analysisId, { assessmentId: undefined });
    return null;
  },
});

export const listVersions = query({
  args: { analysisId: v.id("rosAnalyses") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }
    if (!(await optionalRosAnalysisRead(ctx, args.analysisId, userId))) {
      return [];
    }
    const rows = await ctx.db
      .query("rosAnalysisVersions")
      .withIndex("by_ros_version", (q) =>
        q.eq("rosAnalysisId", args.analysisId),
      )
      .order("desc")
      .collect();
    return rows;
  },
});

/** Øyeblikksbilde av gjeldende analysedokument (øker versjonsnummer automatisk). */
async function insertRosAnalysisVersionSnapshot(
  ctx: MutationCtx,
  analysis: Doc<"rosAnalyses">,
  userId: Id<"users">,
  note?: string,
): Promise<{ version: number }> {
  const last = await ctx.db
    .query("rosAnalysisVersions")
    .withIndex("by_ros_version", (q) =>
      q.eq("rosAnalysisId", analysis._id),
    )
    .order("desc")
    .first();
  const next = (last?.version ?? 0) + 1;
  const now = Date.now();
  const after = normalizedAfterMatrices(analysis);
  const cellItemsSnap = normalizeCellItems(
    analysis.matrixValues,
    analysis.cellNotes,
    analysis.cellItems as RosCellItemMatrix | undefined,
  );
  await ctx.db.insert("rosAnalysisVersions", {
    workspaceId: analysis.workspaceId,
    rosAnalysisId: analysis._id,
    version: next,
    note: note || undefined,
    rowAxisTitle: analysis.rowAxisTitle,
    colAxisTitle: analysis.colAxisTitle,
    rowLabels: [...analysis.rowLabels],
    colLabels: [...analysis.colLabels],
    matrixValues: analysis.matrixValues.map((r) => [...r]),
    cellNotes: normalizeCellNotes(
      analysis.matrixValues,
      analysis.cellNotes,
    ).map((r) => [...r]),
    cellItems: cellItemsSnap.map((r) =>
      r.map((c) => c.map((x) => ({ ...x }))),
    ),
    matrixValuesAfter: after.matrixValuesAfter.map((r) => [...r]),
    cellNotesAfter: after.cellNotesAfter.map((r) => [...r]),
    cellItemsAfter: after.cellItemsAfter.map((r) =>
      r.map((c) => c.map((x) => ({ ...x }))),
    ),
    rowAxisTitleAfter: analysis.rowAxisTitleAfter,
    colAxisTitleAfter: analysis.colAxisTitleAfter,
    rowLabelsAfter: analysis.rowLabelsAfter
      ? [...analysis.rowLabelsAfter]
      : undefined,
    colLabelsAfter: analysis.colLabelsAfter
      ? [...analysis.colLabelsAfter]
      : undefined,
    notes: analysis.notes,
    methodologyStatement: analysis.methodologyStatement,
    contextSummary: analysis.contextSummary,
    scopeAndCriteria: analysis.scopeAndCriteria,
    riskCriteriaVersion: analysis.riskCriteriaVersion,
    axisScaleNotes: analysis.axisScaleNotes,
    complianceScopeTags: analysis.complianceScopeTags
      ? [...analysis.complianceScopeTags]
      : undefined,
    requirementRefs: analysis.requirementRefs
      ? analysis.requirementRefs.map((r) => ({ ...r }))
      : undefined,
    createdByUserId: userId,
    createdAt: now,
  });
  return { version: next };
}

export const createVersion = mutation({
  args: {
    analysisId: v.id("rosAnalyses"),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const analysis = await requireRosAnalysisEdit(ctx, args.analysisId, userId);
    return await insertRosAnalysisVersionSnapshot(
      ctx,
      analysis,
      userId,
      args.note?.trim() || undefined,
    );
  },
});

export const restoreVersion = mutation({
  args: {
    analysisId: v.id("rosAnalyses"),
    version: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireRosAnalysisEdit(ctx, args.analysisId, userId);
    const ver = await ctx.db
      .query("rosAnalysisVersions")
      .withIndex("by_ros_version", (q) =>
        q.eq("rosAnalysisId", args.analysisId).eq("version", args.version),
      )
      .unique();
    if (!ver) {
      throw new Error("Fant ikke denne versjonen.");
    }
    const now = Date.now();
    const current = await ctx.db.get(args.analysisId);
    const pseudo = {
      ...current!,
      rowAxisTitle: ver.rowAxisTitle,
      colAxisTitle: ver.colAxisTitle,
      rowLabels: ver.rowLabels,
      colLabels: ver.colLabels,
      rowAxisTitleAfter: ver.rowAxisTitleAfter,
      colAxisTitleAfter: ver.colAxisTitleAfter,
      rowLabelsAfter: ver.rowLabelsAfter,
      colLabelsAfter: ver.colLabelsAfter,
    } as Doc<"rosAnalyses">;
    const dim = afterDimensions(pseudo);
    const mvAfter =
      ver.matrixValuesAfter &&
      ver.matrixValuesAfter.length === dim.rows &&
      (ver.matrixValuesAfter[0]?.length ?? 0) === dim.cols
        ? ver.matrixValuesAfter.map((r) => [...r])
        : emptyMatrix(dim.rows, dim.cols);
    const cellNotesAfter = normalizeCellNotes(mvAfter, ver.cellNotesAfter).map(
      (r) => [...r],
    );
    const cellItems = normalizeCellItems(
      ver.matrixValues,
      ver.cellNotes,
      ver.cellItems as RosCellItemMatrix | undefined,
    );
    const cellItemsAfter = normalizeCellItems(
      mvAfter,
      ver.cellNotesAfter,
      ver.cellItemsAfter as RosCellItemMatrix | undefined,
    );
    const prevRev = current?.revision ?? 0;
    await ctx.db.patch(args.analysisId, {
      rowAxisTitle: ver.rowAxisTitle,
      colAxisTitle: ver.colAxisTitle,
      rowLabels: [...ver.rowLabels],
      colLabels: [...ver.colLabels],
      matrixValues: ver.matrixValues.map((r) => [...r]),
      cellNotes: normalizeCellNotes(ver.matrixValues, ver.cellNotes).map((r) => [
        ...r,
      ]),
      cellItems: cellItems.map((r) => r.map((c) => c.map((x) => ({ ...x })))),
      matrixValuesAfter: mvAfter,
      cellNotesAfter,
      cellItemsAfter: cellItemsAfter.map((r) =>
        r.map((c) => c.map((x) => ({ ...x }))),
      ),
      rowAxisTitleAfter: ver.rowAxisTitleAfter,
      colAxisTitleAfter: ver.colAxisTitleAfter,
      rowLabelsAfter: ver.rowLabelsAfter
        ? [...ver.rowLabelsAfter]
        : undefined,
      colLabelsAfter: ver.colLabelsAfter
        ? [...ver.colLabelsAfter]
        : undefined,
      notes: ver.notes,
      methodologyStatement: ver.methodologyStatement,
      contextSummary: ver.contextSummary,
      scopeAndCriteria: ver.scopeAndCriteria,
      riskCriteriaVersion: ver.riskCriteriaVersion,
      axisScaleNotes: ver.axisScaleNotes,
      complianceScopeTags: ver.complianceScopeTags
        ? [...ver.complianceScopeTags]
        : undefined,
      requirementRefs: ver.requirementRefs
        ? ver.requirementRefs.map((r) => ({ ...r }))
        : undefined,
      updatedAt: now,
      revision: prevRev + 1,
    });
    return null;
  },
});

/** Enkeltversjon for forhåndsvisning (uten full matrise til klienten). */
export const getRosAnalysisVersion = query({
  args: {
    analysisId: v.id("rosAnalyses"),
    version: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }
    if (!(await optionalRosAnalysisRead(ctx, args.analysisId, userId))) {
      return null;
    }
    const ver = await ctx.db
      .query("rosAnalysisVersions")
      .withIndex("by_ros_version", (q) =>
        q.eq("rosAnalysisId", args.analysisId).eq("version", args.version),
      )
      .unique();
    if (!ver) {
      return null;
    }
    const rows = ver.matrixValues.length;
    const cols = ver.matrixValues[0]?.length ?? 0;
    return {
      version: ver.version,
      note: ver.note,
      createdAt: ver.createdAt,
      rowAxisTitle: ver.rowAxisTitle,
      colAxisTitle: ver.colAxisTitle,
      rows,
      cols,
      hasAfterMatrix: Boolean(
        ver.matrixValuesAfter && ver.matrixValuesAfter.length > 0,
      ),
    };
  },
});

export const deleteRosAnalysisVersion = mutation({
  args: {
    analysisId: v.id("rosAnalyses"),
    version: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireRosAnalysisEdit(ctx, args.analysisId, userId);
    const ver = await ctx.db
      .query("rosAnalysisVersions")
      .withIndex("by_ros_version", (q) =>
        q.eq("rosAnalysisId", args.analysisId).eq("version", args.version),
      )
      .unique();
    if (!ver) {
      throw new Error("Fant ikke denne versjonen.");
    }
    await ctx.db.delete(ver._id);
    return null;
  },
});

export const listTasksByRosAnalysis = query({
  args: { analysisId: v.id("rosAnalyses") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }
    if (!(await optionalRosAnalysisRead(ctx, args.analysisId, userId))) {
      return [];
    }
    const rows = await ctx.db
      .query("rosTasks")
      .withIndex("by_ros_analysis", (q) =>
        q.eq("rosAnalysisId", args.analysisId),
      )
      .collect();
    rows.sort((a, b) => {
      if (a.status !== b.status) {
        return a.status === "open" ? -1 : 1;
      }
      const pa = clampRosPriority(a.priority);
      const pb = clampRosPriority(b.priority);
      if (pa !== pb) return pa - pb;
      return (a.dashboardRank ?? a.createdAt) - (b.dashboardRank ?? b.createdAt);
    });
    const out = [];
    for (const r of rows) {
      out.push(await enrichRosTask(ctx, r));
    }
    return out;
  },
});

export const createRosTask = mutation({
  args: {
    analysisId: v.id("rosAnalyses"),
    title: v.string(),
    description: v.optional(v.string()),
    assigneeUserId: v.optional(v.id("users")),
    priority: v.optional(v.number()),
    dueAt: v.optional(v.number()),
    /** Kobling til risiko-/tiltakspunkt (anbefalt) */
    linkedCellItemId: v.optional(v.string()),
    linkedCellItemPhase: v.optional(
      v.union(v.literal("before"), v.literal("after")),
    ),
    matrixRow: v.optional(v.number()),
    matrixCol: v.optional(v.number()),
    matrixPhase: v.optional(
      v.union(v.literal("before"), v.literal("after")),
    ),
    riskTreatmentKind: v.optional(
      v.union(
        v.literal("mitigate"),
        v.literal("accept"),
        v.literal("transfer"),
        v.literal("avoid"),
      ),
    ),
    residualRiskAcceptedNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const analysis = await requireRosAnalysisEdit(ctx, args.analysisId, userId);
    const title = args.title.trim();
    if (!title) {
      throw new Error("Oppgavetekst mangler.");
    }
    const linkId = args.linkedCellItemId?.trim();
    const hasRiskLink =
      Boolean(linkId) && args.linkedCellItemPhase !== undefined;
    if (linkId && args.linkedCellItemPhase === undefined) {
      throw new Error("Velg fase (før eller etter tiltak) for risikokobling.");
    }
    if (!linkId && args.linkedCellItemPhase !== undefined) {
      throw new Error("Mangler risiko-/tiltak-ID for kobling.");
    }
    if (hasRiskLink && linkId) {
      const found = findRosCellItemInAnalysis(
        analysis,
        linkId,
        args.linkedCellItemPhase!,
      );
      if (!found) {
        throw new Error(
          "Fant ikke dette risiko-/tiltakspunktet i analysen. Oppdater siden og prøv igjen.",
        );
      }
    }
    const hasCell =
      !hasRiskLink &&
      args.matrixRow !== undefined &&
      args.matrixCol !== undefined;
    if (
      !hasRiskLink &&
      (args.matrixRow !== undefined) !== (args.matrixCol !== undefined)
    ) {
      throw new Error("Oppgi både rad og kolonne for cellekobling, eller ingen.");
    }
    if (hasCell) {
      if (args.matrixPhase === undefined) {
        throw new Error("Velg fase (før eller etter tiltak) for cellekobling.");
      }
      const dim = afterDimensions(analysis);
      const rows =
        args.matrixPhase === "after" ? dim.rows : analysis.rowLabels.length;
      const cols =
        args.matrixPhase === "after" ? dim.cols : analysis.colLabels.length;
      const i = args.matrixRow!;
      const j = args.matrixCol!;
      if (i < 0 || j < 0 || i >= rows || j >= cols) {
        throw new Error("Ugyldig cellekobling for oppgave.");
      }
    }
    const now = Date.now();
    return await ctx.db.insert("rosTasks", {
      workspaceId: analysis.workspaceId,
      rosAnalysisId: args.analysisId,
      title,
      description: args.description?.trim() || undefined,
      assigneeUserId: args.assigneeUserId,
      createdByUserId: userId,
      status: "open",
      priority: clampRosPriority(args.priority),
      dueAt: args.dueAt,
      linkedCellItemId: hasRiskLink ? linkId : undefined,
      linkedCellItemPhase: hasRiskLink
        ? args.linkedCellItemPhase
        : undefined,
      matrixRow: hasRiskLink ? undefined : hasCell ? args.matrixRow : undefined,
      matrixCol: hasRiskLink ? undefined : hasCell ? args.matrixCol : undefined,
      matrixPhase: hasRiskLink ? undefined : hasCell ? args.matrixPhase : undefined,
      riskTreatmentKind: args.riskTreatmentKind,
      residualRiskAcceptedAt:
        args.riskTreatmentKind === "accept" ? now : undefined,
      residualRiskAcceptedNote:
        args.riskTreatmentKind === "accept"
          ? args.residualRiskAcceptedNote?.trim() || undefined
          : undefined,
      dashboardRank: now,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateRosTask = mutation({
  args: {
    taskId: v.id("rosTasks"),
    title: v.optional(v.string()),
    description: v.optional(v.union(v.string(), v.null())),
    assigneeUserId: v.optional(v.union(v.id("users"), v.null())),
    priority: v.optional(v.number()),
    dueAt: v.optional(v.union(v.number(), v.null())),
    status: v.optional(v.union(v.literal("open"), v.literal("done"))),
    linkedCellItemId: v.optional(v.union(v.string(), v.null())),
    linkedCellItemPhase: v.optional(
      v.union(v.literal("before"), v.literal("after"), v.null()),
    ),
    matrixRow: v.optional(v.union(v.number(), v.null())),
    matrixCol: v.optional(v.union(v.number(), v.null())),
    matrixPhase: v.optional(
      v.union(v.literal("before"), v.literal("after"), v.null()),
    ),
    riskTreatmentKind: v.optional(
      v.union(
        v.literal("mitigate"),
        v.literal("accept"),
        v.literal("transfer"),
        v.literal("avoid"),
        v.null(),
      ),
    ),
    residualRiskAcceptedAt: v.optional(v.union(v.number(), v.null())),
    residualRiskAcceptedNote: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const row = await ctx.db.get(args.taskId);
    if (!row) {
      throw new Error("Fant ikke oppgaven.");
    }
    const analysis = await requireRosAnalysisEdit(ctx, row.rosAnalysisId, userId);
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.title !== undefined) {
      const t = args.title.trim();
      if (!t) throw new Error("Tittel kan ikke være tom.");
      patch.title = t;
    }
    if (args.description !== undefined) {
      patch.description =
        args.description === null ? undefined : args.description.trim() || undefined;
    }
    if (args.assigneeUserId !== undefined) {
      patch.assigneeUserId =
        args.assigneeUserId === null ? undefined : args.assigneeUserId;
    }
    if (args.priority !== undefined) {
      patch.priority = clampRosPriority(args.priority);
    }
    if (args.dueAt !== undefined) {
      patch.dueAt = args.dueAt === null ? undefined : args.dueAt;
    }
    if (args.status !== undefined) {
      patch.status = args.status;
    }
    if (
      args.linkedCellItemId !== undefined ||
      args.linkedCellItemPhase !== undefined
    ) {
      const lidIn =
        args.linkedCellItemId !== undefined
          ? args.linkedCellItemId
          : row.linkedCellItemId;
      const lphIn =
        args.linkedCellItemPhase !== undefined
          ? args.linkedCellItemPhase
          : row.linkedCellItemPhase;
      const trimmed =
        lidIn === null || lidIn === undefined ? "" : lidIn.trim();
      const explicitClear =
        args.linkedCellItemId === null ||
        args.linkedCellItemPhase === null ||
        (args.linkedCellItemId !== undefined && trimmed === "");
      if (explicitClear) {
        patch.linkedCellItemId = undefined;
        patch.linkedCellItemPhase = undefined;
      } else if (trimmed && lphIn !== null && lphIn !== undefined) {
        const found = findRosCellItemInAnalysis(analysis, trimmed, lphIn);
        if (!found) {
          throw new Error("Fant ikke risiko-/tiltakspunktet i analysen.");
        }
        patch.linkedCellItemId = trimmed;
        patch.linkedCellItemPhase = lphIn;
        patch.matrixRow = undefined;
        patch.matrixCol = undefined;
        patch.matrixPhase = undefined;
      } else if (trimmed && (lphIn === null || lphIn === undefined)) {
        throw new Error("Velg fase (før/etter tiltak) for risikokobling.");
      } else if (!trimmed && lphIn !== null && lphIn !== undefined) {
        throw new Error("Velg hvilket risiko-/tiltakspunkt oppgaven gjelder.");
      }
    }
    if (
      args.matrixRow !== undefined ||
      args.matrixCol !== undefined ||
      args.matrixPhase !== undefined
    ) {
      const mr =
        args.matrixRow !== undefined
          ? args.matrixRow
          : row.matrixRow ?? null;
      const mc =
        args.matrixCol !== undefined
          ? args.matrixCol
          : row.matrixCol ?? null;
      const mp =
        args.matrixPhase !== undefined
          ? args.matrixPhase
          : row.matrixPhase ?? null;
      const hasCell = mr !== null && mc !== null && mp !== null;
      if ((mr !== null) !== (mc !== null) || (mr !== null && mp === null)) {
        throw new Error("Oppgi rad, kolonne og fase sammen for cellekobling.");
      }
      if (hasCell && mr !== null && mc !== null && mp !== null) {
        const dim = afterDimensions(analysis);
        const rows = mp === "after" ? dim.rows : analysis.rowLabels.length;
        const cols = mp === "after" ? dim.cols : analysis.colLabels.length;
        if (mr < 0 || mc < 0 || mr >= rows || mc >= cols) {
          throw new Error("Ugyldig cellekobling.");
        }
        patch.matrixRow = mr;
        patch.matrixCol = mc;
        patch.matrixPhase = mp;
      } else {
        patch.matrixRow = undefined;
        patch.matrixCol = undefined;
        patch.matrixPhase = undefined;
      }
    }
    if (args.riskTreatmentKind !== undefined) {
      if (args.riskTreatmentKind === null) {
        patch.riskTreatmentKind = undefined;
        patch.residualRiskAcceptedAt = undefined;
        patch.residualRiskAcceptedNote = undefined;
      } else {
        patch.riskTreatmentKind = args.riskTreatmentKind;
        if (args.riskTreatmentKind === "accept") {
          patch.residualRiskAcceptedAt =
            args.residualRiskAcceptedAt !== undefined
              ? args.residualRiskAcceptedAt === null
                ? undefined
                : args.residualRiskAcceptedAt
              : row.residualRiskAcceptedAt ?? Date.now();
          patch.residualRiskAcceptedNote =
            args.residualRiskAcceptedNote !== undefined
              ? args.residualRiskAcceptedNote === null
                ? undefined
                : args.residualRiskAcceptedNote.trim() || undefined
              : row.residualRiskAcceptedNote;
        } else {
          patch.residualRiskAcceptedAt = undefined;
          patch.residualRiskAcceptedNote = undefined;
        }
      }
    } else if (args.residualRiskAcceptedNote !== undefined) {
      patch.residualRiskAcceptedNote =
        args.residualRiskAcceptedNote === null
          ? undefined
          : args.residualRiskAcceptedNote.trim() || undefined;
    } else if (args.residualRiskAcceptedAt !== undefined) {
      patch.residualRiskAcceptedAt =
        args.residualRiskAcceptedAt === null
          ? undefined
          : args.residualRiskAcceptedAt;
    }
    await ctx.db.patch(args.taskId, patch);
    return null;
  },
});

export const removeRosTask = mutation({
  args: { taskId: v.id("rosTasks") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const row = await ctx.db.get(args.taskId);
    if (!row) {
      throw new Error("Fant ikke oppgaven.");
    }
    await requireRosAnalysisEdit(ctx, row.rosAnalysisId, userId);
    await ctx.db.delete(args.taskId);
    return null;
  },
});

export const setRosTaskStatus = mutation({
  args: {
    taskId: v.id("rosTasks"),
    status: v.union(v.literal("open"), v.literal("done")),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const row = await ctx.db.get(args.taskId);
    if (!row) {
      throw new Error("Fant ikke oppgaven.");
    }
    await requireRosAnalysisEdit(ctx, row.rosAnalysisId, userId);
    await ctx.db.patch(args.taskId, {
      status: args.status,
      updatedAt: Date.now(),
    });
    return null;
  },
});
