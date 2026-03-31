/**
 * Planner-lignende prioritetsetikett (P1 = høyest) ut fra porteføljeprioritet 0–100.
 */
export function leveransePriorityTag(score: number): {
  label: string;
  className: string;
} {
  const s = Number.isFinite(score) ? score : 0;
  if (s >= 72) {
    return {
      label: "P1",
      className:
        "border-rose-500/40 bg-rose-500/15 text-rose-900 dark:text-rose-100",
    };
  }
  if (s >= 58) {
    return {
      label: "P2",
      className:
        "border-amber-500/40 bg-amber-500/12 text-amber-950 dark:text-amber-100",
    };
  }
  if (s >= 45) {
    return {
      label: "P3",
      className:
        "border-sky-500/35 bg-sky-500/10 text-sky-950 dark:text-sky-100",
    };
  }
  if (s >= 32) {
    return {
      label: "P4",
      className: "border-border bg-muted/50 text-foreground",
    };
  }
  return {
    label: "P5",
    className: "border-border/80 bg-muted/30 text-muted-foreground",
  };
}
