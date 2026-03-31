"use client";

import { Button } from "@/components/ui/button";
import { useWorkspaceChromeOptional } from "@/components/workspace/workspace-chrome-context";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import { Menu, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

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
  const [isDesktop, setIsDesktop] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    setIsDesktop(mq.matches);
    const onChange = () => setIsDesktop(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

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

  return (
    <div className="flex min-h-full flex-col bg-background">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/90 pt-[env(safe-area-inset-top)] shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-background/75">
        <div className="mx-auto flex h-14 w-full max-w-[100rem] items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-4">
            {workspaceChrome?.hasWorkspace ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0 rounded-lg"
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
                <Menu className="size-5" />
              </Button>
            ) : null}
            <nav className="flex min-w-0 items-center gap-4 text-sm font-medium sm:gap-6">
              <Link
                href="/dashboard"
                className="font-heading shrink-0 text-base font-semibold tracking-tight text-foreground"
              >
                PVV
              </Link>
              <Link
                href="/dashboard"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                Arbeidsområder
              </Link>
            </nav>
            {workspaceChrome?.hasWorkspace ? (
              <span
                className="text-muted-foreground hidden min-w-0 truncate text-sm font-medium md:inline"
                title={workspaceChrome.workspaceName}
              >
                {workspaceChrome.workspaceName}
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-1">
            {mounted ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="rounded-lg text-muted-foreground"
                aria-label={
                  resolvedTheme === "dark"
                    ? "Bytt til lyst tema"
                    : "Bytt til mørkt tema"
                }
                onClick={() =>
                  setTheme(resolvedTheme === "dark" ? "light" : "dark")
                }
              >
                {resolvedTheme === "dark" ? (
                  <Sun className="size-5" />
                ) : (
                  <Moon className="size-5" />
                )}
              </Button>
            ) : (
              <span className="size-9 shrink-0" aria-hidden />
            )}
            <Button
              variant="ghost"
              size="sm"
              className="rounded-lg text-muted-foreground"
              onClick={() => void signOut()}
            >
              Logg ut
            </Button>
          </div>
        </div>
      </header>
      <main className="flex min-h-0 w-full flex-1 flex-col pb-[env(safe-area-inset-bottom)]">
        {children}
      </main>
    </div>
  );
}
