"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import {
  PIPELINE_KANBAN_ORDER,
  PIPELINE_STATUS_LABELS,
  type PipelineStatus,
} from "@/lib/assessment-pipeline";
import { useMutation, useQuery } from "convex/react";
import {
  CalendarRange,
  ChevronDown,
  GitBranch,
  History,
  LayoutGrid,
  List,
  Plus,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";

type BoardRow = {
  assessment: Doc<"assessments">;
  priorityScore: number;
  effectivePriority: number;
  pipelineStatus: PipelineStatus;
  nextStepHint: string;
  readinessLabel: string;
  sprintName: string | null;
  versionCount: number;
  latestVersionNumber: number;
};

function PipelineCard({
  row,
  workspaceId,
  sprints,
  onStatusChange,
  onSprintChange,
}: {
  row: BoardRow;
  workspaceId: Id<"workspaces">;
  sprints: Doc<"sprints">[] | undefined;
  onStatusChange: (id: Id<"assessments">, status: PipelineStatus) => void;
  onSprintChange: (
    id: Id<"assessments">,
    sprintId: Id<"sprints"> | null,
  ) => void;
}) {
  const a = row.assessment;
  const hrefBase = `/w/${workspaceId}/a/${a._id}`;
  const hasVersions = row.versionCount > 0;

  return (
    <article
      className={cn(
        "group rounded-lg border bg-card p-3 shadow-sm transition-all",
        "hover:border-foreground/15 hover:shadow-md",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <Link
          href={hrefBase}
          className="min-w-0 flex-1 font-medium leading-snug text-foreground hover:underline"
        >
          {a.title}
        </Link>
        <span
          className="text-muted-foreground shrink-0 text-xs tabular-nums"
          title="Prioritet"
        >
          {row.effectivePriority.toFixed(1)}
        </span>
      </div>
      <p className="text-muted-foreground mt-1 line-clamp-2 text-xs leading-snug">
        {row.readinessLabel}
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {row.sprintName ? (
          <Badge variant="secondary" className="text-[0.65rem] font-normal">
            {row.sprintName}
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[0.65rem] font-normal">
            Ingen sprint
          </Badge>
        )}
        {a.manualPriorityOverride !== undefined ? (
          <Badge variant="outline" className="text-[0.65rem] font-normal">
            Manuell prio
          </Badge>
        ) : null}
        {hasVersions ? (
          <Badge variant="outline" className="gap-0.5 text-[0.65rem] font-normal">
            <GitBranch className="size-3 opacity-70" aria-hidden />
            v{row.latestVersionNumber}
          </Badge>
        ) : (
          <span className="text-muted-foreground text-[0.65rem]">Uten snapshot</span>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="min-w-0">
          <label className="sr-only" htmlFor={`st-${a._id}`}>
            Status
          </label>
          <select
            id={`st-${a._id}`}
            className="border-input bg-background h-8 w-full min-w-0 rounded-md border px-1.5 text-[0.75rem]"
            value={row.pipelineStatus}
            onChange={(e) =>
              onStatusChange(a._id, e.target.value as PipelineStatus)
            }
          >
            {PIPELINE_KANBAN_ORDER.map((s) => (
              <option key={s} value={s}>
                {PIPELINE_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-0">
          <label className="sr-only" htmlFor={`sp-${a._id}`}>
            Sprint
          </label>
          <select
            id={`sp-${a._id}`}
            className="border-input bg-background h-8 w-full min-w-0 rounded-md border px-1.5 text-[0.75rem]"
            value={a.sprintId ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              onSprintChange(
                a._id,
                v === "" ? null : (v as Id<"sprints">),
              );
            }}
          >
            <option value="">Sprint …</option>
            {sprints?.map((sp) => (
              <option key={sp._id} value={sp._id}>
                {sp.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-2 border-t border-border/60 pt-2">
        <Link
          href={`${hrefBase}#versjoner`}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs font-medium"
        >
          <History className="size-3.5" aria-hidden />
          Versjoner
          {hasVersions ? ` (${row.versionCount})` : ""}
        </Link>
        <Link
          href={hrefBase}
          className="text-muted-foreground hover:text-foreground ml-auto text-xs font-medium"
        >
          Åpne vurdering →
        </Link>
      </div>
    </article>
  );
}

export function LeveranseBoard({
  workspaceId,
}: {
  workspaceId: Id<"workspaces">;
}) {
  const [sprintFilter, setSprintFilter] = useState<"all" | Id<"sprints">>(
    "all",
  );
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const sprintDetailsRef = useRef<HTMLDetailsElement>(null);

  const sprints = useQuery(api.sprints.listByWorkspace, { workspaceId });
  const rows = useQuery(api.assessments.listPipelineBoard, {
    workspaceId,
    sprintFilter: sprintFilter === "all" ? "all" : sprintFilter,
  });

  const setStatus = useMutation(api.assessments.setPipelineStatus);
  const setManual = useMutation(api.assessments.setManualPriorityOverride);
  const setSprint = useMutation(api.assessments.setAssessmentSprint);
  const createSprint = useMutation(api.sprints.create);

  const [sprintName, setSprintName] = useState("");
  const [sprintStart, setSprintStart] = useState("");
  const [sprintEnd, setSprintEnd] = useState("");
  const [sprintGoal, setSprintGoal] = useState("");

  const byStatus = useMemo(() => {
    const m = new Map<PipelineStatus, BoardRow[]>();
    for (const s of PIPELINE_KANBAN_ORDER) {
      m.set(s, []);
    }
    if (!rows) {
      return m;
    }
    for (const row of rows) {
      const list = m.get(row.pipelineStatus) ?? [];
      list.push(row);
      m.set(row.pipelineStatus, list);
    }
    for (const s of PIPELINE_KANBAN_ORDER) {
      const list = m.get(s)!;
      list.sort((a, b) => {
        if (b.effectivePriority !== a.effectivePriority) {
          return b.effectivePriority - a.effectivePriority;
        }
        return (
          (b.assessment.kanbanRank ?? 0) - (a.assessment.kanbanRank ?? 0)
        );
      });
    }
    return m;
  }, [rows]);

  async function handleCreateSprint(e: React.FormEvent) {
    e.preventDefault();
    const name = sprintName.trim();
    if (!name || !sprintStart || !sprintEnd) {
      return;
    }
    const startAt = new Date(sprintStart).getTime();
    const endAt = new Date(sprintEnd).getTime();
    if (Number.isNaN(startAt) || Number.isNaN(endAt) || endAt < startAt) {
      return;
    }
    await createSprint({
      workspaceId,
      name,
      startAt,
      endAt,
      goal: sprintGoal.trim() || undefined,
    });
    setSprintName("");
    setSprintStart("");
    setSprintEnd("");
    setSprintGoal("");
    sprintDetailsRef.current?.removeAttribute("open");
  }

  return (
    <div className="space-y-6">
      {/* Planner-style toolbar */}
      <div className="bg-muted/30 flex flex-col gap-3 rounded-2xl border p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
          <Label htmlFor="sprint-filter" className="sr-only sm:not-sr-only">
            Sprint
          </Label>
          <select
            id="sprint-filter"
            className="border-input bg-background h-9 w-full max-w-md rounded-lg border px-3 text-sm shadow-xs sm:w-72"
            value={sprintFilter === "all" ? "all" : sprintFilter}
            onChange={(e) => {
              const v = e.target.value;
              setSprintFilter(v === "all" ? "all" : (v as Id<"sprints">));
            }}
          >
            <option value="all">Alle vurderinger</option>
            {sprints?.map((sp) => (
              <option key={sp._id} value={sp._id}>
                {sp.name}
              </option>
            ))}
          </select>
        </div>
        <div
          className="bg-background/80 inline-flex rounded-lg border p-0.5 shadow-sm"
          role="group"
          aria-label="Visning"
        >
          <Button
            type="button"
            variant={view === "kanban" ? "secondary" : "ghost"}
            size="sm"
            className="h-8 gap-1.5 rounded-md px-3"
            onClick={() => setView("kanban")}
          >
            <LayoutGrid className="size-4" aria-hidden />
            Tavle
          </Button>
          <Button
            type="button"
            variant={view === "list" ? "secondary" : "ghost"}
            size="sm"
            className="h-8 gap-1.5 rounded-md px-3"
            onClick={() => setView("list")}
          >
            <List className="size-4" aria-hidden />
            Liste
          </Button>
        </div>
      </div>

      {/* Collapsible sprint — ikke dominerende */}
      <details
        ref={sprintDetailsRef}
        className="group rounded-xl border bg-card shadow-sm"
      >
        <summary className="hover:bg-muted/40 flex cursor-pointer list-none items-center gap-3 rounded-xl px-4 py-3 transition-colors [&::-webkit-details-marker]:hidden">
          <div className="bg-primary/10 flex size-9 items-center justify-center rounded-lg">
            <CalendarRange className="text-primary size-4" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-heading text-sm font-semibold">Ny sprint</p>
            <p className="text-muted-foreground text-xs">
              Tidsboks for leveranse (valgfritt) — klikk for å utvide
            </p>
          </div>
          <ChevronDown className="text-muted-foreground size-4 shrink-0 transition group-open:rotate-180" />
        </summary>
        <form
          onSubmit={(e) => void handleCreateSprint(e)}
          className="border-t px-4 py-4"
        >
          <div className="mx-auto grid max-w-4xl gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="sprint-name" className="text-xs">
                Navn
              </Label>
              <Input
                id="sprint-name"
                value={sprintName}
                onChange={(e) => setSprintName(e.target.value)}
                placeholder="Sprint 12 – onboarding"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sprint-start" className="text-xs">
                Start
              </Label>
              <Input
                id="sprint-start"
                type="date"
                value={sprintStart}
                onChange={(e) => setSprintStart(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sprint-end" className="text-xs">
                Slutt
              </Label>
              <Input
                id="sprint-end"
                type="date"
                value={sprintEnd}
                onChange={(e) => setSprintEnd(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2 lg:col-span-4">
              <Label htmlFor="sprint-goal" className="text-xs">
                Mål (valgfritt)
              </Label>
              <Input
                id="sprint-goal"
                value={sprintGoal}
                onChange={(e) => setSprintGoal(e.target.value)}
                placeholder="F.eks. tre prosesser i produksjon"
                className="h-9"
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-4">
              <Button
                type="submit"
                size="sm"
                disabled={!sprintName.trim()}
                className="gap-1.5"
              >
                <Plus className="size-4" aria-hidden />
                Opprett sprint
              </Button>
            </div>
          </div>
        </form>
      </details>

      {rows === undefined ? (
        <div className="text-muted-foreground flex items-center gap-2 py-12 text-sm">
          <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          Henter tavle …
        </div>
      ) : rows.length === 0 ? (
        <div className="text-muted-foreground rounded-2xl border border-dashed py-12 text-center text-sm">
          Ingen vurderinger i dette filteret.{" "}
          <Link
            href={`/w/${workspaceId}/vurderinger`}
            className="text-foreground font-medium underline"
          >
            Opprett vurderinger
          </Link>
          , eller velg annen sprint.
        </div>
      ) : view === "list" ? (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li
              key={row.assessment._id}
              className="rounded-xl border bg-card p-4 shadow-sm"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 space-y-1">
                  <Link
                    href={`/w/${workspaceId}/a/${row.assessment._id}`}
                    className="font-heading text-base font-semibold hover:underline"
                  >
                    {row.assessment.title}
                  </Link>
                  <p className="text-muted-foreground text-sm">
                    {row.readinessLabel}
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Badge variant="secondary">
                      {row.effectivePriority.toFixed(1)} prio
                    </Badge>
                    <Badge variant="outline">
                      {row.sprintName ?? "Ingen sprint"}
                    </Badge>
                    {row.versionCount > 0 ? (
                      <Badge variant="outline" className="gap-1">
                        <GitBranch className="size-3" aria-hidden />
                        v{row.latestVersionNumber} ({row.versionCount}{" "}
                        {row.versionCount === 1 ? "versjon" : "versjoner"})
                      </Badge>
                    ) : null}
                  </div>
                </div>
                <div className="grid w-full gap-2 sm:grid-cols-3 lg:w-auto lg:min-w-[420px]">
                  <div className="space-y-1">
                    <Label className="text-xs">Status</Label>
                    <select
                      className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
                      value={row.pipelineStatus}
                      onChange={(e) =>
                        void setStatus({
                          assessmentId: row.assessment._id,
                          status: e.target.value as PipelineStatus,
                        })
                      }
                    >
                      {PIPELINE_KANBAN_ORDER.map((s) => (
                        <option key={s} value={s}>
                          {PIPELINE_STATUS_LABELS[s]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Manuell prioritet</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      className="h-9"
                      placeholder="0–100"
                      defaultValue={
                        row.assessment.manualPriorityOverride !== undefined
                          ? String(row.assessment.manualPriorityOverride)
                          : ""
                      }
                      onBlur={(e) => {
                        const raw = e.target.value.trim();
                        if (raw === "") {
                          void setManual({
                            assessmentId: row.assessment._id,
                            manualPriorityOverride: null,
                          });
                          return;
                        }
                        const n = Number(raw);
                        if (Number.isNaN(n)) return;
                        void setManual({
                          assessmentId: row.assessment._id,
                          manualPriorityOverride: n,
                        });
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Sprint</Label>
                    <select
                      className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
                      value={row.assessment.sprintId ?? ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        void setSprint({
                          assessmentId: row.assessment._id,
                          sprintId: v === "" ? null : (v as Id<"sprints">),
                        });
                      }}
                    >
                      <option value="">Ingen</option>
                      {sprints?.map((sp) => (
                        <option key={sp._id} value={sp._id}>
                          {sp.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-3 border-t pt-3">
                <Link
                  href={`/w/${workspaceId}/a/${row.assessment._id}#versjoner`}
                  className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-xs font-medium"
                >
                  <History className="size-3.5" aria-hidden />
                  Versjoner og gjenoppretting
                </Link>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="relative">
          <div className="flex gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5">
            {PIPELINE_KANBAN_ORDER.map((status) => {
              const list = byStatus.get(status) ?? [];
              return (
                <div
                  key={status}
                  className="flex w-[min(100vw-2rem,300px)] shrink-0 flex-col rounded-xl border bg-muted/30"
                >
                  <header className="border-b border-border/80 px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="truncate text-sm font-semibold">
                        {PIPELINE_STATUS_LABELS[status]}
                      </h3>
                      <span className="bg-background text-muted-foreground rounded-full px-2 py-0.5 text-xs tabular-nums">
                        {list.length}
                      </span>
                    </div>
                  </header>
                  <ul className="flex min-h-[200px] flex-col gap-2 p-2">
                    {list.map((row) => (
                      <li key={row.assessment._id}>
                        <PipelineCard
                          row={row}
                          workspaceId={workspaceId}
                          sprints={sprints}
                          onStatusChange={(id, status) =>
                            void setStatus({ assessmentId: id, status })
                          }
                          onSprintChange={(id, sprintId) =>
                            void setSprint({ assessmentId: id, sprintId })
                          }
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
