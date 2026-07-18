"use client";

import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "@/lib/app-toast";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import {
  Download,
  FileSpreadsheet,
  FileText,
  ImageIcon,
  Link2,
  Paperclip,
  Trash2,
  Upload,
} from "lucide-react";
import { useRef, useState } from "react";

const ACCEPT =
  ".png,.jpg,.jpeg,.gif,.webp,.svg,.pdf,.txt,.md,.csv,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.odp,.rtf,.json,.xml,.zip,image/*,text/*,application/pdf";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function FileGlyph({
  contentType,
  fileName,
}: {
  contentType: string;
  fileName: string;
}) {
  if (contentType.startsWith("image/")) {
    return <ImageIcon className="size-3.5 shrink-0 opacity-70" aria-hidden />;
  }
  const lower = fileName.toLowerCase();
  if (
    lower.endsWith(".xlsx") ||
    lower.endsWith(".xls") ||
    lower.endsWith(".csv") ||
    contentType.includes("spreadsheet") ||
    contentType.includes("excel")
  ) {
    return (
      <FileSpreadsheet className="size-3.5 shrink-0 opacity-70" aria-hidden />
    );
  }
  return <FileText className="size-3.5 shrink-0 opacity-70" aria-hidden />;
}

export type PendingUpload = {
  localId: string;
  fileName: string;
  storageId: Id<"_storage">;
};

