"use client";

import { WorkspaceDeleteDialog } from "@/components/workspace/workspace-delete-dialog";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { useMutation } from "convex/react";
import {
  ArrowRight,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  Star,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

const ROLE_LABELS: Record<string, string> = {
  owner: "Eier",
  admin: "Admin",
  member: "Medlem",
  viewer: "Visning",
};

type WorkspaceRow = {
  workspace: Doc<"workspaces">;
  role: "owner" | "admin" | "member" | "viewer";
};

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

  return (
    <>
      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              Arbeidsområder
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Åpne et område for å jobbe videre.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCreateOpen((v) => !v)}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full border border-border/60 bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted/50"
          >
            <Plus className="size-4" aria-hidden />
            Nytt område
          </button>
        </div>

        {createOpen ? (
          <form
            onSubmit={(e) => void onCreate(e)}
            className="flex flex-col gap-3 rounded-2xl border border-border/50 bg-muted/20 p-4 sm:flex-row sm:items-end"
          >
            <label className="min-w-0 flex-1 space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                Navn
              </span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="F.eks. Klinikk, prosjekt eller avdeling"
                autoFocus
                className="h-11 w-full rounded-full border border-border/50 bg-background px-4 text-sm outline-none transition-shadow focus:ring-2 focus:ring-foreground/15"
              />
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setCreateOpen(false);
                  setError(null);
                }}
                className="h-11 rounded-full px-4 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Avbryt
              </button>
              <button
                type="submit"
                disabled={creating || !name.trim()}
                className="h-11 rounded-full bg-foreground px-5 text-sm font-semibold text-background transition-opacity disabled:opacity-40"
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

        {showFilters ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="relative min-w-0 flex-1">
              <Search
                className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Søk i navn"
                className="h-11 w-full rounded-full border border-border/50 bg-background pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-foreground/15"
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
              className="h-11 rounded-full border border-border/50 bg-background px-4 text-sm"
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
                setSortBy(e.target.value as "name_asc" | "name_desc" | "recent")
              }
              className="h-11 rounded-full border border-border/50 bg-background px-4 text-sm"
            >
              <option value="name_asc">Navn A–Å</option>
              <option value="name_desc">Navn Å–A</option>
              <option value="recent">Nyeste først</option>
            </select>
          </div>
        ) : null}

        {visibleWorkspaces.length === 0 && workspaces.length > 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground" role="status">
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
          <div className="rounded-2xl border border-dashed border-border/60 px-6 py-12 text-center">
            <p className="text-sm font-medium text-foreground">
              Ingen arbeidsområder ennå
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Opprett det første for å komme i gang.
            </p>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="mt-5 inline-flex h-11 items-center gap-2 rounded-full bg-foreground px-5 text-sm font-semibold text-background"
            >
              <Plus className="size-4" aria-hidden />
              Nytt arbeidsområde
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-border/40 overflow-hidden rounded-2xl border border-border/50 bg-card">
            {visibleWorkspaces.map(({ workspace, role }) => {
              const isOwner = role === "owner";
              const canManage = role === "owner" || role === "admin";
              const isDefault = defaultWorkspaceId === workspace._id;
              const isMenuOpen = menuOpenId === workspace._id;
              const initial = workspace.name.trim().charAt(0).toUpperCase() || "?";

              return (
                <li
                  key={workspace._id}
                  className={cn(
                    "group/row relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/30 sm:grid-cols-[minmax(0,1fr)_6.5rem_auto_auto] sm:gap-4 sm:px-5",
                    isDefault && "bg-muted/20",
                  )}
                >
                  <Link
                    href={`/w/${workspace._id}`}
                    className="absolute inset-0 z-0"
                    aria-label={`Åpne ${workspace.name}`}
                  />

                  <div className="pointer-events-none relative z-10 flex min-w-0 items-center gap-3">
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
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-2">
                        <h3 className="truncate text-sm font-medium text-foreground">
                          {workspace.name}
                        </h3>
                        {isDefault ? (
                          <Star
                            className="size-3.5 shrink-0 fill-current text-foreground"
                            aria-label="Sist brukt"
                          />
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground sm:hidden">
                        {ROLE_LABELS[role]}
                      </p>
                    </div>
                  </div>

                  <div className="pointer-events-none relative z-10 hidden text-xs text-muted-foreground sm:block">
                    {ROLE_LABELS[role]}
                  </div>

                  <div className="pointer-events-auto relative z-10">
                    {canManage ? (
                      <div>
                        <button
                          type="button"
                          className="flex size-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground sm:opacity-0 sm:group-hover/row:opacity-100"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setMenuOpenId(isMenuOpen ? null : workspace._id);
                          }}
                          aria-label="Flere valg"
                        >
                          <MoreHorizontal className="size-4" aria-hidden />
                        </button>

                        {isMenuOpen ? (
                          <>
                            <div
                              className="fixed inset-0 z-40"
                              onClick={() => setMenuOpenId(null)}
                            />
                            <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-2xl bg-card p-1.5 shadow-xl ring-1 ring-black/[0.08] dark:ring-white/[0.12]">
                              <button
                                type="button"
                                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-foreground transition-colors hover:bg-muted/70"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void setDefaultWorkspace({
                                    workspaceId: isDefault
                                      ? null
                                      : (workspace._id as Id<"workspaces">),
                                  });
                                  setMenuOpenId(null);
                                }}
                              >
                                <Star className="size-4 opacity-60" aria-hidden />
                                {isDefault
                                  ? "Fjern som standard"
                                  : "Sett som standard"}
                              </button>
                              <Link
                                href={`/w/${workspace._id}/innstillinger`}
                                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-foreground transition-colors hover:bg-muted/70"
                                onClick={() => setMenuOpenId(null)}
                              >
                                <Settings
                                  className="size-4 opacity-60"
                                  aria-hidden
                                />
                                Innstillinger
                              </Link>
                              {isOwner ? (
                                <>
                                  <div className="mx-2 my-1 h-px bg-border/40" />
                                  <button
                                    type="button"
                                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-destructive transition-colors hover:bg-destructive/10"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setDeleteTarget(workspace);
                                      setMenuOpenId(null);
                                    }}
                                  >
                                    <Trash2
                                      className="size-4 opacity-60"
                                      aria-hidden
                                    />
                                    Slett
                                  </button>
                                </>
                              ) : null}
                            </div>
                          </>
                        ) : null}
                      </div>
                    ) : (
                      <span className="inline-block size-9" aria-hidden />
                    )}
                  </div>

                  <div className="pointer-events-none relative z-10 hidden sm:block">
                    <ArrowRight
                      className="size-4 text-muted-foreground/35 transition-all duration-200 group-hover/row:translate-x-0.5 group-hover/row:text-foreground"
                      aria-hidden
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
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
