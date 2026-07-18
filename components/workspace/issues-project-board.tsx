"use client";

import { TaskGithubControls } from "@/components/tasks/task-github-controls";
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
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { AssessmentTaskCommentThreads } from "@/components/workspace/assessment-task-comment-threads";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "@/lib/app-toast";
import { effectiveGithubDefaultRepos } from "@/lib/github-workspace-helpers";
import { cn } from "@/lib/utils";
import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useMutation, useQuery } from "convex/react";
import {
  CalendarRange,
  Link2,
  ListTree,
  Plus,
  Search,
  Unlink,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

type BoardCard = {
  _id: Id<"assessmentTasks">;
  workspaceId: Id<"workspaces">;
  assessmentId: Id<"assessments">;
  title: string;
  description?: string;
  parentTaskId?: Id<"assessmentTasks">;
  status: "open" | "done";
  priority: number;
  startAt?: number;
  dueAt?: number;
  dashboardRank?: number;
  createdAt: number;
  assessmentTitle: string;
  assigneeName: string | null;
  assignees: { userId: Id<"users">; name: string }[];
  githubIssueUrl: string | null;
  parentTitle: string | null;
  subIssueCount: number;
  subIssueDoneCount: number;
  canEdit: boolean;
};

function clampP(p: number) {
  return Math.min(5, Math.max(1, Math.round(p)));
}

function toDateInput(ms?: number) {
  if (ms == null) return "";
  return new Date(ms).toISOString().slice(0, 10);
}

function fromDateInput(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const t = new Date(`${value}T12:00:00`).getTime();
  return Number.isNaN(t) ? undefined : t;
}

function formatDateNb(ms?: number) {
  if (ms == null) return null;
  return new Date(ms).toLocaleDateString("nb-NO", {
    day: "numeric",
    month: "short",
  });
}

function formatDateRange(startAt?: number, dueAt?: number) {
  const start = formatDateNb(startAt);
  const end = formatDateNb(dueAt);
  if (start && end) return `${start} – ${end}`;
  if (start) return `Fra ${start}`;
  if (end) return `Til ${end}`;
  return null;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

function FieldChip({
  children,
  tone = "muted",
}: {
  children: ReactNode;
  tone?: "muted" | "sky" | "green";
}) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center truncate rounded-full px-2 py-0.5 text-[11px] font-medium leading-none",
        tone === "muted" && "bg-muted text-muted-foreground",
        tone === "sky" && "bg-sky-500/15 text-sky-900 dark:text-sky-100",
        tone === "green" &&
          "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200",
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

function IssueCardView({
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
  const isSub = Boolean(card.parentTaskId);
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
        "group cursor-grab touch-manipulation rounded-md border border-border/70 bg-card p-3 text-left shadow-[0_1px_0_rgba(27,31,36,0.04)] transition-[box-shadow,border-color,opacity] active:cursor-grabbing dark:shadow-none",
        "hover:border-border",
        isDragging && "opacity-40 shadow-md ring-2 ring-sky-500/30",
        isSub && "border-l-[3px] border-l-sky-500/70",
      )}
    >
      {isSub ? (
        <p className="text-sky-800 dark:text-sky-200 mb-1 inline-flex items-center gap-1 text-[11px] font-medium">
          <Link2 className="size-3 shrink-0" aria-hidden />
          Under-sak av «{card.parentTitle ?? "…"}»
        </p>
      ) : card.subIssueCount > 0 ? (
        <p className="text-muted-foreground mb-1 text-[11px] font-medium tabular-nums">
          {card.subIssueDoneCount}/{card.subIssueCount} under-saker
        </p>
      ) : null}

      <p className="text-[13px] font-semibold leading-snug text-foreground">
        {card.title}
      </p>

      <div className="mt-2 flex flex-wrap gap-1">
        <FieldChip>P{clampP(card.priority)}</FieldChip>
        {isSub ? <FieldChip tone="sky">Under-sak</FieldChip> : null}
        {!isSub && card.subIssueCount > 0 ? (
          <FieldChip tone="green">
            {card.subIssueDoneCount}/{card.subIssueCount}
          </FieldChip>
        ) : null}
        {formatDateRange(card.startAt, card.dueAt) ? (
          <FieldChip>
            <CalendarRange className="mr-0.5 size-2.5" aria-hidden />
            {formatDateRange(card.startAt, card.dueAt)}
          </FieldChip>
        ) : null}
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-2">
        <p className="text-muted-foreground truncate text-[11px]">
          {card.assessmentTitle}
        </p>
        <AssigneeStack names={card.assignees.map((a) => a.name)} />
      </div>
    </div>
  );
}

