import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { requireUserId } from "./lib/access";

const LIST_LIMIT = 40;
const UNREAD_SCAN_CAP = 120;

export async function insertUserInAppNotification(
  ctx: MutationCtx,
  args: {
    userId: Id<"users">;
    title: string;
    body?: string;
    href?: string;
  },
) {
  await ctx.db.insert("userInAppNotifications", {
    userId: args.userId,
    title: args.title,
    body: args.body,
    href: args.href,
    createdAt: Date.now(),
  });
}

export const listMyInAppNotifications = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }
    const items = await ctx.db
      .query("userInAppNotifications")
      .withIndex("by_user_created", (q) => q.eq("userId", userId))
      .order("desc")
      .take(LIST_LIMIT);

    const forUnreadCount = await ctx.db
      .query("userInAppNotifications")
      .withIndex("by_user_created", (q) => q.eq("userId", userId))
      .order("desc")
      .take(UNREAD_SCAN_CAP);
    const unreadCount = forUnreadCount.filter((row) => row.readAt === undefined)
      .length;

    return { items, unreadCount };
  },
});

export const markInAppNotificationRead = mutation({
  args: { notificationId: v.id("userInAppNotifications") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const row = await ctx.db.get(args.notificationId);
    if (!row || row.userId !== userId) {
      throw new Error("Varslet finnes ikke.");
    }
    if (row.readAt === undefined) {
      await ctx.db.patch(args.notificationId, { readAt: Date.now() });
    }
    return null;
  },
});

export const markAllInAppNotificationsRead = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const rows = await ctx.db
      .query("userInAppNotifications")
      .withIndex("by_user_created", (q) => q.eq("userId", userId))
      .collect();
    const now = Date.now();
    for (const row of rows) {
      if (row.readAt === undefined) {
        await ctx.db.patch(row._id, { readAt: now });
      }
    }
    return null;
  },
});

export const dismissInAppNotification = mutation({
  args: { notificationId: v.id("userInAppNotifications") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const row = await ctx.db.get(args.notificationId);
    if (!row || row.userId !== userId) {
      throw new Error("Varslet finnes ikke.");
    }
    await ctx.db.delete(args.notificationId);
    return null;
  },
});

export const dismissAllInAppNotifications = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const rows = await ctx.db
      .query("userInAppNotifications")
      .withIndex("by_user_created", (q) => q.eq("userId", userId))
      .collect();
    for (const row of rows) {
      await ctx.db.delete(row._id);
    }
    return null;
  },
});
