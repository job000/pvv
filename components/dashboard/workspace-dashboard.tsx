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
import { Settings, Trash2 } from "lucide-react";
import { formatUserFacingError } from "@/lib/user-facing-error";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

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
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {workspaces.map(({ workspace, role }) => {
          const isOwner = role === "owner";
          const canManage = role === "owner" || role === "admin";
          return (
            <Card key={workspace._id} className="flex flex-col">
              <CardHeader>
                <CardTitle className="text-lg">{workspace.name}</CardTitle>
                <CardDescription>Rolle: {role}</CardDescription>
              </CardHeader>
              <CardFooter className="mt-auto flex flex-col gap-2">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Link
                    href={`/w/${workspace._id}`}
                    className="inline-flex h-9 flex-1 items-center justify-center rounded-lg bg-primary px-3 text-primary-foreground text-sm font-medium transition hover:bg-primary/90"
                  >
                    Åpne
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
                    {defaultWorkspaceId === workspace._id
                      ? "Fjern som standard"
                      : "Bruk som standard"}
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

        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-lg">Nytt arbeidsområde</CardTitle>
            <CardDescription>
              Opprett flere områder for ulike team eller prosjekter. Du kan
              endre navn og notater under Innstillinger etterpå.
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
              variant="outline"
              className="w-full"
              disabled={creating}
              onClick={() => void handleCreate()}
            >
              {creating ? "Oppretter …" : "Opprett"}
            </Button>
          </CardFooter>
        </Card>
      </div>

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
