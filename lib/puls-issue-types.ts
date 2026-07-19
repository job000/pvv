/**
 * Puls-korttyper (issueType) — delt mellom tavle og vurderingstre.
 * «Endring» brukes for endringsønsker når prosessen er i prod/overvåkning.
 */

export const PULS_ISSUE_TYPE_OPTIONS = [
  "Endring",
  "Feil",
  "Funksjon",
  "Oppgave",
] as const;

export type PulsIssueType = (typeof PULS_ISSUE_TYPE_OPTIONS)[number];

export const PULS_ISSUE_TYPE_ALIASES: Record<string, PulsIssueType> = {
  endring: "Endring",
  change: "Endring",
  "change-request": "Endring",
  cr: "Endring",
  feature: "Funksjon",
  funksjon: "Funksjon",
  bug: "Feil",
  feil: "Feil",
  task: "Oppgave",
  oppgave: "Oppgave",
};

/** Query-param `?puls=` → kanonisk type */
export function pulsIssueTypeFromQuery(
  raw: string | null | undefined,
): PulsIssueType | null {
  if (!raw?.trim()) return null;
  const viaAlias = PULS_ISSUE_TYPE_ALIASES[raw.trim().toLowerCase()];
  if (viaAlias) return viaAlias;
  return (
    PULS_ISSUE_TYPE_OPTIONS.find(
      (o) => o.toLowerCase() === raw.trim().toLowerCase(),
    ) ?? null
  );
}

export function normalizePulsIssueType(
  current: string | undefined | null,
): string {
  const t = current?.trim() ?? "";
  if (!t) return "";
  const viaAlias = PULS_ISSUE_TYPE_ALIASES[t.toLowerCase()];
  if (viaAlias) return viaAlias;
  return (
    PULS_ISSUE_TYPE_OPTIONS.find((o) => o.toLowerCase() === t.toLowerCase()) ??
    t
  );
}

export function isProdOrMonitoring(
  status: string | undefined | null,
): boolean {
  return status === "production" || status === "monitoring";
}
