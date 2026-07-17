/**
 * Rasteriserer lagret tldraw JSON til PNG (data-URL) for PDF-eksport.
 * Støtter flere pages per diagram.
 * Krever nettleser (Editor + canvas); brukes kun fra klient.
 */

import { parsePddTldrawDocumentSnapshot } from "@/lib/pdd-diagram-snapshot";

type TldrawModule = typeof import("@tldraw/tldraw");

export type PddDiagramRaster = {
  dataUrl: string;
  width: number;
  height: number;
  pageName: string;
};

function waitFrames(count: number): Promise<void> {
  return new Promise((resolve) => {
    let left = count;
    const tick = () => {
      left -= 1;
      if (left <= 0) resolve();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

export async function rasterizePddDiagramSnapshot(
  snapshotJson: string | undefined,
): Promise<PddDiagramRaster[] | null> {
  if (typeof window === "undefined") return null;
  const snap = parsePddTldrawDocumentSnapshot(snapshotJson);
  if (!snap?.document) return null;

  let tldraw: TldrawModule;
  try {
    tldraw = (await import("@tldraw/tldraw")) as TldrawModule;
  } catch (err) {
    console.error("[pdd-pdf] Klarte ikke å laste tldraw for rasterisering", err);
    return null;
  }

  const {
    createTLStore,
    defaultShapeUtils,
    defaultBindingUtils,
    defaultTools,
    Editor,
  } = tldraw;

  // TipTap-typer fra tldraw er ikke alltid eksportert rent — bruk løs typing her.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tipTapDefaultExtensions = (tldraw as any).tipTapDefaultExtensions as
    | any[]
    | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const defaultAddFontsFromNode = (tldraw as any).defaultAddFontsFromNode as
    | ((...args: any[]) => any)
    | undefined;

  let store;
  try {
    store = createTLStore({
      shapeUtils: defaultShapeUtils,
      bindingUtils: defaultBindingUtils,
      snapshot: snap,
    });
  } catch (err) {
    console.error("[pdd-pdf] Klarte ikke å laste diagram-snapshot", err);
    return null;
  }

  const container = document.createElement("div");
  container.setAttribute("data-pdd-pdf-export", "true");
  container.style.cssText =
    "position:fixed;left:-10000px;top:0;width:1200px;height:800px;overflow:hidden;opacity:0;pointer-events:none";
  document.body.appendChild(container);

  let editor: InstanceType<typeof Editor> | null = null;
  try {
    editor = new Editor({
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

    editor.updateViewportScreenBounds(container);
    await waitFrames(2);

    const pages = editor.getPages();
    const results: PddDiagramRaster[] = [];

    for (const page of pages) {
      editor.setCurrentPage(page.id);
      await waitFrames(1);

      const ids = [...editor.getCurrentPageShapeIds()];
      if (ids.length === 0) continue;

      try {
        editor.selectNone();
        editor.zoomToFit({ animation: { duration: 0 } });
        await waitFrames(2);

        const out = await editor.toImageDataUrl(ids, {
          format: "png",
          background: true,
          pixelRatio: 2,
          padding: 32,
        });
        if (!out?.url || out.width < 2 || out.height < 2) continue;

        results.push({
          dataUrl: out.url,
          width: out.width,
          height: out.height,
          pageName: page.name,
        });
      } catch (pageErr) {
        console.warn(
          `[pdd-pdf] Kunne ikke rasterisere side «${page.name}»`,
          pageErr,
        );
      }
    }

    return results.length > 0 ? results : null;
  } catch (err) {
    console.error("[pdd-pdf] Rasterisering feilet", err);
    return null;
  } finally {
    try {
      editor?.dispose();
    } catch {
      /* ignore */
    }
    container.remove();
  }
}
