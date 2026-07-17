"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

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

function nextTheme(current: ThemeValue): ThemeValue {
  const i = THEME_OPTIONS.findIndex((o) => o.value === current);
  return THEME_OPTIONS[(i + 1) % THEME_OPTIONS.length]!.value;
}

/**
 * Én temaknapp: trykk sykler Lyst → Mørkt → System.
 * Ikonet følger lagret preferanse (ikke bare OS-utseende), så valget alltid er synlig.
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

  const stored: ThemeValue =
    theme === "light" || theme === "dark" || theme === "system"
      ? theme
      : "system";

  const current = THEME_OPTIONS.find((o) => o.value === stored) ?? THEME_OPTIONS[2];
  const ActiveIcon = current.Icon;

  if (!isClient) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn("size-10 shrink-0 rounded-xl", className)}
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
        "text-muted-foreground hover:text-foreground size-10 shrink-0 rounded-xl touch-manipulation",
        className,
      )}
      onClick={() => {
        const next = nextTheme(stored);
        setTheme(next);
        onThemeChange?.(next);
      }}
      aria-label={`Tema: ${current.label}. Trykk for neste.`}
      title={`Tema: ${current.label} (trykk for neste)`}
    >
      <ActiveIcon className="size-5" aria-hidden />
    </Button>
  );
}
