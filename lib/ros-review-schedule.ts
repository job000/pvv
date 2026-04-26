/** Matcher `rosReviewRecurrenceKindValidator` i Convex-skjema. */
export type RosReviewRecurrenceKind =
  | "none"
  | "weekly"
  | "monthly"
  | "quarterly"
  | "yearly"
  | "biennial";

export const ROS_REVIEW_RECURRENCE_OPTIONS: {
  value: RosReviewRecurrenceKind;
  label: string;
}[] = [
  { value: "none", label: "Kun manuell frist" },
  { value: "weekly", label: "Hver uke" },
  { value: "monthly", label: "Hver måned" },
  { value: "quarterly", label: "Hvert kvartal" },
  { value: "yearly", label: "Hvert år" },
  { value: "biennial", label: "Annethvert år" },
];

/** Neste tidspunkt fra `fromMs` etter ett intervall (for planlagt revisjon). */
export function advanceRosReviewDate(
  fromMs: number,
  kind: RosReviewRecurrenceKind,
): number {
  if (kind === "none") return fromMs;
  const d = new Date(fromMs);
  switch (kind) {
    case "weekly":
      d.setDate(d.getDate() + 7);
      return d.getTime();
    case "monthly":
      d.setMonth(d.getMonth() + 1);
      return d.getTime();
    case "quarterly":
      d.setMonth(d.getMonth() + 3);
      return d.getTime();
    case "yearly":
      d.setFullYear(d.getFullYear() + 1);
      return d.getTime();
    case "biennial":
      d.setFullYear(d.getFullYear() + 2);
      return d.getTime();
    default:
      return fromMs;
  }
}

export function parseRosReviewRecurrenceKind(
  raw: string | undefined | null,
): RosReviewRecurrenceKind {
  const allowed: RosReviewRecurrenceKind[] = [
    "none",
    "weekly",
    "monthly",
    "quarterly",
    "yearly",
    "biennial",
  ];
  if (raw && (allowed as string[]).includes(raw)) {
    return raw as RosReviewRecurrenceKind;
  }
  return "none";
}
