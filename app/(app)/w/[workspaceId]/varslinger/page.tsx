"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

export default function WorkspaceNotificationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Varslinger</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Velg hvordan du vil bli holdt orientert om invitasjoner og endringer.
          Utvides med e-post og in-app-varsler.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Preferanser</CardTitle>
          <CardDescription>
            Disse valgene er forberedt; aktivering kommer i en senere versjon.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between gap-4 opacity-60">
            <div>
              <Label className="text-base">E-post ved ny invitasjon</Label>
              <p className="text-muted-foreground text-xs">
                Når noen inviterer deg til en vurdering eller workspace
              </p>
            </div>
            <input type="checkbox" disabled className="size-4" />
          </div>
          <Separator />
          <div className="flex items-center justify-between gap-4 opacity-60">
            <div>
              <Label className="text-base">Påminnelse om utkast</Label>
              <p className="text-muted-foreground text-xs">
                Ukentlig sammendrag av åpne vurderinger
              </p>
            </div>
            <input type="checkbox" disabled className="size-4" />
          </div>
          <Separator />
          <div className="flex items-center justify-between gap-4 opacity-60">
            <div>
              <Label className="text-base">Sikkerhetsvarsler</Label>
              <p className="text-muted-foreground text-xs">
                Innlogging fra ny enhet (kommer)
              </p>
            </div>
            <input type="checkbox" disabled className="size-4" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
