"use client";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ProductEmptyState, ProductLoadingBlock, ProductPageHeader } from "@/components/product";
import { WorkspaceOperationalDashboard } from "@/components/workspace/workspace-operational-dashboard";
import { WorkspaceOverviewViewSettings } from "@/components/workspace/workspace-overview-view-settings";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { buildWorkspaceOverviewShortcuts } from "@/lib/workspace-overview-view";
import { useQuery } from "convex/react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo } from "react";
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
      return all;
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
    viewPrefs === undefined || viewPrefs === null || viewPrefs.showBegreperSection;

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
    <div className="space-y-6 pb-4">
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
              <h2
                id="dash-metrics-heading"
                className="font-heading text-base font-semibold tracking-tight text-foreground sm:text-lg"
              >
                Oversikt
              </h2>
              <WorkspaceOperationalDashboard
                workspaceId={workspaceId}
                sectionVisibility={sectionVisibility}
              />
            </section>
          )}

          <section className="space-y-4">
              <h2 className="font-heading text-base font-semibold tracking-tight text-foreground sm:text-lg">
                Snarveier
              </h2>
            {visibleShortcuts.length > 0 ? (
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {visibleShortcuts.map(({ href, title, desc, icon: Icon }) => (
                  <li key={href}>
                    <Link
                      href={href}
                      className="group flex min-h-[108px] flex-col justify-between gap-4 rounded-2xl bg-card p-4 shadow-sm ring-1 ring-black/[0.04] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:ring-primary/20 dark:ring-white/[0.06]"
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
                        Åpne nå
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

          {showBegreperSection ? (
            <section className="space-y-4">
              <h2 className="font-heading text-base font-semibold tracking-tight text-foreground sm:text-lg">
                Begreper
              </h2>
              <Card className="rounded-2xl border-border/40 bg-muted/15 shadow-[0_1px_3px_rgba(0,0,0,0.03)] ring-1 ring-black/[0.03] dark:ring-white/[0.05]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold">
                    Prosess · vurdering · ROS
                  </CardTitle>
                  <CardDescription className="text-sm leading-snug">
                    <strong className="text-foreground">Prosessregisteret</strong> har{" "}
                    {candidates.length}{" "}
                    {candidates.length === 1 ? "prosess" : "prosesser"}. En{" "}
                    <strong className="text-foreground">vurdering</strong> er én sak
                    (skjema, prioritet, status).{" "}
                    <strong className="text-foreground">ROS</strong> er risikoanalyse
                    og kobles til vurderingen når det trengs.
                  </CardDescription>
                </CardHeader>
              </Card>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
