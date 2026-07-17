"use client";

import {
  ProductEmptyState,
  ProductLoadingBlock,
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
import { PdfBlobViewer } from "@/components/ui/pdf-blob-viewer-dynamic";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { SearchInput } from "@/components/ui/search-input";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { htmlToPlainText, isEmptyRichText } from "@/lib/rich-text";
import { toast } from "sonner";
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
  PddGettingStartedCard,
  PddTutorialOverlay,
  usePddTutorialDismissed,
} from "@/components/process-design/pdd-onboarding";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  CalendarDays,
  ChevronDown,
  ExternalLink,
  FileDown,
  FileX,
  Eye,
  FileText,
  History,
  Link2,
  Loader2,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  Paperclip,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
  StickyNote,
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
  if (typeof value === "string") return !isEmptyRichText(value);
  if (Array.isArray(value)) return value.length > 0;
  return false;
}

function payloadHasMeaningfulContent(payload: ProcessDesignDocumentPayload): boolean {
  return Object.values(payload).some((value) => hasMeaningfulValue(value));
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

const PDD_SECTION_SHORTCUTS: {
  value: string;
  label: string;
}[] = [
  { value: "overview", label: "Oversikt" },
  { value: "asis", label: "As-Is" },
  { value: "tobe", label: "To-Be" },
  { value: "huki", label: "HUKI" },
  { value: "risk", label: "Risiko" },
  { value: "extra", label: "Tillegg" },
];

/* ------------------------------------------------------------------ */
/*  Primitives                                                         */
/* ------------------------------------------------------------------ */

const PDD_ACCORDION_ITEM_CLASS =
  "overflow-hidden rounded-xl border border-border/45 bg-background px-4 sm:px-5";

function Field({
  label,
  value,
  onChange,
  rows = 3,
  disabled,
  placeholder,
  description,
  plain = false,
  // sourceHint er bevisst ignorert — det er meta-info som la støy på hvert
  // eneste felt. Brukere som vil hente fra kilder bruker «Fyll fra kilder»
  // i toppmenyen, så hint per felt er ikke nødvendig.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
  /** Plain text (Input/Textarea) — for titler og korte én-linjers felt. */
  plain?: boolean;
  sourceHint?: string;
  className?: string;
}) {
  const plainValue = plain ? htmlToPlainText(value) : value;

  return (
    <div className="space-y-1.5">
      <Label className="text-[0.8125rem] font-medium text-foreground">
        {label}
      </Label>
      {description ? (
        <p className="text-xs leading-5 text-muted-foreground">{description}</p>
      ) : null}
      {plain ? (
        rows <= 1 ? (
          <Input
            value={plainValue}
            onValueChange={onChange}
            disabled={disabled}
            placeholder={placeholder}
            aria-label={label}
            className={cn("rounded-xl", className)}
          />
        ) : (
          <Textarea
            value={plainValue}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            placeholder={placeholder}
            aria-label={label}
            rows={rows}
            className={cn("rounded-xl", className)}
          />
        )
      ) : (
        <RichTextEditor
          value={value}
          onChange={onChange}
          rows={rows}
          disabled={disabled}
          placeholder={placeholder}
          aria-label={label}
          className={className}
        />
      )}
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
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="rounded-xl border border-border/40 bg-muted/15 px-3.5 py-3 text-sm">
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
      ? "bg-amber-500/12 text-amber-800 dark:text-amber-200"
      : tone === "success"
        ? "bg-emerald-500/12 text-emerald-800 dark:text-emerald-200"
        : "bg-muted text-muted-foreground";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium tracking-wide",
        toneClass,
      )}
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
    <div className="flex flex-wrap gap-1.5">
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
    <div className="rounded-xl border border-border/45 bg-background">
      <button
        type="button"
        className="flex w-full touch-manipulation items-center gap-2.5 px-4 py-3 text-left sm:px-5"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <Icon className="size-4 shrink-0 text-muted-foreground" />
        <span className="flex-1 text-sm font-medium text-foreground">{title}</span>
        <ChevronDown
          className={cn(
            "size-4 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>
      {open ? (
        <div className="border-t border-border/35 px-4 pb-4 pt-3 sm:px-5">
          {children}
        </div>
      ) : null}
    </div>
  );
}

function SectionTrigger({
  label,
  done,
}: {
  label: string;
  done: boolean;
}) {
  return (
    <AccordionTrigger className="py-3.5 text-sm font-medium no-underline hover:no-underline">
      <span className="flex min-w-0 items-center gap-2.5">
        <span
          className={cn(
            "size-1.5 shrink-0 rounded-full",
            done ? "bg-emerald-500" : "bg-muted-foreground/35",
          )}
          aria-hidden
        />
        <span className="truncate">{label}</span>
        <span className="sr-only">{done ? "Fullført" : "Mangler innhold"}</span>
      </span>
    </AccordionTrigger>
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
  diagramKind,
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
  diagramKind: "asIs" | "toBe";
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
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const clearNowRef = useRef<(() => void) | null>(null);
  const registerClearNow = useCallback((fn: (() => void) | null) => {
    clearNowRef.current = fn;
  }, []);
  const isMobileViewport = useSyncExternalStore(
    subscribeMobileViewport,
    getMobileViewport,
    () => false,
  );
  const diagramDialogOpen = (isMobileViewport && mode === "diagram") || diagramFullscreen;

  const toggleDiagramFullscreen = useCallback(() => {
    setDiagramFullscreen((current) => !current);
  }, []);

  const requestClearDiagram = useCallback(() => {
    if (!canEdit) return;
    setClearConfirmOpen(true);
  }, [canEdit]);

  const confirmClearDiagram = useCallback(() => {
    setClearConfirmOpen(false);
    try {
      // In-place sletting — ingen remount (remount + native confirm krasjet siden)
      clearNowRef.current?.();
      onDiagramJson("");
    } catch (err) {
      console.error("[pdd] Tøm diagram feilet", err);
    }
  }, [onDiagramJson]);

  useEffect(() => {
    if (mode !== "diagram") {
      setDiagramFullscreen(false);
    }
  }, [mode]);

  return (
    <div className="space-y-2">
      <div className="space-y-2">
        <Label className="text-[0.8125rem] font-medium text-foreground">
          {sectionLabel}
        </Label>
        <SourceHintBadges hints={sourceHints} />
      </div>
      <div className="inline-flex w-full rounded-xl bg-muted/30 p-0.5 sm:w-auto">
        <button
          type="button"
          className={cn(
            "flex-1 touch-manipulation rounded-lg px-3 py-1.5 text-sm font-medium transition-colors sm:flex-none",
            mode === "beskrivelse"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
          onClick={() => setMode("beskrivelse")}
        >
          Beskrivelse
        </button>
        <button
          type="button"
          className={cn(
            "flex-1 touch-manipulation rounded-lg px-3 py-1.5 text-sm font-medium transition-colors sm:flex-none",
            mode === "diagram"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
          onClick={() => setMode("diagram")}
        >
          Diagram
        </button>
      </div>
      {mode === "beskrivelse" ? (
        <RichTextEditor
          value={textValue}
          onChange={onTextChange}
          rows={isMobileViewport ? Math.max(textRows, 8) : textRows}
          disabled={!canEdit}
          aria-label={sectionLabel}
          placeholder="Beskriv flyten med tekst. Bruk fet, kursiv, gul markering eller sett inn bilde."
        />
      ) : !isMobileViewport ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <p className="max-w-xl text-xs leading-relaxed text-muted-foreground">
              {diagramHint}
            </p>
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
              {canEdit ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-9 justify-center text-xs text-muted-foreground sm:h-8"
                  onClick={requestClearDiagram}
                >
                  Tøm diagram
                </Button>
              ) : null}
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-10 touch-manipulation justify-center rounded-lg sm:h-9"
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
            {diagramDialogOpen ? (
              <div
                className={cn(
                  "flex h-[clamp(22rem,68svh,34rem)] min-h-[22rem] flex-col items-center justify-center gap-2 rounded-2xl border border-border/60 bg-muted/10 px-4 text-center text-sm text-muted-foreground sm:h-[min(34rem,70vh)] sm:min-h-[24rem]",
                )}
              >
                <p>Diagrammet redigeres i fullskjerm.</p>
                <p className="text-xs">Lukk fullskjerm for å fortsette i rammen under.</p>
              </div>
            ) : (
              <PddTldrawCanvas
                key={`embed-${instanceKey}`}
                snapshotJson={diagramValue}
                onSnapshotChange={onDiagramJson}
                readOnly={!canEdit}
                instanceKey={instanceKey}
                diagramKind={diagramKind}
                onClearNowReady={registerClearNow}
                layoutVariant="embed"
              />
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-border/60 bg-muted/10 p-4 text-sm text-muted-foreground">
          Diagrammet er åpnet i mobilvisning. Bruk knappen under for å lukke og gå tilbake til
          beskrivelse.
        </div>
      )}

      <Dialog open={clearConfirmOpen} onOpenChange={setClearConfirmOpen}>
        <DialogContent size="sm" titleId={`${instanceKey}-clear-diagram-title`}>
          <DialogHeader>
            <p
              id={`${instanceKey}-clear-diagram-title`}
              className="font-heading text-lg font-semibold"
            >
              Tøm diagram?
            </p>
            <p className="text-sm text-muted-foreground">
              Alt innhold i diagrammet slettes. Dette kan ikke angres.
            </p>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-lg"
              onClick={() => setClearConfirmOpen(false)}
            >
              Avbryt
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="rounded-lg"
              onClick={confirmClearDiagram}
            >
              Tøm diagram
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
          fillViewport={isMobileViewport || diagramFullscreen}
          className={
            isMobileViewport || diagramFullscreen
              ? "p-0"
              : "h-[min(92dvh,100svh)] max-h-[100dvh] w-[min(96vw,96rem)] max-w-none p-0"
          }
        >
          <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
            <DialogHeader
              className={cn(
                "shrink-0",
                isMobileViewport || diagramFullscreen
                  ? "space-y-0 border-b px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] sm:px-4 sm:py-3"
                  : "space-y-3",
              )}
            >
              <div
                className={cn(
                  "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between",
                  (isMobileViewport || diagramFullscreen) && "gap-2 sm:items-center",
                )}
              >
                <div
                  className={cn(
                    "space-y-1",
                    (isMobileViewport || diagramFullscreen) && "min-w-0 flex-1",
                  )}
                >
                  <p
                    id={`${instanceKey}-diagram-title`}
                    className={cn(
                      "font-heading font-semibold",
                      isMobileViewport || diagramFullscreen
                        ? "truncate text-base sm:text-lg"
                        : "text-lg",
                    )}
                  >
                    {sectionLabel}
                  </p>
                  {isMobileViewport || diagramFullscreen ? (
                    <p className="text-[11px] leading-snug text-muted-foreground sm:text-xs">
                      Pencil: tegn direkte. Dobbelttrykk med spissen på lerretet
                      bytter blyant/viskelær. To fingre zoomer.
                    </p>
                  ) : (
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      Apple Pencil: tegn direkte (håndflate ignoreres).
                      Dobbelttrykk med Pencil på lerretet bytter blyant/viskelær.
                      To fingre zoomer/panorerer; Pil for faste koblinger.
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
                  {canEdit ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className={cn(
                        "justify-center",
                        isMobileViewport || diagramFullscreen
                          ? "h-9 sm:h-8"
                          : "h-10 sm:h-9",
                      )}
                      onClick={requestClearDiagram}
                    >
                      Tøm diagram
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className={cn(
                      "touch-manipulation justify-center rounded-lg",
                      isMobileViewport || diagramFullscreen
                        ? "h-9 sm:h-8"
                        : "h-10 sm:h-9",
                    )}
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
            <DialogBody
              className={cn(
                "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden",
                isMobileViewport || diagramFullscreen
                  ? "p-0 pb-[env(safe-area-inset-bottom)] sm:p-0"
                  : "p-3 sm:p-4",
              )}
            >
              <PddTldrawCanvas
                key={`fs-${instanceKey}`}
                snapshotJson={diagramValue}
                onSnapshotChange={onDiagramJson}
                readOnly={!canEdit}
                instanceKey={instanceKey}
                diagramKind={diagramKind}
                onClearNowReady={registerClearNow}
                layoutVariant="fullscreen"
                className={cn(
                  "min-h-0 min-w-0 flex-1",
                  isMobileViewport || diagramFullscreen
                    ? "rounded-none border-0 shadow-none"
                    : "rounded-[1.25rem] sm:rounded-[1.5rem]",
                )}
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
    headerBg: "bg-muted/40",
    headerText: "text-foreground",
    badge: "bg-muted text-foreground",
    dot: "bg-foreground/60",
  },
  {
    key: "u" as const,
    letter: "U",
    label: "Utfører",
    full: "Hvem utfører?",
    headerBg: "bg-muted/40",
    headerText: "text-foreground",
    badge: "bg-muted text-foreground",
    dot: "bg-foreground/60",
  },
  {
    key: "k" as const,
    letter: "K",
    label: "Kontrollerer",
    full: "Hvem godkjenner?",
    headerBg: "bg-muted/40",
    headerText: "text-foreground",
    badge: "bg-muted text-foreground",
    dot: "bg-foreground/60",
  },
  {
    key: "i" as const,
    letter: "I",
    label: "Informeres",
    full: "Hvem informeres?",
    headerBg: "bg-muted/40",
    headerText: "text-foreground",
    badge: "bg-muted text-foreground",
    dot: "bg-foreground/60",
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

  const addRow = () =>
    onChange([...rows, { activity: "", h: "", u: "", k: "", i: "" }]);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-[0.8rem] font-medium text-muted-foreground">
          HUKI-matrise
        </Label>
        <SourceHintBadges hints={sourceHints} />
        <p className="text-xs leading-relaxed text-muted-foreground">
          For hver aktivitet: skriv fullt navn til venstre, og roller/personer
          under H, U, K og I.
        </p>
        {/* Full question legend — always visible, never truncated */}
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {HUKI_COLS.map((c) => (
            <li
              key={c.key}
              className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2"
            >
              <p className={`text-xs font-bold ${c.headerText}`}>
                {c.letter} · {c.label}
              </p>
              <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                {c.full}
              </p>
            </li>
          ))}
        </ul>
      </div>

      {rows.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border/60 bg-muted/20 py-10 text-center">
          <p className="max-w-sm text-sm text-muted-foreground">
            Kartlegg hvem som Høres, Utfører, Kontrollerer og Informeres for
            hver aktivitet i prosessen.
          </p>
          <Button
            type="button"
            size="sm"
            disabled={disabled}
            className="gap-1.5 rounded-lg"
            onClick={addRow}
          >
            <Plus className="size-3.5" aria-hidden />
            Legg til aktivitet
          </Button>
        </div>
      )}

      {rows.length > 0 && (
        <>
          {/* Desktop / tablet matrix — activity column gets room to wrap */}
          <div className="hidden overflow-x-auto rounded-xl border border-border/60 md:block">
            <table className="w-full min-w-[44rem] table-fixed text-sm">
              <colgroup>
                <col className="w-[34%]" />
                <col className="w-[15%]" />
                <col className="w-[15%]" />
                <col className="w-[15%]" />
                <col className="w-[15%]" />
                <col className="w-[6%]" />
              </colgroup>
              <thead>
                <tr>
                  <th className="border-b border-border/40 bg-muted/30 px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">
                    Aktivitet
                  </th>
                  {HUKI_COLS.map((c) => (
                    <th
                      key={c.key}
                      className={`border-b border-border/40 px-2 py-2.5 text-center ${c.headerBg}`}
                      title={c.full}
                    >
                      <span
                        className={`block text-xs font-bold ${c.headerText}`}
                      >
                        {c.letter}
                      </span>
                      <span className="mt-0.5 block text-[10px] font-medium leading-tight text-muted-foreground">
                        {c.label}
                      </span>
                    </th>
                  ))}
                  <th className="border-b border-border/40 bg-muted/30" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => (
                  <tr
                    key={idx}
                    className="group/row border-b border-border/20 align-top last:border-b-0 hover:bg-muted/15"
                  >
                    <td className="px-2 py-2">
                      <div className="flex items-start gap-2">
                        <span className="mt-2 flex size-5 shrink-0 items-center justify-center text-[10px] font-bold text-muted-foreground">
                          {idx + 1}.
                        </span>
                        <Textarea
                          value={r.activity}
                          disabled={disabled}
                          placeholder="Navn på aktivitet"
                          rows={2}
                          onChange={(e) =>
                            update(idx, { activity: e.target.value })
                          }
                          className="min-h-[3.25rem] flex-1 resize-y rounded-lg border-border/40 bg-background/60 px-2 py-1.5 text-sm font-medium leading-snug shadow-none"
                        />
                      </div>
                    </td>
                    {HUKI_COLS.map((c) => (
                      <td key={c.key} className="px-1.5 py-2">
                        <Textarea
                          value={(r[c.key] as string) ?? ""}
                          disabled={disabled}
                          placeholder="—"
                          rows={2}
                          aria-label={`${c.letter} ${c.label}: ${c.full}`}
                          onChange={(e) =>
                            update(idx, { [c.key]: e.target.value })
                          }
                          className={cn(
                            "min-h-[3.25rem] w-full resize-y rounded-lg border-border/40 bg-background/60 px-1.5 py-1.5 text-center text-xs leading-snug shadow-none",
                            (r[c.key] as string)?.trim()
                              ? "font-medium text-foreground"
                              : "text-muted-foreground",
                          )}
                        />
                      </td>
                    ))}
                    <td className="px-1 py-2 text-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        disabled={disabled}
                        className="mt-1 text-muted-foreground opacity-70 transition-opacity hover:text-destructive group-hover/row:opacity-100"
                        onClick={() =>
                          onChange(rows.filter((_, j) => j !== idx))
                        }
                        aria-label={`Fjern aktivitet ${idx + 1}`}
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Phone / narrow: stacked cards with full labels */}
          <ul className="space-y-3 md:hidden">
            {rows.map((r, idx) => (
              <li
                key={idx}
                className="rounded-xl border border-border/60 bg-muted/10"
              >
                <div className="flex items-start gap-2 border-b border-border/40 px-3 py-3">
                  <span className="mt-1.5 text-xs font-bold text-muted-foreground">
                    {idx + 1}.
                  </span>
                  <Textarea
                    value={r.activity}
                    disabled={disabled}
                    placeholder="Navn på aktivitet"
                    rows={2}
                    onChange={(e) =>
                      update(idx, { activity: e.target.value })
                    }
                    className="min-h-[3rem] flex-1 resize-y rounded-lg border-border/40 bg-background/70 px-2.5 py-2 text-sm font-semibold leading-snug"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    disabled={disabled}
                    className="mt-1 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() =>
                      onChange(rows.filter((_, j) => j !== idx))
                    }
                    aria-label={`Fjern aktivitet ${idx + 1}`}
                  >
                    <Trash2 className="size-3" />
                  </Button>
                </div>
                <div className="divide-y divide-border/25">
                  {HUKI_COLS.map((c) => (
                    <div key={c.key} className="space-y-1.5 px-3 py-2.5">
                      <div className="flex items-baseline gap-2">
                        <span
                          className={`inline-flex size-6 shrink-0 items-center justify-center rounded-md text-xs font-bold ${c.badge}`}
                        >
                          {c.letter}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-foreground">
                            {c.label}
                          </p>
                          <p className="text-[11px] leading-snug text-muted-foreground">
                            {c.full}
                          </p>
                        </div>
                      </div>
                      <Input
                        value={(r[c.key] as string) ?? ""}
                        disabled={disabled}
                        placeholder="Person eller rolle"
                        onChange={(e) =>
                          update(idx, { [c.key]: e.target.value })
                        }
                        className="h-9 rounded-lg text-sm"
                      />
                    </div>
                  ))}
                </div>
              </li>
            ))}
          </ul>

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            className="w-full gap-1.5 rounded-lg"
            onClick={addRow}
          >
            <Plus className="size-3.5" aria-hidden />
            Legg til aktivitet
          </Button>

          {/* Compact overview — wraps, no truncation */}
          {rows.some(
            (r) =>
              r.activity.trim() ||
              r.h?.trim() ||
              r.u?.trim() ||
              r.k?.trim() ||
              r.i?.trim(),
          ) ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">
                Matriseoversikt
              </p>
              <div className="overflow-x-auto rounded-xl border border-border/40 bg-muted/10">
                <table className="w-full min-w-[28rem] text-xs">
                  <thead>
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-muted-foreground">
                        #
                      </th>
                      <th className="px-3 py-2 text-left font-semibold text-foreground">
                        Aktivitet
                      </th>
                      {HUKI_COLS.map((c) => (
                        <th
                          key={c.key}
                          className={`px-2 py-2 text-center font-bold ${c.headerText}`}
                          title={c.full}
                        >
                          {c.letter}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, idx) => (
                      <tr key={idx} className="border-t border-border/20 align-top">
                        <td className="px-3 py-2 font-medium text-muted-foreground">
                          {idx + 1}
                        </td>
                        <td className="max-w-[16rem] whitespace-normal break-words px-3 py-2 font-medium leading-snug text-foreground">
                          {r.activity.trim() || (
                            <span className="text-muted-foreground/50">–</span>
                          )}
                        </td>
                        {HUKI_COLS.map((c) => {
                          const val = (r[c.key] as string)?.trim();
                          return (
                            <td key={c.key} className="px-2 py-2 text-center">
                              {val ? (
                                <span
                                  className={`inline-block max-w-[9rem] whitespace-normal break-words rounded-md px-1.5 py-0.5 text-[10px] font-semibold leading-snug ${c.badge}`}
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
          ) : null}
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
  onHistory,
  onPreviewPdf,
  onExportPdf,
  canAutofill,
  canEdit,
  pdfPreviewing,
  pdfExporting,
}: {
  onAutofill: () => void;
  onSnapshot: () => void;
  onHistory: () => void;
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
        size="icon"
        variant="outline"
        className="size-9 touch-manipulation rounded-lg"
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
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted"
            onClick={() => {
              onHistory();
              setOpen(false);
            }}
          >
            <History className="size-4 shrink-0 text-muted-foreground" />
            Versjonshistorikk
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
            <Save className="size-4 shrink-0 text-muted-foreground" />
            Lagre som versjon
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
  const [sectionQuery, setSectionQuery] = useState("");
  const [sectionFilter, setSectionFilter] = useState<
    "all" | "incomplete" | "complete"
  >("all");
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const { dismissed: tutorialDismissed, dismissPermanent, resetDismiss } =
    usePddTutorialDismissed();
  const tutorialAutoShownRef = useRef(false);
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

  const lastSyncedKeyRef = useRef<string | null>(null);

  const syncFromServer = useCallback(() => {
    if (!docState?.document) return;
    const doc = docState.document;
    const serverRev = doc.revision ?? 0;
    const syncKey = `${doc._id}:${serverRev}:${doc.updatedAt}`;
    lastSyncedKeyRef.current = syncKey;
    setPayload(
      (doc.payload as ProcessDesignDocumentPayload) ??
        emptyProcessDesignPayload(),
    );
    setOrganizationLine(doc.organizationLine ?? "");
    setRevision(serverRev);
    setDirty(false);
  }, [docState?.document]);

  useEffect(() => {
    if (docState && docState.document === null) {
      lastSyncedKeyRef.current = null;
      setPayload(emptyProcessDesignPayload());
      setOrganizationLine("");
      setRevision(0);
      setDirty(false);
      return;
    }
    const doc = docState?.document;
    if (!doc) return;

    const serverRev = doc.revision ?? 0;
    const syncKey = `${doc._id}:${serverRev}:${doc.updatedAt}`;

    // Query re-emitter ofte ny objektreferanse (f.eks. auth refresh) uten
    // ekte endring — ikke overskriv lokale redigeringer.
    if (lastSyncedKeyRef.current === syncKey) return;
    if (dirtyRef.current || saveInFlightRef.current) return;

    syncFromServer();
  }, [docState, syncFromServer]);

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

      // Normaliser korte plain-felt (rydder opp gammel TipTap-HTML)
      const titlePlain = htmlToPlainText(
        payloadRef.current.processTitle,
      ).trim();
      const shortPlain = htmlToPlainText(
        payloadRef.current.shortDescription,
      ).trim();
      const payloadToSave: ProcessDesignDocumentPayload = {
        ...payloadRef.current,
        processTitle: titlePlain || undefined,
        shortDescription: shortPlain || undefined,
      };
      if (
        payloadToSave.processTitle !== payloadRef.current.processTitle ||
        payloadToSave.shortDescription !==
          payloadRef.current.shortDescription
      ) {
        payloadRef.current = payloadToSave;
        setPayload(payloadToSave);
      }

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
          // Tillat syncFromServer å hente sanitert payload fra server
          lastSyncedKeyRef.current = null;
          const latestSignature = JSON.stringify({
            organizationLine: organizationLineRef.current.trim() || null,
            payload: payloadRef.current,
          });
          const stillDirty = latestSignature !== signature;
          dirtyRef.current = stillDirty;
          setDirty(stillDirty);
          if (stillDirty) {
            saveQueuedRef.current = true;
          } else if (!options?.silent) {
            toast.success("Lagret");
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
      } catch (err) {
        ok = false;
        const message =
          err instanceof Error ? err.message : "Kunne ikke lagre";
        if (!options?.silent) {
          toast.error(message);
        }
        console.error("[pdd] Lagring feilet", err);
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
  const sectionCompletion = useMemo(() => {
    return {
      overview: Boolean(
        htmlToPlainText(payload.processTitle).trim() ||
          !isEmptyRichText(payload.shortDescription) ||
          !isEmptyRichText(payload.executiveSummary),
      ),
      asis: Boolean(
        !isEmptyRichText(payload.asIsShortDescription) ||
          (payload.asIsApplications?.length ?? 0) > 0,
      ),
      tobe: Boolean(
        !isEmptyRichText(payload.toBeSteps) ||
          !isEmptyRichText(payload.toBeMap),
      ),
      huki: Boolean((payload.hukiRows?.length ?? 0) > 0),
      risk: Boolean(
        (payload.businessExceptionsKnown?.length ?? 0) > 0 ||
          !isEmptyRichText(payload.businessExceptionsUnknown) ||
          (payload.appErrorsKnown?.length ?? 0) > 0 ||
          !isEmptyRichText(payload.appErrorsUnknown),
      ),
      extra: Boolean(
        !isEmptyRichText(payload.otherObservations) ||
          !isEmptyRichText(payload.additionalSources) ||
          !isEmptyRichText(payload.targetTimeline) ||
          !isEmptyRichText(payload.appendix),
      ),
    };
  }, [payload]);
  const completedSectionCount = Object.values(sectionCompletion).filter(Boolean).length;
  const nextIncompleteSection = useMemo(() => {
    return (
      PDD_SECTION_SHORTCUTS.find(
        (section) =>
          !sectionCompletion[section.value as keyof typeof sectionCompletion],
      ) ?? null
    );
  }, [sectionCompletion]);

  useEffect(() => {
    if (
      !hasDoc ||
      tutorialDismissed ||
      tutorialAutoShownRef.current ||
      completedSectionCount >= 2
    ) {
      return;
    }
    tutorialAutoShownRef.current = true;
    const id = window.setTimeout(() => setTutorialOpen(true), 700);
    return () => window.clearTimeout(id);
  }, [hasDoc, tutorialDismissed, completedSectionCount]);

  const goToSection = useCallback((value: string) => {
    setOpenSections((prev) =>
      prev.includes(value) ? prev : [...prev, value],
    );
    window.setTimeout(() => {
      document
        .getElementById(`pdd-section-${value}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }, []);

  const sectionVisible = useMemo(() => {
    const q = sectionQuery.trim().toLowerCase();
    const rosText = (rosCtx ?? [])
      .map((r) => `${r.title} ${(r.rosSummary.summaryLines ?? []).join(" ")}`)
      .join(" ")
      .toLowerCase();
    const matches = {
      overview:
        q.length === 0 ||
        [
          "oversikt",
          "prosesstittel",
          payload.processTitle,
          payload.shortDescription,
          payload.executiveSummary,
        ]
          .join(" ")
          .toLowerCase()
          .includes(q),
      asis:
        q.length === 0 ||
        [
          "asis nåværende prosess",
          payload.asIsProcessName,
          payload.asIsShortDescription,
          payload.asIsProcessMap,
        ]
          .join(" ")
          .toLowerCase()
          .includes(q),
      tobe:
        q.length === 0 ||
        [
          "tobe fremtidig prosess",
          payload.toBeSteps,
          payload.parallelInitiatives,
          payload.toBeMap,
        ]
          .join(" ")
          .toLowerCase()
          .includes(q),
      huki:
        q.length === 0 ||
        [
          "huki roller ansvar",
          JSON.stringify(payload.hukiRows ?? []),
        ]
          .join(" ")
          .toLowerCase()
          .includes(q),
      risk:
        q.length === 0 ||
        [
          "risiko feilhåndtering ros",
          payload.businessExceptionsUnknown,
          payload.appErrorsUnknown,
          payload.reporting,
          rosText,
        ]
          .join(" ")
          .toLowerCase()
          .includes(q),
      extra:
        q.length === 0 ||
        [
          "tilleggsinformasjon observasjoner kilder tidsplan vedlegg",
          payload.otherObservations,
          payload.additionalSources,
          payload.targetTimeline,
          payload.appendix,
        ]
          .join(" ")
          .toLowerCase()
          .includes(q),
    } as const;

    const modeVisible = (key: keyof typeof sectionCompletion) => {
      if (sectionFilter === "incomplete") return !sectionCompletion[key];
      if (sectionFilter === "complete") return sectionCompletion[key];
      return true;
    };

    return {
      overview: matches.overview && modeVisible("overview"),
      asis: matches.asis && modeVisible("asis"),
      tobe: matches.tobe && modeVisible("tobe"),
      huki: matches.huki && modeVisible("huki"),
      risk: matches.risk && modeVisible("risk"),
      extra: matches.extra && modeVisible("extra"),
    };
  }, [sectionQuery, sectionFilter, sectionCompletion, payload, rosCtx]);

  const exportPdf = async () => {
    setPdfExporting(true);
    try {
      // La debounce flush diagram til live-cache før eksporter
      await new Promise((r) => setTimeout(r, 120));
      await downloadProcessDesignPdf({
        assessmentTitle,
        workspaceName: workspace?.name ?? null,
        organizationLine: organizationLine.trim() || undefined,
        payload: payloadRef.current,
        generatedAt: new Date(),
        publishedVersion: latestPublishedVersion,
        diagramCacheKey: diagramInstanceKey,
      });
    } finally {
      setPdfExporting(false);
    }
  };

  const previewPdf = async () => {
    setPdfPreviewing(true);
    try {
      await new Promise((r) => setTimeout(r, 120));
      const url = await buildProcessDesignPdfPreviewUrl({
        assessmentTitle,
        workspaceName: workspace?.name ?? null,
        organizationLine: organizationLine.trim() || undefined,
        payload: payloadRef.current,
        generatedAt: new Date(),
        publishedVersion: latestPublishedVersion,
        diagramCacheKey: diagramInstanceKey,
      });
      setPdfPreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return url;
      });
      setPdfPreviewOpen(true);
    } catch (err) {
      console.error("[pdd] PDF-forhåndsvisning feilet", err);
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
  const orgCoverageValue =
    payload.orgOperatingUnits?.trim() || payload.orgRolloutNotes?.trim() || "";

  const documentTitle =
    htmlToPlainText(payload.processTitle).trim() ||
    htmlToPlainText(assessmentTitle).trim() ||
    "Uten tittel";

  return (
    <div className="mx-auto max-w-3xl space-y-7 px-4 pb-28 sm:space-y-9 sm:px-6 lg:px-0 lg:pb-16">
      <Link
        href={`/w/${wid}/prosessdesign`}
        className="inline-flex touch-manipulation items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        Oversikt
      </Link>

      <header className="space-y-3">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Prosessdesign
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 space-y-2">
            <h1 className="font-heading text-[1.65rem] font-semibold leading-tight tracking-tight text-foreground sm:text-[1.85rem]">
              {hasDoc ? documentTitle : "Nytt dokument"}
            </h1>
            <p className="max-w-lg text-sm leading-6 text-muted-foreground">
              Én seksjon om gangen. Bruk menyen for å fylle fra vurdering, register
              og ROS.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <StatusBadge tone={dirty ? "warning" : "success"}>
              {dirty ? "Ulagret" : "Lagret"}
            </StatusBadge>
            {draftRegistryOnly && !explicitRegistry ? (
              <StatusBadge tone="warning">Ikke koblet</StatusBadge>
            ) : explicitRegistry ? (
              <StatusBadge tone="success">Koblet</StatusBadge>
            ) : null}
          </div>
        </div>
        {hasDoc ? (
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border/40 pt-3 text-[13px] text-muted-foreground">
            <span>
              <span className="font-medium tabular-nums text-foreground">
                {completedSectionCount}/{PDD_SECTION_SHORTCUTS.length}
              </span>{" "}
              seksjoner
            </span>
            <span aria-hidden className="text-border">
              ·
            </span>
            <span>
              <span className="font-medium tabular-nums text-foreground">
                {rosAnalyses.length}
              </span>{" "}
              ROS
            </span>
            <span aria-hidden className="text-border">
              ·
            </span>
            <span>
              Prosess{" "}
              <span className="font-medium text-foreground">
                {explicitRegistry
                  ? "verifisert"
                  : draftRegistryOnly
                    ? "utkast"
                    : "mangler"}
              </span>
            </span>
          </p>
        ) : null}
      </header>

      {!hasDoc ? (
        <div className="space-y-4">
          <ProductEmptyState
            icon={FileText}
            title="Ingen prosessdesign ennå"
            description="Opprett dokumentet, fyll fra kilder, og beskriv prosessen seksjon for seksjon."
            action={
              canEdit ? (
                <Button
                  type="button"
                  size="lg"
                  className="rounded-lg"
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
          <div className="rounded-xl border border-border/50 bg-muted/15 px-4 py-4 text-sm leading-6 text-muted-foreground">
            <p className="font-medium text-foreground">Etter opprettelse</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>Fyll fra kilder for å få forslag inn i tomme felt</li>
              <li>Skriv prosesstittel og kort beskrivelse</li>
              <li>Beskriv As-Is og To-Be — tekst eller diagram</li>
            </ol>
          </div>
        </div>
      ) : (
        <>
          <PddGettingStartedCard
            completedCount={completedSectionCount}
            totalCount={PDD_SECTION_SHORTCUTS.length}
            nextSectionLabel={nextIncompleteSection?.label ?? null}
            onGoToNext={() => {
              if (nextIncompleteSection) {
                goToSection(nextIncompleteSection.value);
              }
            }}
            onAutofill={applyAutofill}
            onOpenTutorial={() => {
              resetDismiss();
              setTutorialOpen(true);
            }}
            canAutofill={!!draftBundle?.draft && canEdit}
            canEdit={canEdit}
          />

          <div
            data-tutorial-anchor="pdd-toolbar"
            className="sticky top-2 z-20 space-y-3 rounded-xl border border-border/45 bg-background/95 px-3 py-3 backdrop-blur-xl sm:px-3.5"
          >
            <div className="flex flex-wrap items-center gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {documentTitle}
                </p>
                <p
                  className={cn(
                    "mt-0.5 text-xs",
                    dirty
                      ? "text-amber-700 dark:text-amber-300"
                      : "text-muted-foreground",
                  )}
                >
                  {dirty ? "Ulagrede endringer" : "Alt lagret"}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 gap-1.5 rounded-lg"
                onClick={() => {
                  resetDismiss();
                  setTutorialOpen(true);
                }}
              >
                <BookOpen className="size-3.5" aria-hidden />
                <span className="hidden sm:inline">Veiledning</span>
              </Button>
              {canEdit ? (
                <Button
                  type="button"
                  size="sm"
                  className="h-9 gap-1.5 rounded-lg"
                  onClick={handleSave}
                  disabled={saving || !dirty}
                >
                  {saving ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Save className="size-3.5" />
                  )}
                  Lagre
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="hidden h-9 gap-1.5 rounded-lg sm:inline-flex"
                onClick={() => void previewPdf()}
                disabled={pdfPreviewing}
              >
                {pdfPreviewing ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                ) : (
                  <Eye className="size-3.5" aria-hidden />
                )}
                PDF
              </Button>
              <SecondaryActionsMenu
                onAutofill={applyAutofill}
                onSnapshot={() => setSnapshotOpen(true)}
                onHistory={() => setHistoryOpen(true)}
                onPreviewPdf={() => void previewPdf()}
                onExportPdf={() => void exportPdf()}
                canAutofill={!!draftBundle?.draft && canEdit}
                canEdit={canEdit}
                pdfPreviewing={pdfPreviewing}
                pdfExporting={pdfExporting}
              />
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <SearchInput
                value={sectionQuery}
                onChange={(e) => setSectionQuery(e.target.value)}
                placeholder="Søk i seksjoner…"
                aria-label="Søk i dokumentseksjoner"
                className="min-w-0 flex-1"
                inputClassName="h-10 min-h-10 rounded-lg border-border/40 bg-muted/25 shadow-none ring-0 placeholder:text-muted-foreground/70 focus-visible:border-foreground/15 focus-visible:bg-background focus-visible:ring-1 focus-visible:ring-foreground/10 md:h-9 md:min-h-9 md:rounded-lg md:pl-11"
              />
              <div className="inline-flex shrink-0 self-start rounded-lg bg-muted/35 p-0.5">
                {(
                  [
                    ["all", "Alle"],
                    ["incomplete", "Mangler"],
                    ["complete", "Ferdige"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setSectionFilter(value)}
                    className={cn(
                      "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                      sectionFilter === value
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <nav
              data-tutorial-anchor="pdd-sections"
              aria-label="Dokumentseksjoner"
              className="-mx-0.5 flex gap-1 overflow-x-auto px-0.5 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {PDD_SECTION_SHORTCUTS.filter(
                (section) =>
                  sectionVisible[section.value as keyof typeof sectionVisible],
              ).map((section) => {
                const active = openSections.includes(section.value);
                const done =
                  sectionCompletion[
                    section.value as keyof typeof sectionCompletion
                  ];
                return (
                  <button
                    key={section.value}
                    type="button"
                    onClick={() => goToSection(section.value)}
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                      active
                        ? "bg-foreground text-background"
                        : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                    )}
                  >
                    <span
                      className={cn(
                        "size-1.5 rounded-full",
                        done
                          ? active
                            ? "bg-background/85"
                            : "bg-emerald-500"
                          : active
                            ? "bg-background/35"
                            : "bg-muted-foreground/35",
                      )}
                      aria-hidden
                    />
                    {section.label}
                  </button>
                );
              })}
            </nav>
            {PDD_SECTION_SHORTCUTS.every(
              (section) =>
                !sectionVisible[section.value as keyof typeof sectionVisible],
            ) ? (
              <p className="text-xs text-muted-foreground">
                Ingen seksjoner matcher søk eller filter.
              </p>
            ) : null}
          </div>

          <CollapsibleSection title="Koblinger" icon={Link2}>
            <div className="space-y-2.5">
              <div className="grid gap-2 sm:grid-cols-2">
                <LinkRow
                  label="PVV-vurdering"
                  href={`/w/${wid}/a/${assessmentId}`}
                  text={assessmentTitle}
                />
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
                  emptyText="Ingen prosess funnet — velg prosess på vurderingen"
                />
                <div className="rounded-xl bg-muted/20 px-3 py-2.5">
                  <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
                    ROS-analyser
                  </span>
                  {rosAnalyses.length > 0 ? (
                    <ul className="mt-1 space-y-1">
                      {rosAnalyses.map((r) => (
                        <li key={r.linkId}>
                          <Link
                            href={`/w/${wid}/ros/a/${r.rosAnalysisId}`}
                            className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground underline-offset-4 hover:text-primary hover:underline"
                          >
                            {r.title}
                            <ExternalLink
                              className="size-3.5 opacity-50"
                              aria-hidden
                            />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-sm text-muted-foreground">
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
              {draftRegistryOnly && !explicitRegistry ? (
                <div className="flex gap-2.5 rounded-xl border border-amber-500/25 bg-amber-500/[0.08] px-3 py-2.5 text-xs leading-5 text-amber-900 dark:text-amber-100/90">
                  <AlertTriangle
                    className="mt-0.5 size-3.5 shrink-0"
                    aria-hidden
                  />
                  <p>
                    Prosessen er valgt i utkastet, men ikke eksplisitt koblet.
                    Koble vurderingen under Prosessregister for å ta med
                    registerfelter i «Fyll inn manglende felt».
                  </p>
                </div>
              ) : null}
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="Anbefalt mapping fra kilder" icon={Sparkles}>
            <div className="grid gap-2 sm:grid-cols-2">
              {PDD_SOURCE_MAPPING_GROUPS.map((group) => (
                <div
                  key={group.title}
                  className="rounded-xl bg-muted/20 px-3.5 py-3"
                >
                  <p className="text-sm font-medium text-foreground">
                    {group.title}
                  </p>
                  <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
                    Felter
                  </p>
                  <p className="mt-0.5 text-sm leading-6 text-muted-foreground">
                    {group.fields}
                  </p>
                  <p className="mt-2.5 text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
                    Hentes fra
                  </p>
                  <p className="mt-0.5 text-sm leading-6 text-muted-foreground">
                    {group.sources}
                  </p>
                </div>
              ))}
            </div>
          </CollapsibleSection>

          <Accordion
            multiple
            value={openSections}
            onValueChange={(value) => setOpenSections([...value])}
            className="space-y-2.5"
          >
            {sectionVisible.overview ? (
            <AccordionItem
              id="pdd-section-overview"
              data-tutorial-anchor="pdd-section-overview"
              value="overview"
              className={PDD_ACCORDION_ITEM_CLASS}
            >
              <SectionTrigger
                label="Prosessoversikt"
                done={sectionCompletion.overview}
              />
              <AccordionContent className="space-y-5 border-t border-border/35 pt-4">
                <Field
                  label="Prosesstittel"
                  value={payload.processTitle ?? ""}
                  onChange={(v) => setStr("processTitle", v)}
                  rows={1}
                  plain
                  disabled={!canEdit}
                  placeholder={
                    payload.asIsProcessName?.trim() ||
                    "Navnet på prosessen som skal automatiseres"
                  }
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
                  plain
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
                  plain
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
            ) : null}

            {/* ---- 2. As-Is ---- */}
            {sectionVisible.asis ? (
            <AccordionItem
              id="pdd-section-asis"
              data-tutorial-anchor="pdd-section-asis"
              value="asis"
              className={PDD_ACCORDION_ITEM_CLASS}
            >
              <SectionTrigger
                label="As-Is — nåværende prosess"
                done={sectionCompletion.asis}
              />
              <AccordionContent className="space-y-5 border-t border-border/35 pt-4">
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
                  diagramHint="Tegn fritt med Blyant (Apple Pencil med trykk). Dobbelttrykk med Pencil på lerretet bytter blyant/viskelær. Fullskjerm anbefales på iPad — fungerer i portrett og landskap."
                  textRows={4}
                  textValue={payload.asIsProcessMap ?? ""}
                  onTextChange={(v) => setStr("asIsProcessMap", v)}
                  diagramValue={payload.asIsDiagramSnapshot}
                  onDiagramJson={(json) =>
                    setStr("asIsDiagramSnapshot", json)
                  }
                  canEdit={canEdit}
                  instanceKey={diagramInstanceKey}
                  diagramKind="asIs"
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
            ) : null}

            {/* ---- 3. To-Be ---- */}
            {sectionVisible.tobe ? (
            <AccordionItem
              id="pdd-section-tobe"
              value="tobe"
              className={PDD_ACCORDION_ITEM_CLASS}
            >
              <SectionTrigger
                label="To-Be — fremtidig prosess"
                done={sectionCompletion.tobe}
              />
              <AccordionContent className="space-y-5 border-t border-border/35 pt-4">
                <ProcessTextDiagramBlock
                  sectionLabel="To-Be prosesskart"
                  diagramHint="Tegn fremtidig flyt freehand med Blyant (Apple Pencil), eller bygg med bokser + Pil. Dobbelttrykk med Pencil på lerretet bytter blyant/viskelær."
                  textRows={4}
                  textValue={payload.toBeMap ?? ""}
                  onTextChange={(v) => setStr("toBeMap", v)}
                  diagramValue={payload.toBeDiagramSnapshot}
                  onDiagramJson={(json) =>
                    setStr("toBeDiagramSnapshot", json)
                  }
                  canEdit={canEdit}
                  instanceKey={diagramInstanceKey}
                  diagramKind="toBe"
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
            ) : null}

            {/* ---- 4. HUKI ---- */}
            {sectionVisible.huki ? (
            <AccordionItem
              id="pdd-section-huki"
              value="huki"
              className={PDD_ACCORDION_ITEM_CLASS}
            >
              <SectionTrigger
                label="HUKI — roller og ansvar"
                done={sectionCompletion.huki}
              />
              <AccordionContent className="border-t border-border/35 pt-4">
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
            ) : null}

            {/* ---- 5. Risiko og feilhåndtering ---- */}
            {sectionVisible.risk ? (
            <AccordionItem
              id="pdd-section-risk"
              value="risk"
              className={PDD_ACCORDION_ITEM_CLASS}
            >
              <SectionTrigger
                label="Risiko og feilhåndtering"
                done={sectionCompletion.risk}
              />
              <AccordionContent className="space-y-5 border-t border-border/35 pt-4">
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
            ) : null}

            {/* ---- 6. Tillegg ---- */}
            {sectionVisible.extra ? (
            <AccordionItem
              id="pdd-section-extra"
              value="extra"
              className={PDD_ACCORDION_ITEM_CLASS}
            >
              <SectionTrigger
                label="Tilleggsinformasjon"
                done={sectionCompletion.extra}
              />
              <AccordionContent className="space-y-4 border-t border-border/35 pt-4">
                <div className="rounded-xl border border-border/45 bg-muted/15 px-4 py-3">
                  <p className="text-sm font-medium text-foreground">
                    Tillegg til dokumentasjonen
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Bruk feltene under til det som ikke naturlig hører hjemme i
                    Oversikt, As-Is, To-Be eller Risiko. Du kan formatere tekst
                    (fet, kursiv, understrek, gul markering) og sette inn bilder
                    direkte i notatene.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="rounded-xl border border-border/50 bg-background p-3.5 sm:p-4">
                    <div className="mb-3 flex items-start gap-2.5">
                      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                        <StickyNote className="size-4" aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium">Andre observasjoner</p>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                          Driftsnotater, avklaringer og funn som bør følge
                          dokumentet.
                        </p>
                      </div>
                    </div>
                    <RichTextEditor
                      value={payload.otherObservations ?? ""}
                      onChange={(v) => setStr("otherObservations", v)}
                      rows={5}
                      disabled={!canEdit}
                      aria-label="Andre observasjoner"
                      placeholder="Skriv observasjoner, beslutninger eller åpne spørsmål…"
                    />
                  </div>

                  <div className="rounded-xl border border-border/50 bg-background p-3.5 sm:p-4">
                    <div className="mb-3 flex items-start gap-2.5">
                      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                        <BookOpen className="size-4" aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium">
                          Tilleggskilder / SOP / video
                        </p>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                          Lenker, skjemaer, videoer og andre kilder som støtter
                          designet.
                        </p>
                      </div>
                    </div>
                    <RichTextEditor
                      value={payload.additionalSources ?? ""}
                      onChange={(v) => setStr("additionalSources", v)}
                      rows={5}
                      disabled={!canEdit}
                      aria-label="Tilleggskilder"
                      placeholder="Lim inn lenker, eller beskriv hvor SOP/video finnes…"
                    />
                  </div>

                  <div className="rounded-xl border border-border/50 bg-background p-3.5 sm:p-4">
                    <div className="mb-3 flex items-start gap-2.5">
                      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                        <CalendarDays className="size-4" aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium">
                          Tidsplan og milepæler
                        </p>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                          Skisser fremdrift fra design og test til drift.
                        </p>
                      </div>
                    </div>
                    <RichTextEditor
                      value={payload.targetTimeline ?? ""}
                      onChange={(v) => setStr("targetTimeline", v)}
                      rows={5}
                      disabled={!canEdit}
                      aria-label="Tidsplan og milepæler"
                      placeholder="F.eks. design ferdig · pilot · produksjon…"
                    />
                  </div>

                  <div className="rounded-xl border border-border/50 bg-background p-3.5 sm:p-4">
                    <div className="mb-3 flex items-start gap-2.5">
                      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                        <Paperclip className="size-4" aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium">Vedlegg</p>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                          Filnavn, referanser eller små skjermbilder som hører
                          til dokumentet.
                        </p>
                      </div>
                    </div>
                    <RichTextEditor
                      value={payload.appendix ?? ""}
                      onChange={(v) => setStr("appendix", v)}
                      rows={4}
                      disabled={!canEdit}
                      aria-label="Vedlegg"
                      placeholder="List vedlegg, eller sett inn bilde her…"
                    />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
            ) : null}
          </Accordion>

          {canEdit ? (
            <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border/40 bg-background/95 px-4 py-3 backdrop-blur-xl sm:hidden [padding-bottom:calc(0.75rem+env(safe-area-inset-bottom))]">
              <Button
                type="button"
                size="lg"
                className="h-12 w-full gap-2 rounded-2xl"
                onClick={handleSave}
                disabled={saving || !dirty}
              >
                {saving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                {dirty ? "Lagre endringer" : "Alt er lagret"}
              </Button>
            </div>
          ) : null}
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
          size="4xl"
          titleId="pdd-pdf-preview-title"
          className="max-h-[min(96dvh,60rem)]"
        >
          <DialogHeader>
            <p
              id="pdd-pdf-preview-title"
              className="font-heading text-lg font-semibold"
            >
              Forhåndsvis PDF
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Alle sider vises under — scroll på mobil/iPad. Slik ser eksporten
              ut basert på gjeldende innhold.
            </p>
          </DialogHeader>
          <DialogBody className="flex min-h-0 flex-1 flex-col overflow-hidden p-0 sm:p-0">
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden sm:mx-6 sm:mb-2 sm:mt-4 sm:rounded-xl sm:border sm:border-border/60">
              {pdfPreviewUrl ? (
                <PdfBlobViewer
                  url={pdfPreviewUrl}
                  title="PDD PDF-forhåndsvisning"
                  className="h-[min(68dvh,44rem)] min-h-[18rem] sm:h-[min(70dvh,46rem)]"
                />
              ) : (
                <div className="flex h-[min(68dvh,44rem)] items-center justify-center text-sm text-muted-foreground">
                  Ingen forhåndsvisning tilgjengelig.
                </div>
              )}
            </div>
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-lg"
              onClick={() => setPdfPreviewOpen(false)}
            >
              Lukk
            </Button>
            <Button
              type="button"
              className="rounded-lg"
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
        <DialogContent
          size="sm"
          className="max-h-[min(90dvh,42rem)] overflow-y-auto sm:max-w-md"
          titleId="pdd-leave-title"
          descriptionId="pdd-leave-desc"
        >
          <DialogHeader className="border-border/40 space-y-0 border-b px-4 py-4 sm:px-6 sm:py-5">
            <div className="flex gap-3.5 sm:gap-4">
              <div
                className="bg-primary/12 text-primary flex size-11 shrink-0 items-center justify-center rounded-2xl sm:size-12"
                aria-hidden
              >
                <Save className="size-5 sm:size-[1.35rem]" strokeWidth={2} />
              </div>
              <div className="min-w-0 flex-1 space-y-2 pt-0.5">
                <p
                  id="pdd-leave-title"
                  className="font-heading text-base font-semibold leading-snug tracking-tight sm:text-lg"
                >
                  Vil du lagre?
                </p>
                <p
                  id="pdd-leave-desc"
                  className="text-muted-foreground text-sm leading-relaxed"
                >
                  Du har ulagrede endringer i prosessdesignet (inkludert diagram). Lagre før du
                  går videre, eller forlat uten å lagre.
                </p>
              </div>
            </div>
          </DialogHeader>
          <DialogFooter className="border-border/40 bg-muted/20 !flex-col !items-stretch gap-3 border-t px-4 py-4 sm:px-6 sm:py-5">
            {canEdit ? (
              <Button
                type="button"
                size="lg"
                className="h-12 w-full shrink-0 justify-center gap-2 text-[0.9375rem] shadow-sm sm:h-11 sm:text-sm"
                disabled={leaveBusy || saving}
                onClick={() => void handleLeaveSave()}
              >
                {leaveBusy || saving ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <>
                    <Save className="size-4 opacity-90" aria-hidden />
                    Lagre og fortsett
                  </>
                )}
              </Button>
            ) : null}
            <div className="flex w-full shrink-0 flex-col gap-2.5 sm:flex-row sm:gap-2">
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="h-12 w-full shrink-0 justify-center sm:h-11 sm:flex-1"
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
                variant="destructive"
                size="lg"
                className="h-12 w-full shrink-0 justify-center gap-2 whitespace-normal px-3 text-center leading-snug sm:h-11 sm:flex-1 sm:px-4"
                disabled={leaveBusy}
                onClick={handleLeaveDiscard}
              >
                <FileX className="size-4 shrink-0 opacity-90" aria-hidden />
                Forlat uten å lagre
              </Button>
            </div>
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

      <PddTutorialOverlay
        open={tutorialOpen}
        onClose={() => setTutorialOpen(false)}
        onDismissPermanent={() => {
          dismissPermanent();
          setTutorialOpen(false);
        }}
      />
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
    <div className="rounded-xl bg-muted/20 px-3 py-2.5">
      <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </span>
      {text && href ? (
        <Link
          href={href}
          className="mt-1 flex items-center gap-1.5 text-sm font-medium text-foreground underline-offset-4 transition-colors hover:text-primary hover:underline"
        >
          <span className="min-w-0 truncate">{text}</span>
          <ExternalLink className="size-3.5 shrink-0 opacity-50" aria-hidden />
        </Link>
      ) : text ? (
        <p className="mt-1 text-sm text-foreground">{text}</p>
      ) : (
        <p className="mt-1 text-sm text-muted-foreground">{emptyText ?? "—"}</p>
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
            <div className="mt-2">
              <RichTextEditor
                placeholder="Handling / tiltak"
                value={r.action}
                disabled={disabled}
                rows={2}
                aria-label="Handling / tiltak"
                onChange={(v) => update(i, { action: v })}
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
                <RichTextEditor
                  placeholder="Beskrivelse"
                  value={r.description}
                  disabled={disabled}
                  rows={2}
                  aria-label="Stegbeskrivelse"
                  onChange={(v) => update(i, { description: v })}
                />
                <RichTextEditor
                  placeholder="Inndata"
                  value={r.input ?? ""}
                  disabled={disabled}
                  rows={2}
                  aria-label="Inndata"
                  onChange={(v) => update(i, { input: v })}
                />
                <RichTextEditor
                  placeholder="Unntak / feilhåndtering"
                  value={r.exception ?? ""}
                  disabled={disabled}
                  rows={2}
                  aria-label="Unntak / feilhåndtering"
                  onChange={(v) => update(i, { exception: v })}
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
