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
            ? "h-9 min-h-[36px] gap-1.5 px-3 text-xs font-medium sm:h-9"
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
                    <span className="text-sm font-medium">Nøkkeltall</span>
                    <span className="text-muted-foreground block text-xs leading-snug">
                      Fokuskort og tre kompakte oversikter
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
                    <span className="text-sm font-medium">Høyeste prioritet</span>
                    <span className="text-muted-foreground block text-xs leading-snug">
                      Liste over saker sortert etter prioritet
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
                    <span className="text-sm font-medium">Sist oppdatert</span>
                    <span className="text-muted-foreground block text-xs leading-snug">
                      Siste aktivitet på vurderinger
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
