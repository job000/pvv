"use client";

import type { Doc, Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import {
  CheckSquare,
  FolderOpen,
  LayoutDashboard,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type WorkspaceRow = {
  workspace: Doc<"workspaces">;
  role: string;
};

const navItem =
  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors";

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
      {/* Sidemeny — skjules på mobil; innhold har egen horisontal snarvei */}
      <aside
        className="border-border/60 bg-muted/25 supports-[backdrop-filter]:bg-muted/20 sticky top-14 z-30 hidden h-[calc(100dvh-3.5rem)] w-60 shrink-0 flex-col border-b backdrop-blur-md lg:flex lg:border-b-0 lg:border-r xl:w-64"
        aria-label="Dashboard-meny"
      >
        <nav className="flex flex-col gap-0.5 p-3 pt-5">
          <p className="text-muted-foreground px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider">
            Navigasjon
          </p>
          <Link
            href="/dashboard"
            className={cn(
              navItem,
              pathname === "/dashboard"
                ? "bg-background text-foreground shadow-sm ring-1 ring-border/80"
                : "text-muted-foreground hover:bg-background/80 hover:text-foreground",
            )}
          >
            <LayoutDashboard className="size-4 shrink-0 opacity-80" aria-hidden />
            Oversikt
          </Link>
          <a
            href="#arbeidsområder"
            className={cn(
              navItem,
              "text-muted-foreground hover:bg-background/80 hover:text-foreground",
            )}
          >
            <FolderOpen className="size-4 shrink-0 opacity-80" aria-hidden />
            Arbeidsområder
          </a>
          <a
            href="#oppgaver"
            className={cn(
              navItem,
              "text-muted-foreground hover:bg-background/80 hover:text-foreground",
            )}
          >
            <CheckSquare className="size-4 shrink-0 opacity-80" aria-hidden />
            Oppgaver
          </a>
          <a
            href="#prioriteringer"
            className={cn(
              navItem,
              "text-muted-foreground hover:bg-background/80 hover:text-foreground",
            )}
          >
            <TrendingUp className="size-4 shrink-0 opacity-80" aria-hidden />
            Prioriteringer
          </a>

          <p className="text-muted-foreground mt-6 px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider">
            Dine områder
          </p>
          <div className="flex max-h-[min(40vh,320px)] flex-col gap-0.5 overflow-y-auto pr-1 [-ms-overflow-style:none] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5">
            {workspaces.map(({ workspace, role }) => {
              const isDefault = defaultWorkspaceId === workspace._id;
              return (
                <Link
                  key={workspace._id}
                  href={`/w/${workspace._id}`}
                  className={cn(
                    navItem,
                    "py-2 pl-3 pr-2",
                    isDefault &&
                      "border-primary/20 bg-primary/[0.06] text-foreground ring-1 ring-primary/15",
                    !isDefault &&
                      "text-muted-foreground hover:bg-background/80 hover:text-foreground",
                  )}
                >
                  <span className="bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-lg">
                    <FolderOpen className="size-3.5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1 truncate">{workspace.name}</span>
                  {isDefault ? (
                    <span className="text-primary shrink-0 text-[10px] font-bold uppercase">
                      Std
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        </nav>
      </aside>

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
