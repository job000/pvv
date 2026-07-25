"use client";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
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
} from "lucide-react";
import { useTheme } from "next-themes";
import { usePathname, useRouter } from "next/navigation";
import {
  type ComponentType,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

/** Åpne paletten programmatisk (f.eks. fra søkeknappen i toppfeltet). */
export const COMMAND_PALETTE_EVENT = "pvv:command-palette";

type Command = {
  id: string;
  group: string;
  label: string;
  hint?: string;
  keywords?: string;
  icon: ComponentType<{ className?: string }>;
  run: () => void;
};

function normalize(s: string): string {
  return s.toLocaleLowerCase("nb-NO").trim();
}

const CONTENT_KIND_ICON: Record<
  string,
  ComponentType<{ className?: string }>
> = {
  assessment: ClipboardList,
  candidate: Users,
  ros: Shield,
  pdd: ScrollText,
  form: FileText,
  board: Kanban,
  orgUnit: Building2,
  task: ListChecks,
};

/**
 * Global kommandopalett (⌘K / Ctrl+K):
 * søk i arbeidsområdets innhold, navigasjon, bytte av område og tema.
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
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

  const contentQuery = normalize(query);
  const contentHits = useQuery(
    api.workspaceSearch.searchInWorkspace,
    open && wid && contentQuery.length >= 2
      ? {
          workspaceId: wid as Id<"workspaces">,
          query: contentQuery,
        }
      : "skip",
  );

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActiveIndex(0);
  }, []);

  const go = useCallback(
    (href: string) => {
      close();
      router.push(href);
    },
    [close, router],
  );

  const setThemeAndPersist = useCallback(
    (value: "light" | "dark" | "system") => {
      close();
      setTheme(value);
      void patchUserSettings({ themePreference: value });
    },
    [close, setTheme, patchUserSettings],
  );

  const commands = useMemo<Command[]>(() => {
    const list: Command[] = [];

    if (wid) {
      const inWorkspace: Array<{
        label: string;
        path: string;
        icon: ComponentType<{ className?: string }>;
        keywords?: string;
        adminOnly?: boolean;
      }> = [
        { label: "Oversikt", path: "", icon: LayoutDashboard, keywords: "oversikt hjem" },
        { label: "Oppgaver", path: "/oppgaver", icon: ListTodo, keywords: "tasks todo" },
        { label: "Skjemaer", path: "/skjemaer", icon: FileText, keywords: "forslag intake skjema" },
        { label: "Prosesser", path: "/vurderinger?fane=prosesser", icon: Users, keywords: "prosessregister" },
        { label: "Vurderinger", path: "/vurderinger", icon: ClipboardList, keywords: "assessment kandidat" },
        { label: "Tavler", path: "/tavler", icon: Kanban, keywords: "puls tavle board kanban" },
        { label: "Prosessdesign", path: "/prosessdesign", icon: ScrollText, keywords: "pdd diagram" },
        { label: "Risiko (ROS)", path: "/ros", icon: Shield, keywords: "risiko analyse" },
        { label: "Gevinster", path: "/gevinster", icon: ChartColumn, keywords: "benefits verdi" },
        { label: "PDF-eksport", path: "/pdf-forhandsvisning", icon: Eye, keywords: "rapport eksport" },
        { label: "Organisasjon", path: "/organisasjon", icon: Building2, keywords: "orgkart enheter" },
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

  const contentCommands = useMemo<Command[]>(() => {
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
    const q = normalize(query);
    const navFiltered = !q
      ? commands
      : commands.filter((c) =>
          normalize(`${c.label} ${c.group} ${c.keywords ?? ""}`).includes(q),
        );
    // Innhold først når brukeren søker — deretter navigasjon/kommandoer.
    if (q.length >= 2) {
      return [...contentCommands, ...navFiltered];
    }
    return navFiltered;
  }, [commands, contentCommands, query]);

  /** Grupperekkefølge følger første forekomst — flat indeks styrer tastaturvalg. */
  const groups = useMemo(() => {
    const order: string[] = [];
    const byGroup = new Map<string, { command: Command; flatIndex: number }[]>();
    filtered.forEach((command, flatIndex) => {
      if (!byGroup.has(command.group)) {
        byGroup.set(command.group, []);
        order.push(command.group);
      }
      byGroup.get(command.group)!.push({ command, flatIndex });
    });
    return order.map((name) => ({ name, items: byGroup.get(name)! }));
  }, [filtered]);

  // Åpne/lukk: ⌘K / Ctrl+K + egendefinert hendelse fra søkeknappen.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => {
          if (prev) {
            setQuery("");
            setActiveIndex(0);
          }
          return !prev;
        });
      }
    };
    const onOpenEvent = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(COMMAND_PALETTE_EVENT, onOpenEvent);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(COMMAND_PALETTE_EVENT, onOpenEvent);
    };
  }, []);

  // Lås bakgrunnsscroll og fokuser input når paletten er åpen.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => {
      document.body.style.overflow = prev;
      window.clearTimeout(t);
    };
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // Hold aktivt element synlig ved piltast-navigasjon.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-flat-index="${activeIndex}"]`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  if (!open) return null;

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      filtered[activeIndex]?.run();
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[220] flex items-start justify-center px-4 pt-[max(3.5rem,14vh)] pb-6"
      role="presentation"
    >
      <button
        type="button"
        aria-label="Lukk"
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
        onClick={close}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Kommandopalett"
        className="product-rise bg-popover text-popover-foreground relative z-10 flex w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-border/70 shadow-[var(--shadow-elevated)]"
      >
        <div className="flex items-center gap-3 border-b border-border/60 px-4">
          <Search className="text-muted-foreground size-4 shrink-0" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder={
              wid
                ? "Søk vurderinger, ROS, oppgaver, tavler …"
                : "Gå til side, bytt arbeidsområde, endre tema …"
            }
            className="placeholder:text-muted-foreground/70 h-13 w-full min-w-0 bg-transparent py-4 text-sm outline-none"
            aria-label="Søk i arbeidsområdet"
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="text-muted-foreground border-border/60 bg-muted/40 hidden shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-medium sm:block">
            esc
          </kbd>
        </div>

        <div
          ref={listRef}
          className="max-h-[min(24rem,50vh)] overflow-y-auto overscroll-contain p-2"
        >
          {filtered.length === 0 ? (
            <p className="text-muted-foreground px-3 py-8 text-center text-sm">
              {wid && contentQuery.length >= 2 && contentHits === undefined
                ? "Søker …"
                : `Ingen treff for «${query}»`}
            </p>
          ) : (
            groups.map((group) => (
              <div key={group.name} role="group" aria-label={group.name}>
                <p className="text-muted-foreground/80 px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider">
                  {group.name}
                </p>
                {group.items.map(({ command, flatIndex }) => {
                  const active = flatIndex === activeIndex;
                  const Icon = command.icon;
                  return (
                    <button
                      key={command.id}
                      type="button"
                      data-flat-index={flatIndex}
                      onClick={() => command.run()}
                      onMouseMove={() => setActiveIndex(flatIndex)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors",
                        active
                          ? "bg-primary/10 text-foreground"
                          : "text-muted-foreground",
                      )}
                    >
                      <Icon
                        className={cn(
                          "size-4 shrink-0",
                          active ? "text-primary" : "opacity-70",
                        )}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1 truncate">
                        {command.label}
                      </span>
                      {command.hint ? (
                        <span className="text-muted-foreground/70 shrink-0 text-xs">
                          {command.hint}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className="text-muted-foreground/80 flex items-center gap-4 border-t border-border/60 px-4 py-2.5 text-[11px]">
          <span>↑↓ naviger</span>
          <span>↵ åpne</span>
          <span className="ml-auto">⌘K når som helst</span>
        </div>
      </div>
    </div>
  );
}
