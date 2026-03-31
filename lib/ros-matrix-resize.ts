/** Klienthjelpere for å holde matriser i takt med nye rad/kol-etiketter. */

export function parseLabelLines(text: string): string[] {
  return text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function resizeNumberMatrix(
  m: number[][],
  rows: number,
  cols: number,
  fill = 0,
): number[][] {
  const out: number[][] = [];
  for (let i = 0; i < rows; i++) {
    const row: number[] = [];
    for (let j = 0; j < cols; j++) {
      row.push(
        i < m.length && j < (m[i]?.length ?? 0) ? (m[i]![j] ?? fill) : fill,
      );
    }
    out.push(row);
  }
  return out;
}

export function resizeStringMatrix(
  m: string[][],
  rows: number,
  cols: number,
): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < rows; i++) {
    const row: string[] = [];
    for (let j = 0; j < cols; j++) {
      row.push(
        i < m.length && j < (m[i]?.length ?? 0) ? (m[i]![j] ?? "") : "",
      );
    }
    out.push(row);
  }
  return out;
}
