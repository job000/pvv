/**
 * Prosessprofil-feltene i vurderingen er **beskrivende tekst** (arkiv/kontekst).
 * De erstatter ikke KPI- eller Likert-feltene andre steder i skjemaet.
 */

export const PROCESS_TEXT_FIELD_MAX = 6000;

export const PROCESS_TEXT_FIELD_KEYS = [
  "processDescription",
  "processGoal",
  "processFlowSummary",
  "processActors",
  "processSystems",
  "processVolumeNotes",
  "processConstraints",
  "processFollowUp",
  "hfSecurityInformationNotes",
  "hfOrganizationalBreadthNotes",
  "hfEconomicRationaleNotes",
  "hfCriticalManualGapNotes",
  "hfOperationsSupportNotes",
] as const;

export type ProcessTextFieldKey = (typeof PROCESS_TEXT_FIELD_KEYS)[number];

/** Normaliserer linjeskift og begrenser lengde (for lagring og visning). */
export function clampProcessText(s: string): string {
  const normalized = s.replace(/\r\n/g, "\n");
  if (normalized.length <= PROCESS_TEXT_FIELD_MAX) return normalized;
  return normalized.slice(0, PROCESS_TEXT_FIELD_MAX);
}

export function isProcessTextFieldKey(
  k: string,
): k is ProcessTextFieldKey {
  return (PROCESS_TEXT_FIELD_KEYS as readonly string[]).includes(k);
}

/**
 * Klipper alle prosess-tekstfelt i et utkast (brukes før lagring server-side).
 */
export function sanitizeAssessmentProcessTextFields<
  T extends Record<string, unknown>,
>(payload: T): T {
  const out = { ...payload } as Record<string, unknown>;
  for (const key of PROCESS_TEXT_FIELD_KEYS) {
    const v = out[key];
    if (typeof v === "string") {
      out[key] = clampProcessText(v);
    }
  }
  return out as T;
}
