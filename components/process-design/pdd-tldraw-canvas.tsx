"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  DefaultDashStyle,
  DrawShapeUtil,
  Tldraw,
  createTLStore,
  defaultBindingUtils,
  defaultShapeUtils,
} from "@tldraw/tldraw";
import type { ArrowShapeUtil, Editor } from "@tldraw/tldraw";
import {
  beginPddDiagramClear,
  endPddDiagramClear,
  isPddDiagramClearInProgress,
  resolvePddDiagramSnapshot,
  setPddDiagramLiveSnapshot,
} from "@/lib/pdd-diagram-live-cache";
import { parsePddTldrawDocumentSnapshot } from "@/lib/pdd-diagram-snapshot";
import { cn } from "@/lib/utils";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";

export { parsePddTldrawDocumentSnapshot } from "@/lib/pdd-diagram-snapshot";

/** Lengre frie Pencil-streker før tldraw splitter automatisk (default 600). */
const PDD_MAX_DRAW_POINTS = 1400;

const PddDrawShapeUtil = DrawShapeUtil.configure({
  maxPointsPerShape: PDD_MAX_DRAW_POINTS,
});

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

function prefersPenFirstSurface(): boolean {
  if (typeof window === "undefined") return false;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const hasTouch = navigator.maxTouchPoints > 0;
  return coarse || hasTouch;
}

function syncEditorViewport(editor: Editor) {
  const container = editor.getContainer();
  const rect = container.getBoundingClientRect();
  /* Unngå å synce inn i 0×0 (iOS kollaps midt i streken). */
  if (rect.width < 8 || rect.height < 8) return;
  const canvas = container.querySelector(".tl-canvas") as HTMLElement | null;
  editor.updateViewportScreenBounds(canvas ?? container);
}

/** Rydd «skygge» etter visking (stuck erasing-state / canvas lag). */
function clearEraserArtifacts(editor: Editor) {
  try {
    editor.setErasingShapes([]);
  } catch {
    /* ignore */
  }
  try {
    syncEditorViewport(editor);
    const cam = editor.getCamera();
    editor.setCamera({ ...cam });
  } catch {
    /* ignore */
  }
}

function clearAllShapesOnPage(editor: Editor) {
  try {
    const ids = [...editor.getCurrentPageShapeIds()];
    if (ids.length > 0) {
      editor.deleteShapes(ids);
    }
    editor.selectNone();
    editor.clearHistory();
    clearEraserArtifacts(editor);
  } catch (err) {
    console.error("[pdd-diagram] clearAllShapesOnPage failed", err);
  }
}

/**
 * Freehand: trykkfølsom blyant, palm rejection, lengre streker.
 * Verktøybytte (blyant/viskelær) skjer via tldraw sin egen toolbar.
 */
