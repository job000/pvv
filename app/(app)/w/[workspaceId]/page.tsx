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
  LayoutGrid,
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
      href: `/w/${wid}/leveranse`,
      title: "Leveranse",
      desc: "Pipeline, sprint og prioritering",
      icon: LayoutGrid,
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
    <div className="space-y-10">
      <header className="space-y-2 border-b border-border/50 pb-6">
        <p className="text-muted-foreground text-[0.65rem] font-semibold uppercase tracking-[0.14em]">
          Oversikt
        </p>
        <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
          {workspace.name}
        </h1>
        <p className="text-muted-foreground max-w-prose text-sm leading-relaxed">
          Rolle:{" "}
          <span className="text-foreground font-medium">
            {membership?.role
              ? WORKSPACE_ROLE_LABEL_NB[membership.role] ?? membership.role
              : "—"}
          </span>
          . Nøkkeltall, ROS-koblinger og siste aktivitet for arbeidsområdet.
        </p>
        {workspace.notes ? (
          <p className="mt-3 rounded-xl border border-border/60 bg-muted/25 px-4 py-3 text-sm leading-relaxed">
            {workspace.notes}
          </p>
        ) : null}
      </header>

      <section aria-labelledby="dash-metrics-heading" className="space-y-4">
        <h2
          id="dash-metrics-heading"
          className="font-heading text-base font-semibold tracking-tight"
        >
          Nøkkeltall
        </h2>
        <WorkspaceOperationalDashboard workspaceId={workspaceId} />
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-base font-semibold tracking-tight">
          Snarveier
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shortcuts.map(({ href, title, desc, icon: Icon }) => (
            <li key={href}>
              <Link
                href={href}
                className="hover:border-primary/35 flex gap-3 rounded-xl border border-border/60 bg-card p-4 shadow-sm transition-all hover:bg-muted/40 hover:shadow-md"
              >
                <Icon className="text-muted-foreground mt-0.5 size-5 shrink-0" />
                <div className="min-w-0">
                  <p className="font-medium leading-snug">{title}</p>
                  <p className="text-muted-foreground mt-0.5 text-xs leading-snug">
                    {desc}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-base font-semibold tracking-tight">
          Begreper
        </h2>
        <Card className="border-border/60 bg-muted/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Prosess, vurdering og ROS</CardTitle>
            <CardDescription className="text-sm leading-relaxed">
              <strong className="text-foreground">Prosessregisteret</strong> (
              {candidates.length}{" "}
              {candidates.length === 1 ? "prosess" : "prosesser"}) lister
              prosesser med ID. En{" "}
              <strong className="text-foreground">vurdering</strong> er én
              automatiseringssak (skjema, prioritet, leveranse).{" "}
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
