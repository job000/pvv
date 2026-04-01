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
    <div className="space-y-4">
      <header className="border-border/60 border-b pb-3">
        <h1 className="font-heading text-lg font-semibold tracking-tight text-foreground sm:text-xl">
          Varslinger
        </h1>
      </header>

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
