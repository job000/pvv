"use client";

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
  ChevronRight,
  LayoutGrid,
  LayoutDashboard,
  Sparkles,
  Star,
  TrendingUp,
  Users,
  Zap,
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

  const priorityCount = priorityHighlights?.length ?? 0;

  return (
    <DashboardLayout
      workspaces={workspaces}
      defaultWorkspaceId={defaultId}
    >
      <div className="relative">
        <div
          className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
          aria-hidden
        >
          <div className="absolute -left-[15%] top-[-20%] h-[40%] w-[60%] rounded-full bg-gradient-to-br from-primary/[0.08] via-sky-500/[0.06] to-transparent blur-3xl" />
        </div>

        <div className="w-full space-y-8 px-4 pb-16 pt-6 sm:px-6 sm:pt-8 lg:space-y-10 lg:px-8 lg:pt-10">
          {/* Mobil: rask tilgang til arbeidsområder */}
          <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] lg:hidden [&::-webkit-scrollbar]:hidden">
            {workspaces.map(({ workspace }) => (
              <Link
                key={workspace._id}
                href={`/w/${workspace._id}`}
                className={cn(
                  "border-border/80 bg-card/95 text-foreground inline-flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium shadow-sm backdrop-blur-sm transition hover:border-primary/30 hover:bg-card",
                  defaultId === workspace._id && "border-primary/35 ring-primary/15 ring-1",
                )}
              >
                <span className="max-w-[140px] truncate">{workspace.name}</span>
                <ChevronRight className="text-muted-foreground size-4 shrink-0" />
              </Link>
            ))}
            <Link
              href="#arbeidsområder"
              className="text-muted-foreground hover:text-foreground inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-2 text-xs font-medium"
            >
              Alle
            </Link>
          </div>

          <header className="space-y-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 space-y-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground">
                  <Sparkles className="text-primary size-3.5" aria-hidden />
                  Oversikt
                </div>
                <div className="space-y-2">
                  <h1 className="font-heading text-foreground text-3xl font-bold tracking-tight sm:text-4xl">
                    Arbeidsområder
                  </h1>
                  <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed sm:text-base">
                    Administrer team og prosjekter, sett standard for hurtigtilgang
                    og følg saker på tvers av det du har tilgang til.
                  </p>
                </div>
              </div>
              {defaultWorkspace ? (
                <Link
                  href={`/w/${defaultWorkspace._id}`}
                  className="group bg-foreground text-background hover:bg-foreground/90 inline-flex h-11 shrink-0 items-center justify-center gap-2 self-start rounded-xl px-5 text-sm font-semibold shadow-md transition sm:h-12 sm:px-6"
                >
                  Gå til {defaultWorkspace.name}
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              ) : null}
            </div>

            {/* Nøkkeltall — Meta-lignende tette kort */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="border-border/70 bg-card/90 flex items-center gap-3 rounded-2xl border p-4 shadow-sm">
                <div className="bg-primary/12 text-primary flex size-11 items-center justify-center rounded-xl">
                  <LayoutDashboard className="size-5" aria-hidden />
                </div>
                <div>
                  <p className="text-muted-foreground text-xs font-medium">
                    Aktive områder
                  </p>
                  <p className="font-heading text-foreground text-2xl font-bold tracking-tight">
                    {workspaces.length}
                  </p>
                </div>
              </div>
              <div className="border-border/70 bg-card/90 flex items-center gap-3 rounded-2xl border p-4 shadow-sm">
                <div className="bg-primary/12 text-primary flex size-11 items-center justify-center rounded-xl">
                  <Users className="size-5" aria-hidden />
                </div>
                <div>
                  <p className="text-muted-foreground text-xs font-medium">
                    Delte vurderinger
                  </p>
                  <p className="font-heading text-foreground text-2xl font-bold tracking-tight">
                    {mineAssessments?.length ?? 0}
                  </p>
                </div>
              </div>
              <div className="border-border/70 bg-card/90 flex items-center gap-3 rounded-2xl border p-4 shadow-sm">
                <div className="bg-primary/12 text-primary flex size-11 items-center justify-center rounded-xl">
                  <Zap className="size-5" aria-hidden />
                </div>
                <div>
                  <p className="text-muted-foreground text-xs font-medium">
                    Prioritert nå
                  </p>
                  <p className="font-heading text-foreground text-2xl font-bold tracking-tight">
                    {priorityCount}
                  </p>
                </div>
              </div>
              <div className="border-border/70 bg-card/90 flex items-center gap-3 rounded-2xl border p-4 shadow-sm">
                <div className="bg-primary/12 text-primary flex size-11 items-center justify-center rounded-xl">
                  <Star className="size-5" aria-hidden />
                </div>
                <div>
                  <p className="text-muted-foreground text-xs font-medium">
                    Standard satt
                  </p>
                  <p className="font-heading text-foreground truncate text-lg font-semibold tracking-tight">
                    {defaultWorkspace ? defaultWorkspace.name : "—"}
                  </p>
                </div>
              </div>
            </div>
          </header>

          {defaultWorkspace ? (
            <Card className="border-border/80 bg-muted/20 overflow-hidden border shadow-sm">
              <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between sm:pb-2">
                <div className="space-y-1">
                  <CardTitle className="text-base font-semibold">
                    Standard arbeidsområde
                  </CardTitle>
                  <CardDescription className="text-sm">
                    Neste gang du åpner FRO kan du gå rett til dette området.
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/w/${defaultWorkspace._id}/leveranse`}
                    className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-background px-3 py-2 text-xs font-medium transition"
                  >
                    Leveranse
                  </Link>
                  <Link
                    href={`/w/${defaultWorkspace._id}/vurderinger`}
                    className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-background px-3 py-2 text-xs font-medium transition"
                  >
                    Vurderinger
                  </Link>
                  <Link
                    href={`/w/${defaultWorkspace._id}/innstillinger`}
                    className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-background px-3 py-2 text-xs font-medium transition"
                  >
                    Innstillinger
                  </Link>
                </div>
              </CardHeader>
              <CardFooter className="border-border/60 flex flex-wrap gap-2 border-t bg-muted/10 pt-4">
                <Link
                  href={`/w/${defaultWorkspace._id}`}
                  className={cn(
                    "group inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90",
                  )}
                >
                  Åpne {defaultWorkspace.name}
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </CardFooter>
            </Card>
          ) : null}

          <WorkspaceDashboardGrid
            workspaces={workspaces}
            defaultWorkspaceId={defaultId}
          />

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
                    RPA-leveransen hver sak er.
                  </p>
                </div>
                <Link
                  href={
                    defaultWorkspace
                      ? `/w/${defaultWorkspace._id}/leveranse`
                      : `/w/${priorityHighlights[0]!.workspaceId}/leveranse`
                  }
                  className="text-muted-foreground hover:text-foreground mt-1 inline-flex items-center gap-2 rounded-xl border border-border/80 bg-muted/30 px-3 py-2 text-sm font-medium transition-colors hover:bg-muted/50 sm:mt-0"
                >
                  <LayoutGrid className="size-4" aria-hidden />
                  Åpne leveranse
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
