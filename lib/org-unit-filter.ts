import type { Doc, Id } from "@/convex/_generated/dataModel";
import { ORG_UNIT_KIND_LABELS } from "@/lib/helsesector-labels";

/** Alle enhets-ID-er i undertrær roten i `rootId` (inkludert roten). */
export function orgSubtreeIds(
  rootId: Id<"orgUnits">,
  units: Doc<"orgUnits">[],
): Set<Id<"orgUnits">> {
  const children = new Map<Id<"orgUnits"> | "__root__", Id<"orgUnits">[]>();
  for (const u of units) {
    const k = u.parentId ?? "__root__";
    if (!children.has(k)) children.set(k, []);
    children.get(k)!.push(u._id);
  }
  const out = new Set<Id<"orgUnits">>();
  const q: Id<"orgUnits">[] = [rootId];
  while (q.length) {
    const id = q.shift()!;
    out.add(id);
    for (const ch of children.get(id) ?? []) q.push(ch);
  }
  return out;
}

/** Tekst brukt i søk — samme mønster som `candidateOrgUnitLabel` i workspace-panels. */
export function orgUnitSearchLabel(
  orgUnitId: Id<"orgUnits"> | undefined | null,
  orgUnits: Doc<"orgUnits">[],
): string {
  if (!orgUnitId) return "";
  const u = orgUnits.find((o) => o._id === orgUnitId);
  return u ? `${ORG_UNIT_KIND_LABELS[u.kind]} · ${u.name}` : "";
}

/**
 * Effektiv enhet for ROS-liste: prosessens org når analysen har kandidat,
 * ellers analysens egen orgUnitId.
 */
export function effectiveOrgForRosClient(
  ros: {
    candidateId?: Id<"candidates"> | null;
    orgUnitId?: Id<"orgUnits"> | null;
  },
  candidateById: Map<Id<"candidates">, Doc<"candidates">>,
): Id<"orgUnits"> | undefined {
  if (ros.candidateId) {
    const c = candidateById.get(ros.candidateId);
    return c?.orgUnitId ?? ros.orgUnitId ?? undefined;
  }
  return ros.orgUnitId ?? undefined;
}
