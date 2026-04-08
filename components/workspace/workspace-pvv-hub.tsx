"use client";

import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import type { Id } from "@/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { ClipboardList, FileText, Users } from "lucide-react";
import Link from "next/link";
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

  /** Alltid abonnert — ikke bare når Prosessregister-fanen er aktiv (unngår tom liste ved bytte av fane). */
  const approvedIntakeForProcessregister = useQuery(
    api.intakeSubmissions.listApprovedForProcessregister,
    { workspaceId },
  );

  const setTab = useCallback(
    (next: PvvHubTab) => {
      const q = next === "prosesser" ? "?fane=prosesser" : "";
      router.replace(`/w/${workspaceId}/vurderinger${q}`, { scroll: false });
    },
    [router, workspaceId],
  );

  return (
    <div className="space-y-6 pb-6">
      <header className="border-border/40 border-b pb-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            <h1 className="font-heading text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              {activeTab === "vurderinger" ? "Vurderinger" : "Prosesser"}
            </h1>
            {activeTab === "prosesser" ? (
              <p className="text-muted-foreground max-w-lg text-sm leading-relaxed">
                Registrer prosess-ID-er, importer fra GitHub og se dekning mot vurderinger og ROS.
              </p>
            ) : (
              <p className="text-muted-foreground max-w-lg text-sm leading-relaxed">
                Gå gjennom veiviseren for hver prosess — poengsum og prioritering oppdateres når du lagrer.
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2.5 sm:items-end">
            <div
              className="flex w-full shrink-0 gap-1 rounded-xl border border-border/40 bg-muted/30 p-1 sm:w-auto sm:min-w-0"
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
                  "flex h-11 min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors sm:h-9 sm:min-h-0 sm:flex-initial sm:px-4",
                  activeTab === "vurderinger"
                    ? "bg-background text-foreground shadow-sm ring-1 ring-border/50"
                    : "text-muted-foreground hover:text-foreground",
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
                  "flex h-11 min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors sm:h-9 sm:min-h-0 sm:flex-initial sm:px-4",
                  activeTab === "prosesser"
                    ? "bg-background text-foreground shadow-sm ring-1 ring-border/50"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Users className="size-4 shrink-0 opacity-80" aria-hidden />
                Prosesser
              </button>
            </div>
            <Link
              href={`/w/${workspaceId}/skjemaer`}
              title="Skjemaer og innsending (intake)"
              className="text-muted-foreground hover:text-foreground inline-flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-medium transition-colors hover:bg-muted/40 sm:h-9"
            >
              <FileText className="size-4 shrink-0 opacity-80" aria-hidden />
              Skjemaer
            </Link>
          </div>
        </div>
      </header>

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
          <WorkspaceAssessmentsPanel
            workspaceId={workspaceId}
            hubMode
            approvedIntakeForProcessregister={approvedIntakeForProcessregister}
          />
        ) : (
          <WorkspaceCandidatesPanel
            workspaceId={workspaceId}
            hubMode
            approvedIntakeForProcessregister={approvedIntakeForProcessregister}
          />
        )}
      </div>
    </div>
  );
}
