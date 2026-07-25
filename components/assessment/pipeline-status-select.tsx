"use client";

import { Sheet, SheetContent } from "@/components/ui/sheet";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "@/lib/app-toast";
import {
  PIPELINE_KANBAN_ORDER,
  PIPELINE_STATUS_LABELS,
  PIPELINE_STATUS_TONES,
  readinessLabel,
  type PipelineStatus,
} from "@/lib/assessment-pipeline";
import { cn } from "@/lib/utils";
import { useMutation } from "convex/react";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from "react";
import { createPortal } from "react-dom";

type Props = {
  assessmentId: Id<"assessments">;
  value: PipelineStatus;
  disabled?: boolean;
  className?: string;
  /** Mindre pill (kort og lister) */
  compact?: boolean;
};

export function PipelineStatusBadge({
  value,
  className,
  compact = false,
}: {
  value: PipelineStatus;
  className?: string;
  compact?: boolean;
}) {
  const tone = PIPELINE_STATUS_TONES[value];
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full font-semibold ring-1",
        compact
          ? "px-2 py-0.5 text-[11px] leading-none"
          : "px-2.5 py-1 text-xs leading-none",
        tone.pill,
        className,
      )}
    >
      <span
        className={cn("size-1.5 shrink-0 rounded-full", tone.dot)}
        aria-hidden
      />
      <span className="truncate">{PIPELINE_STATUS_LABELS[value]}</span>
    </span>
  );
}

function TriggerContents({
  value,
  busy,
}: {
  value: PipelineStatus;
  busy: boolean;
}) {
  return (
    <>
      {busy ? (
        <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden />
      ) : (
        <span
          className={cn(
            "size-1.5 shrink-0 rounded-full",
            PIPELINE_STATUS_TONES[value].dot,
          )}
          aria-hidden
        />
      )}
      <span className="min-w-0 truncate">{PIPELINE_STATUS_LABELS[value]}</span>
      <ChevronDown className="size-3.5 shrink-0 opacity-70" aria-hidden />
    </>
  );
}

