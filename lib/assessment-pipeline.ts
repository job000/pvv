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
      return "Steg 6–7 · Drift stabil? Flytt til overvåkning og endring.";
    case "monitoring":
      return "Steg 7 · Overvåk, håndter endringer; marker ferdig ved avslutning.";
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
      return "I produksjon";
    case "monitoring":
      return "Overvåkning og endring";
    case "done":
      return "Avsluttet";
    case "on_hold":
      return "På vent";
    default:
      return "";
  }
}
