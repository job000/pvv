"use client";

import { CardDescriptionEditor } from "@/components/ui/card-description-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { TaskGithubControls } from "@/components/tasks/task-github-controls";
import { TaskFileAttachments } from "@/components/workspace/task-file-attachments";
import { toast } from "@/lib/app-toast";
import { effectiveGithubDefaultRepos } from "@/lib/github-workspace-helpers";
import { htmlToPlainText, isEmptyRichText } from "@/lib/rich-text";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import {
  closestCorners,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  PointerSensor,
  TouchSensor,
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
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  Link2,
  Pencil,
  Search,
  SlidersHorizontal,
  Trash2,
  Unlink,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useStickyState } from "@/lib/use-sticky-state";
import { cn } from "@/lib/utils";

const PAGE_SIZES = [5, 10, 20, 50] as const;
type PageSize = (typeof PAGE_SIZES)[number];

type SortKey = "rank" | "title" | "due" | "workspace" | "newest";

const fieldClass =
  "h-10 w-full rounded-xl border border-border/50 bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-foreground/12";

export type DashboardTaskRow = Doc<"assessmentTasks"> & {
  assessmentTitle: string;
  workspaceName: string;
  columnName: string | null;
  assigneeName: string | null;
  assignees: { userId: string; name: string }[];
  githubIssueUrl: string | null;
  parentTitle: string | null;
  subIssueCount: number;
  subIssueDoneCount: number;
};

type TaskRow = DashboardTaskRow;

function descriptionSnippet(value: string | undefined | null): string {
  const plain = htmlToPlainText(value).trim();
  return plain;
}

function DraggableTaskCard({
  task,
  onEdit,
  onMarkDone,
}: {
  task: TaskRow;
  onEdit: (t: TaskRow) => void;
  onMarkDone: (t: TaskRow) => void;
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
    opacity: isDragging ? 0.45 : 1,
  };

  const assigneeLabel =
    (task.assignees ?? []).length > 0
      ? task.assignees.length <= 2
        ? task.assignees.map((a) => a.name).join(", ")
        : `${task.assignees[0]?.name ?? ""} +${task.assignees.length - 1}`
      : null;

  const desc = descriptionSnippet(task.description);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex gap-2 overflow-hidden bg-card px-3 py-3.5 transition-colors hover:bg-muted/25 sm:gap-3 sm:px-5"
    >
      <button
        type="button"
        className="text-muted-foreground hover:text-foreground -ml-0.5 flex size-11 shrink-0 cursor-grab touch-none items-center justify-center rounded-xl active:cursor-grabbing"
        aria-label="Hold og dra for å flytte"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-5" />
      </button>
      <div className="min-w-0 flex-1 overflow-hidden">
        {task.parentTaskId ? (
          <p className="text-sky-800 dark:text-sky-200 mb-0.5 flex min-w-0 items-center gap-1 text-[11px] font-medium">
            <Link2 className="size-3 shrink-0" aria-hidden />
            <span className="min-w-0 truncate">
              Under: {task.parentTitle ?? "…"}
            </span>
          </p>
        ) : task.subIssueCount > 0 ? (
          <p className="text-muted-foreground mb-0.5 text-[11px] font-medium tabular-nums">
            {task.subIssueDoneCount}/{task.subIssueCount} delkort
          </p>
        ) : null}
        <p className="line-clamp-2 text-[15px] font-medium leading-snug tracking-tight break-words">
          {task.title}
        </p>
        {desc ? (
          <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs break-words">
            {desc}
          </p>
        ) : null}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="bg-muted/80 text-muted-foreground max-w-[12rem] truncate rounded-md px-1.5 py-0.5 text-[11px] font-medium">
            {task.workspaceName}
          </span>
          {task.columnName ? (
            <span className="bg-muted/80 text-muted-foreground max-w-[10rem] truncate rounded-md px-1.5 py-0.5 text-[11px] font-medium">
              {task.columnName}
            </span>
          ) : null}
          {assigneeLabel ? (
            <span className="bg-muted/80 text-muted-foreground max-w-[10rem] truncate rounded-md px-1.5 py-0.5 text-[11px]">
              {assigneeLabel}
            </span>
          ) : null}
          {task.dueAt ? (
            <span className="bg-muted/80 text-muted-foreground rounded-md px-1.5 py-0.5 text-[11px] tabular-nums">
              {new Date(task.dueAt).toLocaleDateString("nb-NO")}
            </span>
          ) : null}
        </div>
        <Link
          href={`/w/${task.workspaceId}/a/${task.assessmentId}`}
          className="mt-1.5 block min-w-0 truncate text-xs font-medium text-foreground underline-offset-4 hover:underline"
        >
          {task.assessmentTitle} →
        </Link>
      </div>
      <div className="flex shrink-0 flex-col gap-0.5">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-11 rounded-xl text-muted-foreground hover:text-emerald-700 dark:hover:text-emerald-300 sm:size-9 sm:rounded-full"
          aria-label="Merk som ferdig"
          onClick={() => onMarkDone(task)}
        >
          <CheckCircle2 className="size-5 sm:size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-11 rounded-xl text-muted-foreground hover:text-foreground sm:size-9 sm:rounded-full"
          aria-label="Rediger"
          onClick={() => onEdit(task)}
        >
          <Pencil className="size-5 sm:size-4" />
        </Button>
      </div>
    </div>
  );
}

