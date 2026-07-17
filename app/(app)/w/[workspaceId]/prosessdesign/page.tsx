"use client";

import {
  ProductEmptyState,
  ProductLoadingBlock,
} from "@/components/product";
import { buttonVariants } from "@/components/ui/button-variants";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { formatRelativeUpdatedAt } from "@/lib/assessment-ui-helpers";
import { orgSubtreeIds, orgUnitSearchLabel } from "@/lib/org-unit-filter";
import { useStickyState } from "@/lib/use-sticky-state";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import {
  ArrowUpRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileText,
  LayoutGrid,
  List,
  Search,
  Table2,
} from "lucide-react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";

type ActivityFilter = "all" | "7d" | "30d";
type SortBy = "updated_desc" | "updated_asc" | "title_asc";
type ViewMode = "cards" | "list" | "table";
type PageSize = 6 | 10 | 20;

const PAGE_SIZES: PageSize[] = [6, 10, 20];

const selectClass = cn(
  "h-10 cursor-pointer appearance-none truncate rounded-lg border border-border/60 bg-background/60 py-0 pl-3 pr-8 text-sm outline-none",
  "transition-colors focus:border-foreground/25 focus:bg-background",
);

function ProcessDesignHubBody() {
  const params = useParams();
  const searchParams = useSearchParams();
  const workspaceId = params.workspaceId as Id<"workspaces">;
  const wid = String(workspaceId);
  const assessments = useQuery(api.assessments.listByWorkspace, {
    workspaceId,
  });
  const pddTitles = useQuery(api.processDesignDocs.listTitlesByWorkspace, {
    workspaceId,
  });
  const orgUnits = useQuery(api.orgUnits.listByWorkspace, { workspaceId });

  const processTitleByAssessmentId = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of pddTitles ?? []) {
      map.set(String(row.assessmentId), row.processTitle);
    }
    return map;
  }, [pddTitles]);

  const displayTitle = (assessmentId: string, assessmentTitle: string) =>
    processTitleByAssessmentId.get(assessmentId)?.trim() || assessmentTitle;

  const rawOrgUnit = searchParams.get("orgUnit") as Id<"orgUnits"> | null;

  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [orgUnitFilter, setOrgUnitFilter] = useState<"" | Id<"orgUnits">>(
    rawOrgUnit ?? "",
  );
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("all");
  const [sortBy, setSortBy] = useState<SortBy>("updated_desc");
  const [viewMode, setViewMode] = useStickyState<ViewMode>(
    `pdd-hub:${wid}:view`,
    "list",
  );
  const [pageSize, setPageSize] = useStickyState<PageSize>(
    `pdd-hub:${wid}:pageSize`,
    10,
  );

  const appliedRef = useRef(false);
  useEffect(() => {
    if (rawOrgUnit && !appliedRef.current) {
      appliedRef.current = true;
      setOrgUnitFilter(rawOrgUnit);
    }
  }, [rawOrgUnit]);

  const orgUnitNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of orgUnits ?? []) {
      map.set(String(u._id), u.name);
    }
    return map;
  }, [orgUnits]);

  const filtered = useMemo(() => {
    if (!assessments) return [];
    const units = orgUnits ?? [];
    const term = q.trim().toLowerCase();
    const now = Date.now();
    const freshnessCutoffMs =
      activityFilter === "7d"
        ? now - 7 * 24 * 60 * 60 * 1000
        : activityFilter === "30d"
          ? now - 30 * 24 * 60 * 60 * 1000
          : null;
    let list = assessments;
    if (orgUnitFilter) {
      const subtree = orgSubtreeIds(orgUnitFilter, units);
      list = list.filter((a) =>
        a.orgUnitId ? subtree.has(a.orgUnitId) : false,
      );
    }
    if (freshnessCutoffMs !== null) {
      list = list.filter((a) => a.updatedAt >= freshnessCutoffMs);
    }
    if (term) {
      list = list.filter((a) => {
        const orgName = a.orgUnitId
          ? (orgUnitNameById.get(String(a.orgUnitId))?.toLowerCase() ?? "")
          : "";
        const title = (
          processTitleByAssessmentId.get(String(a._id)) ?? a.title
        ).toLowerCase();
        return (
          title.includes(term) ||
          a.title.toLowerCase().includes(term) ||
          orgName.includes(term)
        );
      });
    }
    const sorted = [...list];
    if (sortBy === "title_asc") {
      sorted.sort((a, b) =>
        (
          processTitleByAssessmentId.get(String(a._id)) ?? a.title
        ).localeCompare(
          processTitleByAssessmentId.get(String(b._id)) ?? b.title,
          "nb",
        ),
      );
    } else if (sortBy === "updated_asc") {
      sorted.sort((a, b) => a.updatedAt - b.updatedAt);
    } else {
      sorted.sort((a, b) => b.updatedAt - a.updatedAt);
    }
    return sorted;
  }, [
    assessments,
    orgUnits,
    orgUnitFilter,
    q,
    activityFilter,
    sortBy,
    orgUnitNameById,
    processTitleByAssessmentId,
  ]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.max(1, Math.min(page, totalPages));
  const pageStart = (safePage - 1) * pageSize;
  const paginated = filtered.slice(pageStart, pageStart + pageSize);

  useEffect(() => {
    setPage(1);
  }, [q, orgUnitFilter, activityFilter, sortBy, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  if (assessments === undefined) {
    return (
      <ProductLoadingBlock
        label="Laster prosessdesign ..."
        className="min-h-[40vh]"
      />
    );
  }

  const hasOrgUnits = (orgUnits ?? []).length > 0;
  const activeFiltersCount =
    (q.trim() ? 1 : 0) +
    (orgUnitFilter ? 1 : 0) +
    (activityFilter !== "all" ? 1 : 0) +
    (sortBy !== "updated_desc" ? 1 : 0);
  const withOrgCount = assessments.filter((a) => Boolean(a.orgUnitId)).length;

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 pb-12 sm:px-6 lg:px-0">
      <header className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
          Prosessdesign
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Velg en vurdering for å åpne prosessdesign (PDD).
          {assessments.length === 0 ? (
            <>
              {" "}
              Opprett først under{" "}
              <Link
                href={`/w/${wid}/vurderinger`}
                className="font-medium text-foreground underline-offset-2 hover:underline"
              >
                Vurderinger
              </Link>
              .
            </>
          ) : null}
        </p>
      </header>

      {assessments.length === 0 ? (
        <ProductEmptyState
          icon={FileText}
          title="Ingen vurderinger ennå"
          description="Prosessdesign følger en vurdering. Opprett en vurdering først, så vises den her."
          action={
            <Link
              href={`/w/${wid}/vurderinger`}
              className={buttonVariants({ variant: "default", size: "sm" })}
            >
              Gå til vurderinger
            </Link>
          }
        />
      ) : (
        <>
          <dl className="flex flex-wrap gap-x-8 gap-y-2 border-y border-border/50 py-3 text-sm">
            <div className="flex items-baseline gap-2">
              <dt className="text-muted-foreground">Vurderinger</dt>
              <dd className="font-semibold tabular-nums text-foreground">
                {assessments.length}
              </dd>
            </div>
            <div className="flex items-baseline gap-2">
              <dt className="text-muted-foreground">Med enhet</dt>
              <dd className="font-semibold tabular-nums text-foreground">
                {withOrgCount}
              </dd>
            </div>
            <div className="flex items-baseline gap-2">
              <dt className="text-muted-foreground">Vises nå</dt>
              <dd className="font-semibold tabular-nums text-foreground">
                {filtered.length}
              </dd>
            </div>
          </dl>

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative min-w-0 flex-1">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <input
                  type="search"
                  value={q}
                  onChange={(e) => {
                    setQ(e.target.value);
                  }}
                  placeholder="Søk tittel eller enhet …"
                  autoComplete="off"
                  aria-label="Søk i vurderinger"
                  className={cn(
                    "h-10 w-full rounded-lg border border-border/60 bg-background/60 pl-9 pr-3 text-sm outline-none",
                    "transition-colors placeholder:text-muted-foreground/70",
                    "focus:border-foreground/25 focus:bg-background focus:ring-0",
                  )}
                />
              </div>
              {hasOrgUnits ? (
                <div className="relative shrink-0">
                  <select
                    aria-label="Filtrer på organisasjonsenhet"
                    value={orgUnitFilter}
                    onChange={(e) => {
                      setOrgUnitFilter(e.target.value as "" | Id<"orgUnits">);
                    }}
                    className={cn(selectClass, "max-w-[14rem]")}
                  >
                    <option value="">Alle enheter</option>
                    {(orgUnits ?? []).map((u) => (
                      <option key={u._id} value={u._id}>
                        {orgUnitSearchLabel(u._id, orgUnits ?? [])}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                  />
                </div>
              ) : null}
              <div className="relative shrink-0">
                <select
                  aria-label="Filtrer på aktivitet"
                  value={activityFilter}
                  onChange={(e) => {
                    setActivityFilter(e.target.value as ActivityFilter);
                  }}
                  className={cn(selectClass, "min-w-[9rem]")}
                >
                  <option value="all">All aktivitet</option>
                  <option value="7d">Siste 7 dager</option>
                  <option value="30d">Siste 30 dager</option>
                </select>
                <ChevronDown
                  className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
              </div>
              <div className="relative shrink-0">
                <select
                  aria-label="Sorter liste"
                  value={sortBy}
                  onChange={(e) => {
                    setSortBy(e.target.value as SortBy);
                  }}
                  className={cn(selectClass, "min-w-[9rem]")}
                >
                  <option value="updated_desc">Nyeste først</option>
                  <option value="updated_asc">Eldste først</option>
                  <option value="title_asc">Tittel A–Å</option>
                </select>
                <ChevronDown
                  className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              {activeFiltersCount > 0 ? (
                <div className="flex items-center gap-2">
                  <p className="text-xs text-muted-foreground">
                    {activeFiltersCount} aktiv
                    {activeFiltersCount === 1 ? "" : "e"} filter
                  </p>
                  <button
                    type="button"
                    className="rounded-lg border border-border/50 px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                    onClick={() => {
                      setQ("");
                      setOrgUnitFilter("");
                      setActivityFilter("all");
                      setSortBy("updated_desc");
                    }}
                  >
                    Nullstill filtre
                  </button>
                </div>
              ) : (
                <div />
              )}

              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="sr-only sm:not-sr-only">Visning</span>
                  <select
                    aria-label="Visningsmodus"
                    value={viewMode}
                    onChange={(e) => setViewMode(e.target.value as ViewMode)}
                    className={cn(selectClass, "min-w-[8.5rem]")}
                  >
                    <option value="cards">Kort</option>
                    <option value="list">Liste</option>
                    <option value="table">Tabell</option>
                  </select>
                </label>
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="sr-only sm:not-sr-only">Per side</span>
                  <select
                    aria-label="Antall per side"
                    value={pageSize}
                    onChange={(e) =>
                      setPageSize(Number(e.target.value) as PageSize)
                    }
                    className={cn(selectClass, "min-w-[5.5rem]")}
                  >
                    {PAGE_SIZES.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
                <div
                  className="hidden items-center gap-0.5 rounded-lg border border-border/50 bg-muted/30 p-1 sm:inline-flex"
                  role="group"
                  aria-label="Hurtigvisning"
                >
                  {(
                    [
                      { value: "cards" as const, label: "Kort", Icon: LayoutGrid },
                      { value: "list" as const, label: "Liste", Icon: List },
                      { value: "table" as const, label: "Tabell", Icon: Table2 },
                    ] as const
                  ).map(({ value, label, Icon }) => (
                    <button
                      key={value}
                      type="button"
                      title={label}
                      aria-label={label}
                      aria-pressed={viewMode === value}
                      className={cn(
                        "flex size-9 items-center justify-center rounded-md transition-colors",
                        viewMode === value
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                      onClick={() => setViewMode(value)}
                    >
                      <Icon className="size-4" aria-hidden />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {paginated.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/60 bg-card/20 px-6 py-14 text-center">
              <p className="text-sm text-muted-foreground">
                Ingen treff.{" "}
                <button
                  type="button"
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                  onClick={() => {
                    setQ("");
                    setOrgUnitFilter("");
                  }}
                >
                  Nullstill
                </button>
              </p>
            </div>
          ) : null}

          {paginated.length > 0 && viewMode === "cards" ? (
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {paginated.map((a) => {
                const orgName = a.orgUnitId
                  ? orgUnitNameById.get(String(a.orgUnitId))
                  : undefined;
                const title = displayTitle(String(a._id), a.title);
                return (
                  <li key={a._id} className="min-w-0">
                    <Link
                      href={`/w/${wid}/a/${a._id}/prosessdesign`}
                      className={cn(
                        "group flex h-full flex-col rounded-xl border border-border/50 bg-card p-4 transition-colors",
                        "hover:border-border hover:bg-muted/20",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-sm font-semibold text-foreground">
                          {title.trim().charAt(0).toUpperCase() || "P"}
                        </span>
                        <ArrowUpRight
                          className="size-4 text-muted-foreground/45 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground"
                          aria-hidden
                        />
                      </div>
                      <h2 className="mt-3 line-clamp-2 text-sm font-semibold tracking-tight text-foreground">
                        {title}
                      </h2>
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        {orgName ?? "Ikke satt"}
                      </p>
                      <p
                        className="mt-auto pt-4 text-xs tabular-nums text-muted-foreground"
                        title={new Date(a.updatedAt).toLocaleString("nb-NO")}
                      >
                        {formatRelativeUpdatedAt(a.updatedAt)}
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : null}

          {paginated.length > 0 && viewMode === "list" ? (
            <ul className="flex flex-col gap-2">
              {paginated.map((a) => {
                const orgName = a.orgUnitId
                  ? orgUnitNameById.get(String(a.orgUnitId))
                  : undefined;
                const title = displayTitle(String(a._id), a.title);
                return (
                  <li key={a._id}>
                    <Link
                      href={`/w/${wid}/a/${a._id}/prosessdesign`}
                      className={cn(
                        "group flex items-center gap-3 rounded-xl border border-border/50 bg-card px-4 py-3.5 transition-colors",
                        "hover:bg-muted/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      )}
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-semibold">
                        {title.trim().charAt(0).toUpperCase() || "P"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {title}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {orgName ?? "Ikke satt"} ·{" "}
                          {formatRelativeUpdatedAt(a.updatedAt)}
                        </p>
                      </div>
                      <ArrowUpRight
                        className="size-4 shrink-0 text-muted-foreground/45 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground"
                        aria-hidden
                      />
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : null}

          {paginated.length > 0 && viewMode === "table" ? (
            <div className="overflow-hidden rounded-xl border border-border/50 bg-card">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[28rem] text-left text-sm">
                  <thead className="border-b border-border/50 bg-muted/25 text-xs font-medium text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">Tittel</th>
                      <th className="px-4 py-2.5 font-medium">Enhet</th>
                      <th className="px-4 py-2.5 font-medium">Sist oppdatert</th>
                      <th className="px-4 py-2.5 text-right font-medium">
                        Åpne
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((a) => {
                      const orgName = a.orgUnitId
                        ? orgUnitNameById.get(String(a.orgUnitId))
                        : undefined;
                      const title = displayTitle(String(a._id), a.title);
                      return (
                        <tr
                          key={a._id}
                          className="border-b border-border/40 last:border-0 transition-colors hover:bg-muted/25"
                        >
                          <td className="px-4 py-3">
                            <Link
                              href={`/w/${wid}/a/${a._id}/prosessdesign`}
                              className="font-medium text-foreground hover:underline"
                            >
                              {title}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {orgName ?? "Ikke satt"}
                          </td>
                          <td
                            className="px-4 py-3 tabular-nums text-muted-foreground"
                            title={new Date(a.updatedAt).toLocaleString("nb-NO")}
                          >
                            {formatRelativeUpdatedAt(a.updatedAt)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Link
                              href={`/w/${wid}/a/${a._id}/prosessdesign`}
                              className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                              aria-label={`Åpne ${title}`}
                            >
                              <ArrowUpRight className="size-4" aria-hidden />
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {totalPages > 1 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-xs text-muted-foreground">
              <span className="tabular-nums">
                {pageStart + 1}–
                {Math.min(pageStart + pageSize, filtered.length)} av{" "}
                {filtered.length}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="inline-flex size-8 items-center justify-center rounded-lg border border-border/50 bg-background/60 transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
                  aria-label="Forrige side"
                >
                  <ChevronLeft className="size-3.5" />
                </button>
                <span className="min-w-[3.5rem] text-center tabular-nums">
                  {safePage} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="inline-flex size-8 items-center justify-center rounded-lg border border-border/50 bg-background/60 transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
                  aria-label="Neste side"
                >
                  <ChevronRight className="size-3.5" />
                </button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

export default function WorkspaceProcessDesignHubPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="size-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      }
    >
      <ProcessDesignHubBody />
    </Suspense>
  );
}
