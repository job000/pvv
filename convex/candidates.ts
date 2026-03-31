import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";
import {
  requireUserId,
  requireWorkspaceMember,
} from "./lib/access";

export const listByWorkspace = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }
    await requireWorkspaceMember(ctx, args.workspaceId, userId, "viewer");
    return await ctx.db
      .query("candidates")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
  },
});

export const create = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.string(),
    code: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireWorkspaceMember(ctx, args.workspaceId, userId, "member");
    const name = args.name.trim();
    const code = args.code.trim().toUpperCase().replace(/\s+/g, "-");
    if (!name || !code) {
      throw new Error("Navn og kode er påkrevd.");
    }
    const clash = await ctx.db
      .query("candidates")
      .withIndex("by_workspace_code", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("code", code),
      )
      .unique();
    if (clash) {
      throw new Error("Koden er allerede i bruk i dette arbeidsområdet.");
    }
    const now = Date.now();
    return await ctx.db.insert("candidates", {
      workspaceId: args.workspaceId,
      name,
      code,
      notes: args.notes?.trim() || undefined,
      createdByUserId: userId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    candidateId: v.id("candidates"),
    name: v.optional(v.string()),
    code: v.optional(v.string()),
    notes: v.optional(v.union(v.string(), v.null())),
    orgUnitId: v.optional(v.union(v.id("orgUnits"), v.null())),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const row = await ctx.db.get(args.candidateId);
    if (!row) {
      throw new Error("Kandidat finnes ikke.");
    }
    await requireWorkspaceMember(ctx, row.workspaceId, userId, "member");
    if (args.orgUnitId !== undefined && args.orgUnitId !== null) {
      const ou = await ctx.db.get(args.orgUnitId);
      if (!ou || ou.workspaceId !== row.workspaceId) {
        throw new Error("Ugyldig organisasjonsenhet.");
      }
    }
    const patch: {
      name?: string;
      code?: string;
      notes?: string;
      orgUnitId?: Id<"orgUnits">;
      updatedAt: number;
    } = { updatedAt: Date.now() };
    if (args.name !== undefined) {
      patch.name = args.name.trim();
      if (!patch.name) {
        throw new Error("Navn kan ikke være tomt.");
      }
    }
    if (args.code !== undefined) {
      const code = args.code.trim().toUpperCase().replace(/\s+/g, "-");
      if (!code) {
        throw new Error("Kode kan ikke være tom.");
      }
      const clash = await ctx.db
        .query("candidates")
        .withIndex("by_workspace_code", (q) =>
          q.eq("workspaceId", row.workspaceId).eq("code", code),
        )
        .unique();
      if (clash && clash._id !== args.candidateId) {
        throw new Error("Koden er allerede i bruk.");
      }
      patch.code = code;
    }
    if (args.notes !== undefined) {
      patch.notes = args.notes === null ? undefined : args.notes.trim();
    }
    if (args.orgUnitId !== undefined) {
      patch.orgUnitId = args.orgUnitId === null ? undefined : args.orgUnitId;
    }
    await ctx.db.patch(args.candidateId, patch);
    return null;
  },
});

export const remove = mutation({
  args: { candidateId: v.id("candidates") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const row = await ctx.db.get(args.candidateId);
    if (!row) {
      throw new Error("Kandidat finnes ikke.");
    }
    await requireWorkspaceMember(ctx, row.workspaceId, userId, "admin");
    await ctx.db.delete(args.candidateId);
    return null;
  },
});
