"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";

export type DashboardTaskRow = Doc<"assessmentTasks"> & {
  assessmentTitle: string;
  workspaceName: string;
  assigneeName: string | null;
};
import {
  closestCorners,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMutation, useQuery } from "convex/react";
import {
  Building2,
  Calendar,
  GripVertical,
  LayoutGrid,
  List,
  Pencil,
  Trash2,
  User,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

type TaskRow = DashboardTaskRow;

function clampP(p: number | undefined) {
  return Math.min(5, Math.max(1, Math.round(p ?? 3)));
}

function DraggableTaskCard({
  task,
  onEdit,
}: {
  task: TaskRow;
  onEdit: (t: TaskRow) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-card flex gap-2 rounded-xl border p-3 shadow-sm"
    >
      <button
        type="button"
        className="text-muted-foreground hover:text-foreground mt-0.5 cursor-grab touch-none"
        aria-label="Flytt"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
      <div className="min-w-0 flex-1">
        <p className="font-medium leading-snug">{task.title}</p>
        {task.description ? (
          <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">
            {task.description}
          </p>
        ) : null}
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
          <Badge variant="outline" className="gap-0.5 font-normal">
            <Building2 className="size-3" aria-hidden />
            {task.workspaceName}
          </Badge>
          <Badge variant="secondary" className="font-normal">
            P{clampP(task.priority)}
          </Badge>
          {task.assigneeName ? (
            <span className="text-muted-foreground inline-flex items-center gap-0.5">
              <User className="size-3" aria-hidden />
              {task.assigneeName}
            </span>
          ) : null}
          {task.dueAt ? (
            <span className="text-muted-foreground inline-flex items-center gap-0.5">
              <Calendar className="size-3" aria-hidden />
              {new Date(task.dueAt).toLocaleDateString("nb-NO")}
            </span>
          ) : null}
        </div>
        <Link
          href={`/w/${task.workspaceId}/a/${task.assessmentId}`}
          className="text-primary mt-2 inline-block text-xs font-medium hover:underline"
        >
          {task.assessmentTitle} →
        </Link>
      </div>
      <div className="flex shrink-0 flex-col gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label="Rediger"
          onClick={() => onEdit(task)}
        >
          <Pencil className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function KanbanCard({
  task,
  onEdit,
}: {
  task: TaskRow;
  onEdit: (t: TaskRow) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: task._id });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-card mb-2 rounded-lg border p-2 text-sm shadow-sm ${
        isDragging ? "opacity-40" : ""
      }`}
    >
      <div className="flex gap-1">
        <button
          type="button"
          className="text-muted-foreground shrink-0 cursor-grab touch-none"
          {...listeners}
          {...attributes}
        >
          <GripVertical className="size-4" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="font-medium leading-tight">{task.title}</p>
          <p className="text-muted-foreground mt-0.5 text-[0.65rem]">
            {task.workspaceName}
          </p>
          <Link
            href={`/w/${task.workspaceId}/a/${task.assessmentId}`}
            className="text-primary mt-1 block truncate text-[0.65rem] hover:underline"
          >
            {task.assessmentTitle}
          </Link>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 shrink-0"
          onClick={() => onEdit(task)}
        >
          <Pencil className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

function PriorityColumn({
  priority,
  tasks,
  children,
}: {
  priority: number;
  tasks: TaskRow[];
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `pri-${priority}`,
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-[200px] w-[min(100%,200px)] shrink-0 flex-col rounded-xl border p-2 transition-colors ${
        isOver ? "border-primary/50 bg-primary/5" : "bg-muted/20"
      }`}
    >
      <p className="text-muted-foreground mb-2 text-center text-xs font-semibold">
        Prioritet {priority}
      </p>
      <div className="flex-1">{children}</div>
      {tasks.length === 0 ? (
        <p className="text-muted-foreground py-4 text-center text-[0.65rem]">
          Dra hit
        </p>
      ) : null}
    </div>
  );
}

