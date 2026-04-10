"use client";

import "@tldraw/tldraw/tldraw.css";

import {
  Tldraw,
  createTLStore,
  defaultBindingUtils,
  defaultShapeUtils,
} from "@tldraw/tldraw";
import type { ArrowShapeUtil, Editor, TLEditorSnapshot } from "@tldraw/tldraw";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { useCallback, useEffect, useMemo, useRef } from "react";

/**
 * Pil mot bundne former: større snap-radier + pnpm-patch (BOUND_ARROW_OFFSET, kantsnapping for arc-piler).
 * Arc-piler på lukkede former prioriterer kant (ikke senter) via patch av arrowTargetState.
 * Ikke overstyr shouldBeExact — isExact-bindinger kan gi løse ankre ved flytting.
 */
function configurePddArrowBindings(editor: Editor) {
  const util = editor.getShapeUtil("arrow") as ArrowShapeUtil;
  if (!util?.options) return;
  Object.assign(util.options, {
    arcArrowCenterSnapDistance: 32,
    elbowArrowCenterSnapDistance: 48,
    elbowArrowEdgeSnapDistance: 44,
    elbowArrowPointSnapDistance: 52,
    elbowArrowAxisSnapDistance: 36,
    pointingPreciseTimeout: 220,
  });
}

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

export function PddTldrawCanvas({
  snapshotJson,
  onSnapshotChange,
  readOnly,
  instanceKey,
  layoutVariant = "embed",
  className,
}: {
  snapshotJson: string | undefined;
  onSnapshotChange?: (json: string) => void;
  readOnly: boolean;
  /** Endres ved ny serverdata (revisjon) for å laste inn lagret tegning på nytt. */
  instanceKey: string;
  /** `fullscreen`: fyll tilgjengelig høyde (brukes med Fullscreen API). */
  layoutVariant?: "embed" | "fullscreen";
  className?: string;
}) {
  const store = useMemo(() => {
    const snap = parsePddTldrawDocumentSnapshot(snapshotJson);
    return createTLStore({
      shapeUtils: defaultShapeUtils,
      bindingUtils: defaultBindingUtils,
      ...(snap ? { snapshot: snap } : {}),
    });
    // Bruker ikke snapshotJson som dependency: lokale tegneoppdateringer skal ikke remounte store.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instanceKey]);

  const storeRef = useRef(store);
  storeRef.current = store;

  const editorRef = useRef<Editor | null>(null);
  useEffect(() => {
    editorRef.current?.updateInstanceState({ isReadonly: readOnly });
  }, [readOnly]);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSentRef = useRef<string | null>(snapshotJson ?? null);

  useEffect(() => {
    lastSentRef.current = snapshotJson ?? null;
  }, [snapshotJson]);

  const flushToParent = useCallback(() => {
    if (!onSnapshotChange || readOnly) return;
    const doc = storeRef.current.getStoreSnapshot();
    const json = JSON.stringify({ document: doc });
    if (json === lastSentRef.current) return;
    lastSentRef.current = json;
    onSnapshotChange(json);
  }, [onSnapshotChange, readOnly]);

  useEffect(() => {
    if (readOnly || !onSnapshotChange) return;
    const unsub = store.listen(
      () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          debounceRef.current = null;
          flushToParent();
        }, 450);
      },
      { source: "user", scope: "document" },
    );
    return () => {
      unsub();
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      if (!readOnly) {
        const doc = store.getStoreSnapshot();
        const json = JSON.stringify({ document: doc });
        if (json !== lastSentRef.current) {
          lastSentRef.current = json;
          onSnapshotChange(json);
        }
      }
    };
  }, [store, readOnly, onSnapshotChange]);

  useEffect(() => {
    const ed = editorRef.current;
    if (!ed) return;
    const container = ed.getContainer();
    const canvas = container.querySelector(".tl-canvas") as HTMLElement | null;
    const id = requestAnimationFrame(() => {
      ed.updateViewportScreenBounds(canvas ?? container);
    });
    return () => cancelAnimationFrame(id);
  }, [layoutVariant]);

  const heightClass =
    layoutVariant === "fullscreen"
      ? "h-full min-h-0 flex-1"
      : "h-[clamp(22rem,68svh,34rem)] min-h-[22rem] sm:h-[min(34rem,70vh)] sm:min-h-[24rem]";

  const trapScrollKeys = useCallback((e: ReactKeyboardEvent) => {
    const scrollKeys = new Set([
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "PageUp",
      "PageDown",
      "Home",
      "End",
      " ",
    ]);
    if (scrollKeys.has(e.key)) {
      e.stopPropagation();
    }
  }, []);

  return (
    <div
      onKeyDown={trapScrollKeys}
      className={[
        "relative w-full overflow-hidden rounded-2xl border border-border/60 bg-muted/10 touch-manipulation shadow-sm [overscroll-behavior:contain]",
        heightClass,
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <Tldraw
        store={store}
        onMount={(editor) => {
          editorRef.current = editor;
          editor.updateInstanceState({ isReadonly: readOnly });
          configurePddArrowBindings(editor);
          return () => {
            editorRef.current = null;
          };
        }}
      />
    </div>
  );
}
