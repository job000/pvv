/**
 * Forsidebakgrunn: kun når brukeren har lastet opp eget bilde.
 * Standard er ren hvit flate (statlig / helseforetak-stil) — ingen generert «dekor».
 */

/**
 * Returnerer eget forsidebilde (data-URL), ellers null (= hvit side i layout).
 */
export function resolvePdfCoverBackgroundDataUrl(
  customDataUrl?: string | null,
): string | null {
  const custom = customDataUrl?.trim();
  if (custom && custom.startsWith("data:image/")) return custom;
  return null;
}
