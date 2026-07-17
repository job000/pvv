"use client";

import { cn } from "@/lib/utils";
import {
  fileToCompressedDataUrl,
  toEditorHtml,
} from "@/lib/rich-text";
import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Highlighter,
  ImageIcon,
  Italic,
  List,
  ListOrdered,
  Underline as UnderlineIcon,
} from "lucide-react";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

type Props = {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  /** Approximate height hint (maps to min-height). */
  rows?: number;
  "aria-label"?: string;
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

export function RichTextEditor({
  value,
  onChange,
  disabled,
  placeholder = "Skriv her…",
  className,
  rows = 4,
  "aria-label": ariaLabel,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastEmitted = useRef(value);

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
      Image.configure({
        allowBase64: true,
        HTMLAttributes: {
          class: "rich-text-image",
        },
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: toEditorHtml(value),
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
                const node = schema.nodes.image?.create({ src, alt: "Bilde" });
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

  const insertImage = async (file: File) => {
    if (!editor) return;
    try {
      const src = await fileToCompressedDataUrl(file);
      editor.chain().focus().setImage({ src, alt: file.name || "Bilde" }).run();
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
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border/40 bg-muted/25 px-1.5 py-1">
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
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
