"use client";

import { UserSettingsPanel } from "@/components/user/user-settings-panel";

export default function UserSettingsPage() {
  return (
    <div className="from-muted/35 via-background to-background min-h-full bg-gradient-to-b">
      <div className="mx-auto max-w-3xl px-4 pb-20 pt-6 sm:px-6 sm:pt-8 lg:px-8">
        <header className="border-border/60 mb-6 border-b pb-3">
          <h1 className="font-heading text-lg font-semibold tracking-tight text-foreground sm:text-xl">
            Brukerinnstillinger
          </h1>
        </header>
        <UserSettingsPanel />
      </div>
    </div>
  );
}
