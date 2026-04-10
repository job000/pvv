import type { RosCellItemMatrix } from "./ros-cell-items";

type RosLikeForPdd = {
  notes?: string;
  contextSummary?: string;
  methodologyStatement?: string;
  scopeAndCriteria?: string;
  axisScaleNotes?: string;
  rowLabels: string[];
  colLabels: string[];
  cellItems?: RosCellItemMatrix;
  riskPoolBefore?: Array<{ text: string }>;
};

export type RosPddDigest = {
  analysisNotes?: string;
  contextSummary?: string;
  methodologyStatement?: string;
  scopeAndCriteria?: string;
  axisScaleNotes?: string;
  riskSnippets: string[];
};

const MAX_SNIPPETS = 36;

/** Trekker ut tekst til RPA prosessdesign (PDD) fra ROS-analyse. */
export function buildRosPddDigest(ros: RosLikeForPdd): RosPddDigest {
  const riskSnippets: string[] = [];
  const items = ros.cellItems;
  if (items?.length) {
    for (let i = 0; i < items.length; i++) {
      for (let j = 0; j < (items[i]?.length ?? 0); j++) {
        for (const it of items[i]![j] ?? []) {
          const t = it.text?.trim();
          if (t && riskSnippets.length < MAX_SNIPPETS) {
            const rl = ros.rowLabels[i] ?? `R${i + 1}`;
            const cl = ros.colLabels[j] ?? `K${j + 1}`;
            riskSnippets.push(`[${rl} × ${cl}] ${t}`.slice(0, 420));
          }
        }
      }
    }
  }
  for (const p of ros.riskPoolBefore ?? []) {
    const t = p.text?.trim();
    if (t && riskSnippets.length < MAX_SNIPPETS) {
      riskSnippets.push(`[Kortlager] ${t}`.slice(0, 420));
    }
  }
  return {
    analysisNotes: ros.notes?.trim() || undefined,
    contextSummary: ros.contextSummary?.trim() || undefined,
    methodologyStatement: ros.methodologyStatement?.trim() || undefined,
    scopeAndCriteria: ros.scopeAndCriteria?.trim() || undefined,
    axisScaleNotes: ros.axisScaleNotes?.trim() || undefined,
    riskSnippets,
  };
}
