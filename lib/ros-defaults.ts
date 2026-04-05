/** Standard ROS-matrise (sannsynlighet × konsekvens) — kan tilpasses i maler */

export const DEFAULT_ROS_ROW_AXIS = "Sannsynlighet";
export const DEFAULT_ROS_COL_AXIS = "Konsekvens";

export const DEFAULT_ROS_ROW_LABELS = [
  "1 — Svært lav",
  "2 — Lav",
  "3 — Middels",
  "4 — Høy",
  "5 — Svært høy",
] as const;

export const DEFAULT_ROS_COL_LABELS = [
  "1 — Ubetydelig",
  "2 — Lav",
  "3 — Middels",
  "4 — Betydelig",
  "5 — Kritisk",
] as const;

/** Mal brukt når ROS opprettes automatisk fra inntaksskjema — RPA-relevante rader + konsekvens-akse */
export const RPA_INTAKE_ROS_TEMPLATE_NAME = "RPA · skjema og inntak";
export const RPA_INTAKE_ROS_TEMPLATE_DESCRIPTION =
  "Rader for typiske RPA-risikoer; kolonner er konsekvens dersom noe feiler. «Etter tiltak» har egne felt for planlagte tiltak per rad.";

export const RPA_INTAKE_ROS_ROW_AXIS = "RPA-risikoområde";
export const RPA_INTAKE_ROS_COL_AXIS = "Konsekvens hvis feil oppstår";

export const RPA_INTAKE_ROS_ROW_LABELS = [
  "Konsekvens for brukere, drift og etterlevelse (fra skjema)",
  "Robot, klientmiljø og tilgjengelighet",
  "Datakvalitet, transaksjoner og avvik",
  "Tilgang, logging og personvern",
  "Systemendringer og integrasjon",
] as const;

export const RPA_INTAKE_ROS_ROW_DESCRIPTIONS = [
  "Fritekst fra skjema om hva som kan gå galt for brukere, drift eller regelverk.",
  "Avbrudd, ytelse, miljø, skjermbilder, volum — typisk for RPA i brukergrensesnitt.",
  "Feilregistrering, duplikater, OCR, manglende data.",
  "Roller, tilgangsstyring, logging, personvern og dokumentasjon.",
  "Endringer i systemer, versjoner, API og vedlikehold som påvirker roboten.",
] as const;

/** Samme inndeling som risiko-radene — for planlagte tiltak etter ISO 31000 / praksis */
export const RPA_INTAKE_ROS_ROW_AXIS_AFTER = "Planlagte tiltak (etter tiltak)";
export const RPA_INTAKE_ROS_COL_AXIS_AFTER = "Tiltak";

export const RPA_INTAKE_ROS_ROW_LABELS_AFTER = [
  "Tiltak: brukere, drift, etterlevelse",
  "Tiltak: robot, miljø, overvåking",
  "Tiltak: datakvalitet og kontroll",
  "Tiltak: tilgang, logging, personvern",
  "Tiltak: systemendringer og integrasjon",
] as const;

export const RPA_INTAKE_ROS_COL_LABELS_AFTER = [
  "Planlagt tiltak",
  "Ansvar / status",
] as const;

export function isRpaIntakeRosTemplate(rowLabels: readonly string[]): boolean {
  if (rowLabels.length !== RPA_INTAKE_ROS_ROW_LABELS.length) {
    return false;
  }
  return rowLabels[0] === RPA_INTAKE_ROS_ROW_LABELS[0];
}

export const RISK_LEVEL_HINTS: Record<number, string> = {
  0: "Ikke vurdert",
  1: "Lav risiko",
  2: "Moderat lav",
  3: "Middels",
  4: "Høy",
  5: "Kritisk",
};

/**
 * Beregner risikonivå (1-5) fra celleposisjon i matrisen.
 * Basert på produktet (rad+1)*(kol+1) normalisert mot matrisestørrelsen.
 * Rad 0 = lavest sannsynlighet (vises nederst), rad N-1 = høyest (vises øverst).
 * Gir klassisk risiko-heatmap: grønn (nedre venstre) → rød (øvre høyre).
 */
export function positionRiskLevel(
  row: number,
  col: number,
  totalRows: number,
  totalCols: number,
): number {
  if (totalRows <= 0 || totalCols <= 0) return 0;
  const product = (row + 1) * (col + 1);
  const maxProduct = totalRows * totalCols;
  const ratio = product / maxProduct;
  if (ratio <= 0.06) return 1;
  if (ratio <= 0.16) return 2;
  if (ratio <= 0.36) return 3;
  if (ratio <= 0.64) return 4;
  return 5;
}

export function emptyMatrix(rows: number, cols: number): number[][] {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0));
}

/** Tomme notatfelt parallelt med matrise (samme dimensjon). */
export function emptyStringMatrix(rows: number, cols: number): string[][] {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ""),
  );
}
