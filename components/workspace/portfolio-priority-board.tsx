"use client";

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
  Filter,
  MessageSquare,
  Search,
  Zap,
} from "lucide-react";
import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

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

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

/** GitHub Projects-lignende feltchip */
function FieldChip({
  children,
  tone = "muted",
}: {
  children: ReactNode;
  tone?: "muted" | "green" | "blue" | "orange";
}) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center truncate rounded-full px-2 py-0.5 text-[11px] font-medium leading-none",
        tone === "muted" && "bg-muted text-muted-foreground",
        tone === "green" &&
          "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200",
        tone === "blue" && "bg-sky-500/15 text-sky-900 dark:text-sky-100",
        tone === "orange" &&
          "bg-amber-500/15 text-amber-900 dark:text-amber-100",
      )}
    >
      {children}
    </span>
  );
}

function AssigneeStack({ names }: { names: string[] }) {
  if (names.length === 0) return null;
  const shown = names.slice(0, 3);
  return (
    <div className="flex items-center -space-x-1.5">
      {shown.map((name) => (
        <span
          key={name}
          title={name}
          className="bg-foreground/70 flex size-5 items-center justify-center rounded-full border-2 border-card text-[9px] font-semibold text-background"
        >
          {initials(name)}
        </span>
      ))}
      {names.length > 3 ? (
        <span className="text-muted-foreground pl-1.5 text-[10px] tabular-nums">
          +{names.length - 3}
        </span>
      ) : null}
    </div>
  );
}

