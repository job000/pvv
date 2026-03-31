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
  Shield,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";

const items = (wid: string) =>
  [
    {
      href: `/w/${wid}`,
      label: "Oversikt",
      icon: LayoutDashboard,
      exact: true,
      kind: "default" as const,
    },
    {
      href: `/w/${wid}/vurderinger`,
      label: "Vurderinger",
      icon: ClipboardList,
      exact: false,
      kind: "vurderinger" as const,
    },
    {
      href: `/w/${wid}/leveranse`,
      label: "Leveranse",
      icon: LayoutGrid,
      exact: false,
      kind: "default" as const,
    },
    {
      href: `/w/${wid}/organisasjon`,
      label: "Organisasjon",
      icon: Building2,
      exact: false,
      kind: "default" as const,
    },
    {
      href: `/w/${wid}/vurderinger?fane=prosesser`,
      label: "Prosesser",
      icon: Users,
      exact: false,
      kind: "prosesser" as const,
    },
    {
      href: `/w/${wid}/ros`,
      label: "ROS",
      icon: Shield,
      exact: false,
      kind: "default" as const,
    },
    {
      href: `/w/${wid}/delinger`,
      label: "Delinger",
      icon: Share2,
      exact: false,
      kind: "default" as const,
    },
    {
      href: `/w/${wid}/varslinger`,
      label: "Varslinger",
      icon: Bell,
      exact: false,
      kind: "default" as const,
    },
    {
      href: `/w/${wid}/innstillinger`,
      label: "Innstillinger",
      icon: Settings2,
      exact: false,
      kind: "default" as const,
    },
  ] as const;

function isActive(
  pathname: string | null,
  href: string,
  exact: boolean,
  wid: string,
  fane: string | null,
  kind: "default" | "vurderinger" | "prosesser",
) {
  if (!pathname) return false;

  if (kind === "prosesser") {
    return (
      pathname === `/w/${wid}/vurderinger` && fane === "prosesser"
    );
  }

  if (kind === "vurderinger") {
    const singleAssessment = /^\/w\/[^/]+\/a\/[^/]+$/.test(pathname);
    if (singleAssessment) return true;
    if (pathname.startsWith(`/w/${wid}/vurderinger`)) {
      if (fane === "prosesser") return false;
      return true;
    }
    return false;
  }

  if (exact) {
    return pathname === href.split("?")[0];
  }
  if (href.endsWith("/ros")) {
    return pathname.startsWith(href);
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function WorkspaceNavInner({
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
  const searchParams = useSearchParams();
  const wid = String(workspaceId);
  const nav = items(wid);
  const fane = searchParams.get("fane");

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
      <ul className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overflow-x-hidden py-1 [scrollbar-gutter:stable] [scrollbar-width:thin]">
        {nav.map(({ href, label, icon: Icon, exact, kind }) => {
          const active = isActive(pathname, href, exact, wid, fane, kind);
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

export function WorkspaceNav(props: {
  workspaceId: Id<"workspaces">;
  workspaceName?: string;
  onNavigate?: () => void;
  className?: string;
}) {
  return (
    <Suspense
      fallback={
        <nav
          className={cn(
            "flex h-full min-h-0 flex-col gap-1 overflow-hidden p-3",
            props.className,
          )}
          aria-label="Arbeidsområde"
        >
          <div className="text-muted-foreground px-3 py-2 text-sm">Laster …</div>
        </nav>
      }
    >
      <WorkspaceNavInner {...props} />
    </Suspense>
  );
}
