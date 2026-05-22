"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchInput } from "@/components/ui/search-input";
import { WorkspaceDeleteDialog } from "@/components/workspace/workspace-delete-dialog";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { formatUserFacingError } from "@/lib/user-facing-error";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  ChevronRight,
  MoreHorizontal,
  Plus,
  Settings,
  Star,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type WorkspaceRow = {
  workspace: Doc<"workspaces">;
  role: "owner" | "admin" | "member" | "viewer";
};

const ROLE_LABELS: Record<WorkspaceRow["role"], string> = {
  owner: "Eier",
  admin: "Admin",
  member: "Medlem",
  viewer: "Visning",
};

export function WorkspaceDashboardGrid({
  workspaces,
  defaultWorkspaceId,
}: {
  workspaces: WorkspaceRow[];
  defaultWorkspaceId: Id<"workspaces"> | null;
}) {
  const router = useRouter();
  const create = useMutation(api.workspaces.create);
  const setDefaultWorkspace = useMutation(api.workspaces.setDefaultWorkspace);

  const [newName, setNewName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Doc<"workspaces"> | null>(
    null,
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | WorkspaceRow["role"]>("all");
  const [sortBy, setSortBy] = useState<"name_asc" | "name_desc" | "recent">("name_asc");
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const visibleWorkspaces = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = workspaces.filter(({ workspace, role }) => {
      const searchPass = !q || workspace.name.toLowerCase().includes(q);
      const rolePass = roleFilter === "all" || role === roleFilter;
      return searchPass && rolePass;
    });
    const sorted = [...filtered];
    switch (sortBy) {
      case "name_desc":
        sorted.sort((a, b) =>
          b.workspace.name.localeCompare(a.workspace.name, "nb-NO"),
        );
        break;
      case "recent":
        sorted.sort((a, b) => b.workspace._creationTime - a.workspace._creationTime);
        break;
      case "name_asc":
      default:
        sorted.sort((a, b) =>
          a.workspace.name.localeCompare(b.workspace.name, "nb-NO"),
        );
        break;
    }
    return sorted;
  }, [workspaces, searchQuery, roleFilter, sortBy]);

  async function handleCreate() {
    setCreateError(null);
    const name = newName.trim();
    if (!name) {
      setCreateError("Skriv inn et navn.");
      return;
    }
    setCreating(true);
    try {
      const id = await create({ name });
      setNewName("");
      router.push(`/w/${id}`);
    } catch (e) {
      setCreateError(
        formatUserFacingError(e, "Kunne ikke opprette arbeidsområde."),
      );
    } finally {
      setCreating(false);
    }
  }

  const createBlock = (
    <div className="space-y-2">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          id="new-ws-name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Navn på nytt område"
          className="h-11 flex-1 rounded-xl bg-background text-sm"
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleCreate();
          }}
        />
        <Button
          type="button"
          className="h-11 shrink-0 gap-2 rounded-xl px-4 text-sm font-medium shadow-none sm:w-auto"
          disabled={creating || !newName.trim()}
          onClick={() => void handleCreate()}
        >
          {creating ? (
            "Oppretter …"
          ) : (
            <>
              <Plus className="size-4" aria-hidden />
              Opprett
            </>
          )}
        </Button>
      </div>
      {createError ? (
        <p className="text-destructive text-sm" role="alert">
          {createError}
        </p>
      ) : null}
    </div>
  );

  return (
    <>
      {workspaces.length > 0 ? (
        <details className="group rounded-2xl border border-border/45 bg-card/65 shadow-sm open:bg-card/80">
          <summary className="cursor-pointer list-none rounded-2xl px-4 py-3.5 text-sm font-medium transition-colors hover:bg-muted/20 [&::-webkit-details-marker]:hidden">
            <span className="inline-flex w-full items-center justify-between gap-2">
              <span>Nytt arbeidsområde</span>
              <ChevronRight className="text-muted-foreground size-4 shrink-0 transition-transform group-open:rotate-90" />
            </span>
          </summary>
          <div className="border-t border-border/35 px-4 pb-4 pt-2">{createBlock}</div>
        </details>
      ) : (
        <section className="rounded-2xl border border-border/45 bg-card/65 p-4 shadow-sm">
          <p className="text-foreground mb-3 text-sm font-medium">Opprett første område</p>
          {createBlock}
        </section>
      )}

      {/* ── Workspace list ── */}
      <section
        id="arbeidsområder"
        className="scroll-mt-24 space-y-3"
        aria-labelledby="dash-workspaces-heading"
      >
        <div className="grid gap-2 rounded-2xl border border-border/50 bg-card p-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border/50 bg-muted/20 px-3 py-2">
            <p className="text-[11px] text-muted-foreground">Totalt</p>
            <p className="text-base font-semibold tabular-nums text-foreground">
              {workspaces.length}
            </p>
          </div>
          <div className="rounded-xl border border-border/50 bg-muted/20 px-3 py-2">
            <p className="text-[11px] text-muted-foreground">Eier eller admin</p>
            <p className="text-base font-semibold tabular-nums text-foreground">
              {workspaces.filter((w) => w.role === "owner" || w.role === "admin").length}
            </p>
          </div>
          <div className="rounded-xl border border-border/50 bg-muted/20 px-3 py-2">
            <p className="text-[11px] text-muted-foreground">Vises nå</p>
            <p className="text-base font-semibold tabular-nums text-foreground">
              {visibleWorkspaces.length}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2
              id="dash-workspaces-heading"
              className="text-foreground text-base font-semibold tracking-tight"
            >
              Arbeidsområder
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Åpne riktig område raskt med søk, rollefilter og sortering.
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <SearchInput
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Søk i navn …"
              aria-label="Filtrer arbeidsområder"
              className="w-full sm:min-w-[16rem]"
            />
            <select
              aria-label="Filtrer på rolle"
              value={roleFilter}
              onChange={(e) =>
                setRoleFilter(e.target.value as "all" | WorkspaceRow["role"])
              }
              className="h-10 rounded-lg border border-border/50 bg-background px-3 text-sm"
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
              className="h-10 rounded-lg border border-border/50 bg-background px-3 text-sm"
            >
              <option value="name_asc">Navn A-Å</option>
              <option value="name_desc">Navn Å-A</option>
              <option value="recent">Nyeste først</option>
            </select>
          </div>
        </div>

        {visibleWorkspaces.length === 0 && workspaces.length > 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm" role="status">
            Ingen treff.{" "}
            <button
              type="button"
              className="text-primary font-medium hover:underline"
              onClick={() => {
                setSearchQuery("");
                setRoleFilter("all");
              }}
            >
              Nullstill
            </button>
          </p>
        ) : null}

        <div className="overflow-hidden rounded-2xl border border-border/50 bg-card shadow-sm">
          <div className="text-muted-foreground hidden grid-cols-[minmax(0,2fr)_7rem_7rem_2.5rem_2.5rem] items-center gap-3 border-b border-border/50 bg-muted/20 px-5 py-2 text-[11px] font-medium sm:grid">
            <span>Arbeidsområde</span>
            <span>Rolle</span>
            <span>Standard</span>
            <span className="sr-only">Innstillinger</span>
            <span className="sr-only">Åpne</span>
          </div>
          <ul className="divide-y divide-border/40">
            {visibleWorkspaces.map(({ workspace, role }) => {
            const isOwner = role === "owner";
            const canManage = role === "owner" || role === "admin";
            const isDefault = defaultWorkspaceId === workspace._id;
            const isMenuOpen = menuOpenId === workspace._id;

            return (
              <li
                key={workspace._id}
                className={cn(
                  "group/row relative grid grid-cols-1 gap-2 px-4 py-3 transition-colors hover:bg-muted/35 sm:grid-cols-[minmax(0,2fr)_7rem_7rem_2.5rem_2.5rem] sm:items-center sm:gap-3 sm:px-5 sm:py-3.5",
                  isDefault && "bg-primary/[0.05]",
                )}
              >
                <Link
                  href={`/w/${workspace._id}`}
                  className="absolute inset-0 z-0 rounded-none"
                  aria-label={`Åpne ${workspace.name}`}
                />

                <div className="pointer-events-none relative z-10 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-sm font-medium text-foreground">
                      {workspace.name}
                    </h3>
                    {isDefault ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/[0.08] px-2 py-0.5 text-[10px] font-medium text-primary">
                        <Star className="size-3 fill-current" aria-hidden />
                        Sist brukt
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">
                    Opprettet {new Date(workspace._creationTime).toLocaleDateString("nb-NO")}
                  </p>
                </div>

                <div className="pointer-events-none relative z-10 text-xs text-muted-foreground">
                  {ROLE_LABELS[role]}
                </div>

                <div className="pointer-events-none relative z-10">
                  {isDefault ? (
                    <span className="inline-flex rounded-full border border-border/60 bg-muted px-2 py-0.5 text-[10px] text-foreground">
                      Aktiv
                    </span>
                  ) : (
                    <span className="text-[11px] text-muted-foreground">-</span>
                  )}
                </div>

                <div className="pointer-events-auto relative z-10">
                  {canManage ? (
                    <div>
                      <button
                        type="button"
                        className="text-muted-foreground/50 hover:text-foreground hover:bg-muted/60 flex size-8 items-center justify-center rounded-xl opacity-0 transition-all duration-200 sm:group-hover/row:opacity-100"
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
                              {isDefault ? "Fjern som standard" : "Sett som standard"}
                            </button>
                            <Link
                              href={`/w/${workspace._id}/innstillinger`}
                              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-foreground transition-colors hover:bg-muted/70"
                              onClick={() => setMenuOpenId(null)}
                            >
                              <Settings className="size-4 opacity-60" aria-hidden />
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
                                  <Trash2 className="size-4 opacity-60" aria-hidden />
                                  Slett
                                </button>
                              </>
                            ) : null}
                          </div>
                        </>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                <div className="pointer-events-none relative z-10 ml-auto hidden items-center sm:flex">
                  <ArrowRight
                    className="size-4 text-muted-foreground/40 transition-all duration-200 group-hover/row:text-foreground group-hover/row:translate-x-0.5"
                    aria-hidden
                  />
                </div>
              </li>
            );
          })}
          </ul>
        </div>
      </section>

      <WorkspaceDeleteDialog
        workspace={deleteTarget}
        open={deleteTarget !== null}
        onOpenChange={(o) => {
          if (!o) setDeleteTarget(null);
        }}
        onDeleted={() => router.push("/dashboard")}
      />
    </>
  );
}
