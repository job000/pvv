import { v } from "convex/values";
import { internalQuery, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

const ROLE_NB_WORKSPACE: Record<string, string> = {
  admin: "Administrator",
  member: "Medlem",
  viewer: "Visning",
};

const ROLE_NB_ASSESSMENT: Record<string, string> = {
  owner: "Eier",
  editor: "Redaktør",
  reviewer: "Gjennomganger",
  viewer: "Visning",
};

async function userWantsInviteEmail(
  ctx: QueryCtx,
  userId: Id<"users">,
): Promise<boolean> {
  const settings = await ctx.db
    .query("userSettings")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
  return settings?.notifyEmailInvitations !== false;
}

export const getWorkspaceUserInviteEmailPayload = internalQuery({
  args: {
    userId: v.id("users"),
    workspaceId: v.id("workspaces"),
    role: v.union(
      v.literal("admin"),
      v.literal("member"),
      v.literal("viewer"),
    ),
  },
  handler: async (ctx, args) => {
    if (!(await userWantsInviteEmail(ctx, args.userId))) {
      return null;
    }
    const user = await ctx.db.get(args.userId);
    const email = user?.email?.trim();
    if (!email) {
      return null;
    }
    const ws = await ctx.db.get(args.workspaceId);
    return {
      toEmail: email,
      workspaceName: ws?.name ?? "Arbeidsområde",
      roleLabel: ROLE_NB_WORKSPACE[args.role] ?? args.role,
    };
  },
});

export const getPendingWorkspaceInviteEmailPayload = internalQuery({
  args: { inviteId: v.id("workspaceInvites") },
  handler: async (ctx, args) => {
    const inv = await ctx.db.get(args.inviteId);
    if (!inv) {
      return null;
    }
    const ws = await ctx.db.get(inv.workspaceId);
    const inviter = await ctx.db.get(inv.invitedByUserId);
    return {
      toEmail: inv.email,
      workspaceName: ws?.name ?? "Arbeidsområde",
      roleLabel: ROLE_NB_WORKSPACE[inv.role] ?? inv.role,
      inviterName: inviter?.name?.trim() || inviter?.email || "En kollega",
    };
  },
});

export const getPendingAssessmentInviteEmailPayload = internalQuery({
  args: { inviteId: v.id("assessmentInvites") },
  handler: async (ctx, args) => {
    const inv = await ctx.db.get(args.inviteId);
    if (!inv) {
      return null;
    }
    const assessment = await ctx.db.get(inv.assessmentId);
    if (!assessment) {
      return null;
    }
    const ws = await ctx.db.get(assessment.workspaceId);
    const inviter = await ctx.db.get(inv.invitedByUserId);
    return {
      toEmail: inv.email,
      assessmentTitle: assessment.title,
      workspaceName: ws?.name ?? "Arbeidsområde",
      roleLabel: ROLE_NB_ASSESSMENT[inv.role] ?? inv.role,
      inviterName: inviter?.name?.trim() || inviter?.email || "En kollega",
      workspaceId: assessment.workspaceId,
      assessmentId: inv.assessmentId,
    };
  },
});

export const getWorkspaceDirectAddEmailPayload = internalQuery({
  args: {
    userId: v.id("users"),
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    if (!(await userWantsInviteEmail(ctx, args.userId))) {
      return null;
    }
    const user = await ctx.db.get(args.userId);
    const email = user?.email?.trim();
    if (!email) {
      return null;
    }
    const ws = await ctx.db.get(args.workspaceId);
    return {
      toEmail: email,
      workspaceName: ws?.name ?? "Arbeidsområde",
    };
  },
});

export const getAssessmentDirectAddEmailPayload = internalQuery({
  args: {
    userId: v.id("users"),
    assessmentId: v.id("assessments"),
  },
  handler: async (ctx, args) => {
    if (!(await userWantsInviteEmail(ctx, args.userId))) {
      return null;
    }
    const user = await ctx.db.get(args.userId);
    const email = user?.email?.trim();
    if (!email) {
      return null;
    }
    const assessment = await ctx.db.get(args.assessmentId);
    if (!assessment) {
      return null;
    }
    const ws = await ctx.db.get(assessment.workspaceId);
    return {
      toEmail: email,
      assessmentTitle: assessment.title,
      workspaceName: ws?.name ?? "Arbeidsområde",
      workspaceId: assessment.workspaceId,
      assessmentId: args.assessmentId,
    };
  },
});
