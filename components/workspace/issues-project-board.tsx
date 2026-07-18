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
import { Textarea } from "@/components/ui/textarea";
import { AssessmentTaskCommentThreads } from "@/components/workspace/assessment-task-comment-threads";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "@/lib/app-toast";
import { effectiveGithubDefaultRepos } from "@/lib/github-workspace-helpers";
import { pulsBoardCopy } from "@/lib/puls-board-copy";
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
  Shield,
  Unlink,
  Workflow,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

type LinkedProcess = {
  id: Id<"candidates">;
  name: string;
  code: string;
};

type LinkedRos = {
  id: Id<"rosAnalyses">;
  title: string;
  status: string;
};

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
  depth: number;
  subIssueCount: number;
  subIssueDoneCount: number;
  linkedProcesses: LinkedProcess[];
  linkedRos: LinkedRos[];
  canEdit: boolean;
};

/** Normaliser kort fra API (eldre payloads uten arrays). */
function normalizeBoardCard(raw: BoardCard): BoardCard {
  return {
    ...raw,
    depth: raw.depth ?? 0,
    linkedProcesses: Array.isArray(raw.linkedProcesses)
      ? raw.linkedProcesses
      : [],
    linkedRos: Array.isArray(raw.linkedRos) ? raw.linkedRos : [],
    assignees: Array.isArray(raw.assignees) ? raw.assignees : [],
  };
}

type DetailTab = "oversikt" | "koblinger" | "kommentarer" | "mer";

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

function parentOptionLabel(card: BoardCard) {
  const prefix = card.depth > 0 ? `${"↳ ".repeat(Math.min(card.depth, 5))}` : "";
  return `${prefix}${card.title}`;
}

function collectDescendantIds(
  rootId: Id<"assessmentTasks">,
  cards: BoardCard[],
): Set<Id<"assessmentTasks">> {
  const childrenByParent = new Map<
    Id<"assessmentTasks">,
    Id<"assessmentTasks">[]
  >();
  for (const c of cards) {
    if (!c.parentTaskId) continue;
    const list = childrenByParent.get(c.parentTaskId) ?? [];
    list.push(c._id);
    childrenByParent.set(c.parentTaskId, list);
  }
  const out = new Set<Id<"assessmentTasks">>();
  const stack = [...(childrenByParent.get(rootId) ?? [])];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (out.has(id)) continue;
    out.add(id);
    for (const kid of childrenByParent.get(id) ?? []) stack.push(kid);
  }
  return out;
}

function hasOpenDescendants(card: BoardCard, cards: BoardCard[]) {
  const desc = collectDescendantIds(card._id, cards);
  return cards.some((c) => desc.has(c._id) && c.status === "open");
}

