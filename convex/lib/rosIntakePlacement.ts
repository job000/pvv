import {
  emptyCellItemsMatrix,
  flattenCellItemsToNote,
  ROS_CELL_FLAG_REQUIRES_ACTION,
  type RosCellItemMatrix,
} from "../../lib/ros-cell-items";
import { isRpaIntakeRosTemplate } from "../../lib/ros-defaults";

export type IntakeRiskForPlacement = {
  id: string;
  title: string;
  description: string;
  severity: number;
  source?: "rosConsequence" | "rosRiskDescription" | "personal_data" | "other";
};

function clampSeverity(n: number): number {
  if (!Number.isFinite(n)) return 3;
  return Math.max(1, Math.min(5, Math.round(n)));
}

function rpaRowForSource(source: IntakeRiskForPlacement["source"]): number {
  switch (source) {
    case "rosRiskDescription":
      return 2;
    case "personal_data":
      return 3;
    case "rosConsequence":
    case "other":
    default:
      return 0;
  }
}

/**
 * Plasserer inntaksrisiko i ROS-celler: RPA-mal bruker kilde→rad; andre maler bruker sannsynlighet×konsekvens-diagonal.
 * Oppdaterer matrixValues med minst risikonivå per fylt celle.
 */
export function placeIntakeRisksOnRosMatrix(
  risks: IntakeRiskForPlacement[],
  rowLabels: string[],
  colLabels: string[],
  baseMatrixValues: number[][],
  extraFlags: string[],
): {
  cellItems: RosCellItemMatrix;
  cellNotes: string[][];
  matrixValues: number[][];
} {
  const rowCount = rowLabels.length;
  const colCount = colLabels.length;
  const useRpaRows = isRpaIntakeRosTemplate(rowLabels);

  const cellItems = emptyCellItemsMatrix(rowCount, colCount);
  const matrixValues = baseMatrixValues.map((row) => [...row]);

  for (const risk of risks) {
    const sev = clampSeverity(risk.severity);
    const col = Math.max(0, Math.min(colCount - 1, sev - 1));
    let row: number;
    if (useRpaRows) {
      row = Math.max(0, Math.min(rowCount - 1, rpaRowForSource(risk.source)));
    } else {
      row = Math.max(0, Math.min(rowCount - 1, sev - 1));
    }

    const flags = [...extraFlags];
    if (sev >= 4 && !flags.includes(ROS_CELL_FLAG_REQUIRES_ACTION)) {
      flags.push(ROS_CELL_FLAG_REQUIRES_ACTION);
    }

    const text = `${risk.title}: ${risk.description}`.trim();
    cellItems[row][col].push({
      id: risk.id,
      text,
      flags: flags.length > 0 ? flags : undefined,
    });

    const prev = matrixValues[row]?.[col] ?? 0;
    const nextVal = Math.max(prev, sev);
    if (!matrixValues[row]) {
      matrixValues[row] = Array.from({ length: colCount }, () => 0);
    }
    matrixValues[row][col] = nextVal;
  }

  const cellNotes: string[][] = [];
  for (let r = 0; r < rowCount; r++) {
    const noteRow: string[] = [];
    for (let c = 0; c < colCount; c++) {
      noteRow.push(flattenCellItemsToNote(cellItems[r][c]));
    }
    cellNotes.push(noteRow);
  }

  return { cellItems, cellNotes, matrixValues };
}
