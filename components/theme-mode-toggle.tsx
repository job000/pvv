"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

const THEME_OPTIONS = [
  { value: "light", label: "Lyst", Icon: Sun },
  { value: "dark", label: "Mørkt", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
] as const;

type ThemeValue = (typeof THEME_OPTIONS)[number]["value"];

function useIsClient() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

/**
 * Temavelger med eksplisitte valg (lyst / mørkt / system).
 * Syklus-knappen tidligere føltes «ødelagt» fordi system→lyst
 * ofte ikke endret utseendet når OS allerede er lyst.
 */
export function ThemeModeToggle({
  className,
  onThemeChange,
}: {
  className?: string;
  onThemeChange?: (theme: ThemeValue) => void;
}) {
  const { theme, setTheme } = useTheme();
  const isClient = useIsClient();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const stored: ThemeValue =
    theme === "light" || theme === "dark" || theme === "system"
      ? theme
      : "system";

  const ActiveIcon =
    THEME_OPTIONS.find((o) => o.value === stored)?.Icon ?? Monitor;
  const activeLabel =
    THEME_OPTIONS.find((o) => o.value === stored)?.label ?? "System";

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!isClient) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn("size-9 shrink-0 rounded-full", className)}
        disabled
        aria-hidden
      >
        <span className="size-5" />
      </Button>
    );
  }

  return (
    <div ref={rootRef} className="relative">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(
          "text-muted-foreground hover:text-foreground size-9 shrink-0 rounded-full",
          open && "bg-muted text-foreground",
          className,
        )}
        onClick={() => setOpen((v) => !v)}
        aria-label={`Tema: ${activeLabel}. Åpne temameny.`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        title={`Tema: ${activeLabel}`}
      >
        <ActiveIcon className="size-5" aria-hidden />
      </Button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label="Velg tema"
          className={cn(
            "absolute right-0 top-[calc(100%+0.4rem)] z-50 min-w-[10.5rem] overflow-hidden rounded-xl border p-1 shadow-lg",
            "border-border/80 bg-popover text-popover-foreground",
          )}
        >
          {THEME_OPTIONS.map(({ value, label, Icon }) => {
            const selected = stored === value;
            return (
              <button
                key={value}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
                  selected
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                )}
                onClick={() => {
                  setTheme(value);
                  onThemeChange?.(value);
                  setOpen(false);
                }}
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                <span className="flex-1">{label}</span>
                {selected ? (
                  <Check className="size-3.5 shrink-0 opacity-80" aria-hidden />
                ) : (
                  <span className="size-3.5" aria-hidden />
                )}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
