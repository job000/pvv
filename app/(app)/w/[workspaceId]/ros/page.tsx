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
    <div className="mx-auto w-full max-w-7xl space-y-8 pb-12">
      <header className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-primary/[0.06] via-card to-card px-6 py-8 shadow-sm sm:px-8 sm:py-10">
        <div className="pointer-events-none absolute -right-8 -top-8 size-48 rounded-full bg-primary/[0.04] blur-2xl" />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-8">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 shadow-sm ring-1 ring-primary/20">
            <Shield className="size-7 text-primary" />
          </div>
          <div className="min-w-0 space-y-3">
            <div>
              <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
                Risiko og sårbarhet
              </h1>
              <p className="text-muted-foreground mt-1 text-sm">
                Risikoanalyse etter ISO 31000, koblet til vurderinger og prosesser
              </p>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-2">
                <span className="flex size-5 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">1</span>
                Lag eller velg mal
              </span>
              <span className="flex items-center gap-2">
                <span className="flex size-5 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">2</span>
                Fyll risikomatrise
              </span>
              <span className="flex items-center gap-2">
                <span className="flex size-5 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">3</span>
                Koble til vurdering og følg opp
              </span>
            </div>
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