function DraggableIssueCard({
  card,
  onOpen,
}: {
  card: BoardCard;
  onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: card._id, disabled: !card.canEdit });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div ref={setNodeRef} style={style} className="mb-2">
      <IssueCardView
        card={card}
        isDragging={isDragging}
        dragListeners={card.canEdit ? listeners : undefined}
        dragAttributes={card.canEdit ? attributes : undefined}
        onOpen={onOpen}
      />
    </div>
  );
}

function PriorityColumn({
  priority,
  count,
  children,
}: {
  priority: number;
  count: number;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `pri-${priority}` });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-[min(100%,260px)] shrink-0 flex-col rounded-lg border border-border/50 bg-muted/15",
        isOver && "border-sky-500/40 bg-sky-500/5",
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border/40 px-2.5 py-2">
        <p className="text-xs font-semibold text-foreground">P{priority}</p>
        <span className="bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums">
          {count}
        </span>
      </div>
      <div className="min-h-[120px] flex-1 p-2">{children}</div>
    </div>
  );
}

function DoneColumn({ count, children }: { count: number; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: "done-drop" });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-[min(100%,260px)] shrink-0 flex-col rounded-lg border border-border/50 bg-muted/25",
        isOver && "border-sky-500/40 bg-sky-500/5",
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border/40 px-2.5 py-2">
        <p className="text-xs font-semibold text-foreground">Ferdig</p>
        <span className="bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums">
          {count}
        </span>
      </div>
      <div className="min-h-[120px] flex-1 p-2">{children}</div>
    </div>
  );
}

