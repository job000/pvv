"use client";

import { RosWorkspace } from "@/components/ros/ros-workspace";
import type { Id } from "@/convex/_generated/dataModel";
import { Shield } from "lucide-react";
import { useParams } from "next/navigation";
import { Suspense } from "react";

function RosPageBody() {
  const params = useParams();
  const workspaceId = params.workspaceId as Id<"workspaces">;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 pb-16">
      <header className="relative overflow-hidden rounded-2xl border border-border/40 bg-card shadow-sm ring-1 ring-black/[0.03] dark:ring-white/[0.05]">
        <div className="from-primary/[0.06] pointer-events-none absolute inset-0 bg-gradient-to-br via-transparent to-transparent" />
        <div className="relative flex items-start gap-4 px-5 py-5 sm:px-6 sm:py-6">
          <div className="bg-primary/12 text-primary flex size-12 shrink-0 items-center justify-center rounded-2xl ring-1 ring-primary/15">
            <Shield className="size-6" aria-hidden />
          </div>
          <div className="min-w-0">
            <h1 className="font-heading text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              Risiko og sårbarhet
            </h1>
            <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-relaxed">
              Kartlegg, vurder og behandle risiko. ROS kan brukes alene — kobling
              til PVV eller prosess er valgfritt.
            </p>
          </div>
        </div>
      </header>
      <RosWorkspace workspaceId={workspaceId} />
    </div>
  );
}

export default function RosPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2">
          <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-muted-foreground text-sm">Laster …</p>
        </div>
      }
    >
      <RosPageBody />
    </Suspense>
  );
}
