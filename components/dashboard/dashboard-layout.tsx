"use client";

import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import {
  LayoutDashboard,
  Settings,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type WorkspaceRow = {
  workspace: Doc<"workspaces">;
  role: string;
};

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
        className="border-border/30 bg-background/80 supports-[backdrop-filter]:bg-background/60 sticky top-14 z-30 hidden h-[calc(100dvh-3.5rem)] w-48 shrink-0 flex-col backdrop-blur-lg lg:flex lg:border-r"
        aria-label="Dashboard-meny"
      >
        <nav className="flex flex-col gap-0.5 px-2.5 pt-4">
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
          {saAccess?.isSuperAdmin && (
            <NavLink
              href="/superadmin"
              active={pathname === "/superadmin"}
              icon={ShieldCheck}
            >
              Superadmin
            </NavLink>
          )}

          {workspaces.length > 0 && (
            <>
              <div className="mx-1 my-3 h-px bg-border/25" />
              <p className="text-muted-foreground/60 px-2 pb-1 text-[10px] font-semibold uppercase tracking-widest">
                Arbeidsområder
              </p>
              <div className="flex max-h-[min(45vh,360px)] flex-col gap-px overflow-y-auto [scrollbar-width:thin]">
                {workspaces.map(({ workspace }) => {
                  const isDefault = defaultWorkspaceId === workspace._id;
                  return (
                    <Link
                      key={workspace._id}
                      href={`/w/${workspace._id}`}
                      className={cn(
                        "flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] transition-colors",
                        isDefault
                          ? "text-foreground font-medium"
                          : "text-muted-foreground hover:text-foreground",
                        "hover:bg-muted/30",
                      )}
                    >
                      <span className="flex size-5 shrink-0 items-center justify-center rounded bg-muted/50 text-[10px] font-bold text-muted-foreground">
                        {workspace.name.charAt(0).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1 truncate">
                        {workspace.name}
                      </span>
                      {isDefault && (
                        <span className="text-primary/70 text-[9px]">★</span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </>
          )}
        </nav>
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
  const Comp = href.startsWith("#") ? "a" : Link;
  return (
    <Comp
      href={href}
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors",
        active
          ? "bg-muted/50 text-foreground"
          : "text-muted-foreground hover:bg-muted/30 hover:text-foreground",
      )}
    >
      <Icon className="size-4 shrink-0 opacity-60" aria-hidden />
      {children}
    </Comp>
  );
}
