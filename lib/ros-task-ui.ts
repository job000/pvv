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

/**
 * Dropdown for oppgaver: alle RosCellItem i før- og etter-matrise.
 */
export function buildRosTaskRiskLinkOptions(args: {
  cellItemsMatrix: RosCellItemMatrix;
  cellItemsAfterMatrix: RosCellItemMatrix;
  rowLabels: string[];
  colLabels: string[];
  afterRowLabels: string[];
  afterColLabels: string[];
}): { value: string; label: string }[] {
  const rows: { value: string; label: string }[] = [];
  for (let r = 0; r < args.cellItemsMatrix.length; r++) {
    const row = args.cellItemsMatrix[r];
    if (!row) continue;
    for (let c = 0; c < row.length; c++) {
      const cell = row[c];
      if (!cell) continue;
      for (const it of cell) {
        const rl = args.rowLabels[r] ?? `R${r + 1}`;
        const cl = args.colLabels[c] ?? `K${c + 1}`;
        rows.push({
          value: `before:${it.id}`,
          label: `Før · ${rl} × ${cl} · ${truncateLabel(it.text, 72)}`,
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
        rows.push({
          value: `after:${it.id}`,
          label: `Etter · ${rl} × ${cl} · ${truncateLabel(it.text, 72)}`,
        });
      }
    }
  }
  rows.sort((a, b) => a.label.localeCompare(b.label, "nb"));
  return [
    { value: "", label: "— Ingen kobling til konkret risiko/tiltak —" },
    ...rows,
  ];
}

export function parseRosTaskRiskLink(value: string): {
  linkedCellItemId: string;
  linkedCellItemPhase: "before" | "after";
} | null {
  if (!value.trim()) return null;
  if (value.startsWith("before:")) {
    const id = value.slice(7).trim();
    if (!id) return null;
    return { linkedCellItemId: id, linkedCellItemPhase: "before" };
  }
  if (value.startsWith("after:")) {
    const id = value.slice(5).trim();
    if (!id) return null;
    return { linkedCellItemId: id, linkedCellItemPhase: "after" };
  }
  return null;
}

export function riskTreatmentLabel(
  kind: "mitigate" | "accept" | "transfer" | "avoid" | undefined,
): string | null {
  if (!kind) return null;
  const row = ROS_RISK_TREATMENT_OPTIONS.find((o) => o.value === kind);
  return row?.label ?? kind;
}
