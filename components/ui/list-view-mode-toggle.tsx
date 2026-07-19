"use client";

import {
  LIST_VIEW_MODES,
  type ListViewMode,
} from "@/lib/list-view-mode";
import { cn } from "@/lib/utils";
import { LayoutGrid, List, Table2 } from "lucide-react";

const ICONS = {
  cards: LayoutGrid,
  list: List,
  table: Table2,
} as const;

const selectClass = cn(
  "h-10 cursor-pointer appearance-none truncate rounded-lg border border-border/60 bg-background/60 py-0 pl-3 pr-8 text-sm outline-none",
  "transition-colors focus:border-foreground/25 focus:bg-background",
);

type Props = {
  value: ListViewMode;
  onChange: (next: ListViewMode) => void;
  className?: string;
  /** Show the native select (useful on small screens). Default true. */
  showSelect?: boolean;
  /** Show icon button group from `sm` breakpoint. Default true. */
  showIcons?: boolean;
};

export function ListViewModeToggle({
  value,
  onChange,
  className,
  showSelect = true,
  showIcons = true,
}: Props) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {showSelect ? (
        <label
          className={cn(
            "flex items-center gap-2 text-sm text-muted-foreground",
            showIcons && "sm:hidden",
          )}
        >
          <span className="sr-only">Visning</span>
          <span className="relative">
            <select
              aria-label="Visningsmodus"
              value={value}
              onChange={(e) => onChange(e.target.value as ListViewMode)}
              className={cn(selectClass, "min-w-[8.5rem]")}
            >
              {LIST_VIEW_MODES.map((mode) => (
                <option key={mode.value} value={mode.value}>
                  {mode.label}
                </option>
              ))}
            </select>
          </span>
        </label>
      ) : null}
      {showIcons ? (
        <div
          className={cn(
            "items-center gap-0.5 rounded-xl border border-border/50 bg-muted/30 p-1",
            showSelect ? "hidden sm:inline-flex" : "inline-flex",
          )}
          role="group"
          aria-label="Hurtigvisning"
        >
          {LIST_VIEW_MODES.map(({ value: mode, label }) => {
            const Icon = ICONS[mode];
            return (
              <button
                key={mode}
                type="button"
                title={label}
                aria-label={label}
                aria-pressed={value === mode}
                className={cn(
                  "flex size-9 items-center justify-center rounded-md transition-colors",
                  value === mode
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => onChange(mode)}
              >
                <Icon className="size-4" aria-hidden />
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
