/** Runde-tripp for PVV ↔ GitHub issue-body (synkbare tekstfelt). */

export type PvvGithubSyncFieldKeys = "notes" | "owner" | "systems" | "compliance";

export function utf8ToB64(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

export function b64ToUtf8(b64: string): string {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

export function formatPvvSyncBlock(
  key: PvvGithubSyncFieldKeys,
  text: string,
): string {
  const encoded = utf8ToB64(text);
  /** Lesbar tekst i Markdown; base64 kun i én HTML-kommentar (GitHub skjuler den). */
  const visible =
    text.trim() === ""
      ? "*(Ingen tekst i PVV for dette feltet.)*"
      : text;
  return `${visible}\n\n<!-- pvv:b64:${key}:${encoded} -->`;
}

export function hasPvvSyncMarkersInBody(body: string): boolean {
  return (
    /<!--\s*pvv:b64:(notes|owner|systems|compliance):[A-Za-z0-9+/=]+\s*-->/.test(
      body,
    ) || /<!-- pvv:b64:(notes|owner|systems|compliance) -->/.test(body)
  );
}

function extractBlock(
  body: string,
  key: PvvGithubSyncFieldKeys,
): string | undefined {
  const oneLine = new RegExp(
    `<!--\\s*pvv:b64:${key}:([A-Za-z0-9+/=]+)\\s*-->`,
  );
  const m1 = body.match(oneLine);
  if (m1) {
    try {
      return b64ToUtf8(m1[1] ?? "");
    } catch {
      return undefined;
    }
  }
  const re = new RegExp(
    `<!-- pvv:b64:${key} -->\\s*([A-Za-z0-9+/=]*)\\s*<!-- /pvv:b64:${key} -->`,
    "s",
  );
  const m = body.match(re);
  if (!m) {
    return undefined;
  }
  try {
    return b64ToUtf8(m[1] ?? "");
  } catch {
    return undefined;
  }
}

/** Felt som finnes i GitHub-body (markører) mappes til kandidatfelter. */
export function extractPvvSyncedFieldsFromGithubIssueBody(body: string): {
  notes?: string;
  linkHintBusinessOwner?: string;
  linkHintSystems?: string;
  linkHintComplianceNotes?: string;
} {
  const notes = extractBlock(body, "notes");
  const owner = extractBlock(body, "owner");
  const systems = extractBlock(body, "systems");
  const compliance = extractBlock(body, "compliance");
  const out: {
    notes?: string;
    linkHintBusinessOwner?: string;
    linkHintSystems?: string;
    linkHintComplianceNotes?: string;
  } = {};
  if (notes !== undefined) {
    out.notes = notes;
  }
  if (owner !== undefined) {
    out.linkHintBusinessOwner = owner;
  }
  if (systems !== undefined) {
    out.linkHintSystems = systems;
  }
  if (compliance !== undefined) {
    out.linkHintComplianceNotes = compliance;
  }
  return out;
}

/** Omslutter innhold PVV genererer til GitHub; tekst utenfor bevares ved synk. */
export const PVV_MANAGED_START = "<!-- pvv:managed:start -->";
export const PVV_MANAGED_END = "<!-- pvv:managed:end -->";

/**
 * Slår sammen eksisterende issue-body med ny PVV-Markdown.
 * - Innhold **over** `PVV_MANAGED_START` og **under** `PVV_MANAGED_END` endres ikke av PVV.
 * - Første gang (ingen markører): legges PVV-blokken til under eksisterende tekst (f.eks. notater over).
 * - Hvis hele body ser ut som gammel PVV uten brukertillegg, erstattes den med én managed-blokk (unngår duplikat ved oppgradering).
 */
export function mergePvvManagedGithubBody(
  existingBody: string | null | undefined,
  newManagedMarkdown: string,
): string {
  const inner = newManagedMarkdown.trim();
  const managed = `${PVV_MANAGED_START}\n${inner}\n<!-- pvv:hint: Fritekst utenfor start-/end-markørene bevares ved synk fra PVV. -->\n${PVV_MANAGED_END}`;
  const existing = existingBody ?? "";
  const startIdx = existing.indexOf(PVV_MANAGED_START);
  const endIdx = existing.indexOf(PVV_MANAGED_END);
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    const prefix = existing.slice(0, startIdx).replace(/\s+$/, "");
    const suffix = existing
      .slice(endIdx + PVV_MANAGED_END.length)
      .replace(/^\s+/, "");
    const parts = [prefix, managed, suffix].filter((p) => p.length > 0);
    return parts.join("\n\n");
  }
  const trimmed = existing.trim();
  if (!trimmed) {
    return managed;
  }
  if (looksLikeLegacyPvvBodyOnly(trimmed)) {
    return managed;
  }
  return `${trimmed}\n\n${managed}`;
}

/** Heuristikk: tidligere full synk uten managed-markører (unngår dobbel PVV-blokk ved første synk etter oppgradering). */
function looksLikeLegacyPvvBodyOnly(s: string): boolean {
  if (s.includes(PVV_MANAGED_START)) return false;
  if (!/_Synkronisert fra PVV/i.test(s)) return false;
  if (!/##\s+Prosessregister/i.test(s)) return false;
  const before = s.split(/^#\s+/m)[0]?.trim() ?? "";
  return before.length === 0;
}
