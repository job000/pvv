"use client";

import { BrandMark } from "@/components/brand-mark";
import { ThemeModeToggle } from "@/components/theme-mode-toggle";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { PRODUCT_NAME } from "@/lib/brand";
import { cn } from "@/lib/utils";
import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, LogOut } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo } from "react";

import { useWorkspaceChrome } from "./workspace-chrome-context";
import { WorkspaceNav } from "./workspace-nav";

function DrawerFooter({ onNavigate }: { onNavigate?: () => void }) {
  const { signOut } = useAuthActions();
  const patchUserSettings = useMutation(api.users.patchMyUserSettings);

  return (
    <div className="shrink-0 space-y-1 border-t border-border/40 p-3">
      <Link
        href="/dashboard?oversikt=1"
        onClick={onNavigate}
        className={cn(
          "text-muted-foreground hover:text-foreground hover:bg-muted/70 active:bg-muted",
          "flex min-h-11 items-center gap-2.5 rounded-xl px-3 text-sm font-medium transition-colors touch-manipulation",
        )}
      >
        <BrandMark size={22} decorative />
        <span className="min-w-0 flex-1 truncate">Alle områder</span>
        <ArrowLeft className="size-4 opacity-50" aria-hidden />
      </Link>

      {/* Tema + logg ut — synlig i drawer på mobil (skjult i toppbar) */}
      <div className="space-y-2 md:hidden">
        <div className="flex items-center justify-between gap-3 rounded-xl px-1">
          <span className="text-muted-foreground text-sm">Utseende</span>
          <ThemeModeToggle
            className="size-11 rounded-xl"
            onThemeChange={(value) => {
              void patchUserSettings({ themePreference: value });
            }}
          />
        </div>
        <Button
          type="button"
          variant="ghost"
          className="text-muted-foreground hover:text-foreground h-11 w-full justify-start gap-2 rounded-xl px-3"
          onClick={() => {
            onNavigate?.();
            void signOut();
          }}
        >
          <LogOut className="size-4 opacity-70" aria-hidden />
          Logg ut
        </Button>
        <p className="text-muted-foreground/70 px-1 text-[0.65rem]">
          {PRODUCT_NAME}
        </p>
      </div>
    </div>
  );
}

export function WorkspaceShell({
  workspaceId,
  children,
}: {
  workspaceId: Id<"workspaces">;
  children: React.ReactNode;
}) {
  const workspace = useQuery(api.workspaces.get, { workspaceId });
  const { sidebarCollapsed, mobileOpen, setMobileOpen, syncWorkspace } =
    useWorkspaceChrome();

  const name = useMemo(() => {
    if (workspace === undefined) return "Laster …";
    if (workspace === null) return "…";
    return workspace.name ?? "…";
  }, [workspace]);

  useEffect(() => {
    syncWorkspace(name, true);
    return () => syncWorkspace("", false);
  }, [name, syncWorkspace]);

  const showDesktopSidebar =
    !sidebarCollapsed && workspace !== null && workspace !== undefined;

  return (
    <div
      className={cn(
        "relative flex min-h-0 flex-1 flex-col",
        showDesktopSidebar && "md:ml-64",
      )}
    >
      {showDesktopSidebar ? (
        <aside
          className={cn(
            "fixed left-0 top-[var(--app-header-height,3.5rem)] z-30 hidden h-[calc(100dvh-var(--app-header-height,3.5rem))] w-64 flex-col overflow-hidden md:flex",
            "border-border/40 bg-card/50 border-r backdrop-blur-md",
          )}
          aria-label="Arbeidsområde-meny"
        >
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <WorkspaceNav
              workspaceId={workspaceId}
              workspaceName={workspace === null ? undefined : name}
            />
          </div>
          <DrawerFooter />
        </aside>
      ) : null}

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          className="bg-background/98 border-border/40 p-0 backdrop-blur-xl"
        >
          <div className="flex h-full max-h-[100dvh] flex-col overflow-hidden">
            <div className="min-h-0 flex-1 overflow-hidden">
              <WorkspaceNav
                workspaceId={workspaceId}
                workspaceName={workspace === null ? undefined : name}
                onNavigate={() => setMobileOpen(false)}
                onClose={() => setMobileOpen(false)}
              />
            </div>
            <DrawerFooter onNavigate={() => setMobileOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      <div className="mx-auto min-h-0 w-full max-w-[min(100%,var(--page-max-width))] flex-1 overflow-y-auto px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] [overflow-anchor:none] sm:px-8 sm:py-6 lg:px-10">
        {children}
      </div>
    </div>
  );
}
