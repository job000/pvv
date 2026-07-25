"use client";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { rpaLifecycleHomeHref } from "@/lib/rpa-lifecycle";
import { useQuery } from "convex/react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo } from "react";

const WorkspaceAssessmentsPanel = dynamic(
  () =>
    import("./workspace-panels").then((mod) => ({
      default: mod.WorkspaceAssessmentsPanel,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[20vh] items-center justify-center">
        <div className="size-7 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
      </div>
    ),
  },
);

const WorkspaceCandidatesPanel = dynamic(
  () =>
    import("./workspace-panels").then((mod) => ({
      default: mod.WorkspaceCandidatesPanel,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[20vh] items-center justify-center">
        <div className="size-7 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
      </div>
    ),
  },
);

export type PvvHubTab = "vurderinger" | "prosesser";

type Props = {
  workspaceId: Id<"workspaces">;
  activeTab: PvvHubTab;
  initialOrgUnit?: Id<"orgUnits"> | null;
  initialEditCandidateId?: Id<"candidates"> | null;
  initialEditFullscreen?: boolean;
  /** Fra hjem: vis kun vurderinger uten ROS-kobling. */
  initialUtenRos?: boolean;
};

export function WorkspacePvvHub({
  workspaceId,
  activeTab,
  initialOrgUnit,
  initialEditCandidateId = null,
  initialEditFullscreen = false,
  initialUtenRos = false,
}: Props) {
  const router = useRouter();
  const orgUnits = useQuery(api.orgUnits.listByWorkspace, { workspaceId });

  /** Alltid abonnert — ikke bare når Prosessregister-fanen er aktiv (unngår tom liste ved bytte av fane). */
  const approvedIntakeForProcessregister = useQuery(
    api.intakeSubmissions.listApprovedForProcessregister,
    { workspaceId },
  );

  const activeOrgUnitName = useMemo(() => {
    if (!initialOrgUnit) return null;
    return orgUnits?.find((u) => u._id === initialOrgUnit)?.name ?? null;
  }, [initialOrgUnit, orgUnits]);
  const clearOrgFilter = useCallback(() => {
    const sp = new URLSearchParams();
    if (activeTab === "prosesser") sp.set("fane", "prosesser");
    if (initialUtenRos) sp.set("utenRos", "1");
    const q = sp.toString();
    router.replace(
      `/w/${workspaceId}/vurderinger${q ? `?${q}` : ""}`,
      { scroll: false },
    );
  }, [activeTab, initialUtenRos, router, workspaceId]);

  const clearUtenRosFilter = useCallback(() => {
    const sp = new URLSearchParams();
    if (activeTab === "prosesser") sp.set("fane", "prosesser");
    if (initialOrgUnit) sp.set("orgUnit", initialOrgUnit);
    const q = sp.toString();
    router.replace(
      `/w/${workspaceId}/vurderinger${q ? `?${q}` : ""}`,
      { scroll: false },
    );
  }, [activeTab, initialOrgUnit, router, workspaceId]);

  return (
    <div className="w-full min-w-0 space-y-8 pb-12 sm:space-y-10">
      <header className="min-w-0 space-y-2">
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground sm:text-[2rem]">
          {activeTab === "vurderinger" ? "Vurderinger" : "Prosesser"}
        </h1>
        <p className="max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
          {activeTab === "prosesser"
            ? "Registeret for alt som skal vurderes, sikres og designes."
            : initialUtenRos
              ? "Filtrert: vurderinger som mangler ROS-kobling. Åpne en sak for å koble ROS."
              : "Prioriter, følg status og åpne den neste vurderingen."}
        </p>
        <p className="text-muted-foreground text-xs">
          {activeTab === "prosesser"
            ? "Steg 1–3 · Identifisering til design"
            : "Steg 2 av 7 · Vurdering og prioritering"}
          {" · "}
          <Link
            href={rpaLifecycleHomeHref(workspaceId)}
            className="text-foreground font-medium underline-offset-2 hover:underline"
          >
            Se hele livssyklusen
          </Link>
        </p>
      </header>

      {initialOrgUnit || initialUtenRos ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {initialOrgUnit ? (
            <>
              <span className="text-muted-foreground">
                Filtrert på{" "}
                <span className="font-medium text-foreground">
                  {activeOrgUnitName ?? "valgt enhet"}
                </span>
              </span>
              <button
                type="button"
                onClick={clearOrgFilter}
                className="font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                Fjern enhetsfilter
              </button>
            </>
          ) : null}
          {initialUtenRos ? (
            <>
              <span className="rounded-full bg-foreground/10 px-2.5 py-1 text-xs font-medium text-foreground">
                Uten ROS
              </span>
              <button
                type="button"
                onClick={clearUtenRosFilter}
                className="font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                Vis alle
              </button>
            </>
          ) : null}
        </div>
      ) : null}

      <div className="min-h-0">
        {activeTab === "vurderinger" ? (
          <WorkspaceAssessmentsPanel
            workspaceId={workspaceId}
            hubMode
            approvedIntakeForProcessregister={approvedIntakeForProcessregister}
            initialOrgUnit={initialOrgUnit}
            initialUtenRos={initialUtenRos}
          />
        ) : (
          <WorkspaceCandidatesPanel
            workspaceId={workspaceId}
            hubMode
            approvedIntakeForProcessregister={approvedIntakeForProcessregister}
            initialOrgUnit={initialOrgUnit}
            initialEditCandidateId={initialEditCandidateId}
            initialEditFullscreen={initialEditFullscreen}
          />
        )}
      </div>
    </div>
  );
}
