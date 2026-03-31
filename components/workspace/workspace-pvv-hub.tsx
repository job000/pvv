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
    <div className="space-y-4 pb-2">
      <section className="border-border/60 bg-card/80 rounded-2xl border p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide">
                <Sparkles className="text-primary size-3.5" aria-hidden />
                PVV-hub
              </span>
            </div>
            <h1 className="font-heading text-xl font-semibold tracking-tight sm:text-2xl">
              Prosesser og vurderinger
            </h1>
            <p className="text-muted-foreground text-sm leading-snug">
              <strong className="text-foreground">Prosesser</strong> er
              registeret.{" "}
              <strong className="text-foreground">Vurderinger</strong> er saker
              med skjema og status — koble dem i veiviseren.
            </p>
            <details className="group text-sm">
              <summary className="text-primary cursor-pointer list-none font-medium marker:hidden [&::-webkit-details-marker]:hidden">
                Mer om rekkefølge
              </summary>
              <div className="text-muted-foreground mt-2 max-w-prose space-y-1.5 text-xs leading-relaxed">
                <p>
                  Registrer prosesser først hvis dere vil velge fra
                  prosessregisteret. Én prosess kan ha flere vurderinger over tid.
                </p>
                <p className="flex flex-wrap items-center gap-1">
                  <GitBranch className="size-3.5 shrink-0 opacity-70" aria-hidden />
                  Anbefalt: prosess → vurdering → koble referanse i steg 1.
                  <ArrowRight className="size-3 opacity-40" aria-hidden />
                </p>
              </div>
            </details>
          </div>
          <div
            className="bg-muted/60 flex w-full shrink-0 rounded-xl p-1 ring-1 ring-border/50 lg:w-auto lg:min-w-[min(100%,20rem)]"
            role="tablist"
            aria-label="Vis vurderinger eller prosesser"
          >
            <button
              id="tab-vurderinger"
              type="button"
              role="tab"
              aria-selected={activeTab === "vurderinger"}
              onClick={() => setTab("vurderinger")}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors sm:flex-initial sm:px-4",
                activeTab === "vurderinger"
                  ? "bg-background text-foreground shadow-sm ring-1 ring-border/40"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <ClipboardList className="size-4 opacity-80" aria-hidden />
              Vurderinger
            </button>
            <button
              id="tab-prosesser"
              type="button"
              role="tab"
              aria-selected={activeTab === "prosesser"}
              onClick={() => setTab("prosesser")}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors sm:flex-initial sm:px-4",
                activeTab === "prosesser"
                  ? "bg-background text-foreground shadow-sm ring-1 ring-border/40"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Users className="size-4 opacity-80" aria-hidden />
              Prosesser
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
