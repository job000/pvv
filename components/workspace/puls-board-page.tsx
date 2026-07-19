"use client";

import { Button } from "@/components/ui/button";
import { IssuesProjectBoard } from "@/components/workspace/issues-project-board";
import { PulsBoardMembersPanel } from "@/components/workspace/puls-board-members-panel";
import { PulsBoardUserSettings } from "@/components/workspace/puls-board-user-settings";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "@/lib/app-toast";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, Settings2, Trash2, UserRoundCog } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Tab = "tavle" | "medlemmer" | "innstillinger";

export function PulsBoardPage({
  workspaceId,
  boardId,
}: {
  workspaceId: Id<"workspaces">;
  boardId: Id<"pulsBoards">;
}) {
  const router = useRouter();
  const board = useQuery(api.pulsBoards.get, { boardId });
  const updateBoard = useMutation(api.pulsBoards.update);
  const removeBoard = useMutation(api.pulsBoards.remove);
  const [tab, setTab] = useState<Tab>("tavle");
  const [busy, setBusy] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");

  useEffect(() => {
    if (board && !editingName) {
      setNameDraft(board.name);
    }
  }, [board, editingName]);

  if (board === undefined) {
    return (
      <div className="space-y-3">
        <div className="bg-muted/40 h-10 w-48 animate-pulse rounded-lg" />
        <div className="bg-muted/40 h-72 animate-pulse rounded-xl" />
      </div>
    );
  }

  if (board === null) {
    return (
      <div className="space-y-3 py-8 text-center">
        <p className="text-sm font-medium">Fant ikke tavlen</p>
        <p className="text-muted-foreground text-xs">
          Du mangler tilgang, eller tavlen er slettet.
        </p>
        <Link
          href={`/w/${workspaceId}/tavler`}
          className="text-sky-800 dark:text-sky-200 inline-flex text-sm font-medium underline-offset-2 hover:underline"
        >
          Tilbake til Tavler
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Link
            href={`/w/${workspaceId}/tavler`}
            className="text-muted-foreground hover:text-foreground mb-1 inline-flex min-h-9 items-center gap-1 text-xs font-medium"
          >
            <ArrowLeft className="size-3.5" aria-hidden />
            Alle tavler
          </Link>
          {editingName && board.canManage ? (
            <input
              autoFocus
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={() => {
                const next = nameDraft.trim();
                setEditingName(false);
                if (!next || next === board.name) {
                  setNameDraft(board.name);
                  return;
                }
                setBusy(true);
                void updateBoard({ boardId, name: next })
                  .then(() => toast.success("Tavlenavn oppdatert"))
                  .catch((err: unknown) => {
                    setNameDraft(board.name);
                    toast.error(
                      err instanceof Error
                        ? err.message
                        : "Kunne ikke endre navn",
                    );
                  })
                  .finally(() => setBusy(false));
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  (e.target as HTMLInputElement).blur();
                }
                if (e.key === "Escape") {
                  setNameDraft(board.name);
                  setEditingName(false);
                }
              }}
              disabled={busy}
              className="border-input bg-background font-heading h-10 w-full max-w-md rounded-lg border px-2 text-xl font-semibold tracking-tight outline-none focus:ring-2 focus:ring-sky-500/30 sm:text-2xl"
              aria-label="Tavlenavn"
            />
          ) : (
            <button
              type="button"
              disabled={!board.canManage}
              onClick={() => {
                if (!board.canManage) return;
                setNameDraft(board.name);
                setEditingName(true);
              }}
              className={cn(
                "font-heading block max-w-full text-left text-xl font-semibold tracking-tight sm:text-2xl",
                board.canManage &&
                  "hover:bg-muted/50 -mx-1.5 cursor-pointer rounded-lg px-1.5 py-0.5",
                !board.canManage && "cursor-default",
              )}
              title={board.canManage ? "Klikk for å endre navn" : undefined}
            >
              {board.name}
            </button>
          )}
          {board.description ? (
            <p className="text-muted-foreground mt-0.5 max-w-xl text-sm">
              {board.description}
            </p>
          ) : null}
        </div>
        <div
          role="tablist"
          className="bg-muted/30 inline-flex w-fit rounded-xl border border-border/50 p-1"
        >
          {(
            [
              ["tavle", "Tavle", null],
              ["medlemmer", "Medlemmer", Settings2],
              ["innstillinger", "Innstillinger", UserRoundCog],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium",
                tab === id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {Icon ? <Icon className="size-3.5" aria-hidden /> : null}
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === "tavle" ? (
        <IssuesProjectBoard workspaceId={workspaceId} boardId={boardId} />
      ) : null}

      {tab === "medlemmer" ? (
        <div className="max-w-2xl space-y-6">
          <PulsBoardMembersPanel
            boardId={boardId}
            canManage={board.canManage}
          />
        </div>
      ) : null}

      {tab === "innstillinger" ? (
        <div className="max-w-2xl space-y-6">
          <PulsBoardUserSettings boardId={boardId} />
          {board.canManage ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
              <p className="text-sm font-medium">Slett tavle</p>
              <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                Sletter tavlen og kortene her. GitHub Projects, issues og
                kommentarer på GitHub endres ikke.
              </p>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="mt-3 min-h-9 gap-1"
                disabled={busy}
                onClick={() => {
                  if (
                    !window.confirm(
                      `Slette tavlen «${board.name}»?\n\n` +
                        `Kort på tavlen slettes her.\n` +
                        `Ingenting slettes eller endres i GitHub.\n\n` +
                        `Dette kan ikke angres.`,
                    )
                  ) {
                    return;
                  }
                  setBusy(true);
                  void removeBoard({ boardId })
                    .then((r) => {
                      toast.success(
                        r.deletedCards > 0
                          ? `Tavle slettet · ${r.deletedCards} kort fjernet (GitHub urørt)`
                          : "Tavle slettet (GitHub urørt)",
                      );
                      router.push(`/w/${workspaceId}/tavler`);
                    })
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
                <Trash2 className="size-3.5" />
                Slett tavle
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
