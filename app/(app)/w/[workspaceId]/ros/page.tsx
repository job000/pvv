"use client";

import { RosWorkspace } from "@/components/ros/ros-workspace";
import type { Id } from "@/convex/_generated/dataModel";
import { useParams } from "next/navigation";

export default function RosPage() {
  const params = useParams();
  const workspaceId = params.workspaceId as Id<"workspaces">;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-10 pb-10">
      <header className="space-y-2 border-b border-border/60 pb-8">
        <h1 className="font-heading text-3xl font-semibold tracking-tight md:text-4xl">
          ROS — risiko og sårbarhet
        </h1>
        <p className="text-muted-foreground max-w-2xl text-base leading-relaxed">
          Gjenbrukbare <strong>maler</strong> med sannsynlighets- og
          konsekvensakser, og <strong>analyser</strong> du fyller ut celle for
          celle. Koble hver analyse til en <strong>kandidat</strong> (prosess) og
          valgfritt til en <strong>PVV-vurdering</strong> med samme referansekode.
        </p>
      </header>
      <RosWorkspace workspaceId={workspaceId} />
    </div>
  );
}
