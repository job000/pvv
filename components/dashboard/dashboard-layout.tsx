"use client";

import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import {
  LayoutDashboard,
  Settings,
  ShieldCheck,
  Star,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

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

  return (
    <div className="mx-auto flex w-full max-w-[100rem] flex-col lg:flex-row lg:items-start">
      <aside
        className="sticky top-14 z-30 hidden h-[calc(100dvh-3.5rem)] w-64 shrink-0 flex-col border-r border-border/50 bg-muted/20 lg:flex"
        aria-label="Dashboard-meny"
      >
        <div className="flex min-h-0 flex-1 flex-col px-3 pt-5 pb-4">
          <div className="px-2 pb-4">
            <p className="font-heading text-sm font-semibold tracking-tight text-foreground">
              Puls
            </p>
            <p className="text-muted-foreground mt-0.5 text-xs leading-snug">
              Oversikt og arbeidsområder
            </p>
          </div>

          <nav className="flex flex-col gap-1">
            <NavLink
              href="/dashboard?oversikt=1"
              active={pathname === "/dashboard"}
              icon={LayoutDashboard}
            >
              Oversikt
            </NavLink>
            <NavLink
              href="/bruker/innstillinger"
              active={pathname?.startsWith("/bruker/") ?? false}
              icon={Settings}
            >
              Innstillinger
            </NavLink>
            {saAccess?.isSuperAdmin ? (
              <NavLink
                href="/superadmin"
                active={pathname === "/superadmin"}
                icon={ShieldCheck}
              >
                Superadmin
              </NavLink>
            ) : null}
          </nav>

          {workspaces.length > 0 ? (
            <div className="mt-6 flex min-h-0 flex-1 flex-col">
              <div className="mb-2 flex items-center justify-between px-2">
                <p className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
                  Arbeidsområder
                </p>
                <span className="text-muted-foreground/80 text-[11px] tabular-nums">
                  {workspaces.length}
                </span>
              </div>
              <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto pr-0.5 [scrollbar-width:thin]">
                {workspaces.map(({ workspace, role }) => {
                  const isDefault = defaultWorkspaceId === workspace._id;
                  const initial =
                    workspace.name.trim().charAt(0).toUpperCase() || "?";
                  return (
                    <Link
                      key={workspace._id}
                      href={`/w/${workspace._id}`}
                      className={cn(
                        "group flex items-center gap-2.5 rounded-xl px-2 py-2 text-sm transition-colors",
                        isDefault
                          ? "bg-background text-foreground shadow-sm ring-1 ring-border/60"
                          : "text-muted-foreground hover:bg-background/70 hover:text-foreground",
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
                        <span className="text-muted-foreground block truncate text-[11px] capitalize">
                          {role === "owner"
                            ? "Eier"
                            : role === "admin"
                              ? "Admin"
                              : role === "viewer"
                                ? "Visning"
                                : "Medlem"}
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
      </aside>

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function NavLink({
  href,
  active,
  icon: Icon,
  children,
}: {
  href: string;
  active: boolean;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
        active
          ? "bg-background text-foreground shadow-sm ring-1 ring-border/60"
          : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
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
