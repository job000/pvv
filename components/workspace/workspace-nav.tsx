"use client";

import type { ComponentType } from "react";
import { cn } from "@/lib/utils";
import type { Id } from "@/convex/_generated/dataModel";
import {
  Building2,
  ClipboardList,
  Eye,
  FileText,
  LayoutDashboard,
  ScrollText,
  Settings2,
  Share2,
  Shield,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";

type NavKind = "default" | "vurderinger" | "prosesser" | "prosessdesign";

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  exact: boolean;
  kind: NavKind;
};

function navSections(wid: string): { heading: string; items: NavItem[] }[] {
  return [
    {
      heading: "Oversikt",
      items: [
        {
          href: `/w/${wid}`,
          label: "Dashboard",
          icon: LayoutDashboard,
          exact: true,
          kind: "default",
        },
        {
          href: `/w/${wid}/vurderinger?fane=prosesser`,
          label: "Prosesser",
          icon: Users,
          exact: false,
          kind: "prosesser",
        },
        {
          href: `/w/${wid}/vurderinger`,
          label: "Vurderinger",
          icon: ClipboardList,
          exact: false,
          kind: "vurderinger",
        },
      ],
    },
    {
      heading: "Dokumentasjon",
      items: [
        {
          href: `/w/${wid}/ros`,
          label: "Risiko (ROS)",
          icon: Shield,
          exact: false,
          kind: "default",
        },
        {
          href: `/w/${wid}/prosessdesign`,
          label: "Prosessdesign",
          icon: ScrollText,
          exact: false,
          kind: "prosessdesign",
        },
        {
          href: `/w/${wid}/pdf-forhandsvisning`,
          label: "PDF-forhåndsvisning",
          icon: Eye,
          exact: false,
          kind: "default",
        },
      ],
    },
    {
      heading: "Admin",
      items: [
        {
          href: `/w/${wid}/skjemaer`,
          label: "Skjemaer",
          icon: FileText,
          exact: false,
          kind: "default",
        },
        {
          href: `/w/${wid}/organisasjon`,
          label: "Organisasjon",
          icon: Building2,
          exact: false,
          kind: "default",
        },
        {
          href: `/w/${wid}/delinger`,
          label: "Team",
          icon: Share2,
          exact: false,
          kind: "default",
        },
        {
          href: `/w/${wid}/innstillinger`,
          label: "Innstillinger",
          icon: Settings2,
          exact: false,
          kind: "default",
        },
      ],
    },
  ];
}

function isActive(
  pathname: string | null,
  href: string,
  exact: boolean,
  wid: string,
  fane: string | null,
  kind: NavKind,
) {
  if (!pathname) return false;

  if (kind === "prosesser") {
    return pathname === `/w/${wid}/vurderinger` && fane === "prosesser";
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

  if (kind === "prosessdesign") {
    if (pathname.startsWith(`/w/${wid}/prosessdesign`)) return true;
    return /\/a\/[^/]+\/prosessdesign/.test(pathname);
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
  const sections = navSections(wid);
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
      <ul className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overflow-x-hidden py-2 [scrollbar-gutter:stable] [scrollbar-width:thin]">
        {sections.map((section) => (
          <li key={section.heading}>
            <div role="group" aria-label={section.heading}>
              <p className="text-muted-foreground px-3 pb-1.5 text-[0.6rem] font-semibold uppercase tracking-[0.14em]">
                {section.heading}
              </p>
              <ul className="flex flex-col gap-0.5">
                {section.items.map(({ href, label, icon: Icon, exact, kind }) => {
                  const active = isActive(
                    pathname,
                    href,
                    exact,
                    wid,
                    fane,
                    kind,
                  );
                  return (
                    <li key={href} className="shrink-0">
                      <Link
                        href={href}
                        onClick={() => onNavigate?.()}
                        className={cn(
                          "flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 md:min-h-10",
                          active
                            ? "bg-foreground text-background shadow-md ring-1 ring-foreground/10"
                            : "text-muted-foreground hover:bg-background/80 hover:text-foreground hover:shadow-sm active:bg-muted/60",
                        )}
                      >
                        <Icon className="size-4 shrink-0 opacity-90" aria-hidden />
                        <span className="min-w-0 leading-snug">{label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          </li>
        ))}
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
