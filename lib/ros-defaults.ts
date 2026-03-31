/** Standard ROS-matrise (sannsynlighet × konsekvens) — kan tilpasses i maler */

export const DEFAULT_ROS_ROW_AXIS = "Sannsynlighet";
export const DEFAULT_ROS_COL_AXIS = "Konsekvens";

export const DEFAULT_ROS_ROW_LABELS = [
  "1 — Svært lav",
  "2 — Lav",
  "3 — Middels",
  "4 — Høy",
  "5 — Svært høy",
] as const;

export const DEFAULT_ROS_COL_LABELS = [
  "1 — Ubetydelig",
  "2 — Lav",
  "3 — Middels",
  "4 — Betydelig",
  "5 — Kritisk",
] as const;

export const RISK_LEVEL_HINTS: Record<number, string> = {
  0: "Ikke vurdert",
  1: "Lav risiko",
  2: "Moderat lav",
  3: "Middels",
  4: "Høy",
  5: "Kritisk",
};

export function emptyMatrix(rows: number, cols: number): number[][] {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0));
}

/** Tomme notatfelt parallelt med matrise (samme dimensjon). */
export function emptyStringMatrix(rows: number, cols: number): string[][] {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ""),
  );
}
