"use client";

import { buttonVariants } from "@/components/ui/button-variants";
import {
  PortfolioBoardCardDialog,
  type PortfolioBoardCardSummary,
} from "@/components/workspace/portfolio-board-card-dialog";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "@/lib/app-toast";
import {
  PIPELINE_KANBAN_ORDER,
  PIPELINE_STATUS_LABELS,
  type PipelineStatus,
} from "@/lib/assessment-pipeline";
import { cn } from "@/lib/utils";
import {
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMutation, useQuery } from "convex/react";
import {
  GripVertical,
  MessageSquare,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type BoardCard = PortfolioBoardCardSummary & {
  kanbanRank: number;
  updatedAt: number;
  manualPriorityOverride: number | null;
};

type ColumnState = {
  status: PipelineStatus;
  cards: BoardCard[];
};

function columnId(status: string) {
  return `col:${status}`;
}

function parseColumnId(id: string): PipelineStatus | null {
  if (!id.startsWith("col:")) return null;
  const s = id.slice(4);
  return PIPELINE_KANBAN_ORDER.includes(s as PipelineStatus)
    ? (s as PipelineStatus)
    : null;
}

function BoardCardView({
  card,
  dragHandleProps,
  isDragging,
  onOpen,
}: {
  card: BoardCard;
  dragHandleProps?: Record<string, unknown>;
  isDragging?: boolean;
  onOpen: () => void;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border/50 bg-card p-3 shadow-sm transition-shadow",
        isDragging && "opacity-50 ring-2 ring-foreground/20",
        card.lowHangingFruit && "border-emerald-500/35",
      )}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground -ml-1 mt-0.5 flex size-11 shrink-0 cursor-grab touch-manipulation items-center justify-center rounded-lg active:cursor-grabbing"
          aria-label="Flytt kandidat"
          {...dragHandleProps}
        >
          <GripVertical className="size-5" />
        </button>
        <button
          type="button"
          className="min-w-0 flex-1 touch-manipulation space-y-1.5 py-0.5 text-left"
          onClick={onOpen}
        >
          <p className="text-sm font-semibold leading-snug tracking-tight">
            {card.title}
          </p>
          <div className="flex flex-wrap gap-1">
            {card.lowHangingFruit ? (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800 dark:text-emerald-200">
                <Zap className="size-2.5" aria-hidden />
                Rask gevinst
              </span>
            ) : null}
            {card.hasManualPriority ? (
              <span className="rounded-full bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-sky-900 dark:text-sky-100">
                Manuell prio {Math.round(card.effectivePriority)}
              </span>
            ) : (
              <span className="text-muted-foreground rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium">
                Modell {Math.round(card.modelPriorityScore)}
              </span>
            )}
            {card.cachedEaseLabel ? (
              <span className="text-muted-foreground rounded-full bg-muted/80 px-1.5 py-0.5 text-[10px]">
                {card.cachedEaseLabel}
              </span>
            ) : null}
          </div>
          <p className="text-muted-foreground text-[11px] tabular-nums">
            AP {Math.round(card.cachedAp ?? 0)}%
            {card.cachedCriticality != null
              ? ` · Viktighet ${Math.round(card.cachedCriticality)}`
              : ""}
          </p>
          {(card.openTaskCount > 0 || card.noteCount > 0) && (
            <div className="text-muted-foreground flex flex-wrap items-center gap-2 pt-0.5 text-[11px]">
              {card.openTaskCount > 0 ? (
                <span className="inline-flex items-center gap-0.5">
                  <Users className="size-3" aria-hidden />
                  {card.openTaskCount} oppg.
                  {card.openAssigneeNames.length > 0
                    ? ` · ${card.openAssigneeNames.slice(0, 2).join(", ")}`
                    : ""}
                </span>
              ) : null}
              {card.noteCount > 0 ? (
                <span className="inline-flex items-center gap-0.5">
                  <MessageSquare className="size-3" aria-hidden />
                  {card.noteCount}
                </span>
              ) : null}
            </div>
          )}
          <p className="pt-0.5 text-[11px] font-medium text-foreground/80 underline-offset-2 group-hover:underline">
            Åpne detaljer
          </p>
        </button>
      </div>
    </div>
  );
}

