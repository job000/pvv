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
        <details className="border-border/40 bg-muted/15 group rounded-xl border open:bg-muted/25">
          <summary className="hover:bg-muted/25 cursor-pointer list-none rounded-xl px-4 py-3 text-sm font-medium transition-colors [&::-webkit-details-marker]:hidden">
            <span className="inline-flex w-full items-center justify-between gap-2">
              <span>Nytt arbeidsområde</span>
              <ChevronRight className="text-muted-foreground size-4 shrink-0 transition-transform group-open:rotate-90" />
            </span>
          </summary>
          <div className="border-border/35 border-t px-4 pb-4 pt-2">{createBlock}</div>
        </details>
      ) : (
        <section className="border-border/40 rounded-xl border bg-muted/[0.08] p-4">
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
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2
            id="dash-workspaces-heading"
            className="text-foreground text-base font-semibold tracking-tight"
          >
            Arbeidsområder
            {workspaces.length > 0 ? (
              <span className="text-muted-foreground ml-2 text-sm font-normal tabular-nums">
                · {workspaces.length}
              </span>
            ) : null}
          </h2>
          {workspaces.length > 3 ? (
            <SearchInput
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Søk i navn …"
              aria-label="Filtrer arbeidsområder"
              className="w-full sm:max-w-xs sm:flex-none"
            />
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

        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {filteredWorkspaces.map(({ workspace, role }) => {
            const isOwner = role === "owner";
            const canManage = role === "owner" || role === "admin";
            const isDefault = defaultWorkspaceId === workspace._id;
            const isMenuOpen = menuOpenId === workspace._id;

            return (
              <div
                key={workspace._id}
                className={cn(
                  "group border-border/40 bg-card/80 relative cursor-pointer rounded-xl border p-4 transition-colors",
                  "hover:border-border/60",
                  isDefault && "border-primary/25 bg-primary/[0.03]",
                )}
              >
                <Link
                  href={`/w/${workspace._id}`}
                  className="absolute inset-0 z-[1] rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
