"use client";

import { cn } from "@/lib/utils";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

function useIsClient() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

/**
 * Tredelt valg: lyst, mørkt eller system (next-themes).
 */
export function ThemeModeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const isClient = useIsClient();

  if (!isClient) {
    return (
      <span
        className={cn(
          "border-border/60 bg-muted/30 inline-flex h-9 rounded-lg border p-0.5",
          className,
        )}
        aria-hidden
      >
        <span className="size-8" />
        <span className="size-8" />
        <span className="size-8" />
      </span>
    );
  }

  return (
    <div
      className={cn(
        "border-border/60 bg-muted/40 inline-flex rounded-lg border p-0.5 shadow-sm",
        className,
      )}
      role="group"
      aria-label="Fargetema"
    >
      <button
        type="button"
        className={cn(
          "inline-flex size-8 items-center justify-center rounded-md transition-colors",
          theme === "light"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
        onClick={() => setTheme("light")}
        aria-pressed={theme === "light"}
        aria-label="Lyst tema"
        title="Lyst"
      >
        <Sun className="size-4" />
      </button>
      <button
        type="button"
        className={cn(
          "inline-flex size-8 items-center justify-center rounded-md transition-colors",
          theme === "dark"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
        onClick={() => setTheme("dark")}
        aria-pressed={theme === "dark"}
        aria-label="Mørkt tema"
        title="Mørkt"
      >
        <Moon className="size-4" />
      </button>
      <button
        type="button"
        className={cn(
          "inline-flex size-8 items-center justify-center rounded-md transition-colors",
          theme === "system"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
        onClick={() => setTheme("system")}
        aria-pressed={theme === "system"}
        aria-label="Følg system"
        title="System"
      >
        <Monitor className="size-4" />
      </button>
    </div>
  );
}
