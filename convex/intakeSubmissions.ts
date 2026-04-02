import { v } from "convex/values";
import { api } from "./_generated/api";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import {
  intakeAnswerValidator,
  intakeGeneratedAssessmentValidator,
  type IntakeMappingTarget,
  intakeSubmissionStatusValidator,
  intakeSubmitterMetaValidator,
} from "./schema";
import { getAuthUserId } from "@convex-dev/auth/server";
import { requireUserId, requireWorkspaceMember } from "./lib/access";
import { generateIntakeSuggestion } from "./lib/intakeMapping";
import { createAssessmentWithPayload } from "./lib/assessmentCreation";

function requireNonEmptyAnswers(questionCount: number, answersCount: number) {
  if (questionCount === 0) {
    throw new Error("Skjemaet har ingen spørsmål.");
  }
  if (answersCount === 0) {
    throw new Error("Svarene kan ikke være tomme.");
  }
}

type VisibilityRule =
  | undefined
  | {
      parentQuestionKey: string;
      match:
        | { kind: "yes_no"; value: boolean }
        | { kind: "multiple_choice"; optionId: string }
        | { kind: "scale"; value: number };
    };

type IntakeAnswerDoc =
  | { questionId: string; kind: "text"; value: string }
  | { questionId: string; kind: "number"; value: number }
  | { questionId: string; kind: "multiple_choice"; optionId: string; label: string }
  | { questionId: string; kind: "scale"; value: number }
  | { questionId: string; kind: "yes_no"; value: boolean };

type IntakeQuestionDoc = {
  _id: string;
  questionKey?: string;
  label: string;
  questionType: "text" | "number" | "multiple_choice" | "scale" | "yes_no";
  required: boolean;
  mappingTargets: IntakeMappingTarget[];
  visibilityRule?: VisibilityRule;
};

function matchesVisibilityRule(
  rule: VisibilityRule,
  answer: IntakeAnswerDoc | undefined,
) {
  if (!rule) {
    return true;
  }
  if (!answer || answer.kind !== rule.match.kind) {
    return false;
  }
  switch (rule.match.kind) {
    case "yes_no": {
      const yesNoAnswer = answer as Extract<IntakeAnswerDoc, { kind: "yes_no" }>;
      return yesNoAnswer.value === rule.match.value;
    }
    case "multiple_choice": {
      const multipleChoiceAnswer = answer as Extract<
        IntakeAnswerDoc,
        { kind: "multiple_choice" }
      >;
      return multipleChoiceAnswer.optionId === rule.match.optionId;
    }
    case "scale": {
      const scaleAnswer = answer as Extract<IntakeAnswerDoc, { kind: "scale" }>;
      return scaleAnswer.value === rule.match.value;
    }
  }
}

function getVisibleQuestions(
  questions: IntakeQuestionDoc[],
  answers: IntakeAnswerDoc[],
) {
  const answerByQuestionId = new Map(answers.map((answer) => [answer.questionId, answer]));
  const visibleQuestionKeys = new Set<string>();
  const questionIdByKey = new Map(
    questions.map((question) => [question.questionKey ?? question._id, question._id]),
  );

  return questions.filter((question) => {
    const rule = question.visibilityRule;
    if (!rule) {
      visibleQuestionKeys.add(question.questionKey ?? question._id);
      return true;
    }
    if (!visibleQuestionKeys.has(rule.parentQuestionKey)) {
      return false;
    }
    const parentId = questionIdByKey.get(rule.parentQuestionKey);
    if (!parentId) {
      return false;
    }
    const visible = matchesVisibilityRule(rule, answerByQuestionId.get(parentId));
    if (visible) {
      visibleQuestionKeys.add(question.questionKey ?? question._id);
    }
    return visible;
  });
}

export const listByWorkspace = query({
  args: {
    workspaceId: v.id("workspaces"),
    status: v.optional(intakeSubmissionStatusValidator),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }
    await requireWorkspaceMember(ctx, args.workspaceId, userId, "viewer");
    const rows = args.status
      ? await ctx.db
          .query("intakeSubmissions")
          .withIndex("by_workspace_and_status_and_submitted_at", (q) =>
            q.eq("workspaceId", args.workspaceId).eq("status", args.status!),
          )
          .order("desc")
          .take(200)
      : await ctx.db
          .query("intakeSubmissions")
          .withIndex("by_workspace_and_submitted_at", (q) =>
            q.eq("workspaceId", args.workspaceId),
          )
          .order("desc")
          .take(200);
    const results = [];
    for (const row of rows) {
      const form = await ctx.db.get(row.formId);
      results.push({
        ...row,
        formTitle: form?.title ?? "Skjema",
      });
    }
    return results;
  },
});

export const getDetail = query({
  args: { submissionId: v.id("intakeSubmissions") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }
    const submission = await ctx.db.get(args.submissionId);
    if (!submission) {
      return null;
    }
    await requireWorkspaceMember(ctx, submission.workspaceId, userId, "viewer");
    const form = await ctx.db.get(submission.formId);
    const questions = await ctx.db
      .query("intakeFormQuestions")
      .withIndex("by_form_and_order", (q) => q.eq("formId", submission.formId))
      .take(100);
    return {
      submission,
      form,
      questions,
    };
  },
});

