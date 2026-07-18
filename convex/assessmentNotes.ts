import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAssessmentEdit, requireAssessmentRead } from "./lib/access";
import { insertUserInAppNotification } from "./userInAppNotifications";

const NOTE_MAX = 8_000;

export const listByAssessment = query({
  args: { assessmentId: v.id("assessments") },
  returns: v.array(
    v.object({
      _id: v.id("assessmentNotes"),
      _creationTime: v.number(),
      workspaceId: v.id("workspaces"),
      assessmentId: v.id("assessments"),
      authorUserId: v.id("users"),
      body: v.string(),
      fieldKey: v.optional(v.string()),
      parentNoteId: v.optional(v.id("assessmentNotes")),
      mentionedUserIds: v.optional(v.array(v.id("users"))),
      createdAt: v.number(),
      authorName: v.string(),
      mentionedNames: v.array(v.string()),
    }),
  ),
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
      const mentionedNames: string[] = [];
      for (const uid of r.mentionedUserIds ?? []) {
        const mu = await ctx.db.get(uid);
        if (mu) mentionedNames.push(mu.name ?? mu.email ?? "Bruker");
      }
      out.push({
        ...r,
        authorName: u?.name ?? u?.email ?? "Bruker",
        mentionedNames,
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
    parentNoteId: v.optional(v.id("assessmentNotes")),
    mentionedUserIds: v.optional(v.array(v.id("users"))),
  },
  returns: v.id("assessmentNotes"),
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

    let parentNoteId = args.parentNoteId;
    let notifyParentAuthor: typeof userId | null = null;
    if (parentNoteId) {
      const parent = await ctx.db.get(parentNoteId);
      if (!parent || parent.assessmentId !== args.assessmentId) {
        throw new Error("Tråden finnes ikke på denne vurderingen.");
      }
      // Kun ett nivå: svar på svar går under samme toppkommentar
      if (parent.parentNoteId) {
        parentNoteId = parent.parentNoteId;
        const root = await ctx.db.get(parentNoteId);
        if (root && root.authorUserId !== userId) {
          notifyParentAuthor = root.authorUserId;
        }
      } else if (parent.authorUserId !== userId) {
        notifyParentAuthor = parent.authorUserId;
      }
    }

    const mentioned = [...new Set(args.mentionedUserIds ?? [])].slice(0, 20);
    const now = Date.now();
    const noteId = await ctx.db.insert("assessmentNotes", {
      workspaceId: assessment.workspaceId,
      assessmentId: args.assessmentId,
      authorUserId: userId,
      body,
      fieldKey,
      parentNoteId,
      mentionedUserIds: mentioned.length > 0 ? mentioned : undefined,
      createdAt: now,
    });

    const title = assessment.title.trim() || "vurdering";
    const href = `/w/${assessment.workspaceId}/puls`;
    const notifyIds = new Set(mentioned);
    if (notifyParentAuthor) notifyIds.add(notifyParentAuthor);

    for (const uid of notifyIds) {
      if (uid === userId) continue;
      const isMention = mentioned.includes(uid);
      await insertUserInAppNotification(ctx, {
        userId: uid,
        title: isMention
          ? `Du ble nevnt i en kommentar`
          : `Nytt svar i en kommentartråd`,
        body: `På «${title}».`,
        href,
      });
    }

    return noteId;
  },
});
