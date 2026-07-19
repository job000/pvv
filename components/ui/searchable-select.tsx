"use client";

import { SearchInput } from "@/components/ui/search-input";
import { cn } from "@/lib/utils";
import { Check, ChevronDown, X } from "lucide-react";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { createPortal } from "react-dom";

export type SearchableSelectOption = {
  value: string;
  label: string;
  hint?: string;
};

function subscribeDesktop(onStoreChange: () => void) {
  const mq = window.matchMedia("(min-width: 640px)");
  mq.addEventListener("change", onStoreChange);
  return () => mq.removeEventListener("change", onStoreChange);
}

export function SearchableSelect({
  id,
  value,
  onChange,
  options,
  placeholder = "Velg …",
  searchPlaceholder = "Søk …",
  emptyMessage = "Ingen treff",
  disabled,
  allowClear = true,
  clearLabel = "Ingen",
  "aria-label": ariaLabel,
  className,
  triggerClassName,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  allowClear?: boolean;
  clearLabel?: string;
  "aria-label": string;
  className?: string;
  triggerClassName?: string;
}) {
  const autoId = useId();
  const listboxId = `${id ?? autoId}-listbox`;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({});
  const [mounted, setMounted] = useState(false);

  const isDesktop = useSyncExternalStore(
    subscribeDesktop,
    () => window.matchMedia("(min-width: 640px)").matches,
    () => false,
  );

  const selected = options.find((o) => o.value === value);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.hint?.toLowerCase().includes(q) ?? false),
    );
  }, [options, query]);

  const rows = useMemo(() => {
    if (!allowClear) return filtered;
    return [{ value: "", label: clearLabel }, ...filtered];
  }, [allowClear, clearLabel, filtered]);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setHighlight(0);
      return;
    }
    const t = window.setTimeout(() => {
      panelRef.current
        ?.querySelector<HTMLInputElement>("input[type='search'], input")
        ?.focus();
    }, 30);
    return () => window.clearTimeout(t);
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !isDesktop || !triggerRef.current) return;
    const update = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const maxH = Math.min(320, window.innerHeight - 24);
      const spaceBelow = window.innerHeight - rect.bottom - 12;
      const openUp = spaceBelow < 220 && rect.top > spaceBelow;
      setPanelStyle({
        position: "fixed",
        left: Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 8)),
        width: Math.max(rect.width, 240),
        maxHeight: maxH,
        zIndex: 260,
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
  }, [open, isDesktop]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setHighlight((h) => Math.min(h, Math.max(0, rows.length - 1)));
  }, [open, rows.length]);

  const pick = (next: string) => {
    onChange(next);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const onTriggerKeyDown = (e: ReactKeyboardEvent) => {
    if (disabled) return;
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpen(true);
    }
  };

  const onListKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, rows.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const row = rows[highlight];
      if (row) pick(row.value);
    }
  };

  const panel = open ? (
    <div
      ref={panelRef}
      id={listboxId}
      role="listbox"
      aria-label={ariaLabel}
      className={cn(
        "bg-background border-border/70 flex flex-col overflow-hidden shadow-2xl",
        isDesktop
          ? "rounded-xl border"
          : "fixed inset-x-0 bottom-0 z-[260] max-h-[min(78dvh,32rem)] rounded-t-2xl border-t pb-[max(0.75rem,env(safe-area-inset-bottom))]",
      )}
      style={isDesktop ? panelStyle : undefined}
      onKeyDown={onListKeyDown}
    >
      {!isDesktop ? (
        <div className="flex items-center justify-between gap-2 border-b border-border/50 px-4 py-3">
          <p className="font-heading text-base font-semibold">{ariaLabel}</p>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground inline-flex size-9 items-center justify-center rounded-lg touch-manipulation"
            aria-label="Lukk"
            onClick={() => setOpen(false)}
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      ) : null}
      <div className="border-b border-border/40 p-2 sm:p-2.5">
        <SearchInput
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setHighlight(0);
          }}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          onKeyDown={onListKeyDown}
        />
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5">
        {rows.length === 0 ? (
          <li className="text-muted-foreground px-3 py-6 text-center text-sm">
            {emptyMessage}
          </li>
        ) : (
          rows.map((row, i) => {
            const active = row.value === value;
            const hi = i === highlight;
            return (
              <li key={row.value || "__clear__"} role="option" aria-selected={active}>
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-start gap-2 rounded-lg px-3 py-2.5 text-left text-sm touch-manipulation transition-colors",
                    hi && "bg-muted/80",
                    active && "bg-foreground/[0.06] font-medium",
                    !hi && !active && "hover:bg-muted/50",
                  )}
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => pick(row.value)}
                >
                  <Check
                    className={cn(
                      "mt-0.5 size-4 shrink-0",
                      active ? "opacity-100" : "opacity-0",
                    )}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{row.label}</span>
                    {row.hint ? (
                      <span className="text-muted-foreground mt-0.5 block truncate text-xs">
                        {row.hint}
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  ) : null;

  return (
    <div ref={rootRef} className={cn("relative min-w-0 w-full", className)}>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        onClick={() => !disabled && setOpen((v) => !v)}
        onKeyDown={onTriggerKeyDown}
        className={cn(
          "border-input bg-background flex min-h-11 w-full items-center gap-2 rounded-xl border px-3 text-left text-base shadow-sm transition-[border-color,box-shadow]",
          "focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
          "disabled:cursor-not-allowed disabled:opacity-60",
          "sm:min-h-10 sm:rounded-lg sm:text-sm",
          open && "border-ring ring-2 ring-ring/20",
          triggerClassName,
        )}
      >
        <span
          className={cn(
            "min-w-0 flex-1 truncate",
            selected ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown
          className={cn(
            "text-muted-foreground size-4 shrink-0 opacity-70 transition-transform",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>

      {mounted && open && !isDesktop
        ? createPortal(
            <div className="fixed inset-0 z-[255]">
              <button
                type="button"
                aria-label="Lukk"
                className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
                onClick={() => setOpen(false)}
              />
              {panel}
            </div>,
            document.body,
          )
        : null}
      {mounted && open && isDesktop
        ? createPortal(panel, document.body)
        : null}
    </div>
  );
}