function FieldChip({
  children,
  tone = "muted",
}: {
  children: ReactNode;
  tone?: "muted" | "sky" | "green" | "violet";
}) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center truncate rounded-full px-2 py-0.5 text-[11px] font-medium leading-none",
        tone === "muted" && "bg-muted text-muted-foreground",
        tone === "sky" && "bg-sky-500/15 text-sky-900 dark:text-sky-100",
        tone === "green" &&
          "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200",
        tone === "violet" &&
          "bg-violet-500/15 text-violet-900 dark:text-violet-100",
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
  const process = card.linkedProcesses[0];
  const extraProcesses = Math.max(0, card.linkedProcesses.length - 1);

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
        "group cursor-grab touch-manipulation rounded-lg border border-border/70 bg-card p-3 text-left shadow-[0_1px_0_rgba(27,31,36,0.04)] transition-[box-shadow,border-color,opacity] active:cursor-grabbing dark:shadow-none",
        "hover:border-border",
        isDragging && "opacity-40 shadow-md ring-2 ring-sky-500/30",
        isSub && "border-l-[3px] border-l-sky-500/70",
      )}
    >
      {isSub ? (
        <p className="text-sky-800 dark:text-sky-200 mb-1 inline-flex items-center gap-1 text-[11px] font-medium">
          <Link2 className="size-3 shrink-0" aria-hidden />
          {pulsBoardCopy.underOf(card.parentTitle ?? "…")}
          {card.depth > 1 ? (
            <span className="text-muted-foreground font-normal">
              · nivå {card.depth}
            </span>
          ) : null}
        </p>
      ) : card.subIssueCount > 0 ? (
        <p className="text-muted-foreground mb-1 text-[11px] font-medium tabular-nums">
          {card.subIssueDoneCount}/{card.subIssueCount} delkort
        </p>
      ) : null}

      <p className="text-[13px] font-semibold leading-snug text-foreground">
        {card.title}
      </p>

      <div className="mt-2 flex flex-wrap gap-1">
        <FieldChip>P{clampP(card.priority)}</FieldChip>
        {isSub ? (
          <FieldChip tone="sky">{pulsBoardCopy.subcardChip}</FieldChip>
        ) : null}
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
        {process ? (
          <FieldChip tone="violet">
            <Workflow className="mr-0.5 size-2.5" aria-hidden />
            {process.code || process.name}
            {extraProcesses > 0 ? ` +${extraProcesses}` : ""}
          </FieldChip>
        ) : null}
        {card.linkedRos.length > 0 ? (
          <FieldChip>
            <Shield className="mr-0.5 size-2.5" aria-hidden />
            ROS
            {card.linkedRos.length > 1 ? ` +${card.linkedRos.length - 1}` : ""}
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
        "flex w-[min(100%,280px)] shrink-0 flex-col rounded-xl border border-border/50 bg-muted/20",
        isOver && "border-sky-500/50 bg-sky-500/8 ring-1 ring-sky-500/20",
      )}
    >
      <div className="sticky top-0 z-[1] flex items-center justify-between gap-2 rounded-t-xl border-b border-border/40 bg-muted/40 px-3 py-2.5 backdrop-blur-sm">
        <div>
          <p className="text-xs font-semibold tracking-wide text-foreground">
            Prioritet {priority}
          </p>
          <p className="text-muted-foreground text-[10px]">P{priority}</p>
        </div>
        <span className="bg-background/80 text-muted-foreground rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums shadow-xs">
          {count}
        </span>
      </div>
      <div className="min-h-[160px] flex-1 p-2.5">{children}</div>
    </div>
  );
}

function DoneColumn({ count, children }: { count: number; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: "done-drop" });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-[min(100%,280px)] shrink-0 flex-col rounded-xl border border-border/50 bg-muted/30",
        isOver && "border-sky-500/50 bg-sky-500/8 ring-1 ring-sky-500/20",
      )}
    >
      <div className="sticky top-0 z-[1] flex items-center justify-between gap-2 rounded-t-xl border-b border-border/40 bg-muted/50 px-3 py-2.5 backdrop-blur-sm">
        <div>
          <p className="text-xs font-semibold tracking-wide text-foreground">
            Ferdig
          </p>
          <p className="text-muted-foreground text-[10px]">Fullført</p>
        </div>
        <span className="bg-background/80 text-muted-foreground rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums shadow-xs">
          {count}
        </span>
      </div>
      <div className="min-h-[160px] flex-1 p-2.5">{children}</div>
    </div>
  );
}

const DETAIL_TABS: { id: DetailTab; label: string }[] = [
  { id: "oversikt", label: "Oversikt" },
  { id: "koblinger", label: "Koblinger" },
  { id: "kommentarer", label: "Kommentarer" },
  { id: "mer", label: "Mer" },
];

