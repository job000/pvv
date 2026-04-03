"use client";

import { Button, buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "@/lib/app-toast";
import { cn } from "@/lib/utils";
import { formatUserFacingError } from "@/lib/user-facing-error";
import { Menu } from "@base-ui/react/menu";
import { useMutation, useQuery } from "convex/react";
import { Bell, Check, Loader2, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";

function formatNotifTime(createdAt: number) {
  return new Date(createdAt).toLocaleString("nb-NO", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function InAppNotificationMenu() {
  const data = useQuery(api.userInAppNotifications.listMyInAppNotifications, {});
  const markRead = useMutation(api.userInAppNotifications.markInAppNotificationRead);
  const markAllRead = useMutation(
    api.userInAppNotifications.markAllInAppNotificationsRead,
  );
  const dismiss = useMutation(api.userInAppNotifications.dismissInAppNotification);
  const dismissAll = useMutation(
    api.userInAppNotifications.dismissAllInAppNotifications,
  );

  const [open, setOpen] = useState(false);
  const [rowPending, setRowPending] = useState<{
    id: Id<"userInAppNotifications">;
    op: "read" | "dismiss";
  } | null>(null);
  const [bulkBusy, setBulkBusy] = useState<"read" | "dismiss" | null>(null);

  const anyBusy = rowPending !== null || bulkBusy !== null;

  const onMarkRead = useCallback(
    async (notificationId: Id<"userInAppNotifications">) => {
      setRowPending({ id: notificationId, op: "read" });
      try {
        await markRead({ notificationId });
      } catch (e) {
        toast.error(formatUserFacingError(e, "Kunne ikke markere som lest."));
      } finally {
        setRowPending(null);
      }
    },
    [markRead],
  );

  const onDismiss = useCallback(
    async (notificationId: Id<"userInAppNotifications">) => {
      setRowPending({ id: notificationId, op: "dismiss" });
      try {
        await dismiss({ notificationId });
      } catch (e) {
        toast.error(formatUserFacingError(e, "Kunne ikke fjerne varslet."));
      } finally {
        setRowPending(null);
      }
    },
    [dismiss],
  );

  const onMarkAllRead = useCallback(async () => {
    setBulkBusy("read");
    try {
      await markAllRead({});
    } catch (e) {
      toast.error(formatUserFacingError(e, "Kunne ikke oppdatere varsler."));
    } finally {
      setBulkBusy(null);
    }
  }, [markAllRead]);

  const onDismissAll = useCallback(async () => {
    setBulkBusy("dismiss");
    try {
      await dismissAll({});
      setOpen(false);
    } catch (e) {
      toast.error(formatUserFacingError(e, "Kunne ikke fjerne alle."));
    } finally {
      setBulkBusy(null);
    }
  }, [dismissAll]);

  const unreadCount = data?.unreadCount ?? 0;
  const items = data?.items ?? [];
  const hasUnread = unreadCount > 0;
  const badgeText = unreadCount > 99 ? "99+" : String(unreadCount);
  const loading = data === undefined;

  return (
    <Menu.Root open={open} onOpenChange={setOpen} modal={false}>
      <Menu.Trigger
        type="button"
        className={cn(
          buttonVariants({ variant: "ghost", size: "icon" }),
          "text-muted-foreground hover:bg-background/90 relative size-10 shrink-0 rounded-xl",
        )}
        aria-label={
          hasUnread
            ? `Varsler, ${unreadCount} uleste`
            : "Varsler — ingen uleste"
        }
      >
        <Bell className="size-[1.2rem]" strokeWidth={2} aria-hidden />
        {!loading && hasUnread ? (
          <span
            className="bg-destructive text-destructive-foreground absolute -right-0.5 -top-0.5 flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full px-1 text-[10px] font-bold tabular-nums shadow-sm ring-2 ring-background"
            aria-hidden
          >
            {badgeText}
          </span>
        ) : null}
        {loading ? (
          <span
            className="bg-muted-foreground/25 absolute -right-0.5 -top-0.5 size-2.5 rounded-full ring-2 ring-background"
            aria-hidden
          />
        ) : null}
      </Menu.Trigger>

      <Menu.Portal>
        <Menu.Positioner
          className="z-50 outline-none"
          side="bottom"
          align="end"
          sideOffset={8}
        >
          <Menu.Popup
            className={cn(
              "border-border/60 bg-popover text-popover-foreground shadow-[var(--shadow-elevated)] flex max-h-[min(70vh,26rem)] w-[min(calc(100vw-1.5rem),22rem)] origin-[var(--transform-origin)] flex-col overflow-hidden rounded-2xl border backdrop-blur-xl transition-[transform,scale,opacity] data-[ending-style]:scale-98 data-[ending-style]:opacity-0 data-[starting-style]:scale-98 data-[starting-style]:opacity-0 dark:bg-popover/95",
            )}
          >
            <div className="border-border/50 flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2.5">
              <p className="text-sm font-semibold tracking-tight">Varsler</p>
              <div className="flex flex-wrap items-center gap-1">
                {hasUnread ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    className="h-7 rounded-lg text-xs"
                    disabled={anyBusy}
                    onClick={() => void onMarkAllRead()}
                  >
                    {bulkBusy === "read" ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <>
                        <Check className="size-3.5" />
                        Merk alle lest
                      </>
                    )}
                  </Button>
                ) : null}
                {items.length > 0 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    className="text-destructive hover:text-destructive h-7 rounded-lg text-xs"
                    disabled={anyBusy}
                    onClick={() => void onDismissAll()}
                  >
                    {bulkBusy === "dismiss" ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <>
                        <Trash2 className="size-3.5" />
                        Fjern alle
                      </>
                    )}
                  </Button>
                ) : null}
              </div>
            </div>

            <Menu.Viewport className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
              {data === undefined ? (
                <p className="text-muted-foreground px-2 py-6 text-center text-sm">
                  Laster …
                </p>
              ) : items.length === 0 ? (
                <p className="text-muted-foreground px-2 py-8 text-center text-sm leading-relaxed">
                  Ingen varsler akkurat nå.
                  <span className="mt-2 block text-xs">
                    Du får beskjed her når du blir lagt til i et arbeidsområde eller
                    på en vurdering.
                  </span>
                </p>
              ) : (
                <ul className="flex flex-col gap-1.5" role="list">
                  {items.map((row) => {
                    const unread = row.readAt === undefined;
                    const rowLock =
                      rowPending?.id === row._id || bulkBusy !== null;
                    const readLoading =
                      rowPending?.id === row._id && rowPending.op === "read";
                    const dismissLoading =
                      rowPending?.id === row._id && rowPending.op === "dismiss";
                    return (
                      <li
                        key={row._id}
                        className={cn(
                          "rounded-xl border border-border/50 p-2.5 transition-colors",
                          unread ? "bg-primary/[0.06]" : "bg-muted/15",
                        )}
                      >
                        <div className="flex gap-2">
                          <div className="min-w-0 flex-1 space-y-1">
                            {row.href ? (
                              <Link
                                href={row.href}
                                className="text-foreground block text-sm font-medium leading-snug hover:underline"
                                onClick={() => {
                                  void onMarkRead(row._id);
                                  setOpen(false);
                                }}
                              >
                                {row.title}
                              </Link>
                            ) : (
                              <p className="text-sm font-medium leading-snug">
                                {row.title}
                              </p>
                            )}
                            {row.body ? (
                              <p className="text-muted-foreground text-xs leading-snug">
                                {row.body}
                              </p>
                            ) : null}
                            <p className="text-muted-foreground text-[10px] tabular-nums">
                              {formatNotifTime(row.createdAt)}
                              {unread ? (
                                <span className="text-primary ml-1.5 font-medium">
                                  · Ulest
                                </span>
                              ) : null}
                            </p>
                          </div>
                          <div className="flex shrink-0 flex-col gap-0.5">
                            {unread ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="xs"
                                className="h-7 px-2 text-xs"
                                disabled={rowLock}
                                onClick={() => void onMarkRead(row._id)}
                                title="Merk som lest"
                              >
                                {readLoading ? (
                                  <Loader2 className="size-3.5 animate-spin" />
                                ) : (
                                  "Lest"
                                )}
                              </Button>
                            ) : null}
                            <Button
                              type="button"
                              variant="ghost"
                              size="xs"
                              className="text-muted-foreground hover:text-destructive h-7 px-2 text-xs"
                              disabled={rowLock}
                              onClick={() => void onDismiss(row._id)}
                              title="Fjern varsel"
                            >
                              {dismissLoading ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : (
                                "Fjern"
                              )}
                            </Button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Menu.Viewport>

            {items.length > 0 ? (
              <>
                <Separator />
                <p className="text-muted-foreground px-3 py-2 text-[10px] leading-relaxed">
                  E-postvarsler finner du under{" "}
                  <span className="text-foreground font-medium">Varslinger</span>{" "}
                  i menyen til arbeidsområdet.
                </p>
              </>
            ) : null}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
