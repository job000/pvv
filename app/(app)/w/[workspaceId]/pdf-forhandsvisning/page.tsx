"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { formatRelativeUpdatedAt } from "@/lib/assessment-ui-helpers";
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
  FileDown,
  Loader2,
  Search,
  Check,
  ArrowUpDown,
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

type AssessmentRow = {
  _id: Id<"assessments">;
  title: string;
  updatedAt?: number;
};
type AnalysisRow = {
  _id: Id<"rosAnalyses">;
  title: string;
  updatedAt?: number;
};
type ListSort = "updated_desc" | "title_asc";

function useFilteredRows<T extends { _id: string; title: string; updatedAt?: number }>(
  rows: T[],
  selectedId: string,
  query: string,
  sort: ListSort,
): T[] {
  return useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? rows.filter((r) => r.title.toLowerCase().includes(q))
      : rows;
    const sorted = [...base];
    if (sort === "title_asc") {
      sorted.sort((a, b) => a.title.localeCompare(b.title, "nb"));
    } else {
      sorted.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
    }
    const selected = rows.find((r) => r._id === selectedId);
    if (
      selected &&
      selectedId &&
      !sorted.some((r) => r._id === selectedId)
    ) {
      return [selected, ...sorted];
    }
    return sorted;
  }, [rows, selectedId, query, sort]);
}

