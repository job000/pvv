"use client";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { leveransePriorityTag } from "@/lib/leveranse-priority-band";
import { cn } from "@/lib/utils";
import {
  PIPELINE_KANBAN_ORDER,
  PIPELINE_STATUS_LABELS,
  type PipelineStatus,
} from "@/lib/assessment-pipeline";
import {
  COMPLIANCE_STATUS_LABELS,
  type ComplianceStatusKey,
} from "@/lib/helsesector-labels";
import { useMutation, useQuery } from "convex/react";
import {
  CalendarRange,
  ChevronDown,
  GitBranch,
  History,
  LayoutGrid,
  List,
  Plus,
  Search,
  Shield,
  UserCircle,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";

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
  ownerName: string | null;
};

function isLeveranseCardInteractiveTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      "a, button, select, input, textarea, label, [data-leveranse-card-interactive]",
    ),
  );
}

function PipelineCard({
  row,
  workspaceId,
  sprints,
  onStatusChange,
  onSprintChange,
  onOpenPreview,
  compact,
}: {
  row: BoardRow;
  workspaceId: Id<"workspaces">;
  sprints: Doc<"sprints">[] | undefined;
  onStatusChange: (id: Id<"assessments">, status: PipelineStatus) => void;
  onSprintChange: (
    id: Id<"assessments">,
    sprintId: Id<"sprints"> | null,
  ) => void;
  onOpenPreview: (row: BoardRow) => void;
  compact?: boolean;
}) {
  const a = row.assessment;
  const hrefBase = `/w/${workspaceId}/a/${a._id}`;
  const hasVersions = row.versionCount > 0;
  const prio = leveransePriorityTag(row.effectivePriority);
  const ros = (a.rosStatus ?? "not_started") as ComplianceStatusKey;

  return (
    <article
      className={cn(
        "group rounded-lg border bg-card shadow-sm transition-all",
        compact ? "p-2.5" : "p-3",
        "hover:border-foreground/15 hover:shadow-md",
        "cursor-pointer",
      )}
      onClick={(e) => {
        if (isLeveranseCardInteractiveTarget(e.target)) return;
        onOpenPreview(row);
      }}
      title="Klikk for forhåndsvisning (ikke lenker og redigerbare felt)"
    >
      <div className="flex items-start justify-between gap-2">
        <Link
          href={hrefBase}
          className="min-w-0 flex-1 font-medium leading-snug text-foreground hover:underline"
          data-leveranse-card-interactive
        >
          {a.title}
        </Link>
        <span
          className={cn(
            "shrink-0 rounded-md border px-1.5 py-0.5 text-[0.65rem] font-bold tabular-nums",
            prio.className,
          )}
          title="Leveranseprioritet (P1 = høyest)"
        >
          {prio.label}
        </span>
      </div>
      <p className="text-muted-foreground mt-1 line-clamp-2 text-xs leading-snug">
        {row.readinessLabel}
      </p>

      {row.ownerName ? (
        <p className="text-muted-foreground mt-1.5 flex items-center gap-1 text-[0.7rem]">
          <UserCircle className="size-3 shrink-0 opacity-70" aria-hidden />
          <span className="truncate">{row.ownerName}</span>
        </p>
      ) : null}

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Badge
          variant="outline"
          className="max-w-full gap-0.5 truncate border-dashed text-[0.65rem] font-normal"
          title="ROS-status (risiko og personvern)"
        >
          <Shield className="size-3 shrink-0 opacity-70" aria-hidden />
          {COMPLIANCE_STATUS_LABELS[ros]}
        </Badge>
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
          <span
            className="text-muted-foreground text-[0.65rem]"
            title="Skjemaet lagrer utkast automatisk. Milepæler settes i vurderingen."
          >
            Ingen milepæl
          </span>
        )}
        <span
          className="text-muted-foreground ml-auto text-[0.65rem] tabular-nums"
          title="Prioritet 0–100"
        >
          {row.effectivePriority.toFixed(1)}
        </span>
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
            data-leveranse-card-interactive
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
            data-leveranse-card-interactive
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
          data-leveranse-card-interactive
          title="Milepæler fra skjemaet (utkast lagres fortløpende)"
        >
          <History className="size-3.5" aria-hidden />
          Milepæler
          {hasVersions ? ` (${row.versionCount})` : ""}
        </Link>
        <Link
          href={hrefBase}
          className="text-muted-foreground hover:text-foreground ml-auto text-xs font-medium"
          data-leveranse-card-interactive
        >
          Åpne vurdering →
        </Link>
      </div>
    </article>
  );
}

