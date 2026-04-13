"use client";

import { BrandMark } from "@/components/brand-mark";
import { ThemeModeToggle } from "@/components/theme-mode-toggle";
import { Button, buttonVariants } from "@/components/ui/button";
import { buildAssessmentPdfBlob } from "@/lib/assessment-pdf";
import { cn } from "@/lib/utils";
import {
  sampleDocumentationAssessmentPdfInput,
  sampleDocumentationProcessDesignPdfInput,
  sampleDocumentationRosPdfInput,
} from "@/lib/pdf-documentation-samples";
import { buildProcessDesignPdfPreviewUrl } from "@/lib/process-design-pdf";
import { buildRosAnalysisPdfBlob } from "@/lib/ros-pdf";
import { Download, FileText, Loader2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

type DocTab = "ros" | "assessment" | "pdd";

const TABS: { id: DocTab; label: string; short: string }[] = [
  { id: "ros", label: "ROS-analyse", short: "ROS" },
  { id: "assessment", label: "PVV-vurdering", short: "PVV" },
  { id: "pdd", label: "Prosessdesign (PDD)", short: "PDD" },
];

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }
}

export function PdfDocumentationPreview() {
  const [tab, setTab] = useState<DocTab>("ros");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);
  const previewUrlRef = useRef<string | null>(null);

  const revokePreview = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function buildPreview() {
      setLoading(true);
      setError(null);
      revokePreview();

      try {
        let url: string;
        if (tab === "ros") {
          const blob = buildRosAnalysisPdfBlob(sampleDocumentationRosPdfInput());
          url = URL.createObjectURL(blob);
        } else if (tab === "assessment") {
          const blob = buildAssessmentPdfBlob(
            sampleDocumentationAssessmentPdfInput(),
          );
          url = URL.createObjectURL(blob);
        } else {
          url = await buildProcessDesignPdfPreviewUrl(
            sampleDocumentationProcessDesignPdfInput(),
          );
        }
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        previewUrlRef.current = url;
        setPreviewUrl(url);
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error
              ? e.message
              : "Kunne ikke generere forhåndsvisning.",
          );
          setPreviewUrl(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void buildPreview();

    return () => {
      cancelled = true;
    };
  }, [tab, retryNonce, revokePreview]);

  useEffect(
    () => () => {
      revokePreview();
    },
    [revokePreview],
  );

  async function handleDownload() {
    setDownloading(true);
    try {
      if (tab === "ros") {
        const blob = buildRosAnalysisPdfBlob(sampleDocumentationRosPdfInput());
        triggerBlobDownload(blob, "FRO-ROS-eksempel.pdf");
      } else if (tab === "assessment") {
        const blob = buildAssessmentPdfBlob(
          sampleDocumentationAssessmentPdfInput(),
        );
        triggerBlobDownload(blob, "FRO-PVV-eksempel.pdf");
      } else {
        const { downloadProcessDesignPdf } = await import(
          "@/lib/process-design-pdf"
        );
        await downloadProcessDesignPdf(
          sampleDocumentationProcessDesignPdfInput(),
        );
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Nedlasting mislyktes. Prøv igjen.",
      );
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="bg-background flex min-h-dvh flex-col">
      <header className="border-border/60 bg-background/85 sticky top-0 z-40 border-b backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link
            href="/"
            className="text-foreground flex min-w-0 items-center gap-2 rounded-lg font-semibold tracking-tight outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
          >
            <BrandMark size={28} />
            <span className="font-heading truncate text-base sm:text-lg">
              FRO
            </span>
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            <ThemeModeToggle />
            <Link
              href="/dashboard"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Til arbeidsflate
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
        <div className="space-y-2">
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <FileText className="size-4 shrink-0" aria-hidden />
            <span>Dokumentasjon</span>
          </div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
            PDF-forhåndsvisning
          </h1>
          <p className="text-muted-foreground max-w-2xl text-base leading-relaxed">
            Her vises eksempel-PDF-er slik de eksporteres fra FRO — uten å åpne
            en ekte sak. Innholdet er fiktivt og kun til illustrasjon. Du kan
            laste ned om du trenger å dele layout med andre.
          </p>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div
            role="tablist"
            aria-label="Velg dokumenttype"
            className="flex flex-wrap gap-2"
          >
            {TABS.map((t) => {
              const selected = tab === t.id;
              return (
                <Button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  variant={selected ? "default" : "outline"}
                  size="sm"
                  className={cn("min-h-10 touch-manipulation", selected && "shadow-sm")}
                  onClick={() => setTab(t.id)}
                >
                  <span className="sm:hidden">{t.short}</span>
                  <span className="hidden sm:inline">{t.label}</span>
                </Button>
              );
            })}
          </div>
          <Button
            type="button"
            variant="secondary"
            className="min-h-10 w-full touch-manipulation sm:w-auto"
            disabled={loading || Boolean(error) || downloading}
            onClick={() => void handleDownload()}
          >
            {downloading ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Download className="size-4" aria-hidden />
            )}
            <span className="ml-2">Last ned PDF</span>
          </Button>
        </div>

        <div className="border-border bg-muted/30 relative min-h-[min(70vh,720px)] flex-1 overflow-hidden rounded-xl border shadow-sm">
          {loading && (
            <div
              className="bg-background/80 absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 backdrop-blur-[2px]"
              aria-live="polite"
            >
              <Loader2 className="text-muted-foreground size-8 animate-spin" />
              <p className="text-muted-foreground text-sm">
                Genererer forhåndsvisning …
              </p>
            </div>
          )}
          {error && !loading && (
            <div className="text-destructive flex h-full min-h-[240px] flex-col items-center justify-center gap-2 p-6 text-center text-sm">
              <p>{error}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setError(null);
                  setRetryNonce((n) => n + 1);
                }}
              >
                Prøv igjen
              </Button>
            </div>
          )}
          {previewUrl && !error && (
            <iframe
              title={`Forhåndsvisning: ${TABS.find((x) => x.id === tab)?.label ?? "PDF"}`}
              src={`${previewUrl}#toolbar=0`}
              className="size-full min-h-[min(70vh,720px)] border-0"
            />
          )}
        </div>

        <p className="text-muted-foreground pb-8 text-xs leading-relaxed">
          Tips: Noen nettlesere viser PDF bedre med innebygd leser. Hvis
          forhåndsvisningen er tom, bruk «Last ned PDF» eller åpne filen i en
          annen fane.
        </p>
      </main>
    </div>
  );
}
