"use client";

import { RosWorkspace } from "@/components/ros/ros-workspace";
import type { Id } from "@/convex/_generated/dataModel";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function RosPage() {
  const params = useParams();
  const workspaceId = params.workspaceId as Id<"workspaces">;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-10 pb-10">
      <header className="space-y-4 border-b border-border/60 pb-8">
        <h1 className="font-heading text-3xl font-semibold tracking-tight md:text-4xl">
          ROS — risiko og sårbarhet
        </h1>
        <p className="text-muted-foreground max-w-2xl text-base leading-relaxed">
          Vurderingspunktene er <strong>hvert kryss i matrisen</strong> (rader ×
          kolonner fra malen) — se boksen «Slik fungerer ROS» under. Bygg{" "}
          <strong>maler</strong> (akser og etiketter), opprett{" "}
          <strong>analyser</strong> med fargekodet matrise, og koble til{" "}
          <strong>PVV-vurderinger</strong> og{" "}
          <Link
            href={`/w/${workspaceId}/vurderinger?fane=prosesser`}
            className="text-primary font-medium underline-offset-4 hover:underline"
          >
            prosesskandidater
          </Link>{" "}
          fra samme arbeidsområde — slik følger dere én rød tråd fra vurdering
          til risiko. Fanen <strong>Oversikt</strong> viser søylediagram,
          nøkkeltall og sammenligning på tvers av alle analyser.
        </p>
      </header>
      <RosWorkspace workspaceId={workspaceId} />
    </div>
  );
}
