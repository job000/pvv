import type { Doc } from "@/convex/_generated/dataModel";
import type { ComplianceStatusKey } from "@/lib/helsesector-labels";

const rtf = new Intl.RelativeTimeFormat("nb-NO", { numeric: "auto" });

/** «Oppdatert for 2 timer siden» — kort og lesbart. */
export function formatRelativeUpdatedAt(updatedAtMs: number): string {
  const now = Date.now();
  const diffSec = Math.round((now - updatedAtMs) / 1000);
  if (diffSec < 45) {
    return rtf.format(-Math.max(1, diffSec), "second");
  }
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) {
    return rtf.format(-diffMin, "minute");
  }
  const diffHour = Math.round(diffMin / 60);
  if (diffHour < 24) {
    return rtf.format(-diffHour, "hour");
  }
  const diffDay = Math.round(diffHour / 24);
  if (diffDay < 14) {
    return rtf.format(-diffDay, "day");
  }
  const diffWeek = Math.round(diffDay / 7);
  if (diffWeek < 8) {
    return rtf.format(-diffWeek, "week");
  }
  const diffMonth = Math.round(diffDay / 30);
  return rtf.format(-diffMonth, "month");
}

function isComplianceSettled(s: ComplianceStatusKey): boolean {
  return s === "completed" || s === "not_applicable";
}

/**
 * Én linje uten ROS/PDD-forkortelser i brødtekst — forklarer bare om teamet er i mål.
 */
export function compliancePlainLine(
  a: Pick<Doc<"assessments">, "rosStatus" | "pddStatus">,
): string {
  const r = (a.rosStatus ?? "not_started") as ComplianceStatusKey;
  const p = (a.pddStatus ?? "not_started") as ComplianceStatusKey;
  if (isComplianceSettled(r) && isComplianceSettled(p)) {
    return "Risiko og personvern: avklart";
  }
  if (r === "not_started" && p === "not_started") {
    return "Risiko og personvern: ikke vurdert ennå";
  }
  return "Risiko og personvern: pågår";
}