function LeveransePreviewDialog({
  row,
  workspaceId,
  detail,
  open,
  onOpenChange,
}: {
  row: BoardRow | null;
  workspaceId: Id<"workspaces">;
  detail:
    | {
        assessment: Doc<"assessments">;
        ownerName: string | null;
        sprintName: string | null;
        processName: string | null;
        processDescriptionPreview: string | null;
        hasDraft: boolean;
        priorityScore: number;
        apPercent: number;
        criticality: number;
        easeLabel: string;
        feasible: boolean;
      }
    | undefined
    | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!row) return null;
  const a = row.assessment;
  const href = `/w/${workspaceId}/a/${a._id}`;
  const prio = leveransePriorityTag(row.effectivePriority);
  const ros = (a.rosStatus ?? "not_started") as ComplianceStatusKey;
  const pdd = (a.pddStatus ?? "not_started") as ComplianceStatusKey;
  const loadingDetail = open && detail === undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="2xl"
        titleId="lev-preview-title"
        descriptionId="lev-preview-desc"
        className="max-h-[min(92vh,48rem)]"
      >
        <DialogHeader className="relative pr-10">
          <div className="flex flex-wrap items-start gap-2">
            <h2
              id="lev-preview-title"
              className="font-heading min-w-0 flex-1 text-lg font-semibold leading-snug"
            >
              {a.title}
            </h2>
            <span
              className={cn(
                "shrink-0 rounded-md border px-1.5 py-0.5 text-[0.65rem] font-bold tabular-nums",
                prio.className,
              )}
            >
              {prio.label}
            </span>
          </div>
          <p id="lev-preview-desc" className="text-muted-foreground text-sm">
            {row.readinessLabel} · {PIPELINE_STATUS_LABELS[row.pipelineStatus]}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground absolute right-3 top-3 rounded-full"
            onClick={() => onOpenChange(false)}
            aria-label="Lukk"
          >
            <X className="size-4" />
          </Button>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="gap-0.5 text-xs font-normal">
              <Shield className="size-3 opacity-70" aria-hidden />
              ROS: {COMPLIANCE_STATUS_LABELS[ros]}
            </Badge>
            <Badge variant="outline" className="text-xs font-normal">
              PDD: {COMPLIANCE_STATUS_LABELS[pdd]}
            </Badge>
            {row.sprintName ? (
              <Badge variant="secondary" className="text-xs font-normal">
                {row.sprintName}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs font-normal">
                Ingen sprint
              </Badge>
            )}
            {row.ownerName ? (
              <Badge variant="outline" className="gap-0.5 text-xs font-normal">
                <UserCircle className="size-3 opacity-70" aria-hidden />
                {row.ownerName}
              </Badge>
            ) : null}
            {row.versionCount > 0 ? (
              <Badge variant="outline" className="gap-0.5 text-xs font-normal">
                <GitBranch className="size-3 opacity-70" aria-hidden />
                v{row.latestVersionNumber} ({row.versionCount}{" "}
                {row.versionCount === 1 ? "versjon" : "versjoner"})
              </Badge>
            ) : null}
          </div>

          <div className="bg-muted/25 grid gap-2 rounded-xl border px-3 py-2.5 text-sm sm:grid-cols-2">
            <div>
              <p className="text-muted-foreground text-xs">Porteføljeprioritet</p>
              <p className="font-medium tabular-nums">
                {row.effectivePriority.toFixed(1)}{" "}
                <span className="text-muted-foreground text-xs font-normal">
                  (modell {row.priorityScore.toFixed(1)})
                </span>
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Neste steg</p>
              <p className="text-sm leading-snug">{row.nextStepHint}</p>
            </div>
          </div>

          {loadingDetail ? (
            <div className="text-muted-foreground flex items-center gap-2 text-sm">
              <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Henter prosessdetaljer …
            </div>
          ) : detail ? (
            <>
              {!detail.hasDraft ? (
                <p className="text-muted-foreground text-xs leading-relaxed">
                  Ingen lagret utkast — tall under er fra cache eller standard
                  tom modell til utkast opprettes.
                </p>
              ) : null}
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border bg-card px-3 py-2">
                  <p className="text-muted-foreground text-xs">AP</p>
                  <p className="font-semibold tabular-nums">
                    {detail.apPercent.toFixed(1)}%
                  </p>
                </div>
                <div className="rounded-lg border bg-card px-3 py-2">
                  <p className="text-muted-foreground text-xs">Kritikalitet</p>
                  <p className="font-semibold tabular-nums">
                    {detail.criticality.toFixed(1)}%
                  </p>
                </div>
                <div className="rounded-lg border bg-card px-3 py-2">
                  <p className="text-muted-foreground text-xs">Lettgrad</p>
                  <p className="text-sm font-medium">{detail.easeLabel}</p>
                </div>
                <div className="rounded-lg border bg-card px-3 py-2">
                  <p className="text-muted-foreground text-xs">Gjennomførbar</p>
                  <p className="text-sm font-medium">
                    {detail.feasible ? "Ja" : "Nei"}
                  </p>
                </div>
              </div>
              {detail.processName ? (
                <div>
                  <p className="text-muted-foreground mb-1 text-xs font-medium">
                    Prosessnavn
                  </p>
                  <p className="text-sm leading-relaxed">{detail.processName}</p>
                </div>
              ) : null}
              {detail.processDescriptionPreview ? (
                <div>
                  <p className="text-muted-foreground mb-1 text-xs font-medium">
                    Kontekst / omfang
                  </p>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {detail.processDescriptionPreview}
                  </p>
                </div>
              ) : null}
            </>
          ) : null}

          {a.rosNotes ? (
            <div>
              <p className="text-muted-foreground mb-1 text-xs font-medium">
                ROS-notat
              </p>
              <p className="text-sm leading-relaxed whitespace-pre-wrap line-clamp-6">
                {a.rosNotes}
              </p>
            </div>
          ) : null}
        </DialogBody>
        <DialogFooter className="flex-wrap justify-between gap-2 sm:justify-end">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Lukk
          </Button>
          <Link
            href={`${href}#versjoner`}
            className={buttonVariants({ variant: "outline" })}
            title="Åpner vurderingen på milepæler (utkast lagres fortløpende)"
          >
            Milepæler i skjema
          </Link>
          <Link href={href} className={buttonVariants()}>
            Åpne full vurdering
          </Link>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type RosFilter = "all" | ComplianceStatusKey;

export function LeveranseBoard({
  workspaceId,
}: {
  workspaceId: Id<"workspaces">;
}) {
  const prefs = useQuery(api.leveransePrefs.getForWorkspace, { workspaceId });
  const savePrefs = useMutation(api.leveransePrefs.upsert);

  const [sprintFilter, setSprintFilter] = useState<"all" | Id<"sprints">>(
    "all",
  );
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [density, setDensity] = useState<"comfortable" | "compact">(
    "comfortable",
  );
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [rosFilter, setRosFilter] = useState<RosFilter>("all");
  const prefsHydrated = useRef(false);
  const [previewRow, setPreviewRow] = useState<BoardRow | null>(null);

  const sprintDetailsRef = useRef<HTMLDetailsElement>(null);

  const previewDetail = useQuery(
    api.assessments.getPipelinePreview,
    previewRow ? { assessmentId: previewRow.assessment._id } : "skip",
  );

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput.trim()), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    if (prefs === undefined) return;
    if (prefsHydrated.current) return;
    prefsHydrated.current = true;
    if (prefs === null) return;
    setView(prefs.viewMode);
    setSprintFilter(
      prefs.sprintFilter === "all" ? "all" : prefs.sprintFilter,
    );
    if (prefs.density) setDensity(prefs.density);
  }, [prefs]);

  function persistPrefs(next: {
    viewMode?: "kanban" | "list";
    sprintFilter?: "all" | Id<"sprints">;
    density?: "comfortable" | "compact";
  }) {
    const vm = next.viewMode ?? view;
    const sf = next.sprintFilter ?? sprintFilter;
    const den = next.density ?? density;
    void savePrefs({
      workspaceId,
      viewMode: vm,
      sprintFilter: sf === "all" ? "all" : sf,
      density: den,
    });
  }

  const sprints = useQuery(api.sprints.listByWorkspace, { workspaceId });
  const rows = useQuery(api.assessments.listPipelineBoard, {
    workspaceId,
    sprintFilter: sprintFilter === "all" ? "all" : sprintFilter,
    titleSearch: debouncedSearch || undefined,
  });

  const setStatus = useMutation(api.assessments.setPipelineStatus);
  const setManual = useMutation(api.assessments.setManualPriorityOverride);
  const setSprint = useMutation(api.assessments.setAssessmentSprint);
  const createSprint = useMutation(api.sprints.create);

  const [sprintName, setSprintName] = useState("");
  const [sprintStart, setSprintStart] = useState("");
  const [sprintEnd, setSprintEnd] = useState("");
  const [sprintGoal, setSprintGoal] = useState("");

  const filteredRows = useMemo(() => {
    if (!rows) return undefined;
    if (rosFilter === "all") return rows;
    return rows.filter((row) => {
      const r = (row.assessment.rosStatus ?? "not_started") as ComplianceStatusKey;
      return r === rosFilter;
    });
  }, [rows, rosFilter]);

  const byStatus = useMemo(() => {
    const m = new Map<PipelineStatus, BoardRow[]>();
    for (const s of PIPELINE_KANBAN_ORDER) {
      m.set(s, []);
    }
    if (!filteredRows) {
      return m;
    }
    for (const row of filteredRows) {
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
  }, [filteredRows]);

  const compact = density === "compact";

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
      <p className="text-muted-foreground text-xs leading-relaxed">
        Visning og sprintfilter lagres for <strong className="text-foreground">din bruker</strong> i
        dette arbeidsområdet — ikke for alle. Søk går mot server (egnet for store
        porteføljer). ROS-filter er lokalt på lastede rader.{" "}
        <span className="text-foreground/90">
          Klikk på et kort (utenom lenker og felt) for forhåndsvisning.
        </span>
      </p>

      {/* Planner-style toolbar */}
      <div className="bg-muted/30 flex flex-col gap-3 rounded-2xl border p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between lg:gap-4">
          <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="sprint-filter" className="text-xs">
                Sprint
              </Label>
              <select
                id="sprint-filter"
                className="border-input bg-background h-9 w-full rounded-lg border px-3 text-sm shadow-xs"
                value={sprintFilter === "all" ? "all" : sprintFilter}
                onChange={(e) => {
                  const v = e.target.value;
                  const next =
                    v === "all" ? "all" : (v as Id<"sprints">);
                  setSprintFilter(next);
                  persistPrefs({ sprintFilter: next });
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
            <div className="space-y-1.5">
              <Label htmlFor="ros-filter" className="text-xs">
                ROS / personvern
              </Label>
              <select
                id="ros-filter"
                className="border-input bg-background h-9 w-full rounded-lg border px-3 text-sm shadow-xs"
                value={rosFilter}
                onChange={(e) =>
                  setRosFilter(e.target.value as RosFilter)
                }
              >
                <option value="all">Alle</option>
                {(
                  [
                    "not_started",
                    "in_progress",
                    "completed",
                    "not_applicable",
                  ] as const
                ).map((k) => (
                  <option key={k} value={k}>
                    {COMPLIANCE_STATUS_LABELS[k]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
              <Label htmlFor="board-search" className="text-xs">
                Søk i tittel
              </Label>
              <div className="relative">
                <Search className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2" />
                <Input
                  id="board-search"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Filtrer vurderinger …"
                  className="h-9 pl-9"
                  aria-describedby="board-search-hint"
                />
              </div>
              <p id="board-search-hint" className="sr-only">
                Søket oppdateres etter kort pause og filtrerer på server.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
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
                onClick={() => {
                  setView("kanban");
                  persistPrefs({ viewMode: "kanban" });
                }}
              >
                <LayoutGrid className="size-4" aria-hidden />
                Tavle
              </Button>
              <Button
                type="button"
                variant={view === "list" ? "secondary" : "ghost"}
                size="sm"
                className="h-8 gap-1.5 rounded-md px-3"
                onClick={() => {
                  setView("list");
                  persistPrefs({ viewMode: "list" });
                }}
              >
                <List className="size-4" aria-hidden />
                Liste
              </Button>
            </div>
            <div
              className="bg-background/80 inline-flex rounded-lg border p-0.5 shadow-sm"
              role="group"
              aria-label="Tetthet"
            >
              <Button
                type="button"
                variant={density === "comfortable" ? "secondary" : "ghost"}
                size="sm"
                className="h-8 rounded-md px-2.5 text-xs"
                onClick={() => {
                  setDensity("comfortable");
                  persistPrefs({ density: "comfortable" });
                }}
              >
                Luftig
              </Button>
              <Button
                type="button"
                variant={density === "compact" ? "secondary" : "ghost"}
                size="sm"
                className="h-8 rounded-md px-2.5 text-xs"
                onClick={() => {
                  setDensity("compact");
                  persistPrefs({ density: "compact" });
                }}
              >
                Kompakt
              </Button>
            </div>
          </div>
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
      ) : filteredRows && filteredRows.length === 0 ? (
        <div className="text-muted-foreground rounded-2xl border border-dashed py-12 text-center text-sm">
          Ingen treff med valgt ROS-filter. Velg «Alle» under ROS/personvern, eller
          bred opp sprint/søk.
        </div>
      ) : view === "list" ? (
        <ul className={cn("space-y-2", compact && "space-y-1.5")}>
          {filteredRows!.map((row) => {
            const prio = leveransePriorityTag(row.effectivePriority);
            const ros = (row.assessment.rosStatus ??
              "not_started") as ComplianceStatusKey;
            return (
            <li
              key={row.assessment._id}
              className={cn(
                "cursor-pointer rounded-xl border bg-card shadow-sm transition-colors hover:border-foreground/15",
                compact ? "p-3" : "p-4",
              )}
              title="Klikk for forhåndsvisning (ikke lenker og redigerbare felt)"
              onClick={(e) => {
                if (isLeveranseCardInteractiveTarget(e.target)) return;
                setPreviewRow(row);
              }}
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/w/${workspaceId}/a/${row.assessment._id}`}
                      className="font-heading text-base font-semibold hover:underline"
                      data-leveranse-card-interactive
                    >
                      {row.assessment.title}
                    </Link>
                    <span
                      className={cn(
                        "rounded-md border px-1.5 py-0.5 text-[0.65rem] font-bold tabular-nums",
                        prio.className,
                      )}
                    >
                      {prio.label}
                    </span>
                  </div>
                  <p className="text-muted-foreground text-sm">
                    {row.readinessLabel}
                  </p>
                  {row.ownerName ? (
                    <p className="text-muted-foreground flex items-center gap-1 text-xs">
                      <UserCircle className="size-3.5 shrink-0" />
                      {row.ownerName}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Badge variant="outline" className="text-[0.65rem] font-normal">
                      <Shield className="mr-0.5 size-3" aria-hidden />
                      {COMPLIANCE_STATUS_LABELS[ros]}
                    </Badge>
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
                      data-leveranse-card-interactive
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
                      data-leveranse-card-interactive
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
                      data-leveranse-card-interactive
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
                  data-leveranse-card-interactive
                  title="Milepæler fra skjemaet (utkast lagres fortløpende)"
                >
                  <History className="size-3.5" aria-hidden />
                  Milepæler og gjenoppretting
                </Link>
              </div>
            </li>
            );
          })}
        </ul>
      ) : (
        <div className="relative">
          <div className="flex gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5">
            {PIPELINE_KANBAN_ORDER.map((status) => {
              const list = byStatus.get(status) ?? [];
              return (
                <div
                  key={status}
                  className="flex w-[min(100vw-2rem,320px)] max-h-[min(78vh,920px)] shrink-0 flex-col rounded-xl border bg-muted/30"
                >
                  <header className="border-b border-border/80 shrink-0 px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="truncate text-sm font-semibold">
                        {PIPELINE_STATUS_LABELS[status]}
                      </h3>
                      <span className="bg-background text-muted-foreground rounded-full px-2 py-0.5 text-xs tabular-nums">
                        {list.length}
                      </span>
                    </div>
                  </header>
                  <ul
                    className={cn(
                      "flex min-h-[120px] flex-col gap-2 overflow-y-auto p-2 [scrollbar-width:thin]",
                      compact && "gap-1.5",
                    )}
                  >
                    {list.map((row) => (
                      <li key={row.assessment._id}>
                        <PipelineCard
                          row={row}
                          workspaceId={workspaceId}
                          sprints={sprints}
                          compact={compact}
                          onOpenPreview={(r) => setPreviewRow(r)}
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

      <LeveransePreviewDialog
        row={previewRow}
        workspaceId={workspaceId}
        detail={previewDetail}
        open={previewRow !== null}
        onOpenChange={(o) => {
          if (!o) setPreviewRow(null);
        }}
      />
    </div>
  );
}
