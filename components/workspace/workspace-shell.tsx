"use client";

import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useQuery } from "convex/react";
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
        showDesktopSidebar && "md:ml-[15.5rem]",
      )}
    >
      {showDesktopSidebar ? (
        <aside
          className="fixed left-0 top-14 z-30 hidden h-[calc(100vh-3.5rem)] w-[15.5rem] flex-col overflow-hidden border-r border-border/60 bg-gradient-to-b from-muted/60 via-muted/35 to-muted/20 md:flex"
          aria-hidden={false}
        >
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <WorkspaceNav
              workspaceId={workspaceId}
              workspaceName={workspace === null ? undefined : name}
            />
          </div>
          <div className="shrink-0 border-t border-border/60 bg-background/40 p-2 backdrop-blur-sm">
            <Link
              href="/dashboard"
              className="text-muted-foreground hover:text-foreground block rounded-lg px-3 py-2 text-xs transition-colors"
            >
              ← Alle arbeidsområder
            </Link>
          </div>
        </aside>
      ) : null}

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="border-border/60 bg-background p-0 shadow-2xl">
          <div className="flex h-full max-h-[100dvh] flex-col overflow-hidden">
            <div className="min-h-0 flex-1 overflow-hidden">
              <WorkspaceNav
                workspaceId={workspaceId}
                workspaceName={workspace === null ? undefined : name}
                onNavigate={() => setMobileOpen(false)}
              />
            </div>
            <div className="shrink-0 border-t border-border/60 bg-muted/20 p-3">
              <Link
                href="/dashboard"
                onClick={() => setMobileOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm transition-colors"
              >
                ← Alle arbeidsområder
              </Link>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <div className="mx-auto min-h-0 w-full max-w-6xl flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        {children}
      </div>
    </div>
  );
}
