/**
 * RPA-pipeline: statuser og hint for CoE / porteføljeflyt (kortere syklus enn klassisk utvikling).
 * Synkroniseres med Convex `pipelineStatusValidator` i `convex/schema.ts`.
 */

export const PIPELINE_STATUSES = [
  "not_assessed",
  "assessed",
  "prioritized",
  "development",
  "uat",
  "production",
  "monitoring",
  "done",
  "on_hold",
] as const;

export type PipelineStatus = (typeof PIPELINE_STATUSES)[number];

export const PIPELINE_STATUS_LABELS: Record<PipelineStatus, string> = {
  not_assessed: "Ikke vurdert",
  assessed: "Vurdert",
  prioritized: "Prioritert",
  development: "Utvikling",
  uat: "UAT / test",
  production: "Produksjon",
  monitoring: "Overvåkning",
  done: "Ferdig",
  on_hold: "På vent",
};

/** Visuell tone for status-piller (liste, header, velger). */
export type PipelineStatusTone = {
  /** Fargeprikk */
  dot: string;
  /** Lukket pill / badge */
  pill: string;
};

export const PIPELINE_STATUS_TONES: Record<PipelineStatus, PipelineStatusTone> = {
  not_assessed: {
    dot: "bg-zinc-400",
    pill: "bg-zinc-500/15 text-zinc-800 ring-zinc-500/20 dark:text-zinc-100",
  },
  assessed: {
    dot: "bg-sky-500",
    pill: "bg-sky-500/15 text-sky-950 ring-sky-500/25 dark:text-sky-100",
  },
  prioritized: {
    dot: "bg-amber-500",
    pill: "bg-amber-500/15 text-amber-950 ring-amber-500/25 dark:text-amber-100",
  },
  development: {
    dot: "bg-blue-500",
    pill: "bg-blue-500/15 text-blue-950 ring-blue-500/25 dark:text-blue-100",
  },
  uat: {
    dot: "bg-violet-500",
    pill: "bg-violet-500/15 text-violet-950 ring-violet-500/25 dark:text-violet-100",
  },
  production: {
    dot: "bg-emerald-500",
    pill: "bg-emerald-500/15 text-emerald-950 ring-emerald-500/25 dark:text-emerald-100",
  },
  monitoring: {
    dot: "bg-teal-500",
    pill: "bg-teal-500/15 text-teal-950 ring-teal-500/25 dark:text-teal-100",
  },
  done: {
    dot: "bg-green-600",
    pill: "bg-green-500/15 text-green-950 ring-green-500/25 dark:text-green-100",
  },
  on_hold: {
    dot: "bg-rose-400",
    pill: "bg-rose-500/12 text-rose-950 ring-rose-500/20 dark:text-rose-100",
  },
};

/** Rekkefølge i Kanban (venstre → høyre, typisk flyt) */
export const PIPELINE_KANBAN_ORDER: PipelineStatus[] = [
  "not_assessed",
  "assessed",
  "prioritized",
  "development",
  "uat",
  "production",
  "monitoring",
  "done",
  "on_hold",
];

export function normalizePipelineStatus(
  s: string | undefined,
): PipelineStatus {
  if (s && PIPELINE_STATUSES.includes(s as PipelineStatus)) {
    return s as PipelineStatus;
  }
  return "not_assessed";
}

/** Hva som typisk skjer når status er nådd (RPA-livssyklus-språk). */
export function nextStepHint(status: PipelineStatus): string {
  switch (status) {
    case "not_assessed":
      return "Steg 2 · Fullfør vurdering før prioritering.";
    case "assessed":
      return "Steg 2 · Prioriter i porteføljen (Assessment & Prioritization).";
    case "prioritized":
      return "Steg 3 · Design: prosessdesign (PDD) og ROS før utvikling.";
    case "development":
      return "Steg 4–5 · Ferdigstill bygg, deretter UAT / test.";
    case "uat":
      return "Steg 5–6 · Godkjenn UAT, deretter produksjon (Deployment).";
    case "production":
      return "I drift — opprett endrings- eller feilkort i Tavler. Status kan stå.";
    case "monitoring":
      return "Overvåkning — endringer og feil som kort. Status kan stå.";
    case "done":
      return "Avsluttet i livssyklusen. Gjenåpne ved behov.";
    case "on_hold":
      return "På vent — avklar før du fortsetter livssyklusen.";
    default:
      return "";
  }
}

/** Kort «klar for neste steg»-tekst for kort i dashboard/Kanban */
export function readinessLabel(status: PipelineStatus): string {
  switch (status) {
    case "not_assessed":
      return "Fullfør vurdering";
    case "assessed":
      return "Klar for prioritering";
    case "prioritized":
      return "Klar for design (PDD/ROS)";
    case "development":
      return "Under utvikling";
    case "uat":
      return "I UAT / test";
    case "production":
      return "I produksjon — endring via Tavler";
    case "monitoring":
      return "Overvåkning — endring via Tavler";
    case "done":
      return "Avsluttet";
    case "on_hold":
      return "På vent";
    default:
      return "";
  }
}
