"use client";

import { ProductEmptyState, ProductLoadingBlock, ProductPageHeader } from "@/components/product";
import { WorkspaceOrgRosCtaCard } from "@/components/workspace/workspace-org-ros-snapshot";
import { WorkspaceOperationalDashboard } from "@/components/workspace/workspace-operational-dashboard";
import { WorkspaceRosLinkDialogHost } from "@/components/workspace/workspace-ros-link-dialog-host";
import { WorkspaceOverviewViewSettings } from "@/components/workspace/workspace-overview-view-settings";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { buildWorkspaceOverviewShortcuts } from "@/lib/workspace-overview-view";
import { useQuery } from "convex/react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useMemo } from "react";
import { WORKSPACE_ROLE_LABEL_NB } from "@/lib/role-labels-nb";
import { ArrowRight, LayoutDashboard } from "lucide-react";

export default function WorkspaceOverviewPage() {
  const params = useParams();
  const workspaceId = params.workspaceId as Id<"workspaces">;
  const workspace = useQuery(api.workspaces.get, { workspaceId });
  const membership = useQuery(api.workspaces.getMyMembership, { workspaceId });
  const candidates = useQuery(api.candidates.listByWorkspace, { workspaceId });
  const viewPrefs = useQuery(api.workspaceViewPrefs.getMyWorkspaceViewPrefs, {
    workspaceId,
  });

  const wid = String(workspaceId);
  const visibleShortcuts = useMemo(() => {
    const all = buildWorkspaceOverviewShortcuts(wid);
    if (viewPrefs === undefined || viewPrefs === null) {
      return all.slice(0, 4);
    }
    return all.filter((s) => viewPrefs.visibleShortcutIds.includes(s.id));
  }, [viewPrefs, wid]);

  const sectionVisibility = useMemo(() => {
    if (!viewPrefs) {
      return undefined;
    }
    return {
      showMetrics: viewPrefs.showMetrics,
      showPrioritySection: viewPrefs.showPrioritySection,
      showRecentSection: viewPrefs.showRecentSection,
    };
  }, [viewPrefs]);

  if (
    workspace === undefined ||
    membership === undefined ||
    candidates === undefined
  ) {
    return <ProductLoadingBlock label="Laster arbeidsområde …" className="min-h-[30vh]" />;
  }

  if (workspace === null) {
    return (
      <p className="text-destructive text-sm">Fant ikke arbeidsområdet.</p>
    );
  }

  const showBegreperSection =
    viewPrefs !== undefined &&
    viewPrefs !== null &&
    viewPrefs.showBegreperSection;

  const showAnyDashboardContent =
    viewPrefs === undefined ||
    viewPrefs === null ||
    viewPrefs.showMetrics ||
    viewPrefs.showPrioritySection ||
    viewPrefs.showRecentSection ||
    visibleShortcuts.length > 0 ||
    viewPrefs.showBegreperSection;

  const roleLabel = membership?.role
    ? (WORKSPACE_ROLE_LABEL_NB[membership.role] ?? membership.role)
    : "—";

  return (
    <div className="space-y-5 pb-4">
      <Suspense fallback={null}>
        <WorkspaceRosLinkDialogHost workspaceId={workspaceId} />
      </Suspense>
      <ProductPageHeader
        title={workspace.name}
        description={
          <>
            <span className="text-muted-foreground text-sm">{roleLabel}</span>
            {workspace.notes ? (
              <span className="text-muted-foreground mt-2 block text-sm leading-snug">
                {workspace.notes}
              </span>
            ) : null}
          </>
        }
        actions={<WorkspaceOverviewViewSettings workspaceId={workspaceId} />}
      />

      {!showAnyDashboardContent && viewPrefs !== undefined ? (
        <ProductEmptyState
          icon={LayoutDashboard}
          title="Ingenting vises på dashboardet akkurat nå"
          description="Slå på nøkkeltall, lister, snarveier eller begreper under «Tilpass visning»."
        />
      ) : (
        <>
          {(viewPrefs === undefined ||
            viewPrefs === null ||
            viewPrefs.showMetrics ||
            viewPrefs.showPrioritySection ||
            viewPrefs.showRecentSection) && (
            <section aria-labelledby="dash-metrics-heading" className="space-y-4">
              <h2 id="dash-metrics-heading" className="sr-only">
                Oversikt
              </h2>
              <WorkspaceOperationalDashboard
                workspaceId={workspaceId}
                sectionVisibility={sectionVisibility}
              />
            </section>
          )}

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-heading text-base font-semibold tracking-tight text-foreground sm:text-lg">
                Snarveier
              </h2>
              <Link
                href={`/w/${wid}/organisasjon`}
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Organisasjon
              </Link>
            </div>
            {visibleShortcuts.length > 0 ? (
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {visibleShortcuts.map(({ href, title, desc, icon: Icon }) => (
                  <li key={href}>
                    <Link
                      href={href}
                      className="group flex min-h-[104px] flex-col justify-between gap-4 rounded-3xl bg-card/80 p-4 shadow-sm ring-1 ring-black/[0.04] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:ring-primary/20 dark:ring-white/[0.06]"
                    >
                      <div className="flex items-start gap-3">
                        <div className="bg-primary/10 text-primary flex size-11 shrink-0 items-center justify-center rounded-xl ring-1 ring-primary/12 transition-transform duration-200 group-hover:scale-105">
                          <Icon className="size-5" aria-hidden />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold leading-snug">{title}</p>
                          <p className="text-muted-foreground mt-1 text-sm leading-snug">
                            {desc}
                          </p>
                        </div>
                      </div>
                      <div className="inline-flex items-center gap-1 text-sm font-semibold text-foreground">
                        Åpne
                        <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : viewPrefs !== undefined && viewPrefs !== null ? (
              <p className="text-muted-foreground text-sm">
                Ingen snarveier valgt — bruk «Tilpass visning» for å vise kort
                igjen.
              </p>
            ) : null}
          </section>

          <section aria-labelledby="dash-org-ros-heading" className="space-y-3">
            <h2 id="dash-org-ros-heading" className="sr-only">
              Organisasjon
            </h2>
            <WorkspaceOrgRosCtaCard workspaceId={workspaceId} />
          </section>

          {showBegreperSection ? (
            <section className="space-y-4">
              <h2 className="font-heading text-base font-semibold tracking-tight text-foreground sm:text-lg">
                Begreper
              </h2>
              <div className="rounded-3xl border border-border/40 bg-card/70 px-5 py-4 text-sm leading-relaxed text-muted-foreground shadow-sm">
                <strong className="text-foreground">Prosess</strong> er grunnlaget.
                <strong className="text-foreground"> Vurdering</strong> er saken dere jobber med.
                <strong className="text-foreground"> ROS</strong> kobles på når risiko må vurderes.
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
