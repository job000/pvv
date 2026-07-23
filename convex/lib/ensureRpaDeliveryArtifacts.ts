import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { AssessmentPayload } from "../../lib/assessment-types";
import { buildSeedPddPayload } from "../../lib/seed-pdd-from-assessment";
import {
  emptyCellItemsMatrix,
  flattenCellItemsToNote,
} from "../../lib/ros-cell-items";
import {
  DEFAULT_ROS_COL_LABELS,
  emptyMatrix,
  isRpaIntakeRosTemplate,
  RPA_INTAKE_ROS_COL_AXIS,
  RPA_INTAKE_ROS_COL_AXIS_AFTER,
  RPA_INTAKE_ROS_COL_LABELS_AFTER,
  RPA_INTAKE_ROS_ROW_AXIS,
  RPA_INTAKE_ROS_ROW_AXIS_AFTER,
  RPA_INTAKE_ROS_ROW_DESCRIPTIONS,
  RPA_INTAKE_ROS_ROW_LABELS,
  RPA_INTAKE_ROS_ROW_LABELS_AFTER,
  RPA_INTAKE_ROS_TEMPLATE_DESCRIPTION,
  RPA_INTAKE_ROS_TEMPLATE_NAME,
} from "../../lib/ros-defaults";
import {
  createRosAnalysisWithUser,
  createRosTemplateWithUser,
} from "../ros";
import { placeIntakeRisksOnRosMatrix } from "./rosIntakePlacement";

export { buildSeedPddPayload } from "../../lib/seed-pdd-from-assessment";

export async function findRosForAssessment(
  ctx: MutationCtx,
  args: {
    assessmentId: Id<"assessments">;
    candidateId?: Id<"candidates">;
    intake?: Doc<"intakeSubmissions"> | null;
  },
): Promise<Doc<"rosAnalyses"> | null> {
  if (args.intake?.approvedRosAnalysisId) {
    const fromIntake = await ctx.db.get(args.intake.approvedRosAnalysisId);
    if (fromIntake) return fromIntake;
  }
  if (args.candidateId) {
    const rosLink = await ctx.db
      .query("candidateRosAnalysisLinks")
      .withIndex("by_candidate", (q) => q.eq("candidateId", args.candidateId!))
      .first();
    if (rosLink) {
      const fromCand = await ctx.db.get(rosLink.rosAnalysisId);
      if (fromCand) return fromCand;
    }
  }
  const junction = await ctx.db
    .query("rosAnalysisAssessments")
    .withIndex("by_assessment", (q) => q.eq("assessmentId", args.assessmentId))
    .first();
  if (junction) {
    const fromJunction = await ctx.db.get(junction.rosAnalysisId);
    if (fromJunction) return fromJunction;
  }
  return await ctx.db
    .query("rosAnalyses")
    .withIndex("by_assessment", (q) => q.eq("assessmentId", args.assessmentId))
    .first();
}

/**
 * Finn eller opprett ROS koblet til vurderingen (med inntaksrisikoer når tilgjengelig).
 */
