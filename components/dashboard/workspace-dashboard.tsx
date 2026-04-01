"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WorkspaceDeleteDialog } from "@/components/workspace/workspace-delete-dialog";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { formatUserFacingError } from "@/lib/user-facing-error";
import { cn } from "@/lib/utils";
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
import { useMemo, useRef, useState } from "react";

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
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const filteredWorkspaces = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return workspaces;
    return workspaces.filter(({ workspace }) =>
      workspace.name.toLowerCase().includes(q),
    );
  }, [workspaces, searchQuery]);

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

  return (
    <>
      {/* ── Create workspace ── */}
      <section className="rounded-2xl bg-muted/30 p-5">
        <p className="text-foreground mb-3 text-sm font-semibold">
          Opprett nytt arbeidsområde
        </p>
        <div className="flex gap-3">
          <Input
            id="new-ws-name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="F.eks. Digitalisering Vest"
            className="h-12 flex-1 rounded-xl bg-background text-base shadow-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleCreate();
            }}
          />
          <Button
            type="button"
            className="h-12 shrink-0 gap-2 rounded-xl px-5 text-sm font-semibold shadow-sm"
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
          <p className="text-destructive mt-2 text-sm" role="alert">
            {createError}
          </p>
        ) : null}
      </section>

      {/* ── Workspace list ── */}
      <section
        id="arbeidsområder"
        className="scroll-mt-24 space-y-4"
        aria-labelledby="dash-workspaces-heading"
      >
        <div className="flex items-center justify-between gap-3">
          <h2
            id="dash-workspaces-heading"
            className="text-foreground text-base font-semibold"
          >
            {workspaces.length} arbeidsområde{workspaces.length !== 1 ? "r" : ""}
          </h2>
          {workspaces.length > 3 ? (
            <div className="relative">
              <Search
                className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2"
                aria-hidden
              />
              <Input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Søk …"
                className="h-9 w-48 rounded-lg pl-9 text-sm"
                aria-label="Filtrer arbeidsområder"
                autoComplete="off"
              />
            </div>
          ) : null}
        </div>

        {filteredWorkspaces.length === 0 && workspaces.length > 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm" role="status">
            Ingen treff.{" "}
            <button
              type="button"
              className="text-primary font-medium hover:underline"
              onClick={() => setSearchQuery("")}
            >
              Nullstill
            </button>
          </p>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredWorkspaces.map(({ workspace, role }) => {
            const isOwner = role === "owner";
            const canManage = role === "owner" || role === "admin";
            const isDefault = defaultWorkspaceId === workspace._id;
            const isMenuOpen = menuOpenId === workspace._id;

            return (
              <div
                key={workspace._id}
                className={cn(
                  "group relative cursor-pointer rounded-2xl p-5 transition-all duration-200",
                  "hover:shadow-md hover:scale-[1.02] active:scale-[0.99]",
                  isDefault
                    ? "bg-primary/[0.04] shadow-sm ring-1 ring-primary/20 hover:ring-primary/35"
                    : "bg-card shadow-sm ring-1 ring-black/[0.04] hover:ring-black/[0.08] dark:ring-white/[0.06] dark:hover:ring-white/[0.12]",
                )}
              >
                <Link
                  href={`/w/${workspace._id}`}
                  className="absolute inset-0 z-[1] rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  aria-label={`Åpne ${workspace.name}`}
                />

                <div className="pointer-events-none relative z-[2] flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-foreground truncate text-base font-semibold tracking-tight">
                        {workspace.name}
                      </h3>
                      {isDefault ? (
                        <Star
                          className="text-primary size-3.5 shrink-0 fill-current"
                          aria-label="Standard"
                        />
                      ) : null}
                    </div>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {ROLE_LABELS[role]}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <ArrowRight
                      className="text-muted-foreground/30 size-5 transition-all duration-200 group-hover:text-foreground group-hover:translate-x-1"
                      aria-hidden
                    />

                    {canManage ? (
                      <div ref={isMenuOpen ? menuRef : undefined} className="pointer-events-auto">
                        <button
                          type="button"
                          className="text-muted-foreground/50 hover:text-foreground hover:bg-muted/60 flex size-8 items-center justify-center rounded-lg opacity-0 transition-all duration-200 group-hover:opacity-100"
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
                            <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-xl bg-card p-1.5 shadow-xl ring-1 ring-black/[0.08] dark:ring-white/[0.12]">
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
                </div>
              </div>
            );
          })}
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
