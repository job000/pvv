"use client";

import { MarkdownView } from "@/components/ui/markdown-view";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/lib/app-toast";
import {
  collapseDataUrlImages,
  expandDataUrlImages,
  extractMarkdownImages,
  removeMarkdownImageAt,
} from "@/lib/markdown-images";
import {
  fileToCompressedDataUrl,
  htmlToPlainText,
  isLikelyHtml,
  isLikelyMarkdown,
} from "@/lib/rich-text";
import { cn } from "@/lib/utils";
import {
  Bold,
  CheckSquare,
  Eye,
  ImageIcon,
  Italic,
  Link2,
  List,
  Pencil,
  Type,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

type EditPane = "edit" | "preview";

/** Konverter eldre HTML-beskrivelser til redigerbar tekst. */
function toEditableText(value: string): string {
  const t = value ?? "";
  if (!t.trim()) return "";
  if (isLikelyHtml(t) && !isLikelyMarkdown(t)) {
    return htmlToPlainText(t);
  }
  return t;
}

function wrapSelection(
  value: string,
  start: number,
  end: number,
  before: string,
  after: string,
  placeholder = "tekst",
): { next: string; selectStart: number; selectEnd: number } {
  const selected = value.slice(start, end);
  const body = selected || placeholder;
  const next = value.slice(0, start) + before + body + after + value.slice(end);
  return {
    next,
    selectStart: start + before.length,
    selectEnd: start + before.length + body.length,
  };
}

function insertLinePrefix(
  value: string,
  start: number,
  end: number,
  prefix: string,
): { next: string; selectStart: number; selectEnd: number } {
  const lineStart = value.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
  const selected = value.slice(start, end);
  if (!selected.includes("\n") && start === end) {
    const next = value.slice(0, lineStart) + prefix + value.slice(lineStart);
    const cursor = start + prefix.length;
    return { next, selectStart: cursor, selectEnd: cursor };
  }
  const block = value.slice(lineStart, end);
  const lines = block.split("\n");
  const rewritten = lines
    .map((line) => (line.trim() ? `${prefix}${line}` : line))
    .join("\n");
  const next = value.slice(0, lineStart) + rewritten + value.slice(end);
  return {
    next,
    selectStart: lineStart,
    selectEnd: lineStart + rewritten.length,
  };
}

function ToolbarButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="text-muted-foreground hover:text-foreground inline-flex size-8 items-center justify-center rounded-md hover:bg-muted disabled:opacity-40"
    >
      {children}
    </button>
  );
}

