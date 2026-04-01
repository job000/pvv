"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { WorkspaceTeamPanel } from "@/components/workspace/workspace-panels";
import type { Id } from "@/convex/_generated/dataModel";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function WorkspaceSharingPage() {
  const params = useParams();
  const workspaceId = params.workspaceId as Id<"workspaces">;
  const wid = String(workspaceId);

  return (
    <div className="space-y-6">
      <header className="border-border/60 border-b pb-3">
        <h1 className="font-heading text-lg font-semibold tracking-tight text-foreground sm:text-xl">
          Team og tilgang
        </h1>
      </header>

      <WorkspaceTeamPanel workspaceId={workspaceId} />

      <Card>
        <CardHeader>
          <CardTitle>Vurderinger og arbeidsområde</CardTitle>
          <CardDescription>
            To nivåer: team i arbeidsområdet (over), og valgfritt eget team per
            vurdering med egne roller.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground space-y-4 text-sm leading-relaxed">
          <ul className="list-inside list-disc space-y-2">
            <li>
              <strong className="text-foreground">Arbeidsområde:</strong> alle som
              er invitert deler prosessregister, ROS og organisasjonsdata.
              Administratorer bestemmer hvem som er med og med hvilken rolle.
            </li>
            <li>
              <strong className="text-foreground">Én vurdering:</strong> åpne
              saken og bruk <strong>Samarbeid</strong> for invitasjon per
              e-post, roller på saken, fjerne noen, trekke ventende invitasjoner
              og <strong>delt med arbeidsområdet</strong> (synlig for medlemmer
              og høyere når det er slått på).
            </li>
          </ul>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            <Link
              href={`/w/${wid}/vurderinger`}
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Vurderinger
            </Link>
            <Link
              href={`/w/${wid}/ros`}
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              ROS
            </Link>
            <Link
              href={`/w/${wid}`}
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Arbeidsområde (oversikt)
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
