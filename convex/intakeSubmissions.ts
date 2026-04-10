import { v } from "convex/values";
import { api } from "./_generated/api";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import {
  intakeAnswerValidator,
  intakeGeneratedAssessmentValidator,
  type IntakeMappingTarget,
  intakeSubmissionStatusValidator,
  intakeSubmitterMetaValidator,
} from "./schema";
import { getAuthUserId } from "@convex-dev/auth/server";
import {
  getAssessmentIfReadable,
  requireUserId,
  requireWorkspaceMember,
} from "./lib/access";
import { generateIntakeSuggestion } from "./lib/intakeMapping";
import { buildPublicIntakeScreeningSummary } from "./lib/intakePublicScreening";
import { createAssessmentWithPayload } from "./lib/assessmentCreation";
import { normalizeGithubRepoFullName } from "./lib/github";
import { loadIntakeGithubOccupiedRefs } from "./lib/intakeGithubOccupiedRefs";
import {
  cascadeDeleteAssessmentData,
  cascadeDeleteRosAnalysisData,
} from "./lib/cascadeDeletePvv";
import {
  assertPublicIntakePayloadBounds,
  parsePublicIntakeToken,
  PUBLIC_INTAKE_SUBMITS_PER_LINK_PER_MINUTE,
} from "./lib/intakePublicSecurity";
import { placeIntakeRisksOnRosMatrix } from "./lib/rosIntakePlacement";
import {
  DEFAULT_ROS_COL_LABELS,
  isRpaIntakeRosTemplate,
  RPA_INTAKE_ROS_COL_LABELS_AFTER,
  RPA_INTAKE_ROS_COL_AXIS,
  RPA_INTAKE_ROS_COL_AXIS_AFTER,
  RPA_INTAKE_ROS_ROW_AXIS,
  RPA_INTAKE_ROS_ROW_AXIS_AFTER,
  RPA_INTAKE_ROS_ROW_DESCRIPTIONS,
  RPA_INTAKE_ROS_ROW_LABELS,
  RPA_INTAKE_ROS_ROW_LABELS_AFTER,
  RPA_INTAKE_ROS_TEMPLATE_DESCRIPTION,
  RPA_INTAKE_ROS_TEMPLATE_NAME,
  emptyMatrix,
} from "../lib/ros-defaults";
import {
  emptyCellItemsMatrix,
  flattenCellItemsToNote,
} from "../lib/ros-cell-items";

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

/**
 * Godkjente skjemaforslag med opprettet vurdering — vises i prosessregisteret fordi de ikke har egen
 * rad i `candidates` (kun `assessments`).
 */
export const listApprovedForProcessregister = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }
    await requireWorkspaceMember(ctx, args.workspaceId, userId, "viewer");
    const rows = await ctx.db
      .query("intakeSubmissions")
      .withIndex("by_workspace_and_status_and_submitted_at", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("status", "approved"),
      )
      .order("desc")
      .take(500);
    const out: Array<{
      submissionId: Id<"intakeSubmissions">;
      title: string;
      reviewedAt: number;
      approvedAssessmentId: Id<"assessments">;
      githubRepoFullName?: string;
      githubIssueNumber?: number;
    }> = [];
    for (const r of rows) {
      if (!r.approvedAssessmentId) {
        continue;
      }
      out.push({
        submissionId: r._id,
        title: r.generatedAssessmentDraft.title,
        reviewedAt: r.reviewedAt ?? r.submittedAt,
        approvedAssessmentId: r.approvedAssessmentId,
        githubRepoFullName: r.githubRepoFullName,
        githubIssueNumber: r.githubIssueNumber,
      });
    }
    return out;
  },
});

/** Siste godkjente inntak knyttet til vurderingen (én rad per indeks). */
export const getApprovedSubmissionForAssessment = query({
  args: { assessmentId: v.id("assessments") },
  handler: async (ctx, args) => {
    const readable = await getAssessmentIfReadable(ctx, args.assessmentId);
    if (!readable) {
      return null;
    }
    const sub = await ctx.db
      .query("intakeSubmissions")
      .withIndex("by_approved_assessment_submitted", (q) =>
        q.eq("approvedAssessmentId", args.assessmentId),
      )
      .order("desc")
      .first();
    if (!sub) {
      return null;
    }
    const form = await ctx.db.get(sub.formId);
    return {
      submittedAt: sub.submittedAt,
      formTitle: form?.title ?? null,
      submitterMeta: sub.submitterMeta,
      answers: sub.answers,
      generatedRosSuggestion: sub.generatedRosSuggestion,
    };
  },
});

