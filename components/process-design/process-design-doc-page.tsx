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
import { cn } from "@/lib/utils";
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
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

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

function subscribeMobileViewport(callback: () => void) {
  const mq = window.matchMedia("(max-width: 1023px)");
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

function getMobileViewport() {
  return window.matchMedia("(max-width: 1023px)").matches;
}

function hasMeaningfulValue(value: unknown): boolean {
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return false;
}

function payloadHasMeaningfulContent(payload: ProcessDesignDocumentPayload): boolean {
  return Object.values(payload).some((value) => hasMeaningfulValue(value));
}

function textareaHeightClass(rows: number): string {
  if (rows <= 1) return "min-h-[3.25rem] sm:min-h-[2.75rem]";
  if (rows <= 2) return "min-h-[5.75rem] sm:min-h-[4.75rem]";
  if (rows <= 4) return "min-h-[8.5rem] sm:min-h-[7rem]";
  if (rows <= 6) return "min-h-[11rem] sm:min-h-[9rem]";
  return "min-h-[14rem] sm:min-h-[11rem]";
}

const PDD_SOURCE_MAPPING_GROUPS = [
  {
    title: "Prosessoversikt",
    fields:
      "Prosesstittel, kort beskrivelse, sammendrag, formål, mål, forutsetninger og virksomhetskontekst.",
    sources:
      "Primært fra denne PVV-vurderingen. Ekstra registerfelter (org., compliance-hint m.m.) brukes bare når prosessen er eksplisitt koblet til vurderingen i prosessregisteret. Inntak kan supplere med lokal kontekst når et godkjent inntak er knyttet til samme vurdering.",
  },
  {
    title: "As-Is",
    fields:
      "Nåsituasjon, roller, volum, tid, ressursbruk, systemer, trinn, input/output og prosessområde.",
    sources:
      "Primært fra denne vurderingen. Registerdetaljer kun ved eksplisitt kobling vurdering ↔ prosess. Inntak (godkjent mot denne vurderingen) kan gi ekstra lokale detaljer.",
  },
  {
    title: "To-Be",
    fields:
      "Omfang, utenfor omfang, parallelle initiativ, framtidig flyt og milepæler.",
    sources:
      "Bygges mest fra vurderingen, men justeres med organisatoriske avhengigheter, eksisterende automasjoner og gjennomføringssignaler fra vurderingen.",
  },
  {
    title: "Risiko og tillegg",
    fields:
      "Kjente/ukjente unntak, tekniske feil, rapportering, observasjoner, tilleggskilder og støtte for drift.",
    sources:
      "ROS er hovedkilde for risiko og kontroller. Vurdering tilfører fallback, barrierer og driftsbehov. Inntak kan supplere med konkrete lokale avvik.",
  },
] as const;

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
  description,
  sourceHint,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  disabled?: boolean;
  placeholder?: string;
  description?: string;
  sourceHint?: string;
  className?: string;
}) {
  return (
    <div className="space-y-2.5">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <Label className="text-[0.76rem] font-semibold tracking-[0.01em] text-muted-foreground">
            {label}
          </Label>
          {sourceHint ? <StatusBadge>{sourceHint}</StatusBadge> : null}
        </div>
        {description ? (
          <p className="text-xs leading-5 text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        disabled={disabled}
        placeholder={placeholder}
        className={cn(
          "resize-y rounded-2xl border-border/60 bg-background/80 px-3 py-2.5 text-sm leading-6 shadow-sm transition-colors",
          "focus-visible:ring-1 focus-visible:ring-ring",
          textareaHeightClass(rows),
          className,
        )}
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

function SourceHintBadges({
  hints,
}: {
  hints: string[];
}) {
  const cleanHints = hints.map((hint) => hint.trim()).filter(Boolean);
  if (cleanHints.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {cleanHints.map((hint) => (
        <StatusBadge key={hint}>{hint}</StatusBadge>
      ))}
    </div>
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

const stickyTabChoices = new Map<string, "beskrivelse" | "diagram">();

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
  sourceHints = [],
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
  sourceHints?: string[];
}) {
  const tabKey = `${instanceKey}:${sectionLabel}`;
  const [mode, setModeRaw] = useState<"beskrivelse" | "diagram">(
    () => stickyTabChoices.get(tabKey) ?? "beskrivelse",
  );
  const setMode = useCallback(
    (next: "beskrivelse" | "diagram") => {
      stickyTabChoices.set(tabKey, next);
      setModeRaw(next);
    },
    [tabKey],
  );
  const [diagramFullscreen, setDiagramFullscreen] = useState(false);
  const isMobileViewport = useSyncExternalStore(
    subscribeMobileViewport,
    getMobileViewport,
    () => false,
  );
  const diagramDialogOpen = (isMobileViewport && mode === "diagram") || diagramFullscreen;

  const toggleDiagramFullscreen = useCallback(() => {
    setDiagramFullscreen((current) => !current);
  }, []);

  useEffect(() => {
    if (mode !== "diagram") {
      setDiagramFullscreen(false);
    }
  }, [mode]);

  return (
    <div className="space-y-2">
      <div className="space-y-2">
        <Label className="text-[0.8rem] font-medium text-muted-foreground">
          {sectionLabel}
        </Label>
        <SourceHintBadges hints={sourceHints} />
      </div>
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
          rows={isMobileViewport ? Math.max(textRows, 8) : textRows}
          disabled={!canEdit}
          className={cn(
            "resize-y rounded-2xl border-border/60 bg-background/80 px-3 py-2.5 text-sm leading-6 shadow-sm",
            isMobileViewport
              ? "min-h-[14rem]"
              : textareaHeightClass(textRows),
          )}
        />
      ) : !isMobileViewport ? (
        <div
          className="flex flex-col gap-3"
        >
          <div className="space-y-2">
            <p className="text-xs leading-relaxed text-muted-foreground">
              {diagramHint}
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
                <Maximize2
                  className="mr-1.5 size-3.5 shrink-0"
                  aria-hidden
                />
                Fullskjerm
              </Button>
            </div>
          </div>
          <div>
            <PddTldrawCanvas
              snapshotJson={diagramValue}
              onSnapshotChange={onDiagramJson}
              readOnly={!canEdit}
              instanceKey={instanceKey}
              layoutVariant="embed"
            />
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-border/60 bg-muted/10 p-4 text-sm text-muted-foreground">
          Diagrammet er åpnet i mobilvisning. Bruk knappen under for å lukke og gå tilbake til
          beskrivelse.
        </div>
      )}
      <Dialog
        open={diagramDialogOpen}
        onOpenChange={(open) => {
          if (isMobileViewport) {
            setMode(open ? "diagram" : "beskrivelse");
          }
          setDiagramFullscreen(open && !isMobileViewport);
        }}
      >
        <DialogContent
          size="7xl"
          titleId={`${instanceKey}-diagram-title`}
          className="h-[96vh] max-w-[min(96vw,96rem)] p-0"
        >
          <div className="flex h-full min-h-0 flex-col">
            <DialogHeader className="space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <p id={`${instanceKey}-diagram-title`} className="font-heading text-lg font-semibold">
                    {sectionLabel}
                  </p>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    Bruk to fingre for zoom og én finger for å tegne eller flytte objekter.
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  {canEdit && diagramValue?.trim() ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-10 justify-center sm:h-9"
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
                    className="h-10 justify-center sm:h-9"
                    onClick={() => {
                      if (isMobileViewport) {
                        setMode("beskrivelse");
                      } else {
                        setDiagramFullscreen(false);
                      }
                    }}
                  >
                    {isMobileViewport ? (
                      <X className="mr-1.5 size-3.5 shrink-0" aria-hidden />
                    ) : (
                      <Minimize2 className="mr-1.5 size-3.5 shrink-0" aria-hidden />
                    )}
                    {isMobileViewport ? "Lukk diagram" : "Avslutt fullskjerm"}
                  </Button>
                </div>
              </div>
            </DialogHeader>
            <DialogBody className="min-h-0 flex-1 p-3 sm:p-4">
              <PddTldrawCanvas
                snapshotJson={diagramValue}
                onSnapshotChange={onDiagramJson}
                readOnly={!canEdit}
                instanceKey={`${instanceKey}:${isMobileViewport ? "mobile" : "fullscreen"}`}
                layoutVariant="fullscreen"
                className="min-h-0 flex-1 rounded-[1.25rem] sm:rounded-[1.5rem]"
              />
            </DialogBody>
          </div>
        </DialogContent>
      </Dialog>
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
  sourceHints = [],
}: {
  rows: ProcessDesignHukiRow[];
  onChange: (r: ProcessDesignHukiRow[]) => void;
  disabled: boolean;
  sourceHints?: string[];
}) {
  const update = (i: number, patch: Partial<ProcessDesignHukiRow>) => {
    onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  };

  const hasAnyData = rows.some(
    (r) => r.h?.trim() || r.u?.trim() || r.k?.trim() || r.i?.trim(),
  );

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label className="text-[0.8rem] font-medium text-muted-foreground">
            HUKI-matrise
          </Label>
        </div>
        <SourceHintBadges hints={sourceHints} />
      </div>
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
  const registryLinksForAssessment = useQuery(
    api.candidates.getLinkedCandidateForAssessment,
    { assessmentId },
  );
  const workspace = useQuery(api.workspaces.get, { workspaceId });

  const router = useRouter();
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
  const [leavePromptOpen, setLeavePromptOpen] = useState(false);
  const [leaveBusy, setLeaveBusy] = useState(false);
  const pendingNavHrefRef = useRef<string | null>(null);
  const leavePromptOpenRef = useRef(false);
  const [openSections, setOpenSections] = useState<string[]>([
    "overview",
    "asis",
    "tobe",
  ]);
  const autoAutofillKeyRef = useRef<string | null>(null);
  const payloadRef = useRef(payload);
  const organizationLineRef = useRef(organizationLine);
  const revisionRef = useRef(revision);
  const dirtyRef = useRef(dirty);
  const canEditRef = useRef(false);
  const hasDocRef = useRef(false);
  const saveInFlightRef = useRef(false);
  const saveQueuedRef = useRef(false);

  useEffect(() => {
    payloadRef.current = payload;
  }, [payload]);

  useEffect(() => {
    organizationLineRef.current = organizationLine;
  }, [organizationLine]);

  useEffect(() => {
    revisionRef.current = revision;
  }, [revision]);

  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  useEffect(() => {
    leavePromptOpenRef.current = leavePromptOpen;
  }, [leavePromptOpen]);

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
  canEditRef.current = canEdit;
  const assessmentTitle = docState?.assessment?.title ?? "Vurdering";
  const hasDoc = docState !== undefined && docState !== null && docState.document !== null;
  hasDocRef.current = hasDoc;
  const versionCount = docState?.versions?.length ?? 0;
  const diagramInstanceKey = useMemo(
    () => `${String(assessmentId)}-${revision}`,
    [assessmentId, revision],
  );

  const setStr = (key: keyof ProcessDesignDocumentPayload, v: string) => {
    setPayload((p) => ({ ...p, [key]: v }));
    setDirty(true);
  };

  const autofillSuggestion = useMemo(() => {
    const pl = draftBundle?.draft?.payload as AssessmentPayload | undefined;
    if (!pl) return null;
    return buildProcessDesignAutofill({
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
        registryLinksForAssessment?.explicitRegistryLink?.linked === true
          ? registryLinksForAssessment.explicitRegistryLink
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
  }, [
    assessmentTitle,
    draftBundle?.draft?.payload,
    intake,
    registryLinksForAssessment,
    rosCtx,
    workspace?.name,
  ]);

  const persistDraft = useCallback(
    async (options?: { silent?: boolean }): Promise<boolean> => {
      if (!canEditRef.current || !hasDocRef.current) return true;
      if (!dirtyRef.current && options?.silent) return true;
      if (saveInFlightRef.current) {
        saveQueuedRef.current = true;
        return true;
      }

      const payloadToSave = payloadRef.current;
      const orgToSave = organizationLineRef.current.trim() || null;
      const revisionToSave = revisionRef.current;
      const signature = JSON.stringify({
        organizationLine: orgToSave,
        payload: payloadToSave,
      });

      saveInFlightRef.current = true;
      saveQueuedRef.current = false;
      setSaving(true);
      setConflictHint(null);

      let ok = true;
      try {
        const res = await saveDraft({
          assessmentId,
          expectedRevision: revisionToSave,
          organizationLine: orgToSave,
          payload: payloadToSave,
        });

        if (res.ok) {
          revisionRef.current = res.revision;
          setRevision(res.revision);
          const latestSignature = JSON.stringify({
            organizationLine: organizationLineRef.current.trim() || null,
            payload: payloadRef.current,
          });
          const stillDirty = latestSignature !== signature;
          dirtyRef.current = stillDirty;
          setDirty(stillDirty);
          if (stillDirty) {
            saveQueuedRef.current = true;
          }
        } else {
          ok = false;
          setConflictHint(
            res.conflict.updatedByName
              ? `Noen andre (${res.conflict.updatedByName}) lagret mens du redigerte.`
              : "Noen andre lagret mens du redigerte.",
          );
          setConflictOpen(true);
        }
      } finally {
        saveInFlightRef.current = false;
        setSaving(false);
        if (saveQueuedRef.current && canEditRef.current && hasDocRef.current) {
          saveQueuedRef.current = false;
          void persistDraft({ silent: true });
        }
      }
      return ok;
    },
    [assessmentId, saveDraft],
  );

  const applyAutofill = useCallback(() => {
    if (!autofillSuggestion) return;
    let changedPayload = false;
    setPayload((cur) => {
      const next = mergeAutofillEmptyOnly(cur, autofillSuggestion);
      changedPayload = JSON.stringify(next) !== JSON.stringify(cur);
      return next;
    });
    let changedOrganization = false;
    const orgSug = suggestedOrganizationLine(workspace?.name ?? null);
    if (orgSug && !organizationLine.trim()) {
      setOrganizationLine(orgSug);
      changedOrganization = true;
    }
    if (changedPayload || changedOrganization) {
      setDirty(true);
    }
  }, [
    autofillSuggestion,
    organizationLine,
    workspace?.name,
  ]);

  const handleSave = async () => {
    if (!canEdit || !docState?.document) return;
    await persistDraft();
  };

  const completePendingNavigation = useCallback(() => {
    const href = pendingNavHrefRef.current;
    pendingNavHrefRef.current = null;
    setLeavePromptOpen(false);
    if (href) {
      router.push(href);
    }
  }, [router]);

  const handleLeaveSave = async () => {
    if (!canEdit) {
      completePendingNavigation();
      return;
    }
    setLeaveBusy(true);
    try {
      const saved = await persistDraft();
      if (saved) {
        completePendingNavigation();
      }
    } finally {
      setLeaveBusy(false);
    }
  };

  const handleLeaveDiscard = () => {
    completePendingNavigation();
  };

  useEffect(() => {
    if (!hasDoc || !dirty) return;

    const onClickCapture = (e: MouseEvent) => {
      if (e.defaultPrevented) return;
      if (e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (leavePromptOpenRef.current) return;

      const t = e.target;
      if (!(t instanceof Element)) return;
      const a = t.closest("a[href]");
      if (!a || !(a instanceof HTMLAnchorElement)) return;
      if (a.target === "_blank" || a.download) return;

      const hrefAttr = a.getAttribute("href");
      if (!hrefAttr || hrefAttr.startsWith("#")) return;

      let url: URL;
      try {
        url = new URL(hrefAttr, window.location.origin);
      } catch {
        return;
      }
      if (!url.protocol.startsWith("http")) return;
      if (url.origin !== window.location.origin) return;

      const nextPath = `${url.pathname}${url.search}${url.hash}`;
      const herePath = `${window.location.pathname}${window.location.search}`;
      const nextPathNoHash = `${url.pathname}${url.search}`;
      if (nextPathNoHash === herePath) return;

      e.preventDefault();
      pendingNavHrefRef.current = nextPath;
      setLeavePromptOpen(true);
    };

    document.addEventListener("click", onClickCapture, true);
    return () => document.removeEventListener("click", onClickCapture, true);
  }, [hasDoc, dirty]);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current && !saveInFlightRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  useEffect(() => {
    if (!hasDoc || !canEdit || !autofillSuggestion) return;
    if (dirty || revision > 1 || versionCount > 0) return;
    if (
      payloadHasMeaningfulContent(payload) ||
      organizationLine.trim().length > 0 ||
      !payloadHasMeaningfulContent(autofillSuggestion)
    ) {
      return;
    }
    const autoKey = `${String(assessmentId)}:${revision}`;
    if (autoAutofillKeyRef.current === autoKey) return;
    autoAutofillKeyRef.current = autoKey;
    applyAutofill();
  }, [
    assessmentId,
    applyAutofill,
    autofillSuggestion,
    canEdit,
    dirty,
    hasDoc,
    organizationLine,
    payload,
    revision,
    versionCount,
  ]);

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
    registryLinksForAssessment === undefined ||
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

  /* ---- Derived data from linked sources (no duplicate entry) ---- */
  const registryLinksResolved = registryLinksForAssessment ?? {
    explicitRegistryLink: { linked: false as const },
    draftRegistryMatch: { linked: false as const },
  };

  const explicitRegistry =
    registryLinksResolved.explicitRegistryLink.linked === true
      ? registryLinksResolved.explicitRegistryLink
      : null;
  const draftRegistryOnly =
    !explicitRegistry &&
    registryLinksResolved.draftRegistryMatch.linked === true
      ? registryLinksResolved.draftRegistryMatch
      : null;
  const processForKoblingerRow = explicitRegistry ?? draftRegistryOnly;
  const rosAnalyses = rosCtx ?? [];
  const connectedSources = [
    "PVV-vurdering (denne)",
    explicitRegistry ? "Prosessregister (koblet)" : null,
    rosAnalyses.length > 0
      ? `${rosAnalyses.length} ${rosAnalyses.length === 1 ? "ROS-analyse koblet til vurdering" : "ROS-analyser koblet til vurdering"}`
      : null,
    intake ? "Inntak (godkjent mot vurdering)" : null,
  ].filter(Boolean) as string[];
  const orgCoverageValue =
    payload.orgOperatingUnits?.trim() || payload.orgRolloutNotes?.trim() || "";

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 pb-28 sm:space-y-6 sm:px-6 lg:px-0 lg:pb-12">
      {/* Back nav */}
      <Link
        href={`/w/${wid}/prosessdesign`}
        className="inline-flex touch-manipulation items-center gap-1.5 rounded-lg py-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Til PDD-oversikt
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
              {explicitRegistry ? (
                <StatusBadge>Register koblet til vurdering</StatusBadge>
              ) : draftRegistryOnly ? (
                <StatusBadge tone="warning">Prosess i utkast (ikke koblet)</StatusBadge>
              ) : null}
            </div>
            <ProductPageHeader
              title="Prosessdesign (PDD)"
              description="Dokumenter prosessen enkelt: forstå dagens flyt, beskriv ønsket flyt og gjør den klar for drift."
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
                  explicitRegistry ? "Register (koblet)" : null,
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
                Start med oversikt, deretter As-Is, To-Be og til slutt drift og risiko.
              </p>
            </div>
          </div>
        </div>
      </section>

      {!hasDoc ? (
        <ProductEmptyState
          icon={FileText}
          title="Ingen prosessdesign ennå"
          description="Opprett et dokument for denne vurderingen. Autofill bruker denne PVV-vurderingen, ROS som er koblet til vurderingen, godkjent inntak mot vurderingen, og prosessregisterfelter bare når prosessen er eksplisitt koblet til vurderingen."
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
                  Endringer lagres ikke automatisk — trykk «Lagre» før du forlater siden.
                </p>
              </div>

              <div className="hidden flex-wrap gap-2 sm:flex sm:justify-end">
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
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 rounded-xl"
                  onClick={() => setHistoryOpen(true)}
                >
                  <History className="size-3.5" aria-hidden />
                  Versjonshistorikk
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 rounded-xl"
                  onClick={() => setSnapshotOpen(true)}
                  disabled={!canEdit}
                >
                  <Save className="size-3.5" aria-hidden />
                  Lagre versjon
                </Button>
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
                disabled={!autofillSuggestion || !canEdit}
                title="Tomme felt fylles fra denne vurderingen, ROS koblet til vurderingen, godkjent inntak for vurderingen, og prosessregister kun ved eksplisitt kobling vurdering ↔ prosess"
              >
                <Sparkles className="size-3.5" aria-hidden />
                Fyll inn manglende felt
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
              <div className="hidden sm:block">
                <SecondaryActionsMenu
                  onAutofill={applyAutofill}
                  onSnapshot={() => setHistoryOpen(true)}
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

          <div className="rounded-2xl border border-border/60 bg-muted/15 p-3.5 shadow-sm sm:p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1.5">
                <p className="text-sm font-semibold text-foreground">Versjoner og historikk</p>
                <p className="text-sm leading-6 text-muted-foreground">
                  Du har {versionCount} lagrede {versionCount === 1 ? "versjon" : "versjoner"}.
                  Åpne historikken for å se tidligere lagringer og gjenopprette en eldre versjon.
                  Bruk "Lagre versjon" når du vil merke et bestemt punkt, for eksempel etter
                  workshop eller godkjenning.
                </p>
                <p className="text-xs leading-5 text-muted-foreground">
                  Sletting av enkeltversjoner er ikke tilgjengelig ennå. Eldre versjoner beholdes
                  automatisk innenfor systemets historikkgrense.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 rounded-xl"
                  onClick={() => setHistoryOpen(true)}
                >
                  <History className="size-3.5" aria-hidden />
                  Åpne historikk
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 rounded-xl"
                  onClick={() => setSnapshotOpen(true)}
                  disabled={!canEdit}
                >
                  <Save className="size-3.5" aria-hidden />
                  Lagre ny versjon
                </Button>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/5 p-3.5 shadow-sm sm:p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-1.5">
                <p className="text-sm font-semibold text-foreground">
                  PDD er koblet til kilder som kan fylle ut dokumentet
                </p>
                <p className="text-sm leading-6 text-muted-foreground">
                  Tomme felt fylles fra denne PVV-vurderingen, ROS-analyser som er koblet til
                  akkurat denne vurderingen, og inntak som er godkjent inn i denne vurderingen.
                  Ekstra data fra prosessregister (org., hint-felt m.m.) brukes bare når
                  prosessen er eksplisitt koblet til vurderingen. Du kan redigere alt fritt
                  etterpå.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {connectedSources.map((source) => (
                  <StatusBadge key={source} tone="success">
                    {source}
                  </StatusBadge>
                ))}
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
              <div>
                <LinkRow
                  label="Prosess (register)"
                  href={
                    processForKoblingerRow
                      ? `/w/${wid}/vurderinger?fane=prosesser`
                      : undefined
                  }
                  text={
                    processForKoblingerRow
                      ? `${processForKoblingerRow.code} ${processForKoblingerRow.name}`
                      : undefined
                  }
                  emptyText="Ingen prosess funnet i utkast eller kobling — velg prosess på vurderingen"
                />
                {draftRegistryOnly && !explicitRegistry ? (
                  <p className="mt-1.5 text-xs leading-5 text-amber-800 dark:text-amber-200/90">
                    Prosessen er valgt i vurderingens utkast, men ikke eksplisitt koblet.
                    Koble vurderingen til prosessen under Prosessregister for å ta med
                    registerfelter i «Fyll inn manglende felt».
                  </p>
                ) : null}
              </div>
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

          <CollapsibleSection title="Anbefalt mapping fra kilder" icon={Sparkles}>
            <div className="grid gap-3 sm:grid-cols-2">
              {PDD_SOURCE_MAPPING_GROUPS.map((group) => (
                <div
                  key={group.title}
                  className="rounded-2xl border border-border/60 bg-muted/10 p-4 shadow-sm"
                >
                  <p className="text-sm font-semibold text-foreground">{group.title}</p>
                  <p className="mt-2 text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                    Felter
                  </p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {group.fields}
                  </p>
                  <p className="mt-3 text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                    Hentes fra
                  </p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {group.sources}
                  </p>
                </div>
              ))}
            </div>
          </CollapsibleSection>

          {/* ============ MAIN SECTIONS ============ */}
          <Accordion
            multiple
            value={openSections}
            onValueChange={(value) => setOpenSections([...value])}
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
                  description="Bruk et tydelig navn som matcher vurderingen eller prosessen i registeret."
                  sourceHint={
                    explicitRegistry
                      ? "Eksplisitt koblet til prosessregister"
                      : draftRegistryOnly
                        ? "Prosess i utkast — koble for register i autofill"
                        : "Kan hentes fra vurdering"
                  }
                />
                {explicitRegistry && (
                  <ReadOnlyBlock label="Fra prosessregisteret (koblet til denne vurderingen)">
                    <p className="font-medium">
                      {explicitRegistry.code} {explicitRegistry.name}
                    </p>
                    {explicitRegistry.notes && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {explicitRegistry.notes}
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
                  description="Kort oppsummering som skal være lett å skanne på mobil og i oversikter."
                  sourceHint="Fylles fra vurdering når feltet er tomt"
                />
                <Field
                  label="Detaljert beskrivelse / sammendrag"
                  value={payload.executiveSummary ?? ""}
                  onChange={(v) => setStr("executiveSummary", v)}
                  rows={6}
                  disabled={!canEdit}
                  placeholder="Utfyllende kontekst, bakgrunn og forventet effekt"
                  description="Her bør formål, nåsituasjon og forventet effekt beskrives i hele setninger."
                  sourceHint="Bygges fra vurdering, prosessregister og ROS"
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Formål"
                    value={payload.purpose ?? ""}
                    onChange={(v) => setStr("purpose", v)}
                    rows={4}
                    disabled={!canEdit}
                    description="Hva skal dokumentet og automatiseringen hjelpe virksomheten med?"
                    sourceHint="Forslås fra vurderingen"
                  />
                  <Field
                    label="Mål og forventet nytte"
                    value={payload.objectives ?? ""}
                    onChange={(v) => setStr("objectives", v)}
                    rows={4}
                    disabled={!canEdit}
                    description="Fang opp gevinster, kvalitet, risiko og driftseffekt."
                    sourceHint="Forslås fra vurderingen"
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
                  description="Vises på forsiden og gjør dokumentet enklere å plassere organisatorisk."
                />
                <div className="space-y-4 rounded-2xl border border-border/60 bg-muted/10 p-4 shadow-sm">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">
                      Hvor brukes prosessen?
                    </p>
                    <p className="text-sm leading-6 text-muted-foreground">
                      Skriv kort hvor prosessen brukes i dag og hvis den skal breddes videre.
                      Det som allerede er kjent fra vurdering, prosessregister eller ROS vises under,
                      så du slipper å fylle inn det samme flere steder.
                    </p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {(payload.orgPrimaryUnit ?? "").trim() ? (
                      <ReadOnlyBlock label="Primær enhet">
                        <p>{payload.orgPrimaryUnit}</p>
                      </ReadOnlyBlock>
                    ) : null}
                    {(payload.orgRosCoverage ?? "").trim() ? (
                      <ReadOnlyBlock label="ROS dekker">
                        <p className="whitespace-pre-wrap">{payload.orgRosCoverage}</p>
                      </ReadOnlyBlock>
                    ) : null}
                  </div>
                  <Field
                    label="Bruk og bredding"
                    value={orgCoverageValue}
                    onChange={(v) => {
                      setPayload((p) => ({
                        ...p,
                        orgOperatingUnits: v,
                        orgRolloutNotes: "",
                      }));
                      setDirty(true);
                    }}
                    rows={4}
                    disabled={!canEdit}
                    placeholder="F.eks. Brukes i team Øye i dag. Skal breddes til seksjon A og B etter pilot."
                    description="Beskriv kort hvor prosessen brukes nå, og om den skal rulles ut eller allerede er breddet til flere enheter."
                    sourceHint="Oppdateres i PDD"
                  />
                </div>
                <Field
                  label="Forutsetninger"
                  value={payload.prerequisites ?? ""}
                  onChange={(v) => setStr("prerequisites", v)}
                  rows={4}
                  disabled={!canEdit}
                  placeholder="Hva må være på plass før automatisering kan starte?"
                  description="Tilganger, testdata, godkjenninger og andre avklaringer før oppstart."
                  sourceHint="Kan hentes fra vurdering og prosessregister"
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
                  rows={6}
                  disabled={!canEdit}
                  placeholder="Operasjon, aktivitet og utfall i nåværende prosess"
                  description="Beskriv hvordan prosessen faktisk utføres i dag, steg for steg, før automatisering."
                  sourceHint="Forslås fra vurdering og prosessregister"
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Roller"
                    value={payload.asIsRoles ?? ""}
                    onChange={(v) => setStr("asIsRoles", v)}
                    rows={4}
                    disabled={!canEdit}
                    description="Hvem gjør hva i dag, og hvem berøres av prosessen?"
                    sourceHint="Kan hentes fra vurderingen"
                  />
                  <Field
                    label="Volum og frekvens"
                    value={payload.asIsVolume ?? ""}
                    onChange={(v) => setStr("asIsVolume", v)}
                    rows={4}
                    disabled={!canEdit}
                    description="Hvor ofte kjøres prosessen, og hvor stort volum håndteres?"
                    sourceHint="Kan hentes fra vurderingen"
                  />
                  <Field
                    label="Behandlingstid"
                    value={payload.asIsHandleTime ?? ""}
                    onChange={(v) => setStr("asIsHandleTime", v)}
                    rows={3}
                    disabled={!canEdit}
                    description="Angi typisk tidsbruk per sak eller prosessgjennomføring."
                    sourceHint="Kan hentes fra vurderingen"
                  />
                  <Field
                    label="FTE / ressurs"
                    value={payload.asIsFte ?? ""}
                    onChange={(v) => setStr("asIsFte", v)}
                    rows={3}
                    disabled={!canEdit}
                    description="Beskriv ressursbruk eller årsverk som går med i dagens prosess."
                    sourceHint="Kan hentes fra vurderingen"
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
                  sourceHints={["Fra vurdering", "Kan utdypes manuelt i PDD"]}
                />
                <ApplicationEditor
                  rows={payload.asIsApplications ?? []}
                  disabled={!canEdit}
                  sourceHints={["Fra vurdering", "Fra prosessregister"]}
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
                  sourceHints={["Fra vurdering", "Kan utdypes manuelt i PDD"]}
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
                  sourceHints={["Bygges i PDD", "Støttes av vurdering"]}
                />
                <Field
                  label="To-Be trinn i detalj"
                  value={payload.toBeSteps ?? ""}
                  onChange={(v) => setStr("toBeSteps", v)}
                  rows={10}
                  disabled={!canEdit}
                  description="Beskriv fremtidig flyt tydelig, inkludert robotsteg, avhengigheter og manuelle håndtrykk."
                  sourceHint="Bygges i PDD med støtte fra vurdering"
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="I omfang (RPA)"
                    value={payload.inScope ?? ""}
                    onChange={(v) => setStr("inScope", v)}
                    rows={5}
                    disabled={!canEdit}
                  description="Hva skal roboten eller løsningen faktisk håndtere? Ta også med hvis løsningen skal breddes eller rulles ut til flere team eller enheter."
                    sourceHint="Forslås fra vurderingen"
                  />
                  <Field
                    label="Utenfor omfang"
                    value={payload.outOfScope ?? ""}
                    onChange={(v) => setStr("outOfScope", v)}
                    rows={5}
                    disabled={!canEdit}
                    description="Hva må fortsatt håndteres manuelt eller i andre initiativer?"
                    sourceHint="Forslås fra vurderingen"
                  />
                </div>
                <Field
                  label="Parallelle initiativ / overlapp"
                  value={payload.parallelInitiatives ?? ""}
                  onChange={(v) => setStr("parallelInitiatives", v)}
                  rows={4}
                  disabled={!canEdit}
                  description="Noter andre prosjekter, forbedringer eller systemendringer som påvirker løsningen."
                  sourceHint="Forslås fra vurdering og organisasjonskontekst"
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
                  sourceHints={["Fra vurdering", "Avklares og vedlikeholdes i PDD"]}
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
                  sourceHints={["Fra ROS", "Fra vurdering", "Fra skjema / inntak"]}
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
                  rows={4}
                  disabled={!canEdit}
                  description="Hva skal skje når roboten møter et ukjent forretningsavvik?"
                />
                <ExceptionRowsEditor
                  label="Kjente tekniske feil (PDD-spesifikke)"
                  rows={payload.appErrorsKnown ?? []}
                  disabled={!canEdit}
                  sourceHints={["Fra ROS", "Fra vurdering"]}
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
                  rows={4}
                  disabled={!canEdit}
                  description="Definer standard respons når tekniske feil ikke er forhåndsbeskrevet."
                />
                <Field
                  label="Rapportering og logging"
                  value={payload.reporting ?? ""}
                  onChange={(v) => setStr("reporting", v)}
                  rows={5}
                  disabled={!canEdit}
                  description="Beskriv hva som logges, hvem som varsles, og hvordan avvik følges opp."
                  sourceHint="Forslås som standardoppsett"
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
                  rows={5}
                  disabled={!canEdit}
                  description="Samle supplerende observasjoner, driftsnotater og viktige avklaringer."
                  sourceHint="Kan hentes fra ROS og vurdering"
                />
                <Field
                  label="Tilleggskilder / SOP / video"
                  value={payload.additionalSources ?? ""}
                  onChange={(v) => setStr("additionalSources", v)}
                  rows={5}
                  disabled={!canEdit}
                  description="Lenker, notater, skjemaer og andre kilder som støtter prosessdesignet."
                  sourceHint="Kan hentes fra prosessregister og inntak"
                />
                <Field
                  label="Tidsplan og milepæler"
                  value={payload.targetTimeline ?? ""}
                  onChange={(v) => setStr("targetTimeline", v)}
                  rows={5}
                  disabled={!canEdit}
                  description="Skisser ønsket fremdrift fra design og test til drift."
                />
                <Field
                  label="Vedlegg"
                  value={payload.appendix ?? ""}
                  onChange={(v) => setStr("appendix", v)}
                  rows={4}
                  disabled={!canEdit}
                  description="Noter vedlegg, filnavn eller referanser som hører til dokumentet."
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
              <div className="mb-4 rounded-2xl border border-border/60 bg-muted/15 p-3">
                <p className="text-sm font-medium text-foreground">Slik bruker du versjoner</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Hver rad er et tidligere lagret punkt i PDD-en. Du kan lese kommentar og dato,
                  og gjenopprette en versjon hvis du vil gå tilbake til et tidligere innhold.
                </p>
              </div>
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
                      <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
                        Gjenoppretting erstatter gjeldende utkast med denne versjonen. Dette sletter
                        ikke selve historikkraden.
                      </p>
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

      {/* Forlat PDD med ulagrede endringer */}
      <Dialog
        open={leavePromptOpen}
        onOpenChange={(open) => {
          if (!open) {
            setLeavePromptOpen(false);
            pendingNavHrefRef.current = null;
            setLeaveBusy(false);
          }
        }}
      >
        <DialogContent size="md" titleId="pdd-leave-title" descriptionId="pdd-leave-desc">
          <DialogHeader>
            <p
              id="pdd-leave-title"
              className="font-heading text-lg font-semibold"
            >
              Vil du lagre?
            </p>
            <p
              id="pdd-leave-desc"
              className="text-sm leading-relaxed text-muted-foreground"
            >
              Du har ulagrede endringer i prosessdesignet (inkludert diagram). Lagre før du
              går videre, eller forlat uten å lagre.
            </p>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              disabled={leaveBusy}
              onClick={() => {
                setLeavePromptOpen(false);
                pendingNavHrefRef.current = null;
              }}
            >
              Avbryt
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              disabled={leaveBusy}
              onClick={handleLeaveDiscard}
            >
              Forlat uten å lagre
            </Button>
            {canEdit ? (
              <Button
                type="button"
                className="w-full sm:w-auto"
                disabled={leaveBusy || saving}
                onClick={() => void handleLeaveSave()}
              >
                {leaveBusy || saving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <>
                    <Save className="mr-1.5 size-3.5" aria-hidden />
                    Lagre og fortsett
                  </>
                )}
              </Button>
            ) : null}
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
  sourceHints = [],
}: {
  rows: ProcessDesignAppRow[];
  onChange: (r: ProcessDesignAppRow[]) => void;
  disabled: boolean;
  sourceHints?: string[];
}) {
  const update = (i: number, patch: Partial<ProcessDesignAppRow>) => {
    onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  };
  return (
    <div className="space-y-3">
      <div className="space-y-2">
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
        <SourceHintBadges hints={sourceHints} />
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
  sourceHints = [],
}: {
  label: string;
  rows: ProcessDesignExceptionRow[];
  onChange: (r: ProcessDesignExceptionRow[]) => void;
  disabled: boolean;
  sourceHints?: string[];
}) {
  const update = (i: number, patch: Partial<ProcessDesignExceptionRow>) => {
    onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  };
  return (
    <div className="space-y-3">
      <div className="space-y-2">
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
        <SourceHintBadges hints={sourceHints} />
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
  sourceHints = [],
}: {
  label: string;
  rows: ProcessDesignStepRow[];
  onChange: (r: ProcessDesignStepRow[]) => void;
  disabled: boolean;
  sourceHints?: string[];
}) {
  const update = (i: number, patch: Partial<ProcessDesignStepRow>) => {
    onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  };
  return (
    <div className="space-y-3">
      <div className="space-y-2">
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
        <SourceHintBadges hints={sourceHints} />
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
