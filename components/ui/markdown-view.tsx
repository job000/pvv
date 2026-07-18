"use client";

import { RichTextView } from "@/components/ui/rich-text-view";
import {
  normalizeMarkdownNewlines,
  toggleMarkdownTaskAtLine,
  toggleMarkdownTaskByLabel,
} from "@/lib/markdown-tasks";
import { isLikelyHtml, isLikelyMarkdown } from "@/lib/rich-text";
import { cn } from "@/lib/utils";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const mdClass = cn(
  "max-w-none text-sm leading-relaxed text-foreground",
  "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
);

function hastLine(node: unknown): number | null {
  if (!node || typeof node !== "object") return null;
  const pos = (node as { position?: { start?: { line?: number } } }).position;
  const line = pos?.start?.line;
  return typeof line === "number" && line >= 1 ? line : null;
}

function buildComponents(options: {
  interactive: boolean;
  source: string;
  onToggleTask?: (next: string) => void;
}): Components {
  const { interactive, source, onToggleTask } = options;

  return {
    h1: ({ children }) => (
      <h1 className="mt-4 mb-2 text-lg font-semibold tracking-tight">
        {children}
      </h1>
    ),
    h2: ({ children }) => (
      <h2 className="mt-3.5 mb-1.5 text-base font-semibold tracking-tight">
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className="mt-3 mb-1 text-sm font-semibold tracking-tight">
        {children}
      </h3>
    ),
    p: ({ children }) => <p className="my-1.5">{children}</p>,
    ul: ({ className, children }) => {
      const isTaskList = Boolean(
        className && /\bcontains-task-list\b/.test(className),
      );
      return (
        <ul
          className={cn(
            "my-1.5 space-y-1",
            isTaskList ? "list-none pl-0" : "list-disc pl-5",
            className,
          )}
        >
          {children}
        </ul>
      );
    },
    ol: ({ className, children }) => (
      <ol className={cn("my-1.5 list-decimal space-y-0.5 pl-5", className)}>
        {children}
      </ol>
    ),
    li: ({ className, children }) => {
      const isTask = Boolean(
        className && /\btask-list-item\b/.test(className),
      );
      return (
        <li
          className={cn(
            "leading-relaxed",
            isTask &&
              "flex list-none items-start gap-2 [&:has(input:checked)]:text-muted-foreground [&:has(input:checked)]:line-through",
            className,
          )}
        >
          {children}
        </li>
      );
    },
    input: ({ type, checked, node }) => {
      if (type !== "checkbox") return null;

      const isChecked = Boolean(checked);
      const line = hastLine(node);

      if (!interactive || !onToggleTask) {
        return (
          <input
            type="checkbox"
            checked={isChecked}
            disabled
            readOnly
            className="mt-1 size-3.5 shrink-0 rounded border-border accent-sky-600"
            aria-hidden
          />
        );
      }

      return (
        <input
          type="checkbox"
          checked={isChecked}
          onChange={(e) => {
            const li = e.currentTarget.closest("li");
            const label = (li?.textContent ?? "").replace(/\s+/g, " ").trim();

            // 1) Match by visible label — avoids index/line drift from remark
            const byLabel = toggleMarkdownTaskByLabel(
              source,
              label,
              isChecked,
            );
            if (byLabel !== source) {
              onToggleTask(byLabel);
              return;
            }

            // 2) Fallback: AST source line when label match fails
            if (line != null) {
              onToggleTask(toggleMarkdownTaskAtLine(source, line));
            }
          }}
          className="mt-1 size-3.5 shrink-0 cursor-pointer rounded border-border accent-sky-600 touch-manipulation"
          aria-label={isChecked ? "Fjern avkryssing" : "Kryss av"}
        />
      );
    },
    a: ({ href, children }) => {
      const isAttachment =
        typeof href === "string" && href.startsWith("attachment:");
      return (
        <a
          href={isAttachment ? undefined : href}
          target={isAttachment ? undefined : "_blank"}
          rel={isAttachment ? undefined : "noreferrer"}
          className="text-sky-700 underline underline-offset-2 hover:text-sky-800 dark:text-sky-300 dark:hover:text-sky-200"
          data-attachment-ref={
            isAttachment ? href.slice("attachment:".length) : undefined
          }
          onClick={
            isAttachment
              ? (e) => {
                  e.preventDefault();
                  const id = href.slice("attachment:".length);
                  document
                    .getElementById(`task-file-${id}`)
                    ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                }
              : undefined
          }
        >
          {children}
        </a>
      );
    },
    strong: ({ children }) => (
      <strong className="font-semibold text-foreground">{children}</strong>
    ),
    em: ({ children }) => <em className="italic">{children}</em>,
    del: ({ children }) => (
      <del className="text-muted-foreground line-through">{children}</del>
    ),
    code: ({ className, children }) => {
      const isBlock = Boolean(className?.includes("language-"));
      if (isBlock) {
        return <code className={className}>{children}</code>;
      }
      return (
        <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">
          {children}
        </code>
      );
    },
    pre: ({ children }) => (
      <pre className="my-2 overflow-x-auto rounded-lg border border-border/50 bg-muted/60 p-3 font-mono text-[0.8rem] leading-5">
        {children}
      </pre>
    ),
    blockquote: ({ children }) => (
      <blockquote className="my-2 border-l-2 border-sky-500/40 pl-3 text-muted-foreground">
        {children}
      </blockquote>
    ),
    hr: () => <hr className="my-3 border-border/60" />,
    table: ({ children }) => (
      <div className="my-2 overflow-x-auto">
        <table className="w-full border-collapse text-left text-xs">
          {children}
        </table>
      </div>
    ),
    th: ({ children }) => (
      <th className="border border-border/50 bg-muted/40 px-2 py-1.5 font-semibold">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="border border-border/40 px-2 py-1.5 align-top">
        {children}
      </td>
    ),
    img: ({ src, alt }) =>
      typeof src === "string" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt ?? ""}
          className="my-2 max-h-72 max-w-full rounded-lg border border-border/50"
        />
      ) : null,
  };
}

/** Render markdown (or legacy HTML) as modern readable content. */
export function MarkdownView({
  value,
  className,
  emptyLabel,
  onChange,
  disabled,
}: {
  value: string;
  className?: string;
  emptyLabel?: string;
  /** When set, GFM task-list checkboxes are clickable and update markdown. */
  onChange?: (next: string) => void;
  disabled?: boolean;
}) {
  const source = normalizeMarkdownNewlines(value ?? "");
  const interactive = Boolean(onChange) && !disabled;

  if (!source.trim()) {
    return emptyLabel ? (
      <p className={cn("text-muted-foreground text-sm", className)}>
        {emptyLabel}
      </p>
    ) : null;
  }

  // GitHub-markdown (sjekklister m.m.) skal aldri tvinges gjennom HTML-visning
  if (isLikelyHtml(source) && !isLikelyMarkdown(source)) {
    return <RichTextView value={source} className={className} />;
  }

  const components = buildComponents({
    interactive,
    source,
    onToggleTask: onChange,
  });

  return (
    <div className={cn(mdClass, className)}>
      {/* Same string for parse + toggle — no trim offset between view and source */}
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {source}
      </ReactMarkdown>
    </div>
  );
}