/** Brukes av actions (f.eks. kolonnevisning) for å skjule kort som allerede tilhører skjemaintake. */
export const loadGithubOccupiedRefsForWorkspace = internalQuery({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const r = await loadIntakeGithubOccupiedRefs(ctx, args.workspaceId);
    return {
      projectItemIds: [...r.projectItemIds],
      issueKeys: [...r.issueKeys],
      issueNodeIds: [...r.issueNodeIds],
    };
  },
});

export const getSubmissionForGithub = internalQuery({
  args: { submissionId: v.id("intakeSubmissions") },
  handler: async (ctx, args) => {
    const submission = await ctx.db.get(args.submissionId);
    if (!submission) {
      return null;
    }
    const workspace = await ctx.db.get(submission.workspaceId);
    if (!workspace) {
      return null;
    }
    const form = await ctx.db.get(submission.formId);
    const questions = await ctx.db
      .query("intakeFormQuestions")
      .withIndex("by_form_and_order", (q) => q.eq("formId", submission.formId))
      .take(100);
    return { submission, workspace, form, questions };
  },
});

export const setIntakeSubmissionGithubProjectItemWithIssue =
  internalMutation({
    args: {
      submissionId: v.id("intakeSubmissions"),
      itemNodeId: v.string(),
      statusOptionId: v.string(),
      githubRepoFullName: v.string(),
      githubIssueNumber: v.number(),
      githubIssueNodeId: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
      let repo: string;
      try {
        repo = normalizeGithubRepoFullName(args.githubRepoFullName);
      } catch {
        throw new Error("Ugyldig repo-navn.");
      }
      const n = Math.floor(args.githubIssueNumber);
      if (!Number.isFinite(n) || n < 1) {
        throw new Error("Ugyldig issue-nummer.");
      }
      await ctx.db.patch(args.submissionId, {
        githubProjectItemNodeId: args.itemNodeId.trim(),
        githubProjectStatusOptionId: args.statusOptionId.trim(),
        githubRepoFullName: repo,
        githubIssueNumber: n,
        githubIssueNodeId: args.githubIssueNodeId?.trim() || undefined,
      });
    },
  });

