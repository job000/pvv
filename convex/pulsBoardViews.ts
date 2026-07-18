import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
} from "./_generated/server";
import {
  requirePulsBoardAccess,
} from "./lib/access";

const layoutValidator = v.union(
  v.literal("board"),
  v.literal("table"),
  v.literal("roadmap"),
);

const cardTypeValidator = v.union(
  v.literal("all"),
  v.literal("top"),
  v.literal("sub"),
);

const statusValidator = v.union(
  v.literal("all"),
  v.literal("open"),
  v.literal("done"),
);

const dueValidator = v.union(
  v.literal("all"),
  v.literal("overdue"),
  v.literal("week"),
  v.literal("none"),
);

export const viewFiltersValidator = v.object({
  query: v.string(),
  assignee: v.string(),
  columnId: v.string(),
  cardType: cardTypeValidator,
  status: statusValidator,
  due: dueValidator,
  processId: v.string(),
  assessmentId: v.string(),
});

export type ViewFilters = {
  query: string;
  assignee: string;
  columnId: string;
  cardType: "all" | "top" | "sub";
  status: "all" | "open" | "done";
  due: "all" | "overdue" | "week" | "none";
  processId: string;
  assessmentId: string;
};

export const DEFAULT_VIEW_FILTERS: ViewFilters = {
  query: "",
  assignee: "all",
  columnId: "",
  cardType: "all",
  status: "all",
  due: "all",
  processId: "",
  assessmentId: "",
};

const NAME_MAX = 40;

const viewReturnValidator = v.object({
  _id: v.id("pulsBoardViews"),
  boardId: v.id("pulsBoards"),
  name: v.string(),
  layout: layoutValidator,
  filters: viewFiltersValidator,
  order: v.number(),
  createdAt: v.number(),
  updatedAt: v.number(),
});

function normalizeName(raw: string): string {
  const name = raw.trim().slice(0, NAME_MAX);
  if (!name) throw new Error("Navn mangler.");
  return name;
}

function normalizeFilters(raw: ViewFilters | undefined): ViewFilters {
  if (!raw) return { ...DEFAULT_VIEW_FILTERS };
  return {
    query: typeof raw.query === "string" ? raw.query : "",
    assignee: typeof raw.assignee === "string" ? raw.assignee : "all",
    columnId: typeof raw.columnId === "string" ? raw.columnId : "",
    cardType:
      raw.cardType === "top" || raw.cardType === "sub" || raw.cardType === "all"
        ? raw.cardType
        : "all",
    status:
      raw.status === "open" || raw.status === "done" || raw.status === "all"
        ? raw.status
        : "all",
    due:
      raw.due === "overdue" ||
      raw.due === "week" ||
      raw.due === "none" ||
      raw.due === "all"
        ? raw.due
        : "all",
    processId: typeof raw.processId === "string" ? raw.processId : "",
    assessmentId: typeof raw.assessmentId === "string" ? raw.assessmentId : "",
  };
}

async function listViewsForBoard(
  ctx: MutationCtx,
  boardId: Id<"pulsBoards">,
): Promise<Doc<"pulsBoardViews">[]> {
  const rows = await ctx.db
    .query("pulsBoardViews")
    .withIndex("by_board", (q) => q.eq("boardId", boardId))
    .collect();
  return rows.sort((a, b) => a.order - b.order || a.createdAt - b.createdAt);
}

/**
 * Seed Tavle / Tabell / Roadmap når tavlen mangler views.
 * Trygg å kalle gjentatte ganger.
 */
export async function ensureDefaultViews(
  ctx: MutationCtx,
  board: Doc<"pulsBoards">,
  actorUserId: Id<"users">,
  seedFilters?: ViewFilters,
): Promise<Doc<"pulsBoardViews">[]> {
  const existing = await listViewsForBoard(ctx, board._id);
  if (existing.length > 0) return existing;

  const filters = normalizeFilters(seedFilters);
  const now = Date.now();
  const defaults: { name: string; layout: "board" | "table" | "roadmap" }[] =
    [
      { name: "Tavle", layout: "board" },
      { name: "Tabell", layout: "table" },
      { name: "Roadmap", layout: "roadmap" },
    ];

  const created: Doc<"pulsBoardViews">[] = [];
  for (let i = 0; i < defaults.length; i++) {
    const d = defaults[i]!;
    const id = await ctx.db.insert("pulsBoardViews", {
      boardId: board._id,
      workspaceId: board.workspaceId,
      name: d.name,
      layout: d.layout,
      filters: i === 0 ? filters : { ...DEFAULT_VIEW_FILTERS },
      order: (i + 1) * 1000,
      createdByUserId: actorUserId,
      createdAt: now,
      updatedAt: now,
    });
    const row = await ctx.db.get(id);
    if (row) created.push(row);
  }
  return created;
}

