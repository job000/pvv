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
                  "group w-full justify-center rounded-xl shadow-none sm:w-auto",
                )}
              >
                {defaultWorkspace.name}
                <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
              </Link>
            ) : null
          }
        />

        <PendingWorkspaceInvitesBanner />

        {/* ── Create + Workspaces grid ── */}
        <WorkspaceDashboardGrid
          workspaces={workspaces}
          defaultWorkspaceId={defaultId}
        />

        {/* ── Stats row ── */}
        <section aria-label="Nøkkeltall">
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
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
        </section>

        {/* ── Tasks ── */}
        <TasksBoard />

        {/* ── Priorities ── */}
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
                    className="border-border/40 bg-card/80 hover:border-border/60 group flex flex-col rounded-xl border p-4 transition-colors"
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

        {/* ── Shared assessments ── */}
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
                  className="border-border/40 bg-card/80 hover:border-border/60 group flex items-center justify-between gap-3 rounded-xl border p-3.5 transition-colors"
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
    <div className="border-border/40 bg-card/60 flex items-center gap-3 rounded-xl border px-3.5 py-3.5">
      <div className="bg-muted/50 flex size-9 shrink-0 items-center justify-center rounded-lg">
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
