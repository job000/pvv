"use client";

import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { ProductLoadingBlock } from "@/components/product";
import { UserSettingsPanel } from "@/components/user/user-settings-panel";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import { Settings } from "lucide-react";

export default function UserSettingsPage() {
  const myWorkspaces = useQuery(api.workspaces.listMine);
  const settings = useQuery(api.workspaces.getMySettings);

  if (myWorkspaces === undefined) {
    return <ProductLoadingBlock label="Laster …" className="min-h-[50vh]" />;
  }

  const defaultId = settings?.defaultWorkspaceId ?? null;

  return (
    <DashboardLayout workspaces={myWorkspaces} defaultWorkspaceId={defaultId}>
      <div className="mx-auto max-w-3xl space-y-6 px-5 pb-20 pt-6 sm:px-8 lg:px-10">
        <header>
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Settings className="size-3.5" aria-hidden />
            Konto
          </p>
          <h1 className="mt-1 font-heading text-2xl font-semibold tracking-tight">
            Innstillinger
          </h1>
        </header>
        <UserSettingsPanel />
      </div>
    </DashboardLayout>
  );
}
