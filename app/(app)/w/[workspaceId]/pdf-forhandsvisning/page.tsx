"use client";

import {
  ProductEmptyState,
  ProductPageHeader,
  ProductSection,
} from "@/components/product";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { buildAssessmentPdfInputFromDraft } from "@/lib/assessment-pdf-from-draft";
import {
  buildAssessmentPdfBlob,
  downloadAssessmentPdf,
} from "@/lib/assessment-pdf";
import {
  buildProcessDesignPdfPreviewUrl,
  downloadProcessDesignPdf,
} from "@/lib/process-design-pdf";
import type { ProcessDesignDocumentPayload } from "@/lib/process-design-doc-types";
import { buildRosPdfInputForPreview } from "@/lib/ros-pdf-input-from-server";
import { buildRosAnalysisPdfBlob, downloadRosAnalysisPdf } from "@/lib/ros-pdf";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import {
  ExternalLink,
  Eye,
  FileDown,
  FileText,
  Loader2,
  Search,
  X,
} from "lucide-react";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type DocTab = "vurdering" | "ros" | "pdd";

function safePdfFilename(title: string, prefix: string): string {
  const safe = title
    .replace(/[^\wæøåÆØÅ\- ]/gi, "")
    .trim()
    .slice(0, 40)
    .replace(/\s+/g, "-");
  return `${prefix}-${safe || "dokument"}.pdf`;
}

type AssessmentRow = { _id: Id<"assessments">; title: string };
type AnalysisRow = { _id: Id<"rosAnalyses">; title: string };

function useFilteredRows<T extends { _id: string; title: string }>(
  rows: T[],
  selectedId: string,
  query: string,
): T[] {
  return useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? rows.filter((r) => r.title.toLowerCase().includes(q))
      : rows;
    const selected = rows.find((r) => r._id === selectedId);
    if (
      selected &&
      selectedId &&
      !filtered.some((r) => r._id === selectedId)
    ) {
      return [selected, ...filtered];
    }
    return filtered;
  }, [rows, selectedId, query]);
}

const TAB_CONFIG = [
  {
    id: "vurdering" as const,
    label: "PVV-vurdering",
    hint: "Utkast fra veiviseren eksporteres som PDF.",
  },
  {
    id: "ros" as const,
    label: "ROS",
    hint: "Valgt ROS-analyse med matrise og notater.",
  },
  {
    id: "pdd" as const,
    label: "Prosessdesign (PDD)",
    hint: "PDD knyttet til valgt vurdering.",
  },
];

