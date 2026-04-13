"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Expand,
  Loader2,
  Maximize2,
  Shrink,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { Document, Page, pdfjs } from "react-pdf";

import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

if (typeof window !== "undefined") {
  pdfjs.GlobalWorkerOptions.workerSrc = `${window.location.origin}/pdfjs/pdf.worker.min.mjs`;
}

const THUMB_WIDTH_STORAGE = "pvv-pdf-thumb-width";
const DEFAULT_SIDEBAR = 168;
const SIDEBAR_MIN = 120;
const SIDEBAR_MAX_RATIO = 0.48;

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2.75;
const ZOOM_STEP = 1.12;

type ViewMode = "continuous" | "single";

function subscribeNarrow(callback: () => void) {
  const mq = window.matchMedia("(max-width: 639px)");
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

function getNarrowSnapshot() {
  return window.matchMedia("(max-width: 639px)").matches;
}

function getServerNarrowSnapshot() {
  return false;
}

function readStoredSidebarWidth(): number {
  try {
    const raw = sessionStorage.getItem(THUMB_WIDTH_STORAGE);
    const n = raw ? parseInt(raw, 10) : NaN;
    if (Number.isFinite(n) && n >= SIDEBAR_MIN) return n;
  } catch {
    /* ignore */
  }
  return DEFAULT_SIDEBAR;
}

function PdfViewerToolbar({
  numPages,
  activePage,
  viewMode,
  zoom,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onFitWholePage,
  canFitWholePage,
  onToggleFullscreen,
  isFullscreen,
  onViewModeToggle,
  onPrev,
  onNext,
  disabled,
}: {
  numPages: number | null;
  activePage: number;
  viewMode: ViewMode;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onFitWholePage: () => void;
  canFitWholePage: boolean;
  onToggleFullscreen: () => void;
  isFullscreen: boolean;
  onViewModeToggle: () => void;
  onPrev: () => void;
  onNext: () => void;
  disabled: boolean;
}) {
  const pct = Math.round(zoom * 100);
  const hasPages = numPages !== null && numPages > 0;

  return (
    <div
      className="border-border/50 bg-background/95 flex shrink-0 flex-wrap items-center gap-1.5 border-b px-2 py-2 backdrop-blur-sm sm:gap-2 sm:px-3"
      role="toolbar"
      aria-label="PDF-visning"
    >
      <div className="flex flex-wrap items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 touch-manipulation px-2.5"
          disabled={disabled || !hasPages}
          onClick={onZoomOut}
          aria-label="Zoom ut"
        >
          <ZoomOut className="size-4" aria-hidden />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 min-w-[3.25rem] touch-manipulation px-2 tabular-nums"
          disabled={disabled || !hasPages}
          onClick={onZoomReset}
          aria-label="Tilpass bredde (100 %)"
          title="Tilpass panelets bredde"
        >
          {pct}%
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 touch-manipulation px-2.5"
          disabled={disabled || !hasPages}
          onClick={onZoomIn}
          aria-label="Zoom inn"
        >
          <ZoomIn className="size-4" aria-hidden />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 touch-manipulation px-2.5"
          disabled={disabled || !hasPages || !canFitWholePage}
          onClick={onFitWholePage}
          aria-label="Tilpass hele siden i vinduet"
          title="Vis hele siden uten å rulle (bredde og høyde)"
        >
          <Maximize2 className="size-4" aria-hidden />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 touch-manipulation px-2.5"
          disabled={disabled || !hasPages}
          onClick={onToggleFullscreen}
          aria-label={isFullscreen ? "Avslutt fullskjerm" : "Fullskjerm i nettleseren"}
          title={
            isFullscreen
              ? "Tilbake til normal visning"
              : "Bruk hele nettleservinduet (Esc for å avslutte)"
          }
        >
          {isFullscreen ? (
            <Shrink className="size-4" aria-hidden />
          ) : (
            <Expand className="size-4" aria-hidden />
          )}
        </Button>
      </div>

      <span className="bg-border/60 hidden h-6 w-px sm:block" aria-hidden />

      <div className="flex flex-wrap items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 gap-1.5 touch-manipulation px-2.5 text-xs"
          disabled={disabled || !hasPages}
          onClick={onViewModeToggle}
          aria-pressed={viewMode === "continuous"}
          title={
            viewMode === "continuous"
              ? "Bytt til én side om gangen"
              : "Vis alle sider under hverandre (rull)"
          }
        >
          {viewMode === "continuous" ? (
            <>
              <ChevronsDownUp className="size-3.5 shrink-0" aria-hidden />
              <span className="hidden sm:inline">Én side</span>
            </>
          ) : (
            <>
              <ChevronsUpDown className="size-3.5 shrink-0" aria-hidden />
              <span className="hidden sm:inline">Alle sider</span>
            </>
          )}
        </Button>
      </div>

      {viewMode === "single" && hasPages ? (
        <>
          <span className="bg-border/60 hidden h-6 w-px sm:block" aria-hidden />
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 touch-manipulation px-2.5"
              disabled={disabled || activePage <= 1}
              onClick={onPrev}
              aria-label="Forrige side"
            >
              <ChevronLeft className="size-4" aria-hidden />
            </Button>
            <span className="text-muted-foreground px-1 text-xs tabular-nums sm:text-sm">
              {activePage} / {numPages}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 touch-manipulation px-2.5"
              disabled={disabled || activePage >= numPages}
              onClick={onNext}
              aria-label="Neste side"
            >
              <ChevronRight className="size-4" aria-hidden />
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}

export function ResizablePdfPreview({
  file,
  documentTitle,
  className,
}: {
  file: string;
  documentTitle: string;
  className?: string;
}) {
  const isNarrow = useSyncExternalStore(
    subscribeNarrow,
    getNarrowSnapshot,
    getServerNarrowSnapshot,
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const fullscreenTargetRef = useRef<HTMLDivElement | null>(null);
  const pdfDocRef = useRef<PDFDocumentProxy | null>(null);
  const mainPaneRef = useRef<HTMLDivElement>(null);
  const dragActiveRef = useRef(false);
  const pageWrapRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const [numPages, setNumPages] = useState<number | null>(null);
  const [activePage, setActivePage] = useState(1);
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR);
  const [mainWidth, setMainWidth] = useState(480);
  const [zoom, setZoom] = useState(1);
  const [viewMode, setViewMode] = useState<ViewMode>("continuous");
  const [pageNaturalSize, setPageNaturalSize] = useState<{
    w: number;
    h: number;
  } | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const setPageWrapRef = useCallback((page: number, el: HTMLDivElement | null) => {
    if (el) pageWrapRefs.current.set(page, el);
    else pageWrapRefs.current.delete(page);
  }, []);

  const scrollToPage = useCallback(
    (page: number) => {
      setActivePage(page);
      if (viewMode !== "continuous") return;
      requestAnimationFrame(() => {
        pageWrapRefs.current.get(page)?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    },
    [viewMode],
  );

  useEffect(() => {
    setActivePage(1);
    setNumPages(null);
    setZoom(1);
    setViewMode("continuous");
    pageWrapRefs.current.clear();
    pdfDocRef.current = null;
    setPageNaturalSize(null);
  }, [file]);

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(document.fullscreenElement === fullscreenTargetRef.current);
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  useEffect(() => {
    const pdf = pdfDocRef.current;
    if (!pdf || !numPages) return;
    const pageNum = viewMode === "single" ? activePage : 1;
    const safe = Math.min(numPages, Math.max(1, pageNum));
    let cancelled = false;
    void (async () => {
      try {
        const p = await pdf.getPage(safe);
        if (cancelled) return;
        const vp = p.getViewport({ scale: 1 });
        setPageNaturalSize({ w: vp.width, h: vp.height });
      } catch {
        if (!cancelled) setPageNaturalSize(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activePage, viewMode, numPages, file]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setSidebarWidth(readStoredSidebarWidth());
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(THUMB_WIDTH_STORAGE, String(sidebarWidth));
    } catch {
      /* ignore */
    }
  }, [sidebarWidth]);

  const clampSidebar = useCallback((w: number) => {
    const el = containerRef.current;
    const maxPx = el
      ? Math.max(SIDEBAR_MIN, Math.floor(el.clientWidth * SIDEBAR_MAX_RATIO))
      : 360;
    return Math.min(maxPx, Math.max(SIDEBAR_MIN, Math.round(w)));
  }, []);

  useEffect(() => {
    const el = mainPaneRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setMainWidth(Math.max(160, el.clientWidth - 16));
    });
    ro.observe(el);
    setMainWidth(Math.max(160, el.clientWidth - 16));
    return () => ro.disconnect();
  }, [isNarrow, sidebarWidth, numPages]);

  useLayoutEffect(() => {
    if (viewMode !== "continuous" || !numPages || !mainPaneRef.current) return;
    const root = mainPaneRef.current;
    let observer: IntersectionObserver | null = null;
    const frame = requestAnimationFrame(() => {
      observer = new IntersectionObserver(
        (entries) => {
          const visible = entries
            .filter((e) => e.isIntersecting && e.intersectionRatio > 0.08)
            .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
          const el = visible[0]?.target;
          if (el instanceof HTMLElement) {
            const p = Number(el.dataset.pdfPage);
            if (p >= 1 && p <= (numPages ?? 0)) setActivePage(p);
          }
        },
        {
          root,
          threshold: [0.08, 0.2, 0.45, 0.65],
          rootMargin: "-8% 0px -35% 0px",
        },
      );
      for (let i = 1; i <= numPages; i++) {
        const node = pageWrapRefs.current.get(i);
        if (node) observer.observe(node);
      }
    });
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [viewMode, numPages, file]);

  const onSplitterPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (isNarrow) return;
    e.preventDefault();
    dragActiveRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
  }, [isNarrow]);

  const onSplitterPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragActiveRef.current || isNarrow) return;
      setSidebarWidth((w) => clampSidebar(w + e.movementX));
    },
    [clampSidebar, isNarrow],
  );

  const onSplitterPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragActiveRef.current) return;
    dragActiveRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }, []);

  const thumbRenderWidth = isNarrow
    ? 96
    : Math.max(72, Math.min(sidebarWidth - 20, sidebarWidth - 16));

  const pageWidth = Math.max(120, Math.round(mainWidth * zoom));

  const zoomIn = useCallback(() => {
    setZoom((z) => Math.min(ZOOM_MAX, z * ZOOM_STEP));
  }, []);
  const zoomOut = useCallback(() => {
    setZoom((z) => Math.max(ZOOM_MIN, z / ZOOM_STEP));
  }, []);
  const zoomReset = useCallback(() => setZoom(1), []);

  const fitWholePage = useCallback(() => {
    const pane = mainPaneRef.current;
    if (!pane || !pageNaturalSize || pageNaturalSize.w <= 0 || mainWidth <= 0) return;
    const inset = 48;
    const availW = Math.max(80, pane.clientWidth - inset);
    const availH = Math.max(80, pane.clientHeight - inset);
    const ratio = pageNaturalSize.h / pageNaturalSize.w;
    const zoomW = availW / mainWidth;
    const zoomH = availH / (mainWidth * ratio);
    const z = Math.min(zoomW, zoomH);
    setZoom(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z)));
  }, [mainWidth, pageNaturalSize]);

  const toggleBrowserFullscreen = useCallback(async () => {
    const el = fullscreenTargetRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement === el) {
        await document.exitFullscreen();
      } else {
        await el.requestFullscreen();
      }
    } catch {
      /* FS ikke tilgjengelig (f.eks. iOS) */
    }
  }, []);

  const toggleViewMode = useCallback(() => {
    setViewMode((m) => (m === "continuous" ? "single" : "continuous"));
  }, []);

  const goPrev = useCallback(() => {
    setActivePage((p) => Math.max(1, p - 1));
  }, []);
  const goNext = useCallback(() => {
    if (!numPages) return;
    setActivePage((p) => Math.min(numPages, p + 1));
  }, [numPages]);

  const renderThumbs = (layout: "narrow" | "wide") =>
    numPages ? (
      Array.from({ length: numPages }, (_, i) => {
        const page = i + 1;
        const selected = page === activePage;
        return (
          <button
            key={page}
            type="button"
            role={layout === "narrow" ? "tab" : undefined}
            aria-selected={layout === "narrow" ? selected : undefined}
            aria-label={`Gå til side ${page}`}
            aria-current={layout === "wide" && selected ? "page" : undefined}
            onClick={() => scrollToPage(page)}
            className={cn(
              layout === "narrow"
                ? "shrink-0 overflow-hidden rounded-none border p-1 transition-colors"
                : "w-full overflow-hidden rounded-none border p-1 text-left transition-colors",
              selected
                ? "border-primary ring-2 ring-primary/35 ring-offset-0"
                : "border-border/50 hover:border-border",
            )}
          >
            <Page
              pageNumber={page}
              width={thumbRenderWidth}
              renderTextLayer={false}
              renderAnnotationLayer={false}
              className="!bg-white"
            />
            <span className="text-muted-foreground mt-1 block text-center text-[10px] font-medium tabular-nums">
              {page}
            </span>
          </button>
        );
      })
    ) : null;

  const renderMainPages = () => {
    if (!numPages) return null;
    if (viewMode === "single") {
      return (
        <div className="flex justify-center p-3 sm:p-5">
          <Page
            pageNumber={activePage}
            width={pageWidth}
            className="shadow-md !bg-white"
            renderTextLayer
            renderAnnotationLayer
          />
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center gap-8 p-3 pb-14 sm:p-5 sm:pb-16">
        {Array.from({ length: numPages }, (_, i) => {
          const page = i + 1;
          return (
            <div
              key={page}
              data-pdf-page={page}
              ref={(el) => setPageWrapRef(page, el)}
              className="shadow-md scroll-mt-3"
            >
              <Page
                pageNumber={page}
                width={pageWidth}
                className="!bg-white"
                renderTextLayer
                renderAnnotationLayer
              />
              <p className="text-muted-foreground mt-2 text-center text-xs tabular-nums">
                Side {page} av {numPages}
              </p>
            </div>
          );
        })}
      </div>
    );
  };

  const toolbar = (
    <PdfViewerToolbar
      numPages={numPages}
      activePage={activePage}
      viewMode={viewMode}
      zoom={zoom}
      onZoomIn={zoomIn}
      onZoomOut={zoomOut}
      onZoomReset={zoomReset}
      onFitWholePage={fitWholePage}
      canFitWholePage={Boolean(pageNaturalSize)}
      onToggleFullscreen={toggleBrowserFullscreen}
      isFullscreen={isFullscreen}
      onViewModeToggle={toggleViewMode}
      onPrev={goPrev}
      onNext={goNext}
      disabled={!numPages}
    />
  );

  return (
    <div
      ref={(el) => {
        containerRef.current = el;
        fullscreenTargetRef.current = el;
      }}
      className={cn(
        "flex min-h-0 w-full flex-col bg-muted/30",
        isFullscreen && "box-border h-dvh max-h-dvh min-h-dvh w-full max-w-none bg-background",
        className,
      )}
    >
      <Document
        className={cn(
          "flex min-h-0 min-w-0 flex-1 flex-col",
          isFullscreen && "min-h-0 overflow-hidden",
        )}
        file={file}
        loading={
          <div className="text-muted-foreground flex min-h-[12rem] flex-col items-center justify-center gap-2 text-sm">
            <Loader2 className="size-8 animate-spin opacity-70" aria-hidden />
            Laster PDF …
          </div>
        }
        error={
          <div className="text-destructive px-4 py-8 text-center text-sm">
            Kunne ikke vise PDF i forhåndsvisning. Prøv «Ny fane» eller «Last ned».
          </div>
        }
        onLoadSuccess={(pdf) => {
          pdfDocRef.current = pdf;
          setNumPages(pdf.numPages);
          setActivePage(1);
        }}
        onLoadError={() => {
          pdfDocRef.current = null;
          setNumPages(null);
          setPageNaturalSize(null);
        }}
      >
        {isNarrow ? (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div
              className="border-border/50 flex shrink-0 gap-2 overflow-x-auto overflow-y-hidden border-b bg-background/40 px-2 py-2 [scrollbar-width:thin]"
              role="tablist"
              aria-label="Miniatyrbilder"
            >
              {renderThumbs("narrow")}
            </div>
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              {toolbar}
              <div
                ref={mainPaneRef}
                className="min-h-0 flex-1 overflow-auto bg-neutral-100 dark:bg-neutral-950"
              >
                {renderMainPages()}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex min-h-0 min-w-0 flex-1 flex-row">
            <aside
              className="border-border/50 flex min-h-0 shrink-0 flex-col overflow-hidden border-r bg-background/50"
              style={{ width: sidebarWidth }}
              aria-label="Miniatyrbilder"
            >
              <p className="text-muted-foreground border-border/40 shrink-0 border-b px-2 py-2 text-[0.65rem] font-medium uppercase tracking-wider">
                Sider
              </p>
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overflow-x-hidden p-2 [scrollbar-width:thin]">
                {renderThumbs("wide")}
              </div>
            </aside>

            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Dra for å endre bredde på miniatyrfeltet"
              tabIndex={0}
              className={cn(
                "group relative z-10 flex w-4 shrink-0 cursor-col-resize touch-none select-none items-stretch justify-center",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              )}
              onPointerDown={onSplitterPointerDown}
              onPointerMove={onSplitterPointerMove}
              onPointerUp={onSplitterPointerUp}
              onPointerCancel={onSplitterPointerUp}
              onKeyDown={(e) => {
                if (e.key === "ArrowLeft") {
                  e.preventDefault();
                  setSidebarWidth((w) => clampSidebar(w - 12));
                }
                if (e.key === "ArrowRight") {
                  e.preventDefault();
                  setSidebarWidth((w) => clampSidebar(w + 12));
                }
              }}
            >
              <span
                className="bg-border/80 group-hover:bg-primary/60 my-2 w-px rounded-full transition-colors group-focus-visible:bg-primary"
                aria-hidden
              />
            </div>

            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              {toolbar}
              <div
                ref={mainPaneRef}
                className="min-h-0 min-w-0 flex-1 overflow-auto bg-neutral-100 dark:bg-neutral-950"
              >
                {renderMainPages()}
              </div>
            </div>
          </div>
        )}
      </Document>

      {!isFullscreen ? (
        <p className="text-muted-foreground border-border/40 shrink-0 border-t bg-background/30 px-3 py-2 text-[11px] leading-relaxed sm:text-xs">
          Ramme-ikon: tilpass hele siden i vinduet. Utvid-ikon: fullskjerm i nettleseren (Esc
          avslutter). Prosent: tilpass bredde. Zoom og «Alle sider» / «Én side» som før. Dokument:{" "}
          <span className="font-medium text-foreground/90">{documentTitle}</span>
        </p>
      ) : null}
    </div>
  );
}
