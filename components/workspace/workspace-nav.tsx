"use client";

import { cn } from "@/lib/utils";
import type { Id } from "@/convex/_generated/dataModel";
import {
  Bell,
  Building2,
  ClipboardList,
  LayoutDashboard,
  LayoutGrid,
  Settings2,
  Share2,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = (wid: string) =>
  [
    {
      href: `/w/${wid}`,
      label: "Oversikt",
      icon: LayoutDashboard,
      exact: true,
    },
    {
      href: `/w/${wid}/vurderinger`,
      label: "Vurderinger",
      icon: ClipboardList,
      exact: false,
    },
    {
      href: `/w/${wid}/leveranse`,
      label: "Leveranse",
      icon: LayoutGrid,
      exact: false,
    },
    {
      href: `/w/${wid}/organisasjon`,
      label: "Organisasjon",
      icon: Building2,
      exact: false,
    },
    {
      href: `/w/${wid}/kandidater`,
      label: "Kandidater",
      icon: Users,
      exact: false,
    },
    {
      href: `/w/${wid}/delinger`,
      label: "Delinger",
      icon: Share2,
      exact: false,
    },
    {
      href: `/w/${wid}/varslinger`,
      label: "Varslinger",
      icon: Bell,
      exact: false,
    },
    {
      href: `/w/${wid}/innstillinger`,
      label: "Innstillinger",
      icon: Settings2,
      exact: false,
    },
  ] as const;

function isActive(pathname: string, href: string, exact: boolean) {
  if (exact) {
    return pathname === href;
  }
  if (href.endsWith("/vurderinger")) {
    return (
      pathname.startsWith(href) ||
      pathname.includes("/a/") /* enkeltvurdering */
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function WorkspaceNav({
  workspaceId,
  workspaceName,
  onNavigate,
  className,
}: {
  workspaceId: Id<"workspaces">;
  workspaceName?: string;
  onNavigate?: () => void;
  className?: string;
}) {
  const pathname = usePathname();
  const wid = String(workspaceId);
  const nav = items(wid);

  return (
    <nav
      className={cn(
        "flex h-full min-h-0 flex-col gap-1 overflow-hidden p-3",
        className,
      )}
      aria-label="Arbeidsområde"
    >
      <div className="shrink-0 border-b border-border/50 px-1 pb-3">
        <p className="text-muted-foreground text-[0.65rem] font-semibold uppercase tracking-[0.12em]">
          Arbeidsområde
        </p>
        <p className="mt-1.5 truncate font-heading text-sm font-semibold leading-tight tracking-tight">
          {workspaceName ?? "…"}
        </p>
      </div>
      <ul className="flex min-h-0 flex-1 flex-col gap-1 overflow-hidden py-1">
        {nav.map(({ href, label, icon: Icon, exact }) => {
          const active = pathname ? isActive(pathname, href, exact) : false;
          return (
            <li key={href} className="shrink-0">
              <Link
                href={href}
                onClick={() => onNavigate?.()}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  active
                    ? "bg-foreground text-background shadow-md ring-1 ring-foreground/10"
                    : "text-muted-foreground hover:bg-background/80 hover:text-foreground hover:shadow-sm",
                )}
              >
                <Icon className="size-4 shrink-0 opacity-90" aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
