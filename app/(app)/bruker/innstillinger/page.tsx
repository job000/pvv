"use client";

import { UserSettingsPanel } from "@/components/user/user-settings-panel";
import { Sparkles } from "lucide-react";

export default function UserSettingsPage() {
  return (
    <div className="from-muted/35 via-background to-background min-h-full bg-gradient-to-b">
      <div className="mx-auto max-w-3xl px-4 pb-20 pt-8 sm:px-6 sm:pt-10 lg:px-8">
        <header className="mb-10 space-y-4">
          <p className="text-muted-foreground flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em]">
            <Sparkles className="text-primary size-3.5 shrink-0 opacity-80" aria-hidden />
            Konto
          </p>
          <div className="space-y-3">
            <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
              Brukerinnstillinger
            </h1>
            <p className="text-muted-foreground max-w-xl text-[15px] leading-relaxed sm:text-base">
              Tilpass profil, utseende og veiledning. Alt lagres på kontoen din og
              følger deg på tvers av arbeidsområder.
            </p>
          </div>
        </header>
        <UserSettingsPanel />
      </div>
    </div>
  );
}