function StatusOptionList({
  value,
  busy,
  disabled,
  onPick,
  dense,
}: {
  value: PipelineStatus;
  busy: boolean;
  disabled: boolean;
  onPick: (s: PipelineStatus) => void;
  dense?: boolean;
}) {
  return (
    <ul className={cn("p-1", dense ? "space-y-0" : "space-y-0.5 p-1.5")}>
      {PIPELINE_KANBAN_ORDER.map((s) => {
        const active = s === value;
        const tone = PIPELINE_STATUS_TONES[s];
        return (
          <li key={s} role="option" aria-selected={active}>
            <button
              type="button"
              disabled={busy || disabled}
              className={cn(
                "flex w-full items-start gap-2.5 rounded-lg px-3 text-left touch-manipulation transition-colors",
                dense ? "py-2" : "min-h-12 py-2.5",
                "hover:bg-muted focus-visible:bg-muted focus-visible:outline-none active:bg-muted",
                active && "bg-muted font-medium",
              )}
              onClick={() => onPick(s)}
            >
              <span
                className={cn("mt-1.5 size-2 shrink-0 rounded-full", tone.dot)}
                aria-hidden
              />
              <span className="min-w-0 flex-1">
                <span className="text-foreground block text-sm font-medium">
                  {PIPELINE_STATUS_LABELS[s]}
                </span>
                <span className="text-muted-foreground mt-0.5 block text-xs leading-snug">
                  {readinessLabel(s)}
                </span>
              </span>
              <Check
                className={cn(
                  "mt-0.5 size-4 shrink-0",
                  active ? "text-foreground opacity-100" : "opacity-0",
                )}
                aria-hidden
              />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Pipeline-status for en vurdering.
 * Mobil: bottom sheet. Desktop: solid portal-panel (ikke Base UI Menu).
 */
export function PipelineStatusSelect({
  assessmentId,
  value,
  disabled = false,
  className,
  compact = false,
}: Props) {
  const setStatus = useMutation(api.assessments.setPipelineStatus);
  const listboxId = useId();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [desktopOpen, setDesktopOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  const closeAll = useCallback(() => {
    setSheetOpen(false);
    setDesktopOpen(false);
  }, []);

  const applyStatus = useCallback(
    async (next: PipelineStatus) => {
      if (next === value || busy || disabled) return;
      setBusy(true);
      try {
        const res = await setStatus({ assessmentId, status: next });
        if (res.deliveryTasksCreated) {
          toast.success(
            "Leveranse klar: ROS/PDD opprettet ved behov, oppgaver på tavlen, involverte varslet.",
          );
        } else {
          toast.success(`Status: ${PIPELINE_STATUS_LABELS[next]}`);
        }
        closeAll();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Kunne ikke oppdatere status.",
        );
      } finally {
        setBusy(false);
      }
    },
    [assessmentId, busy, closeAll, disabled, setStatus, value],
  );

  const stopCardNav = {
    onClick: (e: MouseEvent) => e.stopPropagation(),
    onPointerDown: (e: PointerEvent) => e.stopPropagation(),
    onKeyDown: (e: KeyboardEvent) => e.stopPropagation(),
  } as const;

  useLayoutEffect(() => {
    if (!desktopOpen || !triggerRef.current) return;
    const update = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(320, Math.max(260, rect.width + 64));
      const maxH = Math.min(360, window.innerHeight - 24);
      const spaceBelow = window.innerHeight - rect.bottom - 10;
      const openUp = spaceBelow < 240 && rect.top > spaceBelow;
      const left = Math.max(
        8,
        Math.min(rect.left, window.innerWidth - width - 8),
      );
      setPanelStyle({
        position: "fixed",
        left,
        width,
        maxHeight: maxH,
        zIndex: 280,
        ...(openUp
          ? { bottom: window.innerHeight - rect.top + 6 }
          : { top: rect.bottom + 6 }),
      });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [desktopOpen]);

  useEffect(() => {
    if (!desktopOpen) return;
    const onPointerDown = (e: Event) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || panelRef.current?.contains(t)) {
        return;
      }
      setDesktopOpen(false);
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setDesktopOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [desktopOpen]);

  const ariaLabel = `Pipeline-status: ${PIPELINE_STATUS_LABELS[value]}. Trykk for å endre.`;
  const triggerCn = cn(
    "inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-full font-semibold ring-1 touch-manipulation",
    "hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "disabled:pointer-events-none disabled:opacity-50",
    compact
      ? "h-8 max-w-[9.5rem] px-2.5 text-[11px] sm:max-w-[11rem] sm:h-7"
      : "h-10 min-h-10 max-w-[14rem] px-3 text-sm sm:h-9 sm:min-h-0",
    PIPELINE_STATUS_TONES[value].pill,
    (sheetOpen || desktopOpen) && "ring-2 ring-ring/40",
    className,
  );

  const desktopPanel =
    desktopOpen && mounted ? (
      <div
        ref={panelRef}
        id={listboxId}
        role="listbox"
        aria-label="Velg status"
        className="isolate overflow-hidden rounded-xl border border-border text-foreground shadow-2xl"
        style={{
          ...panelStyle,
          backgroundColor: "var(--background)",
          color: "var(--foreground)",
        }}
      >
        <div
          className="border-b border-border px-3 py-2.5"
          style={{ backgroundColor: "var(--background)" }}
        >
          <p className="text-sm font-semibold tracking-tight">Sett status</p>
          <p className="text-muted-foreground text-xs">
            Velg steg i livssyklusen
          </p>
        </div>
        <div
          className="max-h-[min(70vh,20rem)] overflow-y-auto overscroll-contain"
          style={{ backgroundColor: "var(--background)" }}
        >
          <StatusOptionList
            value={value}
            busy={busy}
            disabled={disabled}
            dense
            onPick={(s) => void applyStatus(s)}
          />
        </div>
      </div>
    ) : null;

  return (
    <>
      {/* Mobil: bottom sheet */}
      <div className="inline-flex max-w-full min-w-0 sm:hidden" {...stopCardNav}>
        <button
          type="button"
          disabled={disabled || busy}
          aria-label={ariaLabel}
          aria-haspopup="dialog"
          aria-expanded={sheetOpen}
          className={triggerCn}
          onClick={() => setSheetOpen(true)}
        >
          <TriggerContents value={value} busy={busy} />
        </button>
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetContent side="bottom" className="gap-0 px-0">
            <div
              className="border-border border-b px-4 pb-3"
              style={{ backgroundColor: "var(--background)" }}
            >
              <p className="font-heading text-base font-semibold tracking-tight">
                Sett status
              </p>
              <p className="text-muted-foreground mt-0.5 text-sm">
                Hvor er vurderingen i livssyklusen?
              </p>
            </div>
            <div
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-3"
              role="listbox"
              aria-label="Velg status"
              style={{ backgroundColor: "var(--background)" }}
            >
              <StatusOptionList
                value={value}
                busy={busy}
                disabled={disabled}
                onPick={(s) => void applyStatus(s)}
              />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop: solid portal-panel */}
      <div
        className="relative hidden max-w-full min-w-0 sm:inline-flex"
        {...stopCardNav}
      >
        <button
          ref={triggerRef}
          type="button"
          disabled={disabled || busy}
          aria-label={ariaLabel}
          aria-haspopup="listbox"
          aria-expanded={desktopOpen}
          aria-controls={desktopOpen ? listboxId : undefined}
          className={triggerCn}
          onClick={() => !disabled && setDesktopOpen((v) => !v)}
        >
          <TriggerContents value={value} busy={busy} />
        </button>
        {desktopPanel ? createPortal(desktopPanel, document.body) : null}
      </div>
    </>
  );
}
