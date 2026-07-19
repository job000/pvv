"use client";

import type { ComponentType } from "react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import type { Id } from "@/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import {
  Building2,
  ChartColumn,
  ClipboardList,
  Eye,
  FileText,
  Kanban,
  LayoutDashboard,
  ListTodo,
  ScrollText,
  Settings2,
  Share2,
  Shield,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";

type NavKind = "default" | "vurderinger" | "prosesser" | "prosessdesign";

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  exact: boolean;
  kind: NavKind;
  /** Kun eier/admin ser lenken i menyen */
  adminOnly?: boolean;
};

function navSections(wid: string): { heading: string | null; items: NavItem[] }[] {
  return [
    {
      heading: null,
      items: [
        {
          href: `/w/${wid}`,
          label: "Hjem",
          icon: LayoutDashboard,
          exact: true,
          kind: "default",
        },
        {
          href: `/w/${wid}/oppgaver`,
          label: "Oppgaver",
          icon: ListTodo,
          exact: false,
          kind: "default",
        },
      ],
    },
    {
      heading: "Arbeidsflyt",
      items: [
        {
          href: `/w/${wid}/skjemaer`,
          label: "Skjemaer",
          icon: FileText,
          exact: false,
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
        {
          href: `/w/${wid}/tavler`,
          label: "Tavler",
          icon: Kanban,
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
          href: `/w/${wid}/ros`,
          label: "Risiko (ROS)",
          icon: Shield,
          exact: false,
          kind: "default",
        },
        {
          href: `/w/${wid}/gevinster`,
          label: "Gevinster",
          icon: ChartColumn,
          exact: false,
          kind: "default",
        },
      ],
    },
    {
      heading: "Område",
      items: [
        {
          href: `/w/${wid}/pdf-forhandsvisning`,
          label: "PDF-eksport",
          icon: Eye,
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
          adminOnly: true,
        },
        {
          href: `/w/${wid}/innstillinger`,
          label: "Innstillinger",
          icon: Settings2,
          exact: false,
          kind: "default",
          adminOnly: true,
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
  onClose,
  className,
}: {
  workspaceId: Id<"workspaces">;
  workspaceName?: string;
  onNavigate?: () => void;
  onClose?: () => void;
  className?: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const wid = String(workspaceId);
  const membership = useQuery(api.workspaces.getMyMembership, { workspaceId });
  const isAdmin =
    membership?.role === "owner" || membership?.role === "admin";
  const sections = useMemo(() => {
    return navSections(wid)
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => !item.adminOnly || isAdmin),
      }))
      .filter((section) => section.items.length > 0);
  }, [wid, isAdmin]);
  const fane = searchParams.get("fane");

  return (
    <nav
      className={cn(
        "flex h-full min-h-0 flex-col overflow-hidden",
        className,
      )}
      aria-label="Arbeidsområde"
    >
      <div className="flex shrink-0 items-start gap-2 border-b border-border/40 px-4 pb-3 pt-4">
        <div className="min-w-0 flex-1">
          <p className="text-muted-foreground text-[0.65rem] font-semibold uppercase tracking-[0.14em]">
            Arbeidsområde
          </p>
          <p className="font-heading mt-0.5 truncate text-base font-semibold tracking-tight">
            {workspaceName ?? "…"}
          </p>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring -mr-1 inline-flex size-9 shrink-0 items-center justify-center rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 md:hidden"
            aria-label="Lukk meny"
          >
            <X className="size-4" aria-hidden />
          </button>
        ) : null}
      </div>

      <ul className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overflow-x-hidden px-3 py-4 [scrollbar-gutter:stable] [scrollbar-width:thin]">
        {sections.map((section, sectionIdx) => (
          <li key={section.heading ?? `section-${sectionIdx}`}>
            <div role="group" aria-label={section.heading ?? undefined}>
              {section.heading ? (
                <p className="text-muted-foreground px-3 pb-2 text-[0.65rem] font-semibold uppercase tracking-[0.14em]">
                  {section.heading}
                </p>
              ) : null}
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
                          "relative flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-150 md:min-h-10",
                          active
                            ? "bg-primary/12 text-foreground shadow-sm ring-1 ring-primary/15"
                            : "text-muted-foreground hover:bg-muted/70 hover:text-foreground active:bg-muted",
                        )}
                      >
                        {active ? (
                          <span
                            className="bg-primary absolute inset-y-2 left-1 w-0.5 rounded-full"
                            aria-hidden
                          />
                        ) : null}
                        <Icon
                          className={cn(
                            "size-4 shrink-0",
                            active ? "text-primary" : "opacity-80",
                          )}
                          aria-hidden
                        />
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
  onClose?: () => void;
  className?: string;
}) {
  return (
    <Suspense
      fallback={
        <nav
          className={cn(
            "flex h-full min-h-0 flex-col overflow-hidden p-4",
            props.className,
          )}
          aria-label="Arbeidsområde"
        >
          <div className="text-muted-foreground text-sm">Laster …</div>
        </nav>
      }
    >
      <WorkspaceNavInner {...props} />
    </Suspense>
  );
}
