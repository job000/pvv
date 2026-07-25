"use client";

import {
  ProductEmptyState,
  ProductLoadingBlock,
} from "@/components/product";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { FilterToolbar } from "@/components/ui/filter-toolbar";
import { ListViewModeToggle } from "@/components/ui/list-view-mode-toggle";
import { SearchInput } from "@/components/ui/search-input";
import {
  WorkspaceTaskPreviewDialog,
  type WorkspaceTaskPreview,
} from "@/components/workspace/workspace-task-preview-dialog";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "@/lib/app-toast";
import type { ListViewMode } from "@/lib/list-view-mode";
import { useStickyState } from "@/lib/use-sticky-state";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowUpRight,
  ClipboardList,
  FileText,
  ListChecks,
  Shield,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

type MyStatus = "pending" | "accepted" | "declined" | "done";
type FilterKey = "all" | MyStatus | "assigned";
type KindFilter = "all" | "assessment" | "ros" | "intake";
type PriorityFilter = "all" | "1" | "2" | "3" | "4" | "5";

const STATUS_LABEL: Record<MyStatus, string> = {
  pending: "Ikke tatt imot",
  accepted: "Tatt imot",
  done: "Utført",
  declined: "Returnert",
};

const KIND_LABEL: Record<Exclude<KindFilter, "all">, string> = {
  assessment: "Vurdering",
  ros: "ROS",
  intake: "Forslag",
};

const selectClass = cn(
  "border-input h-11 w-full appearance-none rounded-xl border border-border/60 bg-background bg-[length:1rem] bg-[right_0.85rem_center] bg-no-repeat px-3 pr-10 text-sm shadow-sm",
  "transition-colors focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35",
  "sm:h-10 sm:w-auto sm:min-w-[9.5rem] dark:bg-input/30",
);

const selectChevronStyle = {
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
} as const;

function statusTone(status: MyStatus) {
  switch (status) {
    case "pending":
      return "bg-amber-500/15 text-amber-800 dark:text-amber-200";
    case "accepted":
      return "bg-sky-500/15 text-sky-800 dark:text-sky-200";
    case "done":
      return "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200";
    case "declined":
      return "bg-muted text-muted-foreground";
  }
}

function matchesQuery(
  haystack: Array<string | null | undefined>,
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return haystack.some((part) => (part ?? "").toLowerCase().includes(q));
}

