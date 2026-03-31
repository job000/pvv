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
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowRight,
  LayoutGrid,
  LayoutDashboard,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

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
    return (
      <div className="relative min-h-[40vh]">
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 px-4">
          <div className="border-primary size-9 animate-spin rounded-full border-2 border-t-transparent" />
          <p className="text-muted-foreground text-sm font-medium">
            Henter arbeidsområder …
          </p>
        </div>
      </div>
    );
  }

  const defaultId = settings?.defaultWorkspaceId ?? null;
  const defaultWorkspace =
    defaultId != null
      ? workspaces.find((w) => w.workspace._id === defaultId)?.workspace
      : null;

  return (
    <div className="relative">
      <div
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
        aria-hidden
      >
        <div className="absolute -left-[20%] top-[-30%] h-[55%] w-[75%] rounded-full bg-gradient-to-br from-primary/12 via-sky-400/10 to-transparent blur-3xl dark:from-primary/10 dark:via-sky-500/8" />
        <div className="absolute -left-[10%] bottom-[-20%] h-[45%] w-[60%] rounded-full bg-gradient-to-tr from-teal-500/10 via-transparent to-primary/10 blur-3xl dark:from-teal-500/8" />
        <div className="bg-border/30 absolute inset-0 bg-[linear-gradient(to_right,transparent_0,transparent_47%,hsl(var(--border))_47%,hsl(var(--border))_53%,transparent_53%)] bg-[length:28px_28px] opacity-[0.35] dark:opacity-[0.2]" />
      </div>

      <div className="mx-auto w-full max-w-6xl space-y-14 px-4 pb-16 pt-8 sm:px-8 sm:pt-10">
        <header className="relative space-y-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur-sm">
            <Sparkles className="text-primary size-3.5" aria-hidden />
            Oversikt
          </div>
          <div className="max-w-3xl space-y-4">
            <h1 className="font-heading text-foreground text-3xl font-bold tracking-tight sm:text-4xl">
              Arbeidsområder
            </h1>
            <p className="text-muted-foreground text-base leading-relaxed sm:text-lg">
              Velg arbeidsområde for vurderinger og leveranse. Du kan
              administrere flere områder, sette standard for hurtigtilgang og
              følge prioriterte saker på tvers av det du har tilgang til.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 pt-1">
            <div className="bg-card/90 flex items-center gap-2.5 rounded-xl border border-border/70 px-4 py-2.5 text-sm shadow-sm backdrop-blur-sm">
              <div className="bg-primary/12 text-primary flex size-9 items-center justify-center rounded-lg">
                <LayoutDashboard className="size-4" aria-hidden />
              </div>
              <div>
                <p className="text-muted-foreground text-xs leading-none">
                  Aktive områder
                </p>
                <p className="font-heading text-foreground text-lg font-semibold tracking-tight">
                  {workspaces.length}
                </p>
              </div>
            </div>
            {mineAssessments && mineAssessments.length > 0 ? (
              <div className="bg-card/90 flex items-center gap-2.5 rounded-xl border border-border/70 px-4 py-2.5 text-sm shadow-sm backdrop-blur-sm">
                <div className="bg-primary/12 text-primary flex size-9 items-center justify-center rounded-lg">
                  <Users className="size-4" aria-hidden />
                </div>
                <div>
                  <p className="text-muted-foreground text-xs leading-none">
                    Delte vurderinger
                  </p>
                  <p className="font-heading text-foreground text-lg font-semibold tracking-tight">
                    {mineAssessments.length}
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </header>

        {defaultWorkspace ? (
          <Card className="border-primary/25 bg-gradient-to-br from-primary/[0.07] via-card to-card shadow-md ring-1 ring-primary/15">
            <CardHeader className="pb-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <CardTitle className="text-base">Standard arbeidsområde</CardTitle>
                <CardDescription>
                  Åpner du FRO neste gang, kan du gå rett hit.
                </CardDescription>
              </div>
              <Link
                href={`/w/${defaultWorkspace._id}`}
                className={cn(
                  "group mt-3 inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 sm:mt-0",
                )}
              >
                Gå til {defaultWorkspace.name}
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </CardHeader>
          </Card>
        ) : null}

        <TasksBoard />

        {priorityHighlights !== undefined && priorityHighlights.length > 0 ? (
          <section className="space-y-6" aria-labelledby="dash-priorities-heading">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="bg-primary/12 text-primary flex size-9 items-center justify-center rounded-lg">
                    <TrendingUp className="size-4" aria-hidden />
                  </div>
                  <h2
                    id="dash-priorities-heading"
                    className="font-heading text-xl font-semibold tracking-tight sm:text-2xl"
                  >
                    Prioriteringer
                  </h2>
                </div>
                <p className="text-muted-foreground max-w-2xl pl-11 text-sm leading-relaxed">
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
                className="text-muted-foreground hover:text-foreground mt-1 inline-flex items-center gap-2 rounded-lg border border-border/80 bg-muted/30 px-3 py-2 text-sm font-medium transition-colors hover:bg-muted/50 sm:mt-0"
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
                    className="group border-border/80 bg-card/90 flex h-full flex-col rounded-2xl border p-5 shadow-sm backdrop-blur-sm transition-all duration-300 motion-safe:hover:-translate-y-0.5 motion-safe:hover:border-primary/25 motion-safe:hover:shadow-lg"
                  >
                    <span className="font-heading group-hover:text-primary font-semibold leading-snug transition-colors">
                      {row.assessment.title}
                    </span>
                    <span className="text-muted-foreground mt-1 text-xs">
                      {row.workspaceName}
                    </span>
                    <p className="text-muted-foreground mt-3 line-clamp-2 flex-1 text-sm leading-relaxed">
                      {row.readinessLabel} — {row.nextStepHint}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Badge variant="secondary" className="font-medium">
                        Prioritet {row.effectivePriority.toFixed(1)}
                      </Badge>
                      <Badge variant="outline" className="font-normal">
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
          <section className="space-y-5" aria-labelledby="dash-shared-heading">
            <div className="flex items-center gap-2">
              <div className="bg-primary/12 text-primary flex size-9 items-center justify-center rounded-lg">
                <Users className="size-4" aria-hidden />
              </div>
              <h2
                id="dash-shared-heading"
                className="font-heading text-xl font-semibold tracking-tight sm:text-2xl"
              >
                Mine delte vurderinger
              </h2>
            </div>
            <ul className="grid gap-4 sm:grid-cols-2">
              {mineAssessments.map(({ assessment, role }) => (
                <li key={assessment._id}>
                  <Link
                    href={`/w/${assessment.workspaceId}/a/${assessment._id}`}
                    className="group border-border/80 bg-card/90 flex flex-col overflow-hidden rounded-2xl border shadow-sm transition-all duration-300 motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-md"
                  >
                    <div className="flex flex-1 flex-col gap-2 p-5">
                      <span className="font-heading group-hover:text-primary font-semibold leading-snug transition-colors">
                        {assessment.title}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        Rolle:{" "}
                        <span className="text-foreground font-medium">
                          {SHARED_ROLE_LABELS[role] ?? role}
                        </span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 border-t border-border/60 bg-muted/25 px-4 py-3">
                      <span className="text-muted-foreground text-xs">
                        Åpne skjema
                      </span>
                      <span className="text-primary inline-flex items-center gap-1 text-sm font-semibold">
                        Gå til
                        <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </div>
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
    </div>
  );
}