export const submitPublic = mutation({
  args: {
    token: v.string(),
    submitterMeta: intakeSubmitterMetaValidator,
    answers: v.array(intakeAnswerValidator),
  },
  handler: async (ctx, args) => {
    const token = args.token.trim();
    if (!token) {
      throw new Error("Lenken er ugyldig.");
    }
    const link = await ctx.db
      .query("intakeFormLinks")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique();
    if (!link || link.revokedAt || link.expiresAt <= Date.now()) {
      throw new Error("Lenken er utløpt eller ikke tilgjengelig.");
    }
    if (link.pausedAt) {
      throw new Error("Lenken er pauset og tar ikke imot svar akkurat nå.");
    }
    if (link.maxResponses !== undefined && link.responseCount >= link.maxResponses) {
      throw new Error("Skjemaet tar ikke imot flere svar.");
    }
    if (
      link.restrictedAccessMode === "email_required" &&
      !args.submitterMeta.email?.trim()
    ) {
      throw new Error("E-post er påkrevd for dette skjemaet.");
    }
    const form = await ctx.db.get(link.formId);
    if (!form || form.status === "archived") {
      throw new Error("Skjemaet finnes ikke lenger.");
    }
    const confirmationMode = form.confirmationMode ?? "none";
    if (
      confirmationMode === "email_copy" &&
      !args.submitterMeta.email?.trim()
    ) {
      throw new Error(
        "Dette skjemaet sender bekreftelse på e-post, så e-postadresse er påkrevd.",
      );
    }
    const questions = await ctx.db
      .query("intakeFormQuestions")
      .withIndex("by_form_and_order", (q) => q.eq("formId", form._id))
      .take(100);
    const visibleQuestions = getVisibleQuestions(questions, args.answers);
    const visibleQuestionIds = new Set(visibleQuestions.map((question) => question._id));
    const visibleAnswers = args.answers.filter((answer) => visibleQuestionIds.has(answer.questionId));
    requireNonEmptyAnswers(visibleQuestions.length, visibleAnswers.length);

    const answerByQuestion = new Map(visibleAnswers.map((answer) => [answer.questionId, answer]));
    for (const question of visibleQuestions) {
      const answer = answerByQuestion.get(question._id);
      if (question.required && !answer) {
        throw new Error(`Svar mangler for «${question.label}».`);
      }
      if (!answer) {
        continue;
      }
      if (question.questionType !== answer.kind) {
        throw new Error(`Ugyldig svarformat for «${question.label}».`);
      }
      if (answer.kind === "text" && !answer.value.trim() && question.required) {
        throw new Error(`Svar mangler for «${question.label}».`);
      }
      if (answer.kind === "number" && !Number.isFinite(answer.value)) {
        throw new Error(`Ugyldig tallformat for «${question.label}».`);
      }
    }

    const suggestion = generateIntakeSuggestion(visibleQuestions, visibleAnswers);
    const now = Date.now();
    const submissionId = await ctx.db.insert("intakeSubmissions", {
      workspaceId: form.workspaceId,
      formId: form._id,
      linkId: link._id,
      submittedAt: now,
      submitterMeta: {
        name: args.submitterMeta.name?.trim() || undefined,
        email: args.submitterMeta.email?.trim() || undefined,
      },
      answers: visibleAnswers,
      status: "submitted",
      generatedAssessmentDraft: suggestion.generatedAssessment,
      generatedRosSuggestion: suggestion.rosSuggestion,
      generatedPvvFlags: suggestion.generatedPvvFlags,
      riskSignals: suggestion.riskSignals,
      personDataSignal: suggestion.personDataSignal,
      autoGeneratedAt: now,
      reviewedAt: undefined,
      reviewedByUserId: undefined,
      rejectionReason: undefined,
      approvedAssessmentId: undefined,
      approvedRosAnalysisId: undefined,
    });
    await ctx.db.patch(link._id, {
      responseCount: link.responseCount + 1,
    });
    if (
      confirmationMode === "email_copy" &&
      args.submitterMeta.email?.trim()
    ) {
      await ctx.scheduler.runAfter(
        0,
        internal.intakeEmails.sendSubmissionConfirmation,
        {
          toEmail: args.submitterMeta.email.trim(),
          toName: args.submitterMeta.name?.trim() || undefined,
          formTitle: form.title,
          submittedAt: now,
          answers: visibleQuestions.map((question) => {
            const answer = answerByQuestion.get(question._id);
            let answerLabel = "Ikke besvart";
            if (answer?.kind === "text") {
              answerLabel = answer.value.trim() || "Ikke besvart";
            } else if (answer?.kind === "number") {
              answerLabel = String(answer.value);
            } else if (answer?.kind === "multiple_choice") {
              answerLabel = answer.label;
            } else if (answer?.kind === "scale") {
              answerLabel = String(answer.value);
            } else if (answer?.kind === "yes_no") {
              answerLabel = answer.value ? "Ja" : "Nei";
            }
            return {
              questionLabel: question.label,
              answerLabel,
            };
          }),
        },
      );
    }
    return {
      submissionId,
      title: suggestion.generatedAssessment.title,
      shouldCreateRos: suggestion.rosSuggestion.shouldCreateRos,
      confirmationMode,
    };
  },
});

