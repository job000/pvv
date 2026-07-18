"use client";

import { MarkdownView } from "@/components/ui/markdown-view";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useId, useState } from "react";

type Mode = "write" | "preview";

export function MarkdownEditor({
  value,
  onChange,
  disabled,
  placeholder = "Skriv i Markdown…",
  className,
  rows = 8,
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  rows?: number;
  "aria-label"?: string;
}) {
  const id = useId();
  const [mode, setMode] = useState<Mode>("write");

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border/50 bg-muted/15",
        "focus-within:border-foreground/20 focus-within:bg-background focus-within:ring-1 focus-within:ring-foreground/10",
        disabled && "opacity-60",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 bg-muted/25 px-2 py-1">
        <div
          role="tablist"
          aria-label="Markdown-modus"
          className="bg-background/70 inline-flex rounded-lg border border-border/50 p-0.5"
        >
          {(
            [
              ["write", "Skriv"],
              ["preview", "Forhåndsvis"],
            ] as const
          ).map(([idMode, label]) => (
            <button
              key={idMode}
              type="button"
              role="tab"
              aria-selected={mode === idMode}
              disabled={disabled}
              onClick={() => setMode(idMode)}
              className={cn(
                "inline-flex h-7 items-center rounded-md px-2.5 text-xs font-medium",
                mode === idMode
                  ? "bg-foreground text-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-muted-foreground hidden text-[10px] sm:block">
          **fet** · *kursiv* · `kode` · lister · lenker · tabeller
        </p>
      </div>

      {mode === "write" ? (
        <Textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={placeholder}
          rows={rows}
          aria-label={ariaLabel}
          className="min-h-[10rem] resize-y rounded-none border-0 bg-transparent px-3.5 py-3 font-mono text-sm leading-6 shadow-none focus-visible:ring-0"
        />
      ) : (
        <div className="min-h-[10rem] px-3.5 py-3">
          <MarkdownView
            value={value}
            onChange={onChange}
            disabled={disabled}
            emptyLabel="Ingenting å forhåndsvise ennå."
          />
        </div>
      )}
    </div>
  );
}
