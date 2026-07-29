"use client";

import { cn } from "@/lib/utils";
import { ExternalLink, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// PDF.js worker fra samme versjon som react-pdf bruker.
// CDN unngår Next/webpack-problemer med worker-bundling på iPad/Safari.
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

type Props = {
  url: string;
  className?: string;
  /** Vis «Åpne i ny fane» (nyttig på iPad der native PDF-leser også fungerer). */
  showOpenInTab?: boolean;
  title?: string;
};

/** Ignorer breddeendringer under scrollbar-bredde (~12–17px) for å unngå zoom-loop. */
const PAGE_WIDTH_HYSTERESIS_PX = 16;

/**
 * Cross-platform PDF-forhåndsvisning.
 * iOS Safari/iframe viser ofte bare første side — derfor renderer vi alle sider med PDF.js.
 */
export function PdfBlobViewer({
  url,
  className,
  showOpenInTab = true,
  title = "PDF-forhåndsvisning",
}: Props) {
  /** Måles utenfor scroll-containeren — ellers oscillerer bredde når scrollbar dukker opp/forsvinner (Windows). */
  const measureRef = useRef<HTMLDivElement>(null);
  const [numPages, setNumPages] = useState(0);
  const [pageWidth, setPageWidth] = useState(640);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const el = measureRef.current;
    if (!el) return;

    const update = () => {
      // px-1/sm:px-2 + litt margin så canvas ikke tvinger horisontal overflow
      const next = Math.floor(el.clientWidth - 16);
      if (next <= 0) return;
      setPageWidth((prev) => {
        if (Math.abs(prev - next) < PAGE_WIDTH_HYSTERESIS_PX) return prev;
        return next;
      });
    };
    update();

    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [url]);

  useEffect(() => {
    setNumPages(0);
    setLoadError(null);
  }, [url]);

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border/40 bg-muted/20 px-3 py-2">
        <p className="text-xs text-muted-foreground">
          {numPages > 0 ? (
            <>
              <span className="font-medium tabular-nums text-foreground">
                {numPages}
              </span>{" "}
              {numPages === 1 ? "side" : "sider"} — scroll for å se hele
              dokumentet
            </>
          ) : (
            "Laster sider…"
          )}
        </p>
        {showOpenInTab ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground underline-offset-2 hover:underline"
          >
            <ExternalLink className="size-3.5" aria-hidden />
            Åpne i ny fane
          </a>
        ) : null}
      </div>

      <div ref={measureRef} className="min-h-0 min-w-0 flex-1">
        <div
          className="h-full overflow-y-auto overscroll-contain bg-muted/30 [scrollbar-gutter:stable] [-webkit-overflow-scrolling:touch]"
          style={{ touchAction: "pan-y" }}
        >
          {loadError ? (
            <div className="flex h-full min-h-[16rem] flex-col items-center justify-center gap-3 px-4 text-center">
              <p className="text-sm text-destructive">{loadError}</p>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-foreground underline-offset-2 hover:underline"
              >
                Åpne PDF i ny fane i stedet
              </a>
            </div>
          ) : (
            <Document
              file={url}
              loading={
                <div className="flex h-[min(50vh,24rem)] items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Laster PDF…
                </div>
              }
              error={
                <div className="flex h-[min(50vh,24rem)] items-center justify-center px-4 text-center text-sm text-destructive">
                  Kunne ikke lese PDF-filen.
                </div>
              }
              onLoadSuccess={(pdf) => {
                setNumPages(pdf.numPages);
                setLoadError(null);
              }}
              onLoadError={(err) => {
                console.error("[pdf-viewer]", err);
                setLoadError(
                  "Forhåndsvisning feilet i denne nettleseren. Åpne i ny fane eller last ned.",
                );
              }}
            >
              <div className="flex flex-col items-center gap-3 px-1 py-3 sm:gap-4 sm:px-2 sm:py-4">
                {Array.from({ length: numPages }, (_, index) => {
                  const pageNumber = index + 1;
                  return (
                    <div
                      key={`${url}-${pageNumber}`}
                      className="w-full max-w-full overflow-hidden rounded-md bg-white shadow-sm ring-1 ring-black/10"
                    >
                      <p className="border-b border-black/5 bg-neutral-50 px-2 py-1 text-center text-[10px] font-medium tabular-nums text-neutral-500">
                        Side {pageNumber} / {numPages || "…"}
                      </p>
                      <Page
                        pageNumber={pageNumber}
                        width={Math.max(260, pageWidth)}
                        renderTextLayer={false}
                        renderAnnotationLayer={false}
                        loading={
                          <div className="flex h-40 items-center justify-center text-xs text-muted-foreground">
                            Side {pageNumber}…
                          </div>
                        }
                        aria-label={`${title}, side ${pageNumber}`}
                      />
                    </div>
                  );
                })}
              </div>
            </Document>
          )}
        </div>
      </div>
    </div>
  );
}
