"use client";

import { DashboardEntryRedirect } from "@/components/dashboard/dashboard-entry-redirect";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
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
  ClipboardList,
  LayoutDashboard,
  Sparkles,
  Star,
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

  const priorityCount = priorityHighlights?.length ?? 0;

  return (
    <DashboardLayout
      workspaces={workspaces}
      defaultWorkspaceId={defaultId}
    >
      <Suspense fallback={null}>
        <DashboardEntryRedirect />
      </Suspense>
      <div className="relative">
        <div
          className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
          aria-hidden
        >
          <div className="absolute -left-[15%] top-[-20%] h-[40%] w-[60%] rounded-full bg-gradient-to-br from-primary/[0.08] via-sky-500/[0.06] to-transparent blur-3xl" />
        </div>

        <div className="w-full space-y-8 px-4 pb-16 pt-6 sm:px-6 sm:pt-8 lg:space-y-10 lg:px-8 lg:pt-10">
          <header className="border-border/60 space-y-4 border-b pb-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 space-y-1">
                <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground">
                  <Sparkles className="text-primary size-3.5" aria-hidden />
                  Oversikt
                </div>
                <h1 className="font-heading text-foreground text-2xl font-bold tracking-tight sm:text-3xl">
                  Arbeidsområder
                </h1>
                <p className="text-muted-foreground max-w-xl text-sm">
                  Velg kort under for å gå inn. Tall og oppgaver finner du lenger ned.
                </p>
              </div>
              {defaultWorkspace ? (
                <Link
                  href={`/w/${defaultWorkspace._id}`}
                  className="group bg-foreground text-background hover:bg-foreground/90 inline-flex h-10 shrink-0 items-center justify-center gap-2 self-start rounded-lg px-4 text-sm font-semibold shadow-md transition"
                >
                  Standard: {defaultWorkspace.name}
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              ) : null}
            </div>
          </header>

          <WorkspaceDashboardGrid
            workspaces={workspaces}
            defaultWorkspaceId={defaultId}
          />

          <section aria-label="Nøkkeltall" className="space-y-3">
            <h2 className="text-muted-foreground text-[11px] font-semibold uppercase tracking-[0.12em]">
              Tall
            </h2>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <div className="flex items-center gap-3 rounded-xl border border-border/45 bg-card p-3 shadow-sm ring-1 ring-black/[0.03] dark:ring-white/[0.05]">
                <div className="bg-primary/12 text-primary flex size-9 items-center justify-center rounded-xl ring-1 ring-primary/12">
                  <LayoutDashboard className="size-4" aria-hidden />
                </div>
                <div className="min-w-0">
                  <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-[0.12em]">
                    Områder
                  </p>
                  <p className="font-heading text-foreground text-xl font-semibold tabular-nums tracking-tight">
                    {workspaces.length}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-border/45 bg-card p-3 shadow-sm ring-1 ring-black/[0.03] dark:ring-white/[0.05]">
                <div className="bg-primary/12 text-primary flex size-9 items-center justify-center rounded-xl ring-1 ring-primary/12">
                  <Users className="size-4" aria-hidden />
                </div>
                <div className="min-w-0">
                  <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-[0.12em]">
                    Vurderinger
                  </p>
                  <p className="font-heading text-foreground text-xl font-semibold tabular-nums tracking-tight">
                    {mineAssessments?.length ?? 0}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-border/45 bg-card p-3 shadow-sm ring-1 ring-black/[0.03] dark:ring-white/[0.05]">
                <div className="bg-primary/12 text-primary flex size-9 items-center justify-center rounded-xl ring-1 ring-primary/12">
                  <Zap className="size-4" aria-hidden />
                </div>
                <div className="min-w-0">
                  <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-[0.12em]">
                    Prioritert
                  </p>
                  <p className="font-heading text-foreground text-xl font-semibold tabular-nums tracking-tight">
                    {priorityCount}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-border/45 bg-card p-3 shadow-sm ring-1 ring-black/[0.03] dark:ring-white/[0.05]">
                <div className="bg-primary/12 text-primary flex size-9 items-center justify-center rounded-xl ring-1 ring-primary/12">
                  <Star className="size-4" aria-hidden />
                </div>
                <div className="min-w-0">
                  <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-[0.12em]">
                    Standard
                  </p>
                  <p className="font-heading truncate text-sm font-semibold tracking-tight text-foreground">
                    {defaultWorkspace ? defaultWorkspace.name : "—"}
                  </p>
                </div>
              </div>
            </div>
          </section>

          {defaultWorkspace ? (
            <Card className="overflow-hidden rounded-2xl border-border/40 bg-muted/15 shadow-[0_1px_3px_rgba(0,0,0,0.04)] ring-1 ring-black/[0.03] dark:ring-white/[0.05]">
              <CardHeader className="flex flex-col gap-3 border-b border-border/40 bg-gradient-to-b from-muted/30 to-transparent pb-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <p className="text-muted-foreground text-[11px] font-semibold uppercase tracking-[0.12em]">
                    Hurtigtilgang
                  </p>
                  <CardTitle className="text-base font-semibold tracking-tight">
                    Standard arbeidsområde
                  </CardTitle>
                  <CardDescription className="text-[13px] leading-relaxed sm:text-sm">
                    Neste gang du åpner FRO kan du gå rett til dette området.
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/w/${defaultWorkspace._id}/vurderinger`}
                    className="text-muted-foreground hover:text-foreground inline-flex h-10 min-h-[44px] items-center gap-1.5 rounded-xl border border-border/60 bg-background px-3 text-xs font-semibold transition sm:min-h-0"
                  >
                    Vurderinger
                  </Link>
                  <Link
                    href={`/w/${defaultWorkspace._id}/innstillinger`}
                    className="text-muted-foreground hover:text-foreground inline-flex h-10 min-h-[44px] items-center gap-1.5 rounded-xl border border-border/60 bg-background px-3 text-xs font-semibold transition sm:min-h-0"
                  >
                    Innstillinger
                  </Link>
                </div>
              </CardHeader>
              <CardFooter className="flex flex-wrap gap-2 border-t border-border/40 bg-muted/10 pt-4">
                <Link
                  href={`/w/${defaultWorkspace._id}`}
                  className={cn(
                    "group inline-flex h-11 min-h-[44px] items-center justify-center gap-2 rounded-xl bg-primary px-5 text-[13px] font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 sm:h-10 sm:min-h-0",
                  )}
                >
                  Åpne {defaultWorkspace.name}
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </CardFooter>
            </Card>
          ) : null}

          <TasksBoard />

          {priorityHighlights !== undefined && priorityHighlights.length > 0 ? (
            <section
              id="prioriteringer"
              className="space-y-6 scroll-mt-24"
              aria-labelledby="dash-priorities-heading"
            >
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
                    Sortert etter vurderingsprioritet. Status viser hvor i
                    RPA-pipeline hver sak er.
                  </p>
                </div>
                <Link
                  href={
                    defaultWorkspace
                      ? `/w/${defaultWorkspace._id}/vurderinger`
                      : `/w/${priorityHighlights[0]!.workspaceId}/vurderinger`
                  }
                  className="text-muted-foreground hover:text-foreground mt-1 inline-flex items-center gap-2 rounded-xl border border-border/80 bg-muted/30 px-3 py-2 text-sm font-medium transition-colors hover:bg-muted/50 sm:mt-0"
                >
                  <ClipboardList className="size-4" aria-hidden />
                  Åpne vurderinger
                </Link>
              </div>
              <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
              <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
        </div>
      </div>
    </DashboardLayout>
  );
}
