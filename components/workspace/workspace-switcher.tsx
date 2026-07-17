"use client";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import { Check, ChevronsUpDown, LayoutGrid } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";

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

/**
 * Bytt mellom arbeidsområder fra toppbaren.
 * Menyknappen til venstre styrer drawer — dette er kun områdevelger.
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

  const sorted = useMemo(() => {
    if (!rows) return [];
    return [...rows].sort((a, b) =>
      a.workspace.name.localeCompare(b.workspace.name, "nb"),
    );
  }, [rows]);

  useEffect(() => {
    if (!open) return;
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
  }, [open]);

  function goToWorkspace(id: Id<"workspaces">) {
    setOpen(false);
    if (String(id) === currentId) return;
    router.push(`/w/${id}`);
  }

  return (
    <div ref={rootRef} className={cn("relative min-w-0", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "group flex min-w-0 max-w-[min(100%,14rem)] items-center gap-1.5 rounded-full px-2.5 py-1.5 text-left transition-colors sm:max-w-[18rem]",
          "hover:bg-muted/70 active:bg-muted",
          open && "bg-muted",
          "focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2",
        )}
        aria-label={`Arbeidsområde: ${workspaceName}. Bytt område.`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
      >
        <span className="text-foreground min-w-0 truncate text-sm font-semibold tracking-tight">
          {workspaceName}
        </span>
        <ChevronsUpDown
          className="text-muted-foreground size-3.5 shrink-0 opacity-60 group-hover:opacity-100"
          aria-hidden
        />
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label="Bytt arbeidsområde"
          className={cn(
            "absolute left-0 top-[calc(100%+0.4rem)] z-50 w-[min(calc(100vw-1.5rem),17.5rem)] overflow-hidden rounded-2xl border p-1 shadow-lg",
            "border-border/80 bg-popover text-popover-foreground",
          )}
        >
          <p className="text-muted-foreground px-2.5 pb-1 pt-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.12em]">
            Dine områder
          </p>
          <ul className="max-h-[min(50vh,18rem)] overflow-y-auto [scrollbar-width:thin]">
            {sorted.length === 0 ? (
              <li className="text-muted-foreground px-2.5 py-3 text-sm">
                {rows === undefined ? "Laster …" : "Ingen områder ennå"}
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
                        "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-left transition-colors",
                        selected
                          ? "bg-primary/10 text-foreground"
                          : "hover:bg-muted/70 text-foreground",
                      )}
                      onClick={() => goToWorkspace(workspace._id)}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {workspace.name}
                        </span>
                        <span className="text-muted-foreground block text-xs">
                          {ROLE_LABEL[role] ?? role}
                        </span>
                      </span>
                      {selected ? (
                        <Check
                          className="text-primary size-4 shrink-0"
                          aria-hidden
                        />
                      ) : null}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
          <div className="border-border/50 mt-0.5 border-t p-1">
            <Link
              href="/dashboard?oversikt=1"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="text-muted-foreground hover:bg-muted/70 hover:text-foreground flex w-full items-center gap-2 rounded-xl px-2.5 py-2.5 text-sm font-medium transition-colors"
            >
              <LayoutGrid className="size-4 shrink-0 opacity-70" aria-hidden />
              Alle områder
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
