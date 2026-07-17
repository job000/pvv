"use client";

import { Sheet, SheetContent } from "@/components/ui/sheet";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import { Check, ChevronsUpDown, LayoutGrid } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

const ROLE_LABEL: Record<string, string> = {
  owner: "Eier",
  admin: "Admin",
  member: "Medlem",
  viewer: "Visning",
};

function currentWorkspaceIdFromPath(pathname: string | null): string | null {
  if (!pathname) return null;
  const m = pathname.match(/^\/w\/([^/]+)/);
  return m?.[1] ?? null;
}

function subscribeDesktop(cb: () => void) {
  const mq = window.matchMedia("(min-width: 768px)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

function WorkspaceList({
  sorted,
  currentId,
  loading,
  onSelect,
  onClose,
}: {
  sorted: {
    workspace: { _id: Id<"workspaces">; name: string };
    role: string;
  }[];
  currentId: string | null;
  loading: boolean;
  onSelect: (id: Id<"workspaces">) => void;
  onClose: () => void;
}) {
  return (
    <>
      <ul className="max-h-[min(55vh,22rem)] overflow-y-auto px-2 [scrollbar-width:thin]">
        {sorted.length === 0 ? (
          <li className="text-muted-foreground px-3 py-4 text-sm">
            {loading ? "Laster …" : "Ingen områder ennå"}
          </li>
        ) : (
          sorted.map(({ workspace, role }) => {
            const selected = String(workspace._id) === currentId;
            return (
              <li key={workspace._id}>
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={selected}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors",
                    "min-h-12 touch-manipulation",
                    selected
                      ? "bg-primary/12 text-foreground"
                      : "hover:bg-muted/70 active:bg-muted text-foreground",
                  )}
                  onClick={() => onSelect(workspace._id)}
                >
                  <span
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold",
                      selected
                        ? "bg-primary/20 text-primary"
                        : "bg-muted text-muted-foreground",
                    )}
                    aria-hidden
                  >
                    {workspace.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">
                      {workspace.name}
                    </span>
                    <span className="text-muted-foreground block text-xs">
                      {ROLE_LABEL[role] ?? role}
                    </span>
                  </span>
                  {selected ? (
                    <Check className="text-primary size-4 shrink-0" aria-hidden />
                  ) : null}
                </button>
              </li>
            );
          })
        )}
      </ul>
      <div className="border-border/50 mt-1 border-t p-2">
        <Link
          href="/dashboard?oversikt=1"
          role="menuitem"
          onClick={onClose}
          className={cn(
            "text-muted-foreground hover:bg-muted/70 hover:text-foreground active:bg-muted",
            "flex min-h-12 w-full items-center gap-3 rounded-2xl px-3 text-sm font-medium transition-colors touch-manipulation",
          )}
        >
          <span className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-xl">
            <LayoutGrid className="size-4" aria-hidden />
          </span>
          Alle områder
        </Link>
      </div>
    </>
  );
}

/**
 * Bytt arbeidsområde — dropdown på desktop, bottom sheet på mobil.
 */
export function WorkspaceSwitcher({
  workspaceName,
  className,
}: {
  workspaceName: string;
  className?: string;
}) {
  const rows = useQuery(api.workspaces.listMine);
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const currentId = currentWorkspaceIdFromPath(pathname);
  const isDesktop = useSyncExternalStore(
    subscribeDesktop,
    () => window.matchMedia("(min-width: 768px)").matches,
    () => false,
  );

  const sorted = useMemo(() => {
    if (!rows) return [];
    return [...rows].sort((a, b) =>
      a.workspace.name.localeCompare(b.workspace.name, "nb"),
    );
  }, [rows]);

  useEffect(() => {
    if (!open || !isDesktop) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, isDesktop]);

  function goToWorkspace(id: Id<"workspaces">) {
    setOpen(false);
    if (String(id) === currentId) return;
    router.push(`/w/${id}`);
  }

  const trigger = (
    <button
      type="button"
      onClick={() => setOpen((v) => !v)}
      className={cn(
        "group flex min-w-0 max-w-full items-center gap-1.5 rounded-2xl px-2.5 py-2 text-left transition-colors",
        "hover:bg-muted/70 active:bg-muted touch-manipulation",
        open && "bg-muted",
        "focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2",
        className,
      )}
      aria-label={`Arbeidsområde: ${workspaceName}. Bytt område.`}
      aria-haspopup={isDesktop ? "menu" : "dialog"}
      aria-expanded={open}
      aria-controls={menuId}
    >
      <span className="text-foreground min-w-0 truncate text-[0.95rem] font-semibold tracking-tight sm:text-sm">
        {workspaceName}
      </span>
      <ChevronsUpDown
        className="text-muted-foreground size-3.5 shrink-0 opacity-70"
        aria-hidden
      />
    </button>
  );

  if (!isDesktop) {
    return (
      <>
        <div className="min-w-0 flex-1">{trigger}</div>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="bottom" className="bg-background">
            <div id={menuId} className="flex min-h-0 flex-col">
              <div className="px-4 pb-2 pt-1">
                <h2 className="font-heading text-lg font-semibold tracking-tight">
                  Bytt område
                </h2>
                <p className="text-muted-foreground mt-0.5 text-sm">
                  Velg hvor du vil jobbe
                </p>
              </div>
              <WorkspaceList
                sorted={sorted}
                currentId={currentId}
                loading={rows === undefined}
                onSelect={goToWorkspace}
                onClose={() => setOpen(false)}
              />
            </div>
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <div ref={rootRef} className={cn("relative min-w-0", className)}>
      {trigger}
      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label="Bytt arbeidsområde"
          className={cn(
            "absolute left-0 top-[calc(100%+0.4rem)] z-50 w-[min(calc(100vw-1.5rem),18rem)] overflow-hidden rounded-2xl border py-1 shadow-lg",
            "border-border/80 bg-popover text-popover-foreground",
          )}
        >
          <p className="text-muted-foreground px-3 pb-1 pt-2 text-[0.65rem] font-semibold uppercase tracking-[0.12em]">
            Dine områder
          </p>
          <WorkspaceList
            sorted={sorted}
            currentId={currentId}
            loading={rows === undefined}
            onSelect={goToWorkspace}
            onClose={() => setOpen(false)}
          />
        </div>
      ) : null}
    </div>
  );
}