export const markUnderReview = mutation({
  args: { submissionId: v.id("intakeSubmissions") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const submission = await ctx.db.get(args.submissionId);
    if (!submission) {
      throw new Error("Forslaget finnes ikke.");
    }
    await requireWorkspaceMember(ctx, submission.workspaceId, userId, "member");
    if (submission.status === "approved" || submission.status === "rejected") {
      return null;
    }
    await ctx.db.patch(submission._id, {
      status: "under_review",
      reviewedAt: Date.now(),
      reviewedByUserId: userId,
    });
    return null;
  },
});

export const approve = mutation({
  args: {
    submissionId: v.id("intakeSubmissions"),
    generatedAssessmentDraft: intakeGeneratedAssessmentValidator,
    createRos: v.boolean(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    assessmentId: Id<"assessments">;
    rosAnalysisId: Id<"rosAnalyses"> | undefined;
  }> => {
    const userId = await requireUserId(ctx);
    const submission = await ctx.db.get(args.submissionId);
    if (!submission) {
      throw new Error("Forslaget finnes ikke.");
    }
    await requireWorkspaceMember(ctx, submission.workspaceId, userId, "member");
    if (submission.status === "approved") {
      throw new Error("Forslaget er allerede godkjent.");
    }
    if (submission.status === "rejected") {
      throw new Error("Forslaget er allerede avslått.");
    }
    const assessmentId = await createAssessmentWithPayload(ctx, {
      workspaceId: submission.workspaceId,
      userId,
      title: args.generatedAssessmentDraft.title,
      shareWithWorkspace: true,
      payload: args.generatedAssessmentDraft.payload,
    });

    let approvedRosAnalysisId = submission.approvedRosAnalysisId;
    if (args.createRos) {
      const firstTemplate = await ctx.db
        .query("rosTemplates")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", submission.workspaceId))
        .take(1);
      const template = firstTemplate[0];
      if (!template) {
        throw new Error("Opprett en ROS-mal før du kan lage ROS-utkast fra skjema.");
      }
      const analysisId: Id<"rosAnalyses"> = await ctx.runMutation(
        api.ros.createAnalysis,
        {
        workspaceId: submission.workspaceId,
        templateId: template._id,
        title: `ROS · ${args.generatedAssessmentDraft.title}`,
        assessmentIds: [assessmentId],
        notes: submission.generatedRosSuggestion.summary,
        },
      );
      const analysis = await ctx.db.get(analysisId);
      if (analysis) {
        const rowCount = analysis.rowLabels.length;
        const colCount = analysis.colLabels.length;
        const cellItems = Array.from({ length: rowCount }, (_, rowIndex) =>
          Array.from({ length: colCount }, (_, colIndex) =>
            rowIndex === 0 && colIndex === 0
              ? submission.generatedRosSuggestion.risks.map((risk) => ({
                  id: risk.id,
                  text: `${risk.title}: ${risk.description}`,
                  flags: submission.generatedPvvFlags,
                }))
              : [],
          ),
        );
        const cellNotes = Array.from({ length: rowCount }, (_, rowIndex) =>
          Array.from({ length: colCount }, (_, colIndex) =>
            rowIndex === 0 && colIndex === 0
              ? submission.generatedRosSuggestion.risks
                  .map((risk) => `${risk.title}: ${risk.description}`)
                  .join("\n")
              : "",
          ),
        );
        await ctx.db.patch(analysis._id, {
          notes: submission.generatedRosSuggestion.summary,
          contextSummary: args.generatedAssessmentDraft.payload.processDescription,
          cellItems,
          cellNotes,
          updatedAt: Date.now(),
        });
      }
      approvedRosAnalysisId = analysisId;
    }

    await ctx.db.patch(submission._id, {
      status: "approved",
      generatedAssessmentDraft: args.generatedAssessmentDraft,
      reviewedAt: Date.now(),
      reviewedByUserId: userId,
      rejectionReason: undefined,
      approvedAssessmentId: assessmentId,
      approvedRosAnalysisId,
    });
    return {
      assessmentId,
      rosAnalysisId: approvedRosAnalysisId,
    };
  },
});

export const reject = mutation({
  args: {
    submissionId: v.id("intakeSubmissions"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const submission = await ctx.db.get(args.submissionId);
    if (!submission) {
      throw new Error("Forslaget finnes ikke.");
    }
    await requireWorkspaceMember(ctx, submission.workspaceId, userId, "member");
    const reason = args.reason.trim();
    if (!reason) {
      throw new Error("Begrunnelse er påkrevd ved avslag.");
    }
    await ctx.db.patch(submission._id, {
      status: "rejected",
      reviewedAt: Date.now(),
      reviewedByUserId: userId,
      rejectionReason: reason,
    });
    return null;
  },
});
