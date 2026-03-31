import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAssessmentEdit, requireAssessmentRead } from "./lib/access";

const NOTE_MAX = 8_000;

export const listByAssessment = query({
  args: { assessmentId: v.id("assessments") },
  handler: async (ctx, args) => {
    await requireAssessmentRead(ctx, args.assessmentId);
    const rows = await ctx.db
      .query("assessmentNotes")
      .withIndex("by_assessment", (q) =>
        q.eq("assessmentId", args.assessmentId),
      )
      .collect();
    rows.sort((a, b) => b.createdAt - a.createdAt);
    const out = [];
    for (const r of rows) {
      const u = await ctx.db.get(r.authorUserId);
      out.push({
        ...r,
        authorName: u?.name ?? u?.email ?? "Bruker",
      });
    }
    return out;
  },
});

export const add = mutation({
  args: {
    assessmentId: v.id("assessments"),
    body: v.string(),
    /** Valgfritt skjemafelt (payload-nøkkel) kommentaren gjelder */
    fieldKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { assessment, userId } = await requireAssessmentEdit(
      ctx,
      args.assessmentId,
    );
    const body = args.body.trim();
    if (!body) {
      throw new Error("Notatet er tomt.");
    }
    if (body.length > NOTE_MAX) {
      throw new Error(`Notatet kan ikke overstige ${NOTE_MAX} tegn.`);
    }
    let fieldKey: string | undefined;
    if (args.fieldKey !== undefined) {
      const fk = args.fieldKey.trim();
      if (fk.length > 120) {
        throw new Error("Feltreferansen er for lang.");
      }
      fieldKey = fk || undefined;
    }
    const now = Date.now();
    return await ctx.db.insert("assessmentNotes", {
      workspaceId: assessment.workspaceId,
      assessmentId: args.assessmentId,
      authorUserId: userId,
      body,
      fieldKey,
      createdAt: now,
    });
  },
});
