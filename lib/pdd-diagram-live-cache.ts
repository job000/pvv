/**
 * Siste tldraw-JSON per diagram i denne nettleserfanen.
 * Brukes av PDF-eksport så tegning ikke går tapt pga. debounce før lagring i React-state.
 */

const cache = new Map<string, string>();

/** Under «Tøm diagram»-remount: gamle canvas-instanser må ikke flush'e former tilbake. */
const clearSuppress = new Set<string>();

function key(docKey: string, kind: "asIs" | "toBe") {
  return `${docKey}:${kind}`;
}

export function beginPddDiagramClear(
  docKey: string,
  kind: "asIs" | "toBe",
) {
  const k = key(docKey, kind);
  clearSuppress.add(k);
  cache.delete(k);
}

export function endPddDiagramClear(docKey: string, kind: "asIs" | "toBe") {
  clearSuppress.delete(key(docKey, kind));
}

export function isPddDiagramClearInProgress(
  docKey: string,
  kind: "asIs" | "toBe",
) {
  return clearSuppress.has(key(docKey, kind));
}

export function setPddDiagramLiveSnapshot(
  docKey: string,
  kind: "asIs" | "toBe",
  json: string,
) {
  const k = key(docKey, kind);
  // Under tøm: ignorer forsøk på å skrive ikke-tom JSON tilbake
  if (clearSuppress.has(k) && json.trim()) {
    return;
  }
  const t = json.trim();
  if (!t) {
    cache.delete(k);
    return;
  }
  cache.set(k, t);
}

export function resolvePddDiagramSnapshot(
  docKey: string,
  kind: "asIs" | "toBe",
  fromPayload: string | undefined,
): string | undefined {
  const k = key(docKey, kind);
  if (clearSuppress.has(k)) return undefined;
  const live = cache.get(k)?.trim();
  if (live) return live;
  const fromDoc = fromPayload?.trim();
  return fromDoc || undefined;
}