function configurePddFreehandDrawing(
  editor: Editor,
  readOnly: boolean,
  opts?: { lockTouchScroll?: boolean },
) {
  const drawUtil = editor.getShapeUtil("draw") as DrawShapeUtil | undefined;
  if (drawUtil?.options) {
    Object.assign(drawUtil.options, {
      maxPointsPerShape: PDD_MAX_DRAW_POINTS,
    });
  }

  editor.setStyleForNextShapes(DefaultDashStyle, "draw");

  if (!readOnly && prefersPenFirstSurface()) {
    editor.setCurrentTool("draw");
  }

  const container = editor.getContainer();
  container.classList.add("pdd-tldraw-pen-ready");

  let strokeActive = false;
  let toolBeforeEraserTip: string | null = null;
  const lockTouchScroll = opts?.lockTouchScroll ?? false;

  const isEventOnCanvas = (target: EventTarget | null) => {
    if (!(target instanceof Node)) return false;
    if (target instanceof Element) {
      if (
        target.closest(".tlui-button") ||
        target.closest(".tlui-toolbar") ||
        target.closest(".tlui-style-panel") ||
        target.closest(".tlui-menu")
      ) {
        return false;
      }
    }
    return container.contains(target);
  };

  const blockPageScroll = (event: TouchEvent | WheelEvent) => {
    if (!lockTouchScroll && !strokeActive) return;
    event.preventDefault();
  };

  const isEraserHardware = (event: PointerEvent) =>
    event.button === 5 ||
    (typeof event.buttons === "number" && (event.buttons & 32) !== 0);

  const onPointerDownCapture = (event: PointerEvent) => {
    if (readOnly) return;
    if (!isEventOnCanvas(event.target)) return;

    /* Finger + penn: lås scroll mens man tegner (ellers «forsvinner» diagrammet på iOS). */
    if (event.pointerType === "pen" || event.pointerType === "touch") {
      strokeActive = true;
    }

    if (event.pointerType !== "pen") return;

    if (!editor.getInstanceState().isPenMode) {
      editor.updateInstanceState({ isPenMode: true });
    }

    // Bakside/viskelær-spiss når OS eksponerer den (ikke sidetrykk-gest)
    if (isEraserHardware(event)) {
      if (editor.getCurrentToolId() !== "eraser") {
        toolBeforeEraserTip = editor.getCurrentToolId();
        editor.setCurrentTool("eraser");
      }
      return;
    }

    // Ikke overstyr når bruker har valgt viskelær/andre verktøy i toolbar
    const toolId = editor.getCurrentToolId();
    if (toolId === "select" || toolId === "hand") {
      editor.setCurrentTool("draw");
    }
  };

  const onPointerUpCapture = (event: PointerEvent) => {
    if (event.pointerType !== "pen" && event.pointerType !== "touch") {
      return;
    }
    strokeActive = false;
    if (readOnly) return;

    // Etter visking: fjern halvtransparent «skygge» og tving canvas-oppdatering
    if (editor.getCurrentToolId() === "eraser") {
      requestAnimationFrame(() => {
        clearEraserArtifacts(editor);
        requestAnimationFrame(() => clearEraserArtifacts(editor));
      });
    }

    if (isEraserHardware(event) && toolBeforeEraserTip) {
      const restore = toolBeforeEraserTip;
      toolBeforeEraserTip = null;
      if (restore !== "eraser") {
        editor.setCurrentTool(restore);
      }
    }
  };

  document.addEventListener("pointerdown", onPointerDownCapture, true);
  document.addEventListener("pointerup", onPointerUpCapture, true);
  document.addEventListener("pointercancel", onPointerUpCapture, true);
  container.addEventListener("touchmove", blockPageScroll, { passive: false });
  container.addEventListener("wheel", blockPageScroll, { passive: false });

  return () => {
    strokeActive = false;
    container.classList.remove("pdd-tldraw-pen-ready");
    document.removeEventListener("pointerdown", onPointerDownCapture, true);
    document.removeEventListener("pointerup", onPointerUpCapture, true);
    document.removeEventListener("pointercancel", onPointerUpCapture, true);
    container.removeEventListener("touchmove", blockPageScroll);
    container.removeEventListener("wheel", blockPageScroll);
  };
}

