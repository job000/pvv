"use client";

import { LeveranseBoard } from "@/components/workspace/leveranse-board";
import type { Id } from "@/convex/_generated/dataModel";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function WorkspaceLeveransePage() {
  const params = useParams();
  const workspaceId = params.workspaceId as Id<"workspaces">;
  const wid = String(workspaceId);

  return (
    <div className="space-y-10">
      <header className="max-w-3xl space-y-4">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Leveranse og prioritering
        </h1>
        <p className="text-muted-foreground text-base leading-relaxed">
          Alle <strong className="text-foreground font-medium">vurderinger</strong>{" "}
          i arbeidsområdet vises som kort: sprint, tavle eller liste, med søk og
          filtre (også på ROS-status). Visning og sortering lagres{" "}
          <span className="text-foreground font-medium">per bruker</span>, så
          dere kan jobbe parallelt uten å overskrive hverandre. Prioritet (P1–P5)
          hentes fra vurderingsscore og kan justeres manuelt.
        </p>
        <p className="text-muted-foreground text-base leading-relaxed">
          Kortene kommer fra{" "}
          <Link
            href={`/w/${wid}/vurderinger`}
            className="text-primary font-medium underline-offset-4 hover:underline"
          >
            vurderingene
          </Link>
          ;{" "}
          <Link
            href={`/w/${wid}/ros`}
            className="text-primary font-medium underline-offset-4 hover:underline"
          >
            ROS
          </Link>{" "}
          viser risiko- og sikkerhetsstatus du kan filtrere på. Alt som ligger i
          dette arbeidsområdet — nye og pågående saker — samles her.
        </p>
      </header>
      <LeveranseBoard workspaceId={workspaceId} />
    </div>
  );
}
