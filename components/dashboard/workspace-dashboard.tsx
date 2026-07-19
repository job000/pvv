"use client";

import { ListViewModeToggle } from "@/components/ui/list-view-mode-toggle";
import { WorkspaceDeleteDialog } from "@/components/workspace/workspace-delete-dialog";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import type { ListViewMode } from "@/lib/list-view-mode";
import { useStickyState } from "@/lib/use-sticky-state";
import { cn } from "@/lib/utils";
import { useMutation } from "convex/react";
import {
  ArrowRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  SlidersHorizontal,
  Star,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const ROLE_LABELS: Record<string, string> = {
  owner: "Eier",
  admin: "Admin",
  member: "Medlem",
  viewer: "Visning",
};

const PAGE_SIZES = [5, 10, 20, 50] as const;
type PageSize = (typeof PAGE_SIZES)[number];

const AVATAR_TONES = [
  "bg-sky-500/15 text-sky-800 dark:text-sky-200",
  "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200",
  "bg-amber-500/15 text-amber-900 dark:text-amber-200",
  "bg-violet-500/15 text-violet-800 dark:text-violet-200",
  "bg-rose-500/15 text-rose-800 dark:text-rose-200",
  "bg-teal-500/15 text-teal-800 dark:text-teal-200",
] as const;

function avatarTone(name: string): string {
  let n = 0;
  for (let i = 0; i < name.length; i++) n += name.charCodeAt(i) * (i + 3);
  return AVATAR_TONES[n % AVATAR_TONES.length]!;
}

type WorkspaceRow = {
  workspace: Doc<"workspaces">;
  role: "owner" | "admin" | "member" | "viewer";
};

const fieldClass =
  "h-11 w-full rounded-xl border border-border/50 bg-background px-3.5 text-sm text-foreground outline-none transition-shadow focus:ring-2 focus:ring-foreground/12";

function WorkspaceRowMenu({
  workspace,
  role,
  isDefault,
  open,
  onOpenChange,
  onSetDefault,
  onDelete,
}: {
  workspace: Doc<"workspaces">;
  role: WorkspaceRow["role"];
  isDefault: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSetDefault: () => void;
  onDelete: () => void;
}) {
  const canManage = role === "owner" || role === "admin";
  const isOwner = role === "owner";
  if (!canManage) return null;

  return (
    <div className="relative">
      <button
        type="button"
        className="text-muted-foreground hover:bg-muted hover:text-foreground flex size-10 items-center justify-center rounded-xl transition-colors"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onOpenChange(!open);
        }}
        aria-label="Flere valg"
        aria-expanded={open}
      >
        <MoreHorizontal className="size-4" aria-hidden />
      </button>
      {open ? (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => onOpenChange(false)}
          />
          <div className="bg-card absolute top-full right-0 z-50 mt-1 w-52 rounded-2xl p-1.5 shadow-xl ring-1 ring-black/[0.08] dark:ring-white/[0.12]">
            <button
              type="button"
              className="hover:bg-muted/70 flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-foreground transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                onSetDefault();
                onOpenChange(false);
              }}
            >
              <Star className="size-4 opacity-60" aria-hidden />
              {isDefault ? "Fjern som standard" : "Sett som standard"}
            </button>
            <Link
              href={`/w/${workspace._id}/innstillinger`}
              className="hover:bg-muted/70 flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-foreground transition-colors"
              onClick={() => onOpenChange(false)}
            >
              <Settings className="size-4 opacity-60" aria-hidden />
              Innstillinger
            </Link>
            {isOwner ? (
              <>
                <div className="bg-border/40 mx-2 my-1 h-px" />
                <button
                  type="button"
                  className="text-destructive hover:bg-destructive/10 flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                    onOpenChange(false);
                  }}
                >
                  <Trash2 className="size-4 opacity-60" aria-hidden />
                  Slett
                </button>
              </>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}

