"use client";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { WorkspaceOperationalDashboard } from "@/components/workspace/workspace-operational-dashboard";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import {
  Bell,
  Building2,
  ClipboardList,
  Settings2,
  Share2,
  Shield,
  Users,
} from "lucide-react";
import { WORKSPACE_ROLE_LABEL_NB } from "@/lib/role-labels-nb";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function WorkspaceOverviewPage() {
  const params = useParams();
  const workspaceId = params.workspaceId as Id<"workspaces">;
  const workspace = useQuery(api.workspaces.get, { workspaceId });
  const membership = useQuery(api.workspaces.getMyMembership, { workspaceId });
  const candidates = useQuery(api.candidates.listByWorkspace, { workspaceId });

  if (
    workspace === undefined ||
    membership === undefined ||
    candidates === undefined
  ) {
    return (
      <div className="flex min-h-[30vh] flex-col items-center justify-center gap-2">
        <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-muted-foreground text-sm">Laster …</p>
      </div>
    );
  }

  if (workspace === null) {
    return (
      <p className="text-destructive text-sm">Fant ikke arbeidsområdet.</p>
    );
  }

  const wid = String(workspaceId);

  const shortcuts = [
    {
      href: `/w/${wid}/vurderinger`,
      title: "Vurderinger",
      desc: "RPA-saker med skjema og status",
      icon: ClipboardList,
    },
    {
      href: `/w/${wid}/vurderinger?fane=prosesser`,
      title: "Prosessregister",
      desc: "Prosesser med ID før ny vurdering",
      icon: Users,
    },
    {
      href: `/w/${wid}/ros`,
      title: "ROS og risiko",
      desc: "Analyse og kobling til vurderinger",
      icon: Shield,
    },
    {
      href: `/w/${wid}/organisasjon`,
      title: "Organisasjon",
      desc: "Enheter og kontaktpunkter",
      icon: Building2,
    },
    {
      href: `/w/${wid}/delinger`,
      title: "Team og tilgang",
      desc: "Medlemmer og roller",
      icon: Share2,
    },
    {
      href: `/w/${wid}/varslinger`,
      title: "Varsler",
      desc: "E-post og påminnelser",
      icon: Bell,
    },
    {
      href: `/w/${wid}/innstillinger`,
      title: "Innstillinger",
      desc: "Navn og merknader for området",
      icon: Settings2,
    },
  ];

  return (
    <div className="space-y-10 pb-4">
      <header className="relative overflow-hidden rounded-3xl border border-border/40 bg-card px-5 py-7 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-4px_rgba(0,0,0,0.06)] ring-1 ring-black/[0.03] dark:ring-white/[0.06] sm:px-8 sm:py-8">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.4] dark:opacity-[0.22]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, oklch(0.55 0 0 / 0.08) 1px, transparent 0)`,
            backgroundSize: "24px 24px",
          }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -right-20 -top-16 h-64 w-64 rounded-full bg-gradient-to-br from-primary/[0.12] to-transparent blur-3xl"
          aria-hidden
        />
        <div className="relative space-y-3">
          <p className="text-muted-foreground text-[11px] font-semibold uppercase tracking-[0.14em]">
            Arbeidsområde
          </p>
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {workspace.name}
          </h1>
          <p className="text-muted-foreground max-w-prose text-[15px] leading-relaxed">
            Rolle:{" "}
            <span className="text-foreground font-medium">
              {membership?.role
                ? WORKSPACE_ROLE_LABEL_NB[membership.role] ?? membership.role
                : "—"}
            </span>
            . Nøkkeltall, ROS-koblinger og siste aktivitet for arbeidsområdet.
          </p>
          {workspace.notes ? (
            <p className="mt-4 rounded-2xl border border-border/45 bg-muted/25 px-4 py-3 text-sm leading-relaxed ring-1 ring-black/[0.03] dark:ring-white/[0.05]">
              {workspace.notes}
            </p>
          ) : null}
        </div>
      </header>

      <section aria-labelledby="dash-metrics-heading" className="space-y-4">
        <div>
          <p className="text-muted-foreground text-[11px] font-semibold uppercase tracking-[0.12em]">
            Oversikt
          </p>
          <h2
            id="dash-metrics-heading"
            className="font-heading mt-1 text-base font-semibold tracking-tight text-foreground sm:text-lg"
          >
            Nøkkeltall
          </h2>
        </div>
        <WorkspaceOperationalDashboard workspaceId={workspaceId} />
      </section>

      <section className="space-y-4">
        <div>
          <p className="text-muted-foreground text-[11px] font-semibold uppercase tracking-[0.12em]">
            Navigasjon
          </p>
          <h2 className="font-heading mt-1 text-base font-semibold tracking-tight text-foreground sm:text-lg">
            Snarveier
          </h2>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shortcuts.map(({ href, title, desc, icon: Icon }) => (
            <li key={href}>
              <Link
                href={href}
                className="hover:border-primary/30 flex min-h-[52px] gap-3 rounded-2xl border border-border/45 bg-card p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] ring-1 ring-black/[0.03] transition-all hover:bg-muted/35 hover:shadow-md dark:ring-white/[0.05]"
              >
                <div className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-primary/12">
                  <Icon className="size-5" aria-hidden />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold leading-snug">{title}</p>
                  <p className="text-muted-foreground mt-0.5 text-xs leading-snug">
                    {desc}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-4">
        <div>
          <p className="text-muted-foreground text-[11px] font-semibold uppercase tracking-[0.12em]">
            Hjelp
          </p>
          <h2 className="font-heading mt-1 text-base font-semibold tracking-tight text-foreground sm:text-lg">
            Begreper
          </h2>
        </div>
        <Card className="rounded-2xl border-border/40 bg-muted/15 shadow-[0_1px_3px_rgba(0,0,0,0.03)] ring-1 ring-black/[0.03] dark:ring-white/[0.05]">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">
              Prosess, vurdering og ROS
            </CardTitle>
            <CardDescription className="text-sm leading-relaxed">
              <strong className="text-foreground">Prosessregisteret</strong> (
              {candidates.length}{" "}
              {candidates.length === 1 ? "prosess" : "prosesser"}) lister
              prosesser med ID. En{" "}
              <strong className="text-foreground">vurdering</strong> er én
              automatiseringssak (skjema, prioritet, pipeline-status).{" "}
              <strong className="text-foreground">ROS</strong> er
              risikoanalyse og kobles til vurderinger ved behov — uavhengig av
              registeret.
            </CardDescription>
          </CardHeader>
        </Card>
      </section>
    </div>
  );
}
