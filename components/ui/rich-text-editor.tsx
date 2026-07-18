"use client";

import { cn } from "@/lib/utils";
import {
  fileToCompressedDataUrl,
  htmlToPlainText,
  toEditorHtml,
} from "@/lib/rich-text";
import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Highlighter,
  ImageIcon,
  Italic,
  List,
  ListOrdered,
  Smile,
  Underline as UnderlineIcon,
} from "lucide-react";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

const QUICK_EMOJIS = [
  "😀",
  "🙂",
  "😂",
  "🙌",
  "👍",
  "👎",
  "❤️",
  "🔥",
  "✅",
  "❌",
  "⚠️",
  "💡",
  "📌",
  "🚀",
  "👀",
  "🎉",
];

type Props = {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  /** Approximate height hint (maps to min-height). */
  rows?: number;
  "aria-label"?: string;
  /** Hide image insert (useful for comments with size limits). */
  allowImages?: boolean;
  /** Slightly denser toolbar for compact surfaces. */
  compact?: boolean;
  autoFocus?: boolean;
};

export type RichTextEditorHandle = {
  getEditor: () => Editor | null;
  getPlainText: () => string;
  /** Replace trailing `@query` with `@label ` and focus. */
  replaceTrailingMention: (query: string, label: string) => void;
  focus: () => void;
};

function minHeightForRows(rows: number): string {
  if (rows <= 1) return "min-h-[3.25rem]";
  if (rows <= 2) return "min-h-[5.5rem]";
  if (rows <= 4) return "min-h-[8rem]";
  if (rows <= 6) return "min-h-[10.5rem]";
  return "min-h-[13rem]";
}

function ToolbarButton({
  active,
  disabled,
  label,
  onClick,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors",
        "hover:bg-muted hover:text-foreground",
        "disabled:pointer-events-none disabled:opacity-40",
        active && "bg-muted text-foreground",
      )}
    >
      {children}
    </button>
  );
}

