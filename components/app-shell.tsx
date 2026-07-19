"use client";

import { BrandMark } from "@/components/brand-mark";
import {
  COMMAND_PALETTE_EVENT,
  CommandPalette,
} from "@/components/command-palette";
import { ThemeModeToggle } from "@/components/theme-mode-toggle";
import { Button } from "@/components/ui/button";
import { InAppNotificationMenu } from "@/components/user/in-app-notification-menu";
import { UserAvatarNav } from "@/components/user/user-avatar-nav";
import { useWorkspaceChromeOptional } from "@/components/workspace/workspace-chrome-context";
import { WorkspaceSwitcher } from "@/components/workspace/workspace-switcher";
import { api } from "@/convex/_generated/api";
import { PRODUCT_NAME } from "@/lib/brand";
import { cn } from "@/lib/utils";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useMutation } from "convex/react";
import { LogOut, Menu, PanelLeftClose, Search } from "lucide-react";
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
  const patchUserSettings = useMutation(api.users.patchMyUserSettings);

  useEffect(() => {
    if (!requireAuth || isLoading) return;
    if (!isAuthenticated) {
      const timeout = setTimeout(() => {
        router.replace(
          `/sign-in?next=${encodeURIComponent(pathname || "/dashboard")}`,
        );
      }, 1500);
      return () => clearTimeout(timeout);
    }
  }, [requireAuth, isLoading, isAuthenticated, router, pathname]);

  const setMobileOpen = workspaceChrome?.setMobileOpen;

  // Rydd opp etter sheet/drawer når vi bytter rute (f.eks. arbeidsområde → oversikt).
  useEffect(() => {
    document.body.style.overflow = "";
    setMobileOpen?.(false);
  }, [pathname, setMobileOpen]);

  if (requireAuth && (isLoading || !isAuthenticated)) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-2 px-4">
        <div className="border-primary size-8 animate-spin rounded-full border-2 border-t-transparent" />
        <p suppressHydrationWarning className="text-muted-foreground text-sm">
          Laster ...
        </p>
      </div>
    );
  }

  const inWorkspace = Boolean(workspaceChrome?.hasWorkspace);
  const inDashboardNav = Boolean(workspaceChrome?.hasDashboardNav);
  const showMenuButton = inWorkspace || inDashboardNav;
  const menuOpen = isDesktop
    ? !workspaceChrome?.sidebarCollapsed
    : Boolean(workspaceChrome?.mobileOpen);

  return (
    <div className="bg-background flex min-h-full min-w-0 flex-col overflow-x-clip">
      <header className="sticky top-0 z-40 pt-[env(safe-area-inset-top)]">
        <div
          className={cn(
            "border-border/40 bg-background/85 border-b backdrop-blur-xl",
            "supports-[backdrop-filter]:bg-background/70",
          )}
        >
          <div
            className={cn(
              "mx-auto flex w-full max-w-[100rem] items-center gap-1",
              "h-[var(--app-header-height,3.5rem)] px-2 sm:gap-2 sm:px-4",
            )}
          >
            {/* Left cluster */}
            <div className="flex min-w-0 flex-1 items-center gap-0.5 sm:gap-1.5">
              {showMenuButton ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "text-muted-foreground hover:text-foreground size-10 shrink-0 rounded-xl touch-manipulation",
                    menuOpen && "bg-muted text-foreground",
                  )}
                  aria-label={
                    isDesktop
                      ? menuOpen
                        ? "Skjul meny"
                        : "Vis meny"
                      : menuOpen
                        ? "Lukk meny"
                        : "Åpne meny"
                  }
                  aria-expanded={menuOpen}
                  onClick={() => workspaceChrome?.toggleMenu()}
                >
                  {menuOpen && isDesktop ? (
                    <PanelLeftClose className="size-5" strokeWidth={1.75} />
                  ) : (
                    <Menu className="size-5" strokeWidth={1.75} />
                  )}
                </Button>
              ) : null}

              {/* Logo: alltid på desktop; på mobil kun utenfor workspace */}
              <Link
                href="/dashboard?oversikt=1"
                className={cn(
                  "focus-visible:ring-ring inline-flex shrink-0 rounded-xl p-0.5 transition-transform active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2",
                  inWorkspace && "hidden md:inline-flex",
                )}
                aria-label={`${PRODUCT_NAME} — oversikt`}
              >
                <BrandMark size={28} decorative className="shadow-sm" />
              </Link>

              {inWorkspace && workspaceChrome?.workspaceName ? (
                <WorkspaceSwitcher
                  workspaceName={workspaceChrome.workspaceName}
                  className="min-w-0 flex-1 md:flex-none"
                />
              ) : (
                <span className="text-muted-foreground truncate text-sm font-medium">
                  {workspaceChrome?.dashboardTitle ?? "Oversikt"}
                </span>
              )}
            </div>

            {/* Right: keep lean on mobile */}
            <div className="flex shrink-0 items-center gap-0.5">
              {/* Søk / kommandopalett (⌘K) */}
              <button
                type="button"
                onClick={() =>
                  window.dispatchEvent(new CustomEvent(COMMAND_PALETTE_EVENT))
                }
                className="text-muted-foreground hover:border-border hover:text-foreground border-border/60 bg-muted/30 mr-1 hidden h-9 w-56 items-center gap-2.5 rounded-xl border px-3 text-sm transition-colors md:inline-flex"
                aria-label="Søk og kommandoer (⌘K)"
              >
                <Search className="size-3.5 shrink-0" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-left font-normal">
                  Søk …
                </span>
                <kbd className="border-border/60 bg-background text-muted-foreground shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-medium">
                  ⌘K
                </kbd>
              </button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-foreground size-10 rounded-xl md:hidden"
                aria-label="Søk og kommandoer"
                onClick={() =>
                  window.dispatchEvent(new CustomEvent(COMMAND_PALETTE_EVENT))
                }
              >
                <Search className="size-5" aria-hidden />
              </Button>
              <InAppNotificationMenu />
              <UserAvatarNav />
              <div className="hidden items-center gap-0.5 md:flex">
                <ThemeModeToggle
                  className="size-10 rounded-xl"
                  onThemeChange={(value) => {
                    void patchUserSettings({ themePreference: value });
                  }}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-foreground size-10 rounded-xl"
                  aria-label="Logg ut"
                  title="Logg ut"
                  onClick={() => void signOut()}
                >
                  <LogOut className="size-[1.15rem]" aria-hidden />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="flex min-h-0 w-full flex-1 flex-col pb-[env(safe-area-inset-bottom)]">
        {children}
      </main>

      {isAuthenticated ? <CommandPalette /> : null}
    </div>
  );
}
