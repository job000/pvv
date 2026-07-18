import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  canAccessPulsBoard,
  requirePulsBoardAccess,
} from "./lib/access";

const viewModeValidator = v.union(
  v.literal("columns"),
  v.literal("table"),
  v.literal("list"),
);

const commentsPlacementValidator = v.union(
  v.literal("tab"),
  v.literal("overview"),
);

const detailSizeValidator = v.union(
  v.literal("normal"),
  v.literal("large"),
  v.literal("full"),
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

const filtersValidator = v.object({
  query: v.string(),
  /** "all" | "me" | "unassigned" | userId */
  assignee: v.string(),
  columnId: v.string(),
  cardType: cardTypeValidator,
  status: statusValidator,
  due: dueValidator,
  processId: v.string(),
  assessmentId: v.string(),
});

const DEFAULT_FILTERS = {
  query: "",
  assignee: "all",
  columnId: "",
  cardType: "all" as const,
  status: "all" as const,
  due: "all" as const,
  processId: "",
  assessmentId: "",
};

const prefsReturnValidator = v.object({
  _id: v.id("pulsBoardUserPrefs"),
  viewMode: v.optional(viewModeValidator),
  commentsPlacement: v.optional(commentsPlacementValidator),
  detailSize: v.optional(detailSizeValidator),
  filters: filtersValidator,
  updatedAt: v.number(),
});

export const getMine = query({
  args: { boardId: v.id("pulsBoards") },
  returns: v.union(prefsReturnValidator, v.null()),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const board = await ctx.db.get(args.boardId);
    if (!board) return null;
    const allowed = await canAccessPulsBoard(ctx, board, userId, "viewer");
    if (!allowed) return null;
    const row = await ctx.db
      .query("pulsBoardUserPrefs")
      .withIndex("by_user_board", (q) =>
        q.eq("userId", userId).eq("boardId", args.boardId),
      )
      .unique();
    if (!row) return null;
    return {
      _id: row._id,
      viewMode: row.viewMode,
      commentsPlacement: row.commentsPlacement,
      detailSize: row.detailSize,
      filters: row.filters,
      updatedAt: row.updatedAt,
    };
  },
});

export const setMine = mutation({
  args: {
    boardId: v.id("pulsBoards"),
    filters: filtersValidator,
    viewMode: v.optional(viewModeValidator),
    commentsPlacement: v.optional(commentsPlacementValidator),
    detailSize: v.optional(detailSizeValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId } = await requirePulsBoardAccess(ctx, args.boardId, "viewer");
    const now = Date.now();
    const existing = await ctx.db
      .query("pulsBoardUserPrefs")
      .withIndex("by_user_board", (q) =>
        q.eq("userId", userId).eq("boardId", args.boardId),
      )
      .unique();
    const patch = {
      filters: args.filters,
      updatedAt: now,
      ...(args.viewMode !== undefined ? { viewMode: args.viewMode } : {}),
      ...(args.commentsPlacement !== undefined
        ? { commentsPlacement: args.commentsPlacement }
        : {}),
      ...(args.detailSize !== undefined
        ? { detailSize: args.detailSize }
        : {}),
    };
    if (existing) {
      await ctx.db.patch(existing._id, patch);
    } else {
      await ctx.db.insert("pulsBoardUserPrefs", {
        userId,
        boardId: args.boardId,
        filters: args.filters,
        viewMode: args.viewMode,
        commentsPlacement: args.commentsPlacement,
        detailSize: args.detailSize,
        updatedAt: now,
      });
    }
    return null;
  },
});

/** Oppdater kun visningsvalg (uten å røre filtre). */
export const setUiMine = mutation({
  args: {
    boardId: v.id("pulsBoards"),
    viewMode: v.optional(viewModeValidator),
    commentsPlacement: v.optional(commentsPlacementValidator),
    detailSize: v.optional(detailSizeValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId } = await requirePulsBoardAccess(ctx, args.boardId, "viewer");
    const now = Date.now();
    const existing = await ctx.db
      .query("pulsBoardUserPrefs")
      .withIndex("by_user_board", (q) =>
        q.eq("userId", userId).eq("boardId", args.boardId),
      )
      .unique();

    const patch = {
      updatedAt: now,
      ...(args.viewMode !== undefined ? { viewMode: args.viewMode } : {}),
      ...(args.commentsPlacement !== undefined
        ? { commentsPlacement: args.commentsPlacement }
        : {}),
      ...(args.detailSize !== undefined
        ? { detailSize: args.detailSize }
        : {}),
    };

    if (existing) {
      await ctx.db.patch(existing._id, patch);
    } else {
      await ctx.db.insert("pulsBoardUserPrefs", {
        userId,
        boardId: args.boardId,
        filters: DEFAULT_FILTERS,
        viewMode: args.viewMode,
        commentsPlacement: args.commentsPlacement,
        detailSize: args.detailSize,
        updatedAt: now,
      });
    }
    return null;
  },
});

export const clearMine = mutation({
  args: { boardId: v.id("pulsBoards") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId } = await requirePulsBoardAccess(ctx, args.boardId, "viewer");
    const existing = await ctx.db
      .query("pulsBoardUserPrefs")
      .withIndex("by_user_board", (q) =>
        q.eq("userId", userId).eq("boardId", args.boardId),
      )
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
    }
    return null;
  },
});
