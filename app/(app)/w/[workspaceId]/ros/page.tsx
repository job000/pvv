"use client";

import { RosWorkspace } from "@/components/ros/ros-workspace";
import type { Id } from "@/convex/_generated/dataModel";
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
          <strong className="text-foreground">Kort fortalt:</strong> mal → analyse
          med matrise → koble PVV. Risiko settes i{" "}
          <strong className="text-foreground">cellene</strong> (ikke eget skjema ved
          siden av). Under finner du maler, analyser og oversikt; utvid{" "}
          <span className="text-foreground font-medium">
            Metode og retningslinjer
          </span>{" "}
          når du trenger ISO, personvern og kobling mot PVV i detalj.
        </p>
      </header>
      <RosWorkspace workspaceId={workspaceId} />
    </div>
  );
}
