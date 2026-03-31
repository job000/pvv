"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

const THEME_CYCLE = ["system", "light", "dark"] as const;

function useIsClient() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

/**
 * Én knapp: syklus system → lyst → mørkt → system.
 */
export function ThemeModeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const isClient = useIsClient();

  const stored =
    theme === "light" || theme === "dark" || theme === "system"
      ? theme
      : "system";
  const label =
    stored === "light" ? "Lyst" : stored === "dark" ? "Mørkt" : "System";

  const cycle = () => {
    const i = THEME_CYCLE.indexOf(stored);
    const next = THEME_CYCLE[(i < 0 ? 0 : i + 1) % THEME_CYCLE.length];
    setTheme(next);
  };

  const Icon = stored === "light" ? Sun : stored === "dark" ? Moon : Monitor;

  if (!isClient) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn("size-9 rounded-full", className)}
        disabled
        aria-hidden
      >
        <span className="size-5" />
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn(
        "text-muted-foreground hover:text-foreground size-9 rounded-full",
        className,
      )}
      onClick={cycle}
      aria-label={`Tema: ${label}. Velg neste.`}
      title={`${label} — klikk for å bytte`}
    >
      <Icon className="size-5" aria-hidden />
    </Button>
  );
}
