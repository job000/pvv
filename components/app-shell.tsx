"use client";

import { Button } from "@/components/ui/button";
import { UserAvatarNav } from "@/components/user/user-avatar-nav";
import { useWorkspaceChromeOptional } from "@/components/workspace/workspace-chrome-context";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useMutation } from "convex/react";
import { LogOut, Menu, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";

function subscribeMediaQuery(callback: () => void) {
  const mq = window.matchMedia("(min-width: 768px)");
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

function getMediaQueryDesktop() {
  return window.matchMedia("(min-width: 768px)").matches;
}

function subscribeNoop() {
  return () => {};
}

export function AppShell({
  children,
  requireAuth = true,
}: {
  children: React.ReactNode;
  requireAuth?: boolean;
}) {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const { signOut } = useAuthActions();
  const router = useRouter();
  const pathname = usePathname();
  const workspaceChrome = useWorkspaceChromeOptional();
  const isDesktop = useSyncExternalStore(
    subscribeMediaQuery,
    getMediaQueryDesktop,
    () => false,
  );
  const isClient = useSyncExternalStore(subscribeNoop, () => true, () => false);
  const { resolvedTheme, setTheme } = useTheme();
  const patchUserSettings = useMutation(api.users.patchMyUserSettings);

  useEffect(() => {
    if (!requireAuth || isLoading) return;
    if (!isAuthenticated) {
      router.replace(`/sign-in?next=${encodeURIComponent(pathname || "/dashboard")}`);
    }
  }, [requireAuth, isLoading, isAuthenticated, router, pathname]);

  if (requireAuth && (isLoading || !isAuthenticated)) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-2 px-4">
        <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-muted-foreground text-sm">Laster …</p>
      </div>
    );
  }

  const workspacesNavActive =
    pathname === "/dashboard" || (pathname?.startsWith("/w/") ?? false);

  return (
    <div className="flex min-h-full flex-col bg-background">
      <header className="sticky top-0 z-40 pt-[env(safe-area-inset-top)]">
        <div className="border-border/50 from-background/98 via-background/92 to-muted/15 bg-gradient-to-b border-b shadow-[0_8px_30px_-12px_rgba(0,0,0,0.12)] backdrop-blur-xl dark:shadow-[0_8px_32px_-12px_rgba(0,0,0,0.45)] supports-[backdrop-filter]:backdrop-saturate-150">
          <div className="mx-auto flex min-h-14 w-full max-w-[100rem] items-center justify-between gap-3 px-3 py-2 sm:gap-4 sm:px-6">
            <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
              {workspaceChrome?.hasWorkspace ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:bg-muted/80 hover:text-foreground size-10 shrink-0 rounded-xl"
                  aria-label={
                    isDesktop
                      ? workspaceChrome.sidebarCollapsed
                        ? "Vis arbeidsområde-meny"
                        : "Skjul arbeidsområde-meny"
                      : workspaceChrome.mobileOpen
                        ? "Lukk meny"
                        : "Åpne meny"
                  }
                  aria-expanded={
                    isDesktop
                      ? !workspaceChrome.sidebarCollapsed
                      : workspaceChrome.mobileOpen
                  }
                  onClick={() => workspaceChrome.toggleMenu()}
                >
                  <Menu className="size-[1.35rem]" strokeWidth={2} />
                </Button>
              ) : null}
              <nav
                className="flex min-w-0 items-center gap-1.5 sm:gap-2"
                aria-label="Hovednavigasjon"
              >
                <Link
                  href="/dashboard?oversikt=1"
                  className="font-heading bg-primary/10 text-primary hover:bg-primary/[0.14] focus-visible:ring-ring shrink-0 rounded-xl px-2.5 py-1.5 text-sm font-semibold tracking-tight shadow-sm ring-1 ring-primary/15 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                >
                  FRO
                </Link>
                <Link
                  href="/dashboard?oversikt=1"
                  className={cn(
                    "rounded-full px-3 py-1.5 text-sm font-medium transition-all",
                    workspacesNavActive
                      ? "bg-background text-foreground shadow-sm ring-1 ring-border/90"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  )}
                >
                  Arbeidsområder
                </Link>
              </nav>
              {workspaceChrome?.hasWorkspace ? (
                <span
                  className="border-border/55 bg-muted/35 text-muted-foreground hidden min-w-0 max-w-[min(100%,14rem)] truncate rounded-full border px-2.5 py-1 text-xs font-medium md:inline-flex md:items-center"
                  title={workspaceChrome.workspaceName}
                >
                  {workspaceChrome.workspaceName}
                </span>
              ) : null}
            </div>

            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              <div className="border-border/55 bg-muted/25 flex items-center gap-0.5 rounded-2xl border p-1 shadow-inner">
                <UserAvatarNav />
                {isClient ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:bg-background/90 size-10 shrink-0 rounded-xl"
                    aria-label={
                      resolvedTheme === "dark"
                        ? "Bytt til lyst tema"
                        : "Bytt til mørkt tema"
                    }
                    onClick={() => {
                      const next = resolvedTheme === "dark" ? "light" : "dark";
                      setTheme(next);
                      void patchUserSettings({ themePreference: next });
                    }}
                  >
                    {resolvedTheme === "dark" ? (
                      <Sun className="size-[1.2rem]" />
                    ) : (
                      <Moon className="size-[1.2rem]" />
                    )}
                  </Button>
                ) : (
                  <span className="size-10 shrink-0" aria-hidden />
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground hidden h-10 gap-2 rounded-xl px-3 font-medium sm:inline-flex"
                onClick={() => void signOut()}
              >
                <LogOut className="size-4 opacity-70" aria-hidden />
                Logg ut
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-foreground size-10 rounded-xl sm:hidden"
                aria-label="Logg ut"
                onClick={() => void signOut()}
              >
                <LogOut className="size-[1.15rem]" aria-hidden />
              </Button>
            </div>
          </div>
        </div>
      </header>
      <main className="flex min-h-0 w-full flex-1 flex-col pb-[env(safe-area-inset-bottom)]">
        {children}
      </main>
    </div>
  );
}