export const RichTextEditor = forwardRef<RichTextEditorHandle, Props>(
  function RichTextEditor(
    {
      value,
      onChange,
      disabled,
      placeholder = "Skriv her…",
      className,
      rows = 4,
      "aria-label": ariaLabel,
      allowImages = true,
      compact = false,
      autoFocus = false,
    },
    ref,
  ) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const lastEmitted = useRef(value);
    const [emojiOpen, setEmojiOpen] = useState(false);
    const emojiWrapRef = useRef<HTMLDivElement>(null);

    const editor = useEditor({
      immediatelyRender: false,
      editable: !disabled,
      extensions: [
        StarterKit.configure({
          heading: false,
          codeBlock: false,
          code: false,
          blockquote: false,
          horizontalRule: false,
        }),
        Underline,
        Highlight.configure({
          multicolor: false,
          HTMLAttributes: {
            class: "rich-text-highlight",
          },
        }),
        ...(allowImages
          ? [
              Image.configure({
                allowBase64: true,
                HTMLAttributes: {
                  class: "rich-text-image",
                },
              }),
            ]
          : []),
        Placeholder.configure({ placeholder }),
      ],
      content: toEditorHtml(value),
      autofocus: autoFocus ? "end" : false,
      editorProps: {
        attributes: {
          class: cn(
            "prose prose-sm dark:prose-invert max-w-none px-3.5 py-2.5 text-sm leading-6 outline-none",
            "[&_p]:my-1 [&_ul]:my-1.5 [&_ol]:my-1.5 [&_li]:my-0.5",
            "[&_mark.rich-text-highlight]:rounded-sm [&_mark.rich-text-highlight]:bg-amber-200/90 [&_mark.rich-text-highlight]:px-0.5 [&_mark.rich-text-highlight]:text-foreground",
            "dark:[&_mark.rich-text-highlight]:bg-amber-400/35",
            "[&_img.rich-text-image]:my-2 [&_img.rich-text-image]:max-h-64 [&_img.rich-text-image]:max-w-full [&_img.rich-text-image]:rounded-md [&_img.rich-text-image]:border [&_img.rich-text-image]:border-border/50",
            minHeightForRows(rows),
          ),
          ...(ariaLabel ? { "aria-label": ariaLabel } : {}),
        },
        handlePaste(view, event) {
          if (!allowImages) return false;
          const items = event.clipboardData?.items;
          if (!items) return false;
          for (const item of items) {
            if (item.type.startsWith("image/")) {
              event.preventDefault();
              const file = item.getAsFile();
              if (!file) return true;
              void fileToCompressedDataUrl(file)
                .then((src) => {
                  const { schema } = view.state;
                  const node = schema.nodes.image?.create({
                    src,
                    alt: "Bilde",
                  });
                  if (!node) return;
                  const tr = view.state.tr.replaceSelectionWith(node);
                  view.dispatch(tr);
                })
                .catch(() => {
                  toast.error("Kunne ikke lime inn bildet");
                });
              return true;
            }
          }
          return false;
        },
      },
      onUpdate: ({ editor: ed }) => {
        const html = ed.isEmpty ? "" : ed.getHTML();
        lastEmitted.current = html;
        onChange(html);
      },
    });

    useImperativeHandle(
      ref,
      () => ({
        getEditor: () => editor,
        getPlainText: () => {
          if (!editor) return "";
          return editor.getText({ blockSeparator: "\n" });
        },
        replaceTrailingMention: (query: string, label: string) => {
          if (!editor) return;
          const { from } = editor.state.selection;
          const textBefore = editor.state.doc.textBetween(
            Math.max(0, from - (query.length + 1)),
            from,
            "\n",
            "\n",
          );
          const needle = `@${query}`;
          if (!textBefore.endsWith(needle) && textBefore !== needle) {
            editor
              .chain()
              .focus()
              .insertContent(`@${label} `)
              .run();
            return;
          }
          const start = from - needle.length;
          editor
            .chain()
            .focus()
            .deleteRange({ from: start, to: from })
            .insertContent(`@${label} `)
            .run();
        },
        focus: () => {
          editor?.chain().focus("end").run();
        },
      }),
      [editor],
    );

    useEffect(() => {
      if (!editor) return;
      editor.setEditable(!disabled);
    }, [editor, disabled]);

    useEffect(() => {
      if (!editor) return;
      if (value === lastEmitted.current) return;
      const next = toEditorHtml(value);
      const current = editor.isEmpty ? "" : editor.getHTML();
      if (next === current) return;
      editor.commands.setContent(next, { emitUpdate: false });
      lastEmitted.current = value;
    }, [editor, value]);

    useEffect(() => {
      if (!emojiOpen) return;
      const onDoc = (e: MouseEvent) => {
        if (!emojiWrapRef.current?.contains(e.target as Node)) {
          setEmojiOpen(false);
        }
      };
      document.addEventListener("mousedown", onDoc);
      return () => document.removeEventListener("mousedown", onDoc);
    }, [emojiOpen]);

    const insertImage = async (file: File) => {
      if (!editor || !allowImages) return;
      try {
        const src = await fileToCompressedDataUrl(file);
        editor
          .chain()
          .focus()
          .setImage({ src, alt: file.name || "Bilde" })
          .run();
      } catch {
        toast.error("Kunne ikke legge til bildet");
      }
    };

    return (
      <div
        className={cn(
          "overflow-hidden rounded-xl border border-border/50 bg-muted/15 transition-colors",
          "focus-within:border-foreground/20 focus-within:bg-background focus-within:ring-1 focus-within:ring-foreground/10",
          disabled && "opacity-60",
          className,
        )}
      >
        <div
          className={cn(
            "flex flex-wrap items-center gap-0.5 border-b border-border/40 bg-muted/25 px-1.5 py-1",
            compact && "py-0.5",
          )}
        >
          <ToolbarButton
            label="Fet"
            disabled={disabled || !editor}
            active={editor?.isActive("bold")}
            onClick={() => editor?.chain().focus().toggleBold().run()}
          >
            <Bold className="size-3.5" aria-hidden />
          </ToolbarButton>
          <ToolbarButton
            label="Kursiv"
            disabled={disabled || !editor}
            active={editor?.isActive("italic")}
            onClick={() => editor?.chain().focus().toggleItalic().run()}
          >
            <Italic className="size-3.5" aria-hidden />
          </ToolbarButton>
          <ToolbarButton
            label="Understrek"
            disabled={disabled || !editor}
            active={editor?.isActive("underline")}
            onClick={() => editor?.chain().focus().toggleUnderline().run()}
          >
            <UnderlineIcon className="size-3.5" aria-hidden />
          </ToolbarButton>
          <ToolbarButton
            label="Gul markering"
            disabled={disabled || !editor}
            active={editor?.isActive("highlight")}
            onClick={() => editor?.chain().focus().toggleHighlight().run()}
          >
            <Highlighter className="size-3.5" aria-hidden />
          </ToolbarButton>
          <span className="mx-1 h-4 w-px bg-border/60" aria-hidden />
          <ToolbarButton
            label="Punktliste"
            disabled={disabled || !editor}
            active={editor?.isActive("bulletList")}
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
          >
            <List className="size-3.5" aria-hidden />
          </ToolbarButton>
          <ToolbarButton
            label="Nummerert liste"
            disabled={disabled || !editor}
            active={editor?.isActive("orderedList")}
            onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          >
            <ListOrdered className="size-3.5" aria-hidden />
          </ToolbarButton>
          <span className="mx-1 h-4 w-px bg-border/60" aria-hidden />
          <div ref={emojiWrapRef} className="relative">
            <ToolbarButton
              label="Emoji"
              disabled={disabled || !editor}
              active={emojiOpen}
              onClick={() => setEmojiOpen((o) => !o)}
            >
              <Smile className="size-3.5" aria-hidden />
            </ToolbarButton>
            {emojiOpen ? (
              <div className="border-border/60 bg-popover absolute top-full left-0 z-50 mt-1 grid w-[13.5rem] grid-cols-8 gap-0.5 rounded-xl border p-1.5 shadow-lg">
                {QUICK_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className="hover:bg-muted flex size-7 items-center justify-center rounded-md text-base"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      editor?.chain().focus().insertContent(emoji).run();
                      setEmojiOpen(false);
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          {allowImages ? (
            <>
              <ToolbarButton
                label="Sett inn bilde"
                disabled={disabled || !editor}
                onClick={() => fileInputRef.current?.click()}
              >
                <ImageIcon className="size-3.5" aria-hidden />
              </ToolbarButton>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="sr-only"
                tabIndex={-1}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void insertImage(file);
                }}
              />
            </>
          ) : null}
        </div>
        <EditorContent editor={editor} />
      </div>
    );
  },
);

/** Convenience re-export for callers that already import this module. */
export { htmlToPlainText };
