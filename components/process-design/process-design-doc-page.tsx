"use client";

import {
  ProductEmptyState,
  ProductLoadingBlock,
  ProductPageHeader,
} from "@/components/product";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { AssessmentPayload } from "@/lib/assessment-types";
import {
  buildProcessDesignAutofill,
  mergeAutofillEmptyOnly,
  suggestedOrganizationLine,
} from "@/lib/build-process-design-autofill";
import {
  emptyProcessDesignPayload,
  type ProcessDesignDocumentPayload,
  type ProcessDesignAppRow,
  type ProcessDesignExceptionRow,
  type ProcessDesignHukiRow,
  type ProcessDesignStepRow,
} from "@/lib/process-design-doc-types";
import {
  buildProcessDesignPdfPreviewUrl,
  downloadProcessDesignPdf,
} from "@/lib/process-design-pdf";
import { useMutation, useQuery } from "convex/react";
import {
  AlertTriangle,
  ArrowLeft,
  ChevronDown,
  ExternalLink,
  FileDown,
  Eye,
  FileText,
  History,
  Link2,
  Loader2,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const PddTldrawCanvas = dynamic(
  () =>
    import("@/components/process-design/pdd-tldraw-canvas").then(
      (m) => m.PddTldrawCanvas,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[min(28rem,60vh)] min-h-[16rem] items-center justify-center rounded-xl border border-dashed border-border bg-muted/10 text-sm text-muted-foreground">
        Laster tegneverktøy…
      </div>
    ),
  },
);

/* ------------------------------------------------------------------ */
/*  Primitives                                                         */
/* ------------------------------------------------------------------ */

function Field({
  label,
  value,
  onChange,
  rows = 3,
  disabled,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-[0.76rem] font-semibold tracking-[0.01em] text-muted-foreground">
        {label}
      </Label>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        disabled={disabled}
        placeholder={placeholder}
        className="min-h-0 resize-y rounded-xl border-border/60 bg-background/70 text-sm shadow-sm"
      />
    </div>
  );
}

function ReadOnlyBlock({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <p className="text-[0.76rem] font-semibold tracking-[0.01em] text-muted-foreground">
        {label}
      </p>
      <div className="rounded-xl border border-border/50 bg-muted/20 px-3.5 py-3 text-sm shadow-sm">
        {children}
      </div>
    </div>
  );
}

