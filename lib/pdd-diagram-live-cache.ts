/**
 * Siste tldraw-JSON per diagram i denne nettleserfanen.
 * Brukes av PDF-eksport så tegning ikke går tapt pga. debounce før lagring i React-state.
 */

const cache = new Map<string, string>();

function key(docKey: string, kind: "asIs" | "toBe") {
  return `${docKey}:${kind}`;
}

export function setPddDiagramLiveSnapshot(
  docKey: string,
  kind: "asIs" | "toBe",
  json: string,
) {
  const t = json.trim();
  if (!t) {
    cache.delete(key(docKey, kind));
    return;
  }
  cache.set(key(docKey, kind), t);
}

export function resolvePddDiagramSnapshot(
  docKey: string,
  kind: "asIs" | "toBe",
  fromPayload: string | undefined,
): string | undefined {
  const live = cache.get(key(docKey, kind))?.trim();
  if (live) return live;
  const fromDoc = fromPayload?.trim();
  return fromDoc || undefined;
}
