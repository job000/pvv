"use client";

import { cn } from "@/lib/utils";
import type { Id } from "@/convex/_generated/dataModel";
import {
  ArrowRight,
  ClipboardList,
  GitBranch,
  Sparkles,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback } from "react";

import {
  WorkspaceAssessmentsPanel,
  WorkspaceCandidatesPanel,
} from "./workspace-panels";

export type PvvHubTab = "vurderinger" | "prosesser";

type Props = {
  workspaceId: Id<"workspaces">;
  activeTab: PvvHubTab;
};

export function WorkspacePvvHub({ workspaceId, activeTab }: Props) {
  const router = useRouter();

  const setTab = useCallback(
    (next: PvvHubTab) => {
      const q = next === "prosesser" ? "?fane=prosesser" : "";
      router.replace(`/w/${workspaceId}/vurderinger${q}`, { scroll: false });
    },
    [router, workspaceId],
  );

  return (
    <div className="space-y-6 pb-4">
      <section className="relative overflow-hidden rounded-3xl border border-border/40 bg-card px-5 py-7 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-4px_rgba(0,0,0,0.06)] ring-1 ring-black/[0.03] dark:bg-card/95 dark:shadow-[0_1px_0_rgba(255,255,255,0.06)_inset] dark:ring-white/[0.06] sm:px-8 sm:py-8">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.45] dark:opacity-[0.25]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, oklch(0.55 0 0 / 0.08) 1px, transparent 0)`,
            backgroundSize: "24px 24px",
          }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -right-24 -top-20 h-72 w-72 rounded-full bg-gradient-to-br from-primary/[0.12] via-primary/[0.04] to-transparent blur-3xl dark:from-primary/[0.18]"
          aria-hidden
        />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-muted-foreground text-[11px] font-semibold uppercase tracking-[0.14em]">
              PVV
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em]">
                <Sparkles className="text-primary size-3.5" aria-hidden />
                Arbeidsflate
              </span>
            </div>
            <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Vurderinger og prosessregister
            </h1>
            <p className="text-muted-foreground max-w-prose text-[15px] leading-relaxed sm:text-base">
              <strong className="text-foreground font-medium">Prosessregisteret</strong> er
              listen over prosesser med ID.{" "}
              <strong className="text-foreground font-medium">En vurdering</strong> er én
              RPA-sak med skjema, prioritet og pipeline-status — uavhengig av ROS.
            </p>
            <details className="group text-sm">
              <summary className="cursor-pointer list-none font-medium text-primary marker:hidden [&::-webkit-details-marker]:hidden">
                Anbefalt rekkefølge
              </summary>
              <div className="text-muted-foreground mt-2 max-w-prose space-y-1.5 text-xs leading-relaxed">
                <p>
                  Legg inn prosesser i registeret først hvis dere vil hente
                  prosess-ID i veiviseren. Samme prosess kan brukes i flere
                  vurderinger over tid.
                </p>
                <p className="flex flex-wrap items-center gap-1">
                  <GitBranch className="size-3.5 shrink-0 opacity-70" aria-hidden />
                  Vanlig flyt: prosess → ny vurdering → velg prosess i steg 1.
                  <ArrowRight className="size-3 opacity-40" aria-hidden />
                </p>
              </div>
            </details>
          </div>
          <div
            className="flex w-full shrink-0 gap-0.5 rounded-2xl border border-border/50 bg-muted/40 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-sm dark:bg-muted/25 lg:w-auto lg:min-w-[min(100%,20rem)]"
            role="tablist"
            aria-label="Vis vurderinger eller prosessregister"
          >
            <button
              id="tab-vurderinger"
              type="button"
              role="tab"
              aria-selected={activeTab === "vurderinger"}
              onClick={() => setTab("vurderinger")}
              className={cn(
                "flex h-11 min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg px-3 text-[13px] font-medium transition-[color,box-shadow] duration-200 sm:h-10 sm:min-h-0 sm:flex-initial sm:px-4",
                activeTab === "vurderinger"
                  ? "bg-card text-foreground shadow-[0_1px_3px_rgba(0,0,0,0.08)] ring-1 ring-black/[0.06] dark:shadow-[0_1px_3px_rgba(0,0,0,0.35)] dark:ring-white/[0.08]"
                  : "text-muted-foreground hover:bg-card/60 hover:text-foreground",
              )}
            >
              <ClipboardList className="size-4 shrink-0 opacity-80" aria-hidden />
              Vurderinger
            </button>
            <button
              id="tab-prosesser"
              type="button"
              role="tab"
              aria-selected={activeTab === "prosesser"}
              onClick={() => setTab("prosesser")}
              className={cn(
                "flex h-11 min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg px-3 text-[13px] font-medium transition-[color,box-shadow] duration-200 sm:h-10 sm:min-h-0 sm:flex-initial sm:px-4",
                activeTab === "prosesser"
                  ? "bg-card text-foreground shadow-[0_1px_3px_rgba(0,0,0,0.08)] ring-1 ring-black/[0.06] dark:shadow-[0_1px_3px_rgba(0,0,0,0.35)] dark:ring-white/[0.08]"
                  : "text-muted-foreground hover:bg-card/60 hover:text-foreground",
              )}
            >
              <Users className="size-4 shrink-0 opacity-80" aria-hidden />
              Prosessregister
            </button>
          </div>
        </div>
      </section>

      <div
        role="tabpanel"
        id={
          activeTab === "vurderinger"
            ? "panel-vurderinger"
            : "panel-prosesser"
        }
        aria-labelledby={
          activeTab === "vurderinger" ? "tab-vurderinger" : "tab-prosesser"
        }
        className="min-h-0"
      >
        {activeTab === "vurderinger" ? (
          <WorkspaceAssessmentsPanel workspaceId={workspaceId} hubMode />
        ) : (
          <WorkspaceCandidatesPanel workspaceId={workspaceId} hubMode />
        )}
      </div>
    </div>
  );
}