export function IssuesProjectBoard({
  workspaceId,
}: {
  workspaceId: Id<"workspaces">;
}) {
  const searchParams = useSearchParams();
  const deepLinkTaskId = searchParams.get("task");
  const deepLinkHandled = useRef<string | null>(null);

  const cards = useQuery(api.assessmentTasks.listBoardByWorkspace, {
    workspaceId,
  });
  const assessments = useQuery(api.assessments.listByWorkspace, {
    workspaceId,
  });
  const workspace = useQuery(api.workspaces.get, { workspaceId });
  const members = useQuery(api.workspaces.listMembers, { workspaceId });

  const createTask = useMutation(api.assessmentTasks.create);
  const moveTask = useMutation(api.assessmentTasks.moveTask);
  const updateTask = useMutation(api.assessmentTasks.update);
  const setParent = useMutation(api.assessmentTasks.setParent);
  const setStatus = useMutation(api.assessmentTasks.setStatus);
  const removeTask = useMutation(api.assessmentTasks.remove);

  const [query, setQuery] = useState("");
  const [activeDrag, setActiveDrag] = useState<BoardCard | null>(null);
  const [selected, setSelected] = useState<BoardCard | null>(null);
  const [completePrompt, setCompletePrompt] = useState<BoardCard | null>(null);

  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPriority, setEditPriority] = useState(3);
  const [editStart, setEditStart] = useState("");
  const [editDue, setEditDue] = useState("");
  const [editAssigneeIds, setEditAssigneeIds] = useState<Id<"users">[]>([]);
  const [editParentId, setEditParentId] = useState<Id<"assessmentTasks"> | "">(
    "",
  );
  const [busy, setBusy] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [createAssessmentId, setCreateAssessmentId] = useState<
    Id<"assessments"> | ""
  >("");
  const [createParentId, setCreateParentId] = useState<
    Id<"assessmentTasks"> | ""
  >("");
  const [createStart, setCreateStart] = useState("");
  const [createDue, setCreateDue] = useState("");
  const [createAssigneeIds, setCreateAssigneeIds] = useState<Id<"users">[]>(
    [],
  );

  useEffect(() => {
    if (!selected || !cards) return;
    const fresh = cards.find((c) => c._id === selected._id);
    if (fresh) setSelected(fresh);
    else setSelected(null);
  }, [cards, selected?._id]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 8 },
    }),
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = cards ?? [];
    if (!q) return list;
    return list.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.assessmentTitle.toLowerCase().includes(q) ||
        (c.parentTitle?.toLowerCase().includes(q) ?? false),
    );
  }, [cards, query]);

  const byPriority = useMemo(() => {
    const open = filtered.filter((c) => c.status === "open");
    const map = new Map<number, BoardCard[]>();
    for (let p = 1; p <= 5; p++) map.set(p, []);
    for (const c of open) {
      map.get(clampP(c.priority))!.push(c);
    }
    return map;
  }, [filtered]);

  const doneCards = useMemo(
    () => filtered.filter((c) => c.status === "done"),
    [filtered],
  );

  const parentOptions = useMemo(() => {
    if (!cards) return [];
    return cards.filter((c) => !c.parentTaskId && c.status === "open");
  }, [cards]);

  const linkParentOptions = useMemo(() => {
    if (!selected || !cards) return [];
    return cards.filter(
      (c) =>
        c.assessmentId === selected.assessmentId &&
        c._id !== selected._id &&
        !c.parentTaskId &&
        selected.subIssueCount === 0,
    );
  }, [selected, cards]);

  const childSubIssues = useMemo(() => {
    if (!selected || !cards || selected.parentTaskId) return [];
    return cards
      .filter((c) => c.parentTaskId === selected._id)
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === "open" ? -1 : 1;
        return a.title.localeCompare(b.title, "nb");
      });
  }, [selected, cards]);

  const assessmentOptions = useMemo(() => {
    return (assessments ?? [])
      .map((a) => ({ id: a._id, title: a.title.trim() || "Uten tittel" }))
      .sort((a, b) => a.title.localeCompare(b.title, "nb"));
  }, [assessments]);

  const memberOptions = useMemo(() => {
    return (members ?? [])
      .map((m) => ({
        userId: m.userId as Id<"users">,
        label: m.name?.trim() || m.email || "Medlem",
      }))
      .sort((a, b) => a.label.localeCompare(b.label, "nb"));
  }, [members]);

  const openDetail = (card: BoardCard) => {
    setSelected(card);
    setEditTitle(card.title);
    setEditDescription(card.description ?? "");
    setEditPriority(clampP(card.priority));
    setEditStart(toDateInput(card.startAt));
    setEditDue(toDateInput(card.dueAt));
    setEditAssigneeIds(card.assignees.map((a) => a.userId));
    setEditParentId(card.parentTaskId ?? "");
  };

  useEffect(() => {
    if (!deepLinkTaskId || !cards || deepLinkHandled.current === deepLinkTaskId) {
      return;
    }
    const card = cards.find((c) => c._id === deepLinkTaskId);
    if (card) {
      deepLinkHandled.current = deepLinkTaskId;
      openDetail(card);
    }
    // openDetail er stabil nok for deep-link ved last
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkTaskId, cards]);

  const requestComplete = (card: BoardCard) => {
    const openChildren =
      !card.parentTaskId &&
      (cards ?? []).some(
        (c) => c.parentTaskId === card._id && c.status === "open",
      );
    if (openChildren) {
      setCompletePrompt(card);
      return;
    }
    void finishComplete(card, false);
  };

  const finishComplete = async (
    card: BoardCard,
    completeSubIssues: boolean,
  ) => {
    setBusy(true);
    try {
      await setStatus({
        taskId: card._id,
        status: "done",
        completeSubIssues,
      });
      toast.success(
        completeSubIssues
          ? "Hovedsak og under-saker markert ferdig"
          : "Sak markert ferdig",
      );
      setCompletePrompt(null);
      if (selected?._id === card._id) setSelected(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kunne ikke fullføre");
    } finally {
      setBusy(false);
    }
  };

  const openCreateAsSub = (parent: BoardCard) => {
    setCreateOpen(true);
    setCreateTitle("");
    setCreateAssessmentId(parent.assessmentId);
    setCreateParentId(parent._id);
    setCreateStart(toDateInput(parent.startAt));
    setCreateDue(toDateInput(parent.dueAt));
    setCreateAssigneeIds([]);
  };

  const onDragStart = (e: DragStartEvent) => {
    const card = (cards ?? []).find((c) => c._id === e.active.id);
    setActiveDrag(card ?? null);
  };

  const onDragEnd = async (e: DragEndEvent) => {
    setActiveDrag(null);
    const { active, over } = e;
    if (!over) return;
    const card = (cards ?? []).find((c) => c._id === active.id);
    if (!card || !card.canEdit) return;

    const overId = String(over.id);
    try {
      if (overId === "done-drop") {
        if (card.status !== "done") {
          const openChildren =
            !card.parentTaskId &&
            (cards ?? []).some(
              (c) => c.parentTaskId === card._id && c.status === "open",
            );
          if (openChildren) {
            setCompletePrompt(card);
            return;
          }
          await moveTask({ taskId: card._id, status: "done" });
        }
        return;
      }
      if (overId.startsWith("pri-")) {
        const p = Number(overId.slice(4));
        if (p >= 1 && p <= 5) {
          await moveTask({
            taskId: card._id,
            priority: p,
            status: "open",
          });
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kunne ikke flytte");
    }
  };

  const saveDetail = async () => {
    if (!selected) return;
    const startAt = fromDateInput(editStart);
    const dueAt = fromDateInput(editDue);
    if (!startAt || !dueAt) {
      toast.error("Start- og sluttdato er påkrevd");
      return;
    }
    if (startAt > dueAt) {
      toast.error("Startdato kan ikke være etter sluttdato");
      return;
    }
    setBusy(true);
    try {
      await updateTask({
        taskId: selected._id,
        title: editTitle.trim(),
        description: editDescription.trim() || null,
        priority: editPriority,
        startAt,
        dueAt,
        assigneeUserIds: editAssigneeIds,
      });
      const nextParent = editParentId || null;
      const prevParent = selected.parentTaskId ?? null;
      if (nextParent !== prevParent) {
        await setParent({ taskId: selected._id, parentTaskId: nextParent });
      }
      toast.success("Sak lagret");
      setSelected(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kunne ikke lagre");
    } finally {
      setBusy(false);
    }
  };

  const submitCreate = async () => {
    const title = createTitle.trim();
    if (!title) {
      toast.error("Tittel mangler");
      return;
    }
    if (!createAssessmentId) {
      toast.error("Velg hvilken vurdering saken hører til");
      return;
    }
    const startAt = fromDateInput(createStart);
    const dueAt = fromDateInput(createDue);
    if (!startAt || !dueAt) {
      toast.error("Start- og sluttdato er påkrevd");
      return;
    }
    if (startAt > dueAt) {
      toast.error("Startdato kan ikke være etter sluttdato");
      return;
    }
    setBusy(true);
    try {
      await createTask({
        assessmentId: createAssessmentId,
        title,
        parentTaskId: createParentId || undefined,
        startAt,
        dueAt,
        assigneeUserIds:
          createAssigneeIds.length > 0 ? createAssigneeIds : undefined,
      });
      toast.success(
        createParentId
          ? "Under-sak opprettet som eget kort"
          : "Issue opprettet",
      );
      setCreateOpen(false);
      setCreateTitle("");
      setCreateParentId("");
      setCreateStart("");
      setCreateDue("");
      setCreateAssigneeIds([]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kunne ikke opprette");
    } finally {
      setBusy(false);
    }
  };

  if (cards === undefined) {
    return (
      <div className="space-y-3">
        <div className="bg-muted/40 h-10 animate-pulse rounded-md" />
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="bg-muted/40 h-72 w-[260px] shrink-0 animate-pulse rounded-lg"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filtrer saker…"
            aria-label="Filtrer saker"
            className="border-input bg-background focus:border-sky-500 focus:ring-sky-500 h-8 w-full rounded-md border py-1 pr-3 pl-8 text-sm outline-none focus:ring-1"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-muted-foreground text-xs tabular-nums">
            {filtered.length} kort
          </p>
          <Button
            type="button"
            size="sm"
            className="h-8 rounded-md"
            onClick={() => {
              setCreateOpen(true);
              setCreateTitle("");
              setCreateParentId("");
              setCreateStart("");
              setCreateDue("");
              setCreateAssessmentId(assessmentOptions[0]?.id ?? "");
              setCreateAssigneeIds([]);
            }}
          >
            <Plus className="size-3.5" />
            Nytt issue
          </Button>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragEnd={(e) => void onDragEnd(e)}
      >
        <div className="flex gap-3 overflow-x-auto pb-2">
          {[1, 2, 3, 4, 5].map((p) => {
            const col = byPriority.get(p) ?? [];
            return (
              <PriorityColumn key={p} priority={p} count={col.length}>
                {col.map((card) => (
                  <DraggableIssueCard
                    key={card._id}
                    card={card}
                    onOpen={() => openDetail(card)}
                  />
                ))}
              </PriorityColumn>
            );
          })}
          <DoneColumn count={doneCards.length}>
            {doneCards.map((card) => (
              <DraggableIssueCard
                key={card._id}
                card={card}
                onOpen={() => openDetail(card)}
              />
            ))}
          </DoneColumn>
        </div>
        <DragOverlay>
          {activeDrag ? (
            <div className="w-[244px]">
              <IssueCardView
                card={activeDrag}
                isDragging
                onOpen={() => undefined}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {filtered.length === 0 ? (
        <p className="text-muted-foreground rounded-xl border border-dashed px-4 py-10 text-center text-sm">
          Ingen saker ennå. Opprett et issue — under-saker blir egne kort på
          tavlen når du kobler dem.
        </p>
      ) : null}

      {/* Create issue / sub-issue */}
      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent side="right" showOnDesktop className="w-full max-w-md">
          <div className="border-b pb-4">
            <h2 className="font-heading text-lg font-semibold">
              {createParentId ? "Ny under-sak" : "Nytt issue"}
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Blir et eget kort på tavlen
              {createParentId ? ", koblet til foreldre-issue" : ""}.
            </p>
          </div>
          <div className="mt-6 space-y-4 px-1">
            <div className="space-y-1">
              <Label htmlFor="create-title">Tittel</Label>
              <Input
                id="create-title"
                value={createTitle}
                onChange={(e) => setCreateTitle(e.target.value)}
                placeholder="Hva skal gjøres?"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="create-assessment">Vurdering</Label>
              <select
                id="create-assessment"
                className="border-input bg-background flex h-9 w-full rounded-lg border px-2 text-sm"
                value={createAssessmentId}
                onChange={(e) => {
                  setCreateAssessmentId(
                    e.target.value as Id<"assessments"> | "",
                  );
                  setCreateParentId("");
                }}
              >
                <option value="">Velg vurdering …</option>
                {assessmentOptions.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="create-parent">Kobling (valgfritt)</Label>
              <select
                id="create-parent"
                className="border-input bg-background flex h-9 w-full rounded-lg border px-2 text-sm"
                value={createParentId}
                onChange={(e) =>
                  setCreateParentId(
                    e.target.value as Id<"assessmentTasks"> | "",
                  )
                }
                disabled={!createAssessmentId}
              >
                <option value="">Ingen — selvstendig issue</option>
                {parentOptions
                  .filter((p) => p.assessmentId === createAssessmentId)
                  .map((p) => (
                    <option key={p._id} value={p._id}>
                      Under-sak av «{p.title}»
                    </option>
                  ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="create-start">Startdato</Label>
                <Input
                  id="create-start"
                  type="date"
                  value={createStart}
                  onChange={(e) => setCreateStart(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="create-due">Sluttdato</Label>
                <Input
                  id="create-due"
                  type="date"
                  value={createDue}
                  onChange={(e) => setCreateDue(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Tildel (valgfritt)</Label>
              <div className="flex max-h-36 flex-col gap-1 overflow-y-auto rounded-lg border border-border/50 p-1.5">
                {memberOptions.map((m) => {
                  const selectedM = createAssigneeIds.includes(m.userId);
                  return (
                    <button
                      key={m.userId}
                      type="button"
                      onClick={() =>
                        setCreateAssigneeIds((prev) =>
                          selectedM
                            ? prev.filter((id) => id !== m.userId)
                            : [...prev, m.userId],
                        )
                      }
                      className={cn(
                        "rounded-lg px-2.5 py-2 text-left text-sm",
                        selectedM ? "bg-muted" : "hover:bg-muted/50",
                      )}
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <Button
              type="button"
              disabled={
                busy ||
                !createTitle.trim() ||
                !createAssessmentId ||
                !createStart ||
                !createDue
              }
              onClick={() => void submitCreate()}
            >
              Opprett kort
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Detail */}
      <Sheet
        open={!!selected}
        onOpenChange={(o) => {
          if (!o) setSelected(null);
        }}
      >
        <SheetContent side="right" showOnDesktop className="w-full max-w-md">
          <div className="border-b pb-4">
            <h2 className="font-heading text-lg font-semibold">Sak</h2>
            {selected ? (
              <Link
                href={`/w/${workspaceId}/a/${selected.assessmentId}`}
                className="text-muted-foreground hover:text-foreground mt-1 inline-block text-xs font-medium underline-offset-2 hover:underline"
              >
                {selected.assessmentTitle} →
              </Link>
            ) : null}
          </div>
          {selected ? (
            <div className="mt-6 space-y-4 px-1">
              <div className="space-y-1">
                <Label htmlFor="detail-title">Tittel</Label>
                <Input
                  id="detail-title"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  disabled={!selected.canEdit}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="detail-desc">Beskrivelse</Label>
                <Textarea
                  id="detail-desc"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={4}
                  disabled={!selected.canEdit}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="detail-prio">Prioritet (1–5)</Label>
                <Input
                  id="detail-prio"
                  type="number"
                  min={1}
                  max={5}
                  value={editPriority}
                  onChange={(e) =>
                    setEditPriority(Number(e.target.value) || 3)
                  }
                  disabled={!selected.canEdit}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="detail-start">Startdato</Label>
                  <Input
                    id="detail-start"
                    type="date"
                    value={editStart}
                    onChange={(e) => setEditStart(e.target.value)}
                    disabled={!selected.canEdit}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="detail-due">Sluttdato</Label>
                  <Input
                    id="detail-due"
                    type="date"
                    value={editDue}
                    onChange={(e) => setEditDue(e.target.value)}
                    disabled={!selected.canEdit}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Tildelt</Label>
                <p className="text-muted-foreground text-[11px]">
                  Nye tildelte får varsel. De får også varsel ved nye
                  kommentarer.
                </p>
                <div className="flex max-h-36 flex-col gap-1 overflow-y-auto rounded-lg border border-border/50 p-1.5">
                  {memberOptions.map((m) => {
                    const on = editAssigneeIds.includes(m.userId);
                    return (
                      <button
                        key={m.userId}
                        type="button"
                        disabled={!selected.canEdit}
                        onClick={() =>
                          setEditAssigneeIds((prev) =>
                            on
                              ? prev.filter((id) => id !== m.userId)
                              : [...prev, m.userId],
                          )
                        }
                        className={cn(
                          "rounded-lg px-2.5 py-2 text-left text-sm",
                          on ? "bg-muted" : "hover:bg-muted/50",
                          !selected.canEdit && "opacity-60",
                        )}
                      >
                        {m.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {!selected.parentTaskId && childSubIssues.length > 0 ? (
                <div className="space-y-2 rounded-xl border border-border/50 bg-muted/10 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="flex items-center gap-1.5 text-sm font-medium">
                      <ListTree className="size-3.5" aria-hidden />
                      Under-saker
                    </p>
                    <span className="text-muted-foreground text-xs tabular-nums">
                      {selected.subIssueDoneCount}/{selected.subIssueCount}{" "}
                      ferdig
                    </span>
                  </div>
                  <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                    <div
                      className="bg-foreground/70 h-full rounded-full"
                      style={{
                        width: `${
                          selected.subIssueCount > 0
                            ? Math.round(
                                (selected.subIssueDoneCount /
                                  selected.subIssueCount) *
                                  100,
                              )
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                  <ul className="space-y-1.5">
                    {childSubIssues.map((child) => (
                      <li key={child._id}>
                        <button
                          type="button"
                          className="hover:bg-muted/60 flex w-full items-start justify-between gap-2 rounded-lg border border-border/40 bg-card px-2.5 py-2 text-left text-sm"
                          onClick={() => openDetail(child)}
                        >
                          <span className="min-w-0">
                            <span
                              className={cn(
                                "block font-medium leading-snug",
                                child.status === "done" &&
                                  "text-muted-foreground line-through",
                              )}
                            >
                              {child.title}
                            </span>
                            <span className="text-muted-foreground text-[11px]">
                              {formatDateRange(child.startAt, child.dueAt) ??
                                "Mangler datoer"}
                              {child.assigneeName
                                ? ` · ${child.assigneeName}`
                                : ""}
                            </span>
                          </span>
                          <span
                            className={cn(
                              "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                              child.status === "done"
                                ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200"
                                : "bg-muted text-muted-foreground",
                            )}
                          >
                            {child.status === "done" ? "Ferdig" : "Åpen"}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="space-y-1.5 rounded-xl border border-border/50 bg-muted/10 p-3">
                <Label className="flex items-center gap-1.5">
                  <Link2 className="size-3.5" aria-hidden />
                  Kobling til issue
                </Label>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  Under-sak er et eget kort. Her velger du hvilket issue det
                  kobles til — eller fjerner koblingen.
                </p>
                {selected.subIssueCount > 0 ? (
                  <p className="text-muted-foreground text-xs">
                    Dette issue har under-saker og kan ikke selv bli under-sak.
                  </p>
                ) : (
                  <select
                    className="border-input bg-background flex h-9 w-full rounded-lg border px-2 text-sm"
                    value={editParentId}
                    onChange={(e) =>
                      setEditParentId(
                        e.target.value as Id<"assessmentTasks"> | "",
                      )
                    }
                    disabled={!selected.canEdit}
                  >
                    <option value="">Ingen — selvstendig issue</option>
                    {linkParentOptions.map((p) => (
                      <option key={p._id} value={p._id}>
                        Under-sak av «{p.title}»
                      </option>
                    ))}
                  </select>
                )}
                {selected.parentTaskId || editParentId ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8 gap-1 px-2 text-xs"
                    disabled={!selected.canEdit}
                    onClick={() => setEditParentId("")}
                  >
                    <Unlink className="size-3.5" />
                    Fjern kobling
                  </Button>
                ) : null}
              </div>

              {selected.canEdit && !selected.parentTaskId ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    const parent = selected;
                    setSelected(null);
                    openCreateAsSub(parent);
                  }}
                >
                  <Plus className="size-3.5" />
                  Opprett under-sak (eget kort)
                </Button>
              ) : null}

              <TaskGithubControls
                taskId={selected._id}
                canEdit={selected.canEdit}
                githubIssueUrl={selected.githubIssueUrl}
                workspaceDefaultRepos={effectiveGithubDefaultRepos(
                  workspace ?? null,
                )}
              />

              <div className="border-border/40 border-t pt-4">
                <AssessmentTaskCommentThreads
                  workspaceId={workspaceId}
                  taskId={selected._id}
                />
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                {selected.canEdit ? (
                  <>
                    <Button
                      type="button"
                      disabled={busy}
                      onClick={() => void saveDetail()}
                    >
                      Lagre
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busy}
                      onClick={() => {
                        if (selected.status === "open") {
                          requestComplete(selected);
                        } else {
                          void setStatus({
                            taskId: selected._id,
                            status: "open",
                          }).then(() => setSelected(null));
                        }
                      }}
                    >
                      {selected.status === "open" ? "Marker ferdig" : "Gjenåpne"}
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={busy}
                      onClick={() => {
                        if (
                          window.confirm("Slette denne saken permanent?")
                        ) {
                          void removeTask({ taskId: selected._id }).then(
                            () => {
                              setSelected(null);
                              toast.success("Sak slettet");
                            },
                          );
                        }
                      }}
                    >
                      Slett
                    </Button>
                  </>
                ) : null}
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      <Dialog
        open={!!completePrompt}
        onOpenChange={(o) => {
          if (!o) setCompletePrompt(null);
        }}
      >
        <DialogContent size="sm" titleId="complete-parent-title">
          <DialogHeader>
            <h2
              id="complete-parent-title"
              className="font-heading text-lg font-semibold"
            >
              Marker hovedsak ferdig?
            </h2>
          </DialogHeader>
          <DialogBody className="space-y-2 text-sm">
            <p>
              «{completePrompt?.title}» har åpne under-saker. Velg om de også
              skal markeres ferdig.
            </p>
            <p className="text-muted-foreground text-xs">
              Under-saker forblir egne kort på tavlen uansett.
            </p>
          </DialogBody>
          <DialogFooter className="flex flex-col gap-2 sm:flex-col">
            <Button
              type="button"
              disabled={busy || !completePrompt}
              onClick={() =>
                completePrompt &&
                void finishComplete(completePrompt, true)
              }
            >
              Fullfør hovedsak og under-saker
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy || !completePrompt}
              onClick={() =>
                completePrompt &&
                void finishComplete(completePrompt, false)
              }
            >
              Kun hovedsak
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => setCompletePrompt(null)}
            >
              Avbryt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
