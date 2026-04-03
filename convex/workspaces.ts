import { v } from "convex/values";
import { internal } from "./_generated/api";
import { mutation, query, type MutationCtx } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";
import {
  getWorkspaceMembership,
  requireUserId,
  requireWorkspaceMember,
} from "./lib/access";
import { normalizeGithubRepoFullName } from "./lib/github";

async function deleteAssessmentCascade(
  ctx: MutationCtx,
  assessmentId: Id<"assessments">,
) {
  const drafts = await ctx.db
    .query("assessmentDrafts")
    .withIndex("by_assessment", (q) => q.eq("assessmentId", assessmentId))
    .collect();
  for (const d of drafts) {
    await ctx.db.delete(d._id);
  }
  const versions = await ctx.db
    .query("assessmentVersions")
    .withIndex("by_assessment", (q) => q.eq("assessmentId", assessmentId))
    .collect();
  for (const v of versions) {
    await ctx.db.delete(v._id);
  }
  const collabs = await ctx.db
    .query("assessmentCollaborators")
    .withIndex("by_assessment", (q) => q.eq("assessmentId", assessmentId))
    .collect();
  for (const c of collabs) {
    await ctx.db.delete(c._id);
  }
  const links = await ctx.db
    .query("assessmentShareLinks")
    .withIndex("by_assessment", (q) => q.eq("assessmentId", assessmentId))
    .collect();
  for (const l of links) {
    await ctx.db.delete(l._id);
  }
  const tasks = await ctx.db
    .query("assessmentTasks")
    .withIndex("by_assessment", (q) => q.eq("assessmentId", assessmentId))
    .collect();
  for (const t of tasks) {
    await ctx.db.delete(t._id);
  }
  const invites = await ctx.db
    .query("assessmentInvites")
    .withIndex("by_assessment", (q) => q.eq("assessmentId", assessmentId))
    .collect();
  for (const i of invites) {
    await ctx.db.delete(i._id);
  }
  await ctx.db.delete(assessmentId);
}

async function deleteOrgUnitsForWorkspace(
  ctx: MutationCtx,
  workspaceId: Id<"workspaces">,
) {
  const units = await ctx.db
    .query("orgUnits")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
    .collect();
  const remaining = new Map(units.map((u) => [u._id, u]));
  while (remaining.size > 0) {
    const vals = [...remaining.values()];
    const leaves = vals.filter(
      (u) => !vals.some((x) => x.parentId === u._id),
    );
    if (leaves.length === 0) {
      throw new Error("Klarte ikke slette organisasjonsenheter (syklus?).");
    }
    for (const leaf of leaves) {
      remaining.delete(leaf._id);
      await ctx.db.delete(leaf._id);
    }
  }
}

export const getMyMembership = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }
    return await getWorkspaceMembership(ctx, args.workspaceId, userId);
  },
});

export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }
    const memberships = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const out = [];
    for (const m of memberships) {
      const w = await ctx.db.get(m.workspaceId);
      if (w) {
        out.push({
          workspace: w,
          role: m.role,
        });
      }
    }
    return out;
  },
});

export const create = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const now = Date.now();
    const wid = await ctx.db.insert("workspaces", {
      name: args.name.trim() || "Nytt arbeidsområde",
      ownerUserId: userId,
      createdAt: now,
    });
    await ctx.db.insert("workspaceMembers", {
      workspaceId: wid,
      userId,
      role: "owner",
      joinedAt: now,
    });
    return wid;
  },
});

export const ensureDefault = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const existing = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (existing) {
      return existing.workspaceId;
    }
    const now = Date.now();
    const wid = await ctx.db.insert("workspaces", {
      name: "Mitt arbeidsområde",
      ownerUserId: userId,
      createdAt: now,
    });
    await ctx.db.insert("workspaceMembers", {
      workspaceId: wid,
      userId,
      role: "owner",
      joinedAt: now,
    });
    return wid;
  },
});

export const get = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }
    await requireWorkspaceMember(ctx, args.workspaceId, userId, "viewer");
    return await ctx.db.get(args.workspaceId);
  },
});

export const listMembers = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }
    await requireWorkspaceMember(ctx, args.workspaceId, userId, "viewer");
    const rows = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    const out = [];
    for (const r of rows) {
      const u = await ctx.db.get(r.userId);
      out.push({
        ...r,
        email: u?.email ?? null,
        name: u?.name ?? null,
      });
    }
    return out;
  },
});

