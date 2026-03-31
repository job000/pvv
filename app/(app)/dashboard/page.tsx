"use client";

import { TasksBoard } from "@/components/dashboard/tasks-board";
import { WorkspaceDashboardGrid } from "@/components/dashboard/workspace-dashboard";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { api } from "@/convex/_generated/api";
import { PIPELINE_STATUS_LABELS } from "@/lib/assessment-pipeline";
import { useMutation, useQuery } from "convex/react";
import { LayoutGrid } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

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
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-8">
        <p className="text-muted-foreground text-sm">Henter arbeidsområder …</p>
      </div>
    );
  }

  const defaultId = settings?.defaultWorkspaceId ?? null;
  const defaultWorkspace =
    defaultId != null
      ? workspaces.find((w) => w.workspace._id === defaultId)?.workspace
      : null;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-12 px-4 py-10 sm:px-8">
      <div className="max-w-2xl space-y-3">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Arbeidsområder
        </h1>
        <p className="text-muted-foreground text-base leading-relaxed">
          Velg et område for å jobbe med vurderinger og leveranse. Du kan
          opprette flere arbeidsområder, redigere under Innstillinger og slette
          som eier. Et område kan settes som standard (hurtigtilgang). Under ser
          du prioriterte saker på tvers av områder du har tilgang til.
        </p>
      </div>

      {defaultWorkspace ? (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Standard arbeidsområde</CardTitle>
            <CardDescription>
              Åpner du PVV neste gang, kan du gå rett hit.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Link
              href={`/w/${defaultWorkspace._id}`}
              className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-primary-foreground text-sm font-medium transition hover:bg-primary/90"
            >
              Gå til {defaultWorkspace.name}
            </Link>
          </CardFooter>
        </Card>
      ) : null}

      <TasksBoard />

      {priorityHighlights !== undefined && priorityHighlights.length > 0 ? (
        <section className="space-y-5" aria-labelledby="dash-priorities-heading">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2
                id="dash-priorities-heading"
                className="font-heading text-xl font-semibold tracking-tight"
              >
                Prioriteringer
              </h2>
              <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-relaxed">
                Sortert etter vurderingsprioritet (eller manuell justering).
                Status viser hvor i RPA-leveransen hver sak er.
              </p>
            </div>
            <Link
              href={
                defaultWorkspace
                  ? `/w/${defaultWorkspace._id}/leveranse`
                  : `/w/${priorityHighlights[0]!.workspaceId}/leveranse`
              }
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-sm font-medium"
            >
              <LayoutGrid className="size-4" aria-hidden />
              Åpne leveranse
            </Link>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {priorityHighlights.map((row) => (
              <li key={row.assessment._id}>
                <Link
                  href={`/w/${row.workspaceId}/a/${row.assessment._id}`}
                  className="flex h-full flex-col rounded-2xl border bg-card p-5 shadow-sm transition hover:bg-muted/30"
                >
                  <span className="font-heading font-semibold leading-snug">
                    {row.assessment.title}
                  </span>
                  <span className="text-muted-foreground mt-1 text-xs">
                    {row.workspaceName}
                  </span>
                  <p className="text-muted-foreground mt-3 line-clamp-2 text-sm leading-relaxed">
                    {row.readinessLabel} — {row.nextStepHint}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Badge variant="secondary">
                      Prioritet {row.effectivePriority.toFixed(1)}
                    </Badge>
                    <Badge variant="outline">
                      {PIPELINE_STATUS_LABELS[row.pipelineStatus]}
                    </Badge>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {mineAssessments && mineAssessments.length > 0 ? (
        <section className="space-y-4">
          <h2 className="font-heading text-lg font-semibold">
            Mine delte vurderinger
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2">
            {mineAssessments.map(({ assessment, role }) => (
              <li key={assessment._id}>
                <Link
                  href={`/w/${assessment.workspaceId}/a/${assessment._id}`}
                  className="block rounded-xl border bg-card p-4 transition hover:bg-muted/40"
                >
                  <span className="font-medium">{assessment.title}</span>
                  <span className="mt-1 block text-muted-foreground text-xs">
                    Rolle: {role}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <WorkspaceDashboardGrid
        workspaces={workspaces}
        defaultWorkspaceId={defaultId}
      />
    </div>
  );
}
