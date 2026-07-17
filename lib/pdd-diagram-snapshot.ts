import type { TLEditorSnapshot } from "@tldraw/tldraw";

/** Parser lagret PDD-tldraw JSON (`{ document: { store, schema } }`). */
export function parsePddTldrawDocumentSnapshot(
  json: string | undefined,
): Partial<TLEditorSnapshot> | undefined {
  if (!json?.trim()) return undefined;
  try {
    const parsed: unknown = JSON.parse(json);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return undefined;
    }
    const doc = (parsed as { document?: unknown }).document;
    if (!doc || typeof doc !== "object" || Array.isArray(doc)) {
      return undefined;
    }
    const d = doc as { store?: unknown };
    if (!d.store || typeof d.store !== "object" || Array.isArray(d.store)) {
      return undefined;
    }
    return { document: doc as TLEditorSnapshot["document"] };
  } catch {
    return undefined;
  }
}