/** Oppgavefiler (beskrivelse) eller kommentarfiler. */
export function TaskFileAttachments({
  taskId,
  noteId,
  canEdit,
  compact,
  /** Lokale opplastinger før kommentar er lagret */
  pending,
  onPendingChange,
  /** Sett inn referanse i beskrivelse/kommentar */
  onInsertRef,
}: {
  taskId: Id<"assessmentTasks">;
  noteId?: Id<"assessmentTaskNotes">;
  canEdit: boolean;
  compact?: boolean;
  pending?: PendingUpload[];
  onPendingChange?: (next: PendingUpload[]) => void;
  onInsertRef?: (markdown: string) => void;
}) {
  const files = useQuery(api.assessmentTaskFiles.listByTask, { taskId });
  const generateUploadUrl = useMutation(
    api.assessmentTaskFiles.generateUploadUrl,
  );
  const attach = useMutation(api.assessmentTaskFiles.attach);
  const remove = useMutation(api.assessmentTaskFiles.remove);
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const saved = (files ?? []).filter((f) =>
    noteId ? f.noteId === noteId : f.noteId === null,
  );

  const uploadOne = async (file: File) => {
    const postUrl = await generateUploadUrl({ taskId });
    const res = await fetch(postUrl, {
      method: "POST",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: file,
    });
    if (!res.ok) throw new Error("Opplasting feilet");
    const json = (await res.json()) as { storageId: Id<"_storage"> };

    // Pending mode: hold until comment is posted
    if (pending !== undefined && onPendingChange) {
      onPendingChange([
        ...pending,
        {
          localId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          fileName: file.name,
          storageId: json.storageId,
        },
      ]);
      return;
    }

    await attach({
      taskId,
      noteId,
      storageId: json.storageId,
      fileName: file.name,
    });
  };

  const onPick = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    setBusy(true);
    try {
      for (const file of Array.from(list)) {
        await uploadOne(file);
      }
      toast.success(list.length > 1 ? "Filer lastet opp" : "Fil lastet opp");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Kunne ikke laste opp");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const showList = saved.length > 0 || (pending?.length ?? 0) > 0;

  if (!canEdit && !showList) return null;

  return (
    <div className={cn("space-y-2", compact && "space-y-1.5")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
          <Paperclip className="size-3.5" aria-hidden />
          Vedlegg
          {showList ? (
            <span className="tabular-nums">
              ({saved.length + (pending?.length ?? 0)})
            </span>
          ) : null}
        </p>
        {canEdit ? (
          <>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-xs"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="size-3.5" aria-hidden />
              Last opp
            </Button>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept={ACCEPT}
              className="sr-only"
              tabIndex={-1}
              onChange={(e) => void onPick(e.target.files)}
            />
          </>
        ) : null}
      </div>

      {showList ? (
        <ul className="space-y-1.5">
          {saved.map((f) => (
            <li
              key={f._id}
              id={`task-file-${f._id}`}
              className="bg-muted/20 flex min-w-0 items-center gap-2 rounded-lg border border-border/40 px-2.5 py-2"
            >
              {f.isImage && f.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={f.url}
                  alt=""
                  className="size-9 shrink-0 rounded-md object-cover"
                />
              ) : (
                <span className="bg-muted flex size-9 shrink-0 items-center justify-center rounded-md">
                  <FileGlyph
                    contentType={f.contentType}
                    fileName={f.fileName}
                  />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">{f.fileName}</p>
                <p className="text-muted-foreground text-[10px] tabular-nums">
                  {formatBytes(f.sizeBytes)}
                </p>
              </div>
              {onInsertRef ? (
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground inline-flex size-8 items-center justify-center rounded-md"
                  title="Sett inn i tekst"
                  onClick={() => {
                    if (f.isImage && f.url) {
                      onInsertRef(`![${f.fileName}](${f.url})`);
                    } else if (f.url) {
                      onInsertRef(`[📎 ${f.fileName}](${f.url})`);
                    } else {
                      onInsertRef(
                        `[📎 ${f.fileName}](attachment:${f._id})`,
                      );
                    }
                    toast.success("Referanse satt inn i teksten");
                  }}
                >
                  <Link2 className="size-3.5" aria-hidden />
                </button>
              ) : null}
              {f.url ? (
                <a
                  href={f.url}
                  target="_blank"
                  rel="noreferrer"
                  download={f.fileName}
                  className="text-muted-foreground hover:text-foreground inline-flex size-8 items-center justify-center rounded-md"
                  title="Last ned"
                >
                  <Download className="size-3.5" aria-hidden />
                </a>
              ) : null}
              {canEdit ? (
                <button
                  type="button"
                  className="text-muted-foreground hover:text-destructive inline-flex size-8 items-center justify-center rounded-md"
                  title="Fjern"
                  disabled={busy}
                  onClick={() => {
                    if (!window.confirm(`Slette «${f.fileName}»?`)) return;
                    setBusy(true);
                    void remove({ fileId: f._id })
                      .then(() => toast.success("Fil slettet"))
                      .catch((err: unknown) =>
                        toast.error(
                          err instanceof Error
                            ? err.message
                            : "Kunne ikke slette",
                        ),
                      )
                      .finally(() => setBusy(false));
                  }}
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </button>
              ) : null}
            </li>
          ))}
          {(pending ?? []).map((p) => (
            <li
              key={p.localId}
              className="bg-sky-500/5 flex min-w-0 items-center gap-2 rounded-lg border border-sky-500/25 px-2.5 py-2"
            >
              <span className="bg-muted flex size-9 shrink-0 items-center justify-center rounded-md">
                <FileText className="size-3.5 opacity-70" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">{p.fileName}</p>
                <p className="text-muted-foreground text-[10px]">
                  Klar til å sendes med kommentaren
                </p>
              </div>
              {onPendingChange && pending ? (
                <button
                  type="button"
                  className="text-muted-foreground hover:text-destructive inline-flex size-8 items-center justify-center rounded-md"
                  title="Fjern"
                  onClick={() =>
                    onPendingChange(
                      pending.filter((x) => x.localId !== p.localId),
                    )
                  }
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-[11px]">
          Bilder, PDF, Word, Excel, tekst m.m. (maks 15 MB).
        </p>
      )}
    </div>
  );
}

/** After creating a comment, attach pending uploads to the note. */
export async function attachPendingToNote(
  attachFn: (args: {
    taskId: Id<"assessmentTasks">;
    noteId: Id<"assessmentTaskNotes">;
    storageId: Id<"_storage">;
    fileName: string;
  }) => Promise<Id<"assessmentTaskFiles">>,
  taskId: Id<"assessmentTasks">,
  noteId: Id<"assessmentTaskNotes">,
  pending: PendingUpload[],
) {
  for (const p of pending) {
    await attachFn({
      taskId,
      noteId,
      storageId: p.storageId,
      fileName: p.fileName,
    });
  }
}
