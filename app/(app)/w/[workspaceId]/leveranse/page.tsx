"use client";

import { LeveranseBoard } from "@/components/workspace/leveranse-board";
import type { Id } from "@/convex/_generated/dataModel";
import { useParams } from "next/navigation";

export default function WorkspaceLeveransePage() {
  const params = useParams();
  const workspaceId = params.workspaceId as Id<"workspaces">;

  return (
    <div className="space-y-10">
      <header className="max-w-3xl space-y-3">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Leveranse og prioritering
        </h1>
        <p className="text-muted-foreground text-base leading-relaxed">
          Se alle vurderinger i en RPA-pipeline med sprint og Kanban. Prioritet
          hentes fra vurderingsresultat; du kan justere manuelt når behovet
          endrer seg. Statusene speiler en typisk rask leveransemodell (kortere
          syklus enn klassisk utvikling).
        </p>
      </header>
      <LeveranseBoard workspaceId={workspaceId} />
    </div>
  );
}
