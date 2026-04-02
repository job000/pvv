import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  intakeConfirmationModeValidator,
  intakeFormStatusValidator,
  intakeQuestionVisibilityRuleValidator,
  intakeLayoutModeValidator,
  intakeMappingTargetValidator,
  intakeQuestionOptionValidator,
  intakeQuestionTypeValidator,
} from "./schema";
import { requireUserId, requireWorkspaceMember } from "./lib/access";

const intakeQuestionInputValidator = v.object({
  id: v.string(),
  label: v.string(),
  helpText: v.optional(v.string()),
  questionType: intakeQuestionTypeValidator,
  required: v.boolean(),
  options: v.optional(v.array(intakeQuestionOptionValidator)),
  mappingTargets: v.array(intakeMappingTargetValidator),
  visibilityRule: v.optional(intakeQuestionVisibilityRuleValidator),
  groupKey: v.optional(v.string()),
  plainLanguageHint: v.optional(v.string()),
});

function validateConditionalQuestions(
  questions: Array<{
    id: string;
    label: string;
    questionType: "text" | "multiple_choice" | "scale" | "yes_no";
    options?: Array<{ id: string; label: string }>;
    visibilityRule?: {
      parentQuestionKey: string;
      match:
        | { kind: "yes_no"; value: boolean }
        | { kind: "multiple_choice"; optionId: string }
        | { kind: "scale"; value: number };
    };
  }>,
) {
  for (let index = 0; index < questions.length; index += 1) {
    const question = questions[index];
    const rule = question.visibilityRule;
    if (!rule) {
      continue;
    }

    const parentIndex = questions.findIndex(
      (candidate) => candidate.id === rule.parentQuestionKey,
    );
    if (parentIndex === -1) {
      throw new Error(`Oppfølgingslogikk mangler foreldrespørsmål for «${question.label}».`);
    }
    if (parentIndex >= index) {
      throw new Error(
        `Oppfølgingsspørsmål må vise til et tidligere spørsmål for «${question.label}».`,
      );
    }

    const parent = questions[parentIndex];
    if (rule.match.kind !== parent.questionType) {
      throw new Error(
        `Oppfølgingslogikken for «${question.label}» passer ikke med svartypen i foreldrespørsmålet.`,
      );
    }
    if (rule.match.kind === "multiple_choice") {
      const match = rule.match;
      const hasOption = (parent.options ?? []).some(
        (option) => option.id === match.optionId,
      );
      if (!hasOption) {
        throw new Error(
          `Oppfølgingslogikken for «${question.label}» peker på et svarvalg som ikke finnes.`,
        );
      }
    }
    if (
      rule.match.kind === "scale" &&
      (!Number.isInteger(rule.match.value) || rule.match.value < 1 || rule.match.value > 5)
    ) {
      throw new Error(
        `Oppfølgingslogikken for «${question.label}» må bruke en skala mellom 1 og 5.`,
      );
    }
  }
}

export const listByWorkspace = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }
    await requireWorkspaceMember(ctx, args.workspaceId, userId, "viewer");
    const forms = await ctx.db
      .query("intakeForms")
      .withIndex("by_workspace_and_updated_at", (q) =>
        q.eq("workspaceId", args.workspaceId),
      )
      .order("desc")
      .take(100);

    const result = [];
    for (const form of forms) {
      const questions = await ctx.db
        .query("intakeFormQuestions")
        .withIndex("by_form_and_order", (q) => q.eq("formId", form._id))
        .take(100);
      const links = await ctx.db
        .query("intakeFormLinks")
        .withIndex("by_form_and_created_at", (q) => q.eq("formId", form._id))
        .order("desc")
        .take(100);
      result.push({
        ...form,
        questionCount: questions.length,
        activeLinkCount: links.filter((link) => !link.revokedAt).length,
        responseCount: links.reduce((sum, link) => sum + link.responseCount, 0),
      });
    }
    return result;
  },
});

export const getEditor = query({
  args: {
    formId: v.id("intakeForms"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }
    const form = await ctx.db.get(args.formId);
    if (!form) {
      return null;
    }
    await requireWorkspaceMember(ctx, form.workspaceId, userId, "viewer");
    const questions = await ctx.db
      .query("intakeFormQuestions")
      .withIndex("by_form_and_order", (q) => q.eq("formId", args.formId))
      .take(100);
    return {
      form,
      questions,
    };
  },
});

export const create = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireWorkspaceMember(ctx, args.workspaceId, userId, "member");
    const now = Date.now();
    return await ctx.db.insert("intakeForms", {
      workspaceId: args.workspaceId,
      title: args.title.trim() || "Nytt skjema",
      description: undefined,
      status: "draft",
      layoutMode: "one_per_screen",
      confirmationMode: "none",
      createdByUserId: userId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const save = mutation({
  args: {
    formId: v.id("intakeForms"),
    title: v.string(),
    description: v.optional(v.string()),
    status: intakeFormStatusValidator,
    layoutMode: intakeLayoutModeValidator,
    confirmationMode: intakeConfirmationModeValidator,
    questions: v.array(intakeQuestionInputValidator),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const form = await ctx.db.get(args.formId);
    if (!form) {
      throw new Error("Skjemaet finnes ikke.");
    }
    await requireWorkspaceMember(ctx, form.workspaceId, userId, "member");
    const title = args.title.trim();
    if (!title) {
      throw new Error("Skjemaet må ha et navn.");
    }
    if (args.questions.length === 0) {
      throw new Error("Legg til minst ett spørsmål.");
    }
    validateConditionalQuestions(args.questions);
    const now = Date.now();
    await ctx.db.patch(args.formId, {
      title,
      description: args.description?.trim() || undefined,
      status: args.status,
      layoutMode: args.layoutMode,
      confirmationMode: args.confirmationMode,
      updatedAt: now,
    });

    const existingQuestions = await ctx.db
      .query("intakeFormQuestions")
      .withIndex("by_form_and_order", (q) => q.eq("formId", args.formId))
      .take(200);
    for (const question of existingQuestions) {
      await ctx.db.delete(question._id);
    }
    for (let index = 0; index < args.questions.length; index += 1) {
      const question = args.questions[index];
      await ctx.db.insert("intakeFormQuestions", {
        formId: args.formId,
        questionKey: question.id,
        order: index,
        label: question.label.trim(),
        helpText: question.helpText?.trim() || undefined,
        questionType: question.questionType,
        required: question.required,
        options:
          question.options?.map((option) => ({
            id: option.id,
            label: option.label.trim(),
          })) ?? undefined,
        mappingTargets: question.mappingTargets,
        visibilityRule: question.visibilityRule,
        groupKey: question.groupKey?.trim() || undefined,
        plainLanguageHint: question.plainLanguageHint?.trim() || undefined,
        createdAt: now,
        updatedAt: now,
      });
    }
    return args.formId;
  },
});

export const archive = mutation({
  args: {
    formId: v.id("intakeForms"),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const form = await ctx.db.get(args.formId);
    if (!form) {
      throw new Error("Skjemaet finnes ikke.");
    }
    await requireWorkspaceMember(ctx, form.workspaceId, userId, "member");
    await ctx.db.patch(args.formId, {
      status: "archived",
      updatedAt: Date.now(),
    });
    return null;
  },
});