export function WorkspaceDashboardGrid({
  workspaces,
  defaultWorkspaceId,
}: {
  workspaces: WorkspaceRow[];
  defaultWorkspaceId: Id<"workspaces"> | null;
}) {
  const router = useRouter();
  const createWorkspace = useMutation(api.workspaces.create);
  const setDefaultWorkspace = useMutation(api.workspaces.setDefaultWorkspace);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Doc<"workspaces"> | null>(
    null,
  );
  const [menuOpenId, setMenuOpenId] = useState<Id<"workspaces"> | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [roleFilter, setRoleFilter] = useState<
    "all" | "owner" | "admin" | "member" | "viewer"
  >("all");
  const [sortBy, setSortBy] = useState<"name_asc" | "name_desc" | "recent">(
    "name_asc",
  );
  const [viewMode, setViewMode] = useStickyState<ListViewMode>(
    "dashboard-ws-view",
    "cards",
  );
  const [pageSizeRaw, setPageSize] = useStickyState<number>(
    "dashboard-ws-page-size",
    10,
  );
  const pageSize: PageSize = (
    PAGE_SIZES as readonly number[]
  ).includes(pageSizeRaw)
    ? (pageSizeRaw as PageSize)
    : 10;
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (pageSizeRaw !== pageSize) setPageSize(pageSize);
  }, [pageSize, pageSizeRaw, setPageSize]);

  const filtersActive = roleFilter !== "all" || sortBy !== "name_asc";

  const visibleWorkspaces = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let rows = workspaces.filter(({ workspace, role }) => {
      if (roleFilter !== "all" && role !== roleFilter) return false;
      if (!q) return true;
      return workspace.name.toLowerCase().includes(q);
    });

    rows = [...rows].sort((a, b) => {
      if (sortBy === "recent") {
        return b.workspace._creationTime - a.workspace._creationTime;
      }
      const cmp = a.workspace.name.localeCompare(b.workspace.name, "nb");
      return sortBy === "name_desc" ? -cmp : cmp;
    });

    return rows;
  }, [workspaces, searchQuery, roleFilter, sortBy]);

  const totalPages = Math.max(1, Math.ceil(visibleWorkspaces.length / pageSize));
  const safePage = Math.min(page, totalPages);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, roleFilter, sortBy, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pageItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return visibleWorkspaces.slice(start, start + pageSize);
  }, [visibleWorkspaces, safePage, pageSize]);

  const rangeStart =
    visibleWorkspaces.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const rangeEnd = Math.min(safePage * pageSize, visibleWorkspaces.length);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setCreating(true);
    setError(null);
    try {
      const id = await createWorkspace({ name: trimmed });
      setName("");
      setCreateOpen(false);
      router.push(`/w/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke opprette");
    } finally {
      setCreating(false);
    }
  }

  function renderMenu(row: WorkspaceRow) {
    const { workspace, role } = row;
    const isDefault = defaultWorkspaceId === workspace._id;
    return (
      <WorkspaceRowMenu
        workspace={workspace}
        role={role}
        isDefault={isDefault}
        open={menuOpenId === workspace._id}
        onOpenChange={(open) => setMenuOpenId(open ? workspace._id : null)}
        onSetDefault={() => {
          void setDefaultWorkspace({
            workspaceId: isDefault
              ? null
              : (workspace._id as Id<"workspaces">),
          });
        }}
        onDelete={() => setDeleteTarget(workspace)}
      />
    );
  }

  return (
    <>
      <section className="min-w-0 space-y-4 overflow-x-clip sm:space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
          <div className="min-w-0 space-y-1">
            <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
              Arbeidsområder
            </h2>
            <p className="text-muted-foreground text-sm sm:text-[15px]">
              Åpne et område for å jobbe videre.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCreateOpen((v) => !v)}
            className="bg-foreground text-background inline-flex h-11 w-full shrink-0 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold transition-opacity hover:opacity-90 touch-manipulation sm:w-auto"
          >
            <Plus className="size-4" aria-hidden />
            Nytt område
          </button>
        </div>

        {createOpen ? (
          <form
            onSubmit={(e) => void onCreate(e)}
            className="bg-muted/20 flex flex-col gap-4 rounded-2xl border border-border/50 p-4 sm:flex-row sm:items-end sm:p-5"
          >
            <label className="min-w-0 flex-1 space-y-2">
              <span className="text-muted-foreground text-sm font-medium">
                Navn
              </span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="F.eks. Klinikk, prosjekt eller avdeling"
                autoFocus
                className={fieldClass}
              />
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setCreateOpen(false);
                  setError(null);
                }}
                className="text-muted-foreground hover:text-foreground h-11 rounded-xl px-4 text-sm font-medium transition-colors"
              >
                Avbryt
              </button>
              <button
                type="submit"
                disabled={creating || !name.trim()}
                className="bg-foreground text-background h-11 rounded-xl px-6 text-sm font-semibold transition-opacity disabled:opacity-40"
              >
                {creating ? "Oppretter…" : "Opprett"}
              </button>
            </div>
            {error ? (
              <p className="text-destructive w-full text-sm" role="alert">
                {error}
              </p>
            ) : null}
          </form>
        ) : null}

        {workspaces.length > 0 ? (
          <div className="space-y-3">
            <div className="flex min-w-0 flex-col gap-3">
              <label className="relative min-w-0 w-full">
                <Search
                  className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2"
                  aria-hidden
                />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Søk etter arbeidsområde…"
                  className={cn(fieldClass, "pl-11")}
                />
              </label>
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFiltersOpen((v) => !v)}
                  className={cn(
                    "inline-flex h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl border px-3.5 text-sm font-medium transition-colors touch-manipulation sm:flex-none",
                    filtersOpen || filtersActive
                      ? "border-foreground/20 bg-muted text-foreground"
                      : "border-border/50 bg-background text-muted-foreground hover:text-foreground",
                  )}
                  aria-expanded={filtersOpen}
                >
                  <SlidersHorizontal className="size-4" aria-hidden />
                  Filter
                  {filtersActive ? (
                    <span className="bg-foreground text-background rounded-full px-1.5 py-0.5 text-[10px] font-semibold">
                      På
                    </span>
                  ) : null}
                </button>
                <ListViewModeToggle
                  value={viewMode}
                  onChange={setViewMode}
                  showSelect={false}
                  showIcons
                />
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
              <div className="bg-muted/15 grid gap-3 rounded-2xl border border-border/40 p-3 sm:grid-cols-2 sm:p-4">
                <label className="space-y-1.5">
                  <span className="text-muted-foreground text-xs font-medium">
                    Rolle
                  </span>
                  <select
                    aria-label="Filtrer på rolle"
                    value={roleFilter}
                    onChange={(e) =>
                      setRoleFilter(
                        e.target.value as
                          | "all"
                          | "owner"
                          | "admin"
                          | "member"
                          | "viewer",
                      )
                    }
                    className={fieldClass}
                  >
                    <option value="all">Alle roller</option>
                    <option value="owner">Eier</option>
                    <option value="admin">Admin</option>
                    <option value="member">Medlem</option>
                    <option value="viewer">Visning</option>
                  </select>
                </label>
                <label className="space-y-1.5">
                  <span className="text-muted-foreground text-xs font-medium">
                    Sortering
                  </span>
                  <select
                    aria-label="Sorter arbeidsområder"
                    value={sortBy}
                    onChange={(e) =>
                      setSortBy(
                        e.target.value as "name_asc" | "name_desc" | "recent",
                      )
                    }
                    className={fieldClass}
                  >
                    <option value="name_asc">Navn A–Å</option>
                    <option value="name_desc">Navn Å–A</option>
                    <option value="recent">Nyeste først</option>
                  </select>
                </label>
              </div>
            ) : null}
          </div>
        ) : null}

        {visibleWorkspaces.length === 0 && workspaces.length > 0 ? (
          <p
            className="text-muted-foreground py-10 text-center text-sm"
            role="status"
          >
            Ingen treff.{" "}
            <button
              type="button"
              className="text-foreground font-medium underline-offset-2 hover:underline"
              onClick={() => {
                setSearchQuery("");
                setRoleFilter("all");
              }}
            >
              Nullstill
            </button>
          </p>
        ) : null}

        {workspaces.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 px-8 py-16 text-center">
            <p className="text-base font-medium text-foreground">
              Ingen arbeidsområder ennå
            </p>
            <p className="text-muted-foreground mx-auto mt-2 max-w-sm text-[15px] leading-relaxed">
              Opprett det første for å komme i gang.
            </p>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="bg-foreground text-background mt-7 inline-flex h-12 items-center gap-2 rounded-xl px-6 text-sm font-semibold"
            >
              <Plus className="size-4" aria-hidden />
              Nytt arbeidsområde
            </button>
          </div>
        ) : null}

        {pageItems.length > 0 && viewMode === "cards" ? (
          <ul className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {pageItems.map((row) => {
              const { workspace, role } = row;
              const isDefault = defaultWorkspaceId === workspace._id;
              const initial =
                workspace.name.trim().charAt(0).toUpperCase() || "?";

              return (
                <li key={workspace._id} className="min-w-0">
                  <article
                    className={cn(
                      "group relative flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-border/50 bg-card p-4 transition-all sm:p-5",
                      "hover:border-border hover:bg-muted/25",
                      isDefault && "ring-1 ring-foreground/12",
                    )}
                  >
                    <Link
                      href={`/w/${workspace._id}`}
                      className="absolute inset-0 z-0 rounded-2xl"
                      aria-label={`Åpne ${workspace.name}`}
                    />
                    <div className="pointer-events-none relative z-10 flex items-start gap-3">
                      <span
                        className={cn(
                          "flex size-11 shrink-0 items-center justify-center rounded-xl text-sm font-semibold",
                          isDefault
                            ? "bg-foreground text-background"
                            : avatarTone(workspace.name),
                        )}
                        aria-hidden
                      >
                        {initial}
                      </span>
                      <div className="min-w-0 flex-1 pt-0.5">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug tracking-tight text-foreground">
                            {workspace.name}
                          </h3>
                          <div className="pointer-events-auto -mt-1 -mr-1 shrink-0">
                            {renderMenu(row)}
                          </div>
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <span className="bg-muted/80 text-muted-foreground rounded-md px-1.5 py-0.5 text-[11px] font-medium">
                            {ROLE_LABELS[role]}
                          </span>
                          {isDefault ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[11px] font-medium text-amber-900 dark:text-amber-200">
                              <Star
                                className="size-3 fill-current"
                                aria-hidden
                              />
                              Standard
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    <div className="pointer-events-none relative z-10 mt-4 flex items-center justify-between border-t border-border/40 pt-3">
                      <span className="text-muted-foreground text-sm font-medium transition-colors group-hover:text-foreground">
                        Åpne område
                      </span>
                      <ArrowUpRight
                        className="text-muted-foreground/40 size-4 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground"
                        aria-hidden
                      />
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        ) : null}

        {pageItems.length > 0 && viewMode === "list" ? (
          <ul className="flex min-w-0 flex-col gap-2">
            {pageItems.map((row) => {
              const { workspace, role } = row;
              const isDefault = defaultWorkspaceId === workspace._id;
              const initial =
                workspace.name.trim().charAt(0).toUpperCase() || "?";

              return (
                <li key={workspace._id}>
                  <div
                    className={cn(
                      "group relative flex items-center gap-3 rounded-2xl border border-border/50 bg-card px-4 py-3.5 transition-colors hover:bg-muted/25 sm:gap-4 sm:px-5",
                      isDefault && "ring-1 ring-foreground/12",
                    )}
                  >
                    <Link
                      href={`/w/${workspace._id}`}
                      className="absolute inset-0 z-0 rounded-2xl"
                      aria-label={`Åpne ${workspace.name}`}
                    />
                    <span
                      className={cn(
                        "pointer-events-none relative z-10 flex size-10 shrink-0 items-center justify-center rounded-xl text-sm font-semibold",
                        isDefault
                          ? "bg-foreground text-background"
                          : avatarTone(workspace.name),
                      )}
                      aria-hidden
                    >
                      {initial}
                    </span>
                    <div className="pointer-events-none relative z-10 min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-2">
                        <h3 className="truncate text-[15px] font-semibold tracking-tight text-foreground">
                          {workspace.name}
                        </h3>
                        {isDefault ? (
                          <Star
                            className="size-3.5 shrink-0 fill-current text-amber-500"
                            aria-label="Standard"
                          />
                        ) : null}
                      </div>
                      <p className="text-muted-foreground mt-0.5 text-sm">
                        {ROLE_LABELS[role]}
                      </p>
                    </div>
                    <div className="pointer-events-auto relative z-10 flex items-center gap-1">
                      {renderMenu(row)}
                      <ArrowRight
                        className="text-muted-foreground/35 pointer-events-none size-4 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
                        aria-hidden
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}

        {pageItems.length > 0 && viewMode === "table" ? (
          <div className="overflow-hidden rounded-2xl border border-border/50 bg-card">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[28rem] text-left text-sm">
                <thead className="bg-muted/30 text-muted-foreground border-b border-border/50 text-xs font-medium tracking-wide uppercase">
                  <tr>
                    <th className="px-5 py-3.5 font-medium">Område</th>
                    <th className="px-5 py-3.5 font-medium">Rolle</th>
                    <th className="px-5 py-3.5 font-medium">Status</th>
                    <th className="px-5 py-3.5 text-right font-medium">
                      Handling
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((row) => {
                    const { workspace, role } = row;
                    const isDefault = defaultWorkspaceId === workspace._id;
                    const initial =
                      workspace.name.trim().charAt(0).toUpperCase() || "?";

                    return (
                      <tr
                        key={workspace._id}
                        className="border-b border-border/40 last:border-0 transition-colors hover:bg-muted/25"
                      >
                        <td className="px-5 py-3.5">
                          <Link
                            href={`/w/${workspace._id}`}
                            className="flex min-w-0 items-center gap-3"
                          >
                            <span
                              className={cn(
                                "flex size-9 shrink-0 items-center justify-center rounded-xl text-sm font-semibold",
                                isDefault
                                  ? "bg-foreground text-background"
                                  : avatarTone(workspace.name),
                              )}
                              aria-hidden
                            >
                              {initial}
                            </span>
                            <span className="truncate font-medium text-foreground">
                              {workspace.name}
                            </span>
                          </Link>
                        </td>
                        <td className="text-muted-foreground px-5 py-3.5">
                          {ROLE_LABELS[role]}
                        </td>
                        <td className="px-5 py-3.5">
                          {isDefault ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-900 dark:text-amber-200">
                              <Star
                                className="size-3 fill-current"
                                aria-hidden
                              />
                              Standard
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center justify-end gap-1">
                            {renderMenu(row)}
                            <Link
                              href={`/w/${workspace._id}`}
                              className="hover:bg-muted inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-foreground transition-colors"
                            >
                              Åpne
                              <ArrowUpRight className="size-3.5" aria-hidden />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {visibleWorkspaces.length > 0 ? (
          <div className="flex flex-col gap-3 border-t border-border/40 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-muted-foreground text-sm" aria-live="polite">
              Viser {rangeStart}–{rangeEnd} av {visibleWorkspaces.length}
            </p>
            {totalPages > 1 ? (
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:flex">
                <button
                  type="button"
                  className="border-border/50 bg-background hover:bg-muted/50 inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border px-3.5 text-sm font-medium text-foreground transition-colors touch-manipulation disabled:pointer-events-none disabled:opacity-40 sm:h-10"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="size-4" aria-hidden />
                  Forrige
                </button>
                <span className="text-muted-foreground min-w-[5.5rem] text-center text-sm tabular-nums">
                  Side {safePage} / {totalPages}
                </span>
                <button
                  type="button"
                  className="border-border/50 bg-background hover:bg-muted/50 inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border px-3.5 text-sm font-medium text-foreground transition-colors touch-manipulation disabled:pointer-events-none disabled:opacity-40 sm:h-10"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Neste
                  <ChevronRight className="size-4" aria-hidden />
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <WorkspaceDeleteDialog
        workspace={deleteTarget}
        open={deleteTarget !== null}
        onOpenChange={(open: boolean) => {
          if (!open) setDeleteTarget(null);
        }}
        onDeleted={() => router.push("/dashboard")}
      />
    </>
  );
}
