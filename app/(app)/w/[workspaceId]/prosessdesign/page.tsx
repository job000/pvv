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
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";

type SortMode = "updated_desc" | "updated_asc" | "title_asc" | "title_desc";

export default function WorkspaceProcessDesignHubPage() {
  const params = useParams();
  const workspaceId = params.workspaceId as Id<"workspaces">;
  const wid = String(workspaceId);
  const assessments = useQuery(api.assessments.listByWorkspace, {
    workspaceId,
  });

  const [q, setQ] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("updated_desc");
  const pageSize = 10;
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    if (!assessments) return [];
    const term = q.trim().toLowerCase();
    let list = assessments;
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
  }, [assessments, q, sortMode]);

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
    <div className="mx-auto max-w-3xl space-y-6 px-4 pb-12 sm:px-6 lg:px-0">
      <header>
        <h1 className="font-heading text-xl font-semibold tracking-tight sm:text-2xl">
          Prosessdesign
        </h1>
        {assessments.length > 0 && (
          <p className="mt-1 text-sm text-muted-foreground">
            {assessments.length}{" "}
            {assessments.length === 1 ? "dokument" : "dokumenter"}
          </p>
        )}
      </header>

      {assessments.length === 0 ? (
        <ProductEmptyState
          icon={FileText}
          title="Ingen prosessdesign ennå"
          description="Opprett en vurdering for å komme i gang."
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
          {/* Toolbar — flat, inline */}
          <div className="flex items-center gap-2">
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
                placeholder="Søk …"
                autoComplete="off"
                className={cn(
                  "h-9 w-full rounded-lg border border-border/60 bg-transparent pl-9 pr-3 text-sm outline-none",
                  "transition-colors placeholder:text-muted-foreground/70",
                  "focus:border-foreground/25 focus:ring-0",
                )}
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
                  "h-9 cursor-pointer appearance-none rounded-lg border border-border/60 bg-transparent py-0 pl-3 pr-8 text-sm outline-none",
                  "transition-colors focus:border-foreground/25",
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

          {/* List */}
          {paginated.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">
              Ingen treff for «{q.trim()}»
            </p>
          ) : (
            <div className="divide-y divide-border/50 overflow-hidden rounded-xl border border-border/60">
              {paginated.map((a) => (
                <Link
                  key={a._id}
                  href={`/w/${wid}/a/${a._id}/prosessdesign`}
                  className={cn(
                    "group flex items-center gap-3 px-4 py-3.5 transition-colors",
                    "hover:bg-muted/50 active:bg-muted/70",
                    "focus-visible:relative focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground group-hover:text-foreground">
                      {a.title}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
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
            <div className="flex items-center justify-between pt-1 text-xs text-muted-foreground">
              <span className="tabular-nums">
                {pageStart + 1}–{Math.min(pageStart + pageSize, filtered.length)}{" "}
                av {filtered.length}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="inline-flex size-7 items-center justify-center rounded-md transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
                  aria-label="Forrige side"
                >
                  <ChevronLeft className="size-3.5" />
                </button>
                <span className="min-w-[3rem] text-center tabular-nums">
                  {safePage} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="inline-flex size-7 items-center justify-center rounded-md transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
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
