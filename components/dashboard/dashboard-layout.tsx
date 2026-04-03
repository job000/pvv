"use client";

import type { Doc, Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import {
  CheckSquare,
  FolderOpen,
  LayoutDashboard,
  Settings,
  TrendingUp,
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

  return (
    <div className="mx-auto flex w-full max-w-[100rem] flex-col lg:flex-row lg:items-start">
      <aside
        className="border-border/40 bg-background/80 supports-[backdrop-filter]:bg-background/60 sticky top-14 z-30 hidden h-[calc(100dvh-3.5rem)] w-56 shrink-0 flex-col backdrop-blur-xl lg:flex lg:border-r"
        aria-label="Dashboard-meny"
      >
        <nav className="flex flex-col gap-0.5 px-2 pt-4">
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

          <div className="my-3 h-px bg-border/40" />

          <NavLink href="#arbeidsområder" active={false} icon={FolderOpen}>
            Områder
          </NavLink>
          <NavLink href="#oppgaver" active={false} icon={CheckSquare}>
            Oppgaver
          </NavLink>
          <NavLink href="#prioriteringer" active={false} icon={TrendingUp}>
            Prioriteringer
          </NavLink>

          {workspaces.length > 0 ? (
            <>
              <div className="my-3 h-px bg-border/40" />
              <p className="text-muted-foreground px-2 pb-1 text-[10px] font-semibold uppercase tracking-widest">
                Områder
              </p>
              <div className="flex max-h-[min(40vh,320px)] flex-col gap-px overflow-y-auto [scrollbar-width:thin]">
                {workspaces.map(({ workspace }) => {
                  const isDefault = defaultWorkspaceId === workspace._id;
                  return (
                    <Link
                      key={workspace._id}
                      href={`/w/${workspace._id}`}
                      className={cn(
                        "flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] transition-colors",
                        isDefault
                          ? "text-foreground font-medium"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                      )}
                    >
                      <span className="min-w-0 flex-1 truncate">
                        {workspace.name}
                      </span>
                      {isDefault ? (
                        <span className="text-primary text-[10px] font-bold">
                          STD
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            </>
          ) : null}
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
        "flex min-h-10 items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors lg:min-h-9 lg:py-1.5",
        active
          ? "bg-muted/80 text-foreground"
          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
      )}
    >
      <Icon className="size-4 shrink-0 opacity-70 lg:size-3.5" aria-hidden />
      {children}
    </Comp>
  );
}