export function WorkspaceTasksPanel({
  workspaceId,
}: {
  workspaceId: Id<"workspaces">;
}) {
  const data = useQuery(api.workspaceTasks.listMyInWorkspace, { workspaceId });
  const respond = useMutation(api.workspaceTasks.respond);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [viewMode, setViewMode] = useStickyState<ListViewMode>(
    `tasks:${workspaceId}:view`,
    "list",
  );
  const [busy, setBusy] = useState(false);
  const [previewTask, setPreviewTask] = useState<WorkspaceTaskPreview | null>(
    null,
  );

  const counts = useMemo(() => {
    if (!data) return null;
    const c = { pending: 0, accepted: 0, done: 0, declined: 0 };
    for (const t of data.mine) {
      c[t.myStatus] += 1;
    }
    return c;
  }, [data]);

  const visibleMine = useMemo(() => {
    if (!data) return [];
    let rows =
      filter === "all"
        ? data.mine.filter((t) => t.myStatus !== "declined")
        : filter === "assigned"
          ? []
          : data.mine.filter((t) => t.myStatus === filter);

    if (kindFilter !== "all") {
      rows = rows.filter((t) => t.kind === kindFilter);
    }
    if (priorityFilter !== "all") {
      const p = Number(priorityFilter);
      rows = rows.filter((t) => t.priority === p);
    }
    if (search.trim()) {
      rows = rows.filter((t) =>
        matchesQuery(
          [
            t.title,
            t.contextTitle,
            t.description,
            t.assigneeName,
            t.assignerName,
            t.work.kindLabel,
            t.work.rosTreatment?.kindLabel,
            t.work.rosTreatment?.linkedRiskSummary,
          ],
          search,
        ),
      );
    }
    return rows;
  }, [data, filter, kindFilter, priorityFilter, search]);

  const visibleAssigned = useMemo(() => {
    if (!data || filter !== "assigned") return [];
    let rows = data.assignedByMe;
    if (kindFilter !== "all") {
      rows = rows.filter((t) => t.kind === kindFilter);
    }
    if (priorityFilter !== "all") {
      const p = Number(priorityFilter);
      rows = rows.filter((t) => t.priority === p);
    }
    if (search.trim()) {
      rows = rows.filter((t) =>
        matchesQuery(
          [
            t.title,
            t.contextTitle,
            t.description,
            ...t.assignees.map((a) => a.name),
          ],
          search,
        ),
      );
    }
    return rows;
  }, [data, filter, kindFilter, priorityFilter, search]);

  const runAction = async (
    kind: "assessment" | "ros" | "intake",
    taskId: string,
    action: "accept" | "decline" | "complete" | "reopen",
    opts?: {
      note?: string;
      completionJustification?: string;
      completionDueAt?: number | null;
      undoLabel?: string;
    },
  ) => {
    setBusy(true);
    try {
      await respond({
        kind,
        taskId,
        action,
        note: opts?.note,
        completionJustification: opts?.completionJustification,
        completionDueAt: opts?.completionDueAt,
      });
      if (action === "accept") toast.success("Oppgave tatt imot");
      else if (action === "decline")
        toast.success("Oppgave returnert til den som tildelte deg");
      else if (action === "complete") {
        const label = opts?.undoLabel ?? "Angre";
        toast.success("Registrert som utført", {
          description: "Feil? Du kan angre med en gang.",
          action: {
            label,
            onClick: () => {
              void runAction(kind, taskId, "reopen");
            },
          },
          duration: 12_000,
        });
      } else toast.success("Angret — oppgaven er åpen igjen");
      setPreviewTask(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Noe gikk galt");
    } finally {
      setBusy(false);
    }
  };

  if (data === undefined) {
    return (
      <ProductLoadingBlock label="Laster oppgaver …" className="min-h-[30vh]" />
    );
  }

  const filters: { key: FilterKey; label: string; count?: number }[] = [
    {
      key: "all",
      label: "Mine",
      count: data.mine.filter((t) => t.myStatus !== "declined").length,
    },
    { key: "pending", label: "Venter", count: counts?.pending },
    { key: "accepted", label: "Pågår", count: counts?.accepted },
    { key: "done", label: "Utført", count: counts?.done },
    {
      key: "assigned",
      label: "Tildelt av meg",
      count: data.assignedByMe.length,
    },
  ];

  const hasActiveExtraFilters =
    search.trim().length > 0 ||
    kindFilter !== "all" ||
    priorityFilter !== "all";

  const clearExtraFilters = () => {
    setSearch("");
    setKindFilter("all");
    setPriorityFilter("all");
  };

  const resultCount =
    filter === "assigned" ? visibleAssigned.length : visibleMine.length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={cn(
              "inline-flex min-h-10 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium transition-colors",
              filter === f.key
                ? "bg-foreground text-background"
                : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {f.label}
            {f.count !== undefined ? (
              <span className="tabular-nums opacity-80">{f.count}</span>
            ) : null}
          </button>
        ))}
      </div>

      <FilterToolbar className="rounded-2xl border border-border/50 bg-card/30 p-3 sm:p-3.5">
        <SearchInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Søk tittel, kontekst, person …"
          aria-label="Søk i oppgaver"
          className="min-w-0 flex-1 sm:max-w-md"
          inputClassName="h-11 min-h-11 rounded-xl border-border/60 md:h-10 md:min-h-10"
        />
        <label className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground sm:w-auto">
          <span className="px-0.5 font-medium">Type</span>
          <select
            aria-label="Filtrer på type"
            value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value as KindFilter)}
            className={selectClass}
            style={selectChevronStyle}
          >
            <option value="all">Alle typer</option>
            <option value="assessment">Vurdering</option>
            <option value="ros">ROS</option>
            <option value="intake">Forslag</option>
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground sm:w-auto">
          <span className="px-0.5 font-medium">Prioritet</span>
          <select
            aria-label="Filtrer på prioritet"
            value={priorityFilter}
            onChange={(e) =>
              setPriorityFilter(e.target.value as PriorityFilter)
            }
            className={selectClass}
            style={selectChevronStyle}
          >
            <option value="all">Alle</option>
            <option value="1">P1</option>
            <option value="2">P2</option>
            <option value="3">P3</option>
            <option value="4">P4</option>
            <option value="5">P5</option>
          </select>
        </label>
        <div className="flex flex-wrap items-end justify-between gap-2 sm:ml-auto">
          <p className="text-muted-foreground pb-1 text-xs tabular-nums sm:order-2">
            {resultCount} treff
          </p>
          <ListViewModeToggle
            value={viewMode}
            onChange={setViewMode}
            className="sm:order-1"
          />
        </div>
        {hasActiveExtraFilters ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-10 self-end"
            onClick={clearExtraFilters}
          >
            Nullstill filter
          </Button>
        ) : null}
      </FilterToolbar>

      {filter === "assigned" ? (
        visibleAssigned.length === 0 ? (
          <ProductEmptyState
            icon={ListChecks}
            title={
              hasActiveExtraFilters
                ? "Ingen treff"
                : "Ingen oppgaver du har tildelt"
            }
            description={
              hasActiveExtraFilters
                ? "Prøv et annet søk eller nullstill filtrene."
                : "Når du tildeler oppgaver til andre i vurderinger eller ROS, dukker de opp her — med status for hver person."
            }
          />
        ) : (
          <AssignedTasksView
            tasks={visibleAssigned}
            viewMode={viewMode}
          />
        )
      ) : visibleMine.length === 0 ? (
        <ProductEmptyState
          icon={ClipboardList}
          title={
            hasActiveExtraFilters
              ? "Ingen treff"
              : filter === "pending"
                ? "Ingen ventende tildelinger"
                : "Ingen oppgaver her"
          }
          description={
            hasActiveExtraFilters
              ? "Prøv et annet søk eller nullstill filtrene."
              : "Oppgaver som er tildelt deg i dette arbeidsområdet vises her. Åpne en oppgave for forhåndsvisning, godta, returner eller merk som utført."
          }
        />
      ) : (
        <MineTasksView
          tasks={visibleMine}
          viewMode={viewMode}
          busy={busy}
          onOpen={(task) => setPreviewTask(task)}
          onReopen={(task) => void runAction(task.kind, task.taskId, "reopen")}
        />
      )}

      <WorkspaceTaskPreviewDialog
        task={previewTask}
        open={previewTask !== null}
        onOpenChange={(v) => {
          if (!v) setPreviewTask(null);
        }}
        busy={busy}
        onAction={async (action, opts) => {
          if (!previewTask) return;
          const undoLabel =
            previewTask.work.rosTreatment?.kind === "accept"
              ? "Angre aksept"
              : "Angre";
          await runAction(previewTask.kind, previewTask.taskId, action, {
            ...opts,
            undoLabel,
          });
        }}
      />
    </div>
  );
}