export function TasksBoard() {
  const tasks = useQuery(api.assessmentTasks.listMineAcrossWorkspaces, {});
  const moveTask = useMutation(api.assessmentTasks.moveTask);
  const reorderDashboard = useMutation(api.assessmentTasks.reorderDashboard);
  const updateTask = useMutation(api.assessmentTasks.update);
  const removeTask = useMutation(api.assessmentTasks.remove);
  const setParent = useMutation(api.assessmentTasks.setParent);
  const generateTaskFileUploadUrl = useMutation(
    api.assessmentTaskFiles.generateUploadUrl,
  );
  const attachTaskFile = useMutation(api.assessmentTaskFiles.attach);

  const [expanded, setExpanded] = useStickyState<boolean>(
    "tasks-board:expanded",
    false,
  );
  const [activeDrag, setActiveDrag] = useState<TaskRow | null>(null);
  const [editTask, setEditTask] = useState<TaskRow | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDue, setEditDue] = useState("");
  const [editParentId, setEditParentId] = useState<Id<"assessmentTasks"> | "">(
    "",
  );
  const [descInsertToken, setDescInsertToken] = useState<string | null>(null);
  const [statusBusy, setStatusBusy] = useState(false);
  const [isNarrow, setIsNarrow] = useState(false);
  const [pageSize, setPageSize] = useStickyState<PageSize>(
    "tasks-board:page-size",
    10,
  );
  const [sortKey, setSortKey] = useStickyState<SortKey>(
    "tasks-board:sort",
    "rank",
  );
  const [workspaceFilter, setWorkspaceFilter] = useStickyState<string>(
    "tasks-board:workspace-filter",
    "all",
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [openPage, setOpenPage] = useState(1);
  const [donePage, setDonePage] = useState(1);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const sync = () => setIsNarrow(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const workspaceForEdit = useQuery(
    api.workspaces.get,
    editTask ? { workspaceId: editTask.workspaceId } : "skip",
  );
  const assessmentAccessForEdit = useQuery(
    api.assessments.getMyAccess,
    editTask?.assessmentId
      ? { assessmentId: editTask.assessmentId }
      : "skip",
  );
  const canEdit =
    editTask?.assessmentId == null
      ? true
      : (assessmentAccessForEdit?.canEdit ?? false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 8 },
    }),
  );

  const workspaceOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of tasks ?? []) {
      map.set(String(t.workspaceId), t.workspaceName);
    }
    return [...map.entries()].sort((a, b) =>
      a[1].localeCompare(b[1], "nb"),
    );
  }, [tasks]);

  const matchesFilters = (t: TaskRow) => {
    if (
      workspaceFilter !== "all" &&
      String(t.workspaceId) !== workspaceFilter
    ) {
      return false;
    }
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    const hay = [
      t.title,
      t.description ?? "",
      t.workspaceName,
      t.columnName ?? "",
      t.assessmentTitle,
      ...(t.assignees ?? []).map((a) => a.name),
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  };

  const sortTasks = (list: TaskRow[]) => {
    const next = [...list];
    next.sort((a, b) => {
      switch (sortKey) {
        case "title":
          return a.title.localeCompare(b.title, "nb");
        case "due": {
          const ad = a.dueAt ?? Number.POSITIVE_INFINITY;
          const bd = b.dueAt ?? Number.POSITIVE_INFINITY;
          if (ad !== bd) return ad - bd;
          return a.title.localeCompare(b.title, "nb");
        }
        case "workspace": {
          const cmp = a.workspaceName.localeCompare(b.workspaceName, "nb");
          if (cmp !== 0) return cmp;
          return a.title.localeCompare(b.title, "nb");
        }
        case "newest":
          return b.createdAt - a.createdAt;
        case "rank":
        default:
          return (
            (a.dashboardRank ?? a.createdAt) - (b.dashboardRank ?? b.createdAt)
          );
      }
    });
    return next;
  };

  const openTasks = useMemo(
    () =>
      sortTasks(
        (tasks ?? []).filter((t) => t.status === "open" && matchesFilters(t)),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sort/filter helpers close over state
    [tasks, searchQuery, workspaceFilter, sortKey],
  );

  const doneTasks = useMemo(
    () =>
      sortTasks(
        (tasks ?? []).filter((t) => t.status === "done" && matchesFilters(t)),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tasks, searchQuery, workspaceFilter, sortKey],
  );

  const previewTasks = useMemo(() => openTasks.slice(0, 4), [openTasks]);

  const openIds = useMemo(() => openTasks.map((t) => t._id), [openTasks]);

  const openTotalPages = Math.max(1, Math.ceil(openTasks.length / pageSize));
  const safeOpenPage = Math.min(openPage, openTotalPages);
  const doneTotalPages = Math.max(1, Math.ceil(doneTasks.length / pageSize));
  const safeDonePage = Math.min(donePage, doneTotalPages);

  const filtersActive =
    workspaceFilter !== "all" || sortKey !== "rank" || searchQuery.trim() !== "";
  const canReorder = sortKey === "rank" && !searchQuery.trim() && workspaceFilter === "all";

  useEffect(() => {
    setOpenPage(1);
    setDonePage(1);
  }, [pageSize, searchQuery, workspaceFilter, sortKey]);

  useEffect(() => {
    if (openPage > openTotalPages) setOpenPage(openTotalPages);
  }, [openPage, openTotalPages]);

  useEffect(() => {
    if (donePage > doneTotalPages) setDonePage(doneTotalPages);
  }, [donePage, doneTotalPages]);

  const pageOpenTasks = useMemo(() => {
    const start = (safeOpenPage - 1) * pageSize;
    return openTasks.slice(start, start + pageSize);
  }, [openTasks, safeOpenPage, pageSize]);

  const pageOpenIds = useMemo(
    () => pageOpenTasks.map((t) => t._id),
    [pageOpenTasks],
  );

  const pageDoneTasks = useMemo(() => {
    const start = (safeDonePage - 1) * pageSize;
    return doneTasks.slice(start, start + pageSize);
  }, [doneTasks, safeDonePage, pageSize]);

  const openRangeStart =
    openTasks.length === 0 ? 0 : (safeOpenPage - 1) * pageSize + 1;
  const openRangeEnd = Math.min(safeOpenPage * pageSize, openTasks.length);

  function openEdit(t: TaskRow) {
    setEditTask(t);
    setEditTitle(t.title);
    setEditDescription(t.description ?? "");
    setEditDue(t.dueAt ? new Date(t.dueAt).toISOString().slice(0, 10) : "");
    setEditParentId(t.parentTaskId ?? "");
    setDescInsertToken(null);
  }

  const linkParentOptions = useMemo(() => {
    if (!editTask || !tasks) return [];
    const childrenByParent = new Map<
      Id<"assessmentTasks">,
      Id<"assessmentTasks">[]
    >();
    for (const t of tasks) {
      if (!t.parentTaskId) continue;
      const list = childrenByParent.get(t.parentTaskId) ?? [];
      list.push(t._id);
      childrenByParent.set(t.parentTaskId, list);
    }
    const descendants = new Set<Id<"assessmentTasks">>();
    const stack = [...(childrenByParent.get(editTask._id) ?? [])];
    while (stack.length > 0) {
      const id = stack.pop()!;
      if (descendants.has(id)) continue;
      descendants.add(id);
      for (const kid of childrenByParent.get(id) ?? []) stack.push(kid);
    }
    return tasks.filter(
      (t) =>
        t.assessmentId === editTask.assessmentId &&
        t._id !== editTask._id &&
        !descendants.has(t._id),
    );
  }, [editTask, tasks]);

  async function saveEdit() {
    if (!editTask) return;
    try {
      await updateTask({
        taskId: editTask._id,
        title: editTitle.trim(),
        description: isEmptyRichText(editDescription) ? null : editDescription,
        dueAt: editDue ? new Date(editDue).getTime() : null,
      });
      const nextParent = editParentId || null;
      const prevParent = editTask.parentTaskId ?? null;
      if (nextParent !== prevParent) {
        await setParent({
          taskId: editTask._id,
          parentTaskId: nextParent,
        });
      }
      setEditTask(null);
      toast.success("Oppgave lagret.");
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Kunne ikke lagre oppgaven.",
      );
    }
  }

  async function setTaskStatus(
    taskId: Id<"assessmentTasks">,
    status: "open" | "done",
  ) {
    setStatusBusy(true);
    try {
      await moveTask({ taskId, status });
      toast.success(status === "done" ? "Merket som ferdig." : "Gjenåpnet.");
      if (editTask?._id === taskId) {
        setEditTask(null);
      }
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Kunne ikke endre status.",
      );
    } finally {
      setStatusBusy(false);
    }
  }

  async function deleteTaskWithToast(
    taskId: Id<"assessmentTasks">,
  ): Promise<boolean> {
    try {
      await removeTask({ taskId });
      toast.success("Oppgave slettet.");
      return true;
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Kunne ikke slette oppgaven.",
      );
      return false;
    }
  }

  async function handleListDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    if (over.id === "done-drop") {
      try {
        await moveTask({
          taskId: active.id as Id<"assessmentTasks">,
          status: "done",
        });
        toast.success("Merket som ferdig.");
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "Kunne ikke merke som ferdig.",
        );
      }
      return;
    }
    if (active.id !== over.id) {
      if (!canReorder) return;
      const oldIndex = pageOpenIds.indexOf(active.id as Id<"assessmentTasks">);
      const newIndex = pageOpenIds.indexOf(over.id as Id<"assessmentTasks">);
      if (oldIndex >= 0 && newIndex >= 0) {
        const offset = (safeOpenPage - 1) * pageSize;
        const next = arrayMove(
          openIds,
          offset + oldIndex,
          offset + newIndex,
        );
        await reorderDashboard({ orderedTaskIds: next });
      }
    }
  }

  if (tasks === undefined) {
    return (
      <section
        id="oppgaver"
        className="scroll-mt-20 sm:scroll-mt-24"
        aria-labelledby="tasks-board-heading"
      >
        <div className="text-muted-foreground flex items-center gap-2 rounded-2xl border border-border/40 bg-muted/20 px-4 py-6 text-sm">
          <span className="border-primary size-4 shrink-0 animate-spin rounded-full border-2 border-t-transparent" />
          Laster oppgaver …
        </div>
      </section>
    );
  }

  const summaryLine =
    openTasks.length === 0
      ? doneTasks.length > 0
        ? `${doneTasks.length} ferdig · ingen åpne`
        : "Ingen kort ennå"
      : `${openTasks.length} åpne på tvers av områder`;

  const editIsDone = editTask?.status === "done";

  return (
    <section
      id="oppgaver"
      className="scroll-mt-20 min-w-0 space-y-3 overflow-x-clip sm:scroll-mt-24"
      aria-labelledby="tasks-board-heading"
    >
      <div className="overflow-hidden rounded-2xl border border-border/50 bg-card">
        <button
          type="button"
          className="flex w-full items-start gap-3 px-3.5 py-3.5 text-left transition-colors hover:bg-muted/30 touch-manipulation active:bg-muted/40 sm:items-center sm:px-5"
          aria-expanded={expanded}
          aria-controls="tasks-board-panel"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
              <h2
                id="tasks-board-heading"
                className="text-foreground text-base font-semibold tracking-tight"
              >
                Tavler på tvers
              </h2>
              <span className="text-muted-foreground text-sm tabular-nums">
                {summaryLine}
              </span>
            </div>
            <p className="text-muted-foreground text-sm">
              Kort liste over tavlekort på tvers. Kolonner og tavle styres per
              vurdering — ikke her.
            </p>
          </div>
          <ChevronDown
            className={cn(
              "text-muted-foreground mt-0.5 size-5 shrink-0 transition-transform sm:mt-0",
              expanded && "rotate-180",
            )}
            aria-hidden
          />
        </button>

        {!expanded && previewTasks.length > 0 ? (
          <ul className="divide-y divide-border/30 border-t border-border/40">
            {previewTasks.map((t) => (
              <li
                key={t._id}
                className="flex min-w-0 items-start gap-3 px-4 py-2.5 sm:items-center sm:px-5"
              >
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-sm font-medium text-foreground">
                    {t.title}
                  </p>
                  <p className="text-muted-foreground mt-0.5 truncate text-xs">
                    {[t.workspaceName, t.columnName, t.assessmentTitle]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground shrink-0 text-xs font-medium underline-offset-2 hover:underline"
                  onClick={(e) => {
                    e.stopPropagation();
                    openEdit(t);
                  }}
                >
                  Rediger
                </button>
              </li>
            ))}
            {openTasks.length > previewTasks.length ? (
              <li className="text-muted-foreground px-4 py-2 text-xs sm:px-5">
                +{openTasks.length - previewTasks.length} til — utvid for hele
                listen
              </li>
            ) : null}
          </ul>
        ) : null}
      </div>

      {expanded && tasks.length > 0 ? (
        <div id="tasks-board-panel" className="space-y-3">
          <div className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <label className="relative min-w-0 flex-1">
                <Search
                  className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
                  aria-hidden
                />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Søk i tittel, område, kolonne…"
                  className={cn(fieldClass, "pl-10")}
                  aria-label="Søk i oppgaver"
                />
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFiltersOpen((v) => !v)}
                  className={cn(
                    "inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-sm font-medium transition-colors",
                    filtersOpen || filtersActive
                      ? "border-foreground/20 bg-muted text-foreground"
                      : "border-border/50 bg-background text-muted-foreground hover:text-foreground",
                  )}
                  aria-expanded={filtersOpen}
                >
                  <SlidersHorizontal className="size-4" aria-hidden />
                  Filter
                </button>
                <label className="text-muted-foreground flex items-center gap-2 text-sm">
                  <span className="sr-only sm:not-sr-only">Per side</span>
                  <select
                    aria-label="Antall per side"
                    value={pageSize}
                    onChange={(e) =>
                      setPageSize(Number(e.target.value) as PageSize)
                    }
                    className={cn(fieldClass, "w-auto min-w-[4.5rem]")}
                  >
                    {PAGE_SIZES.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            {filtersOpen ? (
              <div className="bg-muted/15 grid gap-3 rounded-2xl border border-border/40 p-3 sm:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="text-muted-foreground text-xs font-medium">
                    Arbeidsområde
                  </span>
                  <select
                    aria-label="Filtrer på arbeidsområde"
                    value={workspaceFilter}
                    onChange={(e) => setWorkspaceFilter(e.target.value)}
                    className={fieldClass}
                  >
                    <option value="all">Alle områder</option>
                    {workspaceOptions.map(([id, name]) => (
                      <option key={id} value={id}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1.5">
                  <span className="text-muted-foreground text-xs font-medium">
                    Sortering
                  </span>
                  <select
                    aria-label="Sorter oppgaver"
                    value={sortKey}
                    onChange={(e) => setSortKey(e.target.value as SortKey)}
                    className={fieldClass}
                  >
                    <option value="rank">Egen rekkefølge</option>
                    <option value="title">Tittel A–Å</option>
                    <option value="due">Frist</option>
                    <option value="workspace">Arbeidsområde</option>
                    <option value="newest">Nyeste først</option>
                  </select>
                </label>
              </div>
            ) : null}

            <p className="text-muted-foreground text-sm">
              {canReorder
                ? "Hold i håndtaket og dra til Fullført, eller trykk ✓. Dra i listen for å endre rekkefølge."
                : "Hold i håndtaket og dra til Fullført, eller trykk ✓. Nullstill filter/sortering for å endre egen rekkefølge."}
            </p>
          </div>
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
            <div className="flex min-w-0 flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,260px)]">
              <div className="order-2 min-w-0 space-y-3 lg:order-1">
                <SortableContext
                  items={pageOpenIds}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="divide-y divide-border/40 min-w-0 self-start overflow-hidden rounded-2xl border border-border/50 bg-card">
                    {openTasks.length === 0 ? (
                      <p className="text-muted-foreground px-4 py-8 text-center text-sm">
                        {filtersActive
                          ? "Ingen treff med søk/filter"
                          : "Ingen åpne oppgaver"}
                      </p>
                    ) : (
                      pageOpenTasks.map((t) => (
                        <DraggableTaskCard
                          key={t._id}
                          task={t}
                          onEdit={openEdit}
                          onMarkDone={(task) =>
                            void setTaskStatus(task._id, "done")
                          }
                        />
                      ))
                    )}
                  </div>
                </SortableContext>
                {openTasks.length > 0 ? (
                  <PaginationBar
                    rangeStart={openRangeStart}
                    rangeEnd={openRangeEnd}
                    total={openTasks.length}
                    page={safeOpenPage}
                    totalPages={openTotalPages}
                    onPrev={() => setOpenPage((p) => Math.max(1, p - 1))}
                    onNext={() =>
                      setOpenPage((p) => Math.min(openTotalPages, p + 1))
                    }
                  />
                ) : null}
              </div>
              <div className="order-1 lg:order-2">
                <DoneDropList
                  tasks={pageDoneTasks}
                  totalDone={doneTasks.length}
                  dragActive={!!activeDrag}
                  page={safeDonePage}
                  totalPages={doneTotalPages}
                  pageSize={pageSize}
                  onPageChange={setDonePage}
                  onEdit={openEdit}
                  onRemove={(id) => void deleteTaskWithToast(id)}
                  onReopen={(id) => void setTaskStatus(id, "open")}
                />
              </div>
            </div>
            <DragOverlay>
              {activeDrag ? (
                <div className="bg-card max-w-sm overflow-hidden rounded-xl border border-emerald-500/40 p-3 shadow-lg ring-2 ring-emerald-500/20">
                  <p className="text-muted-foreground mb-1 text-[11px] font-medium">
                    Slipp på Fullført
                  </p>
                  <p className="line-clamp-2 font-medium break-words">
                    {activeDrag.title}
                  </p>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      ) : null}

      <Sheet open={!!editTask} onOpenChange={(o) => !o && setEditTask(null)}>
        <SheetContent
          side={isNarrow ? "bottom" : "right"}
          showOnDesktop
          className={cn(
            "flex flex-col overflow-hidden p-0",
            isNarrow
              ? "max-h-[92dvh] w-full rounded-t-3xl"
              : "w-full max-w-lg sm:max-w-xl",
          )}
        >
          {editTask ? (
            <>
              <div className="flex items-start justify-between gap-3 border-b border-border/50 px-4 py-4 sm:px-5">
                <div className="min-w-0 space-y-1">
                  <h2 className="font-heading text-lg font-semibold tracking-tight">
                    Rediger oppgave
                  </h2>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] font-medium",
                        editIsDone
                          ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200"
                          : "bg-sky-500/15 text-sky-800 dark:text-sky-200",
                      )}
                    >
                      {editIsDone ? "Ferdig" : "Åpen"}
                    </span>
                    {editTask.columnName ? (
                      <span className="text-muted-foreground text-xs">
                        {editTask.columnName}
                      </span>
                    ) : null}
                    <span className="text-muted-foreground text-xs">
                      · {editTask.workspaceName}
                    </span>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-10 shrink-0 rounded-full"
                  aria-label="Lukk"
                  onClick={() => setEditTask(null)}
                >
                  <X className="size-5" />
                </Button>
              </div>

              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4 sm:px-5">
                <div className="space-y-2">
                  <Label htmlFor="et-title">Tittel</Label>
                  <Input
                    id="et-title"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="min-h-11 text-base sm:min-h-10 sm:text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Beskrivelse</Label>
                  <CardDescriptionEditor
                    key={editTask._id}
                    aria-label="Beskrivelse"
                    value={editDescription}
                    onChange={setEditDescription}
                    disabled={!canEdit}
                    rows={isNarrow ? 5 : 7}
                    startInEditMode
                    insertToken={canEdit ? descInsertToken : null}
                    onInsertConsumed={() => setDescInsertToken(null)}
                    onUploadImage={
                      canEdit
                        ? async (file) => {
                            const postUrl = await generateTaskFileUploadUrl({
                              taskId: editTask._id,
                            });
                            const res = await fetch(postUrl, {
                              method: "POST",
                              headers: {
                                "Content-Type":
                                  file.type || "application/octet-stream",
                              },
                              body: file,
                            });
                            if (!res.ok) {
                              throw new Error("Opplasting feilet");
                            }
                            const json = (await res.json()) as {
                              storageId: Id<"_storage">;
                            };
                            const attached = await attachTaskFile({
                              taskId: editTask._id,
                              storageId: json.storageId,
                              fileName: file.name || "bilde.jpg",
                            });
                            if (!attached.url) {
                              throw new Error(
                                "Bildet ble lastet opp, men mangler URL",
                              );
                            }
                            const alt = (attached.fileName || "bilde").replace(
                              /[\[\]]/g,
                              "",
                            );
                            return `![${alt}](${attached.url})`;
                          }
                        : undefined
                    }
                    onCommit={
                      canEdit
                        ? async (next) => {
                            try {
                              await updateTask({
                                taskId: editTask._id,
                                description: isEmptyRichText(next)
                                  ? null
                                  : next,
                              });
                            } catch (err) {
                              toast.error(
                                err instanceof Error
                                  ? err.message
                                  : "Kunne ikke lagre avkryssing",
                              );
                              throw err;
                            }
                          }
                        : undefined
                    }
                  />
                  <TaskFileAttachments
                    taskId={editTask._id}
                    canEdit={canEdit}
                    onInsertRef={
                      canEdit
                        ? (md) => setDescInsertToken(md)
                        : undefined
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="et-due">Frist</Label>
                  <Input
                    id="et-due"
                    type="date"
                    value={editDue}
                    onChange={(e) => setEditDue(e.target.value)}
                    className="min-h-11 sm:min-h-10"
                  />
                </div>

                <div className="space-y-2 rounded-2xl border border-border/50 bg-muted/10 p-3.5">
                  <Label htmlFor="et-parent" className="flex items-center gap-1.5">
                    <Link2 className="size-3.5" aria-hidden />
                    Kobling til issue
                  </Label>
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    Velg hvilket kort dette skal ligge under.
                  </p>
                  <select
                    id="et-parent"
                    className="border-input bg-background flex h-11 w-full rounded-xl border px-3 text-sm sm:h-10"
                    value={editParentId}
                    onChange={(e) =>
                      setEditParentId(
                        e.target.value as Id<"assessmentTasks"> | "",
                      )
                    }
                    disabled={!canEdit}
                  >
                    <option value="">Ingen — toppnivå</option>
                    {linkParentOptions.map((p) => (
                      <option key={p._id} value={p._id}>
                        Under: {p.title}
                      </option>
                    ))}
                  </select>
                  {editTask.parentTaskId || editParentId ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-9 gap-1 px-2 text-xs"
                      disabled={!canEdit}
                      onClick={() => setEditParentId("")}
                    >
                      <Unlink className="size-3.5" />
                      Fjern kobling
                    </Button>
                  ) : null}
                </div>

                <TaskGithubControls
                  taskId={editTask._id}
                  canEdit={canEdit}
                  githubIssueUrl={editTask.githubIssueUrl ?? null}
                  workspaceDefaultRepos={effectiveGithubDefaultRepos(
                    workspaceForEdit ?? null,
                  )}
                />

                <Link
                  href={`/w/${editTask.workspaceId}/a/${editTask.assessmentId}`}
                  className="text-muted-foreground hover:text-foreground inline-flex text-sm font-medium underline-offset-4 hover:underline"
                >
                  Åpne i {editTask.assessmentTitle} →
                </Link>
              </div>

              <div className="safe-area-pb border-t border-border/50 bg-background/95 px-4 py-3 backdrop-blur sm:px-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap gap-2">
                    {editIsDone ? (
                      <Button
                        type="button"
                        variant="secondary"
                        className="min-h-11 flex-1 gap-1.5 sm:min-h-10 sm:flex-none"
                        disabled={statusBusy}
                        onClick={() =>
                          void setTaskStatus(editTask._id, "open")
                        }
                      >
                        Gjenåpne
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="secondary"
                        className="min-h-11 flex-1 gap-1.5 sm:min-h-10 sm:flex-none"
                        disabled={statusBusy}
                        onClick={() =>
                          void setTaskStatus(editTask._id, "done")
                        }
                      >
                        <CheckCircle2 className="size-4" aria-hidden />
                        Merk ferdig
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="size-11 shrink-0 rounded-xl sm:size-10"
                      aria-label="Slett"
                      onClick={() => {
                        if (window.confirm("Slette oppgaven permanent?")) {
                          void (async () => {
                            if (await deleteTaskWithToast(editTask._id)) {
                              setEditTask(null);
                            }
                          })();
                        }
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                  <Button
                    type="button"
                    className="min-h-11 w-full sm:min-h-10 sm:w-auto"
                    onClick={() => void saveEdit()}
                  >
                    Lagre
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </section>
  );
}

function PaginationBar({
  rangeStart,
  rangeEnd,
  total,
  page,
  totalPages,
  onPrev,
  onNext,
  compact,
}: {
  rangeStart: number;
  rangeEnd: number;
  total: number;
  page: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
  compact?: boolean;
}) {
  if (total <= 0) return null;
  return (
    <div
      className={cn(
        "flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between",
        compact && "gap-1.5",
      )}
    >
      <p
        className={cn(
          "text-muted-foreground tabular-nums",
          compact ? "text-xs" : "text-sm",
        )}
        aria-live="polite"
      >
        Viser {rangeStart}–{rangeEnd} av {total}
      </p>
      {totalPages > 1 ? (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            className="border-border/50 bg-background text-foreground hover:bg-muted/50 inline-flex h-10 items-center gap-1 rounded-xl border px-3 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-40"
            disabled={page <= 1}
            onClick={onPrev}
          >
            <ChevronLeft className="size-4" aria-hidden />
            <span className="sr-only sm:not-sr-only">Forrige</span>
          </button>
          <span className="text-muted-foreground min-w-[4.5rem] text-center text-xs tabular-nums sm:text-sm">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            className="border-border/50 bg-background text-foreground hover:bg-muted/50 inline-flex h-10 items-center gap-1 rounded-xl border px-3 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-40"
            disabled={page >= totalPages}
            onClick={onNext}
          >
            <span className="sr-only sm:not-sr-only">Neste</span>
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </div>
      ) : null}
    </div>
  );
}

function DoneDropList({
  tasks,
  totalDone,
  dragActive,
  page,
  totalPages,
  pageSize,
  onPageChange,
  onEdit,
  onRemove,
  onReopen,
}: {
  tasks: TaskRow[];
  totalDone: number;
  dragActive: boolean;
  page: number;
  totalPages: number;
  pageSize: number;
  onPageChange: (page: number | ((prev: number) => number)) => void;
  onEdit: (t: TaskRow) => void;
  onRemove: (id: Id<"assessmentTasks">) => void;
  onReopen: (id: Id<"assessmentTasks">) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: "done-drop" });
  const rangeStart = totalDone === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, totalDone);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "space-y-2 rounded-2xl border p-3 transition-all",
        isOver
          ? "border-emerald-500/60 bg-emerald-500/10 shadow-sm"
          : dragActive
            ? "border-emerald-500/40 bg-emerald-500/5"
            : "border-border/50 bg-muted/10",
      )}
    >
      <div className="flex items-center gap-2 px-0.5">
        <CheckCircle2
          className={cn(
            "size-4 shrink-0",
            isOver || dragActive
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-muted-foreground",
          )}
          aria-hidden
        />
        <p className="text-sm font-medium text-foreground">
          Fullført ({totalDone})
        </p>
      </div>
      {totalDone === 0 ? (
        <p className="text-muted-foreground px-1 py-6 text-center text-xs">
          {isOver
            ? "Slipp for å merke ferdig"
            : dragActive
              ? "Dra hit for å fullføre"
              : "Dra oppgaver hit, eller trykk ✓"}
        </p>
      ) : (
        <>
          <div className="divide-y divide-border/40 overflow-hidden rounded-xl border border-border/40 bg-card">
            {tasks.map((t) => (
              <div
                key={t._id}
                className="group/done flex items-center justify-between gap-2 px-3 py-2.5 text-sm"
              >
                <div className="min-w-0 overflow-hidden">
                  <p className="text-muted-foreground line-clamp-2 break-words line-through">
                    {t.title}
                  </p>
                  <p className="text-muted-foreground/70 truncate text-[11px]">
                    {t.workspaceName}
                  </p>
                </div>
                <div className="flex shrink-0 gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover/done:opacity-100">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-9 rounded-full text-xs"
                    onClick={() => onReopen(t._id)}
                  >
                    Gjenåpne
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-9 rounded-full text-muted-foreground hover:text-foreground"
                    aria-label="Rediger"
                    onClick={() => onEdit(t)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-9 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Slett"
                    onClick={() => onRemove(t._id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <PaginationBar
            compact
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            total={totalDone}
            page={page}
            totalPages={totalPages}
            onPrev={() => onPageChange((p) => Math.max(1, p - 1))}
            onNext={() => onPageChange((p) => Math.min(totalPages, p + 1))}
          />
        </>
      )}
    </div>
  );
}
