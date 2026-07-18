"use client";

import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "@/lib/app-toast";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import { Columns3, LayoutList, RotateCcw, Table2 } from "lucide-react";
import { useEffect, useState } from "react";

type ViewMode = "columns" | "table" | "list";
type CommentsPlacement = "tab" | "overview";
type DetailSize = "normal" | "large" | "full";

/**
 * Samlede personlige Puls-innstillinger for denne tavlen (per bruker).
 */
export function PulsBoardUserSettings({
  boardId,
}: {
  boardId: Id<"pulsBoards">;
}) {
  const saved = useQuery(api.pulsBoardUserPrefs.getMine, { boardId });
  const setUi = useMutation(api.pulsBoardUserPrefs.setUiMine);
  const clearMine = useMutation(api.pulsBoardUserPrefs.clearMine);
  const [busy, setBusy] = useState(false);

  const [viewMode, setViewMode] = useState<ViewMode>("columns");
  const [commentsPlacement, setCommentsPlacement] =
    useState<CommentsPlacement>("tab");
  const [detailSize, setDetailSize] = useState<DetailSize>("large");

  useEffect(() => {
    if (saved === undefined) return;
    if (saved === null) {
      setViewMode("columns");
      setCommentsPlacement("tab");
      setDetailSize("large");
      return;
    }
    if (
      saved.viewMode === "columns" ||
      saved.viewMode === "table" ||
      saved.viewMode === "list"
    ) {
      setViewMode(saved.viewMode);
    }
    if (
      saved.commentsPlacement === "tab" ||
      saved.commentsPlacement === "overview"
    ) {
      setCommentsPlacement(saved.commentsPlacement);
    }
    if (
      saved.detailSize === "normal" ||
      saved.detailSize === "large" ||
      saved.detailSize === "full"
    ) {
      setDetailSize(saved.detailSize);
    }
  }, [saved]);

  const save = async (patch: {
    viewMode?: ViewMode;
    commentsPlacement?: CommentsPlacement;
    detailSize?: DetailSize;
  }) => {
    setBusy(true);
    try {
      await setUi({ boardId, ...patch });
      try {
        localStorage.setItem(
          `puls-board-ui:${boardId}`,
          JSON.stringify({
            commentsPlacement: patch.commentsPlacement ?? commentsPlacement,
            detailSize: patch.detailSize ?? detailSize,
          }),
        );
        if (patch.viewMode) {
          localStorage.setItem(`puls-board-view:${boardId}`, patch.viewMode);
        }
      } catch {
        /* ignore */
      }
      toast.success("Innstilling lagret");
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Kunne ikke lagre innstilling",
      );
    } finally {
      setBusy(false);
    }
  };

  if (saved === undefined) {
    return (
      <div className="space-y-3">
        <div className="bg-muted/40 h-8 w-48 animate-pulse rounded-lg" />
        <div className="bg-muted/40 h-40 animate-pulse rounded-xl" />
      </div>
    );
  }

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h2 className="text-base font-semibold tracking-tight">
          Mine innstillinger
        </h2>
        <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
          Personlige valg for denne tavlen. Gjelder bare deg — ikke andre
          medlemmer.
        </p>
      </div>

      <section className="space-y-3 rounded-xl border border-border/50 p-4">
        <div>
          <p className="text-sm font-medium">Standard visning</p>
          <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
            Hvordan tavlen åpnes. Du kan fortsatt bytte midlertidig i
            verktøylinjen.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["columns", "Kolonner", Columns3],
              ["table", "Tabell", Table2],
              ["list", "Liste", LayoutList],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              disabled={busy}
              onClick={() => {
                setViewMode(id);
                void save({ viewMode: id });
              }}
              className={cn(
                "inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-medium",
                viewMode === id
                  ? "bg-foreground text-background"
                  : "bg-muted/50 text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-3.5" aria-hidden />
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-border/50 p-4">
        <div>
          <p className="text-sm font-medium">Kortvisning</p>
          <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
            Hvordan kort åpnes, og om kommentarer ligger under oversikten.
          </p>
        </div>

        <label className="flex cursor-pointer items-start gap-2.5 text-sm">
          <input
            type="checkbox"
            className="mt-1 size-3.5 accent-foreground"
            disabled={busy}
            checked={commentsPlacement === "overview"}
            onChange={(e) => {
              const next: CommentsPlacement = e.target.checked
                ? "overview"
                : "tab";
              setCommentsPlacement(next);
              void save({ commentsPlacement: next });
            }}
          />
          <span>
            <span className="font-medium">Kommentarer under oversikt</span>
            <span className="text-muted-foreground mt-0.5 block text-xs leading-relaxed">
              Som GitHub Issues — beskrivelse og kommentarer på samme side.
            </span>
          </span>
        </label>

        <div className="space-y-1.5 pt-1">
          <p className="text-xs font-medium">Standard kortstørrelse</p>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ["normal", "Normal"],
                ["large", "Stor"],
                ["full", "Fullskjerm"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                disabled={busy}
                onClick={() => {
                  setDetailSize(id);
                  void save({ detailSize: id });
                }}
                className={cn(
                  "min-h-9 rounded-lg px-3 text-xs font-medium",
                  detailSize === id
                    ? "bg-foreground text-background"
                    : "bg-muted/50 text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-2 rounded-xl border border-border/50 p-4">
        <p className="text-sm font-medium">Tilbakestill</p>
        <p className="text-muted-foreground text-xs leading-relaxed">
          Fjerner dine lagrede filtre og visningsvalg for denne tavlen.
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="min-h-9 gap-1.5"
          disabled={busy || saved === null}
          onClick={() => {
            if (
              !window.confirm(
                "Tilbakestille dine personlige innstillinger for denne tavlen?",
              )
            ) {
              return;
            }
            setBusy(true);
            void clearMine({ boardId })
              .then(() => {
                setViewMode("columns");
                setCommentsPlacement("tab");
                setDetailSize("large");
                try {
                  localStorage.removeItem(`puls-board-ui:${boardId}`);
                  localStorage.removeItem(`puls-board-view:${boardId}`);
                } catch {
                  /* ignore */
                }
                toast.success("Innstillinger tilbakestilt");
              })
              .catch((err: unknown) =>
                toast.error(
                  err instanceof Error
                    ? err.message
                    : "Kunne ikke tilbakestille",
                ),
              )
              .finally(() => setBusy(false));
          }}
        >
          <RotateCcw className="size-3.5" aria-hidden />
          Tilbakestill mine valg
        </Button>
      </section>
    </div>
  );
}
