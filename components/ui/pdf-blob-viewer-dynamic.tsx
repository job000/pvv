"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

/**
 * Lazy-load react-pdf/pdfjs — unngår at pdf.mjs evalueres i SSR / for tidlig i bundlen.
 * Selve webpack-dev-kræsjen (eval source maps) håndteres i next.config.ts.
 */
export const PdfBlobViewer = dynamic(
  () =>
    import("@/components/ui/pdf-blob-viewer").then((m) => m.PdfBlobViewer),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[16rem] flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Laster PDF-visning…
      </div>
    ),
  },
);
