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
  /** Hvorfor endret risikonivået seg etter tiltak (ned/opp/beholdt + begrunnelse) */
  afterChangeNote?: string;
  /** Økonomisk størrelsesorden (valgfritt) */
  economicBand?: string;
  /** Frekvens / tidshorisont (valgfritt) */
  frequencyBand?: string;
};

/** Kort i kortlager (før/etter) — ikke plassert i matrise */
export type RosPoolItem = {
  id: string;
  text: string;
  flags?: string[];
  economicBand?: string;
  frequencyBand?: string;
  status: "unplaced" | "on_hold" | "not_relevant";
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

export function newRosPoolItem(
  text: string,
  status: RosPoolItem["status"] = "unplaced",
): RosPoolItem {
  return {
    id: newRosCellItemId(),
    text,
    status,
  };
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

/** Én linje per punkt — inkl. flagg (tiltak/følg) selv om beskrivelse er tom. */
function cellItemToNoteLine(it: RosCellItem): string {
  const t = it.text.trim();
  const tags: string[] = [];
  if (it.flags?.includes(ROS_CELL_FLAG_REQUIRES_ACTION)) {
    tags.push("Må håndteres (tiltak)");
  }
  if (it.flags?.includes(ROS_CELL_FLAG_WATCH)) {
    tags.push("Følg med");
  }
  const bands: string[] = [];
  if (it.economicBand?.trim()) bands.push(`Økonomi: ${it.economicBand.trim()}`);
  if (it.frequencyBand?.trim()) bands.push(`Frekvens: ${it.frequencyBand.trim()}`);
  const bandSuffix = bands.length ? ` [${bands.join("; ")}]` : "";
  if (tags.length > 0 && t) {
    return `${tags.join(" · ")}: ${t}${bandSuffix}`;
  }
  if (tags.length > 0) {
    return `${tags.join(" · ")}${bandSuffix}`;
  }
  return t + bandSuffix;
}

/** Slår sammen flere punkter til én streng for PDF / eldre felt. */
export function flattenCellItemsToNote(cell: RosCellItem[]): string {
  return cell
    .map(cellItemToNoteLine)
    .filter((s) => s.length > 0)
    .join("\n\n");
}

/** Celle regnes som dokumentert risiko (brukes i badge / max-nivå — ikke bare varmefarge i rutenettet). */
export function cellHasFilledRosItems(cell: RosCellItem[] | undefined): boolean {
  if (!cell?.length) return false;
  return cell.some(
    (it) =>
      it.text.trim().length > 0 ||
      it.flags?.includes(ROS_CELL_FLAG_WATCH) ||
      it.flags?.includes(ROS_CELL_FLAG_REQUIRES_ACTION),
  );
}

/** Høyeste matrisenivå kun blant celler med dokumentert risiko (tekst eller flagg). */
export function maxRiskAmongDocumentedCells(
  matrix: number[][],
  cellItems: RosCellItemMatrix,
): { max: number; highOrCriticalCells: number } {
  let max = 0;
  let highOrCriticalCells = 0;
  for (let r = 0; r < matrix.length; r++) {
    const rowM = matrix[r];
    const rowItems = cellItems[r];
    if (!rowM) continue;
    for (let c = 0; c < rowM.length; c++) {
      if (!cellHasFilledRosItems(rowItems?.[c])) continue;
      const v = rowM[c] ?? 0;
      if (v > max) max = v;
      if (v >= 4) highOrCriticalCells += 1;
    }
  }
  return { max, highOrCriticalCells };
}

/** Rad til egen PDF-seksjon «Identifiserte risikoer» (full tekst, ikke bare matrise-celle). */
export type RosIdentifiedRiskPdfRow = {
  text: string;
  beforeRowLabel: string;
  beforeColLabel: string;
  afterRowLabel: string;
  afterColLabel: string;
  beforeLevel: number;
  afterLevel: number;
  hasTiltak: boolean;
  hasFølg: boolean;
  afterChangeNote?: string;
};

export function collectIdentifiedRisksForPdf(args: {
  cellItemsMatrix: RosCellItemMatrix;
  rowLabels: string[];
  colLabels: string[];
  matrixValues: number[][];
  afterRowLabels: string[];
  afterColLabels: string[];
  matrixValuesAfter: number[][];
}): RosIdentifiedRiskPdfRow[] {
  const out: RosIdentifiedRiskPdfRow[] = [];
  for (let r = 0; r < args.cellItemsMatrix.length; r++) {
    const row = args.cellItemsMatrix[r];
    if (!row) continue;
    for (let c = 0; c < row.length; c++) {
      const cell = row[c];
      if (!cell) continue;
      for (const item of cell) {
        const t = item.text.trim();
        const hasFlags = (item.flags?.length ?? 0) > 0;
        const hasAfterNote = Boolean(item.afterChangeNote?.trim());
        if (!t && !hasFlags && !hasAfterNote) continue;
        const ar = item.afterRow ?? r;
        const ac = item.afterCol ?? c;
        const beforeLevel = args.matrixValues[r]?.[c] ?? 0;
        const afterLevel = args.matrixValuesAfter[ar]?.[ac] ?? 0;
        out.push({
          text: t,
          beforeRowLabel: args.rowLabels[r] ?? `Rad ${r + 1}`,
          beforeColLabel: args.colLabels[c] ?? `Kolonne ${c + 1}`,
          afterRowLabel: args.afterRowLabels[ar] ?? `Rad ${ar + 1}`,
          afterColLabel: args.afterColLabels[ac] ?? `Kolonne ${ac + 1}`,
          beforeLevel,
          afterLevel,
          hasTiltak: Boolean(
            item.flags?.includes(ROS_CELL_FLAG_REQUIRES_ACTION),
          ),
          hasFølg: Boolean(item.flags?.includes(ROS_CELL_FLAG_WATCH)),
          afterChangeNote: item.afterChangeNote?.trim() || undefined,
        });
      }
    }
  }
  return out.sort((a, b) => {
    if (b.beforeLevel !== a.beforeLevel) return b.beforeLevel - a.beforeLevel;
    const at = a.text || "\uffff";
    const bt = b.text || "\uffff";
    return at.localeCompare(bt, "nb");
  });
}

/** Én linje per risikopunkt i en matrise (før eller etter fase) — full eksport til PDF. */
export type RosCellRiskPointPdfRow = {
  phase: "before" | "after";
  rowLabel: string;
  colLabel: string;
  level: number;
  text: string;
  flags: string[];
  afterChangeNote?: string;
};

/** Alle ikke-tomme punkter i en celle-matrise (én rad per punkt). */
export function collectAllCellRiskPointsForPdf(args: {
  cellItemsMatrix: RosCellItemMatrix;
  rowLabels: string[];
  colLabels: string[];
  matrixValues: number[][];
  phase: "before" | "after";
}): RosCellRiskPointPdfRow[] {
  const out: RosCellRiskPointPdfRow[] = [];
  for (let r = 0; r < args.cellItemsMatrix.length; r++) {
    const row = args.cellItemsMatrix[r];
    if (!row) continue;
    for (let c = 0; c < row.length; c++) {
      const cell = row[c];
      if (!cell) continue;
      for (const item of cell) {
        const t = item.text.trim();
        const hasFlags = (item.flags?.length ?? 0) > 0;
        const hasNote = Boolean(item.afterChangeNote?.trim());
        const bandBits = [item.economicBand, item.frequencyBand]
          .map((s) => s?.trim())
          .filter(Boolean);
        const hasBands = bandBits.length > 0;
        if (!t && !hasFlags && !hasNote && !hasBands) continue;
        const textWithBands =
          hasBands && t ? `${t} [${bandBits.join(" · ")}]` : hasBands && !t
            ? `[${bandBits.join(" · ")}]`
            : t;
        out.push({
          phase: args.phase,
          rowLabel: args.rowLabels[r] ?? `Rad ${r + 1}`,
          colLabel: args.colLabels[c] ?? `Kolonne ${c + 1}`,
          level: args.matrixValues[r]?.[c] ?? 0,
          text: textWithBands,
          flags: item.flags ? [...item.flags] : [],
          afterChangeNote: item.afterChangeNote?.trim() || undefined,
        });
      }
    }
  }
  return out.sort((a, b) => {
    const k = `${a.rowLabel}|${a.colLabel}|${a.text}`.localeCompare(
      `${b.rowLabel}|${b.colLabel}|${b.text}`,
      "nb",
    );
    if (k !== 0) return k;
    return a.phase.localeCompare(b.phase);
  });
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
            afterChangeNote: it.afterChangeNote,
            economicBand: it.economicBand,
            frequencyBand: it.frequencyBand,
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
