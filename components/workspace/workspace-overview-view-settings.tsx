"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "@/lib/app-toast";
import {
  WORKSPACE_OVERVIEW_SHORTCUT_IDS,
  buildWorkspaceOverviewShortcuts,
  type WorkspaceOverviewShortcutId,
} from "@/lib/workspace-overview-view";
import { useMutation, useQuery } from "convex/react";
import { LayoutGrid, Loader2, PanelLeft, RotateCcw, Settings2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const DEFAULT_WORKSPACE_OVERVIEW_SHORTCUT_IDS: WorkspaceOverviewShortcutId[] = [
  "oversikt",
  "vurderinger",
  "prosessregister",
  "ros",
  "organisasjon",
];

export function WorkspaceOverviewViewSettings({
  workspaceId,
  workspaceName,
  compactTrigger = false,
  triggerClassName,
}: {
  workspaceId: Id<"workspaces">;
  /** Når satt (f.eks. fra brukerinnstillinger), vises navnet i tittel. */
  workspaceName?: string;
  /** Mindre knapp til bruk i lister (f.eks. per arbeidsområde). */
  compactTrigger?: boolean;
  triggerClassName?: string;
}) {
  const prefs = useQuery(api.workspaceViewPrefs.getMyWorkspaceViewPrefs, {
    workspaceId,
  });
  const setPrefs = useMutation(api.workspaceViewPrefs.setMyWorkspaceViewPrefs);
  const clearPrefs = useMutation(api.workspaceViewPrefs.clearMyWorkspaceViewPrefs);

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const [visibleIds, setVisibleIds] = useState<Set<WorkspaceOverviewShortcutId>>(
    () => new Set(WORKSPACE_OVERVIEW_SHORTCUT_IDS),
  );
  const [showMetrics, setShowMetrics] = useState(true);
  const [showPriority, setShowPriority] = useState(true);
  const [showRecent, setShowRecent] = useState(true);
  const [showBegreper, setShowBegreper] = useState(true);
  const [homeListViewMode, setHomeListViewMode] = useState<
    "cards" | "list" | "table"
  >("cards");
  const [homeListPageSize, setHomeListPageSize] = useState<6 | 10 | 20>(6);

  const wid = String(workspaceId);
  const shortcuts = buildWorkspaceOverviewShortcuts(wid);
  const syncFromPrefs = useCallback(() => {
    if (prefs === undefined) return;
    if (prefs === null) {
      setVisibleIds(new Set(DEFAULT_WORKSPACE_OVERVIEW_SHORTCUT_IDS));
      setShowMetrics(true);
      setShowPriority(true);
      setShowRecent(true);
      setShowBegreper(false);
      setHomeListViewMode("cards");
      setHomeListPageSize(6);
      return;
    }
    setVisibleIds(
      new Set(
        prefs.visibleShortcutIds.filter((id) =>
          (WORKSPACE_OVERVIEW_SHORTCUT_IDS as readonly string[]).includes(id),
        ) as WorkspaceOverviewShortcutId[],
      ),
    );
    setShowMetrics(prefs.showMetrics);
    setShowPriority(prefs.showPrioritySection);
    setShowRecent(prefs.showRecentSection);
    setShowBegreper(prefs.showBegreperSection);
    setHomeListViewMode(
      prefs.homeListViewMode === "list" || prefs.homeListViewMode === "table"
        ? prefs.homeListViewMode
        : "cards",
    );
    setHomeListPageSize(
      prefs.homeListPageSize === 10 || prefs.homeListPageSize === 20
        ? prefs.homeListPageSize
        : 6,
    );
  }, [prefs]);

  useEffect(() => {
    if (open) {
      syncFromPrefs();
    }
  }, [open, syncFromPrefs]);

  async function handleSave() {
    setBusy(true);
    try {
      await setPrefs({
        workspaceId,
        visibleShortcutIds: WORKSPACE_OVERVIEW_SHORTCUT_IDS.filter((id) =>
          visibleIds.has(id),
        ),
        showMetrics,
        showPrioritySection: showPriority,
        showRecentSection: showRecent,
        showBegreperSection: showBegreper,
        homeListViewMode,
        homeListPageSize,
      });
      toast.success("Visning lagret for dette arbeidsområdet.");
      setOpen(false);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Kunne ikke lagre innstillinger.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleReset() {
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        "Tilbakestille til standard for dette arbeidsområdet? Alle egne valg fjernes.",
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await clearPrefs({ workspaceId });
      toast.success("Standardvisning gjenopprettet.");
      setOpen(false);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Kunne ikke tilbakestille.",
      );
    } finally {
      setBusy(false);
    }
  }

  function toggleShortcut(id: WorkspaceOverviewShortcutId) {
    setVisibleIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size={compactTrigger ? "sm" : "default"}
        className={cn(
          compactTrigger
            ? "h-10 min-h-10 gap-1.5 px-3.5 text-sm font-medium"
            : "h-11 min-h-[44px] gap-2 text-[13px] font-medium sm:h-10 sm:min-h-0",
          triggerClassName,
        )}
        onClick={() => setOpen(true)}
      >
        <Settings2 className={cn("shrink-0", compactTrigger ? "size-3.5" : "size-4")} aria-hidden />
        {compactTrigger ? "Tilpass" : "Tilpass visning"}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          size="lg"
          titleId="ws-view-settings-title"
          descriptionId="ws-view-settings-desc"
        >
          <DialogHeader>
            <p
              id="ws-view-settings-title"
              className="font-heading text-lg font-semibold tracking-tight"
            >
              {workspaceName
                ? `Visning for «${workspaceName}»`
                : "Visning for dette arbeidsområdet"}
            </p>
            <p
              id="ws-view-settings-desc"
              className="text-muted-foreground text-sm leading-relaxed"
            >
              Kun du ser disse valgene — de gjelder dashboard for{" "}
              <strong className="text-foreground">ditt</strong> innloggingskonto
              i dette arbeidsområdet.
            </p>
          </DialogHeader>
          <DialogBody className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <PanelLeft className="text-muted-foreground size-4" aria-hidden />
                <p className="text-sm font-semibold">Oversikt</p>
              </div>
              <div className="space-y-3 rounded-xl border border-border/50 bg-muted/15 px-3 py-3">
                <label className="flex cursor-pointer items-start gap-3">
                  <Checkbox
                    checked={showMetrics}
                    onCheckedChange={(c) => setShowMetrics(Boolean(c))}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="text-sm font-medium">Anbefalt neste steg</span>
                    <span className="text-muted-foreground block text-xs leading-snug">
                      Primærhandling og status i området
                    </span>
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-3">
                  <Checkbox
                    checked={showPriority}
                    onCheckedChange={(c) => setShowPriority(Boolean(c))}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="text-sm font-medium">Også aktuelt</span>
                    <span className="text-muted-foreground block text-xs leading-snug">
                      Kort pek til noen få saker under neste steg
                    </span>
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-3">
                  <Checkbox
                    checked={showRecent}
                    onCheckedChange={(c) => setShowRecent(Boolean(c))}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="text-sm font-medium">Sist i arbeid</span>
                    <span className="text-muted-foreground block text-xs leading-snug">
                      Noen få vurderinger du nylig var innom
                    </span>
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-3">
                  <Checkbox
                    checked={showBegreper}
                    onCheckedChange={(c) => setShowBegreper(Boolean(c))}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="text-sm font-medium">Begreper</span>
                    <span className="text-muted-foreground block text-xs leading-snug">
                      Ekstra forklaring nederst på dashboardet
                    </span>
                  </span>
                </label>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <LayoutGrid className="text-muted-foreground size-4" aria-hidden />
                <p className="text-sm font-semibold">Aktivitetsliste</p>
              </div>
              <div className="grid gap-3 rounded-xl border border-border/50 bg-muted/15 px-3 py-3 sm:grid-cols-2">
                <label className="space-y-1.5 text-sm">
                  <span className="font-medium">Visning</span>
                  <select
                    value={homeListViewMode}
                    onChange={(e) =>
                      setHomeListViewMode(
                        e.target.value as "cards" | "list" | "table",
                      )
                    }
                    className="h-11 w-full appearance-none rounded-xl border border-border/50 bg-background px-3 text-sm"
                  >
                    <option value="cards">Kort</option>
                    <option value="list">Liste</option>
                    <option value="table">Tabell</option>
                  </select>
                </label>
                <label className="space-y-1.5 text-sm">
                  <span className="font-medium">Per side</span>
                  <select
                    value={homeListPageSize}
                    onChange={(e) =>
                      setHomeListPageSize(
                        Number(e.target.value) as 6 | 10 | 20,
                      )
                    }
                    className="h-11 w-full appearance-none rounded-xl border border-border/50 bg-background px-3 text-sm"
                  >
                    <option value={6}>6</option>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                  </select>
                </label>
                <p className="text-muted-foreground text-xs leading-snug sm:col-span-2">
                  Lagres for deg i dette arbeidsområdet og huskes neste gang du
                  logger inn.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <LayoutGrid className="text-muted-foreground size-4" aria-hidden />
                <p className="text-sm font-semibold">Snarveier</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {shortcuts.map((s) => (
                  <label
                    key={s.id}
                    className="flex cursor-pointer items-start gap-2 rounded-lg border border-border/50 bg-card px-2.5 py-2"
                  >
                    <Checkbox
                      checked={visibleIds.has(s.id)}
                      onCheckedChange={() => toggleShortcut(s.id)}
                      className="mt-0.5"
                    />
                    <span className="min-w-0">
                      <span className="text-sm font-medium">{s.title}</span>
                      <span className="text-muted-foreground block text-[11px] leading-snug">
                        {s.desc}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Standardvisning viser kun de viktigste snarveiene.
              </p>
            </div>
          </DialogBody>
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              className="text-muted-foreground gap-2"
              disabled={busy}
              onClick={() => void handleReset()}
            >
              <RotateCcw className="size-4" aria-hidden />
              Tilbakestill standard
            </Button>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={busy}
              >
                Avbryt
              </Button>
              <Button
                type="button"
                disabled={busy || prefs === undefined}
                onClick={() => void handleSave()}
              >
                {busy ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    Lagrer …
                  </>
                ) : (
                  "Lagre"
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
