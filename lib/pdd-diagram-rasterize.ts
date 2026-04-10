/**
 * Rasteriserer lagret tldraw JSON til PNG (data-URL) for PDF-eksport.
 * Støtter flere pages per diagram.
 * Krever nettleser (Offscreen Editor + canvas); brukes kun fra klient.
 */

type TldrawModule = typeof import("@tldraw/tldraw");

export type PddDiagramRaster = {
  dataUrl: string;
  width: number;
  height: number;
  pageName: string;
};

export async function rasterizePddDiagramSnapshot(
  snapshotJson: string | undefined,
): Promise<PddDiagramRaster[] | null> {
  if (typeof window === "undefined") return null;
  const raw = snapshotJson?.trim();
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }
  const doc = (parsed as { document?: unknown }).document;
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) {
    return null;
  }

  const tldraw = (await import("@tldraw/tldraw")) as TldrawModule;
  const {
    createTLStore,
    defaultShapeUtils,
    defaultBindingUtils,
    defaultTools,
    Editor,
  } = tldraw;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tipTapDefaultExtensions = (tldraw as any).tipTapDefaultExtensions as
    | any[]
    | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const defaultAddFontsFromNode = (tldraw as any).defaultAddFontsFromNode as
    | ((...args: any[]) => any)
    | undefined;

  const store = createTLStore({
    shapeUtils: defaultShapeUtils,
    bindingUtils: defaultBindingUtils,
    snapshot: { document: doc as never },
  });

  const container = document.createElement("div");
  container.setAttribute("data-pdd-pdf-export", "true");
  container.style.cssText =
    "position:fixed;left:-9999px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none";
  document.body.appendChild(container);

  const editor = new Editor({
    store,
    shapeUtils: defaultShapeUtils,
    bindingUtils: defaultBindingUtils,
    tools: defaultTools,
    getContainer: () => container,
    autoFocus: false,
    options: {
      text: {
        addFontsFromNode: defaultAddFontsFromNode,
        tipTapConfig: {
          extensions: tipTapDefaultExtensions ?? [],
        },
      },
    },
  });

  try {
    const pages = editor.getPages();
    const results: PddDiagramRaster[] = [];

    for (const page of pages) {
      editor.setCurrentPage(page.id);

      const ids = editor.getSortedChildIdsForParent(page.id);
      if (ids.length === 0) continue;

      editor.zoomToFit({ animation: { duration: 0 } });
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );

      const out = await editor.toImageDataUrl(ids, {
        format: "png",
        background: true,
        pixelRatio: 2,
        padding: 24,
      });
      if (!out?.url) continue;

      results.push({
        dataUrl: out.url,
        width: out.width,
        height: out.height,
        pageName: page.name,
      });
    }

    return results.length > 0 ? results : null;
  } finally {
    editor.dispose();
    container.remove();
  }
}
