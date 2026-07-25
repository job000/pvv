"use client";

import { useWorkspaceCommandSearch } from "@/components/use-workspace-command-search";
import {
  COMMAND_PALETTE_EVENT,
  type CommandPaletteOpenDetail,
} from "@/lib/command-palette-events";
import { cn } from "@/lib/utils";
import { Search, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

export {
  COMMAND_PALETTE_EVENT,
  openCommandPalette,
  type CommandPaletteOpenDetail,
} from "@/lib/command-palette-events";

function subscribeIsApple(onChange: () => void) {
  void onChange;
  return () => {};
}

function getIsAppleShortcut() {
  if (typeof navigator === "undefined") return true;
  return /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent);
}

/**
 * Kompakt søkedialog (⌘K / Ctrl+K) — samme stil som originalt,
 * litt romsligere på desktop, trykkvennlig på mobil/nettbrett.
 * Vanlig skriving skjer i toppfeltets dropdown.
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const isApple = useSyncExternalStore(
    subscribeIsApple,
    getIsAppleShortcut,
    () => true,
  );
  const shortcutLabel = isApple ? "⌘K" : "Ctrl+K";

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActiveIndex(0);
  }, []);

  const { filtered, groups, contentLoading, placeholder } =
    useWorkspaceCommandSearch({
      query,
      searchEnabled: open,
      onAfterRun: close,
    });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => {
          if (prev) {
            setQuery("");
            setActiveIndex(0);
            return false;
          }
          return true;
        });
      }
    };
    const onOpenEvent = (e: Event) => {
      const detail = (e as CustomEvent<CommandPaletteOpenDetail>).detail;
      if (typeof detail?.query === "string") {
        setQuery(detail.query);
      }
      setActiveIndex(0);
      setOpen(true);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener(COMMAND_PALETTE_EVENT, onOpenEvent);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(COMMAND_PALETTE_EVENT, onOpenEvent);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => {
      document.body.style.overflow = prev;
      window.clearTimeout(t);
    };
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-flat-index="${activeIndex}"]`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  if (!open) return null;

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      filtered[activeIndex]?.run();
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  };

  const emptyLabel = contentLoading
    ? "Søker …"
    : query.trim()
      ? `Ingen treff for «${query}»`
      : "Begynn å skrive for å søke";

  return (
    <div
      className="fixed inset-0 z-[220] flex items-start justify-center px-3 pt-[max(0.75rem,env(safe-area-inset-top),8vh)] pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-4 sm:pt-[max(3.5rem,12vh)]"
      role="presentation"
    >
      <button
        type="button"
        aria-label="Lukk"
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
        onClick={close}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Søk"
        className="product-rise bg-popover text-popover-foreground relative z-10 flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border/70 shadow-[var(--shadow-elevated)] sm:max-w-xl md:max-w-2xl"
      >
        <div className="flex items-center gap-2 border-b border-border/60 px-3 sm:gap-3 sm:px-4">
          <Search
            className="text-muted-foreground size-4 shrink-0"
            aria-hidden
          />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder={placeholder}
            className="placeholder:text-muted-foreground/70 h-12 w-full min-w-0 bg-transparent text-base outline-none sm:h-13 sm:py-4 sm:text-sm"
            aria-label="Søk i arbeidsområdet"
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="search"
            inputMode="search"
          />
          {query ? (
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground grid size-10 shrink-0 place-items-center rounded-full touch-manipulation sm:size-9"
              aria-label="Tøm søk"
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
            >
              <X className="size-4" aria-hidden />
            </button>
          ) : (
            <kbd className="text-muted-foreground border-border/60 bg-muted/40 hidden shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-medium sm:block">
              esc
            </kbd>
          )}
          <button
            type="button"
            onClick={close}
            className="text-foreground min-h-10 shrink-0 px-1 text-sm font-semibold touch-manipulation sm:hidden"
          >
            Lukk
          </button>
        </div>

        <div
          ref={listRef}
          className="max-h-[min(22rem,55dvh)] overflow-y-auto overscroll-contain p-1.5 sm:max-h-[min(28rem,55vh)] sm:p-2"
        >
          {filtered.length === 0 ? (
            <p className="text-muted-foreground px-3 py-8 text-center text-sm">
              {emptyLabel}
            </p>
          ) : (
            groups.map((group) => (
              <div key={group.name} role="group" aria-label={group.name}>
                <p className="text-muted-foreground/80 px-3 pb-1 pt-2.5 text-[11px] font-semibold tracking-wider uppercase">
                  {group.name}
                </p>
                {group.items.map(({ command, flatIndex }) => {
                  const active = flatIndex === activeIndex;
                  const Icon = command.icon;
                  return (
                    <button
                      key={command.id}
                      type="button"
                      data-flat-index={flatIndex}
                      onClick={() => command.run()}
                      onMouseMove={() => setActiveIndex(flatIndex)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl px-3 text-left text-sm transition-colors touch-manipulation",
                        "min-h-11 py-2.5 sm:min-h-0 sm:py-2.5",
                        active
                          ? "bg-primary/10 text-foreground"
                          : "text-muted-foreground active:bg-muted/50",
                      )}
                    >
                      <Icon
                        className={cn(
                          "size-4 shrink-0",
                          active ? "text-primary" : "opacity-70",
                        )}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1 truncate font-medium">
                        {command.label}
                      </span>
                      {command.hint ? (
                        <span className="text-muted-foreground/70 max-w-[40%] shrink-0 truncate text-xs">
                          {command.hint}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className="text-muted-foreground/80 hidden items-center gap-4 border-t border-border/60 px-4 py-2.5 text-[11px] sm:flex">
          <span>↑↓ naviger</span>
          <span>↵ åpne</span>
          <span className="ml-auto">{shortcutLabel} når som helst</span>
        </div>
      </div>
    </div>
  );
}
