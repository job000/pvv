import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";
import { requireUserId, requireWorkspaceMember } from "./lib/access";

function slugCode(raw: string): string {
  const s = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9æøå]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
  return s || "liste";
}

export const listAxisLists = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    await requireWorkspaceMember(ctx, args.workspaceId, userId, "viewer");
    const rows = await ctx.db
      .query("rosAxisLists")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    rows.sort((a, b) => a.name.localeCompare(b.name, "nb-NO"));
    return rows;
  },
});

export const getAxisListWithItems = query({
  args: { listId: v.id("rosAxisLists") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const row = await ctx.db.get(args.listId);
    if (!row) return null;
    await requireWorkspaceMember(ctx, row.workspaceId, userId, "viewer");
    const items = await ctx.db
      .query("rosAxisListItems")
      .withIndex("by_list", (q) => q.eq("listId", args.listId))
      .collect();
    items.sort((a, b) => a.sortOrder - b.sortOrder);
    return { list: row, items };
  },
});

export const createAxisList = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.string(),
    description: v.optional(v.string()),
    code: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireWorkspaceMember(ctx, args.workspaceId, userId, "member");
    const name = args.name.trim();
    if (!name) throw new Error("Navn er påkrevd.");
    let code = slugCode(args.code ?? name);
    const existing = await ctx.db
      .query("rosAxisLists")
      .withIndex("by_workspace_code", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("code", code),
      )
      .unique();
    if (existing) {
      code = `${code}_${Date.now().toString(36).slice(-4)}`;
    }
    const now = Date.now();
    return await ctx.db.insert("rosAxisLists", {
      workspaceId: args.workspaceId,
      name,
      description: args.description?.trim() || undefined,
      code,
      createdByUserId: userId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateAxisList = mutation({
  args: {
    listId: v.id("rosAxisLists"),
    name: v.optional(v.string()),
    description: v.optional(v.union(v.string(), v.null())),
    code: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const row = await ctx.db.get(args.listId);
    if (!row) throw new Error("Listen finnes ikke.");
    await requireWorkspaceMember(ctx, row.workspaceId, userId, "member");
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.name !== undefined) {
      const n = args.name.trim();
      if (!n) throw new Error("Navn kan ikke være tomt.");
      patch.name = n;
    }
    if (args.description !== undefined) {
      patch.description =
        args.description === null ? undefined : args.description.trim() || undefined;
    }
    if (args.code !== undefined) {
      const c = slugCode(args.code);
      if (!c) throw new Error("Kode kan ikke være tom.");
      const clash = await ctx.db
        .query("rosAxisLists")
        .withIndex("by_workspace_code", (q) =>
          q.eq("workspaceId", row.workspaceId).eq("code", c),
        )
        .unique();
      if (clash && clash._id !== args.listId) {
        throw new Error("Denne koden er allerede i bruk i arbeidsområdet.");
      }
      patch.code = c;
    }
    await ctx.db.patch(args.listId, patch);
    return null;
  },
});

export const removeAxisList = mutation({
  args: { listId: v.id("rosAxisLists") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const row = await ctx.db.get(args.listId);
    if (!row) throw new Error("Listen finnes ikke.");
    await requireWorkspaceMember(ctx, row.workspaceId, userId, "member");
    const items = await ctx.db
      .query("rosAxisListItems")
      .withIndex("by_list", (q) => q.eq("listId", args.listId))
      .collect();
    for (const it of items) {
      await ctx.db.delete(it._id);
    }
    await ctx.db.delete(args.listId);
    return null;
  },
});

export const addAxisListItem = mutation({
  args: {
    listId: v.id("rosAxisLists"),
    label: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const list = await ctx.db.get(args.listId);
    if (!list) throw new Error("Listen finnes ikke.");
    await requireWorkspaceMember(ctx, list.workspaceId, userId, "member");
    const label = args.label.trim();
    if (!label) throw new Error("Etikett er påkrevd.");
    const existing = await ctx.db
      .query("rosAxisListItems")
      .withIndex("by_list", (q) => q.eq("listId", args.listId))
      .collect();
    const sortOrder =
      existing.reduce((m, x) => Math.max(m, x.sortOrder), 0) + 1;
    const now = Date.now();
    return await ctx.db.insert("rosAxisListItems", {
      listId: args.listId,
      label,
      description: args.description?.trim() || undefined,
      sortOrder,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateAxisListItem = mutation({
  args: {
    itemId: v.id("rosAxisListItems"),
    label: v.optional(v.string()),
    description: v.optional(v.union(v.string(), v.null())),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const item = await ctx.db.get(args.itemId);
    if (!item) throw new Error("Punktet finnes ikke.");
    const list = await ctx.db.get(item.listId);
    if (!list) throw new Error("Listen finnes ikke.");
    await requireWorkspaceMember(ctx, list.workspaceId, userId, "member");
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.label !== undefined) {
      const l = args.label.trim();
      if (!l) throw new Error("Etikett kan ikke være tom.");
      patch.label = l;
    }
    if (args.description !== undefined) {
      patch.description =
        args.description === null ? undefined : args.description.trim() || undefined;
    }
    if (args.sortOrder !== undefined) {
      patch.sortOrder = Math.round(args.sortOrder);
    }
    await ctx.db.patch(args.itemId, patch);
    return null;
  },
});

export const removeAxisListItem = mutation({
  args: { itemId: v.id("rosAxisListItems") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const item = await ctx.db.get(args.itemId);
    if (!item) throw new Error("Punktet finnes ikke.");
    const list = await ctx.db.get(item.listId);
    if (!list) throw new Error("Listen finnes ikke.");
    await requireWorkspaceMember(ctx, list.workspaceId, userId, "member");
    await ctx.db.delete(args.itemId);
    return null;
  },
});

export const reorderAxisListItems = mutation({
  args: {
    listId: v.id("rosAxisLists"),
    orderedItemIds: v.array(v.id("rosAxisListItems")),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const list = await ctx.db.get(args.listId);
    if (!list) throw new Error("Listen finnes ikke.");
    await requireWorkspaceMember(ctx, list.workspaceId, userId, "member");
    const now = Date.now();
    let o = 0;
    for (const id of args.orderedItemIds) {
      const item = await ctx.db.get(id);
      if (!item || item.listId !== args.listId) continue;
      await ctx.db.patch(id, { sortOrder: o++, updatedAt: now });
    }
    return null;
  },
});