/** Utkast på Projects V2-tavle uten repo-issue (samme mønster som prosessregister uten standard-repo). */
export const setIntakeSubmissionGithubProjectItemDraft = internalMutation({
  args: {
    submissionId: v.id("intakeSubmissions"),
    itemNodeId: v.string(),
    statusOptionId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.submissionId, {
      githubProjectItemNodeId: args.itemNodeId.trim(),
      githubProjectStatusOptionId: args.statusOptionId.trim(),
      githubRepoFullName: undefined,
      githubIssueNumber: undefined,
      githubIssueNodeId: undefined,
    });
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
    const token = parsePublicIntakeToken(args.token);
    if (!token) {
      throw new Error("Lenken er ugyldig.");
    }
    assertPublicIntakePayloadBounds({
      submitterMeta: args.submitterMeta,
      answers: args.answers,
    });
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
    const rateMinuteBucket = Math.floor(Date.now() / 60_000);
    const rateBuckets = await ctx.db
      .query("intakePublicSubmitBuckets")
      .withIndex("by_link_and_minute_bucket", (q) =>
        q.eq("linkId", link._id).eq("minuteBucket", rateMinuteBucket),
      )
      .collect();
    const submitsInWindow = rateBuckets.reduce((sum, b) => sum + b.count, 0);
    if (submitsInWindow >= PUBLIC_INTAKE_SUBMITS_PER_LINK_PER_MINUTE) {
      throw new Error(
        "For mange innsendinger akkurat nå. Vent et minutt og prøv igjen.",
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
    const screening = buildPublicIntakeScreeningSummary(
      suggestion.generatedAssessment.payload as Record<string, unknown>,
    );
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
    /** Én rad per innsending i vinduet; sum(count) = antall forsøk i minuttet (korrekt ved race). */
    await ctx.db.insert("intakePublicSubmitBuckets", {
      linkId: link._id,
      minuteBucket: rateMinuteBucket,
      count: 1,
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
      screening,
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
      sourcedFromIntake: true,
    });

    const form = await ctx.db.get(submission.formId);
    let approvedRosAnalysisId = submission.approvedRosAnalysisId;
    if (args.createRos) {
      let templateId = form?.linkedRosTemplateId;
      if (templateId) {
        const linkedTemplate = await ctx.db.get(templateId);
        if (!linkedTemplate || linkedTemplate.workspaceId !== submission.workspaceId) {
          templateId = undefined;
        }
      }
      if (!templateId) {
        const firstTemplate = await ctx.db
          .query("rosTemplates")
          .withIndex("by_workspace", (q) => q.eq("workspaceId", submission.workspaceId))
          .take(1);
        templateId = firstTemplate[0]?._id;
      }
      if (!templateId) {
        templateId = await ctx.runMutation(api.ros.createTemplate, {
          workspaceId: submission.workspaceId,
          name: RPA_INTAKE_ROS_TEMPLATE_NAME,
          description: RPA_INTAKE_ROS_TEMPLATE_DESCRIPTION,
          rowAxisTitle: RPA_INTAKE_ROS_ROW_AXIS,
          colAxisTitle: RPA_INTAKE_ROS_COL_AXIS,
          rowLabels: [...RPA_INTAKE_ROS_ROW_LABELS],
          colLabels: [...DEFAULT_ROS_COL_LABELS],
          rowDescriptions: [...RPA_INTAKE_ROS_ROW_DESCRIPTIONS],
        });
      }
      const analysisId: Id<"rosAnalyses"> = await ctx.runMutation(
        api.ros.createAnalysis,
        {
          workspaceId: submission.workspaceId,
          templateId,
          title: `ROS · ${args.generatedAssessmentDraft.title}`,
          assessmentIds: [assessmentId],
          notes: submission.generatedRosSuggestion.summary,
        },
      );
      const analysis = await ctx.db.get(analysisId);
      if (analysis) {
        const { cellItems, cellNotes, matrixValues } = placeIntakeRisksOnRosMatrix(
          submission.generatedRosSuggestion.risks.map((risk) => ({
            id: risk.id,
            title: risk.title,
            description: risk.description,
            severity: risk.severity,
            source: risk.source,
          })),
          analysis.rowLabels,
          analysis.colLabels,
          analysis.matrixValues,
          submission.generatedPvvFlags ?? [],
        );

        const patch: Record<string, unknown> = {
          notes: submission.generatedRosSuggestion.summary,
          contextSummary: args.generatedAssessmentDraft.payload.processDescription,
          cellItems,
          cellNotes,
          matrixValues,
          updatedAt: Date.now(),
        };

        if (isRpaIntakeRosTemplate(analysis.rowLabels)) {
          const ar = RPA_INTAKE_ROS_ROW_LABELS_AFTER.length;
          const ac = RPA_INTAKE_ROS_COL_LABELS_AFTER.length;
          const cellItemsAfter = emptyCellItemsMatrix(ar, ac);
          const hintId =
            typeof crypto !== "undefined" && "randomUUID" in crypto
              ? crypto.randomUUID()
              : `ros_hint_${Date.now()}`;
          cellItemsAfter[0]![0]!.push({
            id: hintId,
            text: "Planlagte tiltak: bruk radene som sjekkliste (samme tema som risiko-radene over). Fyll «Planlagt tiltak» og «Ansvar / status».",
          });
          const cellNotesAfter: string[][] = [];
          for (let r = 0; r < ar; r++) {
            const row: string[] = [];
            for (let c = 0; c < ac; c++) {
              row.push(
                flattenCellItemsToNote(cellItemsAfter[r]?.[c] ?? []),
              );
            }
            cellNotesAfter.push(row);
          }
          patch.rowAxisTitleAfter = RPA_INTAKE_ROS_ROW_AXIS_AFTER;
          patch.colAxisTitleAfter = RPA_INTAKE_ROS_COL_AXIS_AFTER;
          patch.rowLabelsAfter = [...RPA_INTAKE_ROS_ROW_LABELS_AFTER];
          patch.colLabelsAfter = [...RPA_INTAKE_ROS_COL_LABELS_AFTER];
          patch.matrixValuesAfter = emptyMatrix(ar, ac);
          patch.cellNotesAfter = cellNotesAfter;
          patch.cellItemsAfter = cellItemsAfter;
          patch.methodologyStatement =
            "ROS opprettet fra inntaksskjema med RPA-mal: risiko er fordelt på typiske RPA-risikoområder; kolonnene er konsekvens dersom feil oppstår. Etter-delen er for planlagte tiltak per rad.";
        }

        await ctx.db.patch(analysis._id, patch);
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
      throw new Error("Skriv en kort begrunnelse for hvorfor forslaget avslås.");
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

export const remove = mutation({
  args: {
    submissionId: v.id("intakeSubmissions"),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const submission = await ctx.db.get(args.submissionId);
    if (!submission) {
      throw new Error("Forslaget finnes ikke lenger.");
    }
    await requireWorkspaceMember(ctx, submission.workspaceId, userId, "member");
    if (submission.approvedAssessmentId) {
      const assessment = await ctx.db.get(submission.approvedAssessmentId);
      if (assessment) {
        await cascadeDeleteAssessmentData(ctx, submission.approvedAssessmentId);
      }
    }
    if (submission.approvedRosAnalysisId) {
      await cascadeDeleteRosAnalysisData(ctx, submission.approvedRosAnalysisId);
    }
    await ctx.db.delete(submission._id);
    return null;
  },
});
