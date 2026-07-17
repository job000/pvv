"use client";

import { DashboardEntryRedirect } from "@/components/dashboard/dashboard-entry-redirect";
import { PendingWorkspaceInvitesBanner } from "@/components/dashboard/pending-workspace-invites-banner";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { TasksBoard } from "@/components/dashboard/tasks-board";
import { WorkspaceDashboardGrid } from "@/components/dashboard/workspace-dashboard";
import { ProductLoadingBlock } from "@/components/product";
import { api } from "@/convex/_generated/api";
import { PIPELINE_STATUS_LABELS } from "@/lib/assessment-pipeline";
import { useMutation, useQuery } from "convex/react";
import { ArrowRight, ArrowUpRight } from "lucide-react";
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
    limit: 6,
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
    return (
      <ProductLoadingBlock
        label="Henter arbeidsområder …"
        className="min-h-[50vh]"
      />
    );
  }

  const defaultId = settings?.defaultWorkspaceId ?? null;
  const defaultWorkspace =
    defaultId != null
      ? workspaces.find((w) => w.workspace._id === defaultId)?.workspace
      : null;
  const ownerOrAdminCount = workspaces.filter(
    (w) => w.role === "owner" || w.role === "admin",
  ).length;
  const priorityCount = priorityHighlights?.length ?? 0;

  return (
    <DashboardLayout workspaces={workspaces} defaultWorkspaceId={defaultId}>
      <Suspense fallback={null}>
        <DashboardEntryRedirect />
      </Suspense>

      <div className="mx-auto max-w-5xl space-y-10 px-4 pb-20 pt-6 sm:px-8 lg:px-10">
        <header className="space-y-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0 space-y-1">
              <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground">
                Oversikt
              </h1>
              <p className="text-sm text-muted-foreground">
                Velg arbeidsområde og fortsett der du slapp.
              </p>
            </div>
            {defaultWorkspace ? (
              <Link
                href={`/w/${defaultWorkspace._id}`}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-foreground px-5 text-sm font-semibold text-background transition-opacity hover:opacity-90"
              >
                Fortsett i {defaultWorkspace.name}
                <ArrowUpRight className="size-4" aria-hidden />
              </Link>
            ) : null}
          </div>

          <dl className="flex flex-wrap gap-x-8 gap-y-2 border-y border-border/50 py-3 text-sm">
            <div className="flex items-baseline gap-2">
              <dt className="text-muted-foreground">Områder</dt>
              <dd className="font-semibold tabular-nums text-foreground">
                {workspaces.length}
              </dd>
            </div>
            <div className="flex items-baseline gap-2">
              <dt className="text-muted-foreground">Eier/admin</dt>
              <dd className="font-semibold tabular-nums text-foreground">
                {ownerOrAdminCount}
              </dd>
            </div>
            <div className="flex items-baseline gap-2">
              <dt className="text-muted-foreground">I fokus</dt>
              <dd className="font-semibold tabular-nums text-foreground">
                {priorityCount}
              </dd>
            </div>
          </dl>
        </header>

        <PendingWorkspaceInvitesBanner />

        <WorkspaceDashboardGrid
          workspaces={workspaces}
          defaultWorkspaceId={defaultId}
        />

        <TasksBoard />

        {priorityHighlights !== undefined && priorityHighlights.length > 0 ? (
          <section id="prioriteringer" className="scroll-mt-24 space-y-3">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-base font-semibold tracking-tight text-foreground">
                I fokus
              </h2>
              <Link
                href={
                  defaultWorkspace
                    ? `/w/${defaultWorkspace._id}/vurderinger`
                    : `/w/${priorityHighlights[0]!.workspaceId}/vurderinger`
                }
                className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Alle vurderinger
              </Link>
            </div>
            <ul className="divide-y divide-border/40 overflow-hidden rounded-2xl border border-border/50 bg-card">
              {priorityHighlights.map((row) => (
                <li key={row.assessment._id}>
                  <Link
                    href={`/w/${row.workspaceId}/a/${row.assessment._id}`}
                    className="group flex w-full min-w-0 items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/30 sm:px-5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {row.assessment.title}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {row.workspaceName}
                        {" · "}
                        {PIPELINE_STATUS_LABELS[row.pipelineStatus]}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {row.effectivePriority.toFixed(0)}
                    </span>
                    <ArrowRight
                      className="size-4 shrink-0 text-muted-foreground/35 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
                      aria-hidden
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {mineAssessments && mineAssessments.length > 0 ? (
          <section className="space-y-3">
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              Delte med deg
            </h2>
            <ul className="divide-y divide-border/40 overflow-hidden rounded-2xl border border-border/50 bg-card">
              {mineAssessments.map(({ assessment, role }) => (
                <li key={assessment._id}>
                  <Link
                    href={`/w/${assessment.workspaceId}/a/${assessment._id}`}
                    className="group flex w-full min-w-0 items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/30 sm:px-5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {assessment.title}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {SHARED_ROLE_LABELS[role] ?? role}
                      </p>
                    </div>
                    <ArrowRight
                      className="size-4 shrink-0 text-muted-foreground/35 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
                      aria-hidden
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