export function PddTldrawCanvas({
  snapshotJson,
  onSnapshotChange,
  readOnly,
  instanceKey,
  diagramKind,
  layoutVariant = "embed",
  onClearNowReady,
  className,
}: {
  snapshotJson: string | undefined;
  onSnapshotChange?: (json: string) => void;
  readOnly: boolean;
  instanceKey: string;
  diagramKind?: "asIs" | "toBe";
  layoutVariant?: "embed" | "fullscreen";
  /** Registrer funksjon som tømmer lerretet in-place (ingen remount). */
  onClearNowReady?: (clearNow: (() => void) | null) => void;
  className?: string;
}) {
  const suppressFlushRef = useRef(false);
  const onSnapshotChangeRef = useRef(onSnapshotChange);
  onSnapshotChangeRef.current = onSnapshotChange;

  const store = useMemo(() => {
    const source = diagramKind
      ? resolvePddDiagramSnapshot(instanceKey, diagramKind, snapshotJson)
      : snapshotJson;
    const snap = parsePddTldrawDocumentSnapshot(source);
    return createTLStore({
      shapeUtils: [
        ...defaultShapeUtils.filter((u) => u.type !== "draw"),
        PddDrawShapeUtil,
      ],
      bindingUtils: defaultBindingUtils,
      ...(snap ? { snapshot: snap } : {}),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instanceKey]);

  const licenseKey = process.env.NEXT_PUBLIC_TLDRAW_LICENSE_KEY;

  const storeRef = useRef(store);
  storeRef.current = store;

  const editorRef = useRef<Editor | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    editorRef.current?.updateInstanceState({ isReadonly: readOnly });
  }, [readOnly]);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSentRef = useRef<string | null>(snapshotJson ?? null);

  useEffect(() => {
    lastSentRef.current = snapshotJson ?? null;
  }, [snapshotJson]);

  const writeLiveCache = useCallback(
    (json: string) => {
      if (!diagramKind) return;
      setPddDiagramLiveSnapshot(instanceKey, diagramKind, json);
    },
    [diagramKind, instanceKey],
  );

  const clearNow = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }

    if (diagramKind) {
      beginPddDiagramClear(instanceKey, diagramKind);
    }
    suppressFlushRef.current = true;

    const ed = editorRef.current;
    if (ed) {
      clearAllShapesOnPage(ed);
      requestAnimationFrame(() => {
        try {
          syncEditorViewport(ed);
        } catch {
          /* ignore */
        }
      });
    }

    writeLiveCache("");
    lastSentRef.current = "";
    onSnapshotChangeRef.current?.("");

    suppressFlushRef.current = false;
    if (diagramKind) {
      // Kort delay: la eventuelle pending listen-callbacks falle gjennom suppress
      window.setTimeout(() => {
        endPddDiagramClear(instanceKey, diagramKind);
      }, 100);
    }
  }, [diagramKind, instanceKey, writeLiveCache]);

  useEffect(() => {
    onClearNowReady?.(clearNow);
    return () => onClearNowReady?.(null);
  }, [clearNow, onClearNowReady]);

  const flushToParent = useCallback(() => {
    const onChange = onSnapshotChangeRef.current;
    if (!onChange || readOnly) return;
    if (suppressFlushRef.current) return;
    if (
      diagramKind != null &&
      isPddDiagramClearInProgress(instanceKey, diagramKind)
    ) {
      return;
    }
    const doc = storeRef.current.getStoreSnapshot();
    const json = JSON.stringify({ document: doc });
    writeLiveCache(json);
    if (json === lastSentRef.current) return;
    lastSentRef.current = json;
    onChange(json);
  }, [readOnly, writeLiveCache, diagramKind, instanceKey]);

  useLayoutEffect(() => {
    if (readOnly || !onSnapshotChangeRef.current) return;
    const unsub = store.listen(
      () => {
        if (suppressFlushRef.current) return;
        if (
          diagramKind != null &&
          isPddDiagramClearInProgress(instanceKey, diagramKind)
        ) {
          return;
        }
        const doc = storeRef.current.getStoreSnapshot();
        const json = JSON.stringify({ document: doc });
        writeLiveCache(json);
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
      if (
        suppressFlushRef.current ||
        (diagramKind != null &&
          isPddDiagramClearInProgress(instanceKey, diagramKind))
      ) {
        writeLiveCache("");
        lastSentRef.current = "";
        return;
      }
      if (!readOnly) {
        const doc = store.getStoreSnapshot();
        const json = JSON.stringify({ document: doc });
        writeLiveCache(json);
        if (json !== lastSentRef.current) {
          lastSentRef.current = json;
          onSnapshotChangeRef.current?.(json);
        }
      }
    };
  }, [
    store,
    readOnly,
    flushToParent,
    writeLiveCache,
    diagramKind,
    instanceKey,
  ]);

  useEffect(() => {
    if (!diagramKind) return;
    if (!snapshotJson?.trim()) {
      setPddDiagramLiveSnapshot(instanceKey, diagramKind, "");
      return;
    }
    if (
      suppressFlushRef.current ||
      isPddDiagramClearInProgress(instanceKey, diagramKind)
    ) {
      return;
    }
    writeLiveCache(snapshotJson);
  }, [diagramKind, snapshotJson, instanceKey, writeLiveCache]);

  useEffect(() => {
    const shell = containerRef.current;
    if (!shell) return;

    let pointerDown = false;
    let syncTimer: number | undefined;
    let frozenHeight = "";
    let frozenWidth = "";

    const refresh = () => {
      const editor = editorRef.current;
      if (!editor) return;
      /* Ikke re-mål midt i streken — visualViewport hopper på mobil. */
      if (pointerDown) return;
      const rect = shell.getBoundingClientRect();
      if (rect.width < 8 || rect.height < 8) return;
      syncEditorViewport(editor);
    };

    const scheduleRefresh = () => {
      window.clearTimeout(syncTimer);
      syncTimer = window.setTimeout(refresh, 120);
    };

    const freezeShellSize = () => {
      const rect = shell.getBoundingClientRect();
      if (rect.width < 8 || rect.height < 8) return;
      frozenWidth = shell.style.width;
      frozenHeight = shell.style.height;
      shell.style.right = "auto";
      shell.style.bottom = "auto";
      shell.style.top = "0";
      shell.style.left = "0";
      shell.style.width = `${Math.round(rect.width)}px`;
      shell.style.height = `${Math.round(rect.height)}px`;
    };

    const unfreezeShellSize = () => {
      shell.style.width = frozenWidth;
      shell.style.height = frozenHeight;
      shell.style.top = "";
      shell.style.left = "";
      shell.style.right = "";
      shell.style.bottom = "";
      frozenWidth = "";
      frozenHeight = "";
    };

    const onPointerDown = () => {
      pointerDown = true;
      if (layoutVariant === "fullscreen") {
        freezeShellSize();
      }
    };
    const onPointerUp = () => {
      pointerDown = false;
      if (layoutVariant === "fullscreen") {
        unfreezeShellSize();
      }
      scheduleRefresh();
    };

    refresh();
    const ro = new ResizeObserver(() => {
      if (pointerDown) return;
      requestAnimationFrame(refresh);
    });
    ro.observe(shell);
    window.addEventListener("orientationchange", scheduleRefresh);
    window.addEventListener("resize", scheduleRefresh);
    const vv = window.visualViewport;
    vv?.addEventListener("resize", scheduleRefresh);
    vv?.addEventListener("scroll", scheduleRefresh);
    shell.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);

    return () => {
      window.clearTimeout(syncTimer);
      ro.disconnect();
      window.removeEventListener("orientationchange", scheduleRefresh);
      window.removeEventListener("resize", scheduleRefresh);
      vv?.removeEventListener("resize", scheduleRefresh);
      vv?.removeEventListener("scroll", scheduleRefresh);
      shell.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      unfreezeShellSize();
    };
  }, [layoutVariant, store]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || layoutVariant === "fullscreen") return;

    let rafId: number | null = null;
    let lastScroll = { top: 0, left: 0 };

    const rememberScroll = () => {
      const root = document.scrollingElement;
      if (!root) return;
      lastScroll = { top: root.scrollTop, left: root.scrollLeft };
    };

    const restoreScroll = () => {
      rafId = null;
      const root = document.scrollingElement;
      if (!root) return;
      if (
        root.scrollTop !== lastScroll.top ||
        root.scrollLeft !== lastScroll.left
      ) {
        root.scrollTo({
          top: lastScroll.top,
          left: lastScroll.left,
          behavior: "instant",
        });
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const isTldrawUi =
        el.contains(target) ||
        target.closest("[data-tldraw-ui]") ||
        target.closest(".tlui-popover") ||
        target.closest(".tlui-menu") ||
        target.closest(".tlui-style-panel");
      if (!isTldrawUi) return;
      rememberScroll();
    };

    const onFocusIn = (event: FocusEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const isTldrawUi =
        el.contains(target) ||
        target.closest("[data-tldraw-ui]") ||
        target.closest(".tlui-popover") ||
        target.closest(".tlui-menu") ||
        target.closest(".tlui-style-panel");
      if (!isTldrawUi) return;
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(restoreScroll);
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("focusin", onFocusIn, true);
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("focusin", onFocusIn, true);
    };
  }, [layoutVariant]);

  const heightClass =
    layoutVariant === "fullscreen"
      ? "absolute inset-0 h-full w-full"
      : "h-[clamp(22rem,68svh,34rem)] min-h-[22rem] sm:h-[min(34rem,70vh)] sm:min-h-[24rem]";

  const requiresProductionLicense = useMemo(() => {
    if (typeof window === "undefined") return false;
    const { hostname, protocol } = window.location;
    return (
      protocol === "https:" &&
      hostname !== "localhost" &&
      hostname !== "127.0.0.1"
    );
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
        className={cn(
          "relative w-full overflow-hidden rounded-2xl border border-border/60 bg-muted/10 p-4 shadow-sm",
          heightClass,
          className,
        )}
      >
        <div className="flex h-full items-center justify-center">
          <Alert className="max-w-xl border-amber-500/30 bg-amber-500/[0.06]">
            <AlertTitle>
              Diagrammet er ikke tilgjengelig i produksjon ennå
            </AlertTitle>
            <AlertDescription>
              `tldraw` krever en gyldig produksjonslisens. Legg inn
              ` NEXT_PUBLIC_TLDRAW_LICENSE_KEY ` i Vercel og redeploy, ellers
              vises ikke diagrammet riktig.
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
      className={cn(
        "pdd-tldraw-canvas relative w-full overflow-hidden rounded-2xl border border-border/60 bg-muted/10 shadow-sm touch-none select-none [overscroll-behavior:contain] [overflow-anchor:none] [-webkit-touch-callout:none]",
        heightClass,
        className,
      )}
    >
      <Tldraw
        licenseKey={licenseKey}
        store={store}
        shapeUtils={[PddDrawShapeUtil]}
        onMount={(editor) => {
          editorRef.current = editor;
          editor.updateInstanceState({ isReadonly: readOnly });
          configurePddArrowBindings(editor);
          const cleanupFreehand = configurePddFreehandDrawing(
            editor,
            readOnly,
            { lockTouchScroll: layoutVariant === "fullscreen" },
          );
          requestAnimationFrame(() => {
            syncEditorViewport(editor);
            requestAnimationFrame(() => syncEditorViewport(editor));
          });
          return () => {
            cleanupFreehand();
            editorRef.current = null;
          };
        }}
      />
    </div>
  );
}
