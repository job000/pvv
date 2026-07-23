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
import { CardDescriptionEditor } from "@/components/ui/card-description-editor";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/user-avatar";
import { AssessmentTaskCommentThreads } from "@/components/workspace/assessment-task-comment-threads";
import { TaskFileAttachments } from "@/components/workspace/task-file-attachments";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "@/lib/app-toast";
import { effectiveGithubDefaultRepos } from "@/lib/github-workspace-helpers";
import { pulsBoardCopy, pulsBoardPath } from "@/lib/puls-board-copy";
import {
  PULS_ISSUE_TYPE_ALIASES,
  PULS_ISSUE_TYPE_OPTIONS,
} from "@/lib/puls-issue-types";
import { removeMarkdownTaskByLabel } from "@/lib/markdown-tasks";
import { htmlToPlainText, isEmptyRichText } from "@/lib/rich-text";
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
import { FilterToolbar } from "@/components/ui/filter-toolbar";
import {
  SearchableSelect,
  type SearchableSelectOption,
} from "@/components/ui/searchable-select";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  AlignStartHorizontal,
  ChevronDown,
  Circle,
  Columns3,
  ExternalLink,
  Filter,
  Link2,
  ListTree,
  Maximize2,
  Minimize2,
  Plus,
  Search,
  Shield,
  Table2,
  Trash2,
  Unlink,
  User,
  UserRoundX,
  Workflow,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

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

type BoardLinkKind =
  | "none"
  | "assessment"
  | "process"
  | "ros"
  | "pdd"
  | "form";

