import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx } from "./_generated/server";
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

async function cloneFormQuestions(
  ctx: MutationCtx,
  sourceFormId: Id<"intakeForms">,
  targetFormId: Id<"intakeForms">,
  now: number,
) {
  const sourceQuestions = await ctx.db
    .query("intakeFormQuestions")
    .withIndex("by_form_and_order", (q) => q.eq("formId", sourceFormId))
    .take(200);

  for (const question of sourceQuestions) {
    await ctx.db.insert("intakeFormQuestions", {
      formId: targetFormId,
      questionKey: question.questionKey,
      order: question.order,
      label: question.label,
      helpText: question.helpText,
      questionType: question.questionType,
      required: question.required,
      options: question.options,
      mappingTargets: question.mappingTargets,
      visibilityRule: question.visibilityRule,
      groupKey: question.groupKey,
      plainLanguageHint: question.plainLanguageHint,
      createdAt: now,
      updatedAt: now,
    });
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
      const activations = await ctx.db
        .query("intakeFormActivations")
        .withIndex("by_source_form_and_activated_at", (q) => q.eq("sourceFormId", form._id))
        .take(100);
      result.push({
        ...form,
        confirmationMode: form.confirmationMode ?? "none",
        isTemplate: Boolean(form.isTemplate),
        questionCount: questions.length,
        activeLinkCount: links.filter((link) => !link.revokedAt).length,
        responseCount: links.reduce((sum, link) => sum + link.responseCount, 0),
        activeActivationCount: activations.filter((activation) => !activation.deactivatedAt).length,
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
      form: {
        ...form,
        confirmationMode: form.confirmationMode ?? "none",
        isTemplate: Boolean(form.isTemplate),
      },
      questions,
      activations: [],
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
      isTemplate: false,
      sourceTemplateFormId: undefined,
      templatePublishedAt: undefined,
      templatePublishedByUserId: undefined,
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

export const publishTemplate = mutation({
  args: {
    formId: v.id("intakeForms"),
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const form = await ctx.db.get(args.formId);
    if (!form) {
      throw new Error("Skjemaet finnes ikke.");
    }
    await requireWorkspaceMember(ctx, form.workspaceId, userId, "member");
    if (args.enabled && form.sourceTemplateFormId) {
      throw new Error("Kopier fra mal kan ikke deles videre som mal ennå.");
    }
    await ctx.db.patch(args.formId, {
      isTemplate: args.enabled,
      templatePublishedAt: args.enabled ? Date.now() : undefined,
      templatePublishedByUserId: args.enabled ? userId : undefined,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const listActivations = query({
  args: {
    formId: v.id("intakeForms"),
  },
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
      .query("intakeFormActivations")
      .withIndex("by_source_form_and_activated_at", (q) => q.eq("sourceFormId", args.formId))
      .order("desc")
      .take(100);

    const result = [];
    for (const row of rows) {
      const workspace = await ctx.db.get(row.targetWorkspaceId);
      const activatedForm = await ctx.db.get(row.activatedFormId);
      result.push({
        ...row,
        targetWorkspaceName: workspace?.name ?? "Arbeidsområde",
        activatedFormTitle: activatedForm?.title ?? "Skjema",
        isActive: !row.deactivatedAt,
      });
    }
    return result;
  },
});

export const activateTemplate = mutation({
  args: {
    formId: v.id("intakeForms"),
    targetWorkspaceId: v.id("workspaces"),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ activatedFormId: Id<"intakeForms">; activationId: Id<"intakeFormActivations"> }> => {
    const userId = await requireUserId(ctx);
    const sourceForm = await ctx.db.get(args.formId);
    if (!sourceForm) {
      throw new Error("Skjemaet finnes ikke.");
    }
    await requireWorkspaceMember(ctx, sourceForm.workspaceId, userId, "member");
    await requireWorkspaceMember(ctx, args.targetWorkspaceId, userId, "member");
    if (!sourceForm.isTemplate) {
      throw new Error("Skjemaet må deles som mal før det kan aktiveres i et annet arbeidsområde.");
    }
    if (sourceForm.workspaceId === args.targetWorkspaceId) {
      throw new Error("Velg et annet arbeidsområde for aktivering.");
    }

    const existingActivations = await ctx.db
      .query("intakeFormActivations")
      .withIndex("by_source_form_and_activated_at", (q) => q.eq("sourceFormId", sourceForm._id))
      .take(100);
    const activeForWorkspace = existingActivations.find(
      (activation) =>
        activation.targetWorkspaceId === args.targetWorkspaceId && !activation.deactivatedAt,
    );
    if (activeForWorkspace) {
      throw new Error("Skjemaet er allerede aktivert i dette arbeidsområdet.");
    }

    const now = Date.now();
    const activatedFormId = await ctx.db.insert("intakeForms", {
      workspaceId: args.targetWorkspaceId,
      title: sourceForm.title,
      description: sourceForm.description,
      status: "draft",
      layoutMode: sourceForm.layoutMode,
      confirmationMode: sourceForm.confirmationMode ?? "none",
      isTemplate: false,
      sourceTemplateFormId: sourceForm._id,
      templatePublishedAt: undefined,
      templatePublishedByUserId: undefined,
      createdByUserId: userId,
      createdAt: now,
      updatedAt: now,
    });
    await cloneFormQuestions(ctx, sourceForm._id, activatedFormId, now);
    const activationId = await ctx.db.insert("intakeFormActivations", {
      sourceFormId: sourceForm._id,
      activatedFormId,
      sourceWorkspaceId: sourceForm.workspaceId,
      targetWorkspaceId: args.targetWorkspaceId,
      activatedByUserId: userId,
      activatedAt: now,
      deactivatedAt: undefined,
      deactivatedByUserId: undefined,
    });
    return { activatedFormId, activationId };
  },
});

export const deactivateActivation = mutation({
  args: {
    activationId: v.id("intakeFormActivations"),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const activation = await ctx.db.get(args.activationId);
    if (!activation) {
      throw new Error("Aktiveringen finnes ikke.");
    }
    await requireWorkspaceMember(ctx, activation.sourceWorkspaceId, userId, "member");
    await requireWorkspaceMember(ctx, activation.targetWorkspaceId, userId, "member");
    if (activation.deactivatedAt) {
      return null;
    }
    await ctx.db.patch(args.activationId, {
      deactivatedAt: Date.now(),
      deactivatedByUserId: userId,
    });
    await ctx.db.patch(activation.activatedFormId, {
      status: "archived",
      updatedAt: Date.now(),
    });
    return null;
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
