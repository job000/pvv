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

      <div className="mx-auto max-w-6xl space-y-8 px-3 pb-[max(6rem,env(safe-area-inset-bottom))] pt-4 sm:space-y-10 sm:px-8 sm:pt-8 lg:px-10">
        <header className="space-y-4 sm:space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
            <div className="min-w-0 space-y-1">
              <h1 className="font-heading text-xl font-semibold tracking-tight text-foreground sm:text-3xl">
                Oversikt
              </h1>
              <p className="text-muted-foreground max-w-lg text-sm leading-relaxed sm:text-[15px]">
                Velg arbeidsområde og fortsett der du slapp.
              </p>
            </div>
            {defaultWorkspace ? (
              <Link
                href={`/w/${defaultWorkspace._id}`}
                className="bg-foreground text-background inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold transition-opacity hover:opacity-90 touch-manipulation sm:w-auto"
              >
                <span className="truncate">
                  Fortsett i {defaultWorkspace.name}
                </span>
                <ArrowUpRight className="size-4 shrink-0" aria-hidden />
              </Link>
            ) : null}
          </div>

          <dl className="grid grid-cols-3 gap-1.5 sm:flex sm:flex-wrap sm:gap-2.5">
            <div className="bg-muted/40 flex flex-col rounded-xl px-2.5 py-2 sm:inline-flex sm:min-w-[7.5rem] sm:flex-row sm:items-baseline sm:gap-2 sm:px-4 sm:py-2.5">
              <dt className="text-muted-foreground text-[11px] sm:text-sm">
                Områder
              </dt>
              <dd className="text-base font-semibold tabular-nums text-foreground sm:text-sm">
                {workspaces.length}
              </dd>
            </div>
            <div className="bg-muted/40 flex flex-col rounded-xl px-2.5 py-2 sm:inline-flex sm:min-w-[7.5rem] sm:flex-row sm:items-baseline sm:gap-2 sm:px-4 sm:py-2.5">
              <dt className="text-muted-foreground text-[11px] sm:text-sm">
                Eier/admin
              </dt>
              <dd className="text-base font-semibold tabular-nums text-foreground sm:text-sm">
                {ownerOrAdminCount}
              </dd>
            </div>
            <div className="bg-muted/40 flex flex-col rounded-xl px-2.5 py-2 sm:inline-flex sm:min-w-[7.5rem] sm:flex-row sm:items-baseline sm:gap-2 sm:px-4 sm:py-2.5">
              <dt className="text-muted-foreground text-[11px] sm:text-sm">
                I fokus
              </dt>
              <dd className="text-base font-semibold tabular-nums text-foreground sm:text-sm">
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
          <section id="prioriteringer" className="scroll-mt-20 space-y-3 sm:scroll-mt-24 sm:space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-3">
              <div className="min-w-0 space-y-1">
                <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
                  I fokus
                </h2>
                <p className="text-muted-foreground text-sm">
                  Det som bør tas videre snart.
                </p>
              </div>
              <Link
                href={
                  defaultWorkspace
                    ? `/w/${defaultWorkspace._id}/vurderinger`
                    : `/w/${priorityHighlights[0]!.workspaceId}/vurderinger`
                }
                className="text-muted-foreground hover:text-foreground self-start text-sm font-medium transition-colors touch-manipulation"
              >
                Alle vurderinger
              </Link>
            </div>
            <ul className="grid gap-2 sm:grid-cols-2 sm:gap-2.5">
              {priorityHighlights.map((row) => (
                <li key={row.assessment._id}>
                  <Link
                    href={`/w/${row.workspaceId}/a/${row.assessment._id}`}
                    className="group hover:bg-muted/30 flex min-h-14 w-full min-w-0 items-center gap-3 rounded-2xl border border-border/50 bg-card px-3.5 py-3.5 transition-colors touch-manipulation active:bg-muted/40 sm:min-h-[4.75rem] sm:gap-4 sm:px-5 sm:py-4"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="truncate text-[15px] font-medium tracking-tight text-foreground">
                        {row.assessment.title}
                      </p>
                      <p className="text-muted-foreground truncate text-sm">
                        {row.workspaceName}
                        {" · "}
                        {PIPELINE_STATUS_LABELS[row.pipelineStatus]}
                      </p>
                    </div>
                    <span className="bg-muted/70 shrink-0 rounded-lg px-2.5 py-1 text-xs font-semibold tabular-nums text-foreground">
                      {row.effectivePriority.toFixed(0)}
                    </span>
                    <ArrowRight
                      className="text-muted-foreground/35 size-4 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
                      aria-hidden
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {mineAssessments && mineAssessments.length > 0 ? (
          <section className="space-y-3 sm:space-y-4">
            <div className="space-y-1">
              <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
                Delte med deg
              </h2>
              <p className="text-muted-foreground text-sm">
                Vurderinger du er invitert inn i.
              </p>
            </div>
            <ul className="grid gap-2 sm:grid-cols-2 sm:gap-2.5">
              {mineAssessments.map(({ assessment, role }) => (
                <li key={assessment._id}>
                  <Link
                    href={`/w/${assessment.workspaceId}/a/${assessment._id}`}
                    className="group hover:bg-muted/30 flex min-h-14 w-full min-w-0 items-center gap-3 rounded-2xl border border-border/50 bg-card px-3.5 py-3.5 transition-colors touch-manipulation active:bg-muted/40 sm:min-h-[4.75rem] sm:gap-4 sm:px-5 sm:py-4"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="truncate text-[15px] font-medium tracking-tight text-foreground">
                        {assessment.title}
                      </p>
                      <p className="text-muted-foreground text-sm">
                        {SHARED_ROLE_LABELS[role] ?? role}
                      </p>
                    </div>
                    <ArrowRight
                      className="text-muted-foreground/35 size-4 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
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