/**
 * Beskrivelse for Puls-kort m.m.
 * Bilder lastes opp som filer (kort URL) når `onUploadImage` er satt —
 * ikke som lang base64 i tekstfeltet.
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
  startInEditMode = false,
  onCommit,
  /**
   * Last opp bilde til lagring og returner Markdown `![alt](url)`.
   * Anbefalt — unngår base64 i teksten.
   */
  onUploadImage,
}: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  className?: string;
  rows?: number;
  "aria-label"?: string;
  insertToken?: string | null;
  onInsertConsumed?: () => void;
  startInEditMode?: boolean;
  onCommit?: (next: string) => void | Promise<void>;
  onUploadImage?: (file: File) => Promise<string>;
}) {
  const [editing, setEditing] = useState(startInEditMode && !disabled);
  const [pane, setPane] = useState<EditPane>("edit");
  const [commitBusy, setCommitBusy] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const dataUrlsRef = useRef<string[]>([]);

  const [draft, setDraft] = useState(() => {
    const { display, dataUrls } = collapseDataUrlImages(value);
    dataUrlsRef.current = dataUrls;
    return display;
  });

  useEffect(() => {
    const { display, dataUrls } = collapseDataUrlImages(value);
    dataUrlsRef.current = dataUrls;
    setDraft(display);
  }, [value]);

  useEffect(() => {
    if (disabled) setEditing(false);
  }, [disabled]);

  const pushValue = useCallback(
    (display: string) => {
      setDraft(display);
      onChange(expandDataUrlImages(display, dataUrlsRef.current));
    },
    [onChange],
  );

  useEffect(() => {
    if (!insertToken) return;
    if (!editing) setEditing(true);
    setPane("edit");
    const token = insertToken.trim();
    pushValue(draft ? `${draft.replace(/\s*$/, "")}\n\n${token}` : token);
    onInsertConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to insertToken
  }, [insertToken]);

  const applyDescription = (next: string) => {
    if (disabled || commitBusy || next === value) return;
    onChange(next);
    if (!onCommit) return;
    setCommitBusy(true);
    void Promise.resolve(onCommit(next))
      .catch(() => {
        /* parent viser toast */
      })
      .finally(() => setCommitBusy(false));
  };

  const beginEdit = () => {
    const editable = toEditableText(value);
    if (editable !== value) onChange(editable);
    setPane("edit");
    setEditing(true);
  };

  const applyEdit = useCallback(
    (transform: (v: string, start: number, end: number) => {
      next: string;
      selectStart: number;
      selectEnd: number;
    }) => {
      const el = textareaRef.current;
      const start = el?.selectionStart ?? draft.length;
      const end = el?.selectionEnd ?? draft.length;
      const { next, selectStart, selectEnd } = transform(draft, start, end);
      pushValue(next);
      requestAnimationFrame(() => {
        const t = textareaRef.current;
        if (!t) return;
        t.focus();
        t.setSelectionRange(selectStart, selectEnd);
      });
    },
    [draft, pushValue],
  );

  const insertAtCursor = useCallback(
    (chunk: string) => {
      const el = textareaRef.current;
      const start = el?.selectionStart ?? draft.length;
      const end = el?.selectionEnd ?? draft.length;
      const padBefore =
        start > 0 && draft[start - 1] !== "\n" ? "\n\n" : start > 0 ? "\n" : "";
      const padAfter = end < draft.length && draft[end] !== "\n" ? "\n\n" : "\n";
      const insertion = `${padBefore}${chunk}${padAfter}`;
      const next = draft.slice(0, start) + insertion + draft.slice(end);
      const cursor = start + insertion.length;
      pushValue(next);
      requestAnimationFrame(() => {
        const t = textareaRef.current;
        if (!t) return;
        t.focus();
        t.setSelectionRange(cursor, cursor);
      });
    },
    [draft, pushValue],
  );

  const insertImageFile = useCallback(
    async (file: File) => {
      if (disabled || imageBusy) return;
      setImageBusy(true);
      try {
        const alt = (file.name || "bilde").replace(/[\[\]]/g, "");
        if (onUploadImage) {
          const markdown = await onUploadImage(file);
          insertAtCursor(
            markdown.trim().startsWith("![")
              ? markdown.trim()
              : `![${alt}](${markdown.trim()})`,
          );
        } else {
          // Fallback uten opplasting: skjul base64 bak plassholder i tekstfeltet
          const src = await fileToCompressedDataUrl(file);
          const i = dataUrlsRef.current.length;
          dataUrlsRef.current = [...dataUrlsRef.current, src];
          insertAtCursor(`![${alt}](puls-img:${i})`);
        }
        setPane("edit");
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Kunne ikke legge til bildet",
        );
      } finally {
        setImageBusy(false);
      }
    },
    [disabled, imageBusy, insertAtCursor, onUploadImage],
  );

  const images = useMemo(() => extractMarkdownImages(value), [value]);

  const shellClass = cn(
    "overflow-hidden rounded-xl border border-border/50 bg-muted/15",
    "focus-within:border-foreground/20 focus-within:bg-background focus-within:ring-1 focus-within:ring-foreground/10",
    disabled && "opacity-60",
    className,
  );

  if (!editing) {
    return (
      <div className={shellClass}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 bg-muted/25 px-2.5 py-1.5">
          <p className="text-muted-foreground text-xs font-medium">Visning</p>
          <div className="flex items-center gap-2">
            {!disabled ? (
              <p className="text-muted-foreground hidden text-[10px] sm:block">
                Kryss av i sjekklister · Rediger for å endre tekst
              </p>
            ) : null}
            {!disabled ? (
              <button
                type="button"
                onClick={beginEdit}
                className="text-foreground inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium hover:bg-muted"
              >
                <Pencil className="size-3" aria-hidden />
                Rediger
              </button>
            ) : null}
          </div>
        </div>
        <div className="min-h-[6rem] px-3.5 py-3">
          <MarkdownView
            value={value}
            emptyLabel="Ingen beskrivelse ennå. Trykk Rediger for å legge til."
            onChange={disabled ? undefined : applyDescription}
            disabled={disabled || commitBusy}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={shellClass}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 bg-muted/25 px-2 py-1">
        <div
          role="tablist"
          aria-label="Beskrivelse"
          className="bg-background/70 inline-flex rounded-lg border border-border/50 p-0.5"
        >
          {(
            [
              ["edit", "Rediger", Type],
              ["preview", "Forhåndsvis", Eye],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={pane === id}
              disabled={disabled}
              onClick={() => setPane(id)}
              className={cn(
                "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium",
                pane === id
                  ? "bg-foreground text-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-3" aria-hidden />
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {!startInEditMode ? (
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="text-muted-foreground hover:text-foreground inline-flex h-7 items-center rounded-md px-2 text-xs font-medium"
            >
              Ferdig
            </button>
          ) : null}
        </div>
      </div>

      {pane === "edit" ? (
        <>
          <div className="flex flex-wrap items-center gap-0.5 border-b border-border/30 px-1.5 py-1">
            <ToolbarButton
              label="Fet"
              disabled={disabled}
              onClick={() =>
                applyEdit((v, s, e) => wrapSelection(v, s, e, "**", "**", "fet"))
              }
            >
              <Bold className="size-3.5" />
            </ToolbarButton>
            <ToolbarButton
              label="Kursiv"
              disabled={disabled}
              onClick={() =>
                applyEdit((v, s, e) =>
                  wrapSelection(v, s, e, "*", "*", "kursiv"),
                )
              }
            >
              <Italic className="size-3.5" />
            </ToolbarButton>
            <ToolbarButton
              label="Punktliste"
              disabled={disabled}
              onClick={() =>
                applyEdit((v, s, e) => insertLinePrefix(v, s, e, "- "))
              }
            >
              <List className="size-3.5" />
            </ToolbarButton>
            <ToolbarButton
              label="Sjekkliste"
              disabled={disabled}
              onClick={() =>
                applyEdit((v, s, e) => insertLinePrefix(v, s, e, "- [ ] "))
              }
            >
              <CheckSquare className="size-3.5" />
            </ToolbarButton>
            <ToolbarButton
              label="Lenke"
              disabled={disabled}
              onClick={() =>
                applyEdit((v, s, e) =>
                  wrapSelection(v, s, e, "[", "](https://)", "lenketekst"),
                )
              }
            >
              <Link2 className="size-3.5" />
            </ToolbarButton>
            <ToolbarButton
              label={imageBusy ? "Legger inn bilde …" : "Bilde"}
              disabled={disabled || imageBusy}
              onClick={() => imageInputRef.current?.click()}
            >
              <ImageIcon className="size-3.5" />
            </ToolbarButton>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              tabIndex={-1}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void insertImageFile(file);
              }}
            />
            <p className="text-muted-foreground ml-1 hidden text-[10px] sm:block">
              {onUploadImage
                ? "Bilder lastes opp som fil — vises som bilde, ikke base64"
                : "Lim inn / slipp bilde · lagres kompakt i teksten"}
            </p>
          </div>

          {images.length > 0 ? (
            <div className="border-b border-border/30 px-3 py-2">
              <p className="text-muted-foreground mb-1.5 text-[10px] font-medium">
                Bilder i beskrivelsen
              </p>
              <ul className="flex flex-wrap gap-2">
                {images.map((img, i) => (
                  <li
                    key={`${img.index}-${i}`}
                    className="group relative size-16 overflow-hidden rounded-lg border border-border/50 bg-muted/30"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.src}
                      alt={img.alt || "Bilde"}
                      className="size-full object-cover"
                    />
                    {!disabled ? (
                      <button
                        type="button"
                        className="absolute right-0.5 top-0.5 inline-flex size-6 items-center justify-center rounded-md bg-background/90 text-foreground shadow-sm opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                        title="Fjern bilde"
                        aria-label="Fjern bilde"
                        onClick={() => {
                          onChange(removeMarkdownImageAt(value, i));
                        }}
                      >
                        <X className="size-3.5" />
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <Textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => pushValue(e.target.value)}
            disabled={disabled}
            placeholder={
              "Skriv fritt — vanlig tekst fungerer.\n\nEksempler:\nDette er en vanlig setning.\n\n**fet** og *kursiv*\n- punkt\n- [ ] sjekkliste\n\nTips: bruk bilde-knappen (ikke lim inn som base64)."
            }
            rows={rows + 2}
            aria-label={ariaLabel}
            onPaste={(e) => {
              const items = e.clipboardData?.items;
              if (!items) return;
              for (const item of items) {
                if (item.kind === "file" && item.type.startsWith("image/")) {
                  const file = item.getAsFile();
                  if (!file) continue;
                  e.preventDefault();
                  void insertImageFile(file);
                  return;
                }
              }
            }}
            onDragOver={(e) => {
              if ([...e.dataTransfer.types].includes("Files")) {
                e.preventDefault();
              }
            }}
            onDrop={(e) => {
              const file = e.dataTransfer.files?.[0];
              if (!file?.type.startsWith("image/")) return;
              e.preventDefault();
              void insertImageFile(file);
            }}
            className="min-h-[10rem] resize-y rounded-none border-0 bg-transparent px-3.5 py-3 text-sm leading-6 shadow-none focus-visible:ring-0"
          />
        </>
      ) : (
        <div className="min-h-[10rem] px-3.5 py-3">
          <MarkdownView
            value={value}
            emptyLabel="Ingenting å forhåndsvise ennå."
            onChange={disabled ? undefined : applyDescription}
            disabled={disabled || commitBusy}
          />
        </div>
      )}
    </div>
  );
}
