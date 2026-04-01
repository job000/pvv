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
    <div className="mx-auto w-full max-w-7xl space-y-6 pb-12">
      <header className="relative overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-br from-card via-card to-primary/[0.03] px-4 py-5 shadow-sm ring-1 ring-border/40 sm:px-6 sm:py-6">
        <div className="pointer-events-none absolute -right-16 -top-px h-40 w-40 rounded-full bg-primary/[0.07] blur-3xl" aria-hidden />
        <div className="relative flex items-start gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/12 ring-1 ring-primary/20">
            <Shield className="size-6 text-primary" aria-hidden />
          </div>
          <div className="min-w-0">
            <h1 className="font-heading text-xl font-semibold tracking-tight sm:text-2xl">
              Risiko og sårbarhet
            </h1>
            <p className="text-muted-foreground mt-1.5 max-w-2xl text-sm leading-relaxed sm:text-[15px]">
              ROS etter ISO 31000. Du kan jobbe med risiko her uten å koble til PVV
              eller prosess — det er valgfritt. Bruk fanene for mal, analyser,
              oversikt og bibliotek.
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
