"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PortfolioPriorityBoard } from "@/components/workspace/portfolio-priority-board";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "@/lib/app-toast";
import { pulsBoardCopy, pulsBoardPath } from "@/lib/puls-board-copy";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import {
  Activity,
  ArrowRight,
  Kanban,
  Plus,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

function roleLabel(role: "owner" | "editor" | "viewer") {
  if (role === "owner") return "Eier";
  if (role === "editor") return "Skriver";
  return "Leser";
}

export function PulsHubPage({
  workspaceId,
}: {
  workspaceId: Id<"workspaces">;
}) {
  const router = useRouter();
  const [showPipeline, setShowPipeline] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [createTemplate, setCreateTemplate] = useState<
    "empty" | "priority" | "phases"
  >("priority");
  const [busy, setBusy] = useState(false);

  const ensureDefaults = useMutation(api.pulsBoards.ensureDefaults);
  const createBoard = useMutation(api.pulsBoards.create);
  const acceptInvite = useMutation(api.pulsBoards.acceptInvite);

  const data = useQuery(api.pulsBoards.listMineInWorkspace, { workspaceId });
  const createTemplates = useQuery(api.pulsBoardColumns.listTemplates, {
    includeEmpty: true,
  });

  useEffect(() => {
    void ensureDefaults({ workspaceId }).catch(() => {
      /* viewer uten rettigheter — ignore */
    });
  }, [ensureDefaults, workspaceId]);

  const boards = data?.boards ?? [];
  const pending = data?.pendingInvites ?? [];

  const submitCreate = async () => {
    const n = name.trim();
    if (!n) {
      toast.error("Gi tavlen et navn");
      return;
    }
    setBusy(true);
    try {
      const boardId = await createBoard({
        workspaceId,
        name: n,
        description: description.trim() || undefined,
        columnTemplate: createTemplate,
      });
      toast.success("Tavle opprettet");
      setCreateOpen(false);
      setName("");
      setDescription("");
      setCreateTemplate("priority");
      router.push(pulsBoardPath(workspaceId, boardId));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kunne ikke opprette");
    } finally {
      setBusy(false);
    }
  };

  if (showPipeline) {
    return (
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setShowPipeline(false)}
          className="text-muted-foreground hover:text-foreground inline-flex min-h-9 items-center gap-1 text-sm font-medium"
        >
          ← Tilbake til Puls
        </button>
        <PortfolioPriorityBoard
          workspaceId={workspaceId}
          embedded
          title={pulsBoardCopy.tabPipeline}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl border border-border/40 bg-gradient-to-br from-sky-500/[0.07] via-background to-violet-500/[0.06] px-4 py-5 sm:px-6">
        <div
          className="pointer-events-none absolute -top-16 right-0 size-48 rounded-full bg-sky-400/10 blur-3xl"
          aria-hidden
        />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="mb-1.5 flex items-center gap-2">
              <span className="bg-sky-500/15 text-sky-900 dark:text-sky-100 inline-flex size-8 items-center justify-center rounded-xl">
                <Activity className="size-4" aria-hidden />
              </span>
              <p className="text-muted-foreground text-[11px] font-medium tracking-[0.14em] uppercase">
                Arbeidsrytme
              </p>
            </div>
            <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
              {pulsBoardCopy.pageTitle}
            </h1>
            <p className="text-muted-foreground mt-1 max-w-xl text-sm leading-relaxed">
              Velg en tavle du eier eller er invitert til — eller åpne pipeline
              for vurderinger.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-10 rounded-xl"
              onClick={() => setShowPipeline(true)}
            >
              <Kanban className="size-3.5" />
              Pipeline
            </Button>
            <Button
              type="button"
              className="min-h-10 rounded-xl"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="size-3.5" />
              Ny tavle
            </Button>
          </div>
        </div>
      </div>

      {pending.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Invitasjoner til deg</h2>
          <ul className="space-y-2">
            {pending.map((inv) => (
              <li
                key={inv.inviteId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-sky-500/30 bg-sky-500/5 px-3 py-3"
              >
                <div>
                  <p className="text-sm font-medium">{inv.boardName}</p>
                  <p className="text-muted-foreground text-xs">
                    Rolle: {roleLabel(inv.role)}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="min-h-9"
                  disabled={busy}
                  onClick={() => {
                    setBusy(true);
                    void acceptInvite({ inviteId: inv.inviteId })
                      .then((r) => {
                        toast.success("Invitasjon godtatt");
                        router.push(
                          pulsBoardPath(r.workspaceId, r.boardId),
                        );
                      })
                      .catch((err: unknown) =>
                        toast.error(
                          err instanceof Error
                            ? err.message
                            : "Kunne ikke godta",
                        ),
                      )
                      .finally(() => setBusy(false));
                  }}
                >
                  Godta
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold">Dine tavler</h2>
          <p className="text-muted-foreground text-xs tabular-nums">
            {data === undefined ? "…" : `${boards.length} tavler`}
          </p>
        </div>

        {data === undefined ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="bg-muted/40 h-36 animate-pulse rounded-2xl"
              />
            ))}
          </div>
        ) : boards.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 px-4 py-12 text-center">
            <p className="text-sm font-medium">Ingen tavler ennå</p>
            <p className="text-muted-foreground mt-1 text-xs">
              Opprett en tavle for å starte, eller be om en invitasjon.
            </p>
            <Button
              type="button"
              className="mt-4 min-h-10 rounded-xl"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="size-3.5" />
              Ny tavle
            </Button>
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {boards.map((board) => (
              <li key={board._id}>
                <Link
                  href={pulsBoardPath(workspaceId, board._id)}
                  className={cn(
                    "group flex h-full flex-col rounded-2xl border border-border/60 bg-card p-4 shadow-[0_1px_0_rgba(27,31,36,0.04)] transition-colors",
                    "hover:border-sky-500/40 hover:bg-sky-500/[0.03] dark:shadow-none",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-heading text-base font-semibold leading-snug">
                      {board.name}
                    </p>
                    <span className="bg-muted text-muted-foreground shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium">
                      {roleLabel(board.myRole)}
                    </span>
                  </div>
                  {board.description ? (
                    <p className="text-muted-foreground mt-1 line-clamp-2 text-xs leading-relaxed">
                      {board.description}
                    </p>
                  ) : null}
                  <div className="text-muted-foreground mt-auto flex items-center justify-between gap-2 pt-4 text-[11px]">
                    <span className="inline-flex items-center gap-1">
                      <Users className="size-3" aria-hidden />
                      {board.ownerName ?? "—"}
                    </span>
                    <span className="tabular-nums">
                      {board.openCardCount} åpne
                    </span>
                  </div>
                  <span className="text-sky-800 dark:text-sky-200 mt-2 inline-flex items-center gap-1 text-xs font-medium opacity-0 transition-opacity group-hover:opacity-100">
                    Åpne
                    <ArrowRight className="size-3" aria-hidden />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) {
            setName("");
            setDescription("");
            setCreateTemplate("priority");
          }
        }}
      >
        <DialogContent size="md" titleId="create-puls-board-title">
          <DialogHeader>
            <h2
              id="create-puls-board-title"
              className="font-heading text-lg font-semibold"
            >
              Ny Puls-tavle
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Velg kolonnestruktur. Du blir eier og kan invitere andre etterpå.
            </p>
          </DialogHeader>
          <DialogBody className="min-w-0 space-y-4">
            <div className="space-y-1">
              <Label htmlFor="puls-board-name">Navn</Label>
              <Input
                id="puls-board-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="F.eks. Q3 leveranse"
                className="min-h-11 sm:min-h-9"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="puls-board-desc">Beskrivelse (valgfritt)</Label>
              <Textarea
                id="puls-board-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Kolonnestruktur</Label>
              <div className="grid min-w-0 gap-2">
                {(createTemplates ?? []).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() =>
                      setCreateTemplate(
                        t.id as "empty" | "priority" | "phases",
                      )
                    }
                    className={cn(
                      "min-w-0 rounded-xl border p-3 text-left transition-colors",
                      createTemplate === t.id
                        ? "border-sky-500/40 bg-sky-500/5 ring-1 ring-sky-500/20"
                        : "border-border/50 hover:bg-muted/40",
                    )}
                  >
                    <p className="text-sm font-medium">{t.label}</p>
                    <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
                      {t.description}
                    </p>
                    <p className="text-muted-foreground mt-1 truncate text-[11px]">
                      {t.columnNames.join(" → ")}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreateOpen(false)}
            >
              Avbryt
            </Button>
            <Button
              type="button"
              disabled={busy || !name.trim()}
              onClick={() => void submitCreate()}
            >
              Opprett tavle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
