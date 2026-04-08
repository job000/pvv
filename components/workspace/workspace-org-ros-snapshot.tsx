"use client";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { Building2, ChevronRight } from "lucide-react";
import Link from "next/link";

/**
 * Dashboard-kort som lenker til organisasjonssiden med ROS-oversikt i treet.
 */
export function WorkspaceOrgRosCtaCard({
  workspaceId,
}: {
  workspaceId: Id<"workspaces">;
}) {
  const orgUnits = useQuery(api.orgUnits.listByWorkspace, { workspaceId });

  if (orgUnits === undefined) {
    return (
      <div
        className="h-[7.5rem] animate-pulse rounded-2xl bg-muted/40 ring-1 ring-border/40"
        aria-hidden
      />
    );
  }

  const href = `/w/${workspaceId}/organisasjon`;

  return (
    <Link
      href={href}
      className="group flex flex-col gap-3 rounded-2xl border border-border/60 bg-gradient-to-br from-muted/20 via-card to-card p-4 shadow-sm ring-1 ring-black/[0.04] transition-all hover:-translate-y-0.5 hover:shadow-md dark:from-muted/10 dark:ring-white/[0.06]"
    >
      <div className="flex items-start gap-3">
        <div className="bg-primary/10 text-primary flex size-11 shrink-0 items-center justify-center rounded-xl ring-1 ring-primary/15">
          <Building2 className="size-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-heading font-semibold leading-snug">Organisasjonstre og ROS</p>
          <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
            {orgUnits.length === 0
              ? "Opprett enheter og knytt prosesser til dem for å se risiko- og konsekvensoversikt (ROS) hierarkisk i treet."
              : `Kartet har ${orgUnits.length} enhet${orgUnits.length === 1 ? "" : "er"}. Hver gren viser sammendrag av ROS knyttet til prosesser i den delen av organisasjonen (inkl. underenheter).`}
          </p>
        </div>
        <ChevronRight
          className="text-muted-foreground size-5 shrink-0 transition-transform group-hover:translate-x-0.5"
          aria-hidden
        />
      </div>
      <span className="text-primary text-sm font-semibold group-hover:underline">
        Åpne organisasjonskart
      </span>
    </Link>
  );
}
