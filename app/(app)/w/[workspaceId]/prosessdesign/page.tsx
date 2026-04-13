"use client";

import {
  ProductEmptyState,
  ProductLoadingBlock,
} from "@/components/product";
import { buttonVariants } from "@/components/ui/button-variants";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { formatRelativeUpdatedAt } from "@/lib/assessment-ui-helpers";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import {
  ArrowUpRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileText,
  Search,
} from "lucide-react";
import { orgSubtreeIds, orgUnitSearchLabel } from "@/lib/org-unit-filter";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";

type SortMode = "updated_desc" | "updated_asc" | "title_asc" | "title_desc";
type PageSizeOption = 5 | 10 | 50;

function ProcessDesignHubBody() {
  const params = useParams();
  const searchParams = useSearchParams();
  const workspaceId = params.workspaceId as Id<"workspaces">;
  const wid = String(workspaceId);
  const assessments = useQuery(api.assessments.listByWorkspace, {
    workspaceId,
  });
  const orgUnits = useQuery(api.orgUnits.listByWorkspace, { workspaceId });

  const rawOrgUnit = searchParams.get("orgUnit") as Id<"orgUnits"> | null;

  const [q, setQ] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("updated_desc");
  const [pageSize, setPageSize] = useState<PageSizeOption>(10);
  const [page, setPage] = useState(1);
  const [orgUnitFilter, setOrgUnitFilter] = useState<"" | Id<"orgUnits">>(rawOrgUnit ?? "");

  const appliedRef = useRef(false);
  useEffect(() => {
    if (rawOrgUnit && !appliedRef.current) {
      appliedRef.current = true;
      setOrgUnitFilter(rawOrgUnit);
    }
  }, [rawOrgUnit]);

  const filtered = useMemo(() => {
    if (!assessments) return [];
    const units = orgUnits ?? [];
    const term = q.trim().toLowerCase();
    let list = assessments;
    if (orgUnitFilter) {
      const subtree = orgSubtreeIds(orgUnitFilter, units);
      list = list.filter((a) => a.orgUnitId ? subtree.has(a.orgUnitId) : false);
    }
    if (term) {
      list = list.filter((a) => a.title.toLowerCase().includes(term));
    }
    return [...list].sort((a, b) => {
      switch (sortMode) {
        case "updated_desc":
          return b.updatedAt - a.updatedAt;
        case "updated_asc":
          return a.updatedAt - b.updatedAt;
        case "title_asc":
          return a.title.localeCompare(b.title, "nb");
        case "title_desc":
          return b.title.localeCompare(a.title, "nb");
        default:
          return 0;
      }
    });
  }, [assessments, orgUnits, orgUnitFilter, q, sortMode]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.max(1, Math.min(page, totalPages));
  const pageStart = (safePage - 1) * pageSize;
  const paginated = filtered.slice(pageStart, pageStart + pageSize);

  if (assessments === undefined) {
    return (
      <ProductLoadingBlock
        label="Laster prosessdesign ..."
        className="min-h-[40vh]"
      />
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 pb-12 sm:px-6 lg:px-0">
      <header className="space-y-3">
        <div className="space-y-1.5">
          <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
            Prosessdesign
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            Prosessdesign (PDD) ligger på hver{" "}
            <span className="font-medium text-foreground">PVV-vurdering</span>, ikke på
            prosessregister-rader alene. Opprett eller åpne en vurdering under{" "}
            <Link href={`/w/${wid}/vurderinger`} className="font-medium text-foreground underline-offset-2 hover:underline">
              Vurderinger
            </Link>
            — en prosess du la inn under{" "}
            <Link
              href={`/w/${wid}/vurderinger?fane=prosesser`}
              className="font-medium text-foreground underline-offset-2 hover:underline"
            >
              Prosesser
            </Link>{" "}
            vises her først når den er koblet til en vurdering.
          </p>
        </div>
        {assessments.length > 0 && (
          <div className="inline-flex rounded-full border border-border/60 bg-muted/20 px-3 py-1 text-xs font-medium text-muted-foreground">
            {assessments.length}{" "}
            {assessments.length === 1 ? "dokument" : "dokumenter"}
          </div>
        )}
      </header>

      {assessments.length === 0 ? (
        <ProductEmptyState
          icon={FileText}
          title="Ingen vurderinger å åpne PDD for"
          description="PDD følger PVV-vurderinger. Har du opprettet en prosess under fanen Prosesser, må du også opprette eller koble den til en vurdering før den vises her."
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Link
                href={`/w/${wid}/vurderinger`}
                className={buttonVariants({ variant: "default", size: "sm" })}
              >
                Gå til vurderinger
              </Link>
              <Link
                href={`/w/${wid}/vurderinger?fane=prosesser`}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Til prosessregister
              </Link>
            </div>
          }
        />
      ) : (
        <>
          <div className="rounded-2xl border border-border/60 bg-card/40 p-2 shadow-sm backdrop-blur-sm">
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
                    setPage(1);
                  }}
                  placeholder="Søk etter PDD eller vurdering …"
                  autoComplete="off"
                  className={cn(
                    "h-10 w-full rounded-xl border border-border/60 bg-background/60 pl-9 pr-3 text-sm outline-none",
                    "transition-colors placeholder:text-muted-foreground/70",
                    "focus:border-foreground/25 focus:bg-background focus:ring-0",
                  )}
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {(orgUnits ?? []).length > 0 && (
                  <div className="relative shrink-0">
                    <select
                      aria-label="Filtrer på organisasjonsenhet"
                      value={orgUnitFilter}
                      onChange={(e) => {
                        setOrgUnitFilter(e.target.value as "" | Id<"orgUnits">);
                        setPage(1);
                      }}
                      className={cn(
                        "h-10 max-w-[14rem] cursor-pointer appearance-none truncate rounded-xl border border-border/60 bg-background/60 py-0 pl-3 pr-8 text-sm outline-none",
                        "transition-colors focus:border-foreground/25 focus:bg-background",
                      )}
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
                )}
                <div className="relative shrink-0">
                  <select
                    aria-label="Antall per side"
                    value={String(pageSize)}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value) as PageSizeOption);
                      setPage(1);
                    }}
                    className={cn(
                      "h-10 cursor-pointer appearance-none rounded-xl border border-border/60 bg-background/60 py-0 pl-3 pr-8 text-sm outline-none",
                      "transition-colors focus:border-foreground/25 focus:bg-background",
                    )}
                  >
                    <option value="5">5 per side</option>
                    <option value="10">10 per side</option>
                    <option value="50">50 per side</option>
                  </select>
                  <ChevronDown
                    className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                  />
                </div>
                <div className="relative shrink-0">
                  <select
                    aria-label="Sorter"
                    value={sortMode}
                    onChange={(e) => {
                      setSortMode(e.target.value as SortMode);
                      setPage(1);
                    }}
                    className={cn(
                      "h-10 cursor-pointer appearance-none rounded-xl border border-border/60 bg-background/60 py-0 pl-3 pr-8 text-sm outline-none",
                      "transition-colors focus:border-foreground/25 focus:bg-background",
                    )}
                  >
                    <option value="updated_desc">Nyeste</option>
                    <option value="updated_asc">Eldste</option>
                    <option value="title_asc">A → Å</option>
                    <option value="title_desc">Å → A</option>
                  </select>
                  <ChevronDown
                    className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                  />
                </div>
              </div>
            </div>
          </div>

          {/* List */}
          {paginated.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/60 bg-card/20 px-6 py-16 text-center">
              <p className="text-sm text-muted-foreground">
                Ingen treff for «{q.trim()}»
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {paginated.map((a) => (
                <Link
                  key={a._id}
                  href={`/w/${wid}/a/${a._id}/prosessdesign`}
                  className={cn(
                    "group flex items-center gap-4 rounded-2xl border border-border/60 bg-card/35 px-4 py-4 shadow-sm transition-all",
                    "hover:-translate-y-0.5 hover:border-border hover:bg-card/60 hover:shadow-md active:translate-y-0",
                    "focus-visible:relative focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-medium text-foreground">
                      {a.title}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatRelativeUpdatedAt(a.updatedAt)}
                    </p>
                  </div>
                  <ArrowUpRight
                    className="size-4 shrink-0 text-muted-foreground/50 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground"
                    aria-hidden
                  />
                </Link>
              ))}
            </div>
          )}

          {/* Pagination — only when needed */}
          {totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card/30 px-4 py-3 text-xs text-muted-foreground">
              <span className="tabular-nums">
                {pageStart + 1}–{Math.min(pageStart + pageSize, filtered.length)}{" "}
                av {filtered.length}
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
          )}
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
