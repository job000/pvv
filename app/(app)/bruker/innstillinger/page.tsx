"use client";

import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { ProductLoadingBlock } from "@/components/product";
import { UserSettingsPanel } from "@/components/user/user-settings-panel";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";

export default function UserSettingsPage() {
  const myWorkspaces = useQuery(api.workspaces.listMine);
  const settings = useQuery(api.workspaces.getMySettings);

  if (myWorkspaces === undefined) {
    return <ProductLoadingBlock label="Laster …" className="min-h-[50vh]" />;
  }

  const defaultId = settings?.defaultWorkspaceId ?? null;

  return (
    <DashboardLayout workspaces={myWorkspaces} defaultWorkspaceId={defaultId}>
      <div className="mx-auto max-w-3xl space-y-8 px-5 pb-20 pt-6 sm:px-8 lg:px-10">
        <header className="space-y-1">
          <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
            Innstillinger
          </h1>
          <p className="text-sm text-muted-foreground">
            Profil og preferanser for kontoen din.
          </p>
        </header>
        <UserSettingsPanel />
      </div>
    </DashboardLayout>
  );
}
