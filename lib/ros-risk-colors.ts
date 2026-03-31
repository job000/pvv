import { cn } from "@/lib/utils";

/** Tailwind-klasser for celle 0–5 (ROS-risikonivå) */
export function cellRiskClass(level: number): string {
  switch (level) {
    case 0:
      return "bg-muted/40 text-muted-foreground border-border/60 hover:bg-muted/60";
    case 1:
      return "bg-emerald-500/25 text-emerald-950 border-emerald-600/30 hover:bg-emerald-500/35 dark:text-emerald-50";
    case 2:
      return "bg-lime-500/25 text-lime-950 border-lime-600/30 hover:bg-lime-500/35 dark:text-lime-50";
    case 3:
      return "bg-amber-400/30 text-amber-950 border-amber-600/35 hover:bg-amber-400/45 dark:text-amber-50";
    case 4:
      return "bg-orange-500/30 text-orange-950 border-orange-600/40 hover:bg-orange-500/45 dark:text-orange-50";
    case 5:
      return "bg-red-500/35 text-red-950 border-red-600/45 hover:bg-red-500/50 dark:text-red-50";
    default:
      return "bg-muted/40 text-muted-foreground";
  }
}

/**
 * Fyll-, tekst- og kantfarger for PDF-eksport (matcher semantikk fra cellRiskClass).
 */
export function pdfRiskLevelStyle(level: number): {
  fill: [number, number, number];
  text: [number, number, number];
  stroke: [number, number, number];
} {
  switch (level) {
    case 0:
      return {
        fill: [243, 244, 246],
        text: [55, 65, 81],
        stroke: [156, 163, 175],
      };
    case 1:
      return {
        fill: [209, 250, 229],
        text: [6, 78, 59],
        stroke: [16, 185, 129],
      };
    case 2:
      return {
        fill: [236, 252, 203],
        text: [63, 98, 18],
        stroke: [132, 204, 22],
      };
    case 3:
      return {
        fill: [254, 243, 199],
        text: [146, 64, 14],
        stroke: [245, 158, 11],
      };
    case 4:
      return {
        fill: [255, 237, 213],
        text: [154, 52, 18],
        stroke: [249, 115, 22],
      };
    case 5:
      return {
        fill: [254, 226, 226],
        text: [127, 29, 29],
        stroke: [239, 68, 68],
      };
    default:
      return {
        fill: [243, 244, 246],
        text: [55, 65, 81],
        stroke: [156, 163, 175],
      };
  }
}

export function legendItems(): Array<{ level: number; label: string }> {
  return [
    { level: 0, label: "Ikke vurdert" },
    { level: 1, label: "Lav" },
    { level: 2, label: "Moderat lav" },
    { level: 3, label: "Middels" },
    { level: 4, label: "Høy" },
    { level: 5, label: "Kritisk" },
  ];
}

export function cnCell(level: number, interactive: boolean): string {
  return cn(
    "min-h-[3rem] min-w-[3.5rem] border px-1 py-1.5 text-center text-sm font-semibold tabular-nums transition-colors",
    cellRiskClass(level),
    interactive && "cursor-pointer focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
  );
}
