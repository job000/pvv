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
    <div className="space-y-8 pb-4">
      <section className="relative overflow-hidden rounded-3xl border border-border/50 bg-gradient-to-br from-primary/[0.06] via-card to-emerald-500/[0.04] p-6 shadow-sm sm:p-8">
        <div
          className="pointer-events-none absolute -right-20 -top-20 size-64 rounded-full bg-primary/[0.07] blur-3xl"
          aria-hidden
        />
        <div className="relative space-y-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/70 px-3 py-1 text-[11px] font-medium text-muted-foreground shadow-sm backdrop-blur-sm">
            <Sparkles className="size-3.5 text-primary" aria-hidden />
            Samme arbeidsflyt — to roller
          </div>
          <div className="space-y-3">
            <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl md:text-4xl">
              Prosesser og PVV-vurderinger
            </h1>
            <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed sm:text-base">
              Dette er <strong className="text-foreground">ikke</strong> to
              tilfeldige lister.{" "}
              <strong className="text-foreground">Prosess</strong> (tidligere
              «kandidat») er <em>stamdata</em> — et navn alle forstår, pluss en{" "}
              <strong>prosess-ID</strong> som er den faste referansen i PVV og ROS
              (f.eks. «Fakturamottak» +{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                FAKT-01
              </code>
              ).{" "}
              <strong className="text-foreground">PVV-vurdering</strong> er{" "}
              <em>selve saken</em> der dere fyller ut skjema, beregninger og
              dokumentasjon — én eller flere vurderinger kan peke på samme
              prosess.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex gap-3 rounded-2xl border border-border/60 bg-background/80 p-4 shadow-sm backdrop-blur-sm">
              <div className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl">
                <Users className="size-5" aria-hidden />
              </div>
              <div className="min-w-0 space-y-1">
                <p className="text-foreground text-sm font-semibold">
                  Prosesser
                </p>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  Brukes når dere vil skille <strong>hvilken</strong> drift/prosess
                  dere vurderer — med samme ID på tvers av avdelinger i HF.
                  Kobles til PVV, ROS og rapporter.
                </p>
              </div>
            </div>
            <div className="flex gap-3 rounded-2xl border border-border/60 bg-background/80 p-4 shadow-sm backdrop-blur-sm">
              <div className="bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 flex size-10 shrink-0 items-center justify-center rounded-xl">
                <ClipboardList className="size-5" aria-hidden />
              </div>
              <div className="min-w-0 space-y-1">
                <p className="text-foreground text-sm font-semibold">
                  PVV-vurderinger
                </p>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  Konkrete saker med status, tall og leveranse. Kobles til en
                  prosess i veiviseren (utkast) når dere velger referansekode.
                </p>
              </div>
            </div>
          </div>

          <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
            <GitBranch className="size-3.5 shrink-0" aria-hidden />
            <span>
              Anbefalt rekkefølge: registrer prosesser → start vurdering → koble
              i skjema.
            </span>
            <ArrowRight className="size-3.5 opacity-50" aria-hidden />
          </div>
        </div>
      </section>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground text-sm font-medium">
          Velg hva du vil jobbe med:
        </p>
        <div
          className="bg-muted/50 inline-flex w-full max-w-md rounded-2xl p-1 ring-1 ring-border/60 sm:w-auto sm:max-w-none"
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
              "flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all sm:flex-initial sm:px-5",
              activeTab === "vurderinger"
                ? "bg-card text-foreground shadow-md ring-1 ring-border/50"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <ClipboardList className="size-4 opacity-80" aria-hidden />
            PVV-vurderinger
          </button>
          <button
            id="tab-prosesser"
            type="button"
            role="tab"
            aria-selected={activeTab === "prosesser"}
            onClick={() => setTab("prosesser")}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all sm:flex-initial sm:px-5",
              activeTab === "prosesser"
                ? "bg-card text-foreground shadow-md ring-1 ring-border/50"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Users className="size-4 opacity-80" aria-hidden />
            Prosesser
          </button>
        </div>
      </div>

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
        className="min-h-[12rem]"
      >
        {activeTab === "vurderinger" ? (
          <WorkspaceAssessmentsPanel
            workspaceId={workspaceId}
            hubMode
          />
        ) : (
          <WorkspaceCandidatesPanel workspaceId={workspaceId} hubMode />
        )}
      </div>
    </div>
  );
}
