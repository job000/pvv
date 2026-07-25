"use client";

import { useWorkspaceCommandSearch } from "@/components/use-workspace-command-search";
import { openCommandPalette } from "@/lib/command-palette-events";
import { cn } from "@/lib/utils";
import { Search, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

function subscribeIsApple(onChange: () => void) {
  // Platform tiper endres sjelden — noop-abonnement.
  void onChange;
  return () => {};
}

function getIsAppleShortcut() {
  if (typeof navigator === "undefined") return true;
  return /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent);
}

/**
 * Toppfelt-søk med dropdown-forslag.
 * Full søkedialog åpnes kun via ⌘K / Ctrl+K (eller mobil-ikon).
 */
export function HeaderSearchField() {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const isApple = useSyncExternalStore(
    subscribeIsApple,
    getIsAppleShortcut,
    () => true,
  );
  const shortcutLabel = isApple ? "⌘K" : "Ctrl+K";

  const closeDropdown = useCallback(() => {
    setOpen(false);
    setActiveIndex(0);
  }, []);

  const clearAndClose = useCallback(() => {
    setQuery("");
    closeDropdown();
  }, [closeDropdown]);

  const { filtered, groups, contentLoading, placeholder } =
    useWorkspaceCommandSearch({
      query,
      searchEnabled: open,
      onAfterRun: clearAndClose,
    });

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        closeDropdown();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, closeDropdown]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-flat-index="${activeIndex}"]`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      // La global handler åpne dialogen — lukk dropdown først.
      closeDropdown();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setOpen(true);
      setActiveIndex((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const item = filtered[activeIndex];
      if (item) item.run();
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      if (query) {
        setQuery("");
      } else {
        closeDropdown();
        inputRef.current?.blur();
      }
    }
  };

  const emptyLabel = contentLoading
    ? "Søker …"
    : query.trim()
      ? `Ingen treff for «${query}»`
      : "Skriv for å søke — eller trykk " + shortcutLabel;

  return (
    <div ref={rootRef} className="relative mr-1 hidden md:block">
      <label
        className={cn(
          "border-border/60 bg-muted/30 flex h-9 w-56 items-center gap-2 rounded-xl border px-3 transition-[border-color,box-shadow] lg:w-64",
          "focus-within:border-ring focus-within:ring-ring/30 focus-within:ring-2",
          open && "border-ring ring-ring/30 ring-2",
        )}
      >
        <Search
          className="text-muted-foreground size-3.5 shrink-0"
          aria-hidden
        />
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            open && filtered[activeIndex]
              ? `${listId}-opt-${activeIndex}`
              : undefined
          }
          value={query}
          placeholder="Søk …"
          className="text-foreground placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-sm outline-none"
          aria-label="Søk i arbeidsområdet"
          autoComplete="off"
          spellCheck={false}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
        />
        {query ? (
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground grid size-6 shrink-0 place-items-center rounded-md"
            aria-label="Tøm søk"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
          >
            <X className="size-3.5" aria-hidden />
          </button>
        ) : (
          <kbd className="border-border/60 bg-background text-muted-foreground shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-medium">
            {shortcutLabel}
          </kbd>
        )}
      </label>

      {open ? (
        <div
          id={listId}
          ref={listRef}
          role="listbox"
          aria-label="Søkeforslag"
          className="border-border/70 bg-popover text-popover-foreground absolute top-[calc(100%+0.35rem)] right-0 z-[230] max-h-[min(22rem,55vh)] w-[min(22rem,calc(100vw-2rem))] overflow-y-auto overscroll-contain rounded-2xl border p-1.5 shadow-[var(--shadow-elevated)]"
        >
          <p className="text-muted-foreground truncate px-2.5 pb-1 pt-1.5 text-[11px]">
            {placeholder}
          </p>
          {filtered.length === 0 ? (
            <p className="text-muted-foreground px-2.5 py-6 text-center text-sm">
              {emptyLabel}
            </p>
          ) : (
            groups.map((group) => (
              <div key={group.name} role="group" aria-label={group.name}>
                <p className="text-muted-foreground/80 px-2.5 pb-1 pt-2 text-[10px] font-semibold tracking-wider uppercase">
                  {group.name}
                </p>
                {group.items.map(({ command, flatIndex }) => {
                  const active = flatIndex === activeIndex;
                  const Icon = command.icon;
                  return (
                    <button
                      key={command.id}
                      id={`${listId}-opt-${flatIndex}`}
                      type="button"
                      role="option"
                      aria-selected={active}
                      data-flat-index={flatIndex}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => command.run()}
                      onMouseMove={() => setActiveIndex(flatIndex)}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm transition-colors",
                        active
                          ? "bg-primary/10 text-foreground"
                          : "text-muted-foreground",
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
                        <span className="text-muted-foreground/70 max-w-[7rem] shrink-0 truncate text-xs">
                          {command.hint}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ))
          )}
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground mt-1 flex w-full items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-[11px] font-medium"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              const q = query;
              closeDropdown();
              openCommandPalette({ query: q });
            }}
          >
            Åpne som dialog ({shortcutLabel})
          </button>
        </div>
      ) : null}
    </div>
  );
}
