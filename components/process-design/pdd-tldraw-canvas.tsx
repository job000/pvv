"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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

type ScrollTarget = Window | HTMLElement;

type ScrollSnapshot = {
  target: ScrollTarget;
  left: number;
  top: number;
};

function isWindowTarget(target: ScrollTarget): target is Window {
  return target === window;
}

function isScrollable(element: HTMLElement) {
  const style = window.getComputedStyle(element);
  const overflowY = style.overflowY;
  const overflowX = style.overflowX;
  const canScrollY =
    /(auto|scroll|overlay)/.test(overflowY) && element.scrollHeight > element.clientHeight;
  const canScrollX =
    /(auto|scroll|overlay)/.test(overflowX) && element.scrollWidth > element.clientWidth;
  return canScrollY || canScrollX;
}

function getScrollTargets(start: HTMLElement): ScrollTarget[] {
  const targets: ScrollTarget[] = [];
  let current = start.parentElement;

  while (current) {
    if (isScrollable(current)) {
      targets.push(current);
    }
    current = current.parentElement;
  }

  const root = document.scrollingElement;
  if (root && (root.scrollHeight > window.innerHeight || root.scrollWidth > window.innerWidth)) {
    targets.push(window);
  }

  return targets;
}

function readScrollPosition(target: ScrollTarget) {
  if (isWindowTarget(target)) {
    return { left: window.scrollX, top: window.scrollY };
  }
  return { left: target.scrollLeft, top: target.scrollTop };
}

function restoreScrollPosition(snapshot: ScrollSnapshot) {
  if (isWindowTarget(snapshot.target)) {
    window.scrollTo({ left: snapshot.left, top: snapshot.top, behavior: "instant" });
    return;
  }
  if (
    snapshot.target.scrollLeft !== snapshot.left ||
    snapshot.target.scrollTop !== snapshot.top
  ) {
    snapshot.target.scrollTo({ left: snapshot.left, top: snapshot.top, behavior: "instant" });
  }
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
  const licenseKey = process.env.NEXT_PUBLIC_TLDRAW_LICENSE_KEY;

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

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let snapshots: ScrollSnapshot[] = [];
    let armedUntil = 0;
    let frameId: number | null = null;

    const stopLoop = () => {
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
        frameId = null;
      }
    };

    const tick = () => {
      if (Date.now() >= armedUntil) {
        stopLoop();
        return;
      }
      for (const snapshot of snapshots) {
        restoreScrollPosition(snapshot);
      }
      frameId = requestAnimationFrame(tick);
    };

    const lock = (ms: number) => {
      snapshots = getScrollTargets(el).map((target) => {
        const position = readScrollPosition(target);
        return { target, ...position };
      });
      armedUntil = Date.now() + ms;
      if (frameId === null) {
        frameId = requestAnimationFrame(tick);
      }
    };

    const arm = (ms: number) => {
      lock(ms);
    };

    const isArmed = () => Date.now() < armedUntil;

    const onPointerDown = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (!el.contains(target)) return;
      arm(1800);
      lock(1800);
    };

    const onFocusIn = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (!el.contains(target) && !isArmed()) return;
      lock(1500);
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("focusin", onFocusIn, true);

    return () => {
      stopLoop();
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("focusin", onFocusIn, true);
    };
  }, []);

  const requiresProductionLicense = useMemo(() => {
    if (typeof window === "undefined") return false;
    const { hostname, protocol } = window.location;
    return protocol === "https:" && hostname !== "localhost" && hostname !== "127.0.0.1";
  }, []);

  const showLicenseFallback = requiresProductionLicense && !licenseKey;

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
    if (!scrollKeys.has(e.key)) return;
    const target = e.target as HTMLElement;
    if (
      target.closest("input") ||
      target.closest("textarea") ||
      target.closest("select") ||
      target.closest("[role='textbox']") ||
      target.closest("[contenteditable='true']")
    ) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
  }, []);

  if (showLicenseFallback) {
    return (
      <div
        className={[
          "relative w-full overflow-hidden rounded-2xl border border-border/60 bg-muted/10 p-4 shadow-sm",
          heightClass,
          className ?? "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <div className="flex h-full items-center justify-center">
          <Alert className="max-w-xl border-amber-500/30 bg-amber-500/[0.06]">
            <AlertTitle>Diagrammet er ikke tilgjengelig i produksjon ennå</AlertTitle>
            <AlertDescription>
              `tldraw` krever en gyldig produksjonslisens. Legg inn
              ` NEXT_PUBLIC_TLDRAW_LICENSE_KEY ` i Vercel og redeploy, ellers vises
              ikke diagrammet riktig.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onKeyDown={trapScrollKeys}
      className={[
        "relative w-full overflow-hidden rounded-2xl border border-border/60 bg-muted/10 touch-manipulation shadow-sm [overscroll-behavior:contain] [overflow-anchor:none]",
        heightClass,
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <Tldraw
        licenseKey={licenseKey}
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
