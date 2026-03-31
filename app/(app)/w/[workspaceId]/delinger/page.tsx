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
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Delinger</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Styr hvem som har tilgang til arbeidsområdet, og forstå hvordan
          enkeltvurderinger kan deles med teamet.
        </p>
      </div>

      <WorkspaceTeamPanel workspaceId={workspaceId} />

      <Card>
        <CardHeader>
          <CardTitle>Vurderingsdeling</CardTitle>
          <CardDescription>
            Hver vurdering kan deles med utvalgte personer (roller) eller med
            hele arbeidsområdet når du har redigeringstilgang.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm leading-relaxed">
          <p>
            Åpne en vurdering og bruk fanen <strong>Samarbeid</strong> for å
            invitere e-postadresser og sette{" "}
            <strong>«Delt med workspace»</strong> der det er tillatt.
          </p>
          <p className="mt-3">
            <Link
              href={`/w/${wid}/vurderinger`}
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Gå til vurderinger
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
