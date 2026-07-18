"use client";

import { cn } from "@/lib/utils";
import { isLikelyHtml, toEditorHtml } from "@/lib/rich-text";

const PROSE_CLASS = cn(
  "prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed",
  "[&_p]:my-1 [&_ul]:my-1.5 [&_ol]:my-1.5 [&_li]:my-0.5",
  "[&_mark.rich-text-highlight]:rounded-sm [&_mark.rich-text-highlight]:bg-amber-200/90 [&_mark.rich-text-highlight]:px-0.5 [&_mark.rich-text-highlight]:text-foreground",
  "dark:[&_mark.rich-text-highlight]:bg-amber-400/35",
  "[&_img.rich-text-image]:my-2 [&_img.rich-text-image]:max-h-64 [&_img.rich-text-image]:max-w-full [&_img.rich-text-image]:rounded-md [&_img.rich-text-image]:border [&_img.rich-text-image]:border-border/50",
);

/** Highlight @mentions inside an HTML string (text nodes only — naive but safe enough). */
function highlightMentionsInHtml(html: string, mentionNames: string[]): string {
  if (mentionNames.length === 0) return html;
  const escaped = mentionNames
    .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .sort((a, b) => b.length - a.length);
  if (escaped.length === 0) return html;
  const re = new RegExp(`(@(?:${escaped.join("|")}))`, "gi");
  const parts = html.split(/(<[^>]+>)/g);
  return parts
    .map((part) => {
      if (part.startsWith("<")) return part;
      return part.replace(
        re,
        '<span class="rounded bg-sky-500/15 px-0.5 font-medium text-sky-900 dark:text-sky-100">$1</span>',
      );
    })
    .join("");
}

export function RichTextView({
  value,
  mentionNames,
  className,
  emptyLabel,
}: {
  value: string;
  mentionNames?: string[];
  className?: string;
  emptyLabel?: string;
}) {
  const raw = value?.trim() ?? "";
  if (!raw) {
    return emptyLabel ? (
      <p className={cn("text-muted-foreground text-sm", className)}>
        {emptyLabel}
      </p>
    ) : null;
  }

  const html = isLikelyHtml(raw) ? raw : toEditorHtml(raw);
  const withMentions = highlightMentionsInHtml(html, mentionNames ?? []);

  return (
    <div
      className={cn(PROSE_CLASS, className)}
      dangerouslySetInnerHTML={{ __html: withMentions }}
    />
  );
}
