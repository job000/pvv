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
import {
  ArrowRight,
  ClipboardList,
  LayoutDashboard,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
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

      <div className="w-full px-5 pb-20 pt-8 sm:px-8 lg:px-10">
        <ProductStack>
        <ProductPageHeader
          eyebrow="Oversikt"
          title="Arbeidsområder"
          description="Velg et område for å jobbe med prosesser, vurderinger og risiko. Opprett nytt område når du trenger det."
          actions={
            defaultWorkspace ? (
              <Link
                href={`/w/${defaultWorkspace._id}`}
                className={cn(
                  buttonVariants({ variant: "default", size: "lg" }),
                  "group w-full justify-center sm:w-auto",
                )}
              >
                Gå til {defaultWorkspace.name}
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
          <div className="grid grid-cols-3 gap-3">
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
            <StatCard
              icon={Zap}
              label="Prioritert"
              value={priorityCount}
            />
          </div>
        </section>

        {/* ── Tasks ── */}
        <TasksBoard />

        {/* ── Priorities ── */}
        {priorityHighlights !== undefined && priorityHighlights.length > 0 ? (
          <section
            id="prioriteringer"
            className="scroll-mt-24 space-y-5"
            aria-labelledby="dash-priorities-heading"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <TrendingUp className="text-muted-foreground size-4" aria-hidden />
                <h2
                  id="dash-priorities-heading"
                  className="text-foreground text-lg font-semibold"
                >
                  Prioriteringer
                </h2>
              </div>
              <Link
                href={
                  defaultWorkspace
                    ? `/w/${defaultWorkspace._id}/vurderinger`
                    : `/w/${priorityHighlights[0]!.workspaceId}/vurderinger`
                }
                className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium transition-colors hover:bg-muted/50"
              >
                <ClipboardList className="size-3.5" aria-hidden />
                Alle vurderinger
              </Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {priorityHighlights.map((row) => (
                <Link
                  key={row.assessment._id}
                  href={`/w/${row.workspaceId}/a/${row.assessment._id}`}
                  className="group flex flex-col rounded-2xl bg-card p-5 shadow-sm ring-1 ring-black/[0.04] transition-all duration-200 hover:shadow-md hover:ring-black/[0.08] dark:ring-white/[0.06] dark:hover:ring-white/[0.12]"
                >
                  <p className="text-foreground group-hover:text-primary text-sm font-semibold leading-snug transition-colors duration-200">
                    {row.assessment.title}
                  </p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {row.workspaceName}
                  </p>
                  <p className="text-muted-foreground mt-3 line-clamp-2 flex-1 text-xs leading-relaxed">
                    {row.readinessLabel} — {row.nextStepHint}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    <Badge
                      variant="secondary"
                      className="text-[11px] font-medium"
                    >
                      Prioritet {row.effectivePriority.toFixed(1)}
                    </Badge>
                    <Badge
                      variant="outline"
                      className="text-[11px]"
                    >
                      {PIPELINE_STATUS_LABELS[row.pipelineStatus]}
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {/* ── Shared assessments ── */}
        {mineAssessments && mineAssessments.length > 0 ? (
          <section className="space-y-5" aria-labelledby="dash-shared-heading">
            <div className="flex items-center gap-2.5">
              <Users className="text-muted-foreground size-4" aria-hidden />
              <h2
                id="dash-shared-heading"
                className="text-foreground text-lg font-semibold"
              >
                Delte vurderinger
              </h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {mineAssessments.map(({ assessment, role }) => (
                <Link
                  key={assessment._id}
                  href={`/w/${assessment.workspaceId}/a/${assessment._id}`}
                  className="group flex items-center justify-between gap-3 rounded-2xl bg-card p-4 shadow-sm ring-1 ring-black/[0.04] transition-all duration-200 hover:shadow-md hover:ring-black/[0.08] dark:ring-white/[0.06] dark:hover:ring-white/[0.12]"
                >
                  <div className="min-w-0">
                    <p className="text-foreground group-hover:text-primary truncate text-sm font-semibold transition-colors duration-200">
                      {assessment.title}
                    </p>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      {SHARED_ROLE_LABELS[role] ?? role}
                    </p>
                  </div>
                  <ArrowRight
                    className="text-muted-foreground/30 size-5 shrink-0 transition-all duration-200 group-hover:text-primary group-hover:translate-x-1"
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
    <div className="flex items-center gap-3 rounded-2xl bg-card px-4 py-4 shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
      <div className="bg-muted/60 flex size-10 shrink-0 items-center justify-center rounded-xl">
        <Icon className="text-muted-foreground size-4.5" aria-hidden />
      </div>
      <div className="min-w-0">
        <p className="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">
          {label}
        </p>
        <p className={cn(
          "text-foreground font-bold tabular-nums",
          typeof value === "number" ? "text-xl" : "truncate text-sm",
        )}>
          {value}
        </p>
      </div>
    </div>
  );
}
