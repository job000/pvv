import {
  DEFAULT_ROS_COL_AXIS,
  DEFAULT_ROS_COL_LABELS,
  DEFAULT_ROS_ROW_AXIS,
  DEFAULT_ROS_ROW_LABELS,
} from "@/lib/ros-defaults";

export type RosTemplatePresetId = "standard5" | "compact4" | "axesOnly";

export type RosTemplatePreset = {
  id: RosTemplatePresetId;
  name: string;
  description: string;
  rowAxisTitle: string;
  colAxisTitle: string;
  /** Tom betyr «bruk server-standard 5×5» ved opprettelse */
  rowLabels: string[] | null;
  colLabels: string[] | null;
};

/** Fire nivåer — enklere oversikt for små team */
const COMPACT_ROW = ["1 — Lav", "2 — Middels", "3 — Høy", "4 — Svært høy"] as const;
const COMPACT_COL = [
  "1 — Ubetydelig",
  "2 — Moderat",
  "3 — Alvorlig",
  "4 — Katastrofal",
] as const;

export const ROS_TEMPLATE_PRESETS: RosTemplatePreset[] = [
  {
    id: "standard5",
    name: "Standard 5×5",
    description:
      "Sannsynlighet × konsekvens med fem nivåer på hver akse (anbefalt).",
    rowAxisTitle: DEFAULT_ROS_ROW_AXIS,
    colAxisTitle: DEFAULT_ROS_COL_AXIS,
    rowLabels: [...DEFAULT_ROS_ROW_LABELS],
    colLabels: [...DEFAULT_ROS_COL_LABELS],
  },
  {
    id: "compact4",
    name: "Kompakt 4×4",
    description: "Mindre rutenett når dere trenger rask oversikt.",
    rowAxisTitle: DEFAULT_ROS_ROW_AXIS,
    colAxisTitle: DEFAULT_ROS_COL_AXIS,
    rowLabels: [...COMPACT_ROW],
    colLabels: [...COMPACT_COL],
  },
  {
    id: "axesOnly",
    name: "Kun akser (5×5 standardverdier)",
    description:
      "Tomme etikettfelt — systemet bruker innebygd 5×5. Du kan fortsatt gi malen eget navn og beskrivelse.",
    rowAxisTitle: DEFAULT_ROS_ROW_AXIS,
    colAxisTitle: DEFAULT_ROS_COL_AXIS,
    rowLabels: null,
    colLabels: null,
  },
];

export function presetToFormState(p: RosTemplatePreset): {
  tplRowAxis: string;
  tplColAxis: string;
  tplRows: string;
  tplCols: string;
} {
  const rowStr = p.rowLabels?.join("\n") ?? "";
  const colStr = p.colLabels?.join("\n") ?? "";
  return {
    tplRowAxis: p.rowAxisTitle,
    tplColAxis: p.colAxisTitle,
    tplRows: rowStr,
    tplCols: colStr,
  };
}