export const update = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.optional(v.string()),
    notes: v.optional(v.union(v.string(), v.null())),
    organizationNumber: v.optional(v.union(v.string(), v.null())),
    institutionIdentifier: v.optional(v.union(v.string(), v.null())),
    githubDefaultRepoFullName: v.optional(v.union(v.string(), v.null())),
    githubDefaultRepoFullNames: v.optional(
      v.union(v.array(v.string()), v.null()),
    ),
    githubProjectNodeId: v.optional(v.union(v.string(), v.null())),
    githubAutoRegisterProcessOnCreate: v.optional(
      v.union(v.boolean(), v.null()),
    ),
    githubAutoRegisterProcessStatusOptionId: v.optional(
      v.union(v.string(), v.null()),
    ),
    githubProjectSingleSelectFieldId: v.optional(
      v.union(v.string(), v.null()),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireWorkspaceMember(ctx, args.workspaceId, userId, "admin");
    const existing = await ctx.db.get(args.workspaceId);
    if (!existing) {
      throw new Error("Arbeidsområdet finnes ikke.");
    }
    const patch: {
      name?: string;
      notes?: string;
      organizationNumber?: string;
      institutionIdentifier?: string;
      githubDefaultRepoFullName?: string;
      githubDefaultRepoFullNames?: string[];
      githubProjectNodeId?: string;
      githubAutoRegisterProcessOnCreate?: boolean;
      githubAutoRegisterProcessStatusOptionId?: string;
      githubProjectSingleSelectFieldId?: string;
      githubProjectStatusFieldCacheAt?: undefined;
      githubProjectStatusFieldCache?: undefined;
    } = {};
    if (args.name !== undefined) {
      patch.name = args.name.trim() || "Uten navn";
    }
    if (args.notes !== undefined) {
      patch.notes = args.notes === null ? undefined : args.notes.trim();
    }
    if (args.organizationNumber !== undefined) {
      patch.organizationNumber =
        args.organizationNumber === null
          ? undefined
          : args.organizationNumber.trim() || undefined;
    }
    if (args.institutionIdentifier !== undefined) {
      patch.institutionIdentifier =
        args.institutionIdentifier === null
          ? undefined
          : args.institutionIdentifier.trim() || undefined;
    }
    if (args.githubDefaultRepoFullNames !== undefined) {
      if (args.githubDefaultRepoFullNames === null) {
        patch.githubDefaultRepoFullNames = undefined;
        patch.githubDefaultRepoFullName = undefined;
      } else {
        const seen = new Set<string>();
        const out: string[] = [];
        for (const raw of args.githubDefaultRepoFullNames) {
          const t = raw.trim();
          if (!t) continue;
          const n = normalizeGithubRepoFullName(t);
          if (!seen.has(n)) {
            seen.add(n);
            out.push(n);
          }
          if (out.length >= 40) break;
        }
        patch.githubDefaultRepoFullNames = out.length > 0 ? out : undefined;
        patch.githubDefaultRepoFullName = undefined;
      }
    }
    if (args.githubDefaultRepoFullName !== undefined) {
      const raw = args.githubDefaultRepoFullName;
      patch.githubDefaultRepoFullName =
        raw === null || raw.trim() === ""
          ? undefined
          : normalizeGithubRepoFullName(raw);
    }
    if (args.githubProjectNodeId !== undefined) {
      const raw = args.githubProjectNodeId;
      patch.githubProjectNodeId =
        raw === null || raw.trim() === "" ? undefined : raw.trim();
      const oldP = existing.githubProjectNodeId?.trim() ?? "";
      const newP = patch.githubProjectNodeId ?? "";
      if (oldP !== newP) {
        patch.githubProjectStatusFieldCacheAt = undefined;
        patch.githubProjectStatusFieldCache = undefined;
      }
    }
    if (args.githubAutoRegisterProcessOnCreate !== undefined) {
      patch.githubAutoRegisterProcessOnCreate =
        args.githubAutoRegisterProcessOnCreate === null
          ? undefined
          : args.githubAutoRegisterProcessOnCreate;
    }
    if (args.githubAutoRegisterProcessStatusOptionId !== undefined) {
      const raw = args.githubAutoRegisterProcessStatusOptionId;
      patch.githubAutoRegisterProcessStatusOptionId =
        raw === null || raw.trim() === ""
          ? undefined
          : raw.trim();
    }
    if (args.githubProjectSingleSelectFieldId !== undefined) {
      const raw = args.githubProjectSingleSelectFieldId;
      patch.githubProjectSingleSelectFieldId =
        raw === null || raw.trim() === "" ? undefined : raw.trim();
      const oldF = existing.githubProjectSingleSelectFieldId?.trim() ?? "";
      const newF = patch.githubProjectSingleSelectFieldId ?? "";
      if (oldF !== newF) {
        patch.githubProjectStatusFieldCacheAt = undefined;
        patch.githubProjectStatusFieldCache = undefined;
      }
    }
    await ctx.db.patch(args.workspaceId, patch);
    return null;
  },
});

/**
 * Sletter arbeidsområde og all tilhørende data (vurderinger, kandidater, org., invitasjoner).
 * Kun eier. Krever at `confirmName` matcher navnet nøyaktig (trimmet).
 */
