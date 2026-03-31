"use client";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  const assessments = useQuery(api.assessments.listByWorkspace, { workspaceId });
  const candidates = useQuery(api.candidates.listByWorkspace, { workspaceId });

  if (
    workspace === undefined ||
    membership === undefined ||
    assessments === undefined ||
    candidates === undefined
  ) {
    return <p className="text-muted-foreground text-sm">Laster …</p>;
  }

  if (workspace === null) {
    return (
      <p className="text-destructive text-sm">Fant ikke arbeidsområdet.</p>
    );
  }

  const wid = String(workspaceId);
  const recent = assessments.slice(0, 4);

  const shortcuts = [
    {
      href: `/w/${wid}/vurderinger`,
      title: "Vurderinger",
      desc: "Opprett og åpne RPA-vurderinger",
      icon: ClipboardList,
    },
    {
      href: `/w/${wid}/leveranse`,
      title: "Leveranse",
      desc: "Kanban, sprint og pipeline-status",
      icon: LayoutGrid,
    },
    {
      href: `/w/${wid}/organisasjon`,
      title: "Organisasjon",
      desc: "HF, avdeling, seksjon og merkantil kontakt",
      icon: Building2,
    },
    {
      href: `/w/${wid}/vurderinger?fane=prosesser`,
      title: "Prosesser",
      desc: "Stamdata og koder før PVV-saker",
      icon: Users,
    },
    {
      href: `/w/${wid}/ros`,
      title: "ROS",
      desc: "Maler og risikomatrise koblet til kandidat og PVV",
      icon: Shield,
    },
    {
      href: `/w/${wid}/delinger`,
      title: "Delinger",
      desc: "Team og tilgang",
      icon: Share2,
    },
    {
      href: `/w/${wid}/varslinger`,
      title: "Varslinger",
      desc: "Preferanser for påminnelser",
      icon: Bell,
    },
    {
      href: `/w/${wid}/innstillinger`,
      title: "Innstillinger",
      desc: "Navn og notater for området",
      icon: Settings2,
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-2xl font-semibold">{workspace.name}</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Din rolle i arbeidsområdet:{" "}
          <span className="text-foreground font-medium">
            {membership?.role
              ? WORKSPACE_ROLE_LABEL_NB[membership.role] ?? membership.role
              : "—"}
          </span>
          . Bruk menyen til venstre for å navigere.
        </p>
        {workspace.notes ? (
          <p className="mt-4 rounded-xl border bg-muted/30 px-4 py-3 text-sm leading-relaxed">
            {workspace.notes}
          </p>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-2xl font-semibold tabular-nums">
              {assessments.length}
            </CardTitle>
            <CardDescription>vurderinger</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-2xl font-semibold tabular-nums">
              {candidates.length}
            </CardTitle>
            <CardDescription>prosesser</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium leading-snug">
              Prioritet
            </CardTitle>
            <CardDescription>
              Beregnes ut fra skjemaet i hver vurdering
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      <section className="space-y-3">
        <h2 className="font-medium text-sm">Hurtiglenker</h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shortcuts.map(({ href, title, desc, icon: Icon }) => (
            <li key={href}>
              <Link
                href={href}
                className="flex gap-3 rounded-xl border bg-card p-4 transition hover:bg-muted/40"
              >
                <Icon className="text-muted-foreground mt-0.5 size-5 shrink-0" />
                <div>
                  <p className="font-medium">{title}</p>
                  <p className="text-muted-foreground text-xs">{desc}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-medium text-sm">Siste vurderinger</h2>
          <Link
            href={`/w/${wid}/vurderinger`}
            className="text-muted-foreground text-xs hover:text-foreground"
          >
            Se alle
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Ingen vurderinger ennå — start under{" "}
            <Link href={`/w/${wid}/vurderinger`} className="underline">
              Vurderinger
            </Link>
            .
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {recent.map((a) => (
              <li key={a._id}>
                <Link
                  href={`/w/${wid}/a/${a._id}`}
                  className="block rounded-xl border bg-card p-4 transition hover:bg-muted/40"
                >
                  <span className="font-medium">{a.title}</span>
                  <span className="mt-1 block text-muted-foreground text-xs">
                    {new Date(a.updatedAt).toLocaleString("nb-NO", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
