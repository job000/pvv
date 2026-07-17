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

const PAGE_SIZES = [6, 10, 20] as const;
type PageSize = (typeof PAGE_SIZES)[number];

type WorkspaceRow = {
  workspace: Doc<"workspaces">;
  role: "owner" | "admin" | "member" | "viewer";
};

const selectClass =
  "h-11 appearance-none rounded-2xl border border-border/50 bg-background px-4 pr-10 text-sm outline-none focus:ring-2 focus:ring-foreground/15";

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
        className="flex size-10 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
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
          <div className="absolute right-0 top-full z-50 mt-1 w-52 rounded-2xl bg-card p-1.5 shadow-xl ring-1 ring-black/[0.08] dark:ring-white/[0.12]">
            <button
              type="button"
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-muted/70"
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
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-muted/70"
              onClick={() => onOpenChange(false)}
            >
              <Settings className="size-4 opacity-60" aria-hidden />
              Innstillinger
            </Link>
            {isOwner ? (
              <>
                <div className="mx-2 my-1 h-px bg-border/40" />
                <button
                  type="button"
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-destructive transition-colors hover:bg-destructive/10"
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
  const [pageSize, setPageSize] = useStickyState<PageSize>(
    "dashboard-ws-page-size",
    6,
  );
  const [page, setPage] = useState(1);

  const showFilters = workspaces.length >= 4;

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
        onOpenChange={(open) =>
          setMenuOpenId(open ? workspace._id : null)
        }
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
      <section className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 space-y-1">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              Arbeidsområder
            </h2>
            <p className="text-[15px] text-muted-foreground">
              Åpne et område for å jobbe videre.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCreateOpen((v) => !v)}
            className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-2xl border border-border/60 bg-background px-5 text-sm font-medium text-foreground transition-colors hover:bg-muted/50"
          >
            <Plus className="size-4" aria-hidden />
            Nytt område
          </button>
        </div>

        {createOpen ? (
          <form
            onSubmit={(e) => void onCreate(e)}
            className="flex flex-col gap-4 rounded-3xl border border-border/50 bg-muted/20 p-5 sm:flex-row sm:items-end"
          >
            <label className="min-w-0 flex-1 space-y-2">
              <span className="text-sm font-medium text-muted-foreground">
                Navn
              </span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="F.eks. Klinikk, prosjekt eller avdeling"
                autoFocus
                className="h-12 w-full rounded-2xl border border-border/50 bg-background px-4 text-sm outline-none transition-shadow focus:ring-2 focus:ring-foreground/15"
              />
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setCreateOpen(false);
                  setError(null);
                }}
                className="h-12 rounded-2xl px-4 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Avbryt
              </button>
              <button
                type="submit"
                disabled={creating || !name.trim()}
                className="h-12 rounded-2xl bg-foreground px-6 text-sm font-semibold text-background transition-opacity disabled:opacity-40"
              >
                {creating ? "Oppretter…" : "Opprett"}
              </button>
            </div>
            {error ? (
              <p className="w-full text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
          </form>
        ) : null}

        {workspaces.length > 0 ? (
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            {showFilters ? (
              <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
                <label className="relative min-w-0 flex-1">
                  <Search
                    className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                  />
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Søk i navn"
                    className="h-11 w-full rounded-2xl border border-border/50 bg-background pl-11 pr-4 text-sm outline-none focus:ring-2 focus:ring-foreground/15"
                  />
                </label>
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
                  className={selectClass}
                >
                  <option value="all">Alle roller</option>
                  <option value="owner">Eier</option>
                  <option value="admin">Admin</option>
                  <option value="member">Medlem</option>
                  <option value="viewer">Visning</option>
                </select>
                <select
                  aria-label="Sorter arbeidsområder"
                  value={sortBy}
                  onChange={(e) =>
                    setSortBy(
                      e.target.value as "name_asc" | "name_desc" | "recent",
                    )
                  }
                  className={selectClass}
                >
                  <option value="name_asc">Navn A–Å</option>
                  <option value="name_desc">Navn Å–A</option>
                  <option value="recent">Nyeste først</option>
                </select>
              </div>
            ) : (
              <div className="flex-1" />
            )}

            <div className="flex flex-wrap items-center gap-2">
              <ListViewModeToggle value={viewMode} onChange={setViewMode} />
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
            </div>
          </div>
        ) : null}

        {visibleWorkspaces.length === 0 && workspaces.length > 0 ? (
          <p
            className="py-10 text-center text-sm text-muted-foreground"
            role="status"
          >
            Ingen treff.{" "}
            <button
              type="button"
              className="font-medium text-foreground underline-offset-2 hover:underline"
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
          <div className="rounded-3xl border border-dashed border-border/60 px-8 py-16 text-center">
            <p className="text-base font-medium text-foreground">
              Ingen arbeidsområder ennå
            </p>
            <p className="mx-auto mt-2 max-w-sm text-[15px] leading-relaxed text-muted-foreground">
              Opprett det første for å komme i gang.
            </p>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="mt-7 inline-flex h-12 items-center gap-2 rounded-2xl bg-foreground px-6 text-sm font-semibold text-background"
            >
              <Plus className="size-4" aria-hidden />
              Nytt arbeidsområde
            </button>
          </div>
        ) : null}

        {pageItems.length > 0 && viewMode === "cards" ? (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {pageItems.map((row) => {
              const { workspace, role } = row;
              const isDefault = defaultWorkspaceId === workspace._id;
              const initial =
                workspace.name.trim().charAt(0).toUpperCase() || "?";

              return (
                <li key={workspace._id} className="min-w-0">
                  <article
                    className={cn(
                      "group relative flex h-full flex-col rounded-3xl border border-border/50 bg-card p-5 shadow-sm transition-all",
                      "hover:border-border hover:bg-muted/20 hover:shadow-md",
                      isDefault && "ring-1 ring-foreground/10",
                    )}
                  >
                    <Link
                      href={`/w/${workspace._id}`}
                      className="absolute inset-0 z-0 rounded-3xl"
                      aria-label={`Åpne ${workspace.name}`}
                    />
                    <div className="pointer-events-none relative z-10 flex items-start justify-between gap-3">
                      <span
                        className={cn(
                          "flex size-12 shrink-0 items-center justify-center rounded-2xl text-base font-semibold",
                          isDefault
                            ? "bg-foreground text-background"
                            : "bg-muted text-foreground",
                        )}
                        aria-hidden
                      >
                        {initial}
                      </span>
                      <div className="pointer-events-auto flex items-center gap-1">
                        {isDefault ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-muted/80 px-2.5 py-1 text-[11px] font-medium text-foreground">
                            <Star
                              className="size-3 fill-current"
                              aria-hidden
                            />
                            Standard
                          </span>
                        ) : null}
                        {renderMenu(row)}
                      </div>
                    </div>
                    <div className="pointer-events-none relative z-10 mt-5 min-w-0 flex-1">
                      <h3 className="truncate text-base font-semibold tracking-tight text-foreground">
                        {workspace.name}
                      </h3>
                      <p className="mt-1.5 text-sm text-muted-foreground">
                        {ROLE_LABELS[role]}
                      </p>
                    </div>
                    <div className="pointer-events-none relative z-10 mt-6 flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground transition-colors group-hover:text-foreground">
                        Åpne
                      </span>
                      <ArrowUpRight
                        className="size-4 text-muted-foreground/40 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground"
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
          <ul className="flex flex-col gap-3">
            {pageItems.map((row) => {
              const { workspace, role } = row;
              const isDefault = defaultWorkspaceId === workspace._id;
              const initial =
                workspace.name.trim().charAt(0).toUpperCase() || "?";

              return (
                <li key={workspace._id}>
                  <div
                    className={cn(
                      "group relative flex items-center gap-4 rounded-3xl border border-border/50 bg-card px-5 py-4 shadow-sm transition-colors hover:bg-muted/25",
                      isDefault && "ring-1 ring-foreground/10",
                    )}
                  >
                    <Link
                      href={`/w/${workspace._id}`}
                      className="absolute inset-0 z-0 rounded-3xl"
                      aria-label={`Åpne ${workspace.name}`}
                    />
                    <span
                      className={cn(
                        "pointer-events-none relative z-10 flex size-11 shrink-0 items-center justify-center rounded-2xl text-sm font-semibold",
                        isDefault
                          ? "bg-foreground text-background"
                          : "bg-muted text-foreground",
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
                            className="size-3.5 shrink-0 fill-current text-foreground"
                            aria-label="Standard"
                          />
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {ROLE_LABELS[role]}
                      </p>
                    </div>
                    <div className="pointer-events-auto relative z-10 flex items-center gap-1">
                      {renderMenu(row)}
                      <ArrowRight
                        className="pointer-events-none size-4 text-muted-foreground/35 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
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
          <div className="overflow-hidden rounded-3xl border border-border/50 bg-card shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[28rem] text-left text-sm">
                <thead className="border-b border-border/50 bg-muted/30 text-xs font-medium uppercase tracking-wide text-muted-foreground">
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
                        <td className="px-5 py-4">
                          <Link
                            href={`/w/${workspace._id}`}
                            className="flex min-w-0 items-center gap-3"
                          >
                            <span
                              className={cn(
                                "flex size-9 shrink-0 items-center justify-center rounded-xl text-sm font-semibold",
                                isDefault
                                  ? "bg-foreground text-background"
                                  : "bg-muted text-foreground",
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
                        <td className="px-5 py-4 text-muted-foreground">
                          {ROLE_LABELS[role]}
                        </td>
                        <td className="px-5 py-4">
                          {isDefault ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground">
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
                        <td className="px-5 py-4">
                          <div className="flex items-center justify-end gap-1">
                            {renderMenu(row)}
                            <Link
                              href={`/w/${workspace._id}`}
                              className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
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
            <p className="text-sm text-muted-foreground" aria-live="polite">
              Viser {rangeStart}–{rangeEnd} av {visibleWorkspaces.length}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="inline-flex h-10 items-center gap-1.5 rounded-2xl border border-border/50 bg-background px-3.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/50 disabled:pointer-events-none disabled:opacity-40"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="size-4" aria-hidden />
                Forrige
              </button>
              <span className="min-w-[5.5rem] text-center text-sm tabular-nums text-muted-foreground">
                Side {safePage} / {totalPages}
              </span>
              <button
                type="button"
                className="inline-flex h-10 items-center gap-1.5 rounded-2xl border border-border/50 bg-background px-3.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/50 disabled:pointer-events-none disabled:opacity-40"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Neste
                <ChevronRight className="size-4" aria-hidden />
              </button>
            </div>
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
