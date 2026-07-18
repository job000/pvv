"use client";

import { RichTextView } from "@/components/ui/rich-text-view";
import { isLikelyHtml, isLikelyMarkdown } from "@/lib/rich-text";
import { cn } from "@/lib/utils";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const mdClass = cn(
  "max-w-none text-sm leading-relaxed text-foreground",
  "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
);

const components: Components = {
  h1: ({ children }) => (
    <h1 className="mt-4 mb-2 text-lg font-semibold tracking-tight">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-3.5 mb-1.5 text-base font-semibold tracking-tight">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-3 mb-1 text-sm font-semibold tracking-tight">{children}</h3>
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
    <ol
      className={cn(
        "my-1.5 list-decimal space-y-0.5 pl-5",
        className,
      )}
    >
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
          isTask && "flex list-none items-start gap-2",
          className,
        )}
      >
        {children}
      </li>
    );
  },
  input: ({ type, checked }) => {
    if (type === "checkbox") {
      return (
        <input
          type="checkbox"
          defaultChecked={Boolean(checked)}
          disabled
          className="mt-1 size-3.5 shrink-0 rounded border-border accent-sky-600"
          aria-hidden
        />
      );
    }
    return null;
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
      <table className="w-full border-collapse text-left text-xs">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-border/50 bg-muted/40 px-2 py-1.5 font-semibold">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-border/40 px-2 py-1.5 align-top">{children}</td>
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

/** Render markdown (or legacy HTML) as modern readable content. */
export function MarkdownView({
  value,
  className,
  emptyLabel,
}: {
  value: string;
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

  // GitHub-markdown (sjekklister m.m.) skal aldri tvinges gjennom HTML-visning
  if (isLikelyHtml(raw) && !isLikelyMarkdown(raw)) {
    return <RichTextView value={raw} className={className} />;
  }

  return (
    <div className={cn(mdClass, className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {raw}
      </ReactMarkdown>
    </div>
  );
}
