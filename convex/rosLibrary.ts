import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireUserId, requireWorkspaceMember } from "./lib/access";

async function workspaceIdsForUser(
  ctx: QueryCtx,
  userId: Id<"users">,
): Promise<Set<Id<"workspaces">>> {
  const rows = await ctx.db
    .query("workspaceMembers")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  return new Set(rows.map((r) => r.workspaceId));
}

async function requireCategoryInWorkspace(
  ctx: QueryCtx,
  categoryId: Id<"rosLibraryCategories">,
  workspaceId: Id<"workspaces">,
): Promise<Doc<"rosLibraryCategories">> {
  const cat = await ctx.db.get(categoryId);
  if (!cat || cat.workspaceId !== workspaceId) {
    throw new Error("Ugyldig kategori.");
  }
  return cat;
}

export const listLibraryCategories = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    await requireWorkspaceMember(ctx, args.workspaceId, userId, "viewer");
    const rows = await ctx.db
      .query("rosLibraryCategories")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    rows.sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return a.name.localeCompare(b.name, "nb", { sensitivity: "base" });
    });
    return rows;
  },
});

export const createLibraryCategory = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireWorkspaceMember(ctx, args.workspaceId, userId, "member");
    const name = args.name.trim();
    if (!name) throw new Error("Kategorinavn kan ikke være tomt.");
    const existing = await ctx.db
      .query("rosLibraryCategories")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    if (
      existing.some(
        (c) => c.name.localeCompare(name, "nb", { sensitivity: "base" }) === 0,
      )
    ) {
      throw new Error("Det finnes allerede en kategori med dette navnet.");
    }
    const maxSort = existing.reduce((m, c) => Math.max(m, c.sortOrder), 0);
    const now = Date.now();
    return await ctx.db.insert("rosLibraryCategories", {
      workspaceId: args.workspaceId,
      name,
      sortOrder: maxSort + 1,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateLibraryCategory = mutation({
  args: {
    categoryId: v.id("rosLibraryCategories"),
    name: v.optional(v.string()),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const row = await ctx.db.get(args.categoryId);
    if (!row) throw new Error("Kategorien finnes ikke.");
    await requireWorkspaceMember(ctx, row.workspaceId, userId, "member");
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.name !== undefined) {
      const name = args.name.trim();
      if (!name) throw new Error("Kategorinavn kan ikke være tomt.");
      const siblings = await ctx.db
        .query("rosLibraryCategories")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", row.workspaceId))
        .collect();
      if (
        siblings.some(
          (c) =>
            c._id !== args.categoryId &&
            c.name.localeCompare(name, "nb", { sensitivity: "base" }) === 0,
        )
      ) {
        throw new Error("Det finnes allerede en kategori med dette navnet.");
      }
      patch.name = name;
    }
    if (args.sortOrder !== undefined) {
      patch.sortOrder = args.sortOrder;
    }
    await ctx.db.patch(args.categoryId, patch);
    return null;
  },
});

export const removeLibraryCategory = mutation({
  args: { categoryId: v.id("rosLibraryCategories") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const row = await ctx.db.get(args.categoryId);
    if (!row) throw new Error("Kategorien finnes ikke.");
    await requireWorkspaceMember(ctx, row.workspaceId, userId, "member");
    const items = await ctx.db
      .query("rosLibraryItems")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", row.workspaceId))
      .collect();
    const now = Date.now();
    for (const it of items) {
      if (it.categoryId === args.categoryId) {
        await ctx.db.patch(it._id, { categoryId: undefined, updatedAt: now });
      }
    }
    await ctx.db.delete(args.categoryId);
    return null;
  },
});

export const listLibraryItems = query({
  args: {
    workspaceId: v.id("workspaces"),
    sortBy: v.optional(
      v.union(
        v.literal("category"),
        v.literal("title"),
        v.literal("updated"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    await requireWorkspaceMember(ctx, args.workspaceId, userId, "viewer");
    const memberOf = await workspaceIdsForUser(ctx, userId);

    const local = await ctx.db
      .query("rosLibraryItems")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    const sharedOthers = await ctx.db
      .query("rosLibraryItems")
      .withIndex("by_visibility", (q) => q.eq("visibility", "shared"))
      .collect();

    const merged = [...local];
    for (const row of sharedOthers) {
      if (row.workspaceId === args.workspaceId) continue;
      if (!memberOf.has(row.workspaceId)) continue;
      merged.push(row);
    }

    const catIds = [
      ...new Set(
        merged
          .map((m) => m.categoryId)
          .filter((id): id is Id<"rosLibraryCategories"> => Boolean(id)),
      ),
    ];
    const cats = new Map<Id<"rosLibraryCategories">, Doc<"rosLibraryCategories">>();
    for (const id of catIds) {
      const c = await ctx.db.get(id);
      if (c) cats.set(id, c);
    }

    const sortMode = args.sortBy ?? "category";
    const UNCATEG = 1_000_000_000;

    merged.sort((a, b) => {
      if (sortMode === "title") {
        return a.title.localeCompare(b.title, "nb", { sensitivity: "base" });
      }
      if (sortMode === "updated") {
        return b.updatedAt - a.updatedAt;
      }
      const ca = a.categoryId ? cats.get(a.categoryId) : undefined;
      const cb = b.categoryId ? cats.get(b.categoryId) : undefined;
      const sa = ca?.sortOrder ?? UNCATEG;
      const sb = cb?.sortOrder ?? UNCATEG;
      if (sa !== sb) return sa - sb;
      const na = ca?.name ?? "";
      const nb = cb?.name ?? "";
      if (na !== nb) return na.localeCompare(nb, "nb", { sensitivity: "base" });
      return a.title.localeCompare(b.title, "nb", { sensitivity: "base" });
    });

    const out = [];
    for (const row of merged) {
      const ws = await ctx.db.get(row.workspaceId);
      const cat = row.categoryId ? cats.get(row.categoryId) : undefined;
      out.push({
        ...row,
        isFromOtherWorkspace: row.workspaceId !== args.workspaceId,
        sourceWorkspaceName: ws?.name ?? null,
        categoryName: cat?.name ?? null,
        categorySortOrder: cat?.sortOrder ?? null,
      });
    }
    return out;
  },
});

export const createLibraryItem = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    title: v.string(),
    riskText: v.string(),
    tiltakText: v.optional(v.string()),
    flags: v.optional(v.array(v.string())),
    tags: v.optional(v.array(v.string())),
    categoryId: v.optional(v.id("rosLibraryCategories")),
    visibility: v.optional(
      v.union(v.literal("workspace"), v.literal("shared")),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireWorkspaceMember(ctx, args.workspaceId, userId, "member");
    const title = args.title.trim();
    const riskText = args.riskText.trim();
    if (!title) throw new Error("Tittel er påkrevd.");
    if (!riskText) throw new Error("Risikobeskrivelse kan ikke være tom.");
    if (args.categoryId) {
      await requireCategoryInWorkspace(ctx, args.categoryId, args.workspaceId);
    }
    const now = Date.now();
    const vis = args.visibility ?? "workspace";
    return await ctx.db.insert("rosLibraryItems", {
      workspaceId: args.workspaceId,
      categoryId: args.categoryId,
      title,
      riskText,
      tiltakText: args.tiltakText?.trim() || undefined,
      flags:
        args.flags && args.flags.length > 0 ? args.flags : undefined,
      tags:
        args.tags && args.tags.length > 0
          ? args.tags.map((t) => t.trim()).filter(Boolean)
          : undefined,
      createdByUserId: userId,
      createdAt: now,
      updatedAt: now,
      visibility: vis,
    });
  },
});

export const updateLibraryItem = mutation({
  args: {
    itemId: v.id("rosLibraryItems"),
    title: v.optional(v.string()),
    riskText: v.optional(v.string()),
    tiltakText: v.optional(v.union(v.string(), v.null())),
    flags: v.optional(v.union(v.array(v.string()), v.null())),
    tags: v.optional(v.union(v.array(v.string()), v.null())),
    categoryId: v.optional(
      v.union(v.id("rosLibraryCategories"), v.null()),
    ),
    visibility: v.optional(
      v.union(v.literal("workspace"), v.literal("shared")),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const row = await ctx.db.get(args.itemId);
    if (!row) throw new Error("Elementet finnes ikke.");
    await requireWorkspaceMember(ctx, row.workspaceId, userId, "member");
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.title !== undefined) {
      const t = args.title.trim();
      if (!t) throw new Error("Tittel kan ikke være tom.");
      patch.title = t;
    }
    if (args.riskText !== undefined) {
      const r = args.riskText.trim();
      if (!r) throw new Error("Risikobeskrivelse kan ikke være tom.");
      patch.riskText = r;
    }
    if (args.tiltakText !== undefined) {
      patch.tiltakText =
        args.tiltakText === null || args.tiltakText.trim() === ""
          ? undefined
          : args.tiltakText.trim();
    }
    if (args.flags !== undefined) {
      patch.flags =
        args.flags === null || args.flags.length === 0
          ? undefined
          : args.flags;
    }
    if (args.tags !== undefined) {
      patch.tags =
        args.tags === null || args.tags.length === 0
          ? undefined
          : args.tags.map((t) => t.trim()).filter(Boolean);
    }
    if (args.categoryId !== undefined) {
      if (args.categoryId === null) {
        patch.categoryId = undefined;
      } else {
        await requireCategoryInWorkspace(
          ctx,
          args.categoryId,
          row.workspaceId,
        );
        patch.categoryId = args.categoryId;
      }
    }
    if (args.visibility !== undefined) {
      patch.visibility = args.visibility;
    }
    await ctx.db.patch(args.itemId, patch);
    return null;
  },
});

export const removeLibraryItem = mutation({
  args: { itemId: v.id("rosLibraryItems") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const row = await ctx.db.get(args.itemId);
    if (!row) throw new Error("Elementet finnes ikke.");
    await requireWorkspaceMember(ctx, row.workspaceId, userId, "member");
    await ctx.db.delete(args.itemId);
    return null;
  },
});

/** Kopier delt element inn i gjeldende arbeidsområde som eget utkast. */
export const duplicateLibraryItemToWorkspace = mutation({
  args: {
    itemId: v.id("rosLibraryItems"),
    targetWorkspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const row = await ctx.db.get(args.itemId);
    if (!row) throw new Error("Elementet finnes ikke.");
    await requireWorkspaceMember(ctx, row.workspaceId, userId, "viewer");
    await requireWorkspaceMember(ctx, args.targetWorkspaceId, userId, "member");
    const now = Date.now();

    let newCategoryId: Id<"rosLibraryCategories"> | undefined = undefined;
    if (row.categoryId) {
      const srcCat = await ctx.db.get(row.categoryId);
      if (srcCat) {
        const existing = await ctx.db
          .query("rosLibraryCategories")
          .withIndex("by_workspace", (q) =>
            q.eq("workspaceId", args.targetWorkspaceId),
          )
          .collect();
        const match = existing.find(
          (c) =>
            c.name.localeCompare(srcCat.name, "nb", { sensitivity: "base" }) ===
            0,
        );
        if (match) {
          newCategoryId = match._id;
        } else {
          const maxSort = existing.reduce((m, c) => Math.max(m, c.sortOrder), 0);
          newCategoryId = await ctx.db.insert("rosLibraryCategories", {
            workspaceId: args.targetWorkspaceId,
            name: srcCat.name,
            sortOrder: maxSort + 1,
            createdAt: now,
            updatedAt: now,
          });
        }
      }
    }

    return await ctx.db.insert("rosLibraryItems", {
      workspaceId: args.targetWorkspaceId,
      categoryId: newCategoryId,
      title: `${row.title} (kopi)`,
      riskText: row.riskText,
      tiltakText: row.tiltakText,
      flags: row.flags,
      tags: row.tags,
      createdByUserId: userId,
      createdAt: now,
      updatedAt: now,
      visibility: "workspace",
    });
  },
});
