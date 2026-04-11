"use client";

import { DashboardEntryRedirect } from "@/components/dashboard/dashboard-entry-redirect";
import { PendingWorkspaceInvitesBanner } from "@/components/dashboard/pending-workspace-invites-banner";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { TasksBoard } from "@/components/dashboard/tasks-board";
import { WorkspaceDashboardGrid } from "@/components/dashboard/workspace-dashboard";
import { ProductLoadingBlock } from "@/components/product";
import { Badge } from "@/components/ui/badge";
import { api } from "@/convex/_generated/api";
import { PIPELINE_STATUS_LABELS } from "@/lib/assessment-pipeline";
import { useMutation, useQuery } from "convex/react";
import { ArrowRight } from "lucide-react";
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
    return <ProductLoadingBlock label="Henter arbeidsområder …" className="min-h-[50vh]" />;
  }

  const defaultId = settings?.defaultWorkspaceId ?? null;
  const defaultWorkspace =
    defaultId != null
      ? workspaces.find((w) => w.workspace._id === defaultId)?.workspace
      : null;

  return (
    <DashboardLayout workspaces={workspaces} defaultWorkspaceId={defaultId}>
      <Suspense fallback={null}>
        <DashboardEntryRedirect />
      </Suspense>

      <div className="mx-auto max-w-5xl space-y-8 px-5 pb-16 pt-6 sm:px-8 lg:px-10">
        {/* Header */}
        <header>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Oversikt
          </h1>
          {defaultWorkspace && (
            <p className="mt-1 text-sm text-muted-foreground">
              Sist brukt:{" "}
              <Link href={`/w/${defaultWorkspace._id}`} className="font-medium text-primary hover:underline">
                {defaultWorkspace.name}
              </Link>
            </p>
          )}
        </header>

        <PendingWorkspaceInvitesBanner />

        {/* Arbeidsområder */}
        <section id="arbeidsområder" className="scroll-mt-24 space-y-3">
          <div>
            <h2 className="text-base font-semibold tracking-tight">Arbeidsområder</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Velg et område for å jobbe med prosesser, vurderinger og dokumentasjon.
            </p>
          </div>
          <WorkspaceDashboardGrid
            workspaces={workspaces}
            defaultWorkspaceId={defaultId}
          />
        </section>

        {/* Oppgaver */}
        <TasksBoard />

        {/* I fokus */}
        {priorityHighlights !== undefined && priorityHighlights.length > 0 && (
          <section id="prioriteringer" className="scroll-mt-24 space-y-3">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-base font-semibold tracking-tight">I fokus</h2>
              {(defaultWorkspace || priorityHighlights[0]) && (
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
              )}
            </div>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {priorityHighlights.map((row) => (
                <Link
                  key={row.assessment._id}
                  href={`/w/${row.workspaceId}/a/${row.assessment._id}`}
                  className="group flex flex-col rounded-xl border border-border/40 bg-card/60 p-4 transition-all hover:border-border/60 hover:bg-card/80"
                >
                  <p className="line-clamp-2 text-sm font-medium leading-snug group-hover:text-primary">
                    {row.assessment.title}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
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
          </section>
        )}

        {/* Delte med deg */}
        {mineAssessments && mineAssessments.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-base font-semibold tracking-tight">Delte med deg</h2>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {mineAssessments.map(({ assessment, role }) => (
                <Link
                  key={assessment._id}
                  href={`/w/${assessment.workspaceId}/a/${assessment._id}`}
                  className="group flex items-center justify-between gap-3 rounded-xl border border-border/40 bg-card/60 p-3.5 transition-all hover:border-border/60 hover:bg-card/80"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium group-hover:text-primary">
                      {assessment.title}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {SHARED_ROLE_LABELS[role] ?? role}
                    </p>
                  </div>
                  <ArrowRight
                    className="size-4 shrink-0 text-muted-foreground/30 transition-colors group-hover:text-primary"
                    aria-hidden
                  />
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </DashboardLayout>
  );
}
