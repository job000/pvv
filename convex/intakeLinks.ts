import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { intakeLinkAccessModeValidator } from "./schema";
import { requireUserId, requireWorkspaceMember } from "./lib/access";
import { parsePublicIntakeToken } from "./lib/intakePublicSecurity";

function randomToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function linkStatus(
  row: {
    pausedAt?: number;
    revokedAt?: number;
    expiresAt: number;
    maxResponses?: number;
    responseCount: number;
  },
  now: number,
): "active" | "paused" | "expired" | "max_responses" | "revoked" {
  if (row.revokedAt) {
    return "revoked";
  }
  if (row.pausedAt) {
    return "paused";
  }
  if (row.expiresAt <= now) {
    return "expired";
  }
  if (row.maxResponses !== undefined && row.responseCount >= row.maxResponses) {
    return "max_responses";
  }
  return "active";
}

export const listByForm = query({
  args: { formId: v.id("intakeForms") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }
    const form = await ctx.db.get(args.formId);
    if (!form) {
      return [];
    }
    await requireWorkspaceMember(ctx, form.workspaceId, userId, "viewer");
    const rows = await ctx.db
      .query("intakeFormLinks")
      .withIndex("by_form_and_created_at", (q) => q.eq("formId", args.formId))
      .order("desc")
      .take(100);
    const now = Date.now();
    return rows.map((row) => ({
      ...row,
      status: linkStatus(row, now),
      isActive: linkStatus(row, now) === "active",
    }));
  },
});

export const getPublicForm = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const token = parsePublicIntakeToken(args.token);
    if (!token) {
      return null;
    }
    const link = await ctx.db
      .query("intakeFormLinks")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique();
    if (!link || link.revokedAt || link.expiresAt <= Date.now()) {
      return null;
    }
    const status = linkStatus(link, Date.now());
    if (status === "paused") {
      return {
        kind: "closed" as const,
        reason: "paused" as const,
      };
    }
    if (status === "max_responses") {
      return {
        kind: "closed" as const,
        reason: "max_responses" as const,
      };
    }
    const form = await ctx.db.get(link.formId);
    if (!form || form.status === "archived") {
      return null;
    }
    const questions = await ctx.db
      .query("intakeFormQuestions")
      .withIndex("by_form_and_order", (q) => q.eq("formId", form._id))
      .take(100);
    return {
      kind: "open" as const,
      form: {
        _id: form._id,
        title: form.title,
        description: form.description,
        layoutMode: form.layoutMode,
        questionsPerPage: form.questionsPerPage,
        confirmationMode: form.confirmationMode ?? "none",
      },
      link: {
        expiresAt: link.expiresAt,
        maxResponses: link.maxResponses,
        responseCount: link.responseCount,
        restrictedAccessMode: link.restrictedAccessMode,
      },
      questions: questions.map((question) => ({
        _id: question._id,
        questionKey: question.questionKey ?? question._id,
        label: question.label,
        helpText: question.helpText,
        questionType: question.questionType,
        required: question.required,
        options: question.options ?? [],
        visibilityRule: question.visibilityRule,
      })),
    };
  },
});

export const create = mutation({
  args: {
    formId: v.id("intakeForms"),
    expiresAt: v.number(),
    maxResponses: v.optional(v.number()),
    restrictedAccessMode: intakeLinkAccessModeValidator,
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const form = await ctx.db.get(args.formId);
    if (!form) {
      throw new Error("Skjemaet finnes ikke.");
    }
    await requireWorkspaceMember(ctx, form.workspaceId, userId, "member");
    const now = Date.now();
    if (args.expiresAt <= now) {
      throw new Error("Utløpsdato må være frem i tid.");
    }
    if (
      args.maxResponses !== undefined &&
      (!Number.isInteger(args.maxResponses) || args.maxResponses < 1)
    ) {
      throw new Error("Maks svar må være et positivt heltall.");
    }
    let token = randomToken();
    for (let i = 0; i < 5; i += 1) {
      const existing = await ctx.db
        .query("intakeFormLinks")
        .withIndex("by_token", (q) => q.eq("token", token))
        .unique();
      if (!existing) {
        break;
      }
      token = randomToken();
    }
    const linkId = await ctx.db.insert("intakeFormLinks", {
      formId: form._id,
      workspaceId: form.workspaceId,
      token,
      expiresAt: args.expiresAt,
      maxResponses: args.maxResponses,
      responseCount: 0,
      restrictedAccessMode: args.restrictedAccessMode,
      createdByUserId: userId,
      createdAt: now,
      pausedAt: undefined,
      revokedAt: undefined,
    });
    if (form.status === "draft") {
      await ctx.db.patch(form._id, {
        status: "published",
        updatedAt: now,
      });
    }
    return { linkId, token };
  },
});

export const revoke = mutation({
  args: { linkId: v.id("intakeFormLinks") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const link = await ctx.db.get(args.linkId);
    if (!link) {
      throw new Error("Lenken finnes ikke.");
    }
    await requireWorkspaceMember(ctx, link.workspaceId, userId, "member");
    await ctx.db.patch(args.linkId, {
      revokedAt: Date.now(),
    });
    return null;
  },
});

export const pause = mutation({
  args: { linkId: v.id("intakeFormLinks") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const link = await ctx.db.get(args.linkId);
    if (!link) {
      throw new Error("Lenken finnes ikke.");
    }
    await requireWorkspaceMember(ctx, link.workspaceId, userId, "member");
    await ctx.db.patch(args.linkId, {
      pausedAt: Date.now(),
    });
    return null;
  },
});

export const resume = mutation({
  args: { linkId: v.id("intakeFormLinks") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const link = await ctx.db.get(args.linkId);
    if (!link) {
      throw new Error("Lenken finnes ikke.");
    }
    await requireWorkspaceMember(ctx, link.workspaceId, userId, "member");
    await ctx.db.patch(args.linkId, {
      pausedAt: undefined,
    });
    return null;
  },
});

export const remove = mutation({
  args: { linkId: v.id("intakeFormLinks") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const link = await ctx.db.get(args.linkId);
    if (!link) {
      throw new Error("Lenken finnes ikke.");
    }
    await requireWorkspaceMember(ctx, link.workspaceId, userId, "member");
    await ctx.db.delete(args.linkId);
    return null;
  },
});