function StatusBadge({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "warning" | "success";
}) {
  const toneClass =
    tone === "warning"
      ? "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300"
      : tone === "success"
        ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
        : "border-border/60 bg-muted/40 text-muted-foreground";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium ${toneClass}`}
    >
      {children}
    </span>
  );
}

function CollapsibleSection({
  title,
  icon: Icon,
  defaultOpen = false,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-border/60 bg-card/70 shadow-sm backdrop-blur-sm">
      <button
        type="button"
        className="flex w-full touch-manipulation items-center gap-2.5 px-4 py-3.5 text-left sm:px-5"
        onClick={() => setOpen(!open)}
      >
        <Icon className="size-4 shrink-0 text-muted-foreground" />
        <span className="flex-1 text-sm font-semibold text-foreground">{title}</span>
        <ChevronDown
          className={`size-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      {open && (
        <div className="border-t border-border/40 px-4 pb-4 pt-3 sm:px-5">
          {children}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Diagram + text block                                               */
/* ------------------------------------------------------------------ */

function ProcessTextDiagramBlock({
  sectionLabel,
  diagramHint,
  textRows = 4,
  textValue,
  onTextChange,
  diagramValue,
  onDiagramJson,
  canEdit,
  instanceKey,
}: {
  sectionLabel: string;
  diagramHint: string;
  textRows?: number;
  textValue: string;
  onTextChange: (v: string) => void;
  diagramValue: string | undefined;
  onDiagramJson: (json: string) => void;
  canEdit: boolean;
  instanceKey: string;
}) {
  const [mode, setMode] = useState<"beskrivelse" | "diagram">("beskrivelse");
  const diagramShellRef = useRef<HTMLDivElement>(null);
  const [diagramFullscreen, setDiagramFullscreen] = useState(false);

  useEffect(() => {
    const sync = () => {
      setDiagramFullscreen(
        document.fullscreenElement === diagramShellRef.current,
      );
    };
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  useEffect(() => {
    if (!diagramFullscreen || document.fullscreenElement) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [diagramFullscreen]);

  const toggleDiagramFullscreen = useCallback(async () => {
    const el = diagramShellRef.current;
    if (!el) return;
    if (document.fullscreenElement === el) {
      try {
        await document.exitFullscreen();
      } catch {
        setDiagramFullscreen(false);
      }
      return;
    }
    if (diagramFullscreen && !document.fullscreenElement) {
      setDiagramFullscreen(false);
      return;
    }
    try {
      if ("requestFullscreen" in el) {
        await el.requestFullscreen();
        setDiagramFullscreen(true);
        return;
      }
    } catch {
      /* fallback below */
    }
    setDiagramFullscreen(true);
  }, []);

  return (
    <div className="space-y-2">
      <Label className="text-[0.8rem] font-medium text-muted-foreground">
        {sectionLabel}
      </Label>
      <div className="inline-flex w-full rounded-xl border border-border bg-muted/40 p-0.5 sm:w-auto">
        <button
          type="button"
          className={`touch-manipulation rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            mode === "beskrivelse"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
          style={{ flex: 1 }}
          onClick={() => setMode("beskrivelse")}
        >
          Beskrivelse
        </button>
        <button
          type="button"
          className={`touch-manipulation rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            mode === "diagram"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
          style={{ flex: 1 }}
          onClick={() => setMode("diagram")}
        >
          Diagram
        </button>
      </div>
      {mode === "beskrivelse" ? (
        <Textarea
          value={textValue}
          onChange={(e) => onTextChange(e.target.value)}
          rows={textRows}
          disabled={!canEdit}
          className="min-h-0 resize-y text-sm"
        />
      ) : (
        <div
          ref={diagramShellRef}
          className={
            diagramFullscreen
              ? "fixed inset-0 z-[90] box-border flex h-[100svh] w-screen flex-col overflow-hidden bg-background px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))]"
              : "flex flex-col gap-3"
          }
        >
          <div
            className={
              diagramFullscreen
                ? "mb-3 shrink-0 rounded-2xl border border-border/60 bg-background/95 p-3 shadow-lg backdrop-blur"
                : "space-y-2"
            }
          >
            <p className="text-xs leading-relaxed text-muted-foreground">
              {diagramFullscreen
                ? "Bruk to fingre for zoom og én finger for å tegne eller flytte objekter."
                : diagramHint}
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
              {canEdit && diagramValue?.trim() ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-9 justify-center text-xs text-muted-foreground sm:h-8"
                  onClick={() => {
                    if (confirm("Slette alt i diagrammet?")) onDiagramJson("");
                  }}
                >
                  Tøm diagram
                </Button>
              ) : null}
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-10 touch-manipulation justify-center rounded-xl sm:h-9"
                onClick={toggleDiagramFullscreen}
              >
                {diagramFullscreen ? (
                  <>
                    <Minimize2
                      className="mr-1.5 size-3.5 shrink-0"
                      aria-hidden
                    />
                    Avslutt fullskjerm
                  </>
                ) : (
                  <>
                    <Maximize2
                      className="mr-1.5 size-3.5 shrink-0"
                      aria-hidden
                    />
                    Fullskjerm
                  </>
                )}
              </Button>
            </div>
          </div>
          <div className={diagramFullscreen ? "min-h-0 flex-1" : ""}>
            <PddTldrawCanvas
              snapshotJson={diagramValue}
              onSnapshotChange={onDiagramJson}
              readOnly={!canEdit}
              instanceKey={instanceKey}
              layoutVariant={diagramFullscreen ? "fullscreen" : "embed"}
              className={
                diagramFullscreen
                  ? "min-h-0 flex-1 rounded-[1.5rem]"
                  : undefined
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  HUKI matrix editor                                                 */
/* ------------------------------------------------------------------ */

const HUKI_COLS = [
  {
    key: "h" as const,
    letter: "H",
    label: "Høres",
    full: "Hvem rådspørres?",
    headerBg: "bg-blue-500/15",
    headerText: "text-blue-700 dark:text-blue-400",
    badge: "bg-blue-500/20 text-blue-700 dark:text-blue-400",
    dot: "bg-blue-500",
  },
  {
    key: "u" as const,
    letter: "U",
    label: "Utfører",
    full: "Hvem utfører?",
    headerBg: "bg-emerald-500/15",
    headerText: "text-emerald-700 dark:text-emerald-400",
    badge: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400",
    dot: "bg-emerald-500",
  },
  {
    key: "k" as const,
    letter: "K",
    label: "Kontrollerer",
    full: "Hvem godkjenner?",
    headerBg: "bg-amber-500/15",
    headerText: "text-amber-700 dark:text-amber-400",
    badge: "bg-amber-500/20 text-amber-700 dark:text-amber-400",
    dot: "bg-amber-500",
  },
  {
    key: "i" as const,
    letter: "I",
    label: "Informeres",
    full: "Hvem informeres?",
    headerBg: "bg-purple-500/15",
    headerText: "text-purple-700 dark:text-purple-400",
    badge: "bg-purple-500/20 text-purple-700 dark:text-purple-400",
    dot: "bg-purple-500",
  },
] as const;

function HukiEditor({
  rows,
  onChange,
  disabled,
}: {
  rows: ProcessDesignHukiRow[];
  onChange: (r: ProcessDesignHukiRow[]) => void;
  disabled: boolean;
}) {
  const update = (i: number, patch: Partial<ProcessDesignHukiRow>) => {
    onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  };

  const hasAnyData = rows.some(
    (r) => r.h?.trim() || r.u?.trim() || r.k?.trim() || r.i?.trim(),
  );

  return (
    <div className="space-y-4">
      {/* Empty state */}
      {rows.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border/60 bg-muted/20 py-10 text-center">
          <div className="flex gap-1.5">
            {HUKI_COLS.map((c) => (
              <span
                key={c.key}
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${c.badge}`}
              >
                {c.letter}
              </span>
            ))}
          </div>
          <p className="max-w-xs text-sm text-muted-foreground">
            Kartlegg hvem som Høres, Utfører, Kontrollerer og Informeres for
            hver aktivitet i prosessen.
          </p>
          <Button
            type="button"
            size="sm"
            disabled={disabled}
            className="gap-1.5"
            onClick={() =>
              onChange([{ activity: "", h: "", u: "", k: "", i: "" }])
            }
          >
            <Plus className="size-3.5" aria-hidden />
            Legg til aktivitet
          </Button>
        </div>
      )}

      {rows.length > 0 && (
        <>
          {/* ── Matrix table (desktop) ── */}
          <div className="hidden overflow-hidden rounded-xl border border-border/60 sm:block">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="border-b border-border/40 bg-muted/30 px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">
                    Aktivitet
                  </th>
                  {HUKI_COLS.map((c) => (
                    <th
                      key={c.key}
                      className={`border-b border-border/40 px-3 py-2.5 text-center ${c.headerBg}`}
                    >
                      <span
                        className={`block text-xs font-bold ${c.headerText}`}
                      >
                        {c.letter}
                      </span>
                      <span className="block text-[10px] font-medium text-muted-foreground">
                        {c.label}
                      </span>
                    </th>
                  ))}
                  <th className="w-9 border-b border-border/40 bg-muted/30" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => (
                  <tr
                    key={idx}
                    className="group/row border-b border-border/20 last:border-b-0 transition-colors hover:bg-muted/20"
                  >
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="flex size-5 shrink-0 items-center justify-center rounded text-[10px] font-bold text-muted-foreground">
                          {idx + 1}.
                        </span>
                        <Input
                          value={r.activity}
                          disabled={disabled}
                          placeholder="Navn på aktivitet"
                          onChange={(e) =>
                            update(idx, { activity: e.target.value })
                          }
                          className="h-8 border-0 bg-transparent px-1 text-sm font-medium shadow-none focus-visible:ring-1"
                        />
                      </div>
                    </td>
                    {HUKI_COLS.map((c) => (
                      <td key={c.key} className="px-2 py-2">
                        <Input
                          value={(r[c.key] as string) ?? ""}
                          disabled={disabled}
                          placeholder="—"
                          onChange={(e) =>
                            update(idx, { [c.key]: e.target.value })
                          }
                          className={`h-8 text-center text-sm ${
                            (r[c.key] as string)?.trim()
                              ? "font-medium"
                              : "text-muted-foreground"
                          }`}
                        />
                      </td>
                    ))}
                    <td className="px-1 py-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        disabled={disabled}
                        className="text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover/row:opacity-100"
                        onClick={() =>
                          onChange(rows.filter((_, j) => j !== idx))
                        }
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Mobile cards ── */}
          <ul className="space-y-3 sm:hidden">
            {rows.map((r, idx) => (
              <li
                key={idx}
                className="group/huki overflow-hidden rounded-xl border border-border/60"
              >
                <div className="flex items-center gap-2 bg-muted/30 px-3 py-2.5">
                  <span className="text-xs font-bold text-muted-foreground">
                    {idx + 1}.
                  </span>
                  <Input
                    value={r.activity}
                    disabled={disabled}
                    placeholder="Navn på aktivitet"
                    onChange={(e) =>
                      update(idx, { activity: e.target.value })
                    }
                    className="h-7 border-0 bg-transparent px-0 text-sm font-semibold shadow-none focus-visible:ring-0"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    disabled={disabled}
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() =>
                      onChange(rows.filter((_, j) => j !== idx))
                    }
                  >
                    <Trash2 className="size-3" />
                  </Button>
                </div>
                <div className="divide-y divide-border/20">
                  {HUKI_COLS.map((c) => (
                    <div
                      key={c.key}
                      className="flex items-center gap-3 px-3 py-2"
                    >
                      <span
                        className={`flex size-6 shrink-0 items-center justify-center rounded-md text-xs font-bold ${c.badge}`}
                      >
                        {c.letter}
                      </span>
                      <span className="w-20 shrink-0 text-xs font-medium text-muted-foreground">
                        {c.label}
                      </span>
                      <Input
                        value={(r[c.key] as string) ?? ""}
                        disabled={disabled}
                        placeholder="Person eller rolle"
                        onChange={(e) =>
                          update(idx, { [c.key]: e.target.value })
                        }
                        className="h-7 flex-1 text-sm"
                      />
                    </div>
                  ))}
                </div>
              </li>
            ))}
          </ul>

          {/* Add row */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            className="w-full gap-1.5"
            onClick={() =>
              onChange([
                ...rows,
                { activity: "", h: "", u: "", k: "", i: "" },
              ])
            }
          >
            <Plus className="size-3.5" aria-hidden />
            Legg til aktivitet
          </Button>

          {/* ── Summary read-only view (when data present) ── */}
          {hasAnyData && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">
                Matriseoversikt
              </p>
              <div className="overflow-x-auto rounded-xl border border-border/40 bg-muted/10">
                <table className="w-full text-xs">
                  <thead>
                    <tr>
                      <th className="whitespace-nowrap px-3 py-2 text-left font-semibold text-muted-foreground">
                        #
                      </th>
                      <th className="whitespace-nowrap px-3 py-2 text-left font-semibold text-foreground">
                        Aktivitet
                      </th>
                      {HUKI_COLS.map((c) => (
                        <th
                          key={c.key}
                          className={`whitespace-nowrap px-3 py-2 text-center font-bold ${c.headerText}`}
                        >
                          {c.letter}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, idx) => (
                      <tr
                        key={idx}
                        className="border-t border-border/20"
                      >
                        <td className="px-3 py-1.5 font-medium text-muted-foreground">
                          {idx + 1}
                        </td>
                        <td className="max-w-[12rem] truncate px-3 py-1.5 font-medium text-foreground">
                          {r.activity || (
                            <span className="text-muted-foreground/50">
                              –
                            </span>
                          )}
                        </td>
                        {HUKI_COLS.map((c) => {
                          const val = (r[c.key] as string)?.trim();
                          return (
                            <td key={c.key} className="px-2 py-1.5 text-center">
                              {val ? (
                                <span
                                  className={`inline-block max-w-[7rem] truncate rounded-full px-2 py-0.5 text-[10px] font-semibold ${c.badge}`}
                                >
                                  {val}
                                </span>
                              ) : (
                                <span className="text-muted-foreground/30">
                                  —
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Secondary actions menu (mobile)                                    */
/* ------------------------------------------------------------------ */

function SecondaryActionsMenu({
  onAutofill,
  onSnapshot,
  onPreviewPdf,
  onExportPdf,
  canAutofill,
  canEdit,
  pdfPreviewing,
  pdfExporting,
}: {
  onAutofill: () => void;
  onSnapshot: () => void;
  onPreviewPdf: () => void;
  onExportPdf: () => void;
  canAutofill: boolean;
  canEdit: boolean;
  pdfPreviewing: boolean;
  pdfExporting: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <Button
        type="button"
        size="icon-sm"
        variant="outline"
        className="touch-manipulation"
        onClick={() => setOpen(!open)}
        aria-label="Flere handlinger"
      >
        <MoreHorizontal className="size-4" />
      </Button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-52 rounded-xl border border-border bg-background p-1 shadow-lg">
          <button
            type="button"
            disabled={!canAutofill}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted disabled:opacity-50"
            onClick={() => {
              onAutofill();
              setOpen(false);
            }}
          >
            <Sparkles className="size-4 shrink-0 text-muted-foreground" />
            Fyll fra kilder
          </button>
          <button
            type="button"
            disabled={!canEdit}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted disabled:opacity-50"
            onClick={() => {
              onSnapshot();
              setOpen(false);
            }}
          >
            <History className="size-4 shrink-0 text-muted-foreground" />
            Lagre versjon
          </button>
          <button
            type="button"
            disabled={pdfPreviewing}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted disabled:opacity-50"
            onClick={() => {
              onPreviewPdf();
              setOpen(false);
            }}
          >
            {pdfPreviewing ? (
              <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
            ) : (
              <Eye className="size-4 shrink-0 text-muted-foreground" />
            )}
            Forhåndsvis PDF
          </button>
          <button
            type="button"
            disabled={pdfExporting}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted disabled:opacity-50"
            onClick={() => {
              onExportPdf();
              setOpen(false);
            }}
          >
            {pdfExporting ? (
              <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
            ) : (
              <FileDown className="size-4 shrink-0 text-muted-foreground" />
            )}
            Eksporter PDF
          </button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main page component                                                */
/* ------------------------------------------------------------------ */

export function ProcessDesignDocPage({
  workspaceId,
  assessmentId,
}: {
  workspaceId: Id<"workspaces">;
  assessmentId: Id<"assessments">;
}) {
  const wid = String(workspaceId);
  const docState = useQuery(api.processDesignDocs.getForAssessment, {
    assessmentId,
  });
  const draftBundle = useQuery(api.assessments.getDraft, { assessmentId });
  const rosCtx = useQuery(api.ros.getRosContextForAssessment, {
    assessmentId,
  });
  const intake = useQuery(
    api.intakeSubmissions.getApprovedSubmissionForAssessment,
    { assessmentId },
  );
  const linkedCandidate = useQuery(
    api.candidates.getLinkedCandidateForAssessment,
    { assessmentId },
  );
  const workspace = useQuery(api.workspaces.get, { workspaceId });

  const ensureDoc = useMutation(api.processDesignDocs.ensureDocument);
  const saveDraft = useMutation(api.processDesignDocs.saveDraft);
  const snapVersion = useMutation(api.processDesignDocs.createVersionSnapshot);
  const restoreVer = useMutation(api.processDesignDocs.restoreVersion);

  const [payload, setPayload] = useState<ProcessDesignDocumentPayload>({});
  const [organizationLine, setOrganizationLine] = useState("");
  const [revision, setRevision] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [snapshotNote, setSnapshotNote] = useState("");
  const [snapshotOpen, setSnapshotOpen] = useState(false);
  const [pdfExporting, setPdfExporting] = useState(false);
  const [pdfPreviewing, setPdfPreviewing] = useState(false);
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [conflictOpen, setConflictOpen] = useState(false);
  const [conflictHint, setConflictHint] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const syncFromServer = useCallback(() => {
    if (!docState?.document) return;
    setPayload(
      (docState.document.payload as ProcessDesignDocumentPayload) ??
        emptyProcessDesignPayload(),
    );
    setOrganizationLine(docState.document.organizationLine ?? "");
    setRevision(docState.document.revision ?? 0);
    setDirty(false);
  }, [docState?.document]);

  useEffect(() => {
    if (docState?.document) {
      syncFromServer();
    } else if (docState && docState.document === null) {
      setPayload(emptyProcessDesignPayload());
      setOrganizationLine("");
      setRevision(0);
      setDirty(false);
    }
  }, [docState?.document, syncFromServer]);

  const canEdit = docState?.canEdit ?? false;
  const assessmentTitle = docState?.assessment?.title ?? "Vurdering";
  const diagramInstanceKey = useMemo(
    () => `${String(assessmentId)}-${revision}`,
    [assessmentId, revision],
  );

  const setStr = (key: keyof ProcessDesignDocumentPayload, v: string) => {
    setPayload((p) => ({ ...p, [key]: v }));
    setDirty(true);
  };

  const applyAutofill = useCallback(() => {
    const pl = draftBundle?.draft?.payload as AssessmentPayload | undefined;
    if (!pl) return;
    const suggestion = buildProcessDesignAutofill({
      workspaceName: workspace?.name ?? null,
      assessmentTitle,
      payload: pl,
      rosContexts: (rosCtx ?? []).map((r) => ({
        title: r.title,
        rosSummary: r.rosSummary,
        pvvLinkNote: r.pvvLinkNote,
        note: r.note,
        pddDigest: r.pddDigest,
      })),
      candidate:
        linkedCandidate && linkedCandidate.linked === true
          ? linkedCandidate
          : { linked: false as const },
      intake: intake
        ? {
            formTitle: intake.formTitle,
            submitterMeta: intake.submitterMeta,
            answers: intake.answers,
            generatedRosSuggestion: intake.generatedRosSuggestion,
          }
        : null,
    });
    setPayload((cur) => mergeAutofillEmptyOnly(cur, suggestion));
    const orgSug = suggestedOrganizationLine(workspace?.name ?? null);
    if (orgSug && !organizationLine.trim()) {
      setOrganizationLine(orgSug);
    }
    setDirty(true);
  }, [
    draftBundle?.draft?.payload,
    workspace?.name,
    assessmentTitle,
    rosCtx,
    intake,
    linkedCandidate,
    organizationLine,
  ]);

  const handleSave = async () => {
    if (!canEdit || !docState?.document) return;
    setSaving(true);
    setConflictHint(null);
    try {
      const res = await saveDraft({
        assessmentId,
        expectedRevision: revision,
        organizationLine: organizationLine.trim() || null,
        payload,
      });
      if (res.ok) {
        setRevision(res.revision);
        setDirty(false);
      } else {
        setConflictHint(
          res.conflict.updatedByName
            ? `Noen andre (${res.conflict.updatedByName}) lagret mens du redigerte.`
            : "Noen andre lagret mens du redigerte.",
        );
        setConflictOpen(true);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async () => {
    if (!canEdit) return;
    setSaving(true);
    try {
      await ensureDoc({ assessmentId });
    } finally {
      setSaving(false);
    }
  };

  const handleSnapshot = async () => {
    if (!canEdit || !docState?.document) return;
    setSaving(true);
    try {
      await snapVersion({
        assessmentId,
        note: snapshotNote.trim() || undefined,
      });
      setSnapshotNote("");
      setSnapshotOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleRestore = async (version: number) => {
    if (!canEdit || !docState?.document) return;
    if (
      !confirm(
        `Erstatte utkastet med versjon ${version}? Ulagrede endringer går tapt.`,
      )
    )
      return;
    setSaving(true);
    try {
      const res = await restoreVer({
        assessmentId,
        version,
        expectedRevision: revision,
      });
      if (res.ok) {
        setRevision(res.revision);
        setDirty(false);
      }
    } finally {
      setSaving(false);
    }
  };

  const latestPublishedVersion = useMemo(() => {
    const v = docState?.versions?.[0]?.version;
    return v && v > 0 ? v : null;
  }, [docState?.versions]);

  const exportPdf = async () => {
    setPdfExporting(true);
    try {
      await downloadProcessDesignPdf({
        assessmentTitle,
        workspaceName: workspace?.name ?? null,
        organizationLine: organizationLine.trim() || undefined,
        payload,
        generatedAt: new Date(),
        publishedVersion: latestPublishedVersion,
      });
    } finally {
      setPdfExporting(false);
    }
  };

  const previewPdf = async () => {
    setPdfPreviewing(true);
    try {
      const url = await buildProcessDesignPdfPreviewUrl({
        assessmentTitle,
        workspaceName: workspace?.name ?? null,
        organizationLine: organizationLine.trim() || undefined,
        payload,
        generatedAt: new Date(),
        publishedVersion: latestPublishedVersion,
      });
      setPdfPreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return url;
      });
      setPdfPreviewOpen(true);
    } finally {
      setPdfPreviewing(false);
    }
  };

  /* ---- Loading / error states ---- */

  if (
    docState === undefined ||
    draftBundle === undefined ||
    rosCtx === undefined ||
    intake === undefined ||
    linkedCandidate === undefined ||
    workspace === undefined
  ) {
    return (
      <ProductLoadingBlock
        label="Laster prosessdesign …"
        className="min-h-[40vh]"
      />
    );
  }

  if (docState === null) {
    return (
      <p className="px-4 text-sm text-destructive sm:px-6 lg:px-0">
        Ingen tilgang til vurderingen.
      </p>
    );
  }

  const hasDoc = docState.document !== null;
  const versionCount = docState.versions?.length ?? 0;

  /* ---- Derived data from linked sources (no duplicate entry) ---- */
  const processFromRegistry =
    linkedCandidate?.linked === true ? linkedCandidate : null;
  const rosAnalyses = rosCtx ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 pb-28 sm:space-y-6 sm:px-6 lg:px-0 lg:pb-12">
      {/* Back nav */}
      <Link
        href={`/w/${wid}/a/${assessmentId}`}
        className="inline-flex touch-manipulation items-center gap-1.5 rounded-lg py-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Til vurdering
      </Link>

      <section className="overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-b from-muted/40 to-background shadow-sm">
        <div className="space-y-4 p-4 sm:p-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge tone={dirty ? "warning" : "success"}>
                {dirty ? "Ulagrede endringer" : "Lagret utkast"}
              </StatusBadge>
              {versionCount > 0 ? (
                <StatusBadge>{versionCount} versjoner</StatusBadge>
              ) : null}
              {processFromRegistry ? (
                <StatusBadge>Prosess koblet</StatusBadge>
              ) : null}
            </div>
            <ProductPageHeader
              title="Prosessdesign (PDD)"
              description="Bygg et tydelig prosessdesign for RPA med flyt, roller, risiko og koblinger til PVV, ROS og prosessregister."
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-border/50 bg-background/70 p-3 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Dokument
              </p>
              <p className="mt-1 line-clamp-2 text-sm font-semibold text-foreground">
                {payload.processTitle?.trim() || assessmentTitle}
              </p>
            </div>
            <div className="rounded-2xl border border-border/50 bg-background/70 p-3 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Kilder
              </p>
              <p className="mt-1 text-sm text-foreground">
                {[
                  "PVV",
                  processFromRegistry ? "Prosessregister" : null,
                  rosAnalyses.length > 0 ? `${rosAnalyses.length} ROS` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <div className="rounded-2xl border border-border/50 bg-background/70 p-3 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Neste steg
              </p>
              <p className="mt-1 text-sm text-foreground">
                Start med oversikt, tegn As-Is og fyll deretter To-Be og risiko.
              </p>
            </div>
          </div>
        </div>
      </section>

      {!hasDoc ? (
        <ProductEmptyState
          icon={FileText}
          title="Ingen prosessdesign ennå"
          description="Opprett et dokument for å dokumentere prosess, trinn og automatiseringskrav for denne vurderingen. Data fra PVV-vurdering, ROS og prosessregisteret hentes automatisk."
          action={
            canEdit ? (
              <Button
                type="button"
                size="lg"
                onClick={handleCreate}
                disabled={saving}
              >
                {saving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : null}
                Opprett dokument
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground">
                Kun teammedlemmer med redigeringstilgang kan opprette
                dokumentet.
              </p>
            )
          }
        />
      ) : (
        <>
          {/* Top toolbar */}
          <div className="rounded-2xl border border-border/60 bg-card/70 p-3 shadow-sm backdrop-blur-sm sm:p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-foreground">
                  {payload.processTitle?.trim() || assessmentTitle}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Hold innholdet oppdatert og eksporter delbar PDF ved behov.
                </p>
              </div>

              <div className="hidden flex-wrap gap-2 sm:flex sm:justify-end">
                {versionCount > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5 rounded-xl"
                    onClick={() => setHistoryOpen(true)}
                  >
                    <History className="size-3.5" aria-hidden />
                    Historikk
                    <span className="inline-flex size-5 items-center justify-center rounded-full bg-muted text-[10px] font-semibold">
                      {versionCount}
                    </span>
                  </Button>
                )}
                {canEdit && (
                  <Button
                    type="button"
                    size="sm"
                    className="gap-1.5 rounded-xl"
                    onClick={handleSave}
                    disabled={saving || !dirty}
                  >
                    {saving ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Save className="size-3.5" />
                    )}
                    Lagre
                  </Button>
                )}
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-4 sm:flex sm:flex-wrap">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 rounded-xl"
                onClick={() => void previewPdf()}
                disabled={pdfPreviewing}
              >
                {pdfPreviewing ? (
                  <Loader2
                    className="size-3.5 animate-spin"
                    aria-hidden
                  />
                ) : (
                  <Eye className="size-3.5" aria-hidden />
                )}
                Forhåndsvis PDF
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 rounded-xl"
                onClick={applyAutofill}
                disabled={!draftBundle?.draft || !canEdit}
                title="Fyller tomme felt fra PVV, ROS og prosessregister"
              >
                <Sparkles className="size-3.5" aria-hidden />
                Fyll fra kilder
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 rounded-xl"
                onClick={() => setSnapshotOpen(true)}
                disabled={!canEdit}
              >
                <History className="size-3.5" aria-hidden />
                Lagre versjon
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 rounded-xl"
                onClick={() => void exportPdf()}
                disabled={pdfExporting}
              >
                {pdfExporting ? (
                  <Loader2
                    className="size-3.5 animate-spin"
                    aria-hidden
                  />
                ) : (
                  <FileDown className="size-3.5" aria-hidden />
                )}
                Eksporter PDF
              </Button>
              <div className="sm:hidden">
                <SecondaryActionsMenu
                  onAutofill={applyAutofill}
                  onSnapshot={() => setSnapshotOpen(true)}
                  onPreviewPdf={() => void previewPdf()}
                  onExportPdf={() => void exportPdf()}
                  canAutofill={!!draftBundle?.draft && canEdit}
                  canEdit={canEdit}
                  pdfPreviewing={pdfPreviewing}
                  pdfExporting={pdfExporting}
                />
              </div>
            </div>
          </div>

          {/* Koblinger — read-only data from linked sources */}
          <CollapsibleSection title="Koblinger" icon={Link2}>
            <div className="space-y-3 text-sm">
              <LinkRow
                label="PVV-vurdering"
                href={`/w/${wid}/a/${assessmentId}`}
                text={assessmentTitle}
              />
              <LinkRow
                label="Prosess (register)"
                href={
                  processFromRegistry
                    ? `/w/${wid}/vurderinger?fane=prosesser`
                    : undefined
                }
                text={
                  processFromRegistry
                    ? `${processFromRegistry.code} ${processFromRegistry.name}`
                    : undefined
                }
                emptyText="Ingen prosess koblet — koble via vurderingen"
              />
              <div>
                <span className="text-xs font-medium text-muted-foreground">
                  ROS-analyser
                </span>
                {rosAnalyses.length > 0 ? (
                  <ul className="mt-1 space-y-1">
                    {rosAnalyses.map((r) => (
                      <li key={r.linkId}>
                        <Link
                          href={`/w/${wid}/ros/a/${r.rosAnalysisId}`}
                          className="inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
                        >
                          {r.title}
                          <ExternalLink
                            className="size-3 opacity-60"
                            aria-hidden
                          />
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Ingen ROS-analyse koblet
                  </p>
                )}
              </div>
              <LinkRow
                label="Organisasjon"
                text={organizationLine.trim() || workspace?.name || undefined}
                emptyText="Ikke angitt"
              />
            </div>
          </CollapsibleSection>

          {/* ============ MAIN SECTIONS ============ */}
          <Accordion
            multiple
            defaultValue={["overview", "asis", "tobe"]}
            className="space-y-3"
          >
            {/* ---- 1. Oversikt ---- */}
            <AccordionItem
              value="overview"
              className="overflow-hidden rounded-2xl border border-border/60 bg-card/70 px-4 shadow-sm backdrop-blur-sm sm:px-5"
            >
              <AccordionTrigger className="py-4 text-sm font-semibold no-underline hover:no-underline">
                Prosessoversikt
              </AccordionTrigger>
              <AccordionContent className="space-y-5 border-t border-border/40 pt-4">
                <Field
                  label="Prosesstittel"
                  value={payload.processTitle ?? payload.asIsProcessName ?? ""}
                  onChange={(v) => setStr("processTitle", v)}
                  rows={1}
                  disabled={!canEdit}
                  placeholder="Navnet på prosessen som skal automatiseres"
                />
                {processFromRegistry && (
                  <ReadOnlyBlock label="Fra prosessregisteret">
                    <p className="font-medium">
                      {processFromRegistry.code} {processFromRegistry.name}
                    </p>
                    {processFromRegistry.notes && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {processFromRegistry.notes}
                      </p>
                    )}
                  </ReadOnlyBlock>
                )}
                <Field
                  label="Kort beskrivelse (1–2 linjer)"
                  value={payload.shortDescription ?? ""}
                  onChange={(v) => setStr("shortDescription", v)}
                  rows={2}
                  disabled={!canEdit}
                  placeholder="Hva gjør prosessen, og hva er målet med automatiseringen?"
                />
                <Field
                  label="Detaljert beskrivelse / sammendrag"
                  value={payload.executiveSummary ?? ""}
                  onChange={(v) => setStr("executiveSummary", v)}
                  rows={5}
                  disabled={!canEdit}
                  placeholder="Utfyllende kontekst, bakgrunn og forventet effekt"
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Formål"
                    value={payload.purpose ?? ""}
                    onChange={(v) => setStr("purpose", v)}
                    rows={3}
                    disabled={!canEdit}
                  />
                  <Field
                    label="Mål og forventet nytte"
                    value={payload.objectives ?? ""}
                    onChange={(v) => setStr("objectives", v)}
                    rows={3}
                    disabled={!canEdit}
                  />
                </div>
                <Field
                  label="Virksomhetslinje (forside, valgfritt)"
                  value={organizationLine}
                  onChange={(v) => {
                    setOrganizationLine(v);
                    setDirty(true);
                  }}
                  rows={1}
                  disabled={!canEdit}
                  placeholder="F.eks. Avdeling for digitalisering"
                />
                <Field
                  label="Forutsetninger"
                  value={payload.prerequisites ?? ""}
                  onChange={(v) => setStr("prerequisites", v)}
                  rows={3}
                  disabled={!canEdit}
                  placeholder="Hva må være på plass før automatisering kan starte?"
                />
              </AccordionContent>
            </AccordionItem>

            {/* ---- 2. As-Is ---- */}
            <AccordionItem
              value="asis"
              className="overflow-hidden rounded-2xl border border-border/60 bg-card/70 px-4 shadow-sm backdrop-blur-sm sm:px-5"
            >
              <AccordionTrigger className="py-4 text-sm font-semibold no-underline hover:no-underline">
                As-Is — nåværende prosess
              </AccordionTrigger>
              <AccordionContent className="space-y-5 border-t border-border/40 pt-4">
                <Field
                  label="Beskrivelse av nåsituasjonen"
                  value={payload.asIsShortDescription ?? ""}
                  onChange={(v) => setStr("asIsShortDescription", v)}
                  rows={5}
                  disabled={!canEdit}
                  placeholder="Operasjon, aktivitet og utfall i nåværende prosess"
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Roller"
                    value={payload.asIsRoles ?? ""}
                    onChange={(v) => setStr("asIsRoles", v)}
                    rows={3}
                    disabled={!canEdit}
                  />
                  <Field
                    label="Volum og frekvens"
                    value={payload.asIsVolume ?? ""}
                    onChange={(v) => setStr("asIsVolume", v)}
                    rows={3}
                    disabled={!canEdit}
                  />
                  <Field
                    label="Behandlingstid"
                    value={payload.asIsHandleTime ?? ""}
                    onChange={(v) => setStr("asIsHandleTime", v)}
                    rows={2}
                    disabled={!canEdit}
                  />
                  <Field
                    label="FTE / ressurs"
                    value={payload.asIsFte ?? ""}
                    onChange={(v) => setStr("asIsFte", v)}
                    rows={2}
                    disabled={!canEdit}
                  />
                </div>
                <ProcessTextDiagramBlock
                  sectionLabel="As-Is prosesskart"
                  diagramHint="Koble bokser med Pil-verktøyet. Pilene festes til kanten av boksene. Bruk fullskjerm for større arbeidsflate."
                  textRows={4}
                  textValue={payload.asIsProcessMap ?? ""}
                  onTextChange={(v) => setStr("asIsProcessMap", v)}
                  diagramValue={payload.asIsDiagramSnapshot}
                  onDiagramJson={(json) =>
                    setStr("asIsDiagramSnapshot", json)
                  }
                  canEdit={canEdit}
                  instanceKey={diagramInstanceKey}
                />
                <ApplicationEditor
                  rows={payload.asIsApplications ?? []}
                  disabled={!canEdit}
                  onChange={(rows) => {
                    setPayload((p) => ({
                      ...p,
                      asIsApplications: rows,
                    }));
                    setDirty(true);
                  }}
                />
                <StepsEditor
                  label="As-Is trinn"
                  rows={payload.asIsSteps ?? []}
                  disabled={!canEdit}
                  onChange={(rows) => {
                    setPayload((p) => ({ ...p, asIsSteps: rows }));
                    setDirty(true);
                  }}
                />
              </AccordionContent>
            </AccordionItem>

            {/* ---- 3. To-Be ---- */}
            <AccordionItem
              value="tobe"
              className="overflow-hidden rounded-2xl border border-border/60 bg-card/70 px-4 shadow-sm backdrop-blur-sm sm:px-5"
            >
              <AccordionTrigger className="py-4 text-sm font-semibold no-underline hover:no-underline">
                To-Be — fremtidig prosess
              </AccordionTrigger>
              <AccordionContent className="space-y-5 border-t border-border/40 pt-4">
                <ProcessTextDiagramBlock
                  sectionLabel="To-Be prosesskart"
                  diagramHint="Tegn fremtidig flyt — bruk Pil-verktøyet for koblinger."
                  textRows={4}
                  textValue={payload.toBeMap ?? ""}
                  onTextChange={(v) => setStr("toBeMap", v)}
                  diagramValue={payload.toBeDiagramSnapshot}
                  onDiagramJson={(json) =>
                    setStr("toBeDiagramSnapshot", json)
                  }
                  canEdit={canEdit}
                  instanceKey={diagramInstanceKey}
                />
                <Field
                  label="To-Be trinn i detalj"
                  value={payload.toBeSteps ?? ""}
                  onChange={(v) => setStr("toBeSteps", v)}
                  rows={8}
                  disabled={!canEdit}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="I omfang (RPA)"
                    value={payload.inScope ?? ""}
                    onChange={(v) => setStr("inScope", v)}
                    rows={4}
                    disabled={!canEdit}
                  />
                  <Field
                    label="Utenfor omfang"
                    value={payload.outOfScope ?? ""}
                    onChange={(v) => setStr("outOfScope", v)}
                    rows={4}
                    disabled={!canEdit}
                  />
                </div>
                <Field
                  label="Parallelle initiativ / overlapp"
                  value={payload.parallelInitiatives ?? ""}
                  onChange={(v) => setStr("parallelInitiatives", v)}
                  rows={3}
                  disabled={!canEdit}
                />
              </AccordionContent>
            </AccordionItem>

            {/* ---- 4. HUKI ---- */}
            <AccordionItem
              value="huki"
              className="overflow-hidden rounded-2xl border border-border/60 bg-card/70 px-4 shadow-sm backdrop-blur-sm sm:px-5"
            >
              <AccordionTrigger className="py-4 text-sm font-semibold no-underline hover:no-underline">
                HUKI — roller og ansvar
              </AccordionTrigger>
              <AccordionContent className="border-t border-border/40 pt-4">
                <HukiEditor
                  rows={payload.hukiRows ?? []}
                  disabled={!canEdit}
                  onChange={(rows) => {
                    setPayload((p) => ({ ...p, hukiRows: rows }));
                    setDirty(true);
                  }}
                />
              </AccordionContent>
            </AccordionItem>

            {/* ---- 5. Risiko og feilhåndtering ---- */}
            <AccordionItem
              value="risk"
              className="overflow-hidden rounded-2xl border border-border/60 bg-card/70 px-4 shadow-sm backdrop-blur-sm sm:px-5"
            >
              <AccordionTrigger className="py-4 text-sm font-semibold no-underline hover:no-underline">
                Risiko og feilhåndtering
              </AccordionTrigger>
              <AccordionContent className="space-y-5 border-t border-border/40 pt-4">
                {/* ROS risks — read-only from linked analyses */}
                {rosAnalyses.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-[0.8rem] font-medium text-muted-foreground">
                      Fra koblede ROS-analyser (les fra ROS — ikke dobbeltføring)
                    </Label>
                    <div className="space-y-2">
                      {rosAnalyses.map((r) => (
                        <div
                          key={r.linkId}
                          className="rounded-xl border border-border/60 bg-muted/5 p-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-medium">
                                <AlertTriangle className="mr-1.5 inline size-3.5 text-amber-500" />
                                {r.title}
                              </p>
                              {r.rosSummary.summaryLines.length > 0 && (
                                <ul className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
                                  {r.rosSummary.summaryLines
                                    .slice(0, 5)
                                    .map((line, idx) => (
                                      <li key={idx}>· {line}</li>
                                    ))}
                                </ul>
                              )}
                              {r.pddDigest?.riskSnippets &&
                                r.pddDigest.riskSnippets.length > 0 && (
                                  <details className="mt-2">
                                    <summary className="cursor-pointer text-xs font-medium text-primary">
                                      {r.pddDigest.riskSnippets.length}{" "}
                                      risikopunkt fra matrise
                                    </summary>
                                    <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                                      {r.pddDigest.riskSnippets
                                        .slice(0, 20)
                                        .map((s, idx) => (
                                          <li key={idx}>• {s}</li>
                                        ))}
                                    </ul>
                                  </details>
                                )}
                            </div>
                            <Link
                              href={`/w/${wid}/ros/a/${r.rosAnalysisId}`}
                              className="shrink-0 text-xs font-medium text-primary underline-offset-4 hover:underline"
                            >
                              Åpne ROS
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {rosAnalyses.length === 0 && (
                  <ReadOnlyBlock label="ROS-analyser">
                    <p className="text-muted-foreground">
                      Ingen ROS-analyse koblet. Koble en ROS-analyse til denne
                      vurderingen for å vise risikoer her automatisk.
                    </p>
                  </ReadOnlyBlock>
                )}

                <ExceptionRowsEditor
                  label="Kjente forretningsunntak (PDD-spesifikke)"
                  rows={payload.businessExceptionsKnown ?? []}
                  disabled={!canEdit}
                  onChange={(rows) => {
                    setPayload((p) => ({
                      ...p,
                      businessExceptionsKnown: rows,
                    }));
                    setDirty(true);
                  }}
                />
                <Field
                  label="Ukjente forretningsunntak (standard handling)"
                  value={payload.businessExceptionsUnknown ?? ""}
                  onChange={(v) => setStr("businessExceptionsUnknown", v)}
                  rows={3}
                  disabled={!canEdit}
                />
                <ExceptionRowsEditor
                  label="Kjente tekniske feil (PDD-spesifikke)"
                  rows={payload.appErrorsKnown ?? []}
                  disabled={!canEdit}
                  onChange={(rows) => {
                    setPayload((p) => ({
                      ...p,
                      appErrorsKnown: rows,
                    }));
                    setDirty(true);
                  }}
                />
                <Field
                  label="Ukjente tekniske feil (standard handling)"
                  value={payload.appErrorsUnknown ?? ""}
                  onChange={(v) => setStr("appErrorsUnknown", v)}
                  rows={3}
                  disabled={!canEdit}
                />
                <Field
                  label="Rapportering og logging"
                  value={payload.reporting ?? ""}
                  onChange={(v) => setStr("reporting", v)}
                  rows={4}
                  disabled={!canEdit}
                />
              </AccordionContent>
            </AccordionItem>

            {/* ---- 6. Tillegg ---- */}
            <AccordionItem
              value="extra"
              className="overflow-hidden rounded-2xl border border-border/60 bg-card/70 px-4 shadow-sm backdrop-blur-sm sm:px-5"
            >
              <AccordionTrigger className="py-4 text-sm font-semibold no-underline hover:no-underline">
                Tilleggsinformasjon
              </AccordionTrigger>
              <AccordionContent className="space-y-5 border-t border-border/40 pt-4">
                <Field
                  label="Andre observasjoner"
                  value={payload.otherObservations ?? ""}
                  onChange={(v) => setStr("otherObservations", v)}
                  rows={4}
                  disabled={!canEdit}
                />
                <Field
                  label="Tilleggskilder / SOP / video"
                  value={payload.additionalSources ?? ""}
                  onChange={(v) => setStr("additionalSources", v)}
                  rows={4}
                  disabled={!canEdit}
                />
                <Field
                  label="Tidsplan og milepæler"
                  value={payload.targetTimeline ?? ""}
                  onChange={(v) => setStr("targetTimeline", v)}
                  rows={4}
                  disabled={!canEdit}
                />
                <Field
                  label="Vedlegg"
                  value={payload.appendix ?? ""}
                  onChange={(v) => setStr("appendix", v)}
                  rows={3}
                  disabled={!canEdit}
                />
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {/* Mobile sticky bottom bar */}
          {canEdit && (
            <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/90 px-4 py-3 backdrop-blur-xl sm:hidden [padding-bottom:calc(0.75rem+env(safe-area-inset-bottom))]">
              <Button
                type="button"
                size="lg"
                className="h-12 w-full gap-2 rounded-2xl shadow-sm"
                onClick={handleSave}
                disabled={saving || !dirty}
              >
                {saving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                {dirty ? "Lagre endringer" : "Ingen endringer"}
              </Button>
            </div>
          )}
        </>
      )}

      {/* Version history sheet */}
      <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
        <SheetContent side="right" showOnDesktop>
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-base font-semibold">Versjonshistorikk</h2>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setHistoryOpen(false)}
              >
                <X className="size-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3">
              {versionCount === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Ingen historikk ennå.
                </p>
              ) : (
                <ul className="space-y-1">
                  {docState.versions.map((v) => (
                    <li
                      key={v._id}
                      className="rounded-lg p-3 transition-colors hover:bg-muted/50"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold">
                            Versjon {v.version}
                          </p>
                          {v.note && (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {v.note}
                            </p>
                          )}
                          <p className="mt-1 text-[10px] text-muted-foreground">
                            {new Date(v.createdAt).toLocaleString("nb-NO")}
                          </p>
                        </div>
                        {canEdit && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="shrink-0 gap-1 text-xs"
                            onClick={() => handleRestore(v.version)}
                            disabled={saving}
                          >
                            <RefreshCw className="size-3" aria-hidden />
                            Gjenopprett
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Snapshot dialog */}
      <Dialog
        open={pdfPreviewOpen}
        onOpenChange={(open) => {
          setPdfPreviewOpen(open);
          if (!open && pdfPreviewUrl) {
            URL.revokeObjectURL(pdfPreviewUrl);
            setPdfPreviewUrl(null);
          }
        }}
      >
        <DialogContent
          size="2xl"
          titleId="pdd-pdf-preview-title"
          className="max-h-[min(95vh,58rem)]"
        >
          <DialogHeader>
            <p
              id="pdd-pdf-preview-title"
              className="font-heading text-lg font-semibold"
            >
              Forhåndsvis PDF
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Slik ser eksporten ut nå basert på gjeldende innhold i dokumentet.
            </p>
          </DialogHeader>
          <DialogBody className="space-y-3">
            <div className="overflow-hidden rounded-2xl border border-border/60 bg-muted/20">
              {pdfPreviewUrl ? (
                <iframe
                  src={pdfPreviewUrl}
                  title="PDD PDF-forhåndsvisning"
                  className="h-[min(72vh,48rem)] w-full bg-background"
                />
              ) : (
                <div className="flex h-[min(72vh,48rem)] items-center justify-center text-sm text-muted-foreground">
                  Ingen forhåndsvisning tilgjengelig.
                </div>
              )}
            </div>
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPdfPreviewOpen(false)}
            >
              Lukk
            </Button>
            <Button
              type="button"
              onClick={() => void exportPdf()}
              disabled={pdfExporting}
            >
              {pdfExporting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <FileDown className="size-4" />
              )}
              Last ned PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Snapshot dialog */}
      <Dialog open={snapshotOpen} onOpenChange={setSnapshotOpen}>
        <DialogContent
          size="md"
          titleId="pdd-snap-title"
          descriptionId="pdd-snap-desc"
        >
          <DialogHeader>
            <p
              id="pdd-snap-title"
              className="font-heading text-lg font-semibold"
            >
              Lagre versjon
            </p>
            <p
              id="pdd-snap-desc"
              className="text-sm leading-relaxed text-muted-foreground"
            >
              Oppretter et merket snapshot av sist lagret innhold.
            </p>
          </DialogHeader>
          <DialogBody className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="snap-note">Kommentar (valgfritt)</Label>
              <Input
                id="snap-note"
                value={snapshotNote}
                onChange={(e) => setSnapshotNote(e.target.value)}
                placeholder="F.eks. Etter workshop med forretning"
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSnapshotOpen(false)}
            >
              Avbryt
            </Button>
            <Button type="button" onClick={handleSnapshot} disabled={saving}>
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              Lagre snapshot
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Conflict dialog */}
      <Dialog open={conflictOpen} onOpenChange={setConflictOpen}>
        <DialogContent size="md" titleId="pdd-conflict-title">
          <DialogHeader>
            <p
              id="pdd-conflict-title"
              className="font-heading text-lg font-semibold"
            >
              Konflikt ved lagring
            </p>
          </DialogHeader>
          <DialogBody>
            <p className="text-sm">{conflictHint}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Last siden på nytt for å hente siste versjon.
            </p>
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              onClick={() => {
                setConflictOpen(false);
                window.location.reload();
              }}
            >
              Last på nytt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  LinkRow                                                            */
/* ------------------------------------------------------------------ */

function LinkRow({
  label,
  href,
  text,
  emptyText,
}: {
  label: string;
  href?: string;
  text?: string;
  emptyText?: string;
}) {
  return (
    <div>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {text && href ? (
        <Link
          href={href}
          className="mt-0.5 flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          {text}
          <ExternalLink className="size-3 opacity-60" aria-hidden />
        </Link>
      ) : text ? (
        <p className="mt-0.5 text-sm">{text}</p>
      ) : (
        <p className="mt-0.5 text-xs text-muted-foreground">
          {emptyText ?? "—"}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  ApplicationEditor                                                  */
/* ------------------------------------------------------------------ */

function ApplicationEditor({
  rows,
  onChange,
  disabled,
}: {
  rows: ProcessDesignAppRow[];
  onChange: (r: ProcessDesignAppRow[]) => void;
  disabled: boolean;
}) {
  const update = (i: number, patch: Partial<ProcessDesignAppRow>) => {
    onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  };
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-[0.8rem] font-medium text-muted-foreground">
          Applikasjoner
        </Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          className="gap-1"
          onClick={() =>
            onChange([
              ...rows,
              {
                name: "",
                type: "",
                env: "",
                comments: "",
                phase: "As-Is / To-Be",
              },
            ])
          }
        >
          <Plus className="size-3" aria-hidden />
          Legg til
        </Button>
      </div>
      {rows.length === 0 && (
        <p className="py-3 text-center text-xs text-muted-foreground">
          Ingen applikasjoner lagt til
        </p>
      )}
      <ul className="space-y-2">
        {rows.map((r, i) => (
          <li
            key={i}
            className="rounded-xl border border-border/60 bg-muted/5 p-3"
          >
            <div className="grid gap-2 sm:grid-cols-2">
              <Input
                placeholder="Applikasjon"
                value={r.name}
                disabled={disabled}
                onChange={(e) => update(i, { name: e.target.value })}
              />
              <Input
                placeholder="Type"
                value={r.type ?? ""}
                disabled={disabled}
                onChange={(e) => update(i, { type: e.target.value })}
              />
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <Input
                placeholder="Miljø / tilgang"
                value={r.env ?? ""}
                disabled={disabled}
                onChange={(e) => update(i, { env: e.target.value })}
              />
              <Input
                placeholder="As-Is / To-Be"
                value={r.phase ?? ""}
                disabled={disabled}
                onChange={(e) => update(i, { phase: e.target.value })}
              />
            </div>
            <div className="mt-2 flex justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1 text-xs text-muted-foreground hover:text-destructive"
                disabled={disabled}
                onClick={() => onChange(rows.filter((_, j) => j !== i))}
              >
                <Trash2 className="size-3" aria-hidden />
                Fjern
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  ExceptionRowsEditor                                                */
/* ------------------------------------------------------------------ */

function ExceptionRowsEditor({
  label,
  rows,
  onChange,
  disabled,
}: {
  label: string;
  rows: ProcessDesignExceptionRow[];
  onChange: (r: ProcessDesignExceptionRow[]) => void;
  disabled: boolean;
}) {
  const update = (i: number, patch: Partial<ProcessDesignExceptionRow>) => {
    onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  };
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-[0.8rem] font-medium text-muted-foreground">
          {label}
        </Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          className="gap-1"
          onClick={() =>
            onChange([
              ...rows,
              { name: "", action: "", step: "", params: "" },
            ])
          }
        >
          <Plus className="size-3" aria-hidden />
          Legg til
        </Button>
      </div>
      {rows.length === 0 && (
        <p className="py-3 text-center text-xs text-muted-foreground">
          Ingen unntak lagt til
        </p>
      )}
      <ul className="space-y-2">
        {rows.map((r, i) => (
          <li
            key={i}
            className="rounded-xl border border-border/60 bg-muted/5 p-3"
          >
            <Input
              placeholder="Navn / type unntak"
              value={r.name}
              disabled={disabled}
              onChange={(e) => update(i, { name: e.target.value })}
            />
            <Textarea
              placeholder="Handling / tiltak"
              value={r.action}
              disabled={disabled}
              rows={2}
              className="mt-2"
              onChange={(e) => update(i, { action: e.target.value })}
            />
            <div className="mt-2 flex justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1 text-xs text-muted-foreground hover:text-destructive"
                disabled={disabled}
                onClick={() => onChange(rows.filter((_, j) => j !== i))}
              >
                <Trash2 className="size-3" aria-hidden />
                Fjern
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  StepsEditor                                                        */
/* ------------------------------------------------------------------ */

function StepsEditor({
  label,
  rows,
  onChange,
  disabled,
}: {
  label: string;
  rows: ProcessDesignStepRow[];
  onChange: (r: ProcessDesignStepRow[]) => void;
  disabled: boolean;
}) {
  const update = (i: number, patch: Partial<ProcessDesignStepRow>) => {
    onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  };
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-[0.8rem] font-medium text-muted-foreground">
          {label}
        </Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          className="gap-1"
          onClick={() =>
            onChange([
              ...rows,
              {
                stepNo: String(rows.length + 1),
                description: "",
                input: "",
                details: "",
                exception: "",
                actions: "",
                rules: "",
              },
            ])
          }
        >
          <Plus className="size-3" aria-hidden />
          Legg til
        </Button>
      </div>
      {rows.length === 0 && (
        <p className="py-3 text-center text-xs text-muted-foreground">
          Ingen trinn lagt til
        </p>
      )}
      <ul className="space-y-2">
        {rows.map((r, i) => (
          <li
            key={i}
            className="rounded-xl border border-border/60 bg-muted/5 p-3"
          >
            <div className="flex items-start gap-2">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-bold text-muted-foreground">
                {r.stepNo || i + 1}
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <Textarea
                  placeholder="Beskrivelse"
                  value={r.description}
                  disabled={disabled}
                  rows={2}
                  onChange={(e) =>
                    update(i, { description: e.target.value })
                  }
                />
                <Textarea
                  placeholder="Inndata"
                  value={r.input ?? ""}
                  disabled={disabled}
                  rows={1}
                  onChange={(e) => update(i, { input: e.target.value })}
                />
                <Textarea
                  placeholder="Unntak / feilhåndtering"
                  value={r.exception ?? ""}
                  disabled={disabled}
                  rows={1}
                  onChange={(e) =>
                    update(i, { exception: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="mt-2 flex justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1 text-xs text-muted-foreground hover:text-destructive"
                disabled={disabled}
                onClick={() => onChange(rows.filter((_, j) => j !== i))}
              >
                <Trash2 className="size-3" aria-hidden />
                Fjern
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
