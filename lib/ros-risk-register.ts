/**
 * Flater ut matrise + cellepunkter til en liste (som risikoregister i ROS-dokumenter).
 * Støtter også paret før/etter-visning for å vise risikoreduksjon per celle.
 */

import {
  ROS_CELL_FLAG_REQUIRES_ACTION,
  type RosCellItem,
  type RosCellItemMatrix,
} from "./ros-cell-items";
import { positionRiskLevel } from "./ros-defaults";

export type RiskRegisterPhase = "before" | "after";

export type RiskRegisterRow = {
  phase: RiskRegisterPhase;
  row: number;
  col: number;
  rowLabel: string;
  colLabel: string;
  level: number;
  /** Tekst fra punkter i cellen */
  itemTexts: string[];
};

/** Paret rad som viser én celleposisjon med før- og etter-nivå side om side. */
export type PairedRiskRegisterRow = {
  row: number;
  col: number;
  rowLabel: string;
  colLabel: string;
  beforeLevel: number;
  afterLevel: number;
  /** Negativ = redusert (bra), positiv = økt, 0 = uendret */
  delta: number;
  deltaKind: "improved" | "worse" | "unchanged" | "new" | "removed";
  beforeTexts: string[];
  afterTexts: string[];
  beforeItems: RosCellItem[];
  afterItems: RosCellItem[];
};

function cellItemTexts(cell: RosCellItem[] | undefined): string[] {
  if (!cell?.length) return [];
  return cell
    .map((it) => it.text.trim())
    .filter(Boolean);
}

/**
 * Én rad per celle som har nivå > 0 eller minst ett tekstpunkter.
 */
export function buildRiskRegisterRows(input: {
  phase: RiskRegisterPhase;
  rowLabels: string[];
  colLabels: string[];
  matrixValues: number[][];
  cellItems: RosCellItemMatrix;
}): RiskRegisterRow[] {
  const { phase, rowLabels, colLabels, matrixValues, cellItems } = input;
  const out: RiskRegisterRow[] = [];
  const rows = matrixValues.length;
  for (let i = 0; i < rows; i++) {
    const cols = matrixValues[i]?.length ?? 0;
    for (let j = 0; j < cols; j++) {
      const level = matrixValues[i]?.[j] ?? 0;
      const items = cellItems[i]?.[j];
      const itemTexts = cellItemTexts(items);
      if (level <= 0 && itemTexts.length === 0) continue;
      out.push({
        phase,
        row: i,
        col: j,
        rowLabel: rowLabels[i] ?? `Rad ${i + 1}`,
        colLabel: colLabels[j] ?? `Kol ${j + 1}`,
        level,
        itemTexts,
      });
    }
  }
  out.sort((a, b) => {
    if (b.level !== a.level) return b.level - a.level;
    if (a.row !== b.row) return a.row - b.row;
    return a.col - b.col;
  });
  return out;
}

/**
 * Bygger paret register: matcher celler (rad,kol) fra før/etter og beregner delta.
 * Kun tilgjengelig når matrisene har samme layout (sameLayout = true).
 */
export function buildPairedRiskRegisterRows(input: {
  rowLabels: string[];
  colLabels: string[];
  matrixBefore: number[][];
  matrixAfter: number[][];
  cellItemsBefore: RosCellItemMatrix;
  cellItemsAfter: RosCellItemMatrix;
}): PairedRiskRegisterRow[] {
  const {
    rowLabels,
    colLabels,
    matrixBefore,
    matrixAfter,
    cellItemsBefore,
    cellItemsAfter,
  } = input;
  const out: PairedRiskRegisterRow[] = [];
  const rows = matrixBefore.length;

  for (let i = 0; i < rows; i++) {
    const cols = matrixBefore[i]?.length ?? 0;
    for (let j = 0; j < cols; j++) {
      const bLevel = matrixBefore[i]?.[j] ?? 0;
      const aLevel = matrixAfter[i]?.[j] ?? 0;
      const bItems = cellItemsBefore[i]?.[j] ?? [];
      const aItems = cellItemsAfter[i]?.[j] ?? [];
      const bTexts = cellItemTexts(bItems);
      const aTexts = cellItemTexts(aItems);

      if (bLevel <= 0 && aLevel <= 0 && bTexts.length === 0 && aTexts.length === 0) {
        continue;
      }

      const delta = aLevel - bLevel;
      let deltaKind: PairedRiskRegisterRow["deltaKind"];
      if (bLevel > 0 && aLevel > 0) {
        deltaKind = delta < 0 ? "improved" : delta > 0 ? "worse" : "unchanged";
      } else if (bLevel <= 0 && aLevel > 0) {
        deltaKind = "new";
      } else if (bLevel > 0 && aLevel <= 0) {
        deltaKind = "removed";
      } else {
        deltaKind = "unchanged";
      }

      out.push({
        row: i,
        col: j,
        rowLabel: rowLabels[i] ?? `Rad ${i + 1}`,
        colLabel: colLabels[j] ?? `Kol ${j + 1}`,
        beforeLevel: bLevel,
        afterLevel: aLevel,
        delta,
        deltaKind,
        beforeTexts: bTexts,
        afterTexts: aTexts,
        beforeItems: bItems,
        afterItems: aItems,
      });
    }
  }

  out.sort((a, b) => {
    const kindOrder = { worse: 0, unchanged: 1, new: 2, improved: 3, removed: 4 };
    const ka = kindOrder[a.deltaKind];
    const kb = kindOrder[b.deltaKind];
    if (ka !== kb) return ka - kb;
    if (b.beforeLevel !== a.beforeLevel) return b.beforeLevel - a.beforeLevel;
    if (a.row !== b.row) return a.row - b.row;
    return a.col - b.col;
  });

  return out;
}

