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

/** Hva som typisk skjer når status er nådd */
export function nextStepHint(status: PipelineStatus): string {
  switch (status) {
    case "not_assessed":
      return "Fullfør vurdering for å kunne prioritere.";
    case "assessed":
      return "Prioriter i backlog eller flytt til prioritert.";
    case "prioritized":
      return "Klar for utviklingssprint (robot/bygg).";
    case "development":
      return "Klar for UAT når bygg er ferdig.";
    case "uat":
      return "Klar for produksjon etter godkjenning.";
    case "production":
      return "Overvåk og iterer; flytt til overvåkning når stabil.";
    case "monitoring":
      return "Kontinuerlig forbedring; marker ferdig når avsluttet.";
    case "done":
      return "Arkivert. Gjenåpne ved behov.";
    case "on_hold":
      return "Avventer avklaring eller kapasitet.";
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
      return "Klar for utvikling";
    case "development":
      return "Under utvikling";
    case "uat":
      return "Klar for produksjon etter UAT";
    case "production":
      return "I produksjon";
    case "monitoring":
      return "Kontinuerlig forbedring";
    case "done":
      return "Avsluttet";
    case "on_hold":
      return "På vent";
    default:
      return "";
  }
}