function BoardCardView({
  card,
  isDragging,
  dragListeners,
  dragAttributes,
  onOpen,
}: {
  card: BoardCard;
  isDragging?: boolean;
  dragListeners?: object;
  dragAttributes?: object;
  onOpen: () => void;
}) {
  const score = Math.round(
    card.hasManualPriority
      ? card.effectivePriority
      : card.modelPriorityScore,
  );

  return (
    <div
      role="button"
      tabIndex={0}
      {...dragAttributes}
      {...dragListeners}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className={cn(
        // GitHub Projects card: thin border, tight radius, whole card draggable
        "group cursor-grab touch-manipulation rounded-md border border-border/70 bg-card p-3 text-left shadow-[0_1px_0_rgba(27,31,36,0.04)] transition-[box-shadow,border-color,opacity] active:cursor-grabbing dark:shadow-none",
        "hover:border-border",
        isDragging && "opacity-40 shadow-md ring-2 ring-sky-500/30",
        card.lowHangingFruit && "border-l-2 border-l-emerald-500",
      )}
    >
      <p className="text-[13px] font-semibold leading-snug text-foreground">
        {card.title}
      </p>

      <div className="mt-2 flex flex-wrap gap-1">
        {card.lowHangingFruit ? (
          <FieldChip tone="green">
            <Zap className="mr-0.5 size-2.5" aria-hidden />
            Rask gevinst
          </FieldChip>
        ) : null}
        <FieldChip tone={card.hasManualPriority ? "blue" : "muted"}>
          {card.hasManualPriority ? "Prio" : "Modell"} {score}
        </FieldChip>
        {card.cachedEaseLabel ? (
          <FieldChip>{card.cachedEaseLabel}</FieldChip>
        ) : null}
        {card.cachedAp != null ? (
          <FieldChip>AP {Math.round(card.cachedAp)}%</FieldChip>
        ) : null}
      </div>

      {(card.openAssigneeNames.length > 0 ||
        card.openTaskCount > 0 ||
        card.noteCount > 0) && (
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <div className="text-muted-foreground flex items-center gap-2 text-[11px] tabular-nums">
            {card.openTaskCount > 0 ? (
              <span title="Åpne oppgaver">{card.openTaskCount} oppg.</span>
            ) : null}
            {card.noteCount > 0 ? (
              <span
                className="inline-flex items-center gap-0.5"
                title="Kommentarer"
              >
                <MessageSquare className="size-3" aria-hidden />
                {card.noteCount}
              </span>
            ) : null}
          </div>
          <AssigneeStack names={card.openAssigneeNames} />
        </div>
      )}
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
  const suppressClick = useRef(false);

  useEffect(() => {
    if (isDragging) suppressClick.current = true;
  }, [isDragging]);

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(isDragging && "z-10")}
    >
      <BoardCardView
        card={card}
        isDragging={isDragging}
        dragAttributes={attributes}
        dragListeners={listeners}
        onOpen={() => {
          if (suppressClick.current) {
            suppressClick.current = false;
            return;
          }
          onOpen();
        }}
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
    <section
      ref={setNodeRef}
      id={`portfolio-col-${status}`}
      aria-labelledby={`portfolio-col-title-${status}`}
      className={cn(
        // GH column: fixed width, muted well, no heavy card chrome
        "flex w-[280px] shrink-0 snap-center flex-col sm:w-[300px] sm:snap-start",
        "max-h-[min(70dvh,40rem)] rounded-lg bg-muted/50",
        isOver && "ring-2 ring-sky-500/40 ring-offset-2 ring-offset-background",
      )}
    >
      <header className="flex shrink-0 items-center gap-2 px-3 py-2.5">
        <h2
          id={`portfolio-col-title-${status}`}
          className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground"
        >
          {PIPELINE_STATUS_LABELS[status]}
        </h2>
        <span
          className="bg-muted-foreground/15 text-muted-foreground rounded-full px-2 py-0.5 text-xs font-medium tabular-nums"
          aria-label={`${cards.length} elementer`}
        >
          {cards.length}
        </span>
      </header>

      <SortableContext
        items={cards.map((c) => c.assessmentId)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2 [scrollbar-width:thin]">
          {cards.length === 0 ? (
            <div
              className={cn(
                "text-muted-foreground flex min-h-[4.5rem] flex-1 items-center justify-center rounded-md border border-dashed border-border/70 px-2 py-6 text-center text-xs",
                isOver && "border-solid border-sky-500/40 bg-background/80",
              )}
            >
              {isOver ? "Slipp her" : "Ingen elementer"}
            </div>
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
    </section>
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
  /** Når true: skjuler ytre sidetittel (brukt under Saker → Pipeline). */
  embedded = false,
  title = "Pipeline",
}: {
  workspaceId: Id<"workspaces">;
  embedded?: boolean;
  title?: string;
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
  const [query, setQuery] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [localColumns, setLocalColumns] = useState<ColumnState[] | null>(null);
  const [dialogCard, setDialogCard] = useState<BoardCard | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
  );

  const serverColumns = useMemo((): ColumnState[] => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    return data.columns.map((col) => ({
      status: col.status as PipelineStatus,
      cards: col.cards
        .filter((c) => (onlyQuickWin ? c.lowHangingFruit : true))
        .filter((c) => (q ? c.title.toLowerCase().includes(q) : true))
        .map((c) => ({
          ...c,
          assessmentId: c.assessmentId as Id<"assessments">,
          pipelineStatus: c.pipelineStatus,
        })),
    }));
  }, [data, onlyQuickWin, query]);

  useEffect(() => {
    if (activeId) return;
    setLocalColumns(serverColumns);
  }, [serverColumns, activeId]);

  const columns = localColumns ?? serverColumns;
  const isDragging = activeId != null;

  const visibleColumns = useMemo(() => {
    if (isDragging || !hideEmpty) return columns;
    return columns.filter((c) => c.cards.length > 0);
  }, [columns, hideEmpty, isDragging]);

  const allCards = useMemo(() => columns.flatMap((c) => c.cards), [columns]);
  const activeCard = allCards.find((c) => c.assessmentId === activeId) ?? null;
  const visibleCount = visibleColumns.reduce((n, c) => n + c.cards.length, 0);

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
      <div className="space-y-3">
        <div className="bg-muted/40 h-10 animate-pulse rounded-md" />
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="bg-muted/40 h-72 w-[280px] shrink-0 animate-pulse rounded-lg"
            />
          ))}
        </div>
      </div>
    );
  }

  if (data === null) {
    return (
      <p className="text-destructive text-sm">
        Kunne ikke laste pipeline. Sjekk innlogging.
      </p>
    );
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-col gap-0 overflow-x-clip pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      <div className={cn("space-y-3", !embedded && "border-b border-border/50 pb-3")}>
        {!embedded ? (
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                {title}
              </h1>
              <p className="text-muted-foreground mt-0.5 text-sm">
                <span className="tabular-nums">{data.totalCount}</span> kandidater
                {data.lowHangingFruitCount > 0 ? (
                  <>
                    {" · "}
                    <span className="tabular-nums">
                      {data.lowHangingFruitCount}
                    </span>{" "}
                    rask gevinst
                  </>
                ) : null}
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Link
                href={`/w/${workspaceId}/gevinster`}
                className="inline-flex h-8 items-center rounded-md border border-border/60 bg-background px-3 text-xs font-medium text-foreground hover:bg-muted/50"
              >
                Gevinster
              </Link>
              <Link
                href={`/w/${workspaceId}/oppgaver`}
                className="inline-flex h-8 items-center rounded-md border border-border/60 bg-background px-3 text-xs font-medium text-foreground hover:bg-muted/50"
              >
                Oppgaver
              </Link>
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            <span className="tabular-nums">{data.totalCount}</span> kandidater
            {data.lowHangingFruitCount > 0 ? (
              <>
                {" · "}
                <span className="tabular-nums">
                  {data.lowHangingFruitCount}
                </span>{" "}
                rask gevinst
              </>
            ) : null}
          </p>
        )}

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1 sm:max-w-xs">
            <Search
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2"
              aria-hidden
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filtrer etter tittel…"
              aria-label="Filtrer pipeline"
              className="border-input bg-background focus:border-sky-500 focus:ring-sky-500 h-8 w-full rounded-md border py-1 pr-3 pl-8 text-sm outline-none focus:ring-1"
            />
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setFilterOpen((v) => !v)}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium",
                filterOpen || hideEmpty || onlyQuickWin
                  ? "border-sky-500/40 bg-sky-500/10 text-foreground"
                  : "border-border/60 bg-background text-foreground hover:bg-muted/50",
              )}
            >
              <Filter className="size-3.5" aria-hidden />
              Filter
              {(hideEmpty ? 1 : 0) + (onlyQuickWin ? 1 : 0) > 0 ? (
                <span className="rounded-full bg-foreground px-1.5 py-px text-[10px] font-semibold text-background tabular-nums">
                  {(hideEmpty ? 1 : 0) + (onlyQuickWin ? 1 : 0)}
                </span>
              ) : null}
            </button>
            {filterOpen ? (
              <div className="absolute top-full left-0 z-20 mt-1 w-56 rounded-md border border-border/60 bg-background p-2 shadow-lg">
                <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted/40">
                  <input
                    type="checkbox"
                    checked={hideEmpty}
                    onChange={(e) => setHideEmpty(e.target.checked)}
                    className="size-3.5 rounded"
                  />
                  Skjul tomme kolonner
                </label>
                <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted/40">
                  <input
                    type="checkbox"
                    checked={onlyQuickWin}
                    onChange={(e) => setOnlyQuickWin(e.target.checked)}
                    className="size-3.5 rounded"
                  />
                  Kun rask gevinst
                </label>
              </div>
            ) : null}
          </div>

          <p className="text-muted-foreground text-xs tabular-nums sm:ml-auto">
            Viser {visibleCount}
            {isDragging ? " · dra til kolonne" : null}
          </p>
        </div>
      </div>

      {/* Board canvas */}
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
            "-mx-3 mt-3 flex gap-3 overflow-x-auto overscroll-x-contain px-3 pb-4 pt-1",
            "snap-x snap-mandatory touch-pan-x [scrollbar-width:thin]",
            "sm:mx-0 sm:snap-proximity sm:px-0",
            isDragging && "select-none",
          )}
          onClick={() => {
            if (filterOpen) setFilterOpen(false);
          }}
        >
          {visibleColumns.length === 0 ? (
            <p className="text-muted-foreground py-16 text-sm">
              Ingen kolonner matcher filteret.
            </p>
          ) : (
            visibleColumns.map((col) => (
              <Column
                key={col.status}
                status={col.status}
                cards={col.cards}
                onOpenCard={setDialogCard}
              />
            ))
          )}
          <div className="w-1 shrink-0 sm:hidden" aria-hidden />
        </div>

        <DragOverlay dropAnimation={null}>
          {activeCard ? (
            <div className="w-[280px] rotate-[1.5deg] sm:w-[300px]">
              <BoardCardView
                card={activeCard}
                isDragging
                onOpen={() => {}}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

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
