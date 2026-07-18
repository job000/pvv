import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUserId, requireWorkspaceMember } from "./lib/access";

const NOTE_MAX = 8_000;

export const listBySubmission = query({
  args: { submissionId: v.id("intakeSubmissions") },
  returns: v.array(
    v.object({
      _id: v.id("intakeSubmissionNotes"),
      _creationTime: v.number(),
      workspaceId: v.id("workspaces"),
      submissionId: v.id("intakeSubmissions"),
      authorUserId: v.id("users"),
      body: v.string(),
      createdAt: v.number(),
      authorName: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const submission = await ctx.db.get(args.submissionId);
    if (!submission) return [];
    await requireWorkspaceMember(ctx, submission.workspaceId, userId, "viewer");
    const rows = await ctx.db
      .query("intakeSubmissionNotes")
      .withIndex("by_submission", (q) =>
        q.eq("submissionId", args.submissionId),
      )
      .collect();
    rows.sort((a, b) => a.createdAt - b.createdAt);
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
    submissionId: v.id("intakeSubmissions"),
    body: v.string(),
  },
  returns: v.id("intakeSubmissionNotes"),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const submission = await ctx.db.get(args.submissionId);
    if (!submission) throw new Error("Fant ikke forslaget.");
    await requireWorkspaceMember(ctx, submission.workspaceId, userId, "member");
    const body = args.body.trim();
    if (!body) throw new Error("Kommentaren er tom.");
    if (body.length > NOTE_MAX) {
      throw new Error(`Kommentaren kan ikke overstige ${NOTE_MAX} tegn.`);
    }
    return await ctx.db.insert("intakeSubmissionNotes", {
      workspaceId: submission.workspaceId,
      submissionId: args.submissionId,
      authorUserId: userId,
      body,
      createdAt: Date.now(),
    });
  },
});
