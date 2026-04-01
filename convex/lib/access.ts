import { getAuthUserId } from "@convex-dev/auth/server";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

const WORKSPACE_RANK: Record<string, number> = {
  viewer: 0,
  member: 1,
  admin: 2,
  owner: 3,
};

const ASSESSMENT_RANK: Record<string, number> = {
  viewer: 0,
  reviewer: 1,
  editor: 2,
  owner: 3,
};

export async function requireUserId(
  ctx: QueryCtx | MutationCtx,
): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new Error("Du må være innlogget.");
  }
  return userId;
}

export async function getWorkspaceMembership(
  ctx: QueryCtx | MutationCtx,
  workspaceId: Id<"workspaces">,
  userId: Id<"users">,
): Promise<Doc<"workspaceMembers"> | null> {
  return await ctx.db
    .query("workspaceMembers")
    .withIndex("by_user_workspace", (q) =>
      q.eq("userId", userId).eq("workspaceId", workspaceId),
    )
    .unique();
}

export async function requireWorkspaceMember(
  ctx: QueryCtx | MutationCtx,
  workspaceId: Id<"workspaces">,
  userId: Id<"users">,
  minRole: keyof typeof WORKSPACE_RANK = "viewer",
): Promise<Doc<"workspaceMembers">> {
  const m = await getWorkspaceMembership(ctx, workspaceId, userId);
  if (!m || WORKSPACE_RANK[m.role] < WORKSPACE_RANK[minRole]) {
    throw new Error("Ingen tilgang til arbeidsområdet.");
  }
  return m;
}

export async function getAssessmentCollaborator(
  ctx: QueryCtx | MutationCtx,
  assessmentId: Id<"assessments">,
  userId: Id<"users">,
): Promise<Doc<"assessmentCollaborators"> | null> {
  return await ctx.db
    .query("assessmentCollaborators")
    .withIndex("by_user_assessment", (q) =>
      q.eq("userId", userId).eq("assessmentId", assessmentId),
    )
    .unique();
}

/** Lesetilgang til vurdering */
export async function canReadAssessment(
  ctx: QueryCtx | MutationCtx,
  assessment: Doc<"assessments">,
  userId: Id<"users">,
): Promise<boolean> {
  const wm = await getWorkspaceMembership(ctx, assessment.workspaceId, userId);
  if (!wm) {
    return (await getAssessmentCollaborator(ctx, assessment._id, userId)) !== null;
  }
  if (WORKSPACE_RANK[wm.role] >= WORKSPACE_RANK.admin) {
    return true;
  }
  if (assessment.shareWithWorkspace) {
    return true;
  }
  return (await getAssessmentCollaborator(ctx, assessment._id, userId)) !== null;
}

/** Skrivetilgang */
export async function canEditAssessment(
  ctx: QueryCtx | MutationCtx,
  assessment: Doc<"assessments">,
  userId: Id<"users">,
): Promise<boolean> {
  const wm = await getWorkspaceMembership(ctx, assessment.workspaceId, userId);
  if (wm && WORKSPACE_RANK[wm.role] >= WORKSPACE_RANK.admin) {
    return true;
  }
  const c = await getAssessmentCollaborator(ctx, assessment._id, userId);
  if (c && ASSESSMENT_RANK[c.role] >= ASSESSMENT_RANK.editor) {
    return true;
  }
  if (
    wm &&
    assessment.shareWithWorkspace &&
    WORKSPACE_RANK[wm.role] >= WORKSPACE_RANK.member
  ) {
    return true;
  }
  return false;
}

export async function requireAssessmentRead(
  ctx: QueryCtx | MutationCtx,
  assessmentId: Id<"assessments">,
): Promise<{ assessment: Doc<"assessments">; userId: Id<"users"> }> {
  const userId = await requireUserId(ctx);
  const assessment = await ctx.db.get(assessmentId);
  if (!assessment) {
    throw new Error("Vurdering finnes ikke.");
  }
  const ok = await canReadAssessment(ctx, assessment, userId);
  if (!ok) {
    throw new Error("Ingen tilgang til denne vurderingen.");
  }
  return { assessment, userId };
}

/**
 * For spørringer som skal tåle slettede dokumenter uten å kaste (klienten får null).
 * Returnerer null når bruker ikke er innlogget eller raden mangler.
 * Kaster når raden finnes men brukeren ikke har lesetilgang.
 */
export async function getAssessmentIfReadable(
  ctx: QueryCtx,
  assessmentId: Id<"assessments">,
): Promise<{ assessment: Doc<"assessments">; userId: Id<"users"> } | null> {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    return null;
  }
  const assessment = await ctx.db.get(assessmentId);
  if (!assessment) {
    return null;
  }
  const ok = await canReadAssessment(ctx, assessment, userId);
  if (!ok) {
    throw new Error("Ingen tilgang til denne vurderingen.");
  }
  return { assessment, userId };
}

export async function requireAssessmentEdit(
  ctx: QueryCtx | MutationCtx,
  assessmentId: Id<"assessments">,
): Promise<{ assessment: Doc<"assessments">; userId: Id<"users"> }> {
  const userId = await requireUserId(ctx);
  const assessment = await ctx.db.get(assessmentId);
  if (!assessment) {
    throw new Error("Vurdering finnes ikke.");
  }
  const ok = await canEditAssessment(ctx, assessment, userId);
  if (!ok) {
    throw new Error("Du har ikke redigeringstilgang.");
  }
  return { assessment, userId };
}