function SortableCard({
  card,
  onOpen,
}: {
  card: BoardCard;
  onOpen: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: card.assessmentId,
    data: { type: "card", status: card.pipelineStatus },
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      <BoardCardView
        card={card}
        isDragging={isDragging}
        dragHandleProps={{ ...attributes, ...listeners }}
        onOpen={onOpen}
      />
    </div>
  );
}

function Column({
  status,
  cards,
  onOpenCard,
}: {
  status: PipelineStatus;
  cards: BoardCard[];
  onOpenCard: (card: BoardCard) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: columnId(status),
    data: { type: "column", status },
  });

  return (
    <div
      ref={setNodeRef}
      id={`portfolio-col-${status}`}
      className={cn(
        // Mobil/nettbrett: nesten full bredde + snap. Desktop: fast kolonnebredde.
        "flex w-[min(85vw,20rem)] shrink-0 snap-center flex-col rounded-2xl border border-border/50 bg-muted/15 transition-colors sm:w-[17.5rem] sm:snap-start",
        isOver && "border-foreground/30 bg-muted/35 ring-1 ring-foreground/10",
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border/40 bg-muted/40 px-3 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">
            {PIPELINE_STATUS_LABELS[status]}
          </p>
          <p className="text-muted-foreground text-[11px] tabular-nums">
            {cards.length} kandidat{cards.length === 1 ? "" : "er"}
          </p>
        </div>
      </div>
      <SortableContext
        items={cards.map((c) => c.assessmentId)}
        strategy={verticalListSortingStrategy}
      >
        {/* Unngå dobbel scroll på mobil — siden scroller; kolonne-scroll fra md */}
        <div className="flex min-h-[6rem] flex-col gap-2 p-2 md:max-h-[min(65vh,36rem)] md:overflow-y-auto">
          {cards.length === 0 ? (
            <p
              className={cn(
                "text-muted-foreground rounded-xl border border-dashed border-border/50 px-1 py-8 text-center text-xs",
                isOver && "border-foreground/30 bg-background/40",
              )}
            >
              Slipp her
            </p>
          ) : (
            cards.map((card) => (
              <SortableCard
                key={card.assessmentId}
                card={card}
                onOpen={() => onOpenCard(card)}
              />
            ))
          )}
        </div>
      </SortableContext>
    </div>
  );
}

function findStatusOf(
  columns: ColumnState[],
  assessmentId: string,
): PipelineStatus | null {
  for (const col of columns) {
    if (col.cards.some((c) => c.assessmentId === assessmentId)) {
      return col.status;
    }
  }
  return null;
}

export function PortfolioPriorityBoard({
  workspaceId,
}: {
  workspaceId: Id<"workspaces">;
}) {
  const data = useQuery(api.assessmentPortfolioBoard.listBoard, {
    workspaceId,
  });
  const moveOnBoard = useMutation(api.assessmentPortfolioBoard.moveOnBoard);
  const setPriority = useMutation(
    api.assessmentPortfolioBoard.setCoordinatorPriority,
  );
  const [hideEmpty, setHideEmpty] = useState(true);
  const [onlyQuickWin, setOnlyQuickWin] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [localColumns, setLocalColumns] = useState<ColumnState[] | null>(null);
  const [dialogCard, setDialogCard] = useState<BoardCard | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 220, tolerance: 10 },
    }),
  );

  const scrollToPhase = (status: PipelineStatus) => {
    const el = document.getElementById(`portfolio-col-${status}`);
    el?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  };

  const serverColumns = useMemo((): ColumnState[] => {
    if (!data) return [];
    return data.columns.map((col) => ({
      status: col.status as PipelineStatus,
      cards: (onlyQuickWin
        ? col.cards.filter((c) => c.lowHangingFruit)
        : col.cards
      ).map((c) => ({
        ...c,
        assessmentId: c.assessmentId as Id<"assessments">,
        pipelineStatus: c.pipelineStatus,
      })),
    }));
  }, [data, onlyQuickWin]);

  useEffect(() => {
    if (activeId) return;
    setLocalColumns(serverColumns);
  }, [serverColumns, activeId]);

  const columns = localColumns ?? serverColumns;

  const isDragging = activeId != null;
  const visibleColumns = useMemo(() => {
    // Under dra: vis alle faser så det går an å slippe i tomme kolonner
    if (isDragging || !hideEmpty) return columns;
    return columns.filter((c) => c.cards.length > 0);
  }, [columns, hideEmpty, isDragging]);

  const allCards = useMemo(
    () => columns.flatMap((c) => c.cards),
    [columns],
  );
  const activeCard = allCards.find((c) => c.assessmentId === activeId) ?? null;

  // Hold dialogen i synk når kort flyttes eller serverdata oppdateres
  useEffect(() => {
    if (!dialogCard) return;
    const fresh = allCards.find(
      (c) => c.assessmentId === dialogCard.assessmentId,
    );
    if (!fresh) return;
    if (
      fresh.pipelineStatus !== dialogCard.pipelineStatus ||
      fresh.openTaskCount !== dialogCard.openTaskCount ||
      fresh.noteCount !== dialogCard.noteCount ||
      fresh.hasManualPriority !== dialogCard.hasManualPriority ||
      fresh.effectivePriority !== dialogCard.effectivePriority
    ) {
      setDialogCard(fresh);
    }
  }, [allCards, dialogCard]);

  const persistMove = async (
    assessmentId: Id<"assessments">,
    toStatus: PipelineStatus,
    beforeAssessmentId: Id<"assessments"> | null,
  ) => {
    try {
      await moveOnBoard({
        assessmentId,
        toStatus,
        beforeAssessmentId,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kunne ikke flytte kort");
      setLocalColumns(serverColumns);
      throw e;
    }
  };

  const onDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const onDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeAssessmentId = String(active.id) as Id<"assessments">;
    let toStatus = parseColumnId(String(over.id));
    if (!toStatus) {
      toStatus = findStatusOf(columns, String(over.id));
    }
    if (!toStatus) return;

    const fromStatus = findStatusOf(columns, activeAssessmentId);
    if (!fromStatus || fromStatus === toStatus) return;

    setLocalColumns((prev) => {
      const cols = prev ?? columns;
      const fromCol = cols.find((c) => c.status === fromStatus);
      const toCol = cols.find((c) => c.status === toStatus);
      if (!fromCol || !toCol) return cols;
      const moving = fromCol.cards.find(
        (c) => c.assessmentId === activeAssessmentId,
      );
      if (!moving) return cols;

      const overIsColumn = parseColumnId(String(over.id)) != null;
      let insertAt = toCol.cards.length;
      if (!overIsColumn) {
        const overIdx = toCol.cards.findIndex(
          (c) => c.assessmentId === String(over.id),
        );
        if (overIdx >= 0) insertAt = overIdx;
      }

      return cols.map((col) => {
        if (col.status === fromStatus) {
          return {
            ...col,
            cards: col.cards.filter(
              (c) => c.assessmentId !== activeAssessmentId,
            ),
          };
        }
        if (col.status === toStatus) {
          const next = col.cards.filter(
            (c) => c.assessmentId !== activeAssessmentId,
          );
          next.splice(insertAt, 0, {
            ...moving,
            pipelineStatus: toStatus,
          });
          return { ...col, cards: next };
        }
        return col;
      });
    });
  };

  const onDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over) {
      setLocalColumns(serverColumns);
      return;
    }

    const activeAssessmentId = String(active.id) as Id<"assessments">;
    const currentColumns = localColumns ?? columns;
    const toStatus =
      findStatusOf(currentColumns, activeAssessmentId) ??
      parseColumnId(String(over.id));
    if (!toStatus) {
      setLocalColumns(serverColumns);
      return;
    }

    const targetCol = currentColumns.find((c) => c.status === toStatus);
    if (!targetCol) {
      setLocalColumns(serverColumns);
      return;
    }

    const ids = targetCol.cards.map((c) => c.assessmentId);
    const fromIdx = ids.indexOf(activeAssessmentId);
    let beforeAssessmentId: Id<"assessments"> | null = null;

    // Droppet på et annet kort i samme kolonne → omorganiser lokalt først
    if (!parseColumnId(String(over.id))) {
      const overId = String(over.id) as Id<"assessments">;
      const overStatus = findStatusOf(currentColumns, overId);
      if (overStatus === toStatus && overId !== activeAssessmentId) {
        const overIdx = ids.indexOf(overId);
        if (overIdx >= 0 && fromIdx >= 0 && fromIdx !== overIdx) {
          const reordered = [...targetCol.cards];
          const [moved] = reordered.splice(fromIdx, 1);
          if (moved) {
            const insertAt = fromIdx < overIdx ? overIdx - 1 : overIdx;
            reordered.splice(insertAt, 0, moved);
            setLocalColumns(
              currentColumns.map((col) =>
                col.status === toStatus ? { ...col, cards: reordered } : col,
              ),
            );
            const nextIds = reordered.map((c) => c.assessmentId);
            const movedAt = nextIds.indexOf(activeAssessmentId);
            beforeAssessmentId =
              movedAt >= 0 && movedAt < nextIds.length - 1
                ? nextIds[movedAt + 1]!
                : null;
            await persistMove(activeAssessmentId, toStatus, beforeAssessmentId);
            return;
          }
        }
      }
    }

    if (fromIdx >= 0 && fromIdx < ids.length - 1) {
      beforeAssessmentId = ids[fromIdx + 1]!;
    }

    await persistMove(activeAssessmentId, toStatus, beforeAssessmentId);
  };

  const handleSetPriority = async (
    assessmentId: Id<"assessments">,
    priority: number | null,
  ) => {
    try {
      await setPriority({ assessmentId, priority });
      toast.success(
        priority === null
          ? "Bruker modell-score igjen"
          : `Manuell prioritet satt til ${Math.round(priority)}`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kunne ikke lagre prioritet");
      throw e;
    }
  };

  const handleMovePhase = async (
    assessmentId: Id<"assessments">,
    toStatus: PipelineStatus,
  ) => {
    await persistMove(assessmentId, toStatus, null);
  };

  if (data === undefined) {
    return (
      <div className="-mx-3 flex gap-3 overflow-hidden px-3 sm:mx-0 sm:px-0">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="bg-muted/40 h-64 w-[min(85vw,20rem)] shrink-0 animate-pulse rounded-2xl sm:h-80 sm:w-72"
          />
        ))}
      </div>
    );
  }

  if (data === null) {
    return (
      <p className="text-destructive text-sm">
        Kunne ikke laste porteføljen. Sjekk innlogging.
      </p>
    );
  }

  return (
    <div className="min-w-0 space-y-4 overflow-x-clip pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:space-y-5">
      <header className="space-y-2">
        <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
          Portefølje og prioritering
        </h1>
        <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
          <span className="sm:hidden">
            Sveip mellom faser, hold i håndtaket for å flytte, eller trykk kortet
            for detaljer.
          </span>
          <span className="hidden sm:inline">
            Dra kort mellom faser, eller trykk for detaljer, tildeling og
            kommentarer. Rekkefølgen i kolonnen er det koordinatorene følger —
            modell-score er et forslag.
          </span>
        </p>
      </header>

      <div className="space-y-3 rounded-2xl border border-border/50 bg-muted/10 px-3 py-3">
        <div className="flex items-start gap-2">
          <Sparkles
            className="text-muted-foreground mt-0.5 size-4 shrink-0"
            aria-hidden
          />
          <p className="text-muted-foreground min-w-0 flex-1 text-xs leading-snug sm:text-sm">
            <span className="text-foreground font-medium">{data.totalCount}</span>{" "}
            kandidater
            {data.lowHangingFruitCount > 0 ? (
              <>
                {" "}
                ·{" "}
                <span className="text-foreground font-medium">
                  {data.lowHangingFruitCount}
                </span>{" "}
                rask gevinst
              </>
            ) : null}
            {isDragging ? (
              <span className="text-foreground mt-1 block font-medium sm:mt-0 sm:ml-1 sm:inline">
                Alle faser vises — slipp i ønsket kolonne
              </span>
            ) : null}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <label className="flex min-h-11 items-center gap-2 text-sm touch-manipulation sm:min-h-0 sm:text-xs md:text-sm">
            <input
              type="checkbox"
              checked={hideEmpty}
              onChange={(e) => setHideEmpty(e.target.checked)}
              className="size-4 rounded sm:size-3.5"
            />
            Skjul tomme faser
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm touch-manipulation sm:min-h-0 sm:text-xs md:text-sm">
            <input
              type="checkbox"
              checked={onlyQuickWin}
              onChange={(e) => setOnlyQuickWin(e.target.checked)}
              className="size-4 rounded sm:size-3.5"
            />
            Kun rask gevinst
          </label>
          <div className="flex flex-wrap gap-2 sm:ml-auto">
            <Link
              href={`/w/${workspaceId}/gevinster`}
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "min-h-11 flex-1 rounded-full touch-manipulation sm:min-h-9 sm:flex-none",
              )}
            >
              Se gevinster
            </Link>
            <Link
              href={`/w/${workspaceId}/oppgaver`}
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "min-h-11 flex-1 rounded-full touch-manipulation sm:min-h-9 sm:flex-none",
              )}
            >
              Oppgaver
            </Link>
          </div>
        </div>
      </div>

      {/* Hurtigvalg av fase — viktig på mobil/nettbrett */}
      <div
        className="-mx-3 flex gap-1.5 overflow-x-auto px-3 pb-0.5 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden"
        role="navigation"
        aria-label="Hopp til fase"
      >
        {visibleColumns.map((col) => (
          <button
            key={col.status}
            type="button"
            onClick={() => scrollToPhase(col.status)}
            className={cn(
              "inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium touch-manipulation transition-colors",
              "border-border/50 bg-background hover:bg-muted/40",
            )}
          >
            <span className="max-w-[9rem] truncate">
              {PIPELINE_STATUS_LABELS[col.status]}
            </span>
            <span className="text-muted-foreground tabular-nums">
              {col.cards.length}
            </span>
          </button>
        ))}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={(e) => void onDragEnd(e)}
        onDragCancel={() => {
          setActiveId(null);
          setLocalColumns(serverColumns);
        }}
      >
        <div
          className={cn(
            "-mx-3 flex gap-3 overflow-x-auto overscroll-x-contain px-3 pb-4",
            "snap-x snap-mandatory touch-pan-x [scrollbar-width:thin]",
            "sm:mx-0 sm:snap-proximity sm:px-0",
            isDragging && "select-none",
          )}
        >
          {visibleColumns.map((col) => (
            <Column
              key={col.status}
              status={col.status}
              cards={col.cards}
              onOpenCard={setDialogCard}
            />
          ))}
          {/* Luft til høyre så siste kolonne kan snappes midt på mobil */}
          <div className="w-2 shrink-0 sm:hidden" aria-hidden />
        </div>
        <DragOverlay dropAnimation={null}>
          {activeCard ? (
            <div className="w-[min(85vw,20rem)] max-w-[16.5rem] scale-[1.02] rotate-1 shadow-lg sm:w-[16.5rem]">
              <BoardCardView
                card={activeCard}
                isDragging
                onOpen={() => {}}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <aside className="rounded-2xl border border-border/40 bg-muted/10 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        <p className="font-medium text-foreground">Tips</p>
        <ul className="mt-1.5 list-inside list-disc space-y-1">
          <li className="sm:hidden">
            Sveip sidelengs mellom faser, eller bruk chipene over tavlen.
          </li>
          <li>
            Bruk <strong className="text-foreground font-medium">håndtaket</strong>{" "}
            for å dra; trykk på kortet for detaljer, tildeling og kommentarer.
          </li>
          <li>
            Tomme faser vises automatisk mens du drar, så du kan slippe dit.
          </li>
        </ul>
      </aside>

      <PortfolioBoardCardDialog
        open={dialogCard != null}
        onOpenChange={(open) => {
          if (!open) setDialogCard(null);
        }}
        workspaceId={workspaceId}
        card={dialogCard}
        onMovePhase={handleMovePhase}
        onSetPriority={handleSetPriority}
      />
    </div>
  );
}
