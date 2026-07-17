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
import { toast } from "sonner";

export { parsePddTldrawDocumentSnapshot } from "@/lib/pdd-diagram-snapshot";

/** Lengre frie Pencil-streker før tldraw splitter automatisk (default 600). */
const PDD_MAX_DRAW_POINTS = 1400;

const PddDrawShapeUtil = DrawShapeUtil.configure({
  maxPointsPerShape: PDD_MAX_DRAW_POINTS,
});

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

function prefersPenFirstSurface(): boolean {
  if (typeof window === "undefined") return false;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const hasTouch = navigator.maxTouchPoints > 0;
  return coarse || hasTouch;
}

function syncEditorViewport(editor: Editor) {
  const container = editor.getContainer();
  const canvas = container.querySelector(".tl-canvas") as HTMLElement | null;
  editor.updateViewportScreenBounds(canvas ?? container);
}

function clearAllShapesOnPage(editor: Editor) {
  const ids = [...editor.getCurrentPageShapeIds()];
  if (ids.length > 0) {
    editor.run(() => {
      editor.deleteShapes(ids);
    });
  }
  // Ekstra pass: select-all + delete (grupper / skjulte valg)
  editor.selectAll();
  const selected = [...editor.getSelectedShapeIds()];
  if (selected.length > 0) {
    editor.run(() => {
      editor.deleteShapes(selected);
    });
  }
  editor.selectNone();
  editor.clearHistory();
}

/**
 * Concepts-lignende freehand: trykkfølsom blyant, palm rejection, lengre streker.
 * Apple Pencil aktiverer pen-modus og bytter til tegneverktøy fra select/hand.
 *
 * Merk: Apple Pencil «dobbelttrykk på pennen» (barrel) er ikke eksponert i Safari.
 * Vi støtter derfor dobbelttrykk med Pencil-spissen på lerretet → bytt blyant/viskelær.
 */
