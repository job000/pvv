import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internalMutation, mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { requireUserId, requireWorkspaceMember } from "./lib/access";

export const listByWorkspace = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }
    await requireWorkspaceMember(ctx, args.workspaceId, userId, "viewer");
    const rows = await ctx.db
      .query("sprints")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    return rows.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const create = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.string(),
    startAt: v.number(),
    endAt: v.number(),
    goal: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireWorkspaceMember(ctx, args.workspaceId, userId, "member");
    const now = Date.now();
    const name = args.name.trim();
    if (!name) {
      throw new Error("Sprintnavn mangler.");
    }
    if (args.endAt < args.startAt) {
      throw new Error("Slutt må være etter start.");
    }
    return await ctx.db.insert("sprints", {
      workspaceId: args.workspaceId,
      name,
      startAt: args.startAt,
      endAt: args.endAt,
      goal: args.goal,
      createdByUserId: userId,
      createdAt: now,
    });
  },
});

/** Synkronisering fra GitHub Projects — kun via internal action. */
export const applyGithubIterationsSync = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    createdByUserId: v.id("users"),
    items: v.array(
      v.object({
        githubIterationId: v.string(),
        name: v.string(),
        startAt: v.number(),
        endAt: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("sprints")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    const byGh = new Map<string, Id<"sprints">>();
    for (const s of existing) {
      if (s.githubIterationId) {
        byGh.set(s.githubIterationId, s._id);
      }
    }
    let created = 0;
    let updated = 0;
    for (const it of args.items) {
      const sid = byGh.get(it.githubIterationId);
      if (sid) {
        await ctx.db.patch(sid, {
          name: it.name,
          startAt: it.startAt,
          endAt: it.endAt,
          githubIterationId: it.githubIterationId,
        });
        updated++;
      } else {
        await ctx.db.insert("sprints", {
          workspaceId: args.workspaceId,
          name: it.name,
          startAt: it.startAt,
          endAt: it.endAt,
          githubIterationId: it.githubIterationId,
          createdByUserId: args.createdByUserId,
          createdAt: now,
        });
        created++;
      }
    }
    return { created, updated };
  },
});
