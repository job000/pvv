"use client";

import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo } from "react";

import { useWorkspaceChrome } from "./workspace-chrome-context";
import { WorkspaceNav } from "./workspace-nav";

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
        showDesktopSidebar && "md:ml-[16rem]",
      )}
    >
      {showDesktopSidebar ? (
        <aside
          className={cn(
            "fixed left-0 top-[var(--app-header-height,3.5rem)] z-30 hidden h-[calc(100dvh-var(--app-header-height,3.5rem))] w-64 flex-col overflow-hidden md:flex",
            "border-border/40 bg-card/40 border-r backdrop-blur-md",
          )}
          aria-label="Arbeidsområde-meny"
        >
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <WorkspaceNav
              workspaceId={workspaceId}
              workspaceName={workspace === null ? undefined : name}
            />
          </div>
          <div className="shrink-0 border-t border-border/40 p-3">
            <Link
              href="/dashboard?oversikt=1"
              className={cn(
                "text-muted-foreground hover:text-foreground hover:bg-muted/70",
                "flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-medium transition-colors",
              )}
            >
              <ArrowLeft className="size-4 opacity-70" aria-hidden />
              Alle områder
            </Link>
          </div>
        </aside>
      ) : null}

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          className="bg-background/95 border-border/40 p-0 backdrop-blur-xl"
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
            <div className="shrink-0 border-t border-border/40 p-3">
              <Link
                href="/dashboard?oversikt=1"
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "text-muted-foreground hover:text-foreground hover:bg-muted/70",
                  "flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-medium transition-colors",
                )}
              >
                <ArrowLeft className="size-4 opacity-70" aria-hidden />
                Alle områder
              </Link>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <div className="mx-auto min-h-0 w-full max-w-[min(100%,var(--page-max-width))] flex-1 overflow-y-auto px-[var(--spacing-page-x,1rem)] py-4 pb-[max(1rem,env(safe-area-inset-bottom))] [overflow-anchor:none] sm:px-6 sm:py-5">
        {children}
      </div>
    </div>
  );
}
