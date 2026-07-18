"use client";

import {
  CommentComposer,
  renderBodyWithMentions,
} from "@/components/workspace/assessment-comment-threads";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "@/lib/app-toast";
import { useMutation, useQuery } from "convex/react";
import { CornerDownRight, MessageSquare } from "lucide-react";
import { useMemo, useState } from "react";

type MemberOption = {
  userId: Id<"users">;
  label: string;
};

type NoteRow = {
  _id: Id<"assessmentTaskNotes">;
  body: string;
  createdAt: number;
  authorName: string;
  parentNoteId?: Id<"assessmentTaskNotes">;
  mentionedNames: string[];
};

export function AssessmentTaskCommentThreads({
  workspaceId,
  taskId,
}: {
  workspaceId: Id<"workspaces">;
  taskId: Id<"assessmentTasks">;
}) {
  const members = useQuery(api.workspaces.listMembers, { workspaceId });
  const notes = useQuery(api.assessmentTaskNotes.listByTask, { taskId });
  const addNote = useMutation(api.assessmentTaskNotes.add);
  const [busy, setBusy] = useState(false);
  const [replyTo, setReplyTo] = useState<Id<"assessmentTaskNotes"> | null>(
    null,
  );

  const memberOptions = useMemo((): MemberOption[] => {
    return (members ?? [])
      .map((m) => ({
        userId: m.userId as Id<"users">,
        label: m.name?.trim() || m.email || "Medlem",
      }))
      .sort((a, b) => a.label.localeCompare(b.label, "nb"));
  }, [members]);

  const threads = useMemo(() => {
    const rows = (notes ?? []) as NoteRow[];
    const roots = rows
      .filter((n) => !n.parentNoteId)
      .sort((a, b) => b.createdAt - a.createdAt);
    return roots.map((root) => ({
      root,
      replies: rows
        .filter((n) => n.parentNoteId === root._id)
        .sort((a, b) => a.createdAt - b.createdAt),
    }));
  }, [notes]);

  const post = async (
    body: string,
    mentionedUserIds: Id<"users">[],
    parentNoteId?: Id<"assessmentTaskNotes">,
  ) => {
    setBusy(true);
    try {
      await addNote({
        taskId,
        body,
        mentionedUserIds:
          mentionedUserIds.length > 0 ? mentionedUserIds : undefined,
        parentNoteId,
      });
      setReplyTo(null);
      toast.success(parentNoteId ? "Svar sendt" : "Kommentar lagret");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kunne ikke lagre");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide">
        <MessageSquare className="size-3.5" aria-hidden />
        Kommentarer
      </p>
      <p className="text-muted-foreground text-[11px] leading-relaxed">
        Bruk <span className="font-medium">@</span> for å tagge. Taggede og
        tildelte på saken får varsel.
      </p>

      {notes === undefined ? (
        <p className="text-muted-foreground text-sm">Laster …</p>
      ) : threads.length === 0 ? (
        <p className="text-muted-foreground text-sm">Ingen kommentarer ennå.</p>
      ) : (
        <ul className="space-y-3">
          {threads.map(({ root, replies }) => (
            <li
              key={root._id}
              className="rounded-xl border border-border/40 bg-card/80 px-3 py-2.5"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-medium">{root.authorName}</p>
                <p className="text-muted-foreground text-[11px] tabular-nums">
                  {new Date(root.createdAt).toLocaleString("nb-NO")}
                </p>
              </div>
              <p className="mt-1 text-sm leading-relaxed">
                {renderBodyWithMentions(root.body, root.mentionedNames)}
              </p>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground mt-2 inline-flex items-center gap-1 text-xs font-medium"
                onClick={() =>
                  setReplyTo((prev) => (prev === root._id ? null : root._id))
                }
              >
                <CornerDownRight className="size-3" aria-hidden />
                Svar
                {replies.length > 0 ? ` (${replies.length})` : ""}
              </button>

              {replies.length > 0 ? (
                <ul className="border-border/40 mt-2 space-y-2 border-l-2 pl-3">
                  {replies.map((r) => (
                    <li key={r._id} className="min-w-0">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="text-sm font-medium">{r.authorName}</p>
                        <p className="text-muted-foreground text-[11px] tabular-nums">
                          {new Date(r.createdAt).toLocaleString("nb-NO")}
                        </p>
                      </div>
                      <p className="mt-0.5 text-sm leading-relaxed">
                        {renderBodyWithMentions(r.body, r.mentionedNames)}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : null}

              {replyTo === root._id ? (
                <div className="mt-2">
                  <CommentComposer
                    members={memberOptions}
                    placeholder={`Svar til ${root.authorName} …`}
                    busy={busy}
                    autoFocus
                    onCancel={() => setReplyTo(null)}
                    onSubmit={(body, ids) => post(body, ids, root._id)}
                  />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <div className="border-border/40 border-t pt-3">
        <CommentComposer
          members={memberOptions}
          placeholder="Skriv en kommentar — bruk @ for å tagge …"
          busy={busy}
          onSubmit={(body, ids) => post(body, ids)}
        />
      </div>
    </div>
  );
}