function configurePddFreehandDrawing(editor: Editor, readOnly: boolean) {
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

  let penStrokeActive = false;
  let toolBeforeEraser: string | null = null;

  // Dobbelttrykk med Pencil på lerretet (web-erstatning for barrel double-tap)
  let lastPenTapAt = 0;
  let lastPenTapX = 0;
  let lastPenTapY = 0;
  let penDownAt = 0;
  let penDownX = 0;
  let penDownY = 0;
  let penMovedFar = false;

  const isEventOnCanvas = (target: EventTarget | null) => {
    if (!(target instanceof Node)) return false;
    return container.contains(target);
  };

  const blockPageScroll = (event: TouchEvent | WheelEvent) => {
    if (!penStrokeActive) return;
    event.preventDefault();
  };

  const togglePenEraser = () => {
    if (readOnly) return;
    const toolId = editor.getCurrentToolId();
    if (toolId === "eraser") {
      const restore = toolBeforeEraser && toolBeforeEraser !== "eraser"
        ? toolBeforeEraser
        : "draw";
      editor.setCurrentTool(restore);
      toolBeforeEraser = null;
      toast.message("Blyant", { duration: 1200 });
    } else {
      toolBeforeEraser = toolId;
      editor.setCurrentTool("eraser");
      toast.message("Viskelær", { duration: 1200 });
    }
  };

  // Document-capture: bytt til blyant FØR tldraw behandler første Pencil-treff
  const onPointerDownCapture = (event: PointerEvent) => {
    if (readOnly) return;
    if (event.pointerType !== "pen") return;
    if (!isEventOnCanvas(event.target)) return;

    penStrokeActive = true;
    penDownAt = performance.now();
    penDownX = event.clientX;
    penDownY = event.clientY;
    penMovedFar = false;

    if (!editor.getInstanceState().isPenMode) {
      editor.updateInstanceState({ isPenMode: true });
    }

    // Stylus med viskelær-ende / sekundærknapp (der plattformen eksponerer det)
    const isEraserTip =
      event.button === 5 ||
      (typeof event.buttons === "number" && (event.buttons & 32) !== 0);
    if (isEraserTip) {
      if (editor.getCurrentToolId() !== "eraser") {
        toolBeforeEraser = editor.getCurrentToolId();
        editor.setCurrentTool("eraser");
      }
      return;
    }

    const toolId = editor.getCurrentToolId();
    // Behold Pil/form/tekst hvis brukeren aktivt valgte dem; ellers freehand
    if (toolId === "select" || toolId === "hand") {
      editor.setCurrentTool("draw");
    }
  };

  const onPointerMove = (event: PointerEvent) => {
    if (event.pointerType !== "pen") return;
    if (!penStrokeActive) return;
    const dx = event.clientX - penDownX;
    const dy = event.clientY - penDownY;
    if (dx * dx + dy * dy > 64) {
      penMovedFar = true;
    }
  };

  const endPenStroke = (event: PointerEvent) => {
    if (event.pointerType !== "pen") return;
    const wasActive = penStrokeActive;
    penStrokeActive = false;
    if (!wasActive || readOnly) return;
    if (!isEventOnCanvas(event.target) && event.type !== "pointerup") return;

    const duration = performance.now() - penDownAt;
    const isTap = !penMovedFar && duration < 280;
    if (!isTap) return;

    const now = performance.now();
    const dt = now - lastPenTapAt;
    const dx = event.clientX - lastPenTapX;
    const dy = event.clientY - lastPenTapY;
    const near = dx * dx + dy * dy < 900; // ~30px

    if (dt > 40 && dt < 420 && near) {
      lastPenTapAt = 0;
      togglePenEraser();
      return;
    }

    lastPenTapAt = now;
    lastPenTapX = event.clientX;
    lastPenTapY = event.clientY;
  };

  document.addEventListener("pointerdown", onPointerDownCapture, true);
  document.addEventListener("pointermove", onPointerMove, true);
  document.addEventListener("pointerup", endPenStroke, true);
  document.addEventListener("pointercancel", endPenStroke, true);
  // iPad: unngå at dokumentet scroller mens Pencil tegner i innfelt canvas
  container.addEventListener("touchmove", blockPageScroll, { passive: false });
  container.addEventListener("wheel", blockPageScroll, { passive: false });

  return () => {
    penStrokeActive = false;
    container.classList.remove("pdd-tldraw-pen-ready");
    document.removeEventListener("pointerdown", onPointerDownCapture, true);
    document.removeEventListener("pointermove", onPointerMove, true);
    document.removeEventListener("pointerup", endPenStroke, true);
    document.removeEventListener("pointercancel", endPenStroke, true);
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
  /** Økes når brukeren tømmer diagrammet — tvinger ny tom store. */
  clearNonce = 0,
  className,
}: {
  snapshotJson: string | undefined;
  onSnapshotChange?: (json: string) => void;
  readOnly: boolean;
  /** Endres ved ny serverdata (revisjon) for å laste inn lagret tegning på nytt. */
  instanceKey: string;
  /** Brukes til live-cache for PDF-eksport (As-Is / To-Be). */
  diagramKind?: "asIs" | "toBe";
  /** `fullscreen`: fyll tilgjengelig høyde (brukes med Fullscreen API). */
  layoutVariant?: "embed" | "fullscreen";
  clearNonce?: number;
  className?: string;
}) {
  /**
   * Blokkerer flush til parent under «Tøm diagram» slik at deleteShapes /
   * pending debounce ikke skriver streker tilbake.
   */
  const suppressFlushRef = useRef(false);

  const store = useMemo(() => {
    // Sett suppress synkront i render FØR gamle store-cleanups kjører,
    // ellers skrives formene tilbake til parent/live-cache ved tøm-remount.
    if (clearNonce > 0) {
      suppressFlushRef.current = true;
    }
    const source =
      clearNonce > 0
        ? undefined
        : diagramKind
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
  }, [instanceKey, clearNonce]);

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

  const flushToParent = useCallback(() => {
    if (!onSnapshotChange || readOnly) return;
    if (suppressFlushRef.current) return;
    const doc = storeRef.current.getStoreSnapshot();
    const json = JSON.stringify({ document: doc });
    writeLiveCache(json);
    if (json === lastSentRef.current) return;
    lastSentRef.current = json;
    onSnapshotChange(json);
  }, [onSnapshotChange, readOnly, writeLiveCache]);

  useLayoutEffect(() => {
    if (readOnly || !onSnapshotChange) return;
    const unsub = store.listen(
      () => {
        if (suppressFlushRef.current) return;
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
      // Ved tøm-remount: aldri flush gamle former fra forrige store
      if (clearNonce > 0 || suppressFlushRef.current) {
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
          onSnapshotChange(json);
        }
      }
    };
  }, [
    store,
    readOnly,
    onSnapshotChange,
    flushToParent,
    writeLiveCache,
    clearNonce,
  ]);

  useEffect(() => {
    if (!diagramKind) return;
    if (!snapshotJson?.trim()) {
      setPddDiagramLiveSnapshot(instanceKey, diagramKind, "");
      return;
    }
    if (suppressFlushRef.current) return;
    writeLiveCache(snapshotJson);
  }, [diagramKind, snapshotJson, instanceKey, writeLiveCache]);

  // «Tøm diagram»: tøm parent/cache; Tldraw remountes via key + ny tom store
  useLayoutEffect(() => {
    if (clearNonce === 0) {
      suppressFlushRef.current = false;
      return;
    }

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }

    suppressFlushRef.current = true;
    writeLiveCache("");
    lastSentRef.current = "";
    onSnapshotChange?.("");

    const ed = editorRef.current;
    if (ed) {
      clearAllShapesOnPage(ed);
    }

    // La tegning fungere igjen etter at remount/cleanup er ferdig
    const t = window.setTimeout(() => {
      suppressFlushRef.current = false;
    }, 0);
    return () => window.clearTimeout(t);
  }, [clearNonce, onSnapshotChange, writeLiveCache]);

  // Hold viewport i sync med container (fullskjerm, rotasjon, tastatur på iPad)
  useEffect(() => {
    const ed = editorRef.current;
    const shell = containerRef.current;
    if (!shell) return;

    const refresh = () => {
      const editor = editorRef.current;
      if (!editor) return;
      syncEditorViewport(editor);
    };

    refresh();
    const ro = new ResizeObserver(() => {
      requestAnimationFrame(refresh);
    });
    ro.observe(shell);
    window.addEventListener("orientationchange", refresh);
    window.addEventListener("resize", refresh);
    const vv = window.visualViewport;
    vv?.addEventListener("resize", refresh);
    vv?.addEventListener("scroll", refresh);

    return () => {
      ro.disconnect();
      window.removeEventListener("orientationchange", refresh);
      window.removeEventListener("resize", refresh);
      vv?.removeEventListener("resize", refresh);
      vv?.removeEventListener("scroll", refresh);
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
      if (root.scrollTop !== lastScroll.top || root.scrollLeft !== lastScroll.left) {
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
      ? "h-full min-h-0 w-full flex-1"
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
        key={`${instanceKey}:c${clearNonce}`}
        licenseKey={licenseKey}
        store={store}
        shapeUtils={[PddDrawShapeUtil]}
        onMount={(editor) => {
          editorRef.current = editor;
          editor.updateInstanceState({ isReadonly: readOnly });
          if (clearNonce > 0) {
            clearAllShapesOnPage(editor);
            writeLiveCache("");
            lastSentRef.current = "";
          }
          configurePddArrowBindings(editor);
          const cleanupFreehand = configurePddFreehandDrawing(
            editor,
            readOnly,
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
