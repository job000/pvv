"use client";

import { RosWorkspace } from "@/components/ros/ros-workspace";
import type { Id } from "@/convex/_generated/dataModel";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function RosPage() {
  const params = useParams();
  const workspaceId = params.workspaceId as Id<"workspaces">;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-10 pb-10">
      <header className="space-y-4 border-b border-border/60 pb-8">
        <h1 className="font-heading text-3xl font-semibold tracking-tight md:text-4xl">
          ROS — risiko og sårbarhet
        </h1>
        <p className="text-muted-foreground max-w-3xl text-base leading-relaxed">
          Verktøyet er laget for team som skal gjennomføre ROS i stor skala:{" "}
          <strong>felles maler</strong>,{" "}
          <strong>sporbarhet mot PVV</strong> og{" "}
          <strong>oversikt på tvers</strong> — uten dobbeltarbeid. Du legger
          risiko inn <strong>direkte i matrisen</strong> (hvert kryss), ikke i et
          eget skjema som må overføres. Bygg{" "}
          <strong>maler</strong> (akser og etiketter), opprett{" "}
          <strong>analyser</strong> med fargekodet matrise, og koble til{" "}
          <strong>PVV-vurderinger</strong> og{" "}
          <Link
            href={`/w/${workspaceId}/vurderinger?fane=prosesser`}
            className="text-primary font-medium underline-offset-4 hover:underline"
          >
            prosesskandidater
          </Link>
          . Under{" "}
          <Link
            href={`/w/${workspaceId}/ros/akser`}
            className="text-primary font-medium underline-offset-4 hover:underline"
          >
            ROS-akser
          </Link>{" "}
          vedlikeholder dere gjenbrukbare etikettlister.{" "}
          <strong>Oversikt</strong> summerer alle analyser; kontrollpanelet under
          viser hull i dekning, siste aktivitet og hurtigvalg.
        </p>
      </header>
      <RosWorkspace workspaceId={workspaceId} />
    </div>
  );
}
