"use client";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "@/lib/app-toast";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import { CornerDownRight, MessageSquare, Send } from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

type MemberOption = {
  userId: Id<"users">;
  label: string;
};

type NoteRow = {
  _id: Id<"assessmentNotes">;
  body: string;
  createdAt: number;
  authorName: string;
  parentNoteId?: Id<"assessmentNotes">;
  mentionedNames: string[];
};

export function renderBodyWithMentions(body: string, mentionNames: string[]) {
  if (mentionNames.length === 0) {
    return <span className="whitespace-pre-wrap">{body}</span>;
  }
  const escaped = mentionNames
    .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .sort((a, b) => b.length - a.length);
  const re = new RegExp(`(@(?:${escaped.join("|")}))`, "gi");
  const parts = body.split(re);
  return (
    <span className="whitespace-pre-wrap">
      {parts.map((part, i) =>
        part.startsWith("@") &&
        mentionNames.some((n) => part.slice(1).toLowerCase() === n.toLowerCase()) ? (
          <span
            key={i}
            className="rounded bg-sky-500/15 px-0.5 font-medium text-sky-900 dark:text-sky-100"
          >
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </span>
  );
}

export function CommentComposer({
  members,
  placeholder,
  busy,
  onSubmit,
  autoFocus,
  onCancel,
}: {
  members: MemberOption[];
  placeholder: string;
  busy: boolean;
  onSubmit: (body: string, mentionedUserIds: Id<"users">[]) => Promise<void>;
  autoFocus?: boolean;
  onCancel?: () => void;
}) {
  const [text, setText] = useState("");
  const [mentioned, setMentioned] = useState<Id<"users">[]>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (autoFocus) textareaRef.current?.focus();
  }, [autoFocus]);

  const mentionMatches = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    return members
      .filter((m) => m.label.toLowerCase().includes(q))
      .slice(0, 6);
  }, [members, mentionQuery]);

  const updateMentionState = (value: string, cursor: number) => {
    const before = value.slice(0, cursor);
    const at = before.lastIndexOf("@");
    if (at < 0) {
      setMentionQuery(null);
      return;
    }
    const charBefore = at === 0 ? " " : before[at - 1];
    if (charBefore && !/\s/.test(charBefore)) {
      setMentionQuery(null);
      return;
    }
    const fragment = before.slice(at + 1);
    if (/\s/.test(fragment)) {
      setMentionQuery(null);
      return;
    }
    setMentionQuery(fragment);
    setMentionIndex(0);
  };

  const insertMention = (member: MemberOption) => {
    const el = textareaRef.current;
    if (!el) return;
    const cursor = el.selectionStart ?? text.length;
    const before = text.slice(0, cursor);
    const after = text.slice(cursor);
    const at = before.lastIndexOf("@");
    if (at < 0) return;
    const next = `${before.slice(0, at)}@${member.label} ${after}`;
    setText(next);
    setMentioned((prev) =>
      prev.includes(member.userId) ? prev : [...prev, member.userId],
    );
    setMentionQuery(null);
    requestAnimationFrame(() => {
      const pos = at + member.label.length + 2;
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionQuery === null || mentionMatches.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setMentionIndex((i) => (i + 1) % mentionMatches.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setMentionIndex(
        (i) => (i - 1 + mentionMatches.length) % mentionMatches.length,
      );
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      const pick = mentionMatches[mentionIndex];
      if (pick) insertMention(pick);
    } else if (e.key === "Escape") {
      setMentionQuery(null);
    }
  };

  const submit = async () => {
    const body = text.trim();
    if (!body) return;
    await onSubmit(body, mentioned);
    setText("");
    setMentioned([]);
    setMentionQuery(null);
  };

  return (
    <div className="space-y-2">
      {/* I dokumentflyt (ikke absolute) — unngår klipping i dialog-scroll på mobil */}
      {mentionQuery !== null && mentionMatches.length > 0 ? (
        <ul
          className="max-h-36 w-full overflow-y-auto rounded-xl border border-border/60 bg-muted/20 py-1"
          role="listbox"
        >
          {mentionMatches.map((m, i) => (
            <li key={m.userId}>
              <button
                type="button"
                role="option"
                aria-selected={i === mentionIndex}
                className={cn(
                  "flex min-h-11 w-full px-3 py-2.5 text-left text-sm touch-manipulation",
                  i === mentionIndex ? "bg-muted" : "hover:bg-muted/50",
                )}
                onMouseDown={(e) => {
                  e.preventDefault();
                  insertMention(m);
                }}
              >
                @{m.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <Textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => {
          const value = e.target.value;
          setText(value);
          updateMentionState(value, e.target.selectionStart ?? value.length);
        }}
        onKeyDown={handleKeyDown}
        rows={2}
        placeholder={placeholder}
        className="min-h-[4.5rem] resize-y text-base sm:min-h-[4rem] sm:text-sm"
      />
      <p className="text-muted-foreground text-[11px]">
        Skriv <span className="font-medium">@</span> for å tagge kolleger
      </p>
      <div className="flex flex-wrap justify-end gap-2">
        {onCancel ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="min-h-11 touch-manipulation sm:min-h-9"
            onClick={onCancel}
          >
            Avbryt
          </Button>
        ) : null}
        <Button
          type="button"
          size="sm"
          className="min-h-11 rounded-xl touch-manipulation sm:min-h-9"
          disabled={busy || !text.trim()}
          onClick={() => void submit()}
        >
          <Send className="size-3.5" />
          Send
        </Button>
      </div>
    </div>
  );
}

export function AssessmentCommentThreads({
  workspaceId,
  assessmentId,
}: {
  workspaceId: Id<"workspaces">;
  assessmentId: Id<"assessments">;
}) {
  const members = useQuery(api.workspaces.listMembers, { workspaceId });
  const notes = useQuery(api.assessmentNotes.listByAssessment, {
    assessmentId,
  });
  const addNote = useMutation(api.assessmentNotes.add);
  const [busy, setBusy] = useState(false);
  const [replyTo, setReplyTo] = useState<Id<"assessmentNotes"> | null>(null);

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
    parentNoteId?: Id<"assessmentNotes">,
  ) => {
    setBusy(true);
    try {
      await addNote({
        assessmentId,
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
        Kommentarer og tråder
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