type BoardCard = {
  _id: Id<"assessmentTasks">;
  workspaceId: Id<"workspaces">;
  assessmentId: Id<"assessments"> | null;
  candidateId?: Id<"candidates"> | null;
  rosAnalysisId?: Id<"rosAnalyses"> | null;
  processDesignDocumentId?: Id<"processDesignDocuments"> | null;
  intakeFormId?: Id<"intakeForms"> | null;
  boardId?: Id<"pulsBoards"> | null;
  columnId?: Id<"pulsBoardColumns"> | null;
  title: string;
  description?: string;
  parentTaskId?: Id<"assessmentTasks">;
  status: "open" | "done";
  priority: number;
  startAt?: number;
  dueAt?: number;
  labels?: string[];
  issueType?: string;
  priorityLabel?: string;
  size?: string;
  estimate?: number;
  milestone?: string;
  dashboardRank?: number;
  createdAt: number;
  assessmentTitle: string;
  linkKind?: BoardLinkKind;
  linkLabel?: string;
  linkHref?: string | null;
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

/** Kortflate: priority/size/labels — maks 3 badges. */
function cardPropertyBadges(card: BoardCard): string[] {
  const out: string[] = [];
  if (card.priorityLabel?.trim()) out.push(card.priorityLabel.trim());
  if (out.length < 3 && card.size?.trim()) out.push(card.size.trim());
  for (const label of card.labels ?? []) {
    if (out.length >= 3) break;
    const t = label.trim();
    if (t) out.push(t);
  }
  return out;
}

/** Norske valg for egenskap-dropdowns (map også vanlige GitHub-engelske verdier). */
const ISSUE_TYPE_OPTIONS = PULS_ISSUE_TYPE_OPTIONS;
const PRIORITY_LABEL_OPTIONS = ["Kritisk", "Høy", "Middels", "Lav"] as const;
const SIZE_OPTIONS = ["XS", "S", "M", "L", "XL"] as const;
const ESTIMATE_OPTIONS = ["1", "2", "3", "5", "8", "13", "21"] as const;

const ISSUE_TYPE_ALIASES: Record<string, string> = PULS_ISSUE_TYPE_ALIASES;

const PRIORITY_LABEL_ALIASES: Record<string, string> = {
  urgent: "Kritisk",
  kritisk: "Kritisk",
  haster: "Kritisk",
  high: "Høy",
  høy: "Høy",
  hoy: "Høy",
  medium: "Middels",
  middels: "Middels",
  low: "Lav",
  lav: "Lav",
};

function optionsWithCurrent(options: readonly string[], current: string): string[] {
  const t = current.trim();
  if (!t) return [...options];
  if (options.some((o) => o.toLowerCase() === t.toLowerCase())) {
    return [...options];
  }
  return [t, ...options];
}

/** Match preset / alias (case-insensitive); ellers behold importert verdi. */
function matchSelectOption(
  options: readonly string[],
  aliases: Record<string, string>,
  current: string | undefined,
): string {
  const t = current?.trim() ?? "";
  if (!t) return "";
  const viaAlias = aliases[t.toLowerCase()];
  if (viaAlias) return viaAlias;
  return options.find((o) => o.toLowerCase() === t.toLowerCase()) ?? t;
}

function matchEstimateOption(estimate: number | undefined): string {
  if (estimate == null || !Number.isFinite(estimate)) return "";
  const hit = ESTIMATE_OPTIONS.find((o) => Number(o) === estimate);
  return hit ?? String(estimate);
}

type MemberOption = { userId: Id<"users">; label: string };

function MetaRow({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:items-center sm:gap-x-4">
      <div className="min-w-0">
        <p className="text-muted-foreground text-xs font-medium tracking-wide">
          {label}
        </p>
        {hint ? (
          <p className="text-muted-foreground/80 mt-0.5 hidden text-[11px] leading-snug sm:block">
            {hint}
          </p>
        ) : null}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function CompactSelect({
  id,
  value,
  onChange,
  disabled,
  options,
  "aria-label": ariaLabel,
  allowClear = true,
  clearLabel = "Ingen",
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  options: SearchableSelectOption[];
  "aria-label": string;
  allowClear?: boolean;
  clearLabel?: string;
}) {
  return (
    <SearchableSelect
      id={id}
      value={value}
      onChange={onChange}
      options={options}
      disabled={disabled}
      aria-label={ariaLabel}
      allowClear={allowClear}
      clearLabel={clearLabel}
      placeholder={clearLabel}
      className="max-w-sm"
      triggerClassName="h-10 min-h-10 rounded-lg"
    />
  );
}

function AssigneePicker({
  selectedIds,
  members,
  canEdit,
  onChange,
  emptyLabel = "Ingen tildelt",
}: {
  selectedIds: Id<"users">[];
  members: MemberOption[];
  canEdit: boolean;
  onChange: (ids: Id<"users">[]) => void;
  emptyLabel?: string;
}) {
  const selected = selectedIds
    .map((id) => members.find((m) => m.userId === id))
    .filter((m): m is MemberOption => Boolean(m));
  const available = members.filter((m) => !selectedIds.includes(m.userId));

  return (
    <div className="space-y-2">
      {selected.length === 0 ? (
        <p className="text-muted-foreground text-sm">{emptyLabel}</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {selected.map((m) => (
            <li key={m.userId}>
              <span className="bg-muted/70 ring-border/50 inline-flex max-w-[14rem] items-center gap-1.5 rounded-full py-0.5 pl-0.5 pr-1 ring-1">
                <UserAvatar
                  name={m.label}
                  size="sm"
                  className="size-6 text-[10px] ring-1"
                />
                <span className="truncate text-sm font-medium">{m.label}</span>
                {canEdit ? (
                  <button
                    type="button"
                    aria-label={`Fjern ${m.label}`}
                    className="text-muted-foreground hover:bg-background hover:text-foreground touch-manipulation rounded-full p-1"
                    onClick={() =>
                      onChange(selectedIds.filter((id) => id !== m.userId))
                    }
                  >
                    <X className="size-3.5" aria-hidden />
                  </button>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}
      {canEdit && available.length > 0 ? (
        <SearchableSelect
          value=""
          onChange={(next) => {
            const id = next as Id<"users">;
            if (!id) return;
            if (selectedIds.includes(id)) return;
            onChange([...selectedIds, id]);
          }}
          options={available.map((m) => ({
            value: m.userId,
            label: m.label,
          }))}
          aria-label="Legg til tildelt"
          placeholder="Legg til person…"
          allowClear={false}
          className="max-w-xs"
          triggerClassName="h-9 min-h-9 rounded-lg"
        />
      ) : null}
    </div>
  );
}

function LabelChipsEditor({
  labels,
  canEdit,
  draft,
  onDraftChange,
  onChange,
}: {
  labels: string[];
  canEdit: boolean;
  draft: string;
  onDraftChange: (value: string) => void;
  onChange: (labels: string[]) => void;
}) {
  const addLabel = () => {
    const t = draft.trim().slice(0, 40);
    if (!t) return;
    if (labels.some((l) => l.toLowerCase() === t.toLowerCase())) {
      onDraftChange("");
      return;
    }
    onChange([...labels, t].slice(0, 20));
    onDraftChange("");
  };

  return (
    <div className="space-y-2">
      {labels.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {labels.map((label) => (
            <li key={label}>
              <span className="bg-sky-500/10 text-sky-950 dark:text-sky-100 ring-sky-500/20 inline-flex max-w-full items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1">
                <span className="truncate">{label}</span>
                {canEdit ? (
                  <button
                    type="button"
                    aria-label={`Fjern ${label}`}
                    className="hover:bg-sky-500/15 touch-manipulation rounded-full p-0.5"
                    onClick={() => onChange(labels.filter((l) => l !== label))}
                  >
                    <X className="size-3" aria-hidden />
                  </button>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-sm">Ingen etiketter</p>
      )}
      {canEdit ? (
        <div className="flex max-w-sm min-w-0 gap-2">
          <Input
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              addLabel();
            }}
            placeholder="Ny etikett…"
            className="h-9 min-w-0 flex-1"
            aria-label="Ny etikett"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!draft.trim()}
            className="h-9 shrink-0"
            onClick={addLabel}
          >
            Legg til
          </Button>
        </div>
      ) : null}
    </div>
  );
}

type BoardColumnDoc = {
  _id: Id<"pulsBoardColumns">;
  name: string;
  order: number;
  isDone: boolean;
};

/** Normaliser kort fra API (eldre payloads uten arrays). */
function normalizeBoardCard(raw: BoardCard): BoardCard {
  const linkKind = raw.linkKind ?? (raw.assessmentId ? "assessment" : "none");
  const linkLabel =
    raw.linkLabel?.trim() ||
    raw.assessmentTitle?.trim() ||
    (linkKind === "none" ? "Uten kobling" : "Kobling");
  return {
    ...raw,
    assessmentId: raw.assessmentId ?? null,
    candidateId: raw.candidateId ?? null,
    rosAnalysisId: raw.rosAnalysisId ?? null,
    processDesignDocumentId: raw.processDesignDocumentId ?? null,
    intakeFormId: raw.intakeFormId ?? null,
    depth: raw.depth ?? 0,
    columnId: raw.columnId ?? null,
    labels: Array.isArray(raw.labels) ? raw.labels : undefined,
    linkedProcesses: Array.isArray(raw.linkedProcesses)
      ? raw.linkedProcesses
      : [],
    linkedRos: Array.isArray(raw.linkedRos) ? raw.linkedRos : [],
    assignees: Array.isArray(raw.assignees) ? raw.assignees : [],
    linkKind,
    linkLabel,
    linkHref: raw.linkHref ?? null,
    assessmentTitle: raw.assessmentTitle?.trim() || linkLabel,
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
        <UserAvatar
          key={name}
          name={name}
          size="sm"
          className="size-5 border-2 border-card text-[9px] ring-0"
        />
      ))}
      {names.length > 3 ? (
        <span className="text-muted-foreground pl-1.5 text-[10px] tabular-nums">
          +{names.length - 3}
        </span>
      ) : null}
    </div>
  );
}

/** Kort utdrag av beskrivelse til tavlekort (én linje). */
function cardDescriptionPreview(
  description: string | undefined,
  maxChars = 88,
): string | null {
  if (!description?.trim() || isEmptyRichText(description)) return null;
  const plain = htmlToPlainText(description)
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^[\t ]*(?:[-*+]|\d+\.)\s+\[[ xX]\]\s+/gm, "")
    .replace(/^[\t ]*(?:[-*+]|\d+\.)\s+/gm, "")
    .replace(/[*_`~]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!plain) return null;
  if (plain.length <= maxChars) return plain;
  return `${plain.slice(0, maxChars - 1).trimEnd()}…`;
}

function IssueCardView({
  card,
  columnLabel,
  isDragging,
  dragListeners,
  dragAttributes,
  onOpen,
  showDescription = false,
}: {
  card: BoardCard;
  columnLabel?: string;
  isDragging?: boolean;
  dragListeners?: object;
  dragAttributes?: object;
  onOpen: () => void;
  showDescription?: boolean;
}) {
  const isSub = Boolean(card.parentTaskId);
  const process = card.linkedProcesses[0];
  const extraProcesses = Math.max(0, card.linkedProcesses.length - 1);
  const descriptionPreview = showDescription
    ? cardDescriptionPreview(card.description)
    : null;

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

      {descriptionPreview ? (
        <p className="text-muted-foreground mt-1 line-clamp-2 text-[11px] leading-snug">
          {descriptionPreview}
        </p>
      ) : null}

      <div className="mt-2 flex flex-wrap gap-1">
        <FieldChip>
          {columnLabel ?? `P${clampP(card.priority)}`}
        </FieldChip>
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
        {cardPropertyBadges(card).map((badge) => (
          <FieldChip key={badge}>{badge}</FieldChip>
        ))}
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
          {card.linkLabel || card.assessmentTitle}
        </p>
        <AssigneeStack names={card.assignees.map((a) => a.name)} />
      </div>
    </div>
  );
}

function DraggableIssueCard({
  card,
  columnLabel,
  onOpen,
  showDescription = false,
}: {
  card: BoardCard;
  columnLabel?: string;
  onOpen: () => void;
  showDescription?: boolean;
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
        columnLabel={columnLabel}
        isDragging={isDragging}
        dragListeners={card.canEdit ? listeners : undefined}
        dragAttributes={card.canEdit ? attributes : undefined}
        onOpen={onOpen}
        showDescription={showDescription}
      />
    </div>
  );
}

type BoardViewLayout = "board" | "table" | "roadmap";

type AssigneeFilter = "all" | "me" | "unassigned" | Id<"users">;
type CardTypeFilter = "all" | "top" | "sub";
type StatusFilter = "all" | "open" | "done";
type DueFilter = "all" | "overdue" | "week" | "none";

type BoardFilters = {
  query: string;
  assignee: AssigneeFilter;
  columnId: Id<"pulsBoardColumns"> | "";
  cardType: CardTypeFilter;
  status: StatusFilter;
  processId: Id<"candidates"> | "";
  assessmentId: Id<"assessments"> | "";
  due: DueFilter;
};

const DEFAULT_FILTERS: BoardFilters = {
  query: "",
  assignee: "all",
  columnId: "",
  cardType: "all",
  status: "all",
  processId: "",
  assessmentId: "",
  due: "all",
};

const COLUMN_PAGE_SIZE = 24;

function filtersToPersist(filters: BoardFilters) {
  return {
    query: filters.query,
    assignee: filters.assignee,
    columnId: filters.columnId,
    cardType: filters.cardType,
    status: filters.status,
    due: filters.due,
    processId: filters.processId,
    assessmentId: filters.assessmentId,
  };
}

/** Convex lagrer Id-felt som string — map tilbake til BoardFilters. */
function filtersFromPersist(
  raw: Partial<{
    query: string;
    assignee: string;
    columnId: string;
    cardType: CardTypeFilter;
    status: StatusFilter;
    due: DueFilter;
    processId: string;
    assessmentId: string;
  }> | null | undefined,
): BoardFilters {
  const merged = { ...DEFAULT_FILTERS, ...raw };
  const assignee: AssigneeFilter =
    merged.assignee === "all" ||
    merged.assignee === "me" ||
    merged.assignee === "unassigned"
      ? merged.assignee
      : (merged.assignee as Id<"users">);
  return {
    query: merged.query,
    assignee,
    columnId: (merged.columnId || "") as Id<"pulsBoardColumns"> | "",
    cardType: merged.cardType,
    status: merged.status,
    due: merged.due,
    processId: (merged.processId || "") as Id<"candidates"> | "",
    assessmentId: (merged.assessmentId || "") as Id<"assessments"> | "",
  };
}

function startOfTodayMs() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function endOfWeekMs() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  d.setDate(d.getDate() + 7);
  return d.getTime();
}

type BoardViewDoc = {
  _id: Id<"pulsBoardViews">;
  boardId: Id<"pulsBoards">;
  name: string;
  layout: BoardViewLayout;
  filters: {
    query: string;
    assignee: string;
    columnId: string;
    cardType: CardTypeFilter;
    status: StatusFilter;
    due: DueFilter;
    processId: string;
    assessmentId: string;
  };
  order: number;
};

function layoutFromLegacy(mode: string | undefined): BoardViewLayout {
  if (mode === "table") return "table";
  if (mode === "list" || mode === "roadmap") return "roadmap";
  return "board";
}

function filtersFromView(view: BoardViewDoc): BoardFilters {
  return filtersFromPersist(view.filters);
}

function layoutIcon(layout: BoardViewLayout) {
  if (layout === "table") return Table2;
  if (layout === "roadmap") return AlignStartHorizontal;
  return Columns3;
}

function RoadmapView({
  cards,
  onOpenCard,
}: {
  cards: BoardCard[];
  onOpenCard: (card: BoardCard) => void;
}) {
  const range = useMemo(() => {
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (const c of cards) {
      if (c.startAt != null) {
        min = Math.min(min, c.startAt);
        max = Math.max(max, c.startAt);
      }
      if (c.dueAt != null) {
        min = Math.min(min, c.dueAt);
        max = Math.max(max, c.dueAt);
      }
    }
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      const now = Date.now();
      const start = new Date(now);
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setMonth(end.getMonth() + 3);
      return { startMs: start.getTime(), endMs: end.getTime() };
    }
    const start = new Date(min);
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(max);
    end.setMonth(end.getMonth() + 1);
    end.setDate(1);
    end.setHours(0, 0, 0, 0);
    if (end.getTime() <= start.getTime()) {
      end.setMonth(end.getMonth() + 2);
    }
    return { startMs: start.getTime(), endMs: end.getTime() };
  }, [cards]);

  const months = useMemo(() => {
    const out: { label: string; ms: number }[] = [];
    const cur = new Date(range.startMs);
    while (cur.getTime() < range.endMs) {
      out.push({
        label: cur.toLocaleDateString("nb-NO", {
          month: "short",
          year: "2-digit",
        }),
        ms: cur.getTime(),
      });
      cur.setMonth(cur.getMonth() + 1);
    }
    return out.length > 0 ? out : [{ label: "—", ms: range.startMs }];
  }, [range]);

  const span = Math.max(1, range.endMs - range.startMs);
  const withDates = cards.filter((c) => c.startAt != null || c.dueAt != null);
  const withoutDates = cards.filter((c) => c.startAt == null && c.dueAt == null);

  const barStyle = (card: BoardCard) => {
    const start = card.startAt ?? card.dueAt!;
    const end = card.dueAt ?? card.startAt!;
    const left = Math.max(0, Math.min(1, (start - range.startMs) / span));
    const right = Math.max(left, Math.min(1, (end - range.startMs) / span));
    const width = Math.max(0.02, right - left);
    return {
      left: `${left * 100}%`,
      width: `${width * 100}%`,
    };
  };

  return (
    <div className="min-w-0 space-y-3">
      {withoutDates.length > 0 ? (
        <div className="rounded-xl border border-border/50 bg-card/40 p-3">
          <p className="text-muted-foreground mb-2 text-xs font-medium">
            Uten dato ({withoutDates.length})
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {withoutDates.map((card) => (
              <li key={card._id}>
                <button
                  type="button"
                  onClick={() => onOpenCard(card)}
                  className="bg-muted/70 hover:bg-muted max-w-[14rem] truncate rounded-lg px-2.5 py-1.5 text-left text-xs font-medium touch-manipulation"
                >
                  {card.title}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="min-w-0 overflow-x-auto rounded-xl border border-border/50">
        <div className="min-w-[720px]">
          <div
            className="bg-muted/30 text-muted-foreground grid border-b border-border/50 text-[11px] font-medium"
            style={{ gridTemplateColumns: "11rem 1fr" }}
          >
            <div className="px-3 py-2">Kort</div>
            <div
              className="grid border-l border-border/40"
              style={{
                gridTemplateColumns: `repeat(${months.length}, minmax(4.5rem, 1fr))`,
              }}
            >
              {months.map((m) => (
                <div key={m.ms} className="border-l border-border/30 px-2 py-2 first:border-l-0">
                  {m.label}
                </div>
              ))}
            </div>
          </div>
          <ul className="divide-border/40 divide-y">
            {withDates.map((card) => (
              <li
                key={card._id}
                className="grid min-h-11 items-center"
                style={{ gridTemplateColumns: "11rem 1fr" }}
              >
                <button
                  type="button"
                  onClick={() => onOpenCard(card)}
                  className="truncate px-3 py-2 text-left text-sm font-medium hover:underline touch-manipulation"
                >
                  {card.title}
                </button>
                <div className="relative h-8 border-l border-border/40">
                  <div
                    className="pointer-events-none absolute inset-0 grid"
                    style={{
                      gridTemplateColumns: `repeat(${months.length}, minmax(4.5rem, 1fr))`,
                    }}
                    aria-hidden
                  >
                    {months.map((m) => (
                      <div
                        key={m.ms}
                        className="border-l border-border/30 first:border-l-0"
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenCard(card)}
                    title={`${card.title}${formatDateRange(card.startAt, card.dueAt) ? ` · ${formatDateRange(card.startAt, card.dueAt)}` : ""}`}
                    className="bg-sky-500/80 hover:bg-sky-500 absolute top-1.5 h-5 rounded-md touch-manipulation"
                    style={barStyle(card)}
                  />
                </div>
              </li>
            ))}
          </ul>
          {withDates.length === 0 ? (
            <p className="text-muted-foreground px-4 py-8 text-center text-sm">
              Ingen kort med start- eller sluttdato i denne viewen.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function BoardColumn({
  column,
  cards,
  onOpenCard,
  onRename,
  onRemove,
  canManage,
  showCardDescription = false,
}: {
  column: BoardColumnDoc;
  cards: BoardCard[];
  onOpenCard: (card: BoardCard) => void;
  onRename?: (nextName: string) => void | Promise<void>;
  onRemove?: () => void;
  canManage?: boolean;
  showCardDescription?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(column.name);
  const [visible, setVisible] = useState(COLUMN_PAGE_SIZE);
  const { setNodeRef, isOver } = useDroppable({
    id: `col-${column._id}`,
  });

  useEffect(() => {
    setVisible(COLUMN_PAGE_SIZE);
  }, [column._id, cards.length]);

  const startEdit = () => {
    if (!canManage || !onRename) return;
    setDraft(column.name);
    setEditing(true);
  };

  const commitEdit = () => {
    const next = draft.trim();
    setEditing(false);
    if (!next || next === column.name) {
      setDraft(column.name);
      return;
    }
    void onRename?.(next);
  };

  const shown = cards.slice(0, visible);
  const remaining = cards.length - shown.length;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-[280px] shrink-0 flex-col rounded-xl border border-border/50 bg-muted/20 sm:w-[300px]",
        column.isDone && "bg-muted/30",
        isOver && "border-sky-500/50 bg-sky-500/8 ring-1 ring-sky-500/20",
      )}
    >
      <div className="sticky top-0 z-[1] flex items-start justify-between gap-2 rounded-t-xl border-b border-border/40 bg-muted/40 px-3 py-2.5 backdrop-blur-sm">
        <div className="min-w-0 flex-1">
          {editing ? (
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => commitEdit()}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitEdit();
                }
                if (e.key === "Escape") {
                  setDraft(column.name);
                  setEditing(false);
                }
              }}
              className="border-input bg-background h-7 w-full min-w-0 rounded-md border px-1.5 text-xs font-semibold tracking-wide outline-none focus:ring-1 focus:ring-sky-500/40"
              aria-label="Kolonnenavn"
            />
          ) : (
            <button
              type="button"
              disabled={!canManage}
              onClick={startEdit}
              className={cn(
                "block w-full min-w-0 text-left",
                canManage &&
                  "hover:text-sky-800 dark:hover:text-sky-200 -mx-1 cursor-pointer rounded-md px-1 py-0.5 hover:bg-background/50",
                !canManage && "cursor-default",
              )}
              title={canManage ? "Klikk for å endre navn" : undefined}
            >
              <p className="truncate text-xs font-semibold tracking-wide text-foreground">
                {column.name}
              </p>
              <p className="text-muted-foreground text-[10px]">
                {column.isDone ? "Fullført" : "Åpen"}
              </p>
            </button>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {canManage ? (
            <button
              type="button"
              className="text-muted-foreground hover:text-destructive rounded-md px-1.5 py-1 text-[10px] font-medium"
              onClick={onRemove}
            >
              Slett
            </button>
          ) : null}
          <span className="bg-background/80 text-muted-foreground rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums shadow-xs">
            {cards.length}
          </span>
        </div>
      </div>
      <div
        data-column-cards
        className="max-h-[min(70vh,36rem)] min-h-[160px] flex-1 touch-pan-y space-y-2 overflow-y-auto overscroll-contain p-2.5"
      >
        {shown.map((card) => (
          <DraggableIssueCard
            key={card._id}
            card={card}
            columnLabel={column.name}
            onOpen={() => onOpenCard(card)}
            showDescription={showCardDescription}
          />
        ))}
        {remaining > 0 ? (
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground hover:bg-background/60 w-full rounded-lg border border-dashed border-border/60 py-2 text-xs font-medium"
            onClick={() => setVisible((v) => v + COLUMN_PAGE_SIZE)}
          >
            Vis {Math.min(COLUMN_PAGE_SIZE, remaining)} til · {remaining} skjult
          </button>
        ) : null}
        {cards.length === 0 ? (
          <p className="text-muted-foreground px-1 py-6 text-center text-[11px]">
            Ingen kort her
          </p>
        ) : null}
      </div>
    </div>
  );
}

function LinkSection({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0 overflow-hidden rounded-xl border border-border/50 bg-muted/10">
      <div className="flex items-center gap-1.5 border-b border-border/40 px-3 py-2">
        <span className="text-muted-foreground shrink-0">{icon}</span>
        <h3 className="text-sm font-medium">{title}</h3>
      </div>
      <div className="min-w-0 space-y-2.5 p-3">{children}</div>
    </section>
  );
}

const DETAIL_TABS: { id: DetailTab; label: string }[] = [
  { id: "oversikt", label: "Oversikt" },
  { id: "koblinger", label: "Koblinger" },
  { id: "kommentarer", label: "Kommentarer" },
  { id: "mer", label: "Mer" },
];

type DetailSize = "normal" | "large" | "full";

type CommentsPlacement = "tab" | "overview";

export function IssuesProjectBoard({
  workspaceId,
  boardId,
  focusTaskId,
  detailPresentation = "dialog",
}: {
  workspaceId: Id<"workspaces">;
  boardId: Id<"pulsBoards">;
  /** Åpne dette kortet (egen side eller deep-link). */
  focusTaskId?: Id<"assessmentTasks">;
  /** dialog = modal på tavle; page = full kortside. */
  detailPresentation?: "dialog" | "page";
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const deepLinkTaskId = focusTaskId ?? searchParams.get("task");
  const deepLinkHandled = useRef<string | null>(null);
  const isPageDetail = detailPresentation === "page";

  const cardsRaw = useQuery(api.assessmentTasks.listBoardByPulsBoard, {
    boardId,
  });
  const cards = useMemo(
    () => (cardsRaw ?? []).map((c) => normalizeBoardCard(c as BoardCard)),
    [cardsRaw],
  );
  const cardsLoaded = cardsRaw !== undefined;
  const columnsRaw = useQuery(api.pulsBoardColumns.listByBoard, { boardId });
  const boardMeta = useQuery(api.pulsBoards.get, { boardId });
  const otherBoards = useQuery(api.pulsBoards.listMineInWorkspace, {
    workspaceId,
  });
  const workspace = useQuery(api.workspaces.get, { workspaceId });
  const members = useQuery(api.workspaces.listMembers, { workspaceId });
  const myProfile = useQuery(api.users.getMyProfile);
  const processes = useQuery(api.candidates.listByWorkspace, { workspaceId });
  const rosAnalyses = useQuery(api.ros.listAnalyses, { workspaceId });

  const ensureColumns = useMutation(api.pulsBoardColumns.ensureForBoard);
  const createColumn = useMutation(api.pulsBoardColumns.create);
  const renameColumn = useMutation(api.pulsBoardColumns.rename);
  const removeColumn = useMutation(api.pulsBoardColumns.remove);
  const applyTemplate = useMutation(api.pulsBoardColumns.applyTemplate);
  const templates = useQuery(api.pulsBoardColumns.listTemplates, {});
  const createTask = useMutation(api.assessmentTasks.create);
  const moveTask = useMutation(api.assessmentTasks.moveTask);
  const moveToBoard = useMutation(api.assessmentTasks.moveToBoard);
  const updateTask = useMutation(api.assessmentTasks.update);
  const generateTaskFileUploadUrl = useMutation(
    api.assessmentTaskFiles.generateUploadUrl,
  );
  const attachTaskFile = useMutation(api.assessmentTaskFiles.attach);
  const setParent = useMutation(api.assessmentTasks.setParent);
  const setStatus = useMutation(api.assessmentTasks.setStatus);
  const completeTask = useMutation(api.assessmentTasks.completeTask);
  const removeTask = useMutation(api.assessmentTasks.remove);
  const linkProcess = useMutation(api.candidates.linkAssessment);
  const linkRos = useMutation(api.ros.linkAssessment);
  const savedPrefs = useQuery(api.pulsBoardUserPrefs.getMine, { boardId });
  const setUiPrefs = useMutation(api.pulsBoardUserPrefs.setUiMine);
  const boardViewsRaw = useQuery(api.pulsBoardViews.listByBoard, { boardId });
  const ensureViews = useMutation(api.pulsBoardViews.ensureDefaults);
  const createViewMut = useMutation(api.pulsBoardViews.create);
  const updateViewMut = useMutation(api.pulsBoardViews.update);
  const removeViewMut = useMutation(api.pulsBoardViews.remove);

  useEffect(() => {
    void ensureColumns({ boardId }).catch(() => {
      /* ignore */
    });
    void ensureViews({ boardId }).catch(() => {
      /* ignore */
    });
  }, [boardId, ensureColumns, ensureViews]);

  const boardViews = useMemo(
    (): BoardViewDoc[] => (boardViewsRaw ?? []) as BoardViewDoc[],
    [boardViewsRaw],
  );

  const [filters, setFilters] = useState<BoardFilters>(DEFAULT_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [listVisible, setListVisible] = useState(80);
  const [activeDrag, setActiveDrag] = useState<BoardCard | null>(null);
  const [selected, setSelected] = useState<BoardCard | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("oversikt");
  const [completePrompt, setCompletePrompt] = useState<BoardCard | null>(null);
  const [completeComment, setCompleteComment] = useState("");
  const [moveBoardId, setMoveBoardId] = useState<Id<"pulsBoards"> | "">("");
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");
  const [viewLayout, setViewLayout] = useState<BoardViewLayout>("board");
  const [activeViewId, setActiveViewId] = useState<Id<"pulsBoardViews"> | "">(
    "",
  );
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const [createViewOpen, setCreateViewOpen] = useState(false);
  const [createViewName, setCreateViewName] = useState("");
  const [createViewLayout, setCreateViewLayout] =
    useState<BoardViewLayout>("board");
  const [renameViewOpen, setRenameViewOpen] = useState(false);
  const [renameViewName, setRenameViewName] = useState("");
  /** Inline rename via dobbeltklikk på fane */
  const [renamingViewId, setRenamingViewId] = useState<
    Id<"pulsBoardViews"> | ""
  >("");
  const renameInputRef = useRef<HTMLInputElement>(null);
  const renameCancelRef = useRef(false);
  const [commentsPlacement, setCommentsPlacement] =
    useState<CommentsPlacement>("tab");
  const [detailSize, setDetailSize] = useState<DetailSize>("large");
  const [showCardDescription, setShowCardDescription] = useState(false);
  const [descInsertToken, setDescInsertToken] = useState<string | null>(null);
  const [prefsHydrated, setPrefsHydrated] = useState(false);
  const [viewsHydrated, setViewsHydrated] = useState(false);
  const boardScrollRef = useRef<HTMLDivElement>(null);
  const [boardCanScroll, setBoardCanScroll] = useState(false);
  const [boardScrollAtStart, setBoardScrollAtStart] = useState(true);
  const [boardScrollAtEnd, setBoardScrollAtEnd] = useState(false);
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const viewFilterTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const uiPrefsRef = useRef({
    commentsPlacement,
    detailSize,
    showCardDescription,
  });
  uiPrefsRef.current = {
    commentsPlacement,
    detailSize,
    showCardDescription,
  };
  const activeViewIdRef = useRef(activeViewId);
  activeViewIdRef.current = activeViewId;
  const myUserId = myProfile?.user?._id as Id<"users"> | undefined;
  const canEditViews = boardMeta?.canEdit === true;

  const persistUiLocal = (extras?: {
    commentsPlacement?: CommentsPlacement;
    detailSize?: DetailSize;
    showCardDescription?: boolean;
    activeViewId?: Id<"pulsBoardViews"> | "";
  }) => {
    try {
      localStorage.setItem(
        `puls-board-ui:${boardId}`,
        JSON.stringify({
          commentsPlacement:
            extras?.commentsPlacement ?? uiPrefsRef.current.commentsPlacement,
          detailSize: extras?.detailSize ?? uiPrefsRef.current.detailSize,
          showCardDescription:
            extras?.showCardDescription ??
            uiPrefsRef.current.showCardDescription,
          activeViewId:
            extras?.activeViewId !== undefined
              ? extras.activeViewId
              : activeViewIdRef.current,
        }),
      );
    } catch {
      /* ignore */
    }
  };

  const persistViewFilters = (next: BoardFilters) => {
    const viewId = activeViewIdRef.current;
    if (!viewId) return;
    if (viewFilterTimer.current) clearTimeout(viewFilterTimer.current);
    viewFilterTimer.current = setTimeout(() => {
      void updateViewMut({
        viewId,
        filters: filtersToPersist(next),
      }).catch(() => {
        /* ignore */
      });
    }, 400);
  };

  useEffect(() => {
    return () => {
      if (persistTimer.current) clearTimeout(persistTimer.current);
      if (viewFilterTimer.current) clearTimeout(viewFilterTimer.current);
    };
  }, []);

  useEffect(() => {
    setPrefsHydrated(false);
    setViewsHydrated(false);
    setActiveViewId("");
  }, [boardId]);

  useEffect(() => {
    if (prefsHydrated || savedPrefs === undefined) return;
    if (savedPrefs) {
      if (
        savedPrefs.commentsPlacement === "tab" ||
        savedPrefs.commentsPlacement === "overview"
      ) {
        setCommentsPlacement(savedPrefs.commentsPlacement);
      }
      if (
        savedPrefs.detailSize === "normal" ||
        savedPrefs.detailSize === "large" ||
        savedPrefs.detailSize === "full"
      ) {
        setDetailSize(savedPrefs.detailSize);
      }
      setShowCardDescription(savedPrefs.showCardDescription === true);
    } else {
      try {
        const uiRaw = localStorage.getItem(`puls-board-ui:${boardId}`);
        if (uiRaw) {
          const ui = JSON.parse(uiRaw) as {
            commentsPlacement?: CommentsPlacement;
            detailSize?: DetailSize;
            showCardDescription?: boolean;
          };
          if (
            ui.commentsPlacement === "tab" ||
            ui.commentsPlacement === "overview"
          ) {
            setCommentsPlacement(ui.commentsPlacement);
          }
          if (
            ui.detailSize === "normal" ||
            ui.detailSize === "large" ||
            ui.detailSize === "full"
          ) {
            setDetailSize(ui.detailSize);
          }
          if (typeof ui.showCardDescription === "boolean") {
            setShowCardDescription(ui.showCardDescription);
          }
        }
      } catch {
        /* ignore */
      }
    }
    setPrefsHydrated(true);
  }, [savedPrefs, prefsHydrated, boardId]);

  useEffect(() => {
    if (!prefsHydrated || viewsHydrated || boardViewsRaw === undefined) return;
    if (boardViews.length === 0) return;

    let pick =
      (savedPrefs?.activeViewId
        ? boardViews.find((v) => v._id === savedPrefs.activeViewId)
        : undefined) ?? boardViews[0]!;

    if (!savedPrefs?.activeViewId && savedPrefs?.viewMode) {
      const legacy = layoutFromLegacy(savedPrefs.viewMode);
      pick = boardViews.find((v) => v.layout === legacy) ?? pick;
    }

    setActiveViewId(pick._id);
    setViewLayout(pick.layout);
    setFilters(filtersFromView(pick));
    persistUiLocal({ activeViewId: pick._id });
    void setUiPrefs({
      boardId,
      activeViewId: pick._id,
    }).catch(() => {
      /* ignore */
    });
    setViewsHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefsHydrated, viewsHydrated, boardViewsRaw, boardViews, savedPrefs, boardId]);

  useEffect(() => {
    if (!prefsHydrated || !savedPrefs) return;
    if (
      savedPrefs.commentsPlacement === "tab" ||
      savedPrefs.commentsPlacement === "overview"
    ) {
      setCommentsPlacement(savedPrefs.commentsPlacement);
    }
    if (
      savedPrefs.detailSize === "normal" ||
      savedPrefs.detailSize === "large" ||
      savedPrefs.detailSize === "full"
    ) {
      setDetailSize(savedPrefs.detailSize);
    }
    setShowCardDescription(savedPrefs.showCardDescription === true);
  }, [
    prefsHydrated,
    savedPrefs?.updatedAt,
    savedPrefs?.commentsPlacement,
    savedPrefs?.detailSize,
    savedPrefs?.showCardDescription,
  ]);

  const selectView = (view: BoardViewDoc) => {
    setActiveViewId(view._id);
    setViewLayout(view.layout);
    setFilters(filtersFromView(view));
    setViewMenuOpen(false);
    if (renamingViewId && renamingViewId !== view._id) {
      setRenamingViewId("");
    }
    persistUiLocal({ activeViewId: view._id });
    void setUiPrefs({ boardId, activeViewId: view._id }).catch(() => {
      /* ignore */
    });
  };

  const beginInlineRename = (view: BoardViewDoc) => {
    if (!canEditViews) return;
    if (view._id !== activeViewId) selectView(view);
    setViewMenuOpen(false);
    renameCancelRef.current = false;
    setRenameViewName(view.name);
    setRenamingViewId(view._id);
  };

  const commitInlineRename = () => {
    if (renameCancelRef.current) {
      renameCancelRef.current = false;
      setRenamingViewId("");
      return;
    }
    const viewId = renamingViewId;
    const name = renameViewName.trim();
    if (!viewId) return;
    setRenamingViewId("");
    if (!name) return;
    const current = boardViews.find((v) => v._id === viewId);
    if (current && current.name === name) return;
    void updateViewMut({ viewId, name })
      .then(() => toast.success("Navn oppdatert"))
      .catch((err: unknown) =>
        toast.error(err instanceof Error ? err.message : "Kunne ikke lagre"),
      );
  };

  useEffect(() => {
    if (!renamingViewId) return;
    const el = renameInputRef.current;
    if (!el) return;
    el.focus();
    el.select();
  }, [renamingViewId]);

  const patchFilters = (patch: Partial<BoardFilters>) => {
    setFilters((prev) => {
      const next = { ...prev, ...patch };
      persistViewFilters(next);
      return next;
    });
  };

  const clearFilters = () => {
    setFilters(DEFAULT_FILTERS);
    if (viewFilterTimer.current) clearTimeout(viewFilterTimer.current);
    const viewId = activeViewIdRef.current;
    if (viewId) {
      void updateViewMut({
        viewId,
        filters: filtersToPersist(DEFAULT_FILTERS),
      }).catch(() => {
        /* ignore */
      });
    }
  };

  const activeView = boardViews.find((v) => v._id === activeViewId) ?? null;

  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPriority, setEditPriority] = useState(3);
  const [editColumnId, setEditColumnId] = useState<
    Id<"pulsBoardColumns"> | ""
  >("");
  const [editStart, setEditStart] = useState("");
  const [editDue, setEditDue] = useState("");
  const [editAssigneeIds, setEditAssigneeIds] = useState<Id<"users">[]>([]);
  const [editLabels, setEditLabels] = useState<string[]>([]);
  const [editLabelDraft, setEditLabelDraft] = useState("");
  const [editIssueType, setEditIssueType] = useState("");
  const [editPriorityLabel, setEditPriorityLabel] = useState("");
  const [editSize, setEditSize] = useState("");
  const [editEstimate, setEditEstimate] = useState("");
  const [editMilestone, setEditMilestone] = useState("");
  const [editParentId, setEditParentId] = useState<Id<"assessmentTasks"> | "">(
    "",
  );
  const [linkCandidateId, setLinkCandidateId] = useState<Id<"candidates"> | "">(
    "",
  );
  const [linkRosId, setLinkRosId] = useState<Id<"rosAnalyses"> | "">("");
  const [busy, setBusy] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  /** When promoting a checklist item, restore description if create is cancelled. */
  const checklistPromoteRestoreRef = useRef<{
    taskId: Id<"assessmentTasks">;
    previousDescription: string;
  } | null>(null);
  const createLinkTargets = useQuery(
    api.assessmentTasks.listCreateLinkTargets,
    createOpen ? { workspaceId } : "skip",
  );
  const [createTitle, setCreateTitle] = useState("");
  const [createAssessmentId, setCreateAssessmentId] = useState<
    Id<"assessments"> | ""
  >("");
  const [createCandidateId, setCreateCandidateId] = useState<
    Id<"candidates"> | ""
  >("");
  const [createRosId, setCreateRosId] = useState<Id<"rosAnalyses"> | "">("");
  const [createPddId, setCreatePddId] = useState<
    Id<"processDesignDocuments"> | ""
  >("");
  const [createFormId, setCreateFormId] = useState<Id<"intakeForms"> | "">("");
  const [createLinksOpen, setCreateLinksOpen] = useState(false);
  const [createDescription, setCreateDescription] = useState("");
  const [createIssueType, setCreateIssueType] = useState("Oppgave");
  const [createMoreOpen, setCreateMoreOpen] = useState(false);
  const [createFullscreen, setCreateFullscreen] = useState(false);
  const [createParentId, setCreateParentId] = useState<
    Id<"assessmentTasks"> | ""
  >("");
  const [createColumnId, setCreateColumnId] = useState<
    Id<"pulsBoardColumns"> | ""
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

  const assessmentFilterOptions = useMemo(() => {
    const map = new Map<Id<"assessments">, string>();
    for (const c of cards) {
      if (c.assessmentId) map.set(c.assessmentId, c.assessmentTitle);
    }
    return [...map.entries()]
      .map(([id, title]) => ({ id, title }))
      .sort((a, b) => a.title.localeCompare(b.title, "nb"));
  }, [cards]);

  const assigneeFilterOptions = useMemo(() => {
    return (members ?? [])
      .map((m) => ({
        userId: m.userId as Id<"users">,
        label: m.name?.trim() || m.email || "Medlem",
      }))
      .sort((a, b) => a.label.localeCompare(b.label, "nb"));
  }, [members]);

  const filtered = useMemo(() => {
    const q = filters.query.trim().toLowerCase();
    const today = startOfTodayMs();
    const weekEnd = endOfWeekMs();
    let list = cards;

    if (filters.status === "open") {
      list = list.filter((c) => c.status === "open");
    } else if (filters.status === "done") {
      list = list.filter((c) => c.status === "done");
    }

    if (filters.cardType === "top") {
      list = list.filter((c) => !c.parentTaskId);
    } else if (filters.cardType === "sub") {
      list = list.filter((c) => Boolean(c.parentTaskId));
    }

    if (filters.columnId) {
      list = list.filter((c) => c.columnId === filters.columnId);
    }

    if (filters.processId) {
      list = list.filter((c) =>
        c.linkedProcesses.some((p) => p.id === filters.processId),
      );
    }

    if (filters.assessmentId) {
      list = list.filter((c) => c.assessmentId === filters.assessmentId);
    }

    if (filters.assignee === "me" && myUserId) {
      list = list.filter((c) => c.assignees.some((a) => a.userId === myUserId));
    } else if (filters.assignee === "unassigned") {
      list = list.filter((c) => c.assignees.length === 0);
    } else if (filters.assignee !== "all") {
      const uid = filters.assignee;
      list = list.filter((c) => c.assignees.some((a) => a.userId === uid));
    }

    if (filters.due === "overdue") {
      list = list.filter(
        (c) => c.status === "open" && c.dueAt != null && c.dueAt < today,
      );
    } else if (filters.due === "week") {
      list = list.filter(
        (c) =>
          c.status === "open" &&
          c.dueAt != null &&
          c.dueAt >= today &&
          c.dueAt <= weekEnd,
      );
    } else if (filters.due === "none") {
      list = list.filter((c) => c.dueAt == null);
    }

    if (q) {
      list = list.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.assessmentTitle.toLowerCase().includes(q) ||
          (c.parentTitle?.toLowerCase().includes(q) ?? false) ||
          (c.assigneeName?.toLowerCase().includes(q) ?? false) ||
          c.linkedProcesses.some(
            (p) =>
              p.name.toLowerCase().includes(q) ||
              p.code.toLowerCase().includes(q),
          ),
      );
    }

    return list;
  }, [cards, filters, myUserId]);

  const updateBoardScrollState = () => {
    const el = boardScrollRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setBoardCanScroll(max > 2);
    setBoardScrollAtStart(el.scrollLeft <= 2);
    setBoardScrollAtEnd(el.scrollLeft >= max - 2);
  };

  const scrollBoardBy = (delta: number) => {
    const el = boardScrollRef.current;
    if (!el) return;
    el.scrollBy({ left: delta, behavior: "smooth" });
  };

  useEffect(() => {
    const el = boardScrollRef.current;
    if (!el || viewLayout !== "board") return;

    updateBoardScrollState();
    const onScroll = () => updateBoardScrollState();
    el.addEventListener("scroll", onScroll, { passive: true });

    let raf = 0;
    let pending = 0;
    const flush = () => {
      raf = 0;
      if (pending === 0) return;
      el.scrollLeft += pending;
      pending = 0;
      updateBoardScrollState();
    };

    const onWheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth + 2) return;

      const absX = Math.abs(e.deltaX);
      const absY = Math.abs(e.deltaY);
      // absX / absY: >2 ≈ horisontal, 0.35–2 ≈ diagonal, ellers vertikal
      const axisRatio = absY < 0.5 ? (absX > 0.5 ? Infinity : 0) : absX / absY;

      const scrollBoardX = (dx: number) => {
        if (dx === 0) return;
        pending += dx;
        if (!raf) raf = requestAnimationFrame(flush);
      };

      const cardsEl = (e.target as HTMLElement | null)?.closest(
        "[data-column-cards]",
      ) as HTMLElement | null;

      // Shift+hjul = klassisk horisontal (bruker deltaY som X)
      if (e.shiftKey) {
        const dx = e.deltaY !== 0 ? e.deltaY : e.deltaX;
        if (dx === 0) return;
        e.preventDefault();
        scrollBoardX(dx);
        return;
      }

      // Tydelig horisontal: kun tavle sideveis
      if (axisRatio > 2) {
        if (e.deltaX === 0) return;
        e.preventDefault();
        scrollBoardX(e.deltaX);
        return;
      }

      // Diagonal: X → tavle, Y → kolonne (hver for seg)
      if (axisRatio >= 0.35) {
        e.preventDefault();
        if (cardsEl && e.deltaY !== 0) {
          cardsEl.scrollTop += e.deltaY;
        }
        scrollBoardX(e.deltaX);
        return;
      }

      // Vertikal: la kolonnen scrolle naturlig.
      // Aldri konverter overscroll i Y til horisontal tavle-scroll.
    };
    el.addEventListener("wheel", onWheel, { passive: false });

    const ro = new ResizeObserver(() => updateBoardScrollState());
    ro.observe(el);
    window.addEventListener("resize", updateBoardScrollState);

    return () => {
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("wheel", onWheel);
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("resize", updateBoardScrollState);
    };
  }, [viewLayout, columnsRaw?.length, filtered.length]);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (filters.query.trim()) n++;
    if (filters.assignee !== "all") n++;
    if (filters.columnId) n++;
    if (filters.cardType !== "all") n++;
    if (filters.status !== "all") n++;
    if (filters.processId) n++;
    if (filters.assessmentId) n++;
    if (filters.due !== "all") n++;
    return n;
  }, [filters]);

  useEffect(() => {
    setListVisible(80);
  }, [filters, viewLayout, boardId]);

  const visibleRows = useMemo(
    () => filtered.slice(0, listVisible),
    [filtered, listVisible],
  );

  const columns = useMemo((): BoardColumnDoc[] => {
    return (columnsRaw ?? [])
      .map((c) => ({
        _id: c._id,
        name: c.name,
        order: c.order,
        isDone: c.isDone,
      }))
      .sort((a, b) => a.order - b.order);
  }, [columnsRaw]);

  const createColumnOptions = useMemo(
    () => columns.filter((c) => !c.isDone),
    [columns],
  );

  const defaultCreateColumnId = useMemo((): Id<"pulsBoardColumns"> | "" => {
    return createColumnOptions[0]?._id ?? "";
  }, [createColumnOptions]);

  const byColumn = useMemo(() => {
    const map = new Map<string, BoardCard[]>();
    for (const col of columns) map.set(col._id, []);
    const fallbackOpen = columns.find((c) => !c.isDone);
    const fallbackDone = columns.find((c) => c.isDone);
    for (const c of filtered) {
      let key = c.columnId ?? "";
      if (!key || !map.has(key)) {
        key =
          (c.status === "done"
            ? fallbackDone?._id
            : fallbackOpen?._id) ?? "";
      }
      if (key && map.has(key)) {
        map.get(key)!.push(c);
      }
    }
    return map;
  }, [filtered, columns]);

  const canManageColumns = boardMeta?.canManage === true;

  const columnLabelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of columns) map.set(c._id, c.name);
    return map;
  }, [columns]);

  const labelForCard = (card: BoardCard) => {
    if (card.columnId && columnLabelById.has(card.columnId)) {
      return columnLabelById.get(card.columnId)!;
    }
    return `P${clampP(card.priority)}`;
  };

  const createParentOptions = useMemo(() => {
    return cards
      .filter((c) => {
        if (createAssessmentId && c.assessmentId) {
          return c.assessmentId === createAssessmentId;
        }
        return true;
      })
      .sort((a, b) => {
        if (a.depth !== b.depth) return a.depth - b.depth;
        return a.title.localeCompare(b.title, "nb");
      });
  }, [cards, createAssessmentId]);

  const createLinkOptionLists = useMemo(() => {
    const targets = createLinkTargets;
    if (!targets) {
      return {
        assessments: [] as SearchableSelectOption[],
        processes: [] as SearchableSelectOption[],
        ros: [] as SearchableSelectOption[],
        pdds: [] as SearchableSelectOption[],
        forms: [] as SearchableSelectOption[],
      };
    }
    return {
      assessments: targets.assessments.map((a) => ({
        value: a.id,
        label: a.title,
      })),
      processes: targets.processes.map((p) => ({
        value: p.id,
        label: p.code ? `${p.code} — ${p.name}` : p.name,
      })),
      ros: targets.ros.map((r) => ({ value: r.id, label: r.title })),
      pdds: targets.pdds.map((d) => ({ value: d.id, label: d.title })),
      forms: targets.forms.map((f) => ({ value: f.id, label: f.title })),
    };
  }, [createLinkTargets]);

  const createLinkSummary = useMemo(() => {
    const chips: Array<{ key: string; label: string; onClear: () => void }> =
      [];
    if (createAssessmentId) {
      const title =
        createLinkTargets?.assessments.find((a) => a.id === createAssessmentId)
          ?.title ?? "Vurdering";
      chips.push({
        key: "assessment",
        label: title,
        onClear: () => setCreateAssessmentId(""),
      });
    }
    if (createCandidateId) {
      const p = createLinkTargets?.processes.find(
        (x) => x.id === createCandidateId,
      );
      chips.push({
        key: "process",
        label: p
          ? p.code
            ? `${p.code} — ${p.name}`
            : p.name
          : "Prosess",
        onClear: () => setCreateCandidateId(""),
      });
    }
    if (createRosId) {
      chips.push({
        key: "ros",
        label:
          createLinkTargets?.ros.find((r) => r.id === createRosId)?.title ??
          "ROS",
        onClear: () => setCreateRosId(""),
      });
    }
    if (createPddId) {
      chips.push({
        key: "pdd",
        label:
          createLinkTargets?.pdds.find((d) => d.id === createPddId)?.title ??
          "PDD",
        onClear: () => setCreatePddId(""),
      });
    }
    if (createFormId) {
      chips.push({
        key: "form",
        label:
          createLinkTargets?.forms.find((f) => f.id === createFormId)?.title ??
          "Skjema",
        onClear: () => setCreateFormId(""),
      });
    }
    return chips;
  }, [
    createAssessmentId,
    createCandidateId,
    createFormId,
    createLinkTargets,
    createPddId,
    createRosId,
  ]);

  const linkParentOptions = useMemo(() => {
    if (!selected) return [];
    const blocked = collectDescendantIds(selected._id, cards);
    return cards
      .filter((c) => {
        if (c._id === selected._id || blocked.has(c._id)) return false;
        if (selected.assessmentId && c.assessmentId) {
          return c.assessmentId === selected.assessmentId;
        }
        return true;
      })
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
    setEditColumnId(card.columnId ?? "");
    setEditStart(toDateInput(card.startAt));
    setEditDue(toDateInput(card.dueAt));
    setEditAssigneeIds(card.assignees.map((a) => a.userId));
    setEditLabels(card.labels ?? []);
    setEditLabelDraft("");
    setEditIssueType(
      matchSelectOption(ISSUE_TYPE_OPTIONS, ISSUE_TYPE_ALIASES, card.issueType),
    );
    setEditPriorityLabel(
      matchSelectOption(
        PRIORITY_LABEL_OPTIONS,
        PRIORITY_LABEL_ALIASES,
        card.priorityLabel,
      ),
    );
    setEditSize(matchSelectOption(SIZE_OPTIONS, {}, card.size));
    setEditEstimate(matchEstimateOption(card.estimate));
    setEditMilestone(card.milestone ?? "");
    setEditParentId(card.parentTaskId ?? "");
    setLinkCandidateId("");
    setLinkRosId("");
    setMoveBoardId("");
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
    setCompleteComment("");
    setCompletePrompt(card);
  };

  const finishComplete = async (
    card: BoardCard,
    completeSubIssues: boolean,
  ) => {
    setBusy(true);
    try {
      const res = await completeTask({
        taskId: card._id,
        completeSubIssues,
        comment: completeComment.trim() || undefined,
      });
      if (res.pipelineAdvancedToDevelopment) {
        toast.success(
          "Forberedelse ferdig — vurderingen er flyttet til Utvikling.",
        );
      } else {
        toast.success(
          completeSubIssues
            ? pulsBoardCopy.completedTree
            : pulsBoardCopy.completed,
        );
      }
      setCompletePrompt(null);
      setCompleteComment("");
      if (selected?._id === card._id) setSelected(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kunne ikke fullføre");
    } finally {
      setBusy(false);
    }
  };

  const resetCreateForm = (parent?: BoardCard) => {
    setCreateTitle("");
    setCreateDescription("");
    setCreateIssueType(parent?.issueType?.trim() || "Oppgave");
    setCreateMoreOpen(Boolean(parent));
    const hasInheritedLinks = Boolean(
      parent?.assessmentId ||
        parent?.candidateId ||
        parent?.rosAnalysisId ||
        parent?.processDesignDocumentId ||
        parent?.intakeFormId,
    );
    setCreateLinksOpen(hasInheritedLinks);
    setCreateParentId(parent?._id ?? "");
    setCreateColumnId(
      parent?.columnId &&
        createColumnOptions.some((c) => c._id === parent.columnId)
        ? parent.columnId
        : defaultCreateColumnId,
    );
    setCreateStart("");
    setCreateDue("");
    setCreateAssigneeIds([]);
    setCreateAssessmentId(parent?.assessmentId ?? "");
    setCreateCandidateId(parent?.candidateId ?? "");
    setCreateRosId(parent?.rosAnalysisId ?? "");
    setCreatePddId(parent?.processDesignDocumentId ?? "");
    setCreateFormId(parent?.intakeFormId ?? "");
  };

  const openCreateAsSub = (parent: BoardCard) => {
    setCreateOpen(true);
    resetCreateForm(parent);
  };

  const restoreChecklistPromoteIfNeeded = async () => {
    const restore = checklistPromoteRestoreRef.current;
    checklistPromoteRestoreRef.current = null;
    if (!restore) return;
    try {
      await updateTask({
        taskId: restore.taskId,
        description: isEmptyRichText(restore.previousDescription)
          ? null
          : restore.previousDescription,
      });
      toast.message(pulsBoardCopy.checklistPromoteRestored);
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Kunne ikke tilbakestille beskrivelsen",
      );
    }
  };

  const closeCreateDialog = () => {
    setCreateOpen(false);
    setCreateFullscreen(false);
    void restoreChecklistPromoteIfNeeded();
    resetCreateForm();
  };

  const promoteChecklistItem = async (item: {
    label: string;
    checked: boolean;
    asSub: boolean;
  }) => {
    if (!selected?.canEdit || busy) return;
    const parent = selected;
    const previous = editDescription;
    const result = removeMarkdownTaskByLabel(
      previous,
      item.label,
      item.checked,
    );
    if (!result.removed) {
      toast.error(pulsBoardCopy.checklistPromoteError);
      return;
    }

    setBusy(true);
    try {
      await updateTask({
        taskId: parent._id,
        description: isEmptyRichText(result.next) ? null : result.next,
      });
      setEditDescription(result.next);
      checklistPromoteRestoreRef.current = {
        taskId: parent._id,
        previousDescription: previous,
      };
      setSelected(null);
      setCreateOpen(true);
      if (item.asSub) {
        resetCreateForm(parent);
      } else {
        resetCreateForm();
        // Keep inherited links from the source card even for top-level.
        setCreateAssessmentId(parent.assessmentId ?? "");
        setCreateCandidateId(parent.candidateId ?? "");
        setCreateRosId(parent.rosAnalysisId ?? "");
        setCreatePddId(parent.processDesignDocumentId ?? "");
        setCreateFormId(parent.intakeFormId ?? "");
        setCreateLinksOpen(
          Boolean(
            parent.assessmentId ||
              parent.candidateId ||
              parent.rosAnalysisId ||
              parent.processDesignDocumentId ||
              parent.intakeFormId,
          ),
        );
        setCreateColumnId(
          parent.columnId &&
            createColumnOptions.some((c) => c._id === parent.columnId)
            ? parent.columnId
            : defaultCreateColumnId,
        );
      }
      setCreateTitle(result.label);
      setCreateMoreOpen(true);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Kunne ikke flytte sjekkpunkt",
      );
    } finally {
      setBusy(false);
    }
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
    if (!overId.startsWith("col-")) return;
    const columnId = overId.slice(4) as Id<"pulsBoardColumns">;
    const col = columns.find((c) => c._id === columnId);
    if (!col) return;
    if (card.columnId === columnId) return;

    try {
      if (col.isDone && card.status !== "done") {
        if (hasOpenDescendants(card, cards)) {
          setCompleteComment("");
          setCompletePrompt(card);
          return;
        }
        const res = await completeTask({ taskId: card._id });
        if (res.pipelineAdvancedToDevelopment) {
          toast.success(
            "Forberedelse ferdig — vurderingen er flyttet til Utvikling.",
          );
        }
        return;
      }
      const moved = await moveTask({
        taskId: card._id,
        columnId,
      });
      if (moved.pipelineAdvancedToDevelopment) {
        toast.success(
          "Forberedelse ferdig — vurderingen er flyttet til Utvikling.",
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kunne ikke flytte");
    }
  };

  const saveDetail = async () => {
    if (!selected) return;
    const startAt = fromDateInput(editStart);
    const dueAt = fromDateInput(editDue);
    if (startAt && dueAt && startAt > dueAt) {
      toast.error("Startdato kan ikke være etter sluttdato");
      return;
    }
    const estimateRaw = editEstimate.trim();
    let estimate: number | null = null;
    if (estimateRaw) {
      const n = Number(estimateRaw.replace(",", "."));
      if (!Number.isFinite(n) || n < 0) {
        toast.error("Estimat må være et tall (0 eller høyere)");
        return;
      }
      estimate = n;
    }
    setBusy(true);
    try {
      await updateTask({
        taskId: selected._id,
        title: editTitle.trim(),
        description: isEmptyRichText(editDescription)
          ? null
          : editDescription,
        priority: editPriority,
        startAt: startAt ?? null,
        dueAt: dueAt ?? null,
        assigneeUserIds: editAssigneeIds,
        labels: editLabels,
        issueType: editIssueType.trim() || null,
        priorityLabel: editPriorityLabel.trim() || null,
        size: editSize.trim() || null,
        estimate,
        milestone: editMilestone.trim() || null,
      });
      if (editColumnId && editColumnId !== (selected.columnId ?? "")) {
        const col = columns.find((c) => c._id === editColumnId);
        if (col?.isDone && selected.status !== "done") {
          await completeTask({
            taskId: selected._id,
            completeSubIssues: false,
          });
        } else {
          await moveTask({
            taskId: selected._id,
            columnId: editColumnId,
          });
        }
      }
      const nextParent = editParentId || null;
      const prevParent = selected.parentTaskId ?? null;
      if (nextParent !== prevParent) {
        await setParent({ taskId: selected._id, parentTaskId: nextParent });
      }
      toast.success(pulsBoardCopy.saved);
      setSelected(null);
      if (isPageDetail) {
        router.push(pulsBoardPath(workspaceId, boardId));
      }
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
    const startAt = fromDateInput(createStart);
    const dueAt = fromDateInput(createDue);
    if (startAt && dueAt && startAt > dueAt) {
      toast.error("Startdato kan ikke være etter sluttdato");
      return;
    }
    setBusy(true);
    try {
      await createTask({
        boardId,
        workspaceId,
        title,
        description: isEmptyRichText(createDescription)
          ? undefined
          : createDescription,
        issueType: createIssueType.trim() || undefined,
        assessmentId: createAssessmentId || undefined,
        candidateId: createCandidateId || undefined,
        rosAnalysisId: createRosId || undefined,
        processDesignDocumentId: createPddId || undefined,
        intakeFormId: createFormId || undefined,
        columnId: createColumnId || undefined,
        parentTaskId: createParentId || undefined,
        startAt: startAt ?? undefined,
        dueAt: dueAt ?? undefined,
        assigneeUserIds:
          createAssigneeIds.length > 0 ? createAssigneeIds : undefined,
      });
      toast.success(
        createParentId ? pulsBoardCopy.createdSub : pulsBoardCopy.created,
      );
      checklistPromoteRestoreRef.current = null;
      setCreateOpen(false);
      resetCreateForm();
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

  const activeFilterChips: { key: string; label: string; clear: () => void }[] =
    [];
  if (filters.assignee === "me") {
    activeFilterChips.push({
      key: "assignee",
      label: "Mine",
      clear: () => patchFilters({ assignee: "all" }),
    });
  } else if (filters.assignee === "unassigned") {
    activeFilterChips.push({
      key: "assignee",
      label: "Utildelt",
      clear: () => patchFilters({ assignee: "all" }),
    });
  } else if (filters.assignee !== "all") {
    const name =
      assigneeFilterOptions.find((m) => m.userId === filters.assignee)
        ?.label ?? "Ansvarlig";
    activeFilterChips.push({
      key: "assignee",
      label: name,
      clear: () => patchFilters({ assignee: "all" }),
    });
  }
  if (filters.due === "overdue") {
    activeFilterChips.push({
      key: "due",
      label: "Forfalt",
      clear: () => patchFilters({ due: "all" }),
    });
  } else if (filters.due === "week") {
    activeFilterChips.push({
      key: "due",
      label: "Denne uken",
      clear: () => patchFilters({ due: "all" }),
    });
  } else if (filters.due === "none") {
    activeFilterChips.push({
      key: "due",
      label: "Uten frist",
      clear: () => patchFilters({ due: "all" }),
    });
  }
  if (filters.columnId) {
    activeFilterChips.push({
      key: "column",
      label:
        columns.find((c) => c._id === filters.columnId)?.name ?? "Kolonne",
      clear: () => patchFilters({ columnId: "" }),
    });
  }
  if (filters.cardType !== "all") {
    activeFilterChips.push({
      key: "type",
      label: filters.cardType === "top" ? "Toppnivå" : "Delkort",
      clear: () => patchFilters({ cardType: "all" }),
    });
  }
  if (filters.status !== "all") {
    activeFilterChips.push({
      key: "status",
      label: filters.status === "open" ? "Åpne" : "Ferdige",
      clear: () => patchFilters({ status: "all" }),
    });
  }
  if (filters.processId) {
    const p = processFilterOptions.find((x) => x.id === filters.processId);
    activeFilterChips.push({
      key: "process",
      label: p ? (p.code ? `${p.code}` : p.name) : "Prosess",
      clear: () => patchFilters({ processId: "" }),
    });
  }
  if (filters.assessmentId) {
    activeFilterChips.push({
      key: "assessment",
      label:
        assessmentFilterOptions.find((a) => a.id === filters.assessmentId)
          ?.title ?? "Vurdering",
      clear: () => patchFilters({ assessmentId: "" }),
    });
  }
  if (filters.query.trim()) {
    activeFilterChips.push({
      key: "query",
      label: `«${filters.query.trim()}»`,
      clear: () => patchFilters({ query: "" }),
    });
  }

  const quickFilters = [
    {
      id: "me",
      label: "Mine",
      icon: User,
      active: filters.assignee === "me",
      onClick: () =>
        patchFilters({
          assignee: filters.assignee === "me" ? "all" : "me",
        }),
    },
    {
      id: "unassigned",
      label: "Utildelt",
      icon: UserRoundX,
      active: filters.assignee === "unassigned",
      onClick: () =>
        patchFilters({
          assignee: filters.assignee === "unassigned" ? "all" : "unassigned",
        }),
    },
    {
      id: "overdue",
      label: "Forfalt",
      icon: AlertTriangle,
      active: filters.due === "overdue",
      onClick: () =>
        patchFilters({
          due: filters.due === "overdue" ? "all" : "overdue",
        }),
    },
    {
      id: "week",
      label: "Denne uken",
      icon: CalendarClock,
      active: filters.due === "week",
      onClick: () =>
        patchFilters({
          due: filters.due === "week" ? "all" : "week",
        }),
    },
    {
      id: "open",
      label: "Åpne",
      icon: Circle,
      active: filters.status === "open",
      onClick: () =>
        patchFilters({
          status: filters.status === "open" ? "all" : "open",
        }),
    },
  ] as const;

  return (
    <div className="flex w-full min-h-0 min-w-0 max-w-full flex-col gap-3 overflow-x-clip">
      {isPageDetail ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link
            href={pulsBoardPath(workspaceId, boardId)}
            className="text-muted-foreground hover:text-foreground inline-flex min-h-9 items-center gap-1.5 text-sm font-medium"
          >
            <ArrowLeft className="size-3.5" aria-hidden />
            Tilbake til tavle
          </Link>
          {cardsLoaded && !selected ? (
            <p className="text-muted-foreground text-sm">Fant ikke kortet.</p>
          ) : null}
        </div>
      ) : null}
      <div className={isPageDetail ? "hidden" : "contents"}>
      {/* View-faner (GitHub-stil) */}
      <div className="relative flex min-w-0 items-end gap-1 overflow-x-auto border-b border-border/50 pb-px">
        {boardViews.map((view) => {
          const Icon = layoutIcon(view.layout);
          const active = view._id === activeViewId;
          const editing = renamingViewId === view._id;
          return (
            <div key={view._id} className="relative flex shrink-0 items-center">
              {editing ? (
                <div
                  className={cn(
                    "inline-flex h-9 items-center gap-1.5 rounded-t-lg border border-b-0 px-2",
                    "bg-background text-foreground border-border/60",
                  )}
                >
                  <Icon className="size-3.5 shrink-0 opacity-80" aria-hidden />
                  <input
                    ref={renameInputRef}
                    value={renameViewName}
                    onChange={(e) => setRenameViewName(e.target.value)}
                    onBlur={() => commitInlineRename()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        (e.target as HTMLInputElement).blur();
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        renameCancelRef.current = true;
                        setRenamingViewId("");
                      }
                    }}
                    maxLength={40}
                    aria-label="Nytt view-navn"
                    className="bg-background h-7 w-[9rem] min-w-0 rounded-md border border-border/50 px-1.5 text-sm font-medium outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/40"
                  />
                </div>
              ) : (
                <button
                  type="button"
                  title={
                    canEditViews
                      ? "Dobbeltklikk for å gi nytt navn"
                      : undefined
                  }
                  onClick={() => selectView(view)}
                  onDoubleClick={(e) => {
                    e.preventDefault();
                    beginInlineRename(view);
                  }}
                  className={cn(
                    "inline-flex h-9 items-center gap-1.5 rounded-t-lg border border-b-0 px-3 text-sm font-medium touch-manipulation",
                    active
                      ? "bg-background text-foreground border-border/60"
                      : "text-muted-foreground border-transparent hover:text-foreground hover:bg-muted/40",
                  )}
                >
                  <Icon className="size-3.5 shrink-0 opacity-80" aria-hidden />
                  <span className="max-w-[9rem] truncate">{view.name}</span>
                </button>
              )}
              {active && canEditViews && !editing ? (
                <button
                  type="button"
                  aria-label="View-meny"
                  aria-expanded={viewMenuOpen}
                  onClick={() => setViewMenuOpen((o) => !o)}
                  className="text-muted-foreground hover:text-foreground -ml-1 inline-flex size-8 items-center justify-center rounded-md"
                >
                  <ChevronDown className="size-3.5" aria-hidden />
                </button>
              ) : null}
            </div>
          );
        })}
        {canEditViews ? (
          <button
            type="button"
            onClick={() => {
              setCreateViewName("");
              setCreateViewLayout(viewLayout);
              setCreateViewOpen(true);
            }}
            className="text-muted-foreground hover:text-foreground inline-flex h-9 shrink-0 items-center gap-1 rounded-t-lg px-2.5 text-sm font-medium touch-manipulation"
          >
            <Plus className="size-3.5" aria-hidden />
            Ny view
          </button>
        ) : null}
      </div>
      {viewMenuOpen && activeView && canEditViews ? (
        <div className="bg-popover text-popover-foreground absolute z-20 mt-0.5 w-56 rounded-lg border border-border/60 p-1 shadow-md">
          <button
            type="button"
            className="hover:bg-muted flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm"
            onClick={() => {
              setRenameViewName(activeView.name);
              setRenameViewOpen(true);
              setViewMenuOpen(false);
            }}
          >
            Gi nytt navn
          </button>
          <div className="text-muted-foreground px-2.5 py-1.5 text-[11px] font-medium">
            Layout
          </div>
          {(
            [
              ["board", "Tavle"],
              ["table", "Tabell"],
              ["roadmap", "Roadmap"],
            ] as const
          ).map(([layout, label]) => (
            <button
              key={layout}
              type="button"
              className={cn(
                "hover:bg-muted flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm",
                activeView.layout === layout && "bg-muted",
              )}
              onClick={() => {
                void updateViewMut({ viewId: activeView._id, layout })
                  .then(() => {
                    setViewLayout(layout);
                    setViewMenuOpen(false);
                    toast.success("Layout oppdatert");
                  })
                  .catch((err: unknown) =>
                    toast.error(
                      err instanceof Error ? err.message : "Kunne ikke oppdatere",
                    ),
                  );
              }}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            className="text-destructive hover:bg-muted flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm"
            onClick={() => {
              if (
                !window.confirm(
                  `Slette viewen «${activeView.name}»? Kortene slettes ikke.`,
                )
              ) {
                return;
              }
              void removeViewMut({ viewId: activeView._id })
                .then(() => {
                  setViewMenuOpen(false);
                  setViewsHydrated(false);
                  toast.success("View slettet");
                })
                .catch((err: unknown) =>
                  toast.error(
                    err instanceof Error ? err.message : "Kunne ikke slette",
                  ),
                );
            }}
          >
            <Trash2 className="size-3.5" aria-hidden />
            Slett view
          </button>
        </div>
      ) : null}

      {/* Én ren verktøylinje */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="relative min-w-0 flex-1 sm:max-w-xs">
            <Search
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2"
              aria-hidden
            />
            <input
              type="search"
              value={filters.query}
              onChange={(e) => patchFilters({ query: e.target.value })}
              placeholder={pulsBoardCopy.filterPlaceholder}
              aria-label={pulsBoardCopy.filterAria}
              className="border-input bg-background focus:border-sky-500 focus:ring-sky-500 h-9 w-full rounded-lg border py-1 pr-3 pl-8 text-sm outline-none focus:ring-1"
            />
          </div>
          <Button
            type="button"
            size="sm"
            variant={filtersOpen || activeFilterCount > 0 ? "secondary" : "outline"}
            className="h-9 shrink-0 gap-1.5 rounded-lg"
            onClick={() => setFiltersOpen((o) => !o)}
            aria-expanded={filtersOpen}
          >
            <Filter className="size-3.5" aria-hidden />
            Flere
            {activeFilterCount > 0 ? (
              <span className="bg-foreground text-background rounded-full px-1.5 text-[10px] tabular-nums">
                {activeFilterCount}
              </span>
            ) : null}
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <p className="text-muted-foreground order-last w-full text-xs tabular-nums sm:order-none sm:w-auto">
            {activeFilterCount > 0
              ? `${filtered.length} av ${cards.length} kort`
              : pulsBoardCopy.cardCount(filtered.length)}
          </p>
          {canManageColumns ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-9 rounded-lg"
              onClick={() => setColumnsOpen(true)}
            >
              Struktur
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            className="h-9 rounded-lg"
            onClick={() => {
              setCreateOpen(true);
              resetCreateForm();
            }}
          >
            <Plus className="size-3.5" />
            {pulsBoardCopy.newCard}
          </Button>
        </div>
      </div>

      {/* Hurtigfiltre — alltid synlige, lagres per bruker */}
      <div
        role="group"
        aria-label="Hurtigfiltre"
        className="bg-muted/30 flex flex-wrap items-center gap-1 rounded-xl border border-border/40 p-1"
      >
        {quickFilters.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={item.onClick}
              aria-pressed={item.active}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-colors",
                item.active
                  ? "bg-background text-foreground shadow-sm ring-1 ring-border/60"
                  : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
              )}
            >
              <Icon className="size-3.5 shrink-0 opacity-70" aria-hidden />
              {item.label}
            </button>
          );
        })}
        {activeFilterCount > 0 ? (
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground ml-auto inline-flex h-8 items-center gap-1 px-2 text-xs"
            onClick={clearFilters}
          >
            <X className="size-3.5" aria-hidden />
            Nullstill
          </button>
        ) : null}
      </div>

      {(() => {
        const detailChips = activeFilterChips.filter((chip) => {
          if (chip.key === "query") return true;
          if (chip.key === "column" || chip.key === "type" || chip.key === "process" || chip.key === "assessment")
            return true;
          if (chip.key === "assignee")
            return filters.assignee !== "me" && filters.assignee !== "unassigned";
          if (chip.key === "due") return filters.due === "none";
          if (chip.key === "status") return filters.status === "done";
          return false;
        });
        if (detailChips.length === 0 || filtersOpen) return null;
        return (
          <div className="flex flex-wrap items-center gap-1.5">
            {detailChips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={chip.clear}
                className="bg-muted/40 text-foreground hover:bg-muted inline-flex h-7 max-w-[14rem] items-center gap-1 rounded-md border border-border/40 px-2 text-xs"
                title="Fjern filter"
              >
                <span className="truncate">{chip.label}</span>
                <X className="size-3 shrink-0 opacity-60" aria-hidden />
              </button>
            ))}
          </div>
        );
      })()}

      {filtersOpen ? (
        <div className="bg-muted/15 space-y-3 rounded-xl border border-border/50 p-3 sm:p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">Flere filtre</p>
            <p className="text-muted-foreground text-xs">
              Lagres for deg på denne tavlen
            </p>
          </div>
          <div className="space-y-2">
            <FilterToolbar>
              <div className="min-w-0 space-y-1">
                <Label className="text-xs">Ansvarlig</Label>
                <SearchableSelect
                  aria-label="Ansvarlig"
                  value={filters.assignee}
                  onChange={(v) =>
                    patchFilters({ assignee: v as AssigneeFilter })
                  }
                  allowClear={false}
                  options={[
                    { value: "all", label: "Alle" },
                    { value: "me", label: "Meg" },
                    { value: "unassigned", label: "Utildelt" },
                    ...assigneeFilterOptions.map((m) => ({
                      value: m.userId,
                      label: m.label,
                    })),
                  ]}
                  triggerClassName="min-h-10 rounded-lg"
                />
              </div>
              <div className="min-w-0 space-y-1">
                <Label className="text-xs">Kolonne</Label>
                <SearchableSelect
                  aria-label="Kolonne"
                  value={filters.columnId}
                  onChange={(v) =>
                    patchFilters({
                      columnId: v as Id<"pulsBoardColumns"> | "",
                    })
                  }
                  clearLabel="Alle kolonner"
                  placeholder="Alle kolonner"
                  options={columns.map((c) => ({
                    value: c._id,
                    label: c.name,
                  }))}
                  triggerClassName="min-h-10 rounded-lg"
                />
              </div>
              <div className="min-w-0 space-y-1">
                <Label className="text-xs">Type</Label>
                <SearchableSelect
                  aria-label="Type"
                  value={filters.cardType}
                  onChange={(v) =>
                    patchFilters({ cardType: v as CardTypeFilter })
                  }
                  allowClear={false}
                  options={[
                    { value: "all", label: "Alle kort" },
                    { value: "top", label: "Toppnivå" },
                    { value: "sub", label: "Delkort" },
                  ]}
                  triggerClassName="min-h-10 rounded-lg"
                />
              </div>
              <div className="min-w-0 space-y-1">
                <Label className="text-xs">Status</Label>
                <SearchableSelect
                  aria-label="Status"
                  value={filters.status}
                  onChange={(v) =>
                    patchFilters({ status: v as StatusFilter })
                  }
                  allowClear={false}
                  options={[
                    { value: "all", label: "Åpne og ferdige" },
                    { value: "open", label: "Kun åpne" },
                    { value: "done", label: "Kun ferdige" },
                  ]}
                  triggerClassName="min-h-10 rounded-lg"
                />
              </div>
              <div className="min-w-0 space-y-1">
                <Label className="text-xs">Frist</Label>
                <SearchableSelect
                  aria-label="Frist"
                  value={filters.due}
                  onChange={(v) => patchFilters({ due: v as DueFilter })}
                  allowClear={false}
                  options={[
                    { value: "all", label: "Alle frister" },
                    { value: "overdue", label: "Forfalt" },
                    { value: "week", label: "Neste 7 dager" },
                    { value: "none", label: "Uten frist" },
                  ]}
                  triggerClassName="min-h-10 rounded-lg"
                />
              </div>
              <div className="min-w-0 space-y-1">
                <Label className="text-xs">Prosess</Label>
                <SearchableSelect
                  aria-label="Prosess"
                  value={filters.processId}
                  onChange={(v) =>
                    patchFilters({
                      processId: v as Id<"candidates"> | "",
                    })
                  }
                  clearLabel={pulsBoardCopy.allProcesses}
                  placeholder={pulsBoardCopy.allProcesses}
                  options={processFilterOptions.map((p) => ({
                    value: p.id,
                    label: p.code ? `${p.code} — ${p.name}` : p.name,
                  }))}
                  triggerClassName="min-h-10 rounded-lg"
                />
              </div>
              <div className="min-w-0 space-y-1">
                <Label className="text-xs">Vurdering</Label>
                <SearchableSelect
                  aria-label="Vurdering"
                  value={filters.assessmentId}
                  onChange={(v) =>
                    patchFilters({
                      assessmentId: v as Id<"assessments"> | "",
                    })
                  }
                  clearLabel="Alle vurderinger"
                  placeholder="Alle vurderinger"
                  options={assessmentFilterOptions.map((a) => ({
                    value: a.id,
                    label: a.title,
                  }))}
                  triggerClassName="min-h-10 rounded-lg"
                />
              </div>
            </FilterToolbar>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/40 pt-3">
            <p className="text-muted-foreground text-xs tabular-nums">
              Viser {filtered.length} av {cards.length} kort
            </p>
            <div className="flex gap-2">
              {activeFilterCount > 0 ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 gap-1 text-xs"
                  onClick={clearFilters}
                >
                  <X className="size-3.5" aria-hidden />
                  Nullstill
                </Button>
              ) : null}
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                onClick={() => setFiltersOpen(false)}
              >
                Lukk
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {viewLayout === "board" ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={onDragStart}
          onDragEnd={(e) => void onDragEnd(e)}
        >
          <div className="relative w-full min-w-0 max-w-full">
            {boardCanScroll ? (
              <>
                <button
                  type="button"
                  aria-label="Bla til venstre"
                  disabled={boardScrollAtStart}
                  onClick={() => scrollBoardBy(-300)}
                  className={cn(
                    "bg-background/95 absolute top-1/2 left-1 z-10 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-full border border-border/60 shadow-sm",
                    boardScrollAtStart && "pointer-events-none opacity-30",
                  )}
                >
                  <ChevronLeft className="size-4" aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label="Bla til høyre"
                  disabled={boardScrollAtEnd}
                  onClick={() => scrollBoardBy(300)}
                  className={cn(
                    "bg-background/95 absolute top-1/2 right-1 z-10 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-full border border-border/60 shadow-sm",
                    boardScrollAtEnd && "pointer-events-none opacity-30",
                  )}
                >
                  <ChevronRight className="size-4" aria-hidden />
                </button>
              </>
            ) : null}
            <div
              ref={boardScrollRef}
              className={cn(
                "flex w-full min-w-0 max-w-full gap-3 overflow-x-auto overscroll-x-contain pb-3 pt-1",
                "[scrollbar-gutter:stable] [scrollbar-width:auto]",
                boardCanScroll && "px-10",
              )}
            >
              {columns.map((col) => {
                const list = byColumn.get(col._id) ?? [];
                return (
                  <BoardColumn
                    key={col._id}
                    column={col}
                    cards={list}
                    onOpenCard={openDetail}
                    canManage={canManageColumns}
                    showCardDescription={showCardDescription}
                    onRename={async (nextName) => {
                      try {
                        await renameColumn({
                          columnId: col._id,
                          name: nextName,
                        });
                        toast.success("Kolonne oppdatert");
                      } catch (err: unknown) {
                        toast.error(
                          err instanceof Error
                            ? err.message
                            : "Kunne ikke endre",
                        );
                      }
                    }}
                    onRemove={() => {
                      if (
                        !window.confirm(
                          `Er du sikker på at du vil slette kolonnen «${col.name}»?\n\nKortene flyttes til en annen kolonne.`,
                        )
                      ) {
                        return;
                      }
                      void removeColumn({ columnId: col._id })
                        .then(() => toast.success("Kolonne slettet"))
                        .catch((err: unknown) =>
                          toast.error(
                            err instanceof Error
                              ? err.message
                              : "Kunne ikke slette",
                          ),
                        );
                    }}
                  />
                );
              })}
              <div className="w-1 shrink-0 sm:hidden" aria-hidden />
            </div>
          </div>
          <DragOverlay>
            {activeDrag ? (
              <div className="w-[280px] sm:w-[300px]">
                <IssueCardView
                  card={activeDrag}
                  columnLabel={labelForCard(activeDrag)}
                  isDragging
                  onOpen={() => undefined}
                  showDescription={showCardDescription}
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : null}

      {viewLayout === "table" ? (
        <div className="min-w-0 overflow-x-auto rounded-xl border border-border/50">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-muted/40 border-b border-border/50 text-xs">
              <tr>
                <th className="px-3 py-2.5 font-medium">Tittel</th>
                <th className="px-3 py-2.5 font-medium">Kolonne</th>
                <th className="px-3 py-2.5 font-medium">Vurdering</th>
                <th className="px-3 py-2.5 font-medium">Ansvarlig</th>
                <th className="px-3 py-2.5 font-medium">Frist</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((card) => (
                <tr
                  key={card._id}
                  className="hover:bg-muted/30 border-b border-border/40 last:border-0"
                >
                  <td className="px-3 py-2.5">
                    <button
                      type="button"
                      className="text-left font-medium hover:underline"
                      onClick={() => openDetail(card)}
                    >
                      {card.title}
                    </button>
                    {card.parentTitle ? (
                      <p className="text-muted-foreground text-[11px]">
                        Under: {card.parentTitle}
                      </p>
                    ) : null}
                  </td>
                  <td className="text-muted-foreground px-3 py-2.5">
                    <SearchableSelect
                      aria-label="Kolonne"
                      value={card.columnId ?? ""}
                      disabled={!card.canEdit}
                      allowClear={false}
                      className="max-w-[10rem]"
                      triggerClassName="h-8 min-h-8 rounded-md px-2 text-xs"
                      options={columns.map((c) => ({
                        value: c._id,
                        label: c.name,
                      }))}
                      onChange={(v) => {
                        const columnId = v as Id<"pulsBoardColumns">;
                        const col = columns.find((c) => c._id === columnId);
                        if (!col) return;
                        if (col.isDone && card.status !== "done") {
                          requestComplete(card);
                          return;
                        }
                        void moveTask({ taskId: card._id, columnId }).catch(
                          (err: unknown) =>
                            toast.error(
                              err instanceof Error
                                ? err.message
                                : "Kunne ikke flytte",
                            ),
                        );
                      }}
                    />
                  </td>
                  <td className="text-muted-foreground max-w-[12rem] truncate px-3 py-2.5">
                    {card.assessmentTitle}
                  </td>
                  <td className="text-muted-foreground px-3 py-2.5">
                    {card.assigneeName ?? "—"}
                  </td>
                  <td className="text-muted-foreground whitespace-nowrap px-3 py-2.5">
                    {formatDateNb(card.dueAt) ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length > listVisible ? (
            <div className="border-t border-border/50 p-2 text-center">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-9"
                onClick={() => setListVisible((v) => v + 80)}
              >
                Vis flere ({filtered.length - listVisible} igjen)
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {viewLayout === "roadmap" ? (
        <RoadmapView cards={filtered} onOpenCard={openDetail} />
      ) : null}

      {filtered.length === 0 ? (
        <p className="text-muted-foreground rounded-xl border border-dashed px-4 py-10 text-center text-sm">
          {activeFilterCount > 0
            ? "Ingen kort matcher filtrene. Prøv å nullstille eller endre filtre."
            : pulsBoardCopy.emptyBoard}
        </p>
      ) : null}

      </div>

      <Dialog open={createViewOpen} onOpenChange={setCreateViewOpen}>
        <DialogContent size="sm" titleId="create-view-title">
          <DialogHeader>
            <h2
              id="create-view-title"
              className="font-heading text-lg font-semibold"
            >
              Ny view
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Views er delt på tavlen. Velg navn og layout.
            </p>
          </DialogHeader>
          <DialogBody className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="create-view-name">Navn</Label>
              <Input
                id="create-view-name"
                value={createViewName}
                onChange={(e) => setCreateViewName(e.target.value)}
                placeholder="F.eks. Mine oppgaver"
                className="h-10"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="create-view-layout">Layout</Label>
              <SearchableSelect
                id="create-view-layout"
                aria-label="Layout"
                value={createViewLayout}
                onChange={(v) =>
                  setCreateViewLayout(v as BoardViewLayout)
                }
                allowClear={false}
                options={[
                  { value: "board", label: "Tavle" },
                  { value: "table", label: "Tabell" },
                  { value: "roadmap", label: "Roadmap" },
                ]}
                triggerClassName="min-h-10 rounded-lg"
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreateViewOpen(false)}
            >
              Avbryt
            </Button>
            <Button
              type="button"
              disabled={!createViewName.trim()}
              onClick={() => {
                const name = createViewName.trim();
                if (!name) return;
                void createViewMut({
                  boardId,
                  name,
                  layout: createViewLayout,
                  filters: filtersToPersist(filters),
                })
                  .then((id) => {
                    setCreateViewOpen(false);
                    setActiveViewId(id);
                    setViewLayout(createViewLayout);
                    void setUiPrefs({ boardId, activeViewId: id });
                    toast.success("View opprettet");
                  })
                  .catch((err: unknown) =>
                    toast.error(
                      err instanceof Error ? err.message : "Kunne ikke opprette",
                    ),
                  );
              }}
            >
              Opprett
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={renameViewOpen} onOpenChange={setRenameViewOpen}>
        <DialogContent size="sm" titleId="rename-view-title">
          <DialogHeader>
            <h2
              id="rename-view-title"
              className="font-heading text-lg font-semibold"
            >
              Gi view nytt navn
            </h2>
          </DialogHeader>
          <DialogBody>
            <Input
              value={renameViewName}
              onChange={(e) => setRenameViewName(e.target.value)}
              className="h-10"
              aria-label="View-navn"
            />
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRenameViewOpen(false)}
            >
              Avbryt
            </Button>
            <Button
              type="button"
              disabled={!renameViewName.trim() || !activeViewId}
              onClick={() => {
                if (!activeViewId) return;
                void updateViewMut({
                  viewId: activeViewId,
                  name: renameViewName.trim(),
                })
                  .then(() => {
                    setRenameViewOpen(false);
                    toast.success("Navn oppdatert");
                  })
                  .catch((err: unknown) =>
                    toast.error(
                      err instanceof Error ? err.message : "Kunne ikke lagre",
                    ),
                  );
              }}
            >
              Lagre
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeCreateDialog();
            return;
          }
          setCreateOpen(true);
        }}
      >
        <DialogContent
          size={createFullscreen ? "5xl" : "lg"}
          fillViewport={createFullscreen}
          titleId="create-issue-title"
          className={cn(
            !createFullscreen &&
              "max-sm:h-[min(92dvh,42rem)] max-sm:max-h-[calc(100dvh-env(safe-area-inset-top,0px)-0.5rem)] max-sm:rounded-b-none",
          )}
        >
          <DialogHeader className="max-sm:space-y-0 max-sm:pb-3">
            {!createFullscreen ? (
              <div
                className="mx-auto mb-2.5 h-1 w-10 rounded-full bg-border sm:hidden"
                aria-hidden
              />
            ) : null}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2
                  id="create-issue-title"
                  className="font-heading text-[1.35rem] font-semibold tracking-tight sm:text-lg"
                >
                  {createParentId
                    ? pulsBoardCopy.createSubTitle
                    : pulsBoardCopy.createTitle}
                </h2>
                <p className="text-muted-foreground mt-1 text-sm leading-snug max-sm:line-clamp-2">
                  {createParentId
                    ? pulsBoardCopy.createHintSub
                    : pulsBoardCopy.createHint}
                </p>
              </div>
              <button
                type="button"
                title={
                  createFullscreen
                    ? pulsBoardCopy.createSizeExitFull
                    : pulsBoardCopy.createSizeFull
                }
                aria-label={
                  createFullscreen
                    ? pulsBoardCopy.createSizeExitFull
                    : pulsBoardCopy.createSizeFull
                }
                aria-pressed={createFullscreen}
                className="text-muted-foreground hover:text-foreground hidden size-9 shrink-0 items-center justify-center rounded-lg border border-border/50 touch-manipulation sm:inline-flex"
                onClick={() => setCreateFullscreen((v) => !v)}
              >
                {createFullscreen ? (
                  <Minimize2 className="size-3.5" aria-hidden />
                ) : (
                  <Maximize2 className="size-3.5" aria-hidden />
                )}
              </button>
            </div>
          </DialogHeader>
          <DialogBody className="space-y-5 max-sm:space-y-4 max-sm:pb-2">
            <div className="space-y-1.5">
              <Label htmlFor="create-title">Tittel</Label>
              <Input
                id="create-title"
                value={createTitle}
                onChange={(e) => setCreateTitle(e.target.value)}
                placeholder="Hva skal gjøres?"
                className="min-h-12 text-base sm:min-h-10 sm:text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label id="create-issue-type-label">Type</Label>
              <div
                role="group"
                aria-labelledby="create-issue-type-label"
                className="grid grid-cols-2 gap-2 sm:hidden"
              >
                {ISSUE_TYPE_OPTIONS.map((t) => {
                  const active = createIssueType === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setCreateIssueType(t)}
                      className={cn(
                        "min-h-11 rounded-xl border px-3 text-sm font-medium touch-manipulation transition-colors",
                        active
                          ? "border-foreground/25 bg-foreground text-background"
                          : "border-border/60 bg-background text-foreground hover:bg-muted/50",
                      )}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
              <div className="hidden sm:block sm:max-w-[10rem]">
                <SearchableSelect
                  id="create-issue-type"
                  aria-label="Type"
                  value={createIssueType}
                  onChange={setCreateIssueType}
                  options={optionsWithCurrent(
                    ISSUE_TYPE_OPTIONS,
                    createIssueType,
                  ).map((t) => ({ value: t, label: t }))}
                  allowClear={false}
                  placeholder="Velg type"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Beskrivelse</Label>
              <CardDescriptionEditor
                key={createOpen ? "create-open" : "create-closed"}
                aria-label="Beskrivelse"
                value={createDescription}
                onChange={setCreateDescription}
                startInEditMode
                rows={createFullscreen ? 10 : 4}
                placeholder="Valgfritt — hva skal gjøres, hvorfor, eller lenker."
              />
            </div>

            <div className="space-y-2">
              <button
                type="button"
                className="hover:bg-muted/40 flex min-h-12 w-full items-center justify-between gap-2 rounded-2xl border border-border/50 px-3.5 text-left text-sm touch-manipulation sm:min-h-10 sm:rounded-xl sm:px-3"
                onClick={() => setCreateLinksOpen((v) => !v)}
                aria-expanded={createLinksOpen}
              >
                <span className="min-w-0">
                  <span className="text-foreground font-medium">
                    {createLinksOpen
                      ? pulsBoardCopy.createLinkHide
                      : pulsBoardCopy.createLinkShow}
                  </span>
                  {!createLinksOpen && createLinkSummary.length > 0 ? (
                    <span className="text-muted-foreground ml-2 text-xs">
                      ({createLinkSummary.length})
                    </span>
                  ) : null}
                </span>
                <ChevronDown
                  className={cn(
                    "text-muted-foreground size-4 shrink-0 transition-transform",
                    createLinksOpen && "rotate-180",
                  )}
                  aria-hidden
                />
              </button>

              {!createLinksOpen && createLinkSummary.length > 0 ? (
                <div className="flex flex-wrap gap-2 px-0.5">
                  {createLinkSummary.map((chip) => (
                    <button
                      key={chip.key}
                      type="button"
                      onClick={chip.onClear}
                      className="bg-muted text-foreground inline-flex max-w-full items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium touch-manipulation"
                      title="Fjern kobling"
                    >
                      <span className="truncate">{chip.label}</span>
                      <X className="size-3.5 shrink-0 opacity-60" aria-hidden />
                    </button>
                  ))}
                </div>
              ) : null}

              {createLinksOpen ? (
                <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/15 p-3.5 sm:p-3">
                  <p className="text-muted-foreground text-xs leading-snug sm:text-[11px]">
                    {createLinkTargets === undefined
                      ? "Laster koblinger …"
                      : pulsBoardCopy.createLinkHint}
                  </p>
                  <div className="grid gap-3.5 sm:grid-cols-2 sm:gap-3">
                    {(
                      [
                        {
                          id: "create-link-assessment",
                          label: pulsBoardCopy.createLinkAssessment,
                          value: createAssessmentId,
                          onChange: (v: string) =>
                            setCreateAssessmentId(
                              v as Id<"assessments"> | "",
                            ),
                          options: createLinkOptionLists.assessments,
                          empty: "Ingen vurdering",
                        },
                        {
                          id: "create-link-process",
                          label: pulsBoardCopy.createLinkProcess,
                          value: createCandidateId,
                          onChange: (v: string) =>
                            setCreateCandidateId(
                              v as Id<"candidates"> | "",
                            ),
                          options: createLinkOptionLists.processes,
                          empty: "Ingen prosess",
                        },
                        {
                          id: "create-link-ros",
                          label: pulsBoardCopy.createLinkRos,
                          value: createRosId,
                          onChange: (v: string) =>
                            setCreateRosId(v as Id<"rosAnalyses"> | ""),
                          options: createLinkOptionLists.ros,
                          empty: "Ingen ROS",
                        },
                        {
                          id: "create-link-pdd",
                          label: pulsBoardCopy.createLinkPdd,
                          value: createPddId,
                          onChange: (v: string) =>
                            setCreatePddId(
                              v as Id<"processDesignDocuments"> | "",
                            ),
                          options: createLinkOptionLists.pdds,
                          empty: "Ingen PDD",
                        },
                        {
                          id: "create-link-form",
                          label: pulsBoardCopy.createLinkForm,
                          value: createFormId,
                          onChange: (v: string) =>
                            setCreateFormId(v as Id<"intakeForms"> | ""),
                          options: createLinkOptionLists.forms,
                          empty: "Ingen skjema",
                        },
                      ] as const
                    ).map((row) => (
                      <div key={row.id} className="space-y-1">
                        <Label htmlFor={row.id} className="text-xs">
                          {row.label}
                        </Label>
                        <SearchableSelect
                          id={row.id}
                          aria-label={row.label}
                          value={row.value}
                          onChange={row.onChange}
                          options={row.options}
                          placeholder={row.empty}
                          clearLabel={row.empty}
                          searchPlaceholder={pulsBoardCopy.createLinkSearch}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <button
              type="button"
              className="text-muted-foreground hover:text-foreground flex min-h-12 w-full items-center justify-between gap-2 rounded-2xl border border-border/50 px-3.5 text-left text-sm touch-manipulation sm:min-h-9 sm:rounded-xl sm:px-3"
              onClick={() => setCreateMoreOpen((v) => !v)}
              aria-expanded={createMoreOpen}
            >
              <span>
                {createMoreOpen
                  ? pulsBoardCopy.createLess
                  : pulsBoardCopy.createMore}
              </span>
              <ChevronDown
                className={cn(
                  "size-4 shrink-0 transition-transform",
                  createMoreOpen && "rotate-180",
                )}
                aria-hidden
              />
            </button>

            {createMoreOpen ? (
              <div className="grid gap-3.5 sm:grid-cols-2 sm:gap-3">
                <div className="space-y-1.5 sm:col-span-2 sm:space-y-1">
                  <Label htmlFor="create-parent">
                    {pulsBoardCopy.parentLabel}
                  </Label>
                  <SearchableSelect
                    id="create-parent"
                    aria-label={pulsBoardCopy.parentLabel}
                    value={createParentId}
                    onChange={(v) =>
                      setCreateParentId(v as Id<"assessmentTasks"> | "")
                    }
                    options={createParentOptions.map((p) => ({
                      value: p._id,
                      label: pulsBoardCopy.parentUnder(parentOptionLabel(p)),
                    }))}
                    placeholder={pulsBoardCopy.parentNone}
                    clearLabel={pulsBoardCopy.parentNone}
                  />
                </div>
                <div className="space-y-1.5 sm:space-y-1">
                  <Label htmlFor="create-column">Kolonne</Label>
                  <SearchableSelect
                    id="create-column"
                    aria-label="Kolonne"
                    value={createColumnId}
                    onChange={(v) =>
                      setCreateColumnId(v as Id<"pulsBoardColumns"> | "")
                    }
                    options={createColumnOptions.map((c) => ({
                      value: c._id,
                      label: c.name,
                    }))}
                    allowClear={false}
                    placeholder={
                      createColumnOptions.length === 0
                        ? "Ingen kolonner"
                        : "Velg kolonne"
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-3 sm:contents">
                  <div className="space-y-1.5 sm:space-y-1">
                    <Label htmlFor="create-start">Startdato</Label>
                    <Input
                      id="create-start"
                      type="date"
                      value={createStart}
                      onChange={(e) => setCreateStart(e.target.value)}
                      className="min-h-12 text-base sm:min-h-10 sm:text-sm"
                    />
                  </div>
                  <div className="space-y-1.5 sm:space-y-1">
                    <Label htmlFor="create-due">Sluttdato</Label>
                    <Input
                      id="create-due"
                      type="date"
                      value={createDue}
                      onChange={(e) => setCreateDue(e.target.value)}
                      className="min-h-12 text-base sm:min-h-10 sm:text-sm"
                    />
                  </div>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Tildelt</Label>
                  <AssigneePicker
                    selectedIds={createAssigneeIds}
                    members={memberOptions}
                    canEdit
                    onChange={setCreateAssigneeIds}
                    emptyLabel="Ingen tildelt ennå"
                  />
                </div>
              </div>
            ) : null}
          </DialogBody>
          <DialogFooter className="max-sm:gap-2.5">
            <Button
              type="button"
              variant="outline"
              className="min-h-11 touch-manipulation sm:min-h-9 max-sm:w-full"
              onClick={closeCreateDialog}
            >
              Avbryt
            </Button>
            <Button
              type="button"
              className="min-h-12 touch-manipulation text-base sm:min-h-9 sm:text-sm max-sm:w-full"
              disabled={busy || !createTitle.trim()}
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
          if (!o) {
            setSelected(null);
            if (isPageDetail) {
              router.push(pulsBoardPath(workspaceId, boardId));
            }
          }
        }}
      >
        <DialogContent
          size={
            detailSize === "normal"
              ? "3xl"
              : detailSize === "large"
                ? "5xl"
                : "7xl"
          }
          fillViewport={isPageDetail || detailSize === "full"}
          titleId="issue-detail-title"
        >
          <DialogHeader>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
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
              </div>
              {selected ? (
                <div className="flex shrink-0 flex-wrap items-center gap-1">
                  <button
                    type="button"
                    title={
                      detailSize === "full"
                        ? "Mindre kort"
                        : "Større kort (fullskjerm)"
                    }
                    aria-label={
                      detailSize === "full"
                        ? "Mindre kort"
                        : "Større kort (fullskjerm)"
                    }
                    className="text-muted-foreground hover:text-foreground inline-flex size-9 items-center justify-center rounded-lg border border-border/50"
                    onClick={() => {
                      const next: DetailSize =
                        detailSize === "full" ? "large" : "full";
                      setDetailSize(next);
                      persistUiLocal({ detailSize: next });
                      void setUiPrefs({
                        boardId,
                        detailSize: next,
                      }).catch(() => {
                        /* ignore */
                      });
                    }}
                  >
                    {detailSize === "full" ? (
                      <Minimize2 className="size-3.5" aria-hidden />
                    ) : (
                      <Maximize2 className="size-3.5" aria-hidden />
                    )}
                  </button>
                  <a
                    href={pulsBoardPath(workspaceId, boardId, selected._id, {
                      page: true,
                    })}
                    target="_blank"
                    rel="noreferrer"
                    title="Åpne i egen fane"
                    className="text-muted-foreground hover:text-foreground inline-flex size-9 items-center justify-center rounded-lg border border-border/50"
                  >
                    <ExternalLink className="size-3.5" aria-hidden />
                  </a>
                </div>
              ) : null}
            </div>
            <div className="mt-3 flex gap-1 overflow-x-auto">
              {DETAIL_TABS.filter(
                (tab) =>
                  !(
                    commentsPlacement === "overview" && tab.id === "kommentarer"
                  ),
              ).map((tab) => (
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
              <DialogBody className="min-w-0 space-y-4 overflow-x-hidden">
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
                    <div className="space-y-2">
                      <Label htmlFor="detail-desc">Beskrivelse</Label>
                      <CardDescriptionEditor
                        key={selected._id}
                        aria-label="Beskrivelse"
                        value={editDescription}
                        onChange={setEditDescription}
                        disabled={!selected.canEdit}
                        rows={6}
                        insertToken={
                          selected.canEdit ? descInsertToken : null
                        }
                        onInsertConsumed={() => setDescInsertToken(null)}
                        onPromoteChecklistItem={
                          selected.canEdit
                            ? (item) => {
                                void promoteChecklistItem(item);
                              }
                            : undefined
                        }
                        onUploadImage={
                          selected.canEdit
                            ? async (file) => {
                                const postUrl =
                                  await generateTaskFileUploadUrl({
                                    taskId: selected._id,
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
                                  taskId: selected._id,
                                  storageId: json.storageId,
                                  fileName: file.name || "bilde.jpg",
                                });
                                if (!attached.url) {
                                  throw new Error(
                                    "Bildet ble lastet opp, men mangler URL",
                                  );
                                }
                                const alt = (attached.fileName || "bilde")
                                  .replace(/[\[\]]/g, "");
                                return `![${alt}](${attached.url})`;
                              }
                            : undefined
                        }
                        onCommit={
                          selected.canEdit
                            ? async (next) => {
                                try {
                                  await updateTask({
                                    taskId: selected._id,
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
                        taskId={selected._id}
                        canEdit={selected.canEdit}
                        onInsertRef={
                          selected.canEdit
                            ? (md) => setDescInsertToken(md)
                            : undefined
                        }
                      />
                    </div>
                    <div className="border-border/50 bg-muted/15 space-y-4 rounded-xl border p-3.5 sm:p-4">
                      <MetaRow label="Kolonne">
                        <CompactSelect
                          id="detail-col"
                          aria-label="Kolonne"
                          value={editColumnId}
                          disabled={!selected.canEdit}
                          onChange={(v) =>
                            setEditColumnId(v as Id<"pulsBoardColumns"> | "")
                          }
                          allowClear={false}
                          options={columns.map((c) => ({
                            value: c._id,
                            label: c.name,
                          }))}
                        />
                      </MetaRow>
                      <MetaRow label="Datoer" hint="Valgfritt">
                        <div className="grid max-w-sm grid-cols-1 gap-2 sm:grid-cols-2">
                          <Input
                            id="detail-start"
                            type="date"
                            aria-label="Startdato"
                            value={editStart}
                            onChange={(e) => setEditStart(e.target.value)}
                            disabled={!selected.canEdit}
                            className="h-10"
                          />
                          <Input
                            id="detail-due"
                            type="date"
                            aria-label="Sluttdato"
                            value={editDue}
                            onChange={(e) => setEditDue(e.target.value)}
                            disabled={!selected.canEdit}
                            className="h-10"
                          />
                        </div>
                      </MetaRow>
                      <MetaRow
                        label="Tildelt"
                        hint="Får varsel ved tildeling og kommentarer"
                      >
                        <AssigneePicker
                          selectedIds={editAssigneeIds}
                          members={memberOptions}
                          canEdit={selected.canEdit}
                          onChange={setEditAssigneeIds}
                        />
                      </MetaRow>
                      <div className="border-border/40 border-t" />
                      <MetaRow label="Type">
                        <CompactSelect
                          id="detail-issue-type"
                          aria-label="Type"
                          value={editIssueType}
                          disabled={!selected.canEdit}
                          onChange={setEditIssueType}
                          options={optionsWithCurrent(
                            ISSUE_TYPE_OPTIONS,
                            editIssueType,
                          ).map((opt) => ({ value: opt, label: opt }))}
                        />
                      </MetaRow>
                      <MetaRow label="Prioritet">
                        <CompactSelect
                          id="detail-priority-label"
                          aria-label="Prioritet"
                          value={editPriorityLabel}
                          disabled={!selected.canEdit}
                          onChange={setEditPriorityLabel}
                          options={optionsWithCurrent(
                            PRIORITY_LABEL_OPTIONS,
                            editPriorityLabel,
                          ).map((opt) => ({ value: opt, label: opt }))}
                        />
                      </MetaRow>
                      <MetaRow label="Størrelse">
                        <CompactSelect
                          id="detail-size"
                          aria-label="Størrelse"
                          value={editSize}
                          disabled={!selected.canEdit}
                          onChange={setEditSize}
                          options={optionsWithCurrent(
                            SIZE_OPTIONS,
                            editSize,
                          ).map((opt) => ({ value: opt, label: opt }))}
                        />
                      </MetaRow>
                      <MetaRow label="Estimat">
                        <CompactSelect
                          id="detail-estimate"
                          aria-label="Estimat"
                          value={editEstimate}
                          disabled={!selected.canEdit}
                          onChange={setEditEstimate}
                          options={optionsWithCurrent(
                            ESTIMATE_OPTIONS,
                            editEstimate,
                          ).map((opt) => ({ value: opt, label: opt }))}
                        />
                      </MetaRow>
                      <MetaRow label="Milepæl">
                        <Input
                          id="detail-milestone"
                          value={editMilestone}
                          onChange={(e) => setEditMilestone(e.target.value)}
                          disabled={!selected.canEdit}
                          placeholder="F.eks. v1.0"
                          className="h-10 max-w-sm"
                        />
                      </MetaRow>
                      <MetaRow label="Etiketter">
                        <LabelChipsEditor
                          labels={editLabels}
                          canEdit={selected.canEdit}
                          draft={editLabelDraft}
                          onDraftChange={setEditLabelDraft}
                          onChange={setEditLabels}
                        />
                      </MetaRow>
                    </div>
                    {commentsPlacement === "overview" ? (
                      <div className="border-border/40 mt-2 space-y-3 border-t pt-5">
                        <AssessmentTaskCommentThreads
                          workspaceId={workspaceId}
                          taskId={selected._id}
                          canEdit={selected.canEdit}
                        />
                      </div>
                    ) : null}
                  </>
                ) : null}

                {detailTab === "koblinger" ? (
                  <div className="min-w-0 space-y-3">
                    <LinkSection
                      icon={<ListTree className="size-3.5" aria-hidden />}
                      title={
                        selected.linkKind === "process"
                          ? "Prosess"
                          : selected.linkKind === "ros"
                            ? "ROS"
                            : selected.linkKind === "pdd"
                              ? "PDD"
                              : selected.linkKind === "form"
                                ? "Skjema"
                                : "Vurdering"
                      }
                    >
                      {selected.linkHref ? (
                        <Link
                          href={selected.linkHref}
                          className="text-foreground hover:text-foreground/80 block min-w-0 truncate text-sm font-medium underline-offset-2 touch-manipulation hover:underline"
                        >
                          {selected.linkLabel || selected.assessmentTitle} →
                        </Link>
                      ) : (
                        <p className="text-muted-foreground text-sm">
                          {selected.linkLabel || "Ingen kobling"}
                        </p>
                      )}
                    </LinkSection>

                    <LinkSection
                      icon={<Workflow className="size-3.5" aria-hidden />}
                      title="Prosesser"
                    >
                      {selected.linkedProcesses.length > 0 ? (
                        <ul className="flex min-w-0 flex-wrap gap-1.5">
                          {selected.linkedProcesses.map((p) => (
                            <li key={p.id} className="min-w-0 max-w-full">
                              <Link
                                href={`/w/${workspaceId}/vurderinger?fane=prosesser&rediger=${p.id}`}
                                className="bg-violet-500/15 text-violet-900 dark:text-violet-100 inline-flex max-w-full min-h-8 items-center truncate rounded-full px-2.5 text-xs font-medium"
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
                      {selected.canEdit &&
                      selected.assessmentId &&
                      availableProcessesToLink.length > 0 ? (
                        <div className="grid min-w-0 gap-2">
                          <SearchableSelect
                            aria-label="Koble prosess"
                            value={linkCandidateId}
                            onChange={(v) =>
                              setLinkCandidateId(v as Id<"candidates"> | "")
                            }
                            placeholder="Koble prosess …"
                            clearLabel="Koble prosess …"
                            options={availableProcessesToLink.map((p) => ({
                              value: p._id,
                              label: p.code
                                ? `${p.code} — ${p.name}`
                                : p.name,
                            }))}
                            triggerClassName="min-h-10 rounded-lg"
                          />
                          <Button
                            type="button"
                            size="sm"
                            className="h-10 w-full touch-manipulation"
                            disabled={busy || !linkCandidateId}
                            onClick={() => {
                              if (!linkCandidateId || !selected.assessmentId)
                                return;
                              void linkProcess({
                                candidateId: linkCandidateId,
                                assessmentId: selected.assessmentId,
                              })
                                .then(() => {
                                  toast.success(
                                    "Prosess koblet til vurderingen",
                                  );
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
                            Koble prosess
                          </Button>
                        </div>
                      ) : null}
                    </LinkSection>

                    <LinkSection
                      icon={<Shield className="size-3.5" aria-hidden />}
                      title="ROS"
                    >
                      {selected.linkedRos.length > 0 ? (
                        <ul className="min-w-0 space-y-1.5">
                          {selected.linkedRos.map((r) => (
                            <li key={r.id} className="min-w-0">
                              <Link
                                href={`/w/${workspaceId}/ros/a/${r.id}`}
                                className="hover:bg-muted/60 flex min-h-10 min-w-0 items-center justify-between gap-2 rounded-lg border border-border/40 bg-card px-2.5 py-2 text-sm"
                              >
                                <span className="min-w-0 truncate font-medium">
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
                      {selected.canEdit &&
                      selected.assessmentId &&
                      availableRosToLink.length > 0 ? (
                        <div className="grid min-w-0 gap-2">
                          <SearchableSelect
                            aria-label="Koble ROS"
                            value={linkRosId}
                            onChange={(v) =>
                              setLinkRosId(v as Id<"rosAnalyses"> | "")
                            }
                            placeholder="Koble ROS …"
                            clearLabel="Koble ROS …"
                            options={availableRosToLink.map((r) => ({
                              value: r.id,
                              label: r.title,
                            }))}
                            triggerClassName="min-h-10 rounded-lg"
                          />
                          <Button
                            type="button"
                            size="sm"
                            className="h-10 w-full touch-manipulation"
                            disabled={busy || !linkRosId}
                            onClick={() => {
                              if (!linkRosId || !selected.assessmentId) return;
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
                            Koble ROS
                          </Button>
                        </div>
                      ) : null}
                    </LinkSection>

                    <LinkSection
                      icon={<Link2 className="size-3.5" aria-hidden />}
                      title={pulsBoardCopy.parentLabel}
                    >
                      <p className="text-muted-foreground text-xs leading-relaxed">
                        {pulsBoardCopy.parentHint}
                      </p>
                      <SearchableSelect
                        aria-label={pulsBoardCopy.parentLabel}
                        value={editParentId}
                        onChange={(v) =>
                          setEditParentId(v as Id<"assessmentTasks"> | "")
                        }
                        disabled={!selected.canEdit}
                        placeholder={pulsBoardCopy.parentNone}
                        clearLabel={pulsBoardCopy.parentNone}
                        options={linkParentOptions.map((p) => ({
                          value: p._id,
                          label: pulsBoardCopy.parentUnder(
                            parentOptionLabel(p),
                          ),
                        }))}
                        triggerClassName="min-h-10 rounded-lg"
                      />
                      {selected.parentTaskId || editParentId ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-9 w-full justify-start gap-1 px-2 text-xs touch-manipulation"
                          disabled={!selected.canEdit}
                          onClick={() => setEditParentId("")}
                        >
                          <Unlink className="size-3.5" />
                          Fjern kobling
                        </Button>
                      ) : null}
                    </LinkSection>

                    {childSubIssues.length > 0 ? (
                      <LinkSection
                        icon={<ListTree className="size-3.5" aria-hidden />}
                        title={pulsBoardCopy.directSubcards}
                      >
                        <div className="text-muted-foreground mb-1 text-xs tabular-nums">
                          {selected.subIssueDoneCount}/{selected.subIssueCount}{" "}
                          ferdig
                        </div>
                        <ul className="min-w-0 space-y-1.5">
                          {childSubIssues.map((child) => (
                            <li key={child._id} className="min-w-0">
                              <button
                                type="button"
                                className="hover:bg-muted/60 flex min-h-11 w-full min-w-0 items-start justify-between gap-2 rounded-lg border border-border/40 bg-card px-2.5 py-2 text-left text-sm touch-manipulation"
                                onClick={() => openDetail(child)}
                              >
                                <span className="min-w-0 flex-1">
                                  <span
                                    className={cn(
                                      "block truncate font-medium leading-snug",
                                      child.status === "done" &&
                                        "text-muted-foreground line-through",
                                    )}
                                  >
                                    {child.title}
                                  </span>
                                  <span className="text-muted-foreground block truncate text-[11px]">
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
                      </LinkSection>
                    ) : null}

                    {selected.canEdit ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-10 w-full touch-manipulation"
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
                  </div>
                ) : null}

                {detailTab === "kommentarer" ? (
                  <AssessmentTaskCommentThreads
                    workspaceId={workspaceId}
                    taskId={selected._id}
                    canEdit={selected.canEdit}
                  />
                ) : null}

                {detailTab === "mer" ? (
                  <div className="min-w-0 space-y-4">
                    <div className="space-y-2 rounded-xl border border-border/50 p-3">
                      <p className="text-sm font-medium">Visning</p>
                      <p className="text-muted-foreground text-xs leading-relaxed">
                        Kommentarer under oversikt, standard kortstørrelse og
                        mer styres under{" "}
                        <span className="text-foreground font-medium">
                          Innstillinger
                        </span>{" "}
                        på tavlen (personlige valg).
                      </p>
                      <a
                        href={pulsBoardPath(workspaceId, boardId, selected._id, {
                          page: true,
                        })}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sky-800 dark:text-sky-200 inline-flex items-center gap-1.5 text-xs font-medium underline-offset-2 hover:underline"
                      >
                        <ExternalLink className="size-3.5" aria-hidden />
                        Åpne kort i egen fane
                      </a>
                    </div>
                    <TaskGithubControls
                      taskId={selected._id}
                      canEdit={selected.canEdit}
                      githubIssueUrl={selected.githubIssueUrl}
                      workspaceDefaultRepos={effectiveGithubDefaultRepos(
                        workspace ?? null,
                      )}
                    />
                    {selected.canEdit ? (
                      <LinkSection
                        icon={<ListTree className="size-3.5" aria-hidden />}
                        title="Flytt til annen tavle"
                      >
                        <p className="text-muted-foreground text-xs leading-relaxed">
                          Kortet og delkort flyttes til valgt tavle. Kobling til
                          vurdering beholdes.
                        </p>
                        <SearchableSelect
                          aria-label="Flytt til annen tavle"
                          value={moveBoardId}
                          onChange={(v) =>
                            setMoveBoardId(v as Id<"pulsBoards"> | "")
                          }
                          placeholder="Velg tavle …"
                          clearLabel="Velg tavle …"
                          options={(otherBoards?.boards ?? [])
                            .filter((b) => b._id !== boardId)
                            .map((b) => ({
                              value: b._id,
                              label: b.name,
                            }))}
                          triggerClassName="min-h-10 rounded-lg"
                        />
                        <Button
                          type="button"
                          size="sm"
                          className="h-10 w-full touch-manipulation"
                          disabled={busy || !moveBoardId}
                          onClick={() => {
                            if (!moveBoardId) return;
                            setBusy(true);
                            void moveToBoard({
                              taskId: selected._id,
                              targetBoardId: moveBoardId,
                              moveSubtree: true,
                            })
                              .then(() => {
                                toast.success("Kort flyttet");
                                setSelected(null);
                                setMoveBoardId("");
                              })
                              .catch((err: unknown) =>
                                toast.error(
                                  err instanceof Error
                                    ? err.message
                                    : "Kunne ikke flytte",
                                ),
                              )
                              .finally(() => setBusy(false));
                          }}
                        >
                          Flytt kort og delkort
                        </Button>
                      </LinkSection>
                    ) : null}
                    {selected.canEdit ? (
                      <Button
                        type="button"
                        variant="destructive"
                        className="h-10 w-full touch-manipulation"
                        disabled={busy}
                        onClick={() => {
                          if (
                            window.confirm(
                              "Er du sikker på at du vil slette dette kortet permanent?\n\nDette kan ikke angres.",
                            )
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
                  </div>
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
          if (!o) {
            setCompletePrompt(null);
            setCompleteComment("");
          }
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
              Marker ferdig
            </h2>
          </DialogHeader>
          <DialogBody className="min-w-0 space-y-3 text-sm">
            <p className="text-muted-foreground">
              {completePrompt
                ? hasOpenDescendants(completePrompt, cards)
                  ? pulsBoardCopy.completePromptBody(completePrompt.title)
                  : `Marker «${completePrompt.title}» som ferdig. Tildelte varsles.`
                : null}
            </p>
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="complete-comment">
                Kommentar (valgfritt)
              </Label>
              <Textarea
                id="complete-comment"
                value={completeComment}
                onChange={(e) => setCompleteComment(e.target.value)}
                placeholder="F.eks. hva som ble gjort …"
                rows={3}
                className="min-w-0 resize-none"
              />
            </div>
          </DialogBody>
          <DialogFooter className="flex flex-col gap-2 sm:flex-col">
            {completePrompt && hasOpenDescendants(completePrompt, cards) ? (
              <>
                <Button
                  type="button"
                  className="h-10 w-full touch-manipulation"
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
                  className="h-10 w-full touch-manipulation"
                  disabled={busy || !completePrompt}
                  onClick={() =>
                    completePrompt &&
                    void finishComplete(completePrompt, false)
                  }
                >
                  {pulsBoardCopy.completeOnly}
                </Button>
              </>
            ) : (
              <Button
                type="button"
                className="h-10 w-full touch-manipulation"
                disabled={busy || !completePrompt}
                onClick={() =>
                  completePrompt && void finishComplete(completePrompt, false)
                }
              >
                Fullfør kort
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              className="h-10 w-full touch-manipulation"
              onClick={() => {
                setCompletePrompt(null);
                setCompleteComment("");
              }}
            >
              Avbryt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={columnsOpen} onOpenChange={setColumnsOpen}>
        <DialogContent size="md" titleId="columns-title">
          <DialogHeader>
            <h2
              id="columns-title"
              className="font-heading text-lg font-semibold"
            >
              Kolonnestruktur
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Velg mal, eller tilpass kolonner manuelt.
              {boardMeta?.columnTemplate
                ? ` Aktiv: ${
                    boardMeta.columnTemplate === "priority"
                      ? "Prioritet"
                      : boardMeta.columnTemplate === "phases"
                        ? "Utviklingsfaser"
                        : boardMeta.columnTemplate === "empty"
                          ? "Tom tavle"
                          : "Tilpasset"
                  }.`
                : ""}
            </p>
          </DialogHeader>
          <DialogBody className="min-w-0 space-y-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold tracking-wide uppercase">
                Maler
              </p>
              <div className="grid min-w-0 gap-2">
                {(templates ?? []).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      if (
                        !window.confirm(
                          `Erstatt kolonnestrukturen med malen «${t.label}»?\n\nEksisterende kort flyttes best mulig til nye kolonner.`,
                        )
                      ) {
                        return;
                      }
                      setBusy(true);
                      void applyTemplate({
                        boardId,
                        templateId: t.id,
                      })
                        .then(() => {
                          toast.success(`Mal «${t.label}» aktivert`);
                        })
                        .catch((err: unknown) =>
                          toast.error(
                            err instanceof Error
                              ? err.message
                              : "Kunne ikke bytte mal",
                          ),
                        )
                        .finally(() => setBusy(false));
                    }}
                    className={cn(
                      "hover:bg-muted/40 min-w-0 rounded-xl border border-border/50 p-3 text-left transition-colors",
                      boardMeta?.columnTemplate === t.id &&
                        "border-sky-500/40 bg-sky-500/5 ring-1 ring-sky-500/20",
                    )}
                  >
                    <p className="text-sm font-medium">{t.label}</p>
                    <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
                      {t.description}
                    </p>
                    <p className="text-muted-foreground mt-1.5 truncate text-[11px]">
                      {t.columnNames.join(" → ")}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold tracking-wide uppercase">
                Kolonner
              </p>
              <ul className="min-w-0 space-y-2">
                {columns.map((col) => (
                  <li
                    key={col._id}
                    className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-border/50 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{col.name}</p>
                      <p className="text-muted-foreground text-[11px]">
                        {col.isDone ? "Ferdig-kolonne" : "Åpen kolonne"}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-8"
                        onClick={() => {
                          const name = window.prompt(
                            "Nytt kolonnenavn",
                            col.name,
                          );
                          if (!name?.trim() || name.trim() === col.name)
                            return;
                          void renameColumn({
                            columnId: col._id,
                            name: name.trim(),
                          }).then(() => toast.success("Oppdatert"));
                        }}
                      >
                        Endre
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-destructive h-8"
                        onClick={() => {
                          if (
                            !window.confirm(
                              `Er du sikker på at du vil slette kolonnen «${col.name}»?\n\nKortene flyttes til en annen kolonne.`,
                            )
                          ) {
                            return;
                          }
                          void removeColumn({ columnId: col._id })
                            .then(() => toast.success("Slettet"))
                            .catch((err: unknown) =>
                              toast.error(
                                err instanceof Error
                                  ? err.message
                                  : "Kunne ikke slette",
                              ),
                            );
                        }}
                      >
                        Slett
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="grid min-w-0 gap-2 rounded-xl border border-dashed border-border/60 p-3">
              <Label htmlFor="new-col">Ny kolonne</Label>
              <Input
                id="new-col"
                value={newColumnName}
                onChange={(e) => setNewColumnName(e.target.value)}
                placeholder="F.eks. Pågår"
                className="min-w-0"
              />
              <Button
                type="button"
                className="h-10 w-full"
                disabled={busy || !newColumnName.trim()}
                onClick={() => {
                  setBusy(true);
                  void createColumn({
                    boardId,
                    name: newColumnName.trim(),
                  })
                    .then(() => {
                      toast.success("Kolonne lagt til");
                      setNewColumnName("");
                    })
                    .catch((err: unknown) =>
                      toast.error(
                        err instanceof Error
                          ? err.message
                          : "Kunne ikke legge til",
                      ),
                    )
                    .finally(() => setBusy(false));
                }}
              >
                <Plus className="size-3.5" />
                Legg til kolonne
              </Button>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="h-10"
              onClick={() => setColumnsOpen(false)}
            >
              Lukk
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