export const listByBoard = query({
  args: { boardId: v.id("pulsBoards") },
  returns: v.array(viewReturnValidator),
  handler: async (ctx, args) => {
    await requirePulsBoardAccess(ctx, args.boardId, "viewer");
    const rows = await ctx.db
      .query("pulsBoardViews")
      .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
      .collect();
    return rows
      .sort((a, b) => a.order - b.order || a.createdAt - b.createdAt)
      .map((r) => ({
        _id: r._id,
        boardId: r.boardId,
        name: r.name,
        layout: r.layout,
        filters: r.filters,
        order: r.order,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      }));
  },
});

export const ensureDefaults = mutation({
  args: { boardId: v.id("pulsBoards") },
  returns: v.array(viewReturnValidator),
  handler: async (ctx, args) => {
    const { board, userId } = await requirePulsBoardAccess(
      ctx,
      args.boardId,
      "viewer",
    );
    // Seed with prefs filters if present (one-time migrate)
    const pref = await ctx.db
      .query("pulsBoardUserPrefs")
      .withIndex("by_user_board", (q) =>
        q.eq("userId", userId).eq("boardId", args.boardId),
      )
      .unique();
    const seedFilters = pref?.filters
      ? normalizeFilters(pref.filters)
      : undefined;
    const rows = await ensureDefaultViews(ctx, board, userId, seedFilters);

    // Map legacy viewMode → activeViewId once
    if (pref && !pref.activeViewId && rows.length > 0) {
      let pick = rows[0]!;
      if (pref.viewMode === "table") {
        pick = rows.find((r) => r.layout === "table") ?? pick;
      } else if (pref.viewMode === "list") {
        pick = rows.find((r) => r.layout === "roadmap") ?? pick;
      } else {
        pick = rows.find((r) => r.layout === "board") ?? pick;
      }
      await ctx.db.patch(pref._id, {
        activeViewId: pick._id,
        updatedAt: Date.now(),
      });
    }

    return rows.map((r) => ({
      _id: r._id,
      boardId: r.boardId,
      name: r.name,
      layout: r.layout,
      filters: r.filters,
      order: r.order,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  },
});

export const create = mutation({
  args: {
    boardId: v.id("pulsBoards"),
    name: v.string(),
    layout: v.optional(layoutValidator),
    filters: v.optional(viewFiltersValidator),
  },
  returns: v.id("pulsBoardViews"),
  handler: async (ctx, args) => {
    const { board, userId } = await requirePulsBoardAccess(
      ctx,
      args.boardId,
      "editor",
    );
    await ensureDefaultViews(ctx, board, userId);
    const existing = await listViewsForBoard(ctx, args.boardId);
    const maxOrder = existing.reduce((m, r) => Math.max(m, r.order), 0);
    const now = Date.now();
    return await ctx.db.insert("pulsBoardViews", {
      boardId: args.boardId,
      workspaceId: board.workspaceId,
      name: normalizeName(args.name),
      layout: args.layout ?? "board",
      filters: normalizeFilters(args.filters),
      order: maxOrder + 1000,
      createdByUserId: userId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    viewId: v.id("pulsBoardViews"),
    name: v.optional(v.string()),
    layout: v.optional(layoutValidator),
    filters: v.optional(viewFiltersValidator),
  },
  returns: v.object({ ok: v.literal(true) }),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.viewId);
    if (!row) throw new Error("Fant ikke view.");
    await requirePulsBoardAccess(ctx, row.boardId, "editor");
    const patch: Partial<Doc<"pulsBoardViews">> = {
      updatedAt: Date.now(),
    };
    if (args.name !== undefined) {
      patch.name = normalizeName(args.name);
    }
    if (args.layout !== undefined) {
      patch.layout = args.layout;
    }
    if (args.filters !== undefined) {
      patch.filters = normalizeFilters(args.filters);
    }
    await ctx.db.patch(args.viewId, patch);
    return { ok: true as const };
  },
});

export const remove = mutation({
  args: { viewId: v.id("pulsBoardViews") },
  returns: v.object({ ok: v.literal(true) }),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.viewId);
    if (!row) throw new Error("Fant ikke view.");
    await requirePulsBoardAccess(ctx, row.boardId, "editor");
    const siblings = await listViewsForBoard(ctx, row.boardId);
    if (siblings.length <= 1) {
      throw new Error("Du kan ikke slette den siste viewen.");
    }
    await ctx.db.delete(args.viewId);

    // Clear activeViewId for users pointing at deleted view
    const members = await ctx.db
      .query("pulsBoardMembers")
      .withIndex("by_board", (q) => q.eq("boardId", row.boardId))
      .collect();
    for (const m of members) {
      const pref = await ctx.db
        .query("pulsBoardUserPrefs")
        .withIndex("by_user_board", (q) =>
          q.eq("userId", m.userId).eq("boardId", row.boardId),
        )
        .unique();
      if (pref?.activeViewId === args.viewId) {
        await ctx.db.patch(pref._id, {
          activeViewId: undefined,
          updatedAt: Date.now(),
        });
      }
    }
    return { ok: true as const };
  },
});
