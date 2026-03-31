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
