"use client";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WorkspaceDeleteDialog } from "@/components/workspace/workspace-delete-dialog";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { formatUserFacingError } from "@/lib/user-facing-error";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  FolderOpen,
  Plus,
  Settings,
  Sparkles,
  Star,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type WorkspaceRow = {
  workspace: Doc<"workspaces">;
  role: "owner" | "admin" | "member" | "viewer";
};

const ROLE_LABELS: Record<WorkspaceRow["role"], string> = {
  owner: "Eier",
  admin: "Administrator",
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
      <section
        className="space-y-5"
        aria-labelledby="dash-workspaces-heading"
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2
              id="dash-workspaces-heading"
              className="font-heading text-xl font-semibold tracking-tight sm:text-2xl"
            >
              Dine arbeidsområder
            </h2>
            <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-relaxed">
              Alt arbeid skjer på tvers av områder — åpne et eksisterende eller
              opprett et nytt for team eller prosjekt.
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {workspaces.map(({ workspace, role }) => {
            const isOwner = role === "owner";
            const canManage = role === "owner" || role === "admin";
            const isDefault = defaultWorkspaceId === workspace._id;
            return (
              <Card
                key={workspace._id}
                className={cn(
                  "group relative flex flex-col overflow-hidden border-border/80 bg-card/80 shadow-sm backdrop-blur-sm transition-all duration-300 motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-lg",
                  isDefault &&
                    "ring-primary/25 border-primary/30 bg-gradient-to-br from-primary/[0.06] to-transparent ring-1",
                )}
              >
                <div
                  className={cn(
                    "h-1 w-full bg-gradient-to-r from-primary/80 via-teal-500/70 to-sky-500/40 opacity-90 transition-opacity group-hover:opacity-100",
                    isDefault && "from-primary to-teal-600",
                  )}
                  aria-hidden
                />
                <CardHeader className="space-y-3 pb-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="bg-primary/10 text-primary flex size-11 shrink-0 items-center justify-center rounded-xl">
                      <FolderOpen className="size-5" aria-hidden />
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      {isDefault ? (
                        <span className="bg-primary/15 text-primary inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide">
                          <Star className="size-3 fill-current" aria-hidden />
                          Standard
                        </span>
                      ) : null}
                      <span className="text-muted-foreground rounded-full border border-border/80 bg-muted/40 px-2 py-0.5 text-[11px] font-medium">
                        {ROLE_LABELS[role]}
                      </span>
                    </div>
                  </div>
                  <CardTitle className="font-heading text-lg leading-tight">
                    {workspace.name}
                  </CardTitle>
                  <CardDescription className="text-base leading-snug">
                    {canManage
                      ? "Administrer innstillinger, innstill standard og inviter team."
                      : "Du har tilgang til vurderinger og innhold i dette området."}
                  </CardDescription>
                </CardHeader>
                <CardFooter className="mt-auto flex flex-col gap-2 border-t border-border/50 bg-muted/20 pt-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Link
                      href={`/w/${workspace._id}`}
                      className={cn(
                        buttonVariants({ size: "sm" }),
                        "group/btn flex-1 gap-1.5 font-semibold shadow-sm",
                      )}
                    >
                      Åpne
                      <ArrowRight
                        className="size-4 transition-transform group-hover/btn:translate-x-0.5"
                        aria-hidden
                      />
                    </Link>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="whitespace-nowrap"
                      onClick={() =>
                        void setDefaultWorkspace({
                          workspaceId:
                            defaultWorkspaceId === workspace._id
                              ? null
                              : (workspace._id as Id<"workspaces">),
                        })
                      }
                    >
                      {isDefault ? "Fjern som standard" : "Bruk som standard"}
                    </Button>
                  </div>
                  {canManage ? (
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/w/${workspace._id}/innstillinger`}
                        className={cn(
                          buttonVariants({ variant: "secondary", size: "sm" }),
                          "gap-1.5",
                        )}
                      >
                        <Settings className="size-4" aria-hidden />
                        Innstillinger
                      </Link>
                      {isOwner ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:text-destructive gap-1.5"
                          onClick={() => setDeleteTarget(workspace)}
                        >
                          <Trash2 className="size-4" aria-hidden />
                          Slett
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </CardFooter>
              </Card>
            );
          })}

          <Card className="border-dashed border-primary/25 bg-muted/10 transition-colors hover:bg-muted/20">
            <CardHeader>
              <div className="bg-muted text-muted-foreground mb-2 inline-flex size-11 items-center justify-center rounded-xl">
                <Sparkles className="size-5" aria-hidden />
              </div>
              <CardTitle className="font-heading text-lg">Nytt arbeidsområde</CardTitle>
              <CardDescription>
                Flere områder for ulike team eller prosjekter. Navn og notater
                endrer du under Innstillinger.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="new-ws-name">Navn</Label>
                <Input
                  id="new-ws-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="F.eks. Digitalisering Vest"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void handleCreate();
                  }}
                />
              </div>
              {createError ? (
                <p className="text-destructive text-sm" role="alert">
                  {createError}
                </p>
              ) : null}
            </CardContent>
            <CardFooter>
              <Button
                type="button"
                className="w-full gap-2 font-semibold"
                disabled={creating}
                onClick={() => void handleCreate()}
              >
                {creating ? (
                  "Oppretter …"
                ) : (
                  <>
                    <Plus className="size-4" aria-hidden />
                    Opprett arbeidsområde
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
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
