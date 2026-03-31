/**
 * Flater ut matrise + cellepunkter til en liste (som risikoregister i ROS-dokumenter).
 */

import type { RosCellItem, RosCellItemMatrix } from "./ros-cell-items";

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

export function phaseLabelNb(phase: RiskRegisterPhase): string {
  return phase === "before" ? "Før tiltak" : "Etter tiltak (rest)";
}
