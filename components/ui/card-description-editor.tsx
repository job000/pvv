"use client";

import { MarkdownView } from "@/components/ui/markdown-view";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { Textarea } from "@/components/ui/textarea";
import { isLikelyHtml, isLikelyMarkdown } from "@/lib/rich-text";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

type Mode = "write" | "markdown" | "preview";

function initialModeForValue(value: string): Mode {
  if (isLikelyMarkdown(value)) return "preview";
  if (isLikelyHtml(value)) return "write";
  return "write";
}

/**
 * Beskrivelse: brukervennlig skriver (rik tekst) + egen Markdown-fane + forhåndsvisning.
 * Innhold lagres som HTML (fra Skriv) eller Markdown (fra Markdown-fanen).
 */
export function CardDescriptionEditor({
  value,
  onChange,
  disabled,
  className,
  rows = 6,
  "aria-label": ariaLabel = "Beskrivelse",
  insertToken,
  onInsertConsumed,
}: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  className?: string;
  rows?: number;
  "aria-label"?: string;
  /** Sett inn vedlegg-referanse i aktiv fane (Skriv/Markdown). */
  insertToken?: string | null;
  onInsertConsumed?: () => void;
}) {
  const [mode, setMode] = useState<Mode>(() => initialModeForValue(value));

  useEffect(() => {
    if (!insertToken) return;
    const token = insertToken.trim();
    const preferMd = isLikelyMarkdown(value) || mode === "markdown";
    if (mode === "preview") setMode(preferMd ? "markdown" : "write");

    const useHtml =
      !preferMd &&
      (mode === "write" || isLikelyHtml(value) || !value.trim());
    let chunk = token;
    if (useHtml && mode !== "markdown") {
      const img = /^!\[([^\]]*)\]\(([^)]+)\)$/.exec(token);
      const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
      if (img) {
        const alt = img[1] ?? "";
        const src = img[2] ?? "";
        chunk = `<p><img src="${src}" alt="${alt}" class="rich-text-image" /></p>`;
      } else if (link) {
        chunk = `<p><a href="${link[2]}">${link[1]}</a></p>`;
      } else {
        chunk = `<p>${token}</p>`;
      }
      onChange(value ? `${value}${chunk}` : chunk);
    } else {
      onChange(value ? `${value.replace(/\s*$/, "")}\n\n${token}` : token);
    }
    onInsertConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to insertToken
  }, [insertToken]);

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
          aria-label="Beskrivelsesmodus"
          className="bg-background/70 inline-flex rounded-lg border border-border/50 p-0.5"
        >
          {(
            [
              ["write", "Skriv"],
              ["markdown", "Markdown"],
              ["preview", "Forhåndsvis"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={mode === id}
              disabled={disabled}
              onClick={() => setMode(id)}
              className={cn(
                "inline-flex h-7 items-center rounded-md px-2.5 text-xs font-medium",
                mode === id
                  ? "bg-foreground text-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-muted-foreground hidden text-[10px] sm:block">
          {mode === "write"
            ? "Tekst, bilder og formatering"
            : mode === "markdown"
              ? "- [ ] sjekkliste · **fet** · *kursiv* · [lenke](…)"
              : isLikelyMarkdown(value)
                ? "Markdown (f.eks. fra GitHub)"
                : "Slik det vises for andre"}
        </p>
      </div>

      {mode === "write" ? (
        <div className="p-1">
          {isLikelyMarkdown(value) ? (
            <div className="space-y-2 px-2 py-2">
              <p className="text-muted-foreground text-xs leading-relaxed">
                Dette ser ut som Markdown (f.eks. GitHub-sjekklister). Bruk
                Markdown- eller Forhåndsvis-fanen — rik tekst kan ødelegge
                formateringen.
              </p>
              <button
                type="button"
                className="text-sky-800 dark:text-sky-200 text-xs font-medium underline-offset-2 hover:underline"
                onClick={() => setMode("preview")}
              >
                Vis som Markdown
              </button>
            </div>
          ) : (
            <RichTextEditor
              aria-label={ariaLabel}
              value={value}
              onChange={onChange}
              disabled={disabled}
              rows={rows}
              allowImages
              placeholder="Skriv beskrivelsen — tekst, bilder, lister …"
              className="border-0 bg-transparent shadow-none"
            />
          )}
        </div>
      ) : null}

      {mode === "markdown" ? (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={
            "Skriv Markdown…\n\n**fet** *kursiv*\n- liste\n![bilde](url)\n[vedlegg](attachment:…)"
          }
          rows={rows + 2}
          aria-label={`${ariaLabel} (Markdown)`}
          className="min-h-[10rem] resize-y rounded-none border-0 bg-transparent px-3.5 py-3 font-mono text-sm leading-6 shadow-none focus-visible:ring-0"
        />
      ) : null}

      {mode === "preview" ? (
        <div className="min-h-[10rem] px-3.5 py-3">
          <MarkdownView
            value={value}
            emptyLabel="Ingenting å forhåndsvise ennå."
          />
        </div>
      ) : null}
    </div>
  );
}
