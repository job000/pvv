"use client";

import { DashboardEntryRedirect } from "@/components/dashboard/dashboard-entry-redirect";
import { PendingWorkspaceInvitesBanner } from "@/components/dashboard/pending-workspace-invites-banner";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { TasksBoard } from "@/components/dashboard/tasks-board";
import { WorkspaceDashboardGrid } from "@/components/dashboard/workspace-dashboard";
import { ProductLoadingBlock, ProductPageHeader, ProductStack } from "@/components/product";
import { buttonVariants } from "@/components/ui/button-variants";
import { Badge } from "@/components/ui/badge";
import { api } from "@/convex/_generated/api";
import { PIPELINE_STATUS_LABELS } from "@/lib/assessment-pipeline";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import { ArrowRight, LayoutDashboard, Users, Zap } from "lucide-react";
import Link from "next/link";
import { Suspense, useEffect } from "react";

const SHARED_ROLE_LABELS: Record<string, string> = {
  owner: "Eier",
  admin: "Administrator",
  member: "Medlem",
  viewer: "Visning",
};

export default function DashboardPage() {
  const workspaces = useQuery(api.workspaces.listMine);
  const ensureDefault = useMutation(api.workspaces.ensureDefault);
  const acceptInvites = useMutation(api.assessments.acceptInvitesForEmail);
  const acceptWorkspaceInvites = useMutation(
    api.workspaces.acceptWorkspaceInvitesForEmail,
  );
  const mineAssessments = useQuery(api.assessments.listMineAcrossWorkspaces);
  const priorityHighlights = useQuery(api.assessments.listPriorityHighlights, {
    limit: 12,
  });
  const settings = useQuery(api.workspaces.getMySettings);

  useEffect(() => {
    void (async () => {
      try {
        await ensureDefault({});
        await acceptWorkspaceInvites({});
        await acceptInvites({});
      } catch {
        /* ignore */
      }
    })();
  }, [ensureDefault, acceptInvites, acceptWorkspaceInvites]);

  if (workspaces === undefined) {
    return <ProductLoadingBlock label="Henter arbeidsområder …" className="min-h-[50vh]" />;
  }

  const defaultId = settings?.defaultWorkspaceId ?? null;
  const defaultWorkspace =
    defaultId != null
      ? workspaces.find((w) => w.workspace._id === defaultId)?.workspace
      : null;

  const priorityCount = priorityHighlights?.length ?? 0;

  return (
    <DashboardLayout workspaces={workspaces} defaultWorkspaceId={defaultId}>
      <Suspense fallback={null}>
        <DashboardEntryRedirect />
      </Suspense>

      <div className="w-full px-5 pb-16 pt-6 sm:px-8 lg:px-10">
        <ProductStack className="space-y-6 sm:space-y-8">
          <ProductPageHeader
            title="Oversikt"
            description={
              <p className="text-muted-foreground max-w-md text-sm leading-relaxed">
                Åpne et arbeidsområde under, eller fortsett i det du bruker mest.
              </p>
            }
            actions={
              defaultWorkspace ? (
                <Link
                  href={`/w/${defaultWorkspace._id}`}
                  className={cn(
                    buttonVariants({ variant: "default", size: "default" }),
                    "group w-full justify-center rounded-2xl shadow-none sm:w-auto",
                  )}
                >
                  {defaultWorkspace.name}
                  <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                </Link>
              ) : null
            }
          />

          <PendingWorkspaceInvitesBanner />

          <section
            aria-label="Hurtigoversikt"
            className="rounded-3xl border border-border/45 bg-card/65 p-4 shadow-sm sm:p-5"
          >
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(18rem,1fr)] lg:items-start">
              <div className="space-y-4">
                <div className="space-y-1">
                  <p className="text-muted-foreground text-xs font-medium uppercase tracking-[0.12em]">
                    Arbeidsflater
                  </p>
                  <h2 className="text-foreground text-lg font-semibold tracking-tight sm:text-xl">
                    Fortsett der du jobber
                  </h2>
                </div>
                <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
                  <StatCard
                    icon={LayoutDashboard}
                    label="Områder"
                    value={workspaces.length}
                  />
                  <StatCard
                    icon={Users}
                    label="Vurderinger"
                    value={mineAssessments?.length ?? 0}
                  />
                  <StatCard icon={Zap} label="Prioritet" value={priorityCount} />
                </div>
              </div>
              <div className="rounded-2xl border border-border/45 bg-background/70 p-4">
                <p className="text-muted-foreground text-xs font-medium uppercase tracking-[0.12em]">
                  Standard
                </p>
                <p className="mt-2 text-base font-semibold text-foreground">
                  {defaultWorkspace?.name ?? "Ingen valgt ennå"}
                </p>
                <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                  {defaultWorkspace
                    ? "Åpnes raskt fra knappen øverst og brukes som snarvei i menyen."
                    : "Velg et standard arbeidsområde fra menyen på et områdekort."}
                </p>
                {defaultWorkspace ? (
                  <Link
                    href={`/w/${defaultWorkspace._id}`}
                    className="text-primary mt-4 inline-flex items-center gap-1 text-sm font-semibold"
                  >
                    Åpne arbeidsområdet
                    <ArrowRight className="size-3.5" aria-hidden />
                  </Link>
                ) : null}
              </div>
            </div>
          </section>

          <WorkspaceDashboardGrid
            workspaces={workspaces}
            defaultWorkspaceId={defaultId}
          />

          <TasksBoard />

          {priorityHighlights !== undefined ? (
            <section
              id="prioriteringer"
              className="scroll-mt-24 space-y-3"
              aria-labelledby="dash-priorities-heading"
            >
              <div className="flex items-center justify-between gap-3">
                <h2
                  id="dash-priorities-heading"
                  className="text-foreground text-base font-semibold tracking-tight"
                >
                  Prioriteringer
                </h2>
                {defaultWorkspace || priorityHighlights[0] ? (
                  <Link
                    href={
                      defaultWorkspace
                        ? `/w/${defaultWorkspace._id}/vurderinger`
                        : `/w/${priorityHighlights[0]!.workspaceId}/vurderinger`
                    }
                    className="text-muted-foreground hover:text-foreground text-xs font-medium transition-colors"
                  >
                    Alle vurderinger
                  </Link>
                ) : null}
              </div>
              {priorityHighlights.length > 0 ? (
                <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                  {priorityHighlights.map((row) => (
                    <Link
                      key={row.assessment._id}
                      href={`/w/${row.workspaceId}/a/${row.assessment._id}`}
                      className="group flex flex-col rounded-2xl border border-border/45 bg-card/75 p-4 transition-all hover:-translate-y-0.5 hover:border-border/65"
                    >
                      <p className="text-foreground group-hover:text-primary line-clamp-2 text-sm font-medium leading-snug">
                        {row.assessment.title}
                      </p>
                      <p className="text-muted-foreground mt-1 text-xs">
                        {row.workspaceName}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        <Badge variant="secondary" className="text-[10px] font-medium">
                          {row.effectivePriority.toFixed(0)} poeng
                        </Badge>
                        <Badge variant="outline" className="text-[10px] font-normal">
                          {PIPELINE_STATUS_LABELS[row.pipelineStatus]}
                        </Badge>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">
                  Ingen vurderinger i toppen av køen akkurat nå.
                </p>
              )}
            </section>
          ) : null}

          {mineAssessments && mineAssessments.length > 0 ? (
            <section className="space-y-3" aria-labelledby="dash-shared-heading">
              <h2
                id="dash-shared-heading"
                className="text-foreground text-base font-semibold tracking-tight"
              >
                Delte med deg
              </h2>
              <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                {mineAssessments.map(({ assessment, role }) => (
                  <Link
                    key={assessment._id}
                    href={`/w/${assessment.workspaceId}/a/${assessment._id}`}
                    className="group flex items-center justify-between gap-3 rounded-2xl border border-border/45 bg-card/75 p-3.5 transition-all hover:-translate-y-0.5 hover:border-border/65"
                  >
                    <div className="min-w-0">
                      <p className="text-foreground group-hover:text-primary truncate text-sm font-medium">
                        {assessment.title}
                      </p>
                      <p className="text-muted-foreground mt-0.5 text-xs">
                        {SHARED_ROLE_LABELS[role] ?? role}
                      </p>
                    </div>
                    <ArrowRight
                      className="text-muted-foreground/40 size-4 shrink-0 transition-colors group-hover:text-primary"
                      aria-hidden
                    />
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
        </ProductStack>
      </div>
    </DashboardLayout>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border/45 bg-background/75 px-3.5 py-3.5">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted/40">
        <Icon className="text-muted-foreground size-4 opacity-80" aria-hidden />
      </div>
      <div className="min-w-0">
        <p className="text-muted-foreground text-xs font-medium">{label}</p>
        <p
          className={cn(
            "text-foreground font-semibold tabular-nums",
            typeof value === "number" ? "text-lg" : "truncate text-sm",
          )}
        >
          {value}
        </p>
      </div>
    </div>
  );
}