/** Oppsummering av paret register for visning. */
export type PairedSummaryStats = {
  total: number;
  improved: number;
  worse: number;
  unchanged: number;
  newRisks: number;
  removed: number;
  highBefore: number;
  highAfter: number;
};

export function pairedSummaryStats(
  rows: PairedRiskRegisterRow[],
): PairedSummaryStats {
  let improved = 0;
  let worse = 0;
  let unchanged = 0;
  let newRisks = 0;
  let removed = 0;
  let highBefore = 0;
  let highAfter = 0;
  for (const r of rows) {
    switch (r.deltaKind) {
      case "improved": improved++; break;
      case "worse": worse++; break;
      case "unchanged": unchanged++; break;
      case "new": newRisks++; break;
      case "removed": removed++; break;
    }
    if (r.beforeLevel >= 4) highBefore++;
    if (r.afterLevel >= 4) highAfter++;
  }
  return {
    total: rows.length,
    improved,
    worse,
    unchanged,
    newRisks,
    removed,
    highBefore,
    highAfter,
  };
}

export function phaseLabelNb(phase: RiskRegisterPhase): string {
  return phase === "before" ? "Før tiltak" : "Etter tiltak (rest)";
}

/** Teller risikopunkter (celle-items med fritekst) og tilhørende nivåer — for oversikts-KPI. */
export type MatrixItemStats = {
  /** Antall punkter med ikke-tom beskrivelse */
  textItemCount: number;
  /** Punkter der plassering gir nivå ≥ 4 før tiltak */
  highOrCriticalBefore: number;
  /** Punkter der plassering gir nivå 5 før tiltak */
  criticalBefore: number;
  /** Høy risiko uten «krever handling» */
  needsAction: number;
  /** Punkter der restrisiko (etter) er ≥ 4 */
  highAfter: number;
};

/**
 * Bruker samme logikk som tidligere «RiskSummaryBar»: nivå fra celleposisjon (sannsynlighet × konsekvens),
 * restrisiko fra punktets etter-plassering eller samme celle.
 */
export function computeMatrixItemStats(
  cellItemsMatrix: RosCellItemMatrix,
  rowLabels: string[],
  colLabels: string[],
  afterRowLabels: string[],
  afterColLabels: string[],
): MatrixItemStats {
  let textItemCount = 0;
  let highOrCriticalBefore = 0;
  let criticalBefore = 0;
  let needsAction = 0;
  let highAfter = 0;
  const br = rowLabels.length;
  const bc = colLabels.length;
  const ar = afterRowLabels.length;
  const ac = afterColLabels.length;

  for (let r = 0; r < cellItemsMatrix.length; r++) {
    const row = cellItemsMatrix[r];
    if (!row) continue;
    for (let c = 0; c < row.length; c++) {
      const cell = row[c];
      if (!cell) continue;
      for (const it of cell) {
        if (!it.text.trim()) continue;
        textItemCount++;
        const bLvl = positionRiskLevel(r, c, br, bc);
        if (bLvl >= 4) highOrCriticalBefore++;
        if (bLvl >= 5) criticalBefore++;
        const hasFlag = it.flags?.includes(ROS_CELL_FLAG_REQUIRES_ACTION);
        if (bLvl >= 4 && !hasFlag) needsAction++;
        const aRow = it.afterRow ?? r;
        const aCol = it.afterCol ?? c;
        const aLvl = positionRiskLevel(aRow, aCol, ar, ac);
        if (aLvl >= 4) highAfter++;
      }
    }
  }

  return {
    textItemCount,
    highOrCriticalBefore,
    criticalBefore,
    needsAction,
    highAfter,
  };
}

export function maxMatrixLevel(matrixValues: number[][]): number {
  let m = 0;
  for (const row of matrixValues) {
    for (const v of row ?? []) {
      if (v > m) m = v;
    }
  }
  return m;
}