export async function ensureRosForDelivery(
  ctx: MutationCtx,
  args: {
    assessment: Doc<"assessments">;
    actorUserId: Id<"users">;
    candidateId?: Id<"candidates">;
    intake?: Doc<"intakeSubmissions"> | null;
    draftPayload?: AssessmentPayload | null;
  },
): Promise<{ ros: Doc<"rosAnalyses">; created: boolean }> {
  const existing = await findRosForAssessment(ctx, {
    assessmentId: args.assessment._id,
    candidateId: args.candidateId,
    intake: args.intake,
  });
  if (existing) {
    return { ros: existing, created: false };
  }

  const workspaceId = args.assessment.workspaceId;
  const intakeForm = args.intake
    ? await ctx.db.get(args.intake.formId)
    : null;

  let templateId = intakeForm?.linkedRosTemplateId;
  if (templateId) {
    const linked = await ctx.db.get(templateId);
    if (!linked || linked.workspaceId !== workspaceId) {
      templateId = undefined;
    }
  }
  if (!templateId) {
    const first = await ctx.db
      .query("rosTemplates")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .take(1);
    templateId = first[0]?._id;
  }
  if (!templateId) {
    templateId = await createRosTemplateWithUser(ctx, args.actorUserId, {
      workspaceId,
      name: RPA_INTAKE_ROS_TEMPLATE_NAME,
      description: RPA_INTAKE_ROS_TEMPLATE_DESCRIPTION,
      rowAxisTitle: RPA_INTAKE_ROS_ROW_AXIS,
      colAxisTitle: RPA_INTAKE_ROS_COL_AXIS,
      rowLabels: [...RPA_INTAKE_ROS_ROW_LABELS],
      colLabels: [...DEFAULT_ROS_COL_LABELS],
      rowDescriptions: [...RPA_INTAKE_ROS_ROW_DESCRIPTIONS],
    });
  }

  const notes =
    args.intake?.generatedRosSuggestion?.summary?.trim() ||
    args.draftPayload?.processDescription?.trim() ||
    undefined;

  const analysisId = await createRosAnalysisWithUser(ctx, args.actorUserId, {
    workspaceId,
    templateId,
    title: `ROS · ${args.assessment.title}`,
    assessmentIds: [args.assessment._id],
    candidateId: args.candidateId,
    notes,
  });

  const analysis = await ctx.db.get(analysisId);
  if (!analysis) {
    throw new Error("Kunne ikke opprette ROS-analyse.");
  }

  const risks = args.intake?.generatedRosSuggestion?.risks;
  if (risks && risks.length > 0) {
    const { cellItems, cellNotes, matrixValues } = placeIntakeRisksOnRosMatrix(
      risks.map((risk) => ({
        id: risk.id,
        title: risk.title,
        description: risk.description,
        severity: risk.severity,
        source: risk.source,
      })),
      analysis.rowLabels,
      analysis.colLabels,
      analysis.matrixValues,
      args.intake?.generatedPvvFlags ?? [],
    );

    const patch: Record<string, unknown> = {
      notes: notes ?? analysis.notes,
      contextSummary: args.draftPayload?.processDescription,
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
          row.push(flattenCellItemsToNote(cellItemsAfter[r]?.[c] ?? []));
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
        "ROS opprettet ved prioritering for leveranse: risiko er fordelt fra inntak/vurdering; etter-delen er for planlagte tiltak per rad.";
    }

    await ctx.db.patch(analysis._id, patch);
  }

  if (args.intake && !args.intake.approvedRosAnalysisId) {
    await ctx.db.patch(args.intake._id, {
      approvedRosAnalysisId: analysisId,
    });
  }

  const refreshed = (await ctx.db.get(analysisId)) ?? analysis;
  return { ros: refreshed, created: true };
}

/**
 * Finn eller opprett PDD med startinnhold fra vurdering/inntak.
 */
export async function ensurePddForDelivery(
  ctx: MutationCtx,
  args: {
    assessment: Doc<"assessments">;
    actorUserId: Id<"users">;
    draftPayload?: AssessmentPayload | null;
    intake?: Doc<"intakeSubmissions"> | null;
    rosTitle?: string | null;
  },
): Promise<{ pdd: Doc<"processDesignDocuments">; created: boolean }> {
  const existing = await ctx.db
    .query("processDesignDocuments")
    .withIndex("by_assessment", (q) =>
      q.eq("assessmentId", args.assessment._id),
    )
    .first();
  if (existing) {
    return { pdd: existing, created: false };
  }

  const now = Date.now();
  const payload = buildSeedPddPayload({
    assessmentTitle: args.assessment.title,
    payload: args.draftPayload,
    intakeRosSummary: args.intake?.generatedRosSuggestion?.summary,
    intakeSubmitter: args.intake?.submitterMeta,
    rosTitle: args.rosTitle,
  });

  const id = await ctx.db.insert("processDesignDocuments", {
    workspaceId: args.assessment.workspaceId,
    assessmentId: args.assessment._id,
    payload,
    revision: 1,
    updatedAt: now,
    updatedByUserId: args.actorUserId,
    createdAt: now,
    createdByUserId: args.actorUserId,
  });

  const pdd = await ctx.db.get(id);
  if (!pdd) {
    throw new Error("Kunne ikke opprette prosessdesign-dokument.");
  }
  return { pdd, created: true };
}
