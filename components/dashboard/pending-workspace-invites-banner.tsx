"use client";

import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "@/lib/app-toast";
import { formatUserFacingError } from "@/lib/user-facing-error";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import { Building2, Loader2, X } from "lucide-react";
import { useCallback, useState } from "react";

const ROLE_NB: Record<string, string> = {
  admin: "Administrator",
  member: "Medlem",
  viewer: "Visning",
};

export function PendingWorkspaceInvitesBanner({
  className,
}: {
  className?: string;
}) {
  const rows = useQuery(api.workspaces.listMyWorkspaceUserInvites, {});
  const accept = useMutation(api.workspaces.acceptWorkspaceUserInvite);
  const decline = useMutation(api.workspaces.declineWorkspaceUserInvite);
  const [busyId, setBusyId] = useState<Id<"workspaceUserInvites"> | null>(null);

  const onAccept = useCallback(
    async (inviteId: Id<"workspaceUserInvites">) => {
      setBusyId(inviteId);
      try {
        await accept({ inviteId });
        toast.success("Du er nå medlem av arbeidsområdet.");
      } catch (e) {
        toast.error(formatUserFacingError(e, "Kunne ikke godta."));
      } finally {
        setBusyId(null);
      }
    },
    [accept],
  );

  const onDecline = useCallback(
    async (inviteId: Id<"workspaceUserInvites">) => {
      setBusyId(inviteId);
      try {
        await decline({ inviteId });
        toast.success("Invitasjon avslått.");
      } catch (e) {
        toast.error(formatUserFacingError(e, "Kunne ikke avslå."));
      } finally {
        setBusyId(null);
      }
    },
    [decline],
  );

  if (rows === undefined || rows.length === 0) {
    return null;
  }

  return (
    <section
      aria-label="Ventende invitasjoner til arbeidsområder"
      className={cn("space-y-3", className)}
    >
      <h2 className="text-base font-semibold tracking-tight text-foreground">
        Invitasjoner
      </h2>
      <ul className="divide-y divide-border/40 overflow-hidden rounded-2xl border border-border/50 bg-card">
        {rows.map((row) => {
          const loading = busyId === row._id;
          return (
            <li
              key={row._id}
              className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"
            >
              <div className="flex min-w-0 items-center gap-4">
                <span
                  className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted"
                  aria-hidden
                >
                  <Building2 className="size-4 text-foreground" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-medium tracking-tight text-foreground">
                    {row.workspaceName}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {ROLE_NB[row.role] ?? row.role} · Invitert av {row.inviterName}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="h-10 rounded-full bg-foreground px-4 text-sm font-semibold text-background transition-opacity hover:opacity-90"
                  disabled={loading}
                  onClick={() => void onAccept(row._id)}
                >
                  {loading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    "Godta"
                  )}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-10 rounded-full px-4 text-sm text-muted-foreground hover:text-foreground"
                  disabled={loading}
                  onClick={() => void onDecline(row._id)}
                >
                  <X className="size-4" aria-hidden />
                  Avslå
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