export default function PdfForhandsvisningPage() {
  const params = useParams();
  const workspaceId = params.workspaceId as Id<"workspaces">;

  const workspace = useQuery(api.workspaces.get, { workspaceId });
  const assessments = useQuery(api.assessments.listByWorkspace, { workspaceId });
  const analyses = useQuery(api.ros.listAnalyses, { workspaceId });
  const templates = useQuery(api.ros.listTemplates, { workspaceId });

  const [tab, setTab] = useState<DocTab>("vurdering");
  const [assessmentId, setAssessmentId] = useState<Id<"assessments"> | "">("");
  const [analysisId, setAnalysisId] = useState<Id<"rosAnalyses"> | "">("");
  const [pddAssessmentId, setPddAssessmentId] = useState<Id<"assessments"> | "">(
    "",
  );

  const [listFilter, setListFilter] = useState("");

  const draftBundle = useQuery(
    api.assessments.getDraft,
    assessmentId ? { assessmentId } : "skip",
  );
  const rosAnalysis = useQuery(
    api.ros.getAnalysis,
    analysisId ? { analysisId } : "skip",
  );
  const rosJournal = useQuery(
    api.ros.listJournalEntries,
    analysisId ? { analysisId } : "skip",
  );
  const rosTasks = useQuery(
    api.ros.listTasksByRosAnalysis,
    analysisId ? { analysisId } : "skip",
  );
  const rosVersions = useQuery(
    api.ros.listVersions,
    analysisId ? { analysisId } : "skip",
  );

  const pddState = useQuery(
    api.processDesignDocs.getForAssessment,
    pddAssessmentId ? { assessmentId: pddAssessmentId } : "skip",
  );

  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pdfUrlRef = useRef<string | null>(null);

  const revokeCurrent = useCallback(() => {
    if (pdfUrlRef.current) {
      URL.revokeObjectURL(pdfUrlRef.current);
      pdfUrlRef.current = null;
    }
    setPdfUrl(null);
  }, []);

  useEffect(() => () => revokeCurrent(), [revokeCurrent]);

  useEffect(() => {
    if (assessments === undefined) return;
    if (assessments.length === 0) {
      setAssessmentId("");
      setPddAssessmentId("");
      return;
    }
    const first = assessments[0]._id;
    if (assessmentId === "" || !assessments.some((a) => a._id === assessmentId)) {
      setAssessmentId(first);
    }
    if (
      pddAssessmentId === "" ||
      !assessments.some((a) => a._id === pddAssessmentId)
    ) {
      setPddAssessmentId(first);
    }
  }, [assessments, assessmentId, pddAssessmentId]);

  useEffect(() => {
    if (analyses === undefined) return;
    if (analyses.length === 0) {
      setAnalysisId("");
      return;
    }
    const first = analyses[0]._id;
    if (analysisId === "" || !analyses.some((a) => a._id === analysisId)) {
      setAnalysisId(first);
    }
  }, [analyses, analysisId]);

  useEffect(() => {
    revokeCurrent();
    setError(null);

    if (tab === "vurdering") {
      if (!workspace || !assessmentId) return;
      if (draftBundle === undefined) return;
      if (draftBundle === null) {
        setError(
          "Det finnes ingen lagret utkast for denne vurderingen. Åpne vurderingen, fyll ut og lagre, deretter prøv igjen.",
        );
        return;
      }
      const input = buildAssessmentPdfInputFromDraft(
        draftBundle,
        workspace.name ?? null,
      );
      if (!input) {
        setError("Kunne ikke bygge PDF for denne vurderingen.");
        return;
      }
      try {
        const blob = buildAssessmentPdfBlob(input);
        const url = URL.createObjectURL(blob);
        pdfUrlRef.current = url;
        setPdfUrl(url);
      } catch {
        setError("Kunne ikke generere PDF.");
      }
      return;
    }

    if (tab === "ros") {
      if (!workspace || !analysisId) return;
      if (rosAnalysis === undefined) return;
      if (rosAnalysis === null) {
        setError("Fant ikke ROS-analysen.");
        return;
      }
      const templateName =
        rosAnalysis.templateId && templates
          ? (templates.find((t) => t._id === rosAnalysis.templateId)?.name ??
            null)
          : null;
      try {
        const input = buildRosPdfInputForPreview({
          analysis: rosAnalysis,
          journalEntries: rosJournal ?? [],
          tasks: rosTasks ?? [],
          versions: rosVersions ?? [],
          workspaceName: workspace.name ?? null,
          templateName,
        });
        const blob = buildRosAnalysisPdfBlob(input);
        const url = URL.createObjectURL(blob);
        pdfUrlRef.current = url;
        setPdfUrl(url);
      } catch {
        setError("Kunne ikke generere ROS-PDF.");
      }
      return;
    }

    if (tab === "pdd") {
      if (!workspace || !pddAssessmentId) return;
      if (pddState === undefined) return;
      if (pddState === null) {
        setError(
          "Fant ikke prosessdesign for denne vurderingen, eller du mangler tilgang.",
        );
        return;
      }
      const pddDoc = pddState.document;
      if (!pddDoc) {
        setError("Ingen prosessdesign er opprettet for denne vurderingen ennå.");
        return;
      }
      let cancelled = false;
      setBusy(true);
      void (async () => {
        try {
          const latestPublished =
            pddState.versions[0]?.version && pddState.versions[0].version > 0
              ? pddState.versions[0].version
              : null;
          const url = await buildProcessDesignPdfPreviewUrl({
            assessmentTitle: pddState.assessment.title,
            workspaceName: workspace.name ?? null,
            organizationLine: pddDoc.organizationLine?.trim() || undefined,
            payload: pddDoc.payload as ProcessDesignDocumentPayload,
            generatedAt: new Date(),
            publishedVersion: latestPublished,
          });
          if (cancelled) {
            URL.revokeObjectURL(url);
            return;
          }
          revokeCurrent();
          pdfUrlRef.current = url;
          setPdfUrl(url);
        } catch {
          if (!cancelled) setError("Kunne ikke generere prosessdesign-PDF.");
        } finally {
          if (!cancelled) setBusy(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }
  }, [
    tab,
    draftBundle,
    workspace,
    rosAnalysis,
    rosJournal,
    rosTasks,
    rosVersions,
    templates,
    pddState,
    revokeCurrent,
    assessmentId,
    analysisId,
    pddAssessmentId,
  ]);

  const downloadLabel = useMemo(() => {
    if (tab === "vurdering" && draftBundle)
      return safePdfFilename(draftBundle.assessment.title, "PVV");
    if (tab === "ros" && rosAnalysis)
      return safePdfFilename(rosAnalysis.title, "ROS");
    if (tab === "pdd" && pddState)
      return safePdfFilename(pddState.assessment.title, "PDD");
    return "dokument.pdf";
  }, [tab, draftBundle, rosAnalysis, pddState]);

  const activeTabHint = TAB_CONFIG.find((t) => t.id === tab)?.hint ?? "";

  async function handleDownload() {
    if (tab === "vurdering" && draftBundle && workspace) {
      const input = buildAssessmentPdfInputFromDraft(
        draftBundle,
        workspace.name ?? null,
      );
      if (input) downloadAssessmentPdf(input);
      return;
    }
    if (tab === "ros" && rosAnalysis && workspace) {
      const templateName =
        rosAnalysis.templateId && templates
          ? (templates.find((t) => t._id === rosAnalysis.templateId)?.name ??
            null)
          : null;
      const input = buildRosPdfInputForPreview({
        analysis: rosAnalysis,
        journalEntries: rosJournal ?? [],
        tasks: rosTasks ?? [],
        versions: rosVersions ?? [],
        workspaceName: workspace.name ?? null,
        templateName,
      });
      downloadRosAnalysisPdf(input);
      return;
    }
    if (tab === "pdd" && pddState?.document && workspace) {
      const latestPublished =
        pddState.versions[0]?.version && pddState.versions[0].version > 0
          ? pddState.versions[0].version
          : null;
      await downloadProcessDesignPdf({
        assessmentTitle: pddState.assessment.title,
        workspaceName: workspace.name ?? null,
        organizationLine: pddState.document.organizationLine?.trim() || undefined,
        payload: pddState.document.payload as ProcessDesignDocumentPayload,
        generatedAt: new Date(),
        publishedVersion: latestPublished,
      });
    }
  }

  function openPdfInNewTab() {
    if (!pdfUrl) return;
    window.open(pdfUrl, "_blank", "noopener,noreferrer");
  }

  const assessmentList = (assessments ?? []) as AssessmentRow[];
  const analysisList = (analyses ?? []) as AnalysisRow[];

  const filteredAssessments = useFilteredRows(
    assessmentList,
    assessmentId,
    tab === "vurdering" ? listFilter : "",
  );
  const filteredPddAssessments = useFilteredRows(
    assessmentList,
    pddAssessmentId,
    tab === "pdd" ? listFilter : "",
  );
  const filteredAnalyses = useFilteredRows(
    analysisList,
    analysisId,
    tab === "ros" ? listFilter : "",
  );

  useEffect(() => {
    setListFilter("");
  }, [tab]);

  if (
    workspace === undefined ||
    assessments === undefined ||
    analyses === undefined
  ) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const noAssessments = assessmentList.length === 0;
  const noAnalyses = analysisList.length === 0;

  const showFilter =
    (tab === "vurdering" || tab === "pdd") &&
    !noAssessments &&
    assessmentList.length >= 2;
  const showRosFilter = tab === "ros" && !noAnalyses && analysisList.length >= 2;

  const selectionCount =
    tab === "ros"
      ? filteredAnalyses.length
      : tab === "pdd"
        ? filteredPddAssessments.length
        : filteredAssessments.length;

  const totalCount =
    tab === "ros" ? analysisList.length : assessmentList.length;

  const selectId =
    tab === "vurdering"
      ? "pdf-assessment"
      : tab === "ros"
        ? "pdf-ros"
        : "pdf-pdd";

  const previewTitle =
    tab === "vurdering" && draftBundle
      ? draftBundle.assessment.title
      : tab === "ros" && rosAnalysis
        ? rosAnalysis.title
        : tab === "pdd" && pddState
          ? pddState.assessment.title
          : "PDF";

  /** Rom til sticky kontroller; iframe med nettleserens PDF (samme blob som «Ny fane») */
  const viewerHeightClass =
    "h-[min(56rem,calc(100dvh-15.5rem))] sm:h-[min(56rem,calc(100dvh-14rem))]";

  return (
    <div className="mx-auto max-w-5xl px-4 pb-8 pt-1 sm:px-6 lg:px-0">
      {/* Sticky: faner, valg og handlinger */}
      <div
        className={cn(
          "sticky top-0 z-20 -mx-4 mb-4 space-y-4 border-b border-border/50 bg-background/90 px-4 pb-4 pt-1 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.15)] backdrop-blur-md dark:bg-background/88 dark:shadow-[0_8px_28px_-12px_rgba(0,0,0,0.45)] sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0",
        )}
      >
        <ProductPageHeader
          eyebrow={
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <Eye className="size-3.5" aria-hidden />
              Dokumentasjon
            </span>
          }
          title="PDF-forhåndsvisning"
          description={
            <span className="text-pretty text-sm leading-relaxed">
              Forhåndsvisningen bruker nettleserens innebygde PDF-visning — samme innhold som når du
              åpner i ny fane. Kontrollene over forblir synlige når du ruller.
            </span>
          }
          actions={
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-10 gap-2 rounded-xl border-border/70"
                disabled={!pdfUrl || !!error || busy}
                onClick={openPdfInNewTab}
              >
                <ExternalLink className="size-4 shrink-0" aria-hidden />
                Ny fane
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-10 gap-2 rounded-xl"
                disabled={!pdfUrl || !!error || busy}
                onClick={() => void handleDownload()}
              >
                <FileDown className="size-4 shrink-0" aria-hidden />
                Last ned
              </Button>
            </div>
          }
        />

        <div className="space-y-2">
          <div
            className="flex gap-1 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            role="tablist"
            aria-label="Dokumenttype"
          >
            {TAB_CONFIG.map(({ id, label }) => {
              const active = tab === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(id)}
                  className={cn(
                    "relative shrink-0 touch-manipulation rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-muted/90 text-foreground"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <p className="text-muted-foreground max-w-2xl text-xs leading-relaxed">
            {activeTabHint}
          </p>
        </div>

        {(tab === "vurdering" || tab === "pdd") && noAssessments ? (
          <ProductEmptyState
            icon={FileText}
            title="Ingen vurderinger ennå"
            description="Opprett en PVV-vurdering for å forhåndsvise dokument her. PDD følger samme vurdering."
            className="border-border/50 bg-muted/15 py-8"
          />
        ) : null}
        {tab === "ros" && noAnalyses ? (
          <ProductEmptyState
            icon={FileText}
            title="Ingen ROS-analyser"
            description="Opprett en analyse under Risiko (ROS) for å generere PDF fra matrisen og notatene."
            className="border-border/50 bg-muted/15 py-8"
          />
        ) : null}

        {!noAssessments || (tab === "ros" && !noAnalyses) ? (
          <ProductSection
            title="Velg dokument"
            description={
              showFilter || showRosFilter
                ? "Søk filtrerer nedtrekkslisten. Aktivt valg vises alltid."
                : "Velg utkast eller analyse."
            }
          >
            <div className="max-w-2xl space-y-4 rounded-xl border border-border/50 bg-card/40 p-4 shadow-sm sm:p-5">
              {(showFilter || showRosFilter) && (
                <div className="space-y-2">
                  <Label
                    htmlFor="pdf-list-filter"
                    className="text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground"
                  >
                    Søk i liste
                  </Label>
                  <div className="relative flex w-full items-center">
                    <span
                      className="text-muted-foreground pointer-events-none absolute left-3.5 flex size-9 items-center justify-center"
                      aria-hidden
                    >
                      <Search className="size-4 shrink-0 opacity-80" />
                    </span>
                    <Input
                      id="pdf-list-filter"
                      type="search"
                      value={listFilter}
                      onChange={(e) => setListFilter(e.target.value)}
                      placeholder={
                        tab === "ros" ? "Filtrer etter ROS-tittel" : "Filtrer etter vurdering"
                      }
                      autoComplete="off"
                      className={cn(
                        "h-10 min-h-10 w-full rounded-lg border-border/50 bg-background text-sm shadow-none",
                        /* Egen horisontal padding — overstyrer Input sitt md:px-2.5 som ga ikon/tekst-overlapp */
                        "!pl-11 !pr-10 md:!min-h-10 md:!pl-11 md:!pr-10",
                      )}
                    />
                    {listFilter ? (
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground absolute right-2 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-md transition-colors"
                        onClick={() => setListFilter("")}
                        aria-label="Tøm søk"
                      >
                        <X className="size-4 shrink-0" />
                      </button>
                    ) : null}
                  </div>
                  <p className="text-muted-foreground text-[11px] tabular-nums">
                    {selectionCount} av {totalCount}{" "}
                    {tab === "ros" ? "analyser" : "vurderinger"}
                    {listFilter.trim() ? " · filtrert" : ""}
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label
                  htmlFor={selectId}
                  className="text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground"
                >
                  {tab === "ros"
                    ? "ROS-analyse"
                    : tab === "pdd"
                      ? "Vurdering (PDD)"
                      : "Vurdering"}
                </Label>
                {tab === "vurdering" ? (
                  <select
                    id={selectId}
                    className="border-input bg-background focus-visible:ring-ring h-10 w-full rounded-lg border border-border/50 px-3 text-sm shadow-none outline-none transition-[box-shadow] focus-visible:ring-2 disabled:opacity-50"
                    value={assessmentId}
                    disabled={noAssessments}
                    onChange={(e) =>
                      setAssessmentId(e.target.value as Id<"assessments">)
                    }
                  >
                    {noAssessments ? (
                      <option value="">—</option>
                    ) : (
                      filteredAssessments.map((a) => (
                        <option key={a._id} value={a._id}>
                          {a.title}
                        </option>
                      ))
                    )}
                  </select>
                ) : null}

                {tab === "ros" ? (
                  <select
                    id={selectId}
                    className="border-input bg-background focus-visible:ring-ring h-10 w-full rounded-lg border border-border/50 px-3 text-sm shadow-none outline-none transition-[box-shadow] focus-visible:ring-2 disabled:opacity-50"
                    value={analysisId}
                    disabled={noAnalyses}
                    onChange={(e) =>
                      setAnalysisId(e.target.value as Id<"rosAnalyses">)
                    }
                  >
                    {noAnalyses ? (
                      <option value="">—</option>
                    ) : (
                      filteredAnalyses.map((a) => (
                        <option key={a._id} value={a._id}>
                          {a.title}
                        </option>
                      ))
                    )}
                  </select>
                ) : null}

                {tab === "pdd" ? (
                  <select
                    id={selectId}
                    className="border-input bg-background focus-visible:ring-ring h-10 w-full rounded-lg border border-border/50 px-3 text-sm shadow-none outline-none transition-[box-shadow] focus-visible:ring-2 disabled:opacity-50"
                    value={pddAssessmentId}
                    disabled={noAssessments}
                    onChange={(e) =>
                      setPddAssessmentId(e.target.value as Id<"assessments">)
                    }
                  >
                    {noAssessments ? (
                      <option value="">—</option>
                    ) : (
                      filteredPddAssessments.map((a) => (
                        <option key={a._id} value={a._id}>
                          {a.title}
                        </option>
                      ))
                    )}
                  </select>
                ) : null}
            </div>
          </div>
        </ProductSection>
      ) : null}

        {error ? (
          <div
            className="border-destructive/30 bg-destructive/5 rounded-xl border px-4 py-3 text-sm text-destructive"
            role="alert"
          >
            {error}
          </div>
        ) : null}

        {pdfUrl && !error && !busy ? (
          <div className="border-border/40 min-w-0 border-t pt-3">
            <p className="text-muted-foreground text-[0.65rem] font-medium uppercase tracking-wider">
              Aktiv forhåndsvisning
            </p>
            <p className="text-foreground mt-0.5 truncate text-sm font-semibold leading-snug">
              {previewTitle}
            </p>
          </div>
        ) : null}
      </div>

      <section
        aria-label="PDF-forhåndsvisning"
        className="flex min-h-0 flex-col gap-2"
      >
        <div
          className={cn(
            "relative isolate flex w-full flex-col overflow-hidden rounded-xl border border-border/50 bg-muted/25 dark:bg-muted/15",
            viewerHeightClass,
          )}
        >
          {busy ? (
            <div className="bg-background/80 absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 backdrop-blur-sm">
              <Loader2 className="text-muted-foreground size-9 animate-spin" />
              <p className="text-muted-foreground text-sm">Genererer PDF …</p>
            </div>
          ) : null}
          {pdfUrl && !error ? (
            <iframe
              key={pdfUrl}
              title={`PDF: ${previewTitle}`}
              src={pdfUrl}
              className="block h-full min-h-0 w-full flex-1 border-0 bg-neutral-950 dark:bg-neutral-950"
            />
          ) : !error && !busy ? (
            <div className="text-muted-foreground flex h-full min-h-[12rem] w-full flex-1 items-center justify-center px-6 text-center text-sm">
              {(tab === "vurdering" || tab === "pdd") && noAssessments
                ? "Opprett en vurdering først."
                : tab === "ros" && noAnalyses
                  ? "Opprett en ROS-analyse først."
                  : "Velg dokument over. PDF vises her."}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
