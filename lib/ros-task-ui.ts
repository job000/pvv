/**
 * Hjelpefunksjoner for ROS-oppgaver: kobling til risiko-/tiltakspunkt og risikohåndtering.
 */

import type { RosCellItemMatrix } from "@/lib/ros-cell-items";

export const ROS_RISK_TREATMENT_OPTIONS: {
  value: "" | "mitigate" | "accept" | "transfer" | "avoid";
  label: string;
  description: string;
}[] = [
  {
    value: "",
    label: "Ikke angitt",
    description: "Oppgaven er ikke klassifisert etter behandlingsstrategi.",
  },
  {
    value: "mitigate",
    label: "Reduser (tiltak)",
    description: "Tiltak for å redusere sannsynlighet eller konsekvens.",
  },
  {
    value: "accept",
    label: "Akseptere",
    description: "Rest risiko tas inn i beslutningsgrunnlaget.",
  },
  {
    value: "transfer",
    label: "Overføre",
    description: "F.eks. forsikring eller leverandør.",
  },
  {
    value: "avoid",
    label: "Unngå",
    description: "Avvikle aktivitet eller prosess.",
  },
];

function truncateLabel(s: string, max: number): string {
  const t = s.trim();
  if (!t) return "(tomt punkt)";
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

export type RosTaskRiskLinkOption = {
  value: string;
  label: string;
  /** Tom = «ingen kobling». Ellers gruppe i UI (optgroup). */
  group?: "before" | "after";
};

/**
 * Dropdown for tiltak: alle RosCellItem i før- og etter-matrise.
 *
 * Vi grupperer på fase (før / etter tiltak) i stedet for å prefiksere hver
 * etikett, slik at brukeren ser tydelig at «Før» = iboende risiko og
 * «Etter» = restrisiko etter planlagte/gjennomførte tiltak.
 */
export function buildRosTaskRiskLinkOptions(args: {
  cellItemsMatrix: RosCellItemMatrix;
  cellItemsAfterMatrix: RosCellItemMatrix;
  rowLabels: string[];
  colLabels: string[];
  afterRowLabels: string[];
  afterColLabels: string[];
}): RosTaskRiskLinkOption[] {
  const before: RosTaskRiskLinkOption[] = [];
  const after: RosTaskRiskLinkOption[] = [];
  for (let r = 0; r < args.cellItemsMatrix.length; r++) {
    const row = args.cellItemsMatrix[r];
    if (!row) continue;
    for (let c = 0; c < row.length; c++) {
      const cell = row[c];
      if (!cell) continue;
      for (const it of cell) {
        const rl = args.rowLabels[r] ?? `R${r + 1}`;
        const cl = args.colLabels[c] ?? `K${c + 1}`;
        before.push({
          value: `before:${it.id}`,
          label: `${rl} × ${cl} — ${truncateLabel(it.text, 72)}`,
          group: "before",
        });
      }
    }
  }
  for (let r = 0; r < args.cellItemsAfterMatrix.length; r++) {
    const row = args.cellItemsAfterMatrix[r];
    if (!row) continue;
    for (let c = 0; c < row.length; c++) {
      const cell = row[c];
      if (!cell) continue;
      for (const it of cell) {
        const rl = args.afterRowLabels[r] ?? `R${r + 1}`;
        const cl = args.afterColLabels[c] ?? `K${c + 1}`;
        after.push({
          value: `after:${it.id}`,
          label: `${rl} × ${cl} — ${truncateLabel(it.text, 72)}`,
          group: "after",
        });
      }
    }
  }
  before.sort((a, b) => a.label.localeCompare(b.label, "nb"));
  after.sort((a, b) => a.label.localeCompare(b.label, "nb"));
  return [
    { value: "", label: "— Ingen kobling (anbefales ikke) —" },
    ...before,
    ...after,
  ];
}

/** Norsk overskrift for hver fase i risikokoblings-dropdown. */
export const ROS_TASK_RISK_LINK_GROUP_LABELS: Record<
  "before" | "after",
  string
> = {
  before: "Risiko før tiltak (iboende)",
  after: "Restrisiko etter tiltak",
};

export function parseRosTaskRiskLink(value: string): {
  linkedCellItemId: string;
  linkedCellItemPhase: "before" | "after";
} | null {
  if (!value.trim()) return null;
  const beforePrefix = "before:";
  if (value.startsWith(beforePrefix)) {
    const id = value.slice(beforePrefix.length).trim();
    if (!id) return null;
    return { linkedCellItemId: id, linkedCellItemPhase: "before" };
  }
  const afterPrefix = "after:";
  if (value.startsWith(afterPrefix)) {
    const id = value.slice(afterPrefix.length).trim();
    if (!id) return null;
    return { linkedCellItemId: id, linkedCellItemPhase: "after" };
  }
  return null;
}

/**
 * Bygger «select»-verdien som matcher options fra `buildRosTaskRiskLinkOptions`
 * for et eksisterende koblingspar. Tom streng = ingen kobling.
 */
export function rosTaskRiskLinkValue(
  linkedCellItemId: string | undefined | null,
  linkedCellItemPhase: "before" | "after" | undefined | null,
): string {
  if (!linkedCellItemId || !linkedCellItemPhase) return "";
  return `${linkedCellItemPhase}:${linkedCellItemId}`;
}

export function riskTreatmentLabel(
  kind: "mitigate" | "accept" | "transfer" | "avoid" | undefined,
): string | null {
  if (!kind) return null;
  const row = ROS_RISK_TREATMENT_OPTIONS.find((o) => o.value === kind);
  return row?.label ?? kind;
}
