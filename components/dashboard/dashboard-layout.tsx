"use client";

import { BrandMark } from "@/components/brand-mark";
import { ThemeModeToggle } from "@/components/theme-mode-toggle";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useWorkspaceChrome } from "@/components/workspace/workspace-chrome-context";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { PRODUCT_NAME } from "@/lib/brand";
import { cn } from "@/lib/utils";
import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import {
  LayoutDashboard,
  LogOut,
  Settings,
  ShieldCheck,
  Star,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

type WorkspaceRow = {
  workspace: Doc<"workspaces">;
  role: string;
};

const AVATAR_TONES = [
  "bg-sky-500/15 text-sky-800 dark:text-sky-200",
  "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200",
  "bg-amber-500/15 text-amber-900 dark:text-amber-200",
  "bg-violet-500/15 text-violet-800 dark:text-violet-200",
  "bg-rose-500/15 text-rose-800 dark:text-rose-200",
  "bg-teal-500/15 text-teal-800 dark:text-teal-200",
] as const;

function avatarTone(name: string): string {
  let n = 0;
  for (let i = 0; i < name.length; i++) n += name.charCodeAt(i) * (i + 3);
  return AVATAR_TONES[n % AVATAR_TONES.length]!;
}

function roleLabel(role: string): string {
  if (role === "owner") return "Eier";
  if (role === "admin") return "Admin";
  if (role === "viewer") return "Visning";
  return "Medlem";
}

function dashboardTitleForPath(pathname: string | null): string {
  if (pathname?.startsWith("/bruker/")) return "Innstillinger";
  if (pathname === "/superadmin") return "Superadmin";
  return "Oversikt";
}

export function DashboardLayout({
  workspaces,
  defaultWorkspaceId,
  children,
}: {
  workspaces: WorkspaceRow[];
  defaultWorkspaceId: Id<"workspaces"> | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const saAccess = useQuery(api.superAdmin.checkAccess);
  const {
    mobileOpen,
    setMobileOpen,
    sidebarCollapsed,
    syncDashboardNav,
  } = useWorkspaceChrome();

  useEffect(() => {
    syncDashboardNav(true, dashboardTitleForPath(pathname));
    return () => syncDashboardNav(false);
  }, [pathname, syncDashboardNav]);

  const showDesktopSidebar = !sidebarCollapsed;

  return (
    <div className="mx-auto flex w-full max-w-[100rem] flex-col md:flex-row md:items-start">
      {showDesktopSidebar ? (
        <aside
          className={cn(
            "sticky top-[var(--app-header-height,3.5rem)] z-30 hidden h-[calc(100dvh-var(--app-header-height,3.5rem))] w-64 shrink-0 flex-col md:flex",
            "border-r border-border/50 bg-muted/20",
          )}
          aria-label="Dashboard-meny"
        >
          <DashboardNavPanel
            workspaces={workspaces}
            defaultWorkspaceId={defaultWorkspaceId}
            pathname={pathname}
            showSuperAdmin={saAccess?.isSuperAdmin === true}
          />
        </aside>
      ) : null}

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          className="bg-background/98 border-border/40 p-0 backdrop-blur-xl"
        >
          <div className="flex h-full max-h-[100dvh] flex-col overflow-hidden">
            <div className="flex items-center justify-between gap-2 border-b border-border/40 px-3 py-3">
              <div className="flex min-w-0 items-center gap-2.5 px-1">
                <BrandMark size={22} decorative />
                <div className="min-w-0">
                  <p className="font-heading truncate text-sm font-semibold tracking-tight">
                    Puls
                  </p>
                  <p className="text-muted-foreground truncate text-[11px]">
                    Meny
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-10 shrink-0 rounded-xl"
                aria-label="Lukk meny"
                onClick={() => setMobileOpen(false)}
              >
                <X className="size-5" />
              </Button>
            </div>
            <DashboardNavPanel
              workspaces={workspaces}
              defaultWorkspaceId={defaultWorkspaceId}
              pathname={pathname}
              showSuperAdmin={saAccess?.isSuperAdmin === true}
              onNavigate={() => setMobileOpen(false)}
              mobileFooter
            />
          </div>
        </SheetContent>
      </Sheet>

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function DashboardNavPanel({
  workspaces,
  defaultWorkspaceId,
  pathname,
  showSuperAdmin,
  onNavigate,
  mobileFooter = false,
}: {
  workspaces: WorkspaceRow[];
  defaultWorkspaceId: Id<"workspaces"> | null;
  pathname: string | null;
  showSuperAdmin: boolean;
  onNavigate?: () => void;
  mobileFooter?: boolean;
}) {
  const { signOut } = useAuthActions();
  const patchUserSettings = useMutation(api.users.patchMyUserSettings);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col px-3 pt-4 pb-3 md:pt-5 md:pb-4">
        <div className="hidden px-2 pb-4 md:block">
          <p className="font-heading text-sm font-semibold tracking-tight text-foreground">
            Puls
          </p>
          <p className="text-muted-foreground mt-0.5 text-xs leading-snug">
            Oversikt og arbeidsområder
          </p>
        </div>

        <nav className="flex flex-col gap-1" aria-label="Hovedmeny">
          <NavLink
            href="/dashboard?oversikt=1"
            active={pathname === "/dashboard"}
            icon={LayoutDashboard}
            onNavigate={onNavigate}
          >
            Oversikt
          </NavLink>
          <NavLink
            href="/bruker/innstillinger"
            active={pathname?.startsWith("/bruker/") ?? false}
            icon={Settings}
            onNavigate={onNavigate}
          >
            Innstillinger
          </NavLink>
          {showSuperAdmin ? (
            <NavLink
              href="/superadmin"
              active={pathname === "/superadmin"}
              icon={ShieldCheck}
              onNavigate={onNavigate}
            >
              Superadmin
            </NavLink>
          ) : null}
        </nav>

        {workspaces.length > 0 ? (
          <div className="mt-5 flex min-h-0 flex-1 flex-col md:mt-6">
            <div className="mb-2 flex items-center justify-between px-2">
              <p className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
                Arbeidsområder
              </p>
              <span className="text-muted-foreground/80 text-[11px] tabular-nums">
                {workspaces.length}
              </span>
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overscroll-contain pr-0.5 [scrollbar-width:thin]">
              {workspaces.map(({ workspace, role }) => {
                const isDefault = defaultWorkspaceId === workspace._id;
                const initial =
                  workspace.name.trim().charAt(0).toUpperCase() || "?";
                return (
                  <Link
                    key={workspace._id}
                    href={`/w/${workspace._id}`}
                    onClick={onNavigate}
                    className={cn(
                      "group flex min-h-11 items-center gap-2.5 rounded-xl px-2 py-2 text-sm transition-colors touch-manipulation",
                      isDefault
                        ? "bg-background text-foreground shadow-sm ring-1 ring-border/60"
                        : "text-muted-foreground hover:bg-background/70 hover:text-foreground active:bg-background/80",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-semibold",
                        avatarTone(workspace.name),
                      )}
                    >
                      {initial}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-foreground">
                        {workspace.name}
                      </span>
                      <span className="text-muted-foreground block truncate text-[11px]">
                        {roleLabel(role)}
                      </span>
                    </span>
                    {isDefault ? (
                      <Star
                        className="size-3.5 shrink-0 fill-current text-amber-500"
                        aria-label="Standard"
                      />
                    ) : null}
                  </Link>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>

      {mobileFooter ? (
        <div className="shrink-0 space-y-1 border-t border-border/40 p-3 md:hidden">
          <div className="flex items-center gap-1">
            <ThemeModeToggle
              className="size-11 rounded-xl"
              onThemeChange={(value) => {
                void patchUserSettings({ themePreference: value });
              }}
            />
            <Button
              type="button"
              variant="ghost"
              className="text-muted-foreground hover:text-foreground h-11 flex-1 justify-start gap-2 rounded-xl px-3"
              onClick={() => {
                onNavigate?.();
                void signOut();
              }}
            >
              <LogOut className="size-4 opacity-70" aria-hidden />
              Logg ut
            </Button>
          </div>
          <p className="text-muted-foreground/70 px-1 pt-0.5 text-[0.65rem]">
            {PRODUCT_NAME}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function NavLink({
  href,
  active,
  icon: Icon,
  children,
  onNavigate,
}: {
  href: string;
  active: boolean;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        "flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors touch-manipulation",
        active
          ? "bg-background text-foreground shadow-sm ring-1 ring-border/60"
          : "text-muted-foreground hover:bg-background/60 hover:text-foreground active:bg-background/70",
      )}
    >
      <Icon
        className={cn("size-4 shrink-0", active ? "opacity-90" : "opacity-55")}
        aria-hidden
      />
      {children}
    </Link>
  );
}
