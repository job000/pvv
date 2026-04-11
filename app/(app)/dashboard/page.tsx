"use client";

import { DashboardEntryRedirect } from "@/components/dashboard/dashboard-entry-redirect";
import { PendingWorkspaceInvitesBanner } from "@/components/dashboard/pending-workspace-invites-banner";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { TasksBoard } from "@/components/dashboard/tasks-board";
import { WorkspaceDashboardGrid } from "@/components/dashboard/workspace-dashboard";
import {
  ProductLoadingBlock,
  ProductPageHeader,
  ProductSection,
  ProductStack,
} from "@/components/product";
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

      <div className="w-full px-5 pb-16 pt-6 sm:px-8 lg:px-10">
        <ProductStack className="space-y-6 sm:space-y-8">
          <ProductPageHeader
            title="Oversikt"
            description={
              defaultWorkspace ? (
                <p className="text-muted-foreground max-w-md text-sm">
                  Sist brukt:{" "}
                  <Link href={`/w/${defaultWorkspace._id}`} className="text-primary font-medium hover:underline">
                    {defaultWorkspace.name}
                  </Link>
                </p>
              ) : null
            }
          />

          <PendingWorkspaceInvitesBanner />

          <ProductSection
            title="Arbeidsområder"
            description="Velg et område for å jobbe med prosesser, vurderinger og dokumentasjon."
          />

          <WorkspaceDashboardGrid
            workspaces={workspaces}
            defaultWorkspaceId={defaultId}
          />

          <TasksBoard />

          {priorityHighlights !== undefined && priorityHighlights.length > 0 ? (
            <ProductSection
              id="prioriteringer"
              title="I fokus"
              description="Saker som ligger øverst i køen akkurat nå."
              className="scroll-mt-24 space-y-3"
            >
              <div className="flex items-center justify-between gap-3">
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
            </ProductSection>
          ) : null}

          {mineAssessments && mineAssessments.length > 0 ? (
            <ProductSection
              title="Delte med deg"
              description="Saker du har tilgang til på tvers av arbeidsområder."
              className="space-y-3"
            >
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
            </ProductSection>
          ) : null}
        </ProductStack>
      </div>
    </DashboardLayout>
  );
}

