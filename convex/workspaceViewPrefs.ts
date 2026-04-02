import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import {
  getWorkspaceMembership,
  requireUserId,
  requireWorkspaceMember,
} from "./lib/access";

const ALLOWED_SHORTCUT_IDS = new Set([
  "vurderinger",
  "prosessregister",
  "skjemaer",
  "ros",
  "organisasjon",
  "delinger",
  "varslinger",
  "innstillinger",
]);

function cleanShortcutIds(ids: string[]): string[] {
  return [...new Set(ids)].filter((id) => ALLOWED_SHORTCUT_IDS.has(id));
}

export const getMyWorkspaceViewPrefs = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }
    const m = await getWorkspaceMembership(ctx, args.workspaceId, userId);
    if (!m) {
      return null;
    }
    return await ctx.db
      .query("workspaceUserViewPrefs")
      .withIndex("by_user_workspace", (q) =>
        q.eq("userId", userId).eq("workspaceId", args.workspaceId),
      )
      .unique();
  },
});

export const setMyWorkspaceViewPrefs = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    visibleShortcutIds: v.array(v.string()),
    showMetrics: v.boolean(),
    showPrioritySection: v.boolean(),
    showRecentSection: v.boolean(),
    showBegreperSection: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireWorkspaceMember(ctx, args.workspaceId, userId, "viewer");
    const visible = cleanShortcutIds(args.visibleShortcutIds);
    const now = Date.now();
    const existing = await ctx.db
      .query("workspaceUserViewPrefs")
      .withIndex("by_user_workspace", (q) =>
        q.eq("userId", userId).eq("workspaceId", args.workspaceId),
      )
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        visibleShortcutIds: visible,
        showMetrics: args.showMetrics,
        showPrioritySection: args.showPrioritySection,
        showRecentSection: args.showRecentSection,
        showBegreperSection: args.showBegreperSection,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("workspaceUserViewPrefs", {
        userId,
        workspaceId: args.workspaceId,
        visibleShortcutIds: visible,
        showMetrics: args.showMetrics,
        showPrioritySection: args.showPrioritySection,
        showRecentSection: args.showRecentSection,
        showBegreperSection: args.showBegreperSection,
        updatedAt: now,
      });
    }
    return null;
  },
});

export const clearMyWorkspaceViewPrefs = mutation({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireWorkspaceMember(ctx, args.workspaceId, userId, "viewer");
    const existing = await ctx.db
      .query("workspaceUserViewPrefs")
      .withIndex("by_user_workspace", (q) =>
        q.eq("userId", userId).eq("workspaceId", args.workspaceId),
      )
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
    }
    return null;
  },
});