export function IssuesProjectBoard({
  workspaceId,
}: {
  workspaceId: Id<"workspaces">;
}) {
  const searchParams = useSearchParams();
  const deepLinkTaskId = searchParams.get("task");
  const deepLinkHandled = useRef<string | null>(null);

  const cardsRaw = useQuery(api.assessmentTasks.listBoardByWorkspace, {
    workspaceId,
  });
  const cards = useMemo(
    () => (cardsRaw ?? []).map((c) => normalizeBoardCard(c as BoardCard)),
    [cardsRaw],
  );
  const cardsLoaded = cardsRaw !== undefined;
  const assessments = useQuery(api.assessments.listByWorkspace, {
    workspaceId,
  });
  const workspace = useQuery(api.workspaces.get, { workspaceId });
  const members = useQuery(api.workspaces.listMembers, { workspaceId });
  const processes = useQuery(api.candidates.listByWorkspace, { workspaceId });
  const rosAnalyses = useQuery(api.ros.listAnalyses, { workspaceId });

  const createTask = useMutation(api.assessmentTasks.create);
  const moveTask = useMutation(api.assessmentTasks.moveTask);
  const updateTask = useMutation(api.assessmentTasks.update);
  const setParent = useMutation(api.assessmentTasks.setParent);
  const setStatus = useMutation(api.assessmentTasks.setStatus);
  const removeTask = useMutation(api.assessmentTasks.remove);
  const linkProcess = useMutation(api.candidates.linkAssessment);
  const linkRos = useMutation(api.ros.linkAssessment);

  const [query, setQuery] = useState("");
  const [processFilter, setProcessFilter] = useState<Id<"candidates"> | "">(
    "",
  );
  const [activeDrag, setActiveDrag] = useState<BoardCard | null>(null);
  const [selected, setSelected] = useState<BoardCard | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("oversikt");
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
  const [linkCandidateId, setLinkCandidateId] = useState<Id<"candidates"> | "">(
    "",
  );
  const [linkRosId, setLinkRosId] = useState<Id<"rosAnalyses"> | "">("");
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
    if (!selected || !cardsLoaded) return;
    const fresh = cards.find((c) => c._id === selected._id);
    if (fresh) setSelected(fresh);
    else setSelected(null);
  }, [cards, cardsLoaded, selected?._id]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 8 },
    }),
  );

  const processFilterOptions = useMemo(() => {
    const map = new Map<Id<"candidates">, LinkedProcess>();
    for (const c of cards) {
      for (const p of c.linkedProcesses) map.set(p.id, p);
    }
    return [...map.values()].sort((a, b) =>
      (a.code || a.name).localeCompare(b.code || b.name, "nb"),
    );
  }, [cards]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = cards;
    if (processFilter) {
      list = list.filter((c) =>
        c.linkedProcesses.some((p) => p.id === processFilter),
      );
    }
    if (!q) return list;
    return list.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.assessmentTitle.toLowerCase().includes(q) ||
        (c.parentTitle?.toLowerCase().includes(q) ?? false) ||
        c.linkedProcesses.some(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.code.toLowerCase().includes(q),
        ),
    );
  }, [cards, query, processFilter]);

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

  const createParentOptions = useMemo(() => {
    if (!createAssessmentId) return [];
    return cards
      .filter((c) => c.assessmentId === createAssessmentId)
      .sort((a, b) => {
        if (a.depth !== b.depth) return a.depth - b.depth;
        return a.title.localeCompare(b.title, "nb");
      });
  }, [cards, createAssessmentId]);

  const linkParentOptions = useMemo(() => {
    if (!selected) return [];
    const blocked = collectDescendantIds(selected._id, cards);
    return cards
      .filter(
        (c) =>
          c.assessmentId === selected.assessmentId &&
          c._id !== selected._id &&
          !blocked.has(c._id),
      )
      .sort((a, b) => {
        if (a.depth !== b.depth) return a.depth - b.depth;
        return a.title.localeCompare(b.title, "nb");
      });
  }, [selected, cards]);

  const childSubIssues = useMemo(() => {
    if (!selected) return [];
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

  const availableProcessesToLink = useMemo(() => {
    if (!selected || !processes) return [];
    const linked = new Set(selected.linkedProcesses.map((p) => p.id));
    return processes
      .filter((p) => !linked.has(p._id))
      .sort((a, b) => a.name.localeCompare(b.name, "nb"));
  }, [selected, processes]);

  const availableRosToLink = useMemo(() => {
    if (!selected || !rosAnalyses) return [];
    const linked = new Set(selected.linkedRos.map((r) => r.id));
    return rosAnalyses
      .filter((r) => !linked.has(r._id))
      .map((r) => ({ id: r._id as Id<"rosAnalyses">, title: r.title as string }))
      .sort((a, b) => a.title.localeCompare(b.title, "nb"));
  }, [selected, rosAnalyses]);

  const openDetail = (card: BoardCard) => {
    setSelected(card);
    setDetailTab("oversikt");
    setEditTitle(card.title);
    setEditDescription(card.description ?? "");
    setEditPriority(clampP(card.priority));
    setEditStart(toDateInput(card.startAt));
    setEditDue(toDateInput(card.dueAt));
    setEditAssigneeIds(card.assignees.map((a) => a.userId));
    setEditParentId(card.parentTaskId ?? "");
    setLinkCandidateId("");
    setLinkRosId("");
  };

  useEffect(() => {
    if (
      !deepLinkTaskId ||
      !cardsLoaded ||
      deepLinkHandled.current === deepLinkTaskId
    ) {
      return;
    }
    const card = cards.find((c) => c._id === deepLinkTaskId);
    if (card) {
      deepLinkHandled.current = deepLinkTaskId;
      openDetail(card);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkTaskId, cards, cardsLoaded]);

  const requestComplete = (card: BoardCard) => {
    if (hasOpenDescendants(card, cards)) {
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
          ? pulsBoardCopy.completedTree
          : pulsBoardCopy.completed,
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
    const card = cards.find((c) => c._id === e.active.id);
    setActiveDrag(card ?? null);
  };

  const onDragEnd = async (e: DragEndEvent) => {
    setActiveDrag(null);
    const { active, over } = e;
    if (!over) return;
    const card = cards.find((c) => c._id === active.id);
    if (!card || !card.canEdit) return;

    const overId = String(over.id);
    try {
      if (overId === "done-drop") {
        if (card.status !== "done") {
          if (hasOpenDescendants(card, cards)) {
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
      toast.success(pulsBoardCopy.saved);
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
      toast.error("Velg hvilken vurdering kortet hører til");
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
        createParentId ? pulsBoardCopy.createdSub : pulsBoardCopy.created,
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

  if (!cardsLoaded) {
    return (
      <div className="space-y-3">
        <div className="bg-muted/40 h-10 animate-pulse rounded-md" />
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="bg-muted/40 h-72 w-[280px] shrink-0 animate-pulse rounded-xl"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-col gap-3">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1 sm:max-w-xs">
            <Search
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2"
              aria-hidden
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={pulsBoardCopy.filterPlaceholder}
              aria-label={pulsBoardCopy.filterAria}
              className="border-input bg-background focus:border-sky-500 focus:ring-sky-500 h-9 w-full rounded-lg border py-1 pr-3 pl-8 text-sm outline-none focus:ring-1"
            />
          </div>
          <select
            aria-label={pulsBoardCopy.processFilterAria}
            className="border-input bg-background h-9 w-full rounded-lg border px-2 text-sm sm:w-auto sm:min-w-[12rem]"
            value={processFilter}
            onChange={(e) =>
              setProcessFilter(e.target.value as Id<"candidates"> | "")
            }
          >
            <option value="">{pulsBoardCopy.allProcesses}</option>
            {processFilterOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code ? `${p.code} — ${p.name}` : p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-muted-foreground text-xs tabular-nums">
            {pulsBoardCopy.cardCount(filtered.length)}
          </p>
          <Button
            type="button"
            size="sm"
            className="h-9 rounded-lg"
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
            {pulsBoardCopy.newCard}
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
            <div className="w-[260px]">
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
          {pulsBoardCopy.emptyBoard}
        </p>
      ) : null}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent size="md" titleId="create-issue-title">
          <DialogHeader>
            <h2
              id="create-issue-title"
              className="font-heading text-lg font-semibold"
            >
              {createParentId
                ? pulsBoardCopy.createSubTitle
                : pulsBoardCopy.createTitle}
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              {createParentId
                ? pulsBoardCopy.createHintSub
                : pulsBoardCopy.createHint}
            </p>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="create-title">Tittel</Label>
              <Input
                id="create-title"
                value={createTitle}
                onChange={(e) => setCreateTitle(e.target.value)}
                placeholder="Hva skal gjøres?"
                className="min-h-11 sm:min-h-9"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="create-assessment">Vurdering</Label>
              <select
                id="create-assessment"
                className="border-input bg-background flex min-h-11 w-full rounded-lg border px-2 text-sm sm:min-h-9"
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
              <Label htmlFor="create-parent">{pulsBoardCopy.parentLabel}</Label>
              <select
                id="create-parent"
                className="border-input bg-background flex min-h-11 w-full rounded-lg border px-2 text-sm sm:min-h-9"
                value={createParentId}
                onChange={(e) =>
                  setCreateParentId(
                    e.target.value as Id<"assessmentTasks"> | "",
                  )
                }
                disabled={!createAssessmentId}
              >
                <option value="">{pulsBoardCopy.parentNone}</option>
                {createParentOptions.map((p) => (
                  <option key={p._id} value={p._id}>
                    {pulsBoardCopy.parentUnder(parentOptionLabel(p))}
                  </option>
                ))}
              </select>
              <p className="text-muted-foreground text-[11px]">
                {pulsBoardCopy.parentHint}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="create-start">Startdato</Label>
                <Input
                  id="create-start"
                  type="date"
                  value={createStart}
                  onChange={(e) => setCreateStart(e.target.value)}
                  required
                  className="min-h-11 sm:min-h-9"
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
                  className="min-h-11 sm:min-h-9"
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
                        "min-h-11 rounded-lg px-2.5 py-2 text-left text-sm touch-manipulation sm:min-h-9",
                        selectedM ? "bg-muted" : "hover:bg-muted/50",
                      )}
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="min-h-11 touch-manipulation sm:min-h-9"
              onClick={() => setCreateOpen(false)}
            >
              Avbryt
            </Button>
            <Button
              type="button"
              className="min-h-11 touch-manipulation sm:min-h-9"
              disabled={
                busy ||
                !createTitle.trim() ||
                !createAssessmentId ||
                !createStart ||
                !createDue
              }
              onClick={() => void submitCreate()}
            >
              Opprett
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!selected}
        onOpenChange={(o) => {
          if (!o) setSelected(null);
        }}
      >
        <DialogContent size="lg" titleId="issue-detail-title">
          <DialogHeader>
            <h2
              id="issue-detail-title"
              className="font-heading text-lg font-semibold"
            >
              {pulsBoardCopy.detailTitle}
            </h2>
            {selected ? (
              <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">
                {selected.title}
              </p>
            ) : null}
            <div className="mt-3 flex gap-1 overflow-x-auto">
              {DETAIL_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setDetailTab(tab.id)}
                  className={cn(
                    "min-h-9 shrink-0 rounded-lg px-3 text-sm font-medium touch-manipulation",
                    detailTab === tab.id
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </DialogHeader>
          {selected ? (
            <>
              <DialogBody className="space-y-4">
                {detailTab === "oversikt" ? (
                  <>
                    <div className="space-y-1">
                      <Label htmlFor="detail-title">Tittel</Label>
                      <Input
                        id="detail-title"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        disabled={!selected.canEdit}
                        className="min-h-11 sm:min-h-9"
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
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div className="space-y-1">
                        <Label htmlFor="detail-prio">Prioritet</Label>
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
                          className="min-h-11 sm:min-h-9"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="detail-start">Startdato</Label>
                        <Input
                          id="detail-start"
                          type="date"
                          value={editStart}
                          onChange={(e) => setEditStart(e.target.value)}
                          disabled={!selected.canEdit}
                          required
                          className="min-h-11 sm:min-h-9"
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
                          className="min-h-11 sm:min-h-9"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Tildelt</Label>
                      <p className="text-muted-foreground text-[11px]">
                        Nye tildelte får varsel ved tildeling og kommentarer.
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
                                "min-h-11 rounded-lg px-2.5 py-2 text-left text-sm touch-manipulation sm:min-h-9",
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
                  </>
                ) : null}

                {detailTab === "koblinger" ? (
                  <>
                    <div className="space-y-2 rounded-xl border border-border/50 bg-muted/10 p-3">
                      <Label className="flex items-center gap-1.5">
                        <ListTree className="size-3.5" aria-hidden />
                        Vurdering
                      </Label>
                      <Link
                        href={`/w/${workspaceId}/a/${selected.assessmentId}`}
                        className="text-foreground hover:text-foreground/80 inline-flex min-h-10 items-center text-sm font-medium underline-offset-2 touch-manipulation hover:underline"
                      >
                        {selected.assessmentTitle} →
                      </Link>
                    </div>

                    <div className="space-y-2 rounded-xl border border-border/50 bg-muted/10 p-3">
                      <Label className="flex items-center gap-1.5">
                        <Workflow className="size-3.5" aria-hidden />
                        Prosesser
                      </Label>
                      {selected.linkedProcesses.length > 0 ? (
                        <ul className="flex flex-wrap gap-1.5">
                          {selected.linkedProcesses.map((p) => (
                            <li key={p.id}>
                              <Link
                                href={`/w/${workspaceId}/vurderinger?fane=prosesser&rediger=${p.id}`}
                                className="bg-violet-500/15 text-violet-900 dark:text-violet-100 inline-flex min-h-8 items-center rounded-full px-2.5 text-xs font-medium"
                              >
                                {p.code ? `${p.code} — ` : ""}
                                {p.name}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-muted-foreground text-xs">
                          Ingen prosess koblet til vurderingen ennå.
                        </p>
                      )}
                      {selected.canEdit && availableProcessesToLink.length > 0 ? (
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <select
                            className="border-input bg-background min-h-11 flex-1 rounded-lg border px-2 text-sm sm:min-h-9"
                            value={linkCandidateId}
                            onChange={(e) =>
                              setLinkCandidateId(
                                e.target.value as Id<"candidates"> | "",
                              )
                            }
                          >
                            <option value="">Koble prosess …</option>
                            {availableProcessesToLink.map((p) => (
                              <option key={p._id} value={p._id}>
                                {p.code ? `${p.code} — ` : ""}
                                {p.name}
                              </option>
                            ))}
                          </select>
                          <Button
                            type="button"
                            size="sm"
                            className="min-h-11 touch-manipulation sm:min-h-9"
                            disabled={busy || !linkCandidateId}
                            onClick={() => {
                              if (!linkCandidateId) return;
                              void linkProcess({
                                candidateId: linkCandidateId,
                                assessmentId: selected.assessmentId,
                              })
                                .then(() => {
                                  toast.success("Prosess koblet til vurderingen");
                                  setLinkCandidateId("");
                                })
                                .catch((err: unknown) =>
                                  toast.error(
                                    err instanceof Error
                                      ? err.message
                                      : "Kunne ikke koble",
                                  ),
                                );
                            }}
                          >
                            Koble
                          </Button>
                        </div>
                      ) : null}
                    </div>

                    <div className="space-y-2 rounded-xl border border-border/50 bg-muted/10 p-3">
                      <Label className="flex items-center gap-1.5">
                        <Shield className="size-3.5" aria-hidden />
                        ROS
                      </Label>
                      {selected.linkedRos.length > 0 ? (
                        <ul className="space-y-1.5">
                          {selected.linkedRos.map((r) => (
                            <li key={r.id}>
                              <Link
                                href={`/w/${workspaceId}/ros/a/${r.id}`}
                                className="hover:bg-muted/60 flex min-h-10 items-center justify-between gap-2 rounded-lg border border-border/40 bg-card px-2.5 py-2 text-sm"
                              >
                                <span className="truncate font-medium">
                                  {r.title}
                                </span>
                                <span className="text-muted-foreground shrink-0 text-[11px]">
                                  {r.status}
                                </span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-muted-foreground text-xs">
                          Ingen ROS koblet til vurderingen ennå.
                        </p>
                      )}
                      {selected.canEdit && availableRosToLink.length > 0 ? (
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <select
                            className="border-input bg-background min-h-11 flex-1 rounded-lg border px-2 text-sm sm:min-h-9"
                            value={linkRosId}
                            onChange={(e) =>
                              setLinkRosId(
                                e.target.value as Id<"rosAnalyses"> | "",
                              )
                            }
                          >
                            <option value="">Koble ROS …</option>
                            {availableRosToLink.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.title}
                              </option>
                            ))}
                          </select>
                          <Button
                            type="button"
                            size="sm"
                            className="min-h-11 touch-manipulation sm:min-h-9"
                            disabled={busy || !linkRosId}
                            onClick={() => {
                              if (!linkRosId) return;
                              void linkRos({
                                analysisId: linkRosId,
                                assessmentId: selected.assessmentId,
                              })
                                .then(() => {
                                  toast.success("ROS koblet til vurderingen");
                                  setLinkRosId("");
                                })
                                .catch((err: unknown) =>
                                  toast.error(
                                    err instanceof Error
                                      ? err.message
                                      : "Kunne ikke koble",
                                  ),
                                );
                            }}
                          >
                            Koble
                          </Button>
                        </div>
                      ) : null}
                    </div>

                    <div className="space-y-1.5 rounded-xl border border-border/50 bg-muted/10 p-3">
                      <Label className="flex items-center gap-1.5">
                        <Link2 className="size-3.5" aria-hidden />
                        {pulsBoardCopy.parentLabel}
                      </Label>
                      <p className="text-muted-foreground text-xs leading-relaxed">
                        {pulsBoardCopy.parentHint}
                      </p>
                      <select
                        className="border-input bg-background flex min-h-11 w-full rounded-lg border px-2 text-sm sm:min-h-9"
                        value={editParentId}
                        onChange={(e) =>
                          setEditParentId(
                            e.target.value as Id<"assessmentTasks"> | "",
                          )
                        }
                        disabled={!selected.canEdit}
                      >
                        <option value="">{pulsBoardCopy.parentNone}</option>
                        {linkParentOptions.map((p) => (
                          <option key={p._id} value={p._id}>
                            {pulsBoardCopy.parentUnder(parentOptionLabel(p))}
                          </option>
                        ))}
                      </select>
                      {selected.parentTaskId || editParentId ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="min-h-11 gap-1 px-2 text-xs touch-manipulation sm:min-h-8"
                          disabled={!selected.canEdit}
                          onClick={() => setEditParentId("")}
                        >
                          <Unlink className="size-3.5" />
                          Fjern kobling
                        </Button>
                      ) : null}
                    </div>

                    {childSubIssues.length > 0 ? (
                      <div className="space-y-2 rounded-xl border border-border/50 bg-muted/10 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="flex items-center gap-1.5 text-sm font-medium">
                            <ListTree className="size-3.5" aria-hidden />
                            {pulsBoardCopy.directSubcards}
                          </p>
                          <span className="text-muted-foreground text-xs tabular-nums">
                            {selected.subIssueDoneCount}/
                            {selected.subIssueCount} ferdig
                          </span>
                        </div>
                        <ul className="space-y-1.5">
                          {childSubIssues.map((child) => (
                            <li key={child._id}>
                              <button
                                type="button"
                                className="hover:bg-muted/60 flex min-h-11 w-full items-start justify-between gap-2 rounded-lg border border-border/40 bg-card px-2.5 py-2 text-left text-sm touch-manipulation"
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
                                    {formatDateRange(
                                      child.startAt,
                                      child.dueAt,
                                    ) ?? "Mangler datoer"}
                                    {child.subIssueCount > 0
                                      ? ` · ${child.subIssueDoneCount}/${child.subIssueCount} under`
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

                    {selected.canEdit ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="min-h-11 w-full touch-manipulation sm:min-h-9"
                        onClick={() => {
                          const parent = selected;
                          setSelected(null);
                          openCreateAsSub(parent);
                        }}
                      >
                        <Plus className="size-3.5" />
                        {pulsBoardCopy.createSubcardCta}
                      </Button>
                    ) : null}
                  </>
                ) : null}

                {detailTab === "kommentarer" ? (
                  <AssessmentTaskCommentThreads
                    workspaceId={workspaceId}
                    taskId={selected._id}
                  />
                ) : null}

                {detailTab === "mer" ? (
                  <>
                    <TaskGithubControls
                      taskId={selected._id}
                      canEdit={selected.canEdit}
                      githubIssueUrl={selected.githubIssueUrl}
                      workspaceDefaultRepos={effectiveGithubDefaultRepos(
                        workspace ?? null,
                      )}
                    />
                    {selected.canEdit ? (
                      <Button
                        type="button"
                        variant="destructive"
                        className="min-h-11 w-full touch-manipulation sm:min-h-9"
                        disabled={busy}
                        onClick={() => {
                          if (
                            window.confirm("Slette dette kortet permanent?")
                          ) {
                            void removeTask({ taskId: selected._id }).then(
                              () => {
                                setSelected(null);
                                toast.success(pulsBoardCopy.deleted);
                              },
                            );
                          }
                        }}
                      >
                        Slett kort
                      </Button>
                    ) : null}
                  </>
                ) : null}
              </DialogBody>
              <DialogFooter>
                {selected.canEdit && detailTab === "oversikt" ? (
                  <>
                    <Button
                      type="button"
                      className="min-h-11 touch-manipulation sm:min-h-9"
                      disabled={busy}
                      onClick={() => void saveDetail()}
                    >
                      Lagre
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-11 touch-manipulation sm:min-h-9"
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
                      {selected.status === "open"
                        ? "Marker ferdig"
                        : "Gjenåpne"}
                    </Button>
                  </>
                ) : selected.canEdit && detailTab === "koblinger" ? (
                  <Button
                    type="button"
                    className="min-h-11 touch-manipulation sm:min-h-9"
                    disabled={busy}
                    onClick={() => void saveDetail()}
                  >
                    Lagre koblinger
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11 touch-manipulation sm:min-h-9"
                    onClick={() => setSelected(null)}
                  >
                    Lukk
                  </Button>
                )}
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!completePrompt}
        onOpenChange={(o) => {
          if (!o) setCompletePrompt(null);
        }}
      >
        <DialogContent
          size="sm"
          titleId="complete-parent-title"
          portalClassName="z-[210]"
        >
          <DialogHeader>
            <h2
              id="complete-parent-title"
              className="font-heading text-lg font-semibold"
            >
              Marker ferdig?
            </h2>
          </DialogHeader>
          <DialogBody className="space-y-2 text-sm">
            <p>
              {completePrompt
                ? pulsBoardCopy.completePromptBody(completePrompt.title)
                : null}
            </p>
          </DialogBody>
          <DialogFooter className="flex flex-col gap-2 sm:flex-col">
            <Button
              type="button"
              className="min-h-11 w-full touch-manipulation"
              disabled={busy || !completePrompt}
              onClick={() =>
                completePrompt && void finishComplete(completePrompt, true)
              }
            >
              {pulsBoardCopy.completeAll}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-11 w-full touch-manipulation"
              disabled={busy || !completePrompt}
              onClick={() =>
                completePrompt && void finishComplete(completePrompt, false)
              }
            >
              {pulsBoardCopy.completeOnly}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="min-h-11 w-full touch-manipulation"
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
