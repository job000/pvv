import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getForWorkspace = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }
    const member = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_user_workspace", (q) =>
        q.eq("userId", userId).eq("workspaceId", args.workspaceId),
      )
      .unique();
    if (!member) {
      return null;
    }
    const row = await ctx.db
      .query("userWorkspaceLeveransePrefs")
      .withIndex("by_user_workspace", (q) =>
        q.eq("userId", userId).eq("workspaceId", args.workspaceId),
      )
      .unique();
    return row;
  },
});

export const upsert = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    viewMode: v.union(v.literal("kanban"), v.literal("list")),
    sprintFilter: v.union(v.literal("all"), v.id("sprints")),
    density: v.optional(
      v.union(v.literal("comfortable"), v.literal("compact")),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Ikke innlogget.");
    }
    const member = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_user_workspace", (q) =>
        q.eq("userId", userId).eq("workspaceId", args.workspaceId),
      )
      .unique();
    if (!member) {
      throw new Error("Ingen tilgang til arbeidsområdet.");
    }
    const now = Date.now();
    const existing = await ctx.db
      .query("userWorkspaceLeveransePrefs")
      .withIndex("by_user_workspace", (q) =>
        q.eq("userId", userId).eq("workspaceId", args.workspaceId),
      )
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        viewMode: args.viewMode,
        sprintFilter: args.sprintFilter,
        density: args.density,
        updatedAt: now,
      });
      return existing._id;
    }
    return await ctx.db.insert("userWorkspaceLeveransePrefs", {
      userId,
      workspaceId: args.workspaceId,
      viewMode: args.viewMode,
      sprintFilter: args.sprintFilter,
      density: args.density,
      updatedAt: now,
    });
  },
});