export const remove = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    confirmName: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace) {
      throw new Error("Arbeidsområdet finnes ikke.");
    }
    if (workspace.ownerUserId !== userId) {
      throw new Error("Kun eier kan slette arbeidsområdet.");
    }
    const confirm = args.confirmName.trim();
    if (confirm !== workspace.name.trim()) {
      throw new Error("Skriv inn det eksakte navnet på arbeidsområdet for å bekrefte.");
    }

    const assessments = await ctx.db
      .query("assessments")
      .withIndex("by_workspace", (q) =>
        q.eq("workspaceId", args.workspaceId),
      )
      .collect();
    for (const a of assessments) {
      await deleteAssessmentCascade(ctx, a._id);
    }

    const candidateRows = await ctx.db
      .query("candidates")
      .withIndex("by_workspace", (q) =>
        q.eq("workspaceId", args.workspaceId),
      )
      .collect();
    for (const c of candidateRows) {
      await ctx.db.delete(c._id);
    }

    const orgContacts = await ctx.db
      .query("orgUnitContacts")
      .withIndex("by_workspace", (q) =>
        q.eq("workspaceId", args.workspaceId),
      )
      .collect();
    for (const c of orgContacts) {
      await ctx.db.delete(c._id);
    }

    await deleteOrgUnitsForWorkspace(ctx, args.workspaceId);

    const pendingInvites = await ctx.db
      .query("workspaceInvites")
      .withIndex("by_workspace", (q) =>
        q.eq("workspaceId", args.workspaceId),
      )
      .collect();
    for (const inv of pendingInvites) {
      await ctx.db.delete(inv._id);
    }

    const githubSecret = await ctx.db
      .query("workspaceGithubSecrets")
      .withIndex("by_workspace", (q) =>
        q.eq("workspaceId", args.workspaceId),
      )
      .first();
    if (githubSecret) {
      await ctx.db.delete(githubSecret._id);
    }

    const members = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace", (q) =>
        q.eq("workspaceId", args.workspaceId),
      )
      .collect();
    for (const m of members) {
      const us = await ctx.db
        .query("userSettings")
        .withIndex("by_user", (q) => q.eq("userId", m.userId))
        .unique();
      if (us?.defaultWorkspaceId === args.workspaceId) {
        await ctx.db.delete(us._id);
      }
      await ctx.db.delete(m._id);
    }

    await ctx.db.delete(args.workspaceId);
    return null;
  },
});

export const listWorkspaceInvites = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }
    await requireWorkspaceMember(ctx, args.workspaceId, userId, "admin");
    const rows = await ctx.db
      .query("workspaceInvites")
      .withIndex("by_workspace", (q) =>
        q.eq("workspaceId", args.workspaceId),
      )
      .collect();
    return rows.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const cancelWorkspaceInvite = mutation({
  args: { inviteId: v.id("workspaceInvites") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const inv = await ctx.db.get(args.inviteId);
    if (!inv) {
      throw new Error("Invitasjonen finnes ikke.");
    }
    await requireWorkspaceMember(ctx, inv.workspaceId, userId, "admin");
    await ctx.db.delete(args.inviteId);
    return null;
  },
});

export const inviteMember = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    email: v.string(),
    role: v.union(
      v.literal("admin"),
      v.literal("member"),
      v.literal("viewer"),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireWorkspaceMember(ctx, args.workspaceId, userId, "admin");
    const email = args.email.trim().toLowerCase();
    if (!email) {
      throw new Error("E-post mangler.");
    }
    const foundUser = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .unique();
    if (foundUser) {
      const existing = await ctx.db
        .query("workspaceMembers")
        .withIndex("by_user_workspace", (q) =>
          q.eq("userId", foundUser._id).eq("workspaceId", args.workspaceId),
        )
        .unique();
      if (existing) {
        throw new Error("Brukeren er allerede medlem.");
      }
      await ctx.db.insert("workspaceMembers", {
        workspaceId: args.workspaceId,
        userId: foundUser._id,
        role: args.role,
        joinedAt: Date.now(),
      });
      await ctx.scheduler.runAfter(
        0,
        internal.notificationEmails.sendWorkspaceDirectAddEmail,
        { userId: foundUser._id, workspaceId: args.workspaceId },
      );
      return { kind: "linked" as const };
    }
    const pending = await ctx.db
      .query("workspaceInvites")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    for (const p of pending) {
      if (p.email === email) {
        throw new Error("Det finnes allerede en ventende invitasjon.");
      }
    }
    const token = `w_${Date.now()}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`;
    const inviteId = await ctx.db.insert("workspaceInvites", {
      workspaceId: args.workspaceId,
      email,
      role: args.role,
      token,
      invitedByUserId: userId,
      createdAt: Date.now(),
    });
    await ctx.scheduler.runAfter(
      0,
      internal.notificationEmails.sendPendingWorkspaceInvite,
      { inviteId },
    );
    return { kind: "pending" as const, token };
  },
});

