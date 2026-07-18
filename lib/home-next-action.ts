/**
 * Primær neste handling for hjem-køen — én sak, ett kort.
 * Rekkefølge følger RPA-livssyklusen (ikke «alle mangler» samtidig).
 */

import type { Id } from "@/convex/_generated/dataModel";
import {
  nextStepHint,
  type PipelineStatus,
} from "@/lib/assessment-pipeline";

export type HomeDashboardRow = {
  assessmentId: Id<"assessments">;
  title: string;
  updatedAt: number;
  pipelineStatus: PipelineStatus;
  effectivePriority: number;
  rosLinked: boolean;
  nextStepHint: string;
};

export type HomeNextAction = {
  reason: string;
  meta: string;
  href: string;
  /** Lavere = høyere opp i køen */
  urgency: number;
};

/** ROS hører til design (steg 3) — etter vurdering og prioritering. */
export function isRosDue(status: PipelineStatus, rosLinked: boolean): boolean {
  if (rosLinked) return false;
  return (
    status === "prioritized" ||
    status === "development" ||
    status === "uat" ||
    status === "production" ||
    status === "monitoring"
  );
}

export function homeNextActionForAssessment(
  row: HomeDashboardRow,
  workspaceId: string,
): HomeNextAction {
  const base = `/w/${workspaceId}/a/${row.assessmentId}`;
  const status = row.pipelineStatus;

  if (status === "on_hold") {
    return {
      reason: "På vent",
      meta: row.nextStepHint || "Avklar før du fortsetter",
      href: base,
      urgency: 0,
    };
  }

  if (status === "not_assessed") {
    return {
      reason: "Steg 2 · Vurdering",
      meta: "Fullfør vurderingen først",
      href: base,
      urgency: 1,
    };
  }

  if (status === "assessed") {
    return {
      reason: "Steg 2 · Prioritering",
      meta: "Prioriter i porteføljen",
      href: base,
      urgency: 2,
    };
  }

  if (isRosDue(status, row.rosLinked)) {
    return {
      reason: "Steg 3 · Design",
      meta: "Koble ROS",
      href: `${base}?kobleRos=1`,
      urgency: 3,
    };
  }

  return {
    reason: nextStepHint(status).split("·")[0]?.trim() || "Fortsett",
    meta: row.nextStepHint,
    href: base,
    urgency: 4,
  };
}

/** Samme vurdering én gang; behold raden (data er den samme på tvers av køer). */
export function dedupeDashboardRows<T extends { assessmentId: Id<"assessments"> }>(
  rows: T[],
): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const row of rows) {
    const id = String(row.assessmentId);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(row);
  }
  return out;
}

export function sortByHomeUrgency<T extends HomeDashboardRow>(
  rows: T[],
  workspaceId: string,
): Array<{ row: T; action: HomeNextAction }> {
  return rows
    .map((row) => ({
      row,
      action: homeNextActionForAssessment(row, workspaceId),
    }))
    .sort((a, b) => {
      if (a.action.urgency !== b.action.urgency) {
        return a.action.urgency - b.action.urgency;
      }
      if (a.row.effectivePriority !== b.row.effectivePriority) {
        return b.row.effectivePriority - a.row.effectivePriority;
      }
      return b.row.updatedAt - a.row.updatedAt;
    });
}
