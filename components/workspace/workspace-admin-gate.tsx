"use client";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Viser innhold kun for eier/admin. Andre medlemmer får en kort forklaring.
 */
export function WorkspaceAdminGate({
  workspaceId,
  children,
  title = "Kun for administratorer",
}: {
  workspaceId: Id<"workspaces">;
  children: ReactNode;
  title?: string;
}) {
  const membership = useQuery(api.workspaces.getMyMembership, { workspaceId });

  if (membership === undefined) {
    return <p className="text-muted-foreground text-sm">Laster …</p>;
  }

  const isAdmin =
    membership?.role === "owner" || membership?.role === "admin";

  if (!isAdmin) {
    return (
      <div className="rounded-2xl border border-border/50 bg-card px-4 py-6 sm:px-5">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-muted-foreground mt-1 max-w-lg text-sm leading-relaxed">
          Du ser denne siden fordi du åpnet en direkte lenke. Kontakt en
          administrator i området hvis du trenger tilgang.
        </p>
        <Link
          href={`/w/${workspaceId}`}
          className="text-foreground mt-4 inline-flex text-sm font-medium underline-offset-2 hover:underline"
        >
          Tilbake til Oversikt
        </Link>
      </div>
    );
  }

  return children;
}