export const removeMember = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    targetUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireWorkspaceMember(ctx, args.workspaceId, userId, "admin");
    const w = await ctx.db.get(args.workspaceId);
    if (!w) {
      throw new Error("Arbeidsområdet finnes ikke.");
    }
    if (args.targetUserId === w.ownerUserId) {
      throw new Error("Kan ikke fjerne eier.");
    }
    const target = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_user_workspace", (q) =>
        q.eq("userId", args.targetUserId).eq("workspaceId", args.workspaceId),
      )
      .unique();
    if (!target) {
      throw new Error("Brukeren er ikke medlem.");
    }
    if (target.role === "owner") {
      throw new Error("Kan ikke fjerne eier.");
    }
    await ctx.db.delete(target._id);
    return null;
  },
});

export const updateMemberRole = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    targetUserId: v.id("users"),
    role: v.union(
      v.literal("admin"),
      v.literal("member"),
      v.literal("viewer"),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireWorkspaceMember(ctx, args.workspaceId, userId, "admin");
    const w = await ctx.db.get(args.workspaceId);
    if (!w) {
      throw new Error("Arbeidsområdet finnes ikke.");
    }
    if (args.targetUserId === w.ownerUserId) {
      throw new Error("Eierrollen kan ikke endres her.");
    }
    const target = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_user_workspace", (q) =>
        q.eq("userId", args.targetUserId).eq("workspaceId", args.workspaceId),
      )
      .unique();
    if (!target) {
      throw new Error("Brukeren er ikke medlem.");
    }
    if (target.role === "owner") {
      throw new Error("Eierrollen kan ikke endres her.");
    }
    await ctx.db.patch(target._id, { role: args.role });
    return null;
  },
});

export const acceptWorkspaceInvitesForEmail = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const user = await ctx.db.get(userId);
    const email = user?.email?.trim().toLowerCase();
    if (!email) {
      return 0;
    }
    const invites = await ctx.db
      .query("workspaceInvites")
      .withIndex("by_email", (q) => q.eq("email", email))
      .collect();
    let n = 0;
    for (const inv of invites) {
      const existing = await ctx.db
        .query("workspaceMembers")
        .withIndex("by_user_workspace", (q) =>
          q.eq("userId", userId).eq("workspaceId", inv.workspaceId),
        )
        .unique();
      if (!existing) {
        await ctx.db.insert("workspaceMembers", {
          workspaceId: inv.workspaceId,
          userId,
          role: inv.role,
          joinedAt: Date.now(),
        });
        n++;
      }
      await ctx.db.delete(inv._id);
    }
    return n;
  },
});

/** Brukerpreferanser (standard arbeidsområde) — ligger i workspaces-modulen for stabil deploy. */
export const getMySettings = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }
    return await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
  },
});

export const setDefaultWorkspace = mutation({
  args: {
    workspaceId: v.union(v.id("workspaces"), v.null()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    if (args.workspaceId === null) {
      const existing = await ctx.db
        .query("userSettings")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .unique();
      if (existing) {
        await ctx.db.delete(existing._id);
      }
      return null;
    }
    const m = await getWorkspaceMembership(ctx, args.workspaceId, userId);
    if (!m) {
      throw new Error("Du er ikke medlem av dette arbeidsområdet.");
    }
    const existing = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        defaultWorkspaceId: args.workspaceId,
      });
    } else {
      await ctx.db.insert("userSettings", {
        userId,
        defaultWorkspaceId: args.workspaceId,
      });
    }
    return null;
  },
});

/** «Ikke vis mer» på prosessregister-veiledning — lagres per bruker. */
export const dismissProsessregisterTutorial = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const existing = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        prosessregisterTutorialDismissed: true,
      });
    } else {
      await ctx.db.insert("userSettings", {
        userId,
        prosessregisterTutorialDismissed: true,
      });
    }
    return null;
  },
});

/**
 * Slår av/på veiledning for prosessregister (dashboard).
 * Når enabled=true, nullstilles «ikke vis mer» slik at veiledning kan vises igjen.
 */
export const setProsessregisterTutorialEnabled = mutation({
  args: { enabled: v.boolean() },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const existing = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        prosessregisterTutorialEnabled: args.enabled,
        ...(args.enabled ? { prosessregisterTutorialDismissed: false } : {}),
      });
    } else {
      await ctx.db.insert("userSettings", {
        userId,
        prosessregisterTutorialEnabled: args.enabled,
        ...(args.enabled ? { prosessregisterTutorialDismissed: false } : {}),
      });
    }
    return null;
  },
});