type MineTask = WorkspaceTaskPreview & {
  title: string;
  description?: string;
  priority: number;
  dueAt?: number;
  contextTitle: string;
  href: string;
};

function MineTasksView({
  tasks,
  viewMode,
  busy,
  onOpen,
  onReopen,
}: {
  tasks: MineTask[];
  viewMode: ListViewMode;
  busy: boolean;
  onOpen: (task: MineTask) => void;
  onReopen: (task: MineTask) => void;
}) {
  if (viewMode === "table") {
    return (
      <div className="overflow-x-auto rounded-2xl border border-border/60 bg-card/40">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="border-b border-border/50 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Oppgave</th>
              <th className="px-3 py-3 font-medium">Type</th>
              <th className="px-3 py-3 font-medium">Status</th>
              <th className="px-3 py-3 font-medium">P</th>
              <th className="px-3 py-3 font-medium">Frist</th>
              <th className="px-4 py-3 font-medium">Handling</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {tasks.map((task) => (
              <tr key={`${task.kind}:${task.taskId}`} className="hover:bg-muted/20">
                <td className="px-4 py-3">
                  <button
                    type="button"
                    className="text-left font-medium text-foreground hover:underline"
                    onClick={() => onOpen(task)}
                  >
                    {task.title}
                  </button>
                  <p className="text-muted-foreground mt-0.5 line-clamp-1 text-xs">
                    {task.contextTitle}
                  </p>
                </td>
                <td className="px-3 py-3">
                  <KindBadge kind={task.kind} />
                </td>
                <td className="px-3 py-3">
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-xs font-medium",
                      statusTone(task.myStatus),
                    )}
                  >
                    {STATUS_LABEL[task.myStatus]}
                  </span>
                </td>
                <td className="px-3 py-3 tabular-nums text-muted-foreground">
                  P{task.priority}
                </td>
                <td className="px-3 py-3 text-muted-foreground">
                  {task.dueAt
                    ? new Date(task.dueAt).toLocaleDateString("nb-NO")
                    : "—"}
                </td>
                <td className="px-4 py-3">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => onOpen(task)}
                  >
                    Åpne
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (viewMode === "cards") {
    return (
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {tasks.map((task) => (
          <li key={`${task.kind}:${task.taskId}`}>
            <MineTaskCard
              task={task}
              busy={busy}
              onOpen={onOpen}
              onReopen={onReopen}
              compact
            />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul className="divide-y divide-border/60 rounded-2xl border border-border/60 bg-card/40">
      {tasks.map((task) => (
        <li key={`${task.kind}:${task.taskId}`} className="px-4 py-4 sm:px-5">
          <MineTaskCard
            task={task}
            busy={busy}
            onOpen={onOpen}
            onReopen={onReopen}
          />
        </li>
      ))}
    </ul>
  );
}

function MineTaskCard({
  task,
  busy,
  onOpen,
  onReopen,
  compact = false,
}: {
  task: MineTask;
  busy: boolean;
  onOpen: (task: MineTask) => void;
  onReopen: (task: MineTask) => void;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3",
        compact &&
          "h-full rounded-2xl border border-border/50 bg-card/50 p-4",
      )}
    >
      <button
        type="button"
        className={cn(
          "flex w-full flex-col gap-2 rounded-xl text-left transition-colors hover:bg-muted/30",
          !compact && "-mx-1 px-1 py-1 sm:flex-row sm:items-start sm:justify-between",
        )}
        onClick={() => onOpen(task)}
      >
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <KindBadge kind={task.kind} />
            {task.work.rosTreatment ? (
              <span className="rounded-full bg-foreground px-2.5 py-0.5 text-xs font-semibold text-background">
                {task.work.rosTreatment.kindLabel}
              </span>
            ) : null}
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-medium",
                statusTone(task.myStatus),
              )}
            >
              {STATUS_LABEL[task.myStatus]}
            </span>
          </div>
          <p className="font-medium text-foreground">{task.title}</p>
          <p className="text-sm text-muted-foreground">{task.contextTitle}</p>
          {!compact && task.work.rosTreatment ? (
            <p className="text-sm text-foreground/90">
              {task.work.rosTreatment.kind === "accept"
                ? "Din jobb: registrer risikoaksept (begrunnelse + neste gjennomgang)."
                : task.work.rosTreatment.kind === "mitigate"
                  ? "Din jobb: gjennomfør tiltaket og bekreft her eller i ROS."
                  : task.work.rosTreatment.kind === "transfer"
                    ? "Din jobb: få overføringen på plass og bekreft."
                    : "Din jobb: stopp/endre aktiviteten og bekreft."}
            </p>
          ) : null}
          <p className="text-sm text-foreground/90">
            <span className="text-muted-foreground">Tildelt til </span>
            <span className="font-medium">{task.assigneeName}</span>
            <span className="text-muted-foreground"> · tildelt av </span>
            <span className="font-medium">{task.assignerName}</span>
          </p>
          {task.description ? (
            <p className="text-sm text-muted-foreground/90 line-clamp-2">
              {task.description}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-stretch gap-1 sm:items-end">
          {task.dueAt ? (
            <p className="text-xs text-muted-foreground">
              Frist {new Date(task.dueAt).toLocaleDateString("nb-NO")}
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground">P{task.priority}</p>
        </div>
      </button>

      <div className="flex flex-wrap gap-2">
        {task.myStatus === "done" ? (
          <>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => onReopen(task)}
              className="gap-1.5"
            >
              {task.work.rosTreatment?.kind === "accept"
                ? "Angre aksept"
                : "Angre utført"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => onOpen(task)}
            >
              Vis
            </Button>
          </>
        ) : (
          <>
            <Button
              size="sm"
              disabled={busy}
              onClick={() => onOpen(task)}
              className="gap-1.5"
            >
              {task.work.rosTreatment?.kind === "accept"
                ? "Åpne og registrer aksept"
                : task.work.rosTreatment
                  ? `Åpne og ${task.work.rosTreatment.kindLabel.toLowerCase()}`
                  : "Åpne oppgave"}
            </Button>
            <Link
              href={task.work.workHref}
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "gap-1.5",
              )}
              onClick={(e) => e.stopPropagation()}
            >
              {task.work.workLabel}
              <ArrowUpRight className="size-4" aria-hidden />
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

type AssignedTask = {
  kind: "assessment" | "ros" | "intake";
  taskId: string;
  title: string;
  description?: string;
  status: "open" | "done";
  priority: number;
  dueAt?: number;
  createdAt: number;
  href: string;
  contextTitle: string;
  assignees: Array<{
    userId: Id<"users">;
    name: string;
    status: MyStatus;
  }>;
};

function AssignedTasksView({
  tasks,
  viewMode,
}: {
  tasks: AssignedTask[];
  viewMode: ListViewMode;
}) {
  if (viewMode === "table") {
    return (
      <div className="overflow-x-auto rounded-2xl border border-border/60 bg-card/40">
        <table className="w-full min-w-[36rem] text-left text-sm">
          <thead className="border-b border-border/50 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Oppgave</th>
              <th className="px-3 py-3 font-medium">Type</th>
              <th className="px-3 py-3 font-medium">P</th>
              <th className="px-3 py-3 font-medium">Mottakere</th>
              <th className="px-4 py-3 font-medium">Åpne</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {tasks.map((task) => (
              <tr
                key={`${task.kind}-${task.taskId}`}
                className="hover:bg-muted/20"
              >
                <td className="px-4 py-3">
                  <Link
                    href={task.href}
                    className="font-medium text-foreground underline-offset-4 hover:underline"
                  >
                    {task.title}
                  </Link>
                  <p className="text-muted-foreground mt-0.5 line-clamp-1 text-xs">
                    {task.contextTitle}
                  </p>
                </td>
                <td className="px-3 py-3">
                  <KindBadge kind={task.kind} />
                </td>
                <td className="px-3 py-3 tabular-nums text-muted-foreground">
                  P{task.priority}
                </td>
                <td className="px-3 py-3">
                  <div className="flex flex-wrap gap-1">
                    {task.assignees.map((a) => (
                      <span
                        key={a.userId}
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[11px] font-medium",
                          statusTone(a.status),
                        )}
                      >
                        {a.name}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={task.href}
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" }),
                    )}
                  >
                    Åpne
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (viewMode === "cards") {
    return (
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {tasks.map((task) => (
          <li
            key={`${task.kind}-${task.taskId}`}
            className="rounded-2xl border border-border/50 bg-card/50 p-4"
          >
            <AssignedTaskBody task={task} />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul className="divide-y divide-border/60 rounded-2xl border border-border/60 bg-card/40">
      {tasks.map((task) => (
        <li key={`${task.kind}-${task.taskId}`} className="px-4 py-4 sm:px-5">
          <AssignedTaskBody task={task} />
        </li>
      ))}
    </ul>
  );
}

function AssignedTaskBody({ task }: { task: AssignedTask }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <KindBadge kind={task.kind} />
          <Link
            href={task.href}
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            {task.title}
          </Link>
        </div>
        <p className="text-sm text-muted-foreground">{task.contextTitle}</p>
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {task.assignees.map((a) => (
            <li
              key={a.userId}
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-medium",
                statusTone(a.status),
              )}
            >
              {a.name}: {STATUS_LABEL[a.status]}
            </li>
          ))}
        </ul>
      </div>
      <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end">
        {task.dueAt ? (
          <p className="text-xs text-muted-foreground">
            Frist {new Date(task.dueAt).toLocaleDateString("nb-NO")}
          </p>
        ) : null}
        <p className="text-xs text-muted-foreground">P{task.priority}</p>
      </div>
    </div>
  );
}

function KindBadge({ kind }: { kind: "assessment" | "ros" | "intake" }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground">
      {kind === "ros" ? (
        <Shield className="size-3" aria-hidden />
      ) : kind === "intake" ? (
        <FileText className="size-3" aria-hidden />
      ) : (
        <ClipboardList className="size-3" aria-hidden />
      )}
      {KIND_LABEL[kind]}
    </span>
  );
}
