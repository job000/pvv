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
      className={cn(
        "border-border/60 bg-card space-y-3 rounded-2xl border p-4 shadow-sm sm:p-5",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <Building2 className="text-primary size-5 shrink-0" aria-hidden />
        <h2 className="font-heading text-base font-semibold tracking-tight">
          Invitasjoner til arbeidsområder
        </h2>
      </div>
      <p className="text-muted-foreground text-sm leading-relaxed">
        Noen har invitert deg inn. Godta hvis du vil bli med, eller avslå hvis du ikke ønsker
        tilgang.
      </p>
      <ul className="space-y-3">
        {rows.map((row) => {
          const loading = busyId === row._id;
          return (
            <li
              key={row._id}
              className="border-border/50 flex flex-col gap-3 rounded-xl border bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="font-medium">{row.workspaceName}</p>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  Rolle: {ROLE_NB[row.role] ?? row.role} · Fra {row.inviterName}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="rounded-xl"
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
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                  disabled={loading}
                  onClick={() => void onDecline(row._id)}
                >
                  <X className="size-4" />
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