function DoneColumn({ tasks, children }: { tasks: TaskRow[]; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: "done-drop" });

  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-[200px] w-[min(100%,200px)] shrink-0 flex-col rounded-xl border p-2 ${
        isOver ? "border-primary/50 bg-primary/5" : "bg-muted/30"
      }`}
    >
      <p className="text-muted-foreground mb-2 text-center text-xs font-semibold">
        Ferdig
      </p>
      <div className="flex-1">{children}</div>
      {tasks.length === 0 ? (
        <p className="text-muted-foreground py-4 text-center text-[0.65rem]">
          Dra hit for å fullføre
        </p>
      ) : null}
    </div>
  );
}

export function TasksBoard() {
  const tasks = useQuery(api.assessmentTasks.listMineAcrossWorkspaces, {});
  const moveTask = useMutation(api.assessmentTasks.moveTask);
  const reorderDashboard = useMutation(api.assessmentTasks.reorderDashboard);
  const updateTask = useMutation(api.assessmentTasks.update);
  const removeTask = useMutation(api.assessmentTasks.remove);

  const [view, setView] = useState<"list" | "kanban">("kanban");
  const [activeDrag, setActiveDrag] = useState<TaskRow | null>(null);
  const [editTask, setEditTask] = useState<TaskRow | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPriority, setEditPriority] = useState(3);
  const [editDue, setEditDue] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const openTasks = useMemo(
    () =>
      (tasks ?? []).filter((t) => t.status === "open").sort((a, b) => {
        const pa = clampP(a.priority);
        const pb = clampP(b.priority);
        if (pa !== pb) return pa - pb;
        return (
          (a.dashboardRank ?? a.createdAt) - (b.dashboardRank ?? b.createdAt)
        );
      }),
    [tasks],
  );

  const doneTasks = useMemo(
    () => (tasks ?? []).filter((t) => t.status === "done"),
    [tasks],
  );

  const openIds = useMemo(() => openTasks.map((t) => t._id), [openTasks]);

  function openEdit(t: TaskRow) {
    setEditTask(t);
    setEditTitle(t.title);
    setEditDescription(t.description ?? "");
    setEditPriority(clampP(t.priority));
    setEditDue(
      t.dueAt
        ? new Date(t.dueAt).toISOString().slice(0, 10)
        : "",
    );
  }

  async function saveEdit() {
    if (!editTask) return;
    await updateTask({
      taskId: editTask._id,
      title: editTitle.trim(),
      description: editDescription.trim() || null,
      priority: editPriority,
      dueAt: editDue ? new Date(editDue).getTime() : null,
    });
    setEditTask(null);
  }

  async function handleListDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    if (over.id === "done-drop") {
      await moveTask({
        taskId: active.id as Id<"assessmentTasks">,
        status: "done",
      });
      return;
    }
    if (active.id !== over.id) {
      const oldIndex = openIds.indexOf(active.id as Id<"assessmentTasks">);
      const newIndex = openIds.indexOf(over.id as Id<"assessmentTasks">);
      if (oldIndex >= 0 && newIndex >= 0) {
        const next = arrayMove(openIds, oldIndex, newIndex);
        await reorderDashboard({ orderedTaskIds: next });
      }
    }
  }

  async function handleKanbanDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const taskId = active.id as Id<"assessmentTasks">;
    const overId = String(over.id);
    if (overId === "done-drop") {
      await moveTask({ taskId, status: "done" });
      return;
    }
    if (overId.startsWith("pri-")) {
      const p = parseInt(overId.replace("pri-", ""), 10);
      if (p >= 1 && p <= 5) {
        await moveTask({ taskId, priority: p, status: "open" });
      }
      return;
    }
  }

  const tasksByPriority = (p: number) =>
    openTasks.filter((t) => clampP(t.priority) === p);

  if (tasks === undefined) {
    return (
      <section className="space-y-4" aria-labelledby="tasks-board-heading">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2
              id="tasks-board-heading"
              className="font-heading text-xl font-semibold tracking-tight sm:text-2xl"
            >
              Oppgaver på tvers av arbeidsområder
            </h2>
            <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-relaxed">
              Dra for å prioritere eller flytte mellom kolonner.
            </p>
          </div>
        </div>
        <div className="text-muted-foreground flex items-center gap-3 rounded-2xl border border-border/70 bg-muted/20 px-5 py-10 text-sm">
          <span className="border-primary size-5 shrink-0 animate-spin rounded-full border-2 border-t-transparent" />
          Henter oppgaver …
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-5" aria-labelledby="tasks-board-heading">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="bg-primary/12 text-primary flex size-9 items-center justify-center rounded-lg">
              <LayoutGrid className="size-4" aria-hidden />
            </div>
            <h2
              id="tasks-board-heading"
              className="font-heading text-xl font-semibold tracking-tight sm:text-2xl"
            >
              Oppgaver på tvers av arbeidsområder
            </h2>
          </div>
          <p className="text-muted-foreground mt-2 max-w-2xl pl-11 text-sm leading-relaxed">
            Dra for å prioritere eller flytte mellom kolonner. Rediger for full
            kontroll (tekst, frist, tildeling). Data vises kun der du har
            tilgang.
          </p>
        </div>
        <div
          className="bg-muted/50 inline-flex rounded-lg border p-0.5"
          role="group"
        >
          <Button
            type="button"
            variant={view === "kanban" ? "secondary" : "ghost"}
            size="sm"
            className="gap-1.5"
            onClick={() => setView("kanban")}
          >
            <LayoutGrid className="size-4" aria-hidden />
            Prioritetstavle
          </Button>
          <Button
            type="button"
            variant={view === "list" ? "secondary" : "ghost"}
            size="sm"
            className="gap-1.5"
            onClick={() => setView("list")}
          >
            <List className="size-4" aria-hidden />
            Liste
          </Button>
        </div>
      </div>

      {tasks.length === 0 ? (
        <div className="border-border/70 bg-muted/15 relative overflow-hidden rounded-2xl border border-dashed px-6 py-14 text-center">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,hsl(var(--primary)/0.12),transparent_55%)]"
            aria-hidden
          />
          <div className="relative mx-auto max-w-md space-y-3">
            <div className="bg-muted text-muted-foreground mx-auto flex size-12 items-center justify-center rounded-2xl">
              <List className="size-6" aria-hidden />
            </div>
            <p className="text-foreground font-heading text-base font-semibold">
              Ingen oppgaver ennå
            </p>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Opprett oppgaver under en vurdering (Samarbeid), eller vent på at
              andre tildeler deg.
            </p>
          </div>
        </div>
      ) : view === "list" ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={({ active }) => {
            const t = openTasks.find((x) => x._id === active.id);
            setActiveDrag(t ?? null);
          }}
          onDragEnd={(e) => {
            setActiveDrag(null);
            void handleListDragEnd(e);
          }}
          onDragCancel={() => setActiveDrag(null)}
        >
          <div className="grid gap-4 lg:grid-cols-[1fr_minmax(0,220px)]">
            <SortableContext
              items={openIds}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {openTasks.map((t) => (
                  <DraggableTaskCard key={t._id} task={t} onEdit={openEdit} />
                ))}
              </div>
            </SortableContext>
            <DoneDropList
              tasks={doneTasks}
              onEdit={openEdit}
              onRemove={(id) => void removeTask({ taskId: id })}
              onReopen={(id) =>
                void moveTask({
                  taskId: id,
                  status: "open",
                  priority: 3,
                })
              }
            />
          </div>
          <DragOverlay>
            {activeDrag ? (
              <div className="bg-card max-w-md rounded-xl border p-3 shadow-lg">
                <p className="font-medium">{activeDrag.title}</p>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={pointerWithin}
          onDragStart={({ active }) => {
            const t = [...openTasks, ...doneTasks].find(
              (x) => x._id === active.id,
            );
            setActiveDrag(t ?? null);
          }}
          onDragEnd={(e) => {
            setActiveDrag(null);
            void handleKanbanDragEnd(e);
          }}
          onDragCancel={() => setActiveDrag(null)}
        >
          <div className="flex gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:thin]">
            {[1, 2, 3, 4, 5].map((p) => (
              <PriorityColumn key={p} priority={p} tasks={tasksByPriority(p)}>
                {tasksByPriority(p).map((t) => (
                  <KanbanCard key={t._id} task={t} onEdit={openEdit} />
                ))}
              </PriorityColumn>
            ))}
            <DoneColumn tasks={doneTasks}>
              {doneTasks.map((t) => (
                <div key={t._id} className="bg-card mb-2 rounded-lg border p-2 text-sm">
                  <p className="font-medium leading-tight">{t.title}</p>
                  <p className="text-muted-foreground text-[0.65rem]">
                    {t.workspaceName}
                  </p>
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="h-auto px-0 text-xs"
                    onClick={() =>
                      void moveTask({
                        taskId: t._id,
                        status: "open",
                        priority: 3,
                      })
                    }
                  >
                    Gjenåpne
                  </Button>
                </div>
              ))}
            </DoneColumn>
          </div>
          <DragOverlay>
            {activeDrag ? (
              <div className="bg-card w-48 rounded-lg border p-2 text-sm shadow-lg">
                {activeDrag.title}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      <Sheet open={!!editTask} onOpenChange={(o) => !o && setEditTask(null)}>
        <SheetContent
          side="right"
          showOnDesktop
          className="w-full max-w-md"
        >
          <div className="border-b pb-4">
            <h2 className="font-heading text-lg font-semibold">
              Rediger oppgave
            </h2>
          </div>
          {editTask ? (
            <div className="mt-6 space-y-4 px-1">
              <div className="space-y-1">
                <Label htmlFor="et-title">Tittel</Label>
                <Input
                  id="et-title"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="et-desc">Beskrivelse</Label>
                <Textarea
                  id="et-desc"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={4}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="et-prio">Prioritet (1–5)</Label>
                <Input
                  id="et-prio"
                  type="number"
                  min={1}
                  max={5}
                  value={editPriority}
                  onChange={(e) =>
                    setEditPriority(Number(e.target.value) || 3)
                  }
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="et-due">Frist</Label>
                <Input
                  id="et-due"
                  type="date"
                  value={editDue}
                  onChange={(e) => setEditDue(e.target.value)}
                />
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <Button type="button" onClick={() => void saveEdit()}>
                  Lagre
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  className="gap-1"
                  onClick={() => {
                    if (
                      editTask &&
                      window.confirm("Slette oppgaven permanent?")
                    ) {
                      void removeTask({ taskId: editTask._id }).then(() =>
                        setEditTask(null),
                      );
                    }
                  }}
                >
                  <Trash2 className="size-4" aria-hidden />
                  Slett
                </Button>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </section>
  );
}

function DoneDropList({
  tasks,
  onEdit,
  onRemove,
  onReopen,
}: {
  tasks: TaskRow[];
  onEdit: (t: TaskRow) => void;
  onRemove: (id: Id<"assessmentTasks">) => void;
  onReopen: (id: Id<"assessmentTasks">) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: "done-drop" });

  return (
    <div>
      <div
        ref={setNodeRef}
        className={`rounded-xl border-2 border-dashed p-4 transition-colors ${
          isOver ? "border-primary bg-primary/10" : "border-muted bg-muted/20"
        }`}
      >
        <p className="text-center text-sm font-medium">Slipp her for ferdig</p>
        <p className="text-muted-foreground mt-1 text-center text-xs">
          Dra åpne oppgaver hit fra listen
        </p>
      </div>
      <div className="mt-4 space-y-2">
        <p className="text-muted-foreground text-xs font-medium">
          Fullført ({tasks.length})
        </p>
        {tasks.map((t) => (
          <div
            key={t._id}
            className="bg-card flex items-start justify-between gap-2 rounded-lg border p-2 text-sm"
          >
            <div className="min-w-0">
              <p className="text-muted-foreground line-through">{t.title}</p>
              <p className="text-muted-foreground text-[0.65rem]">
                {t.workspaceName}
              </p>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onReopen(t._id)}
              >
                Gjenåpne
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() => onEdit(t)}
              >
                <Pencil className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-destructive size-8"
                onClick={() => onRemove(t._id)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