const TAB_CONFIG = [
  { id: "vurdering" as const, label: "Vurdering" },
  { id: "ros" as const, label: "ROS" },
  { id: "pdd" as const, label: "Prosessdesign" },
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
  const [listSort, setListSort] = useState<ListSort>("updated_desc");

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
            diagramCacheKey: `${String(pddState.assessment._id)}-${pddDoc.revision ?? 0}`,
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
        diagramCacheKey: `${String(pddState.assessment._id)}-${pddState.document.revision ?? 0}`,
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
    listSort,
  );
  const filteredPddAssessments = useFilteredRows(
    assessmentList,
    pddAssessmentId,
    tab === "pdd" ? listFilter : "",
    listSort,
  );
  const filteredAnalyses = useFilteredRows(
    analysisList,
    analysisId,
    tab === "ros" ? listFilter : "",
    listSort,
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
  const canFilterList = showFilter || showRosFilter;

  const selectionCount =
    tab === "ros"
      ? filteredAnalyses.length
      : tab === "pdd"
        ? filteredPddAssessments.length
        : filteredAssessments.length;

  const totalCount =
    tab === "ros" ? analysisList.length : assessmentList.length;
  const activeRows = (
    tab === "ros"
      ? filteredAnalyses
      : tab === "pdd"
        ? filteredPddAssessments
        : filteredAssessments
  ) as Array<{ _id: string; title: string; updatedAt?: number }>;
  const activeSelectedId =
    tab === "ros"
      ? String(analysisId)
      : tab === "pdd"
        ? String(pddAssessmentId)
        : String(assessmentId);
  const selectActiveRow = (id: string) => {
    if (tab === "ros") {
      setAnalysisId(id as Id<"rosAnalyses">);
      return;
    }
    if (tab === "pdd") {
      setPddAssessmentId(id as Id<"assessments">);
      return;
    }
    setAssessmentId(id as Id<"assessments">);
  };

  const previewTitle =
    tab === "vurdering" && draftBundle
      ? draftBundle.assessment.title
      : tab === "ros" && rosAnalysis
        ? rosAnalysis.title
        : tab === "pdd" && pddState
          ? pddState.assessment.title
          : "PDF";

  const emptyForTab =
    (tab === "vurdering" || tab === "pdd") ? noAssessments : noAnalyses;

  const viewerHeightClass =
    "h-[min(56rem,calc(100dvh-14rem))] min-h-[24rem]";

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-10">
      <header className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
          PDF-eksport
        </h1>
        <p className="text-sm text-muted-foreground">
          Forhåndsvis og last ned vurderinger, ROS og prosessdesign.
        </p>
      </header>

      <div
        className="inline-flex rounded-full border border-border/50 bg-background p-1"
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
                "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        {/* Venstre: dokumentliste */}
        <aside className="min-w-0 space-y-3">
          {emptyForTab ? (
            <div className="rounded-2xl border border-dashed border-border/60 px-5 py-10 text-center">
              <p className="text-sm font-medium text-foreground">
                {tab === "ros" ? "Ingen ROS-analyser" : "Ingen vurderinger ennå"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {tab === "ros"
                  ? "Opprett en analyse under Risiko (ROS)."
                  : "Opprett en vurdering først."}
              </p>
            </div>
          ) : (
            <>
              {canFilterList ? (
                <div className="space-y-2">
                  <div className="relative flex items-center">
                    <span
                      className="text-muted-foreground pointer-events-none absolute left-3.5 flex items-center"
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
                        tab === "ros" ? "Søk ROS-analyse" : "Søk vurdering"
                      }
                      autoComplete="off"
                      className={cn(
                        "h-11 w-full rounded-full border-border/50 bg-background text-sm shadow-none",
                        "!pl-10 !pr-10",
                      )}
                    />
                    {listFilter ? (
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground absolute right-2 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full transition-colors"
                        onClick={() => setListFilter("")}
                        aria-label="Tøm søk"
                      >
                        <X className="size-4 shrink-0" />
                      </button>
                    ) : null}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-muted-foreground text-xs tabular-nums">
                      {selectionCount} av {totalCount}
                    </p>
                    <div className="relative shrink-0">
                      <select
                        aria-label="Sorter dokumentliste"
                        value={listSort}
                        onChange={(e) => setListSort(e.target.value as ListSort)}
                        className="h-8 appearance-none rounded-full border border-border/50 bg-background pl-3 pr-8 text-xs"
                      >
                        <option value="updated_desc">Nyeste først</option>
                        <option value="title_asc">Tittel A–Å</option>
                      </select>
                      <ArrowUpDown className="pointer-events-none absolute right-2.5 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
                    </div>
                  </div>
                </div>
              ) : null}

              <ul className="divide-y divide-border/40 overflow-hidden rounded-2xl border border-border/50 bg-card">
                {activeRows.map((row) => {
                  const selected = activeSelectedId === String(row._id);
                  return (
                    <li key={String(row._id)}>
                      <button
                        type="button"
                        onClick={() => selectActiveRow(String(row._id))}
                        className={cn(
                          "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors",
                          selected ? "bg-muted/50" : "hover:bg-muted/25",
                        )}
                        aria-pressed={selected}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">
                            {row.title}
                          </p>
                          {row.updatedAt ? (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {formatRelativeUpdatedAt(row.updatedAt)}
                            </p>
                          ) : null}
                        </div>
                        {selected ? (
                          <Check className="size-4 shrink-0 text-foreground" aria-hidden />
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </aside>

        {/* Høyre: forhåndsvisning med verktøylinje */}
        <section
          aria-label="PDF-forhåndsvisning"
          className="min-w-0 space-y-3"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                {pdfUrl && !error ? previewTitle : "Forhåndsvisning"}
              </p>
              {pdfUrl && !error ? (
                <p className="truncate text-xs text-muted-foreground">
                  {downloadLabel}
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-10 rounded-full text-muted-foreground hover:text-foreground"
                aria-label="Åpne i ny fane"
                title="Åpne i ny fane"
                disabled={!pdfUrl || !!error || busy}
                onClick={openPdfInNewTab}
              >
                <ExternalLink className="size-4" aria-hidden />
              </Button>
              <Button
                type="button"
                className="h-10 gap-2 rounded-full bg-foreground px-5 text-sm font-semibold text-background transition-opacity hover:opacity-90"
                disabled={!pdfUrl || !!error || busy}
                onClick={() => void handleDownload()}
              >
                <FileDown className="size-4 shrink-0" aria-hidden />
                Last ned
              </Button>
            </div>
          </div>

          {error ? (
            <div
              className="border-destructive/30 bg-destructive/5 rounded-2xl border px-4 py-3 text-sm text-destructive"
              role="alert"
            >
              {error}
            </div>
          ) : null}

          <div
            className={cn(
              "relative isolate flex w-full flex-col overflow-hidden rounded-2xl border border-border/50 bg-muted/25 dark:bg-muted/15",
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
                {emptyForTab
                  ? tab === "ros"
                    ? "Opprett en ROS-analyse først."
                    : "Opprett en vurdering først."
                  : "Velg et dokument i listen."}
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
