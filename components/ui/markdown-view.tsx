"use client";

import { RichTextView } from "@/components/ui/rich-text-view";
import {
  normalizeMarkdownNewlines,
  toggleMarkdownTaskAtLine,
  toggleMarkdownTaskByLabel,
} from "@/lib/markdown-tasks";
import { isLikelyHtml, isLikelyMarkdown } from "@/lib/rich-text";
import { cn } from "@/lib/utils";
import { ListTree, SquareKanban } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type TouchEvent as ReactTouchEvent,
} from "react";
import { createPortal } from "react-dom";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const mdClass = cn(
  "max-w-none text-sm leading-relaxed text-foreground",
  "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
);

export type PromoteChecklistItem = {
  label: string;
  checked: boolean;
  asSub: boolean;
};

type TaskMenuState = {
  x: number;
  y: number;
  label: string;
  checked: boolean;
};

function hastLine(node: unknown): number | null {
  if (!node || typeof node !== "object") return null;
  const pos = (node as { position?: { start?: { line?: number } } }).position;
  const line = pos?.start?.line;
  return typeof line === "number" && line >= 1 ? line : null;
}

function taskLabelFromLi(li: Element | null): string {
  return (li?.textContent ?? "").replace(/\s+/g, " ").trim();
}

function buildComponents(options: {
  interactive: boolean;
  source: string;
  onToggleTask?: (next: string) => void;
  onOpenTaskMenu?: (menu: TaskMenuState) => void;
}): Components {
  const { interactive, source, onToggleTask, onOpenTaskMenu } = options;
  const canPromote = Boolean(onOpenTaskMenu);

  const openMenuFromEvent = (
    e: ReactMouseEvent | ReactTouchEvent,
    li: Element | null,
    checked: boolean,
  ) => {
    if (!onOpenTaskMenu || !li) return;
    const label = taskLabelFromLi(li);
    if (!label) return;
    const point =
      "clientX" in e
        ? { x: e.clientX, y: e.clientY }
        : e.touches[0]
          ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
          : e.changedTouches[0]
            ? {
                x: e.changedTouches[0].clientX,
                y: e.changedTouches[0].clientY,
              }
            : null;
    if (!point) return;
    onOpenTaskMenu({ ...point, label, checked });
  };

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
    li: ({ className, children, node }) => {
      const isTask = Boolean(
        className && /\btask-list-item\b/.test(className),
      );
      const checkedFromClass = Boolean(
        className && /\btask-list-item-checked\b/.test(className),
      );

      if (!isTask || !canPromote) {
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
      }

      return (
        <li
          className={cn(
            "leading-relaxed",
            "flex list-none items-start gap-2 [&:has(input:checked)]:text-muted-foreground [&:has(input:checked)]:line-through",
            "rounded-md px-0.5 -mx-0.5",
            className,
          )}
          data-task-line={hastLine(node) ?? undefined}
          onContextMenu={(e) => {
            e.preventDefault();
            const input = e.currentTarget.querySelector<HTMLInputElement>(
              'input[type="checkbox"]',
            );
            openMenuFromEvent(
              e,
              e.currentTarget,
              input?.checked ?? checkedFromClass,
            );
          }}
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
          onContextMenu={
            canPromote
              ? (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  openMenuFromEvent(
                    e,
                    e.currentTarget.closest("li"),
                    isChecked,
                  );
                }
              : undefined
          }
          onChange={(e) => {
            const li = e.currentTarget.closest("li");
            const label = taskLabelFromLi(li);

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
  onPromoteChecklistItem,
}: {
  value: string;
  className?: string;
  emptyLabel?: string;
  /** When set, GFM task-list checkboxes are clickable and update markdown. */
  onChange?: (next: string) => void;
  disabled?: boolean;
  /** Right-click / long-press on a checklist item to turn it into a card. */
  onPromoteChecklistItem?: (item: PromoteChecklistItem) => void;
}) {
  const source = normalizeMarkdownNewlines(value ?? "");
  const interactive = Boolean(onChange) && !disabled;
  const canPromote = Boolean(onPromoteChecklistItem) && !disabled;
  const [menu, setMenu] = useState<TaskMenuState | null>(null);
  const [mounted, setMounted] = useState(false);
  const longPressRef = useRef<{
    timer: number;
    x: number;
    y: number;
    label: string;
    checked: boolean;
  } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [menu]);

  const openTaskMenu = useCallback((next: TaskMenuState) => {
    setMenu(next);
  }, []);

  const clearLongPress = useCallback(() => {
    if (longPressRef.current) {
      window.clearTimeout(longPressRef.current.timer);
      longPressRef.current = null;
    }
  }, []);

  const onTouchStartCapture = useCallback(
    (e: ReactTouchEvent<HTMLDivElement>) => {
      if (!canPromote) return;
      const target = e.target as HTMLElement | null;
      const li = target?.closest?.("li.task-list-item") as HTMLElement | null;
      if (!li || !rootRef.current?.contains(li)) return;
      const touch = e.touches[0];
      if (!touch) return;
      const input = li.querySelector<HTMLInputElement>('input[type="checkbox"]');
      const label = taskLabelFromLi(li);
      if (!label) return;
      clearLongPress();
      longPressRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        label,
        checked: input?.checked ?? false,
        timer: window.setTimeout(() => {
          const pending = longPressRef.current;
          longPressRef.current = null;
          if (!pending) return;
          openTaskMenu({
            x: pending.x,
            y: pending.y,
            label: pending.label,
            checked: pending.checked,
          });
        }, 480),
      };
    },
    [canPromote, clearLongPress, openTaskMenu],
  );

  const onTouchMoveCapture = useCallback(
    (e: ReactTouchEvent<HTMLDivElement>) => {
      const pending = longPressRef.current;
      if (!pending) return;
      const touch = e.touches[0];
      if (!touch) return;
      if (
        Math.abs(touch.clientX - pending.x) > 10 ||
        Math.abs(touch.clientY - pending.y) > 10
      ) {
        clearLongPress();
      }
    },
    [clearLongPress],
  );

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
    onOpenTaskMenu: canPromote ? openTaskMenu : undefined,
  });

  const menuStyle = menu
    ? {
        left: Math.max(8, Math.min(menu.x, window.innerWidth - 240)),
        top: Math.max(8, Math.min(menu.y, window.innerHeight - 140)),
      }
    : undefined;

  return (
    <div
      ref={rootRef}
      className={cn(mdClass, className)}
      onTouchStartCapture={canPromote ? onTouchStartCapture : undefined}
      onTouchEndCapture={canPromote ? clearLongPress : undefined}
      onTouchCancelCapture={canPromote ? clearLongPress : undefined}
      onTouchMoveCapture={canPromote ? onTouchMoveCapture : undefined}
    >
      {/* Same string for parse + toggle — no trim offset between view and source */}
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {source}
      </ReactMarkdown>

      {mounted && menu && onPromoteChecklistItem
        ? createPortal(
            <div
              role="menu"
              aria-label="Sjekkpunkt"
              className="bg-background border-border/70 fixed z-[300] min-w-[13.5rem] overflow-hidden rounded-xl border shadow-2xl"
              style={menuStyle}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <p className="text-muted-foreground border-b border-border/50 px-3 py-2 text-[11px] leading-snug">
                <span className="text-foreground font-medium">
                  {menu.label.length > 48
                    ? `${menu.label.slice(0, 48)}…`
                    : menu.label}
                </span>
              </p>
              <button
                type="button"
                role="menuitem"
                className="hover:bg-muted/70 flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm touch-manipulation"
                onClick={() => {
                  onPromoteChecklistItem({
                    label: menu.label,
                    checked: menu.checked,
                    asSub: true,
                  });
                  setMenu(null);
                }}
              >
                <ListTree className="size-4 shrink-0 opacity-70" aria-hidden />
                Opprett som delkort
              </button>
              <button
                type="button"
                role="menuitem"
                className="hover:bg-muted/70 flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm touch-manipulation"
                onClick={() => {
                  onPromoteChecklistItem({
                    label: menu.label,
                    checked: menu.checked,
                    asSub: false,
                  });
                  setMenu(null);
                }}
              >
                <SquareKanban
                  className="size-4 shrink-0 opacity-70"
                  aria-hidden
                />
                Opprett som kort
              </button>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
