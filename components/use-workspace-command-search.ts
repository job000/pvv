"use client";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import {
  Building2,
  ChartColumn,
  ClipboardList,
  Eye,
  FileText,
  Kanban,
  LayoutDashboard,
  ListChecks,
  ListTodo,
  Monitor,
  Moon,
  ScrollText,
  Search,
  Settings2,
  Share2,
  Shield,
  Sun,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useMemo } from "react";

export type SearchCommand = {
  id: string;
  group: string;
  label: string;
  hint?: string;
  keywords?: string;
  icon: LucideIcon;
  run: () => void;
};

export type SearchCommandGroup = {
  name: string;
  items: Array<{ command: SearchCommand; flatIndex: number }>;
};

const CONTENT_KIND_ICON: Record<string, LucideIcon> = {
  assessment: ClipboardList,
  candidate: Users,
  ros: Shield,
  pdd: ScrollText,
  form: FileText,
  board: Kanban,
  orgUnit: Building2,
  task: ListChecks,
};

export function normalizeSearchQuery(s: string): string {
  return s.toLocaleLowerCase("nb-NO").trim();
}

/**
 * Delt søk/kommando-logikk for toppfelt-dropdown og ⌘K/Ctrl+K-paletten.
 */
export function useWorkspaceCommandSearch({
  query,
  searchEnabled,
  onAfterRun,
}: {
  query: string;
  /** Når true: hent innholdstreff fra arbeidsområdet (fra 2 tegn). */
  searchEnabled: boolean;
  onAfterRun?: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { setTheme } = useTheme();
  const patchUserSettings = useMutation(api.users.patchMyUserSettings);
  const workspaces = useQuery(api.workspaces.listMine);

  const wid = useMemo(() => {
    const m = /^\/w\/([^/]+)/.exec(pathname ?? "");
    return m?.[1] ?? null;
  }, [pathname]);

  const membership = useQuery(
    api.workspaces.getMyMembership,
    wid ? { workspaceId: wid as Id<"workspaces"> } : "skip",
  );
  const isWorkspaceAdmin =
    membership?.role === "owner" || membership?.role === "admin";

  const contentQuery = normalizeSearchQuery(query);
  const contentHits = useQuery(
    api.workspaceSearch.searchInWorkspace,
    searchEnabled && wid && contentQuery.length >= 2
      ? {
          workspaceId: wid as Id<"workspaces">,
          query: contentQuery,
        }
      : "skip",
  );

  const runAndClose = useCallback(
    (fn: () => void) => {
      fn();
      onAfterRun?.();
    },
    [onAfterRun],
  );

  const go = useCallback(
    (href: string) => {
      runAndClose(() => {
        router.push(href);
      });
    },
    [router, runAndClose],
  );

  const setThemeAndPersist = useCallback(
    (value: "light" | "dark" | "system") => {
      runAndClose(() => {
        setTheme(value);
        void patchUserSettings({ themePreference: value });
      });
    },
    [patchUserSettings, runAndClose, setTheme],
  );

  const commands = useMemo<SearchCommand[]>(() => {
    const list: SearchCommand[] = [];

    if (wid) {
      const inWorkspace: Array<{
        label: string;
        path: string;
        icon: LucideIcon;
        keywords?: string;
        adminOnly?: boolean;
      }> = [
        {
          label: "Oversikt",
          path: "",
          icon: LayoutDashboard,
          keywords: "oversikt hjem",
        },
        {
          label: "Oppgaver",
          path: "/oppgaver",
          icon: ListTodo,
          keywords: "tasks todo",
        },
        {
          label: "Skjemaer",
          path: "/skjemaer",
          icon: FileText,
          keywords: "forslag intake skjema",
        },
        {
          label: "Prosesser",
          path: "/vurderinger?fane=prosesser",
          icon: Users,
          keywords: "prosessregister",
        },
        {
          label: "Vurderinger",
          path: "/vurderinger",
          icon: ClipboardList,
          keywords: "assessment kandidat",
        },
        {
          label: "Tavler",
          path: "/tavler",
          icon: Kanban,
          keywords: "puls tavle board kanban",
        },
        {
          label: "Prosessdesign",
          path: "/prosessdesign",
          icon: ScrollText,
          keywords: "pdd diagram",
        },
        {
          label: "Risiko (ROS)",
          path: "/ros",
          icon: Shield,
          keywords: "risiko analyse",
        },
        {
          label: "Gevinster",
          path: "/gevinster",
          icon: ChartColumn,
          keywords: "benefits verdi",
        },
        {
          label: "PDF-eksport",
          path: "/pdf-forhandsvisning",
          icon: Eye,
          keywords: "rapport eksport",
        },
        {
          label: "Organisasjon",
          path: "/organisasjon",
          icon: Building2,
          keywords: "orgkart enheter",
        },
        {
          label: "Team",
          path: "/delinger",
          icon: Share2,
          keywords: "deling medlemmer invitasjon",
          adminOnly: true,
        },
        {
          label: "Innstillinger",
          path: "/innstillinger",
          icon: Settings2,
          keywords: "workspace innstillinger",
          adminOnly: true,
        },
      ];
      for (const item of inWorkspace) {
        if (item.adminOnly && !isWorkspaceAdmin) continue;
        list.push({
          id: `nav:${item.path || "home"}`,
          group: "Gå til",
          label: item.label,
          keywords: item.keywords,
          icon: item.icon,
          run: () => go(`/w/${wid}${item.path}`),
        });
      }
    }

    list.push({
      id: "global:dashboard",
      group: "Generelt",
      label: "Oversikt (alle arbeidsområder)",
      keywords: "dashboard hjem start",
      icon: LayoutDashboard,
      run: () => go("/dashboard?oversikt=1"),
    });
    list.push({
      id: "global:settings",
      group: "Generelt",
      label: "Brukerinnstillinger",
      keywords: "profil konto preferanser",
      icon: Settings2,
      run: () => go("/bruker/innstillinger"),
    });

    for (const row of workspaces ?? []) {
      const id = String(row.workspace._id);
      if (id === wid) continue;
      list.push({
        id: `ws:${id}`,
        group: "Bytt arbeidsområde",
        label: row.workspace.name,
        keywords: "workspace arbeidsområde bytt",
        icon: Building2,
        run: () => go(`/w/${id}`),
      });
    }

    list.push(
      {
        id: "theme:light",
        group: "Tema",
        label: "Lyst tema",
        keywords: "light lys utseende",
        icon: Sun,
        run: () => setThemeAndPersist("light"),
      },
      {
        id: "theme:dark",
        group: "Tema",
        label: "Mørkt tema",
        keywords: "dark mørk utseende",
        icon: Moon,
        run: () => setThemeAndPersist("dark"),
      },
      {
        id: "theme:system",
        group: "Tema",
        label: "Følg systemet",
        keywords: "system auto utseende",
        icon: Monitor,
        run: () => setThemeAndPersist("system"),
      },
    );

    return list;
  }, [wid, workspaces, go, setThemeAndPersist, isWorkspaceAdmin]);

  const contentCommands = useMemo<SearchCommand[]>(() => {
    if (!contentHits?.length) return [];
    return contentHits.map((hit) => ({
      id: hit.id,
      group: hit.group,
      label: hit.label,
      hint: hit.hint,
      icon: CONTENT_KIND_ICON[hit.kind] ?? Search,
      run: () => go(hit.href),
    }));
  }, [contentHits, go]);

  const filtered = useMemo(() => {
    const q = normalizeSearchQuery(query);
    const navFiltered = !q
      ? commands
      : commands.filter((c) =>
          normalizeSearchQuery(
            `${c.label} ${c.group} ${c.keywords ?? ""}`,
          ).includes(q),
        );
    if (q.length >= 2) {
      return [...contentCommands, ...navFiltered];
    }
    return navFiltered;
  }, [commands, contentCommands, query]);

  const groups = useMemo<SearchCommandGroup[]>(() => {
    const order: string[] = [];
    const byGroup = new Map<
      string,
      Array<{ command: SearchCommand; flatIndex: number }>
    >();
    filtered.forEach((command, flatIndex) => {
      if (!byGroup.has(command.group)) {
        byGroup.set(command.group, []);
        order.push(command.group);
      }
      byGroup.get(command.group)!.push({ command, flatIndex });
    });
    return order.map((name) => ({ name, items: byGroup.get(name)! }));
  }, [filtered]);

  const contentLoading =
    Boolean(wid) &&
    contentQuery.length >= 2 &&
    contentHits === undefined &&
    searchEnabled;

  const placeholder = wid
    ? "Søk vurderinger, ROS, oppgaver …"
    : "Søk sider og arbeidsområder …";

  return {
    wid,
    filtered,
    groups,
    contentLoading,
    placeholder,
    contentQuery,
  };
}
