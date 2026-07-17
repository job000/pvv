import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import {
  getWorkspaceMembership,
  requireUserId,
  requireWorkspaceMember,
} from "./lib/access";

const ALLOWED_SHORTCUT_IDS = new Set([
  "oversikt",
  "vurderinger",
  "prosessregister",
  "prosessdesign",
  "skjemaer",
  "ros",
  "organisasjon",
  "delinger",
  "varslinger",
  "innstillinger",
]);

const DEFAULT_SHORTCUT_IDS = [
  "oversikt",
  "vurderinger",
  "prosessregister",
  "ros",
  "organisasjon",
];

const homeListViewModeValidator = v.union(
  v.literal("cards"),
  v.literal("list"),
  v.literal("table"),
);

const homeListPageSizeValidator = v.union(
  v.literal(6),
  v.literal(10),
  v.literal(20),
);

function cleanShortcutIds(ids: string[]): string[] {
  return [...new Set(ids)].filter((id) => ALLOWED_SHORTCUT_IDS.has(id));
}

export const getMyWorkspaceViewPrefs = query({
  args: { workspaceId: v.id("workspaces") },
  returns: v.union(
    v.object({
      _id: v.id("workspaceUserViewPrefs"),
      _creationTime: v.number(),
      userId: v.id("users"),
      workspaceId: v.id("workspaces"),
      visibleShortcutIds: v.array(v.string()),
      showMetrics: v.boolean(),
      showPrioritySection: v.boolean(),
      showRecentSection: v.boolean(),
      showBegreperSection: v.boolean(),
      homeListViewMode: v.optional(homeListViewModeValidator),
      homeListPageSize: v.optional(homeListPageSizeValidator),
      updatedAt: v.number(),
    }),
    v.null(),
  ),
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
    homeListViewMode: v.optional(homeListViewModeValidator),
    homeListPageSize: v.optional(homeListPageSizeValidator),
  },
  returns: v.null(),
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
        ...(args.homeListViewMode !== undefined
          ? { homeListViewMode: args.homeListViewMode }
          : {}),
        ...(args.homeListPageSize !== undefined
          ? { homeListPageSize: args.homeListPageSize }
          : {}),
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
        homeListViewMode: args.homeListViewMode,
        homeListPageSize: args.homeListPageSize,
        updatedAt: now,
      });
    }
    return null;
  },
});

/** Hurtiglagring av hjem-listens visning/paginering (per bruker × område). */
export const setMyHomeListPrefs = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    homeListViewMode: homeListViewModeValidator,
    homeListPageSize: homeListPageSizeValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireWorkspaceMember(ctx, args.workspaceId, userId, "viewer");
    const now = Date.now();
    const existing = await ctx.db
      .query("workspaceUserViewPrefs")
      .withIndex("by_user_workspace", (q) =>
        q.eq("userId", userId).eq("workspaceId", args.workspaceId),
      )
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        homeListViewMode: args.homeListViewMode,
        homeListPageSize: args.homeListPageSize,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("workspaceUserViewPrefs", {
        userId,
        workspaceId: args.workspaceId,
        visibleShortcutIds: DEFAULT_SHORTCUT_IDS,
        showMetrics: true,
        showPrioritySection: true,
        showRecentSection: true,
        showBegreperSection: false,
        homeListViewMode: args.homeListViewMode,
        homeListPageSize: args.homeListPageSize,
        updatedAt: now,
      });
    }
    return null;
  },
});

export const clearMyWorkspaceViewPrefs = mutation({
  args: { workspaceId: v.id("workspaces") },
  returns: v.null(),
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
