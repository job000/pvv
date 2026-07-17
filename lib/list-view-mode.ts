export type ListViewMode = "cards" | "list" | "table";

export const LIST_VIEW_MODES: {
  value: ListViewMode;
  label: string;
}[] = [
  { value: "cards", label: "Kort" },
  { value: "list", label: "Liste" },
  { value: "table", label: "Tabell" },
];

export function isListViewMode(value: unknown): value is ListViewMode {
  return value === "cards" || value === "list" || value === "table";
}
