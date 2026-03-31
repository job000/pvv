/**
 * Flere risiko-/begrunnelse-punkter per matrise-celle (før/etter ROS).
 * Bakoverkompatibel med enkelt `cellNotes`-streng per celle.
 *
 * Type: `matrix[row][col][itemIndex]` = RosCellItem.
 */

export type RosCellItem = {
  id: string;
  text: string;
  /** f.eks. watch, requires_action */
  flags?: string[];
  /** Rad i etter-tiltak matrisen dette punktet er plassert (kun relevant på før-tiltak items) */
  afterRow?: number;
  /** Kolonne i etter-tiltak matrisen */
  afterCol?: number;
  /** ID-referanse til opprinnnelig før-tiltak item (kun på etter-tiltak items) */
  sourceItemId?: string;
};

/** Rad × kolonne × punkter i cellen (eksplisitt — ikke forveksle med RosCellItem[][]) */
export type RosCellItemMatrix = Array<Array<RosCellItem[]>>;

export const ROS_CELL_FLAG_WATCH = "watch";
export const ROS_CELL_FLAG_REQUIRES_ACTION = "requires_action";

export function newRosCellItemId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `ros_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

export function emptyCellItemsMatrix(
  rows: number,
  cols: number,
): RosCellItemMatrix {
  const out: RosCellItemMatrix = [];
  for (let i = 0; i < rows; i++) {
    const row: Array<RosCellItem[]> = [];
    for (let j = 0; j < cols; j++) {
      row.push([]);
    }
    out.push(row);
  }
  return out;
}

/** Slår sammen flere punkter til én streng for PDF / eldre felt. */
export function flattenCellItemsToNote(cell: RosCellItem[]): string {
  return cell
    .map((it) => it.text.trim())
    .filter(Boolean)
    .join("\n\n");
}

export function flattenCellItemsMatrixToLegacyNotes(
  items: RosCellItemMatrix,
): string[][] {
  return items.map((row) => row.map((cell) => flattenCellItemsToNote(cell)));
}

/**
 * Bygger cellItems fra lagret struktur eller fra eldre cellNotes (én streng per celle).
 */
export function normalizeCellItems(
  matrix: number[][],
  legacyNotes: string[][] | undefined,
  stored: RosCellItemMatrix | undefined,
): RosCellItemMatrix {
  const rows = matrix.length;
  const out: RosCellItemMatrix = [];
  for (let i = 0; i < rows; i++) {
    const cols = matrix[i]?.length ?? 0;
    const row: Array<RosCellItem[]> = [];
    for (let j = 0; j < cols; j++) {
      const fromStore = stored?.[i]?.[j];
      if (fromStore && fromStore.length > 0) {
        row.push(
          fromStore.map((it) => ({
            id: it.id || newRosCellItemId(),
            text: it.text ?? "",
            flags: it.flags?.length ? [...it.flags] : undefined,
            afterRow: it.afterRow,
            afterCol: it.afterCol,
            sourceItemId: it.sourceItemId,
          })),
        );
      } else {
        const legacy = legacyNotes?.[i]?.[j]?.trim();
        row.push(
          legacy
            ? [{ id: newRosCellItemId(), text: legacy }]
            : [],
        );
      }
    }
    out.push(row);
  }
  return out;
}

export function resizeCellItemsMatrix(
  old: RosCellItemMatrix | undefined,
  oldR: number,
  oldC: number,
  newR: number,
  newC: number,
): RosCellItemMatrix {
  const prev = old ?? emptyCellItemsMatrix(oldR, oldC);
  const out: RosCellItemMatrix = [];
  for (let i = 0; i < newR; i++) {
    const row: Array<RosCellItem[]> = [];
    for (let j = 0; j < newC; j++) {
      if (i < oldR && j < oldC) {
        const cell = prev[i]?.[j];
        row.push(cell ? cell.map((x) => ({ ...x })) : []);
      } else {
        row.push([]);
      }
    }
    out.push(row);
  }
  return out;
}

export function cellHasAttention(
  level: number,
  items: RosCellItem[],
): {
  reasons: Array<"level_ge_4" | "watch" | "requires_action">;
  flaggedTexts: string[];
} {
  const reasons: Array<"level_ge_4" | "watch" | "requires_action"> = [];
  const flaggedTexts: string[] = [];
  if (level >= 4) {
    reasons.push("level_ge_4");
  }
  for (const it of items) {
    const t = it.text.trim();
    const f = it.flags ?? [];
    if (f.includes(ROS_CELL_FLAG_WATCH)) {
      if (!reasons.includes("watch")) reasons.push("watch");
      if (t) flaggedTexts.push(t);
    }
    if (f.includes(ROS_CELL_FLAG_REQUIRES_ACTION)) {
      if (!reasons.includes("requires_action")) reasons.push("requires_action");
      if (t && !flaggedTexts.includes(t)) flaggedTexts.push(t);
    }
  }
  return { reasons, flaggedTexts };
}
