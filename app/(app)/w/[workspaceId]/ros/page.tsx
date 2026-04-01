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
    <div className="mx-auto w-full max-w-7xl space-y-8 pb-16">
      <header className="relative overflow-hidden rounded-3xl border border-border/40 bg-card px-5 py-7 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-4px_rgba(0,0,0,0.06)] ring-1 ring-black/[0.03] dark:bg-card/95 dark:shadow-[0_1px_0_rgba(255,255,255,0.06)_inset] dark:ring-white/[0.06] sm:px-8 sm:py-8">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.45] dark:opacity-[0.25]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, oklch(0.55 0 0 / 0.08) 1px, transparent 0)`,
            backgroundSize: "24px 24px",
          }}
          aria-hidden
        />
        <div className="pointer-events-none absolute -right-24 -top-20 h-72 w-72 rounded-full bg-gradient-to-br from-primary/[0.12] via-primary/[0.04] to-transparent blur-3xl dark:from-primary/[0.18]" aria-hidden />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-8">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 shadow-inner ring-1 ring-primary/15">
            <Shield className="size-7 text-primary" strokeWidth={1.5} aria-hidden />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-muted-foreground text-[11px] font-semibold uppercase tracking-[0.14em]">
              ROS
            </p>
            <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Risiko og sårbarhet
            </h1>
            <p className="text-muted-foreground mt-2 max-w-2xl text-[15px] leading-relaxed sm:text-base">
              ISO 31000-inspirert arbeidsflyt. Risiko kan dokumenteres her uten å koble til PVV
              eller prosess — det er valgfritt. Bruk stegene under for mal, analyser,
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
