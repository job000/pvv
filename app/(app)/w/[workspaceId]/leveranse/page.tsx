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
          Her ser du alle vurderinger i arbeidsområdet som en pipeline: sprint,
          tavle eller liste, søk og filtre (inkl. ROS). Innstillingene lagres{" "}
          <span className="text-foreground font-medium">per bruker</span> i
          dette arbeidsområdet, så teamet kan jobbe med ulike visninger uten å
          overskrive hverandre. Prioritet (P1–P5) bygger på vurderingsscore; du
          kan justere manuelt når behovet endrer seg — også når prosjekter er
          eldre eller flyttes mellom leveransemodeller.
        </p>
        <p className="text-muted-foreground text-base leading-relaxed">
          <Link
            href={`/w/${wid}/vurderinger`}
            className="text-primary font-medium underline-offset-4 hover:underline"
          >
            Vurderinger
          </Link>{" "}
          er kilden til pipeline-kortene;{" "}
          <Link
            href={`/w/${wid}/ros`}
            className="text-primary font-medium underline-offset-4 hover:underline"
          >
            ROS
          </Link>{" "}
          gir risiko- og sikkerhetsstatus som du kan filtrere på her. Samme
          arbeidsflate dekker nye initiativer og eksisterende PVV-leveranser så
          lenge de er knyttet til vurderinger i dette området.
        </p>
      </header>
      <LeveranseBoard workspaceId={workspaceId} />
    </div>
  );
}
