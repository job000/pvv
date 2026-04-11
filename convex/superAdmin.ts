import { v } from "convex/values";
import { Scrypt } from "lucia";
import { internalMutation, mutation, query } from "./_generated/server";
import { isSuperAdmin, requireSuperAdmin, requireUserId } from "./lib/access";

/**
 * Seed: gi superadmin-tilgang basert på e-post.
 * Kjør: npx convex run superAdmin:seedSuperAdmin '{"email":"test@test.no"}'
 */
export const seedSuperAdmin = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .unique();
    if (!user) {
      throw new Error(`Ingen bruker med e-post «${email}» funnet.`);
    }
    const existing = await ctx.db
      .query("superAdmins")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    if (existing) {
      return { status: "already_superadmin", userId: user._id, name: user.name ?? null };
    }
    await ctx.db.insert("superAdmins", {
      userId: user._id,
      grantedAt: Date.now(),
    });
    return { status: "granted", userId: user._id, name: user.name ?? null };
  },
});

/** Debug: tell antall brukere og arbeidsområder — kjør fra CLI uten innlogging */
export const debugCounts = internalMutation({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    const workspaces = await ctx.db.query("workspaces").collect();
    const superAdmins = await ctx.db.query("superAdmins").collect();
    return {
      userCount: users.length,
      workspaceCount: workspaces.length,
      superAdminCount: superAdmins.length,
      users: users.map((u) => ({ id: u._id, name: u.name ?? null, email: u.email ?? null })),
      workspaces: workspaces.map((w) => ({ id: w._id, name: w.name })),
    };
  },
});

export const checkAccess = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    return { isSuperAdmin: await isSuperAdmin(ctx, userId) };
  },
});

export const listAllUsers = query({
  args: {},
  handler: async (ctx) => {
    await requireSuperAdmin(ctx);
    const users = await ctx.db.query("users").collect();
    const superAdmins = await ctx.db.query("superAdmins").collect();
    const saSet = new Set(superAdmins.map((s) => s.userId));

    const out = [];
    for (const u of users) {
      const memberships = await ctx.db
        .query("workspaceMembers")
        .withIndex("by_user", (q) => q.eq("userId", u._id))
        .collect();
      const workspaces = [];
      for (const m of memberships) {
        const w = await ctx.db.get(m.workspaceId);
        if (w) workspaces.push({ id: w._id, name: w.name, role: m.role });
      }
      out.push({
        _id: u._id,
        _creationTime: u._creationTime,
        name: u.name ?? null,
        email: u.email ?? null,
        image: u.image ?? null,
        isSuperAdmin: saSet.has(u._id),
        workspaces,
      });
    }
    return out;
  },
});

export const listAllWorkspaces = query({
  args: {},
  handler: async (ctx) => {
    await requireSuperAdmin(ctx);
    const workspaces = await ctx.db.query("workspaces").collect();
    const out = [];
    for (const w of workspaces) {
      const members = await ctx.db
        .query("workspaceMembers")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", w._id))
        .collect();
      const memberDetails = [];
      for (const m of members) {
        const u = await ctx.db.get(m.userId);
        memberDetails.push({
          _id: m._id,
          userId: m.userId,
          role: m.role,
          name: u?.name ?? null,
          email: u?.email ?? null,
        });
      }
      const owner = await ctx.db.get(w.ownerUserId);
      const assessmentCount = (
        await ctx.db
          .query("assessments")
          .withIndex("by_workspace", (q) => q.eq("workspaceId", w._id))
          .collect()
      ).length;
      out.push({
        _id: w._id,
        _creationTime: w._creationTime,
        name: w.name,
        createdAt: w.createdAt,
        ownerUserId: w.ownerUserId,
        ownerName: owner?.name ?? owner?.email ?? null,
        memberCount: members.length,
        assessmentCount,
        members: memberDetails,
      });
    }
    return out;
  },
});

export const toggleSuperAdmin = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const existing = await ctx.db
      .query("superAdmins")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
      return { granted: false };
    }
    await ctx.db.insert("superAdmins", {
      userId: args.userId,
      grantedAt: Date.now(),
    });
    return { granted: true };
  },
});

export const deleteUser = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const memberships = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    for (const m of memberships) {
      await ctx.db.delete(m._id);
    }
    const collabs = await ctx.db
      .query("assessmentCollaborators")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    for (const c of collabs) {
      await ctx.db.delete(c._id);
    }
    const sa = await ctx.db
      .query("superAdmins")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
    if (sa) await ctx.db.delete(sa._id);
    await ctx.db.delete(args.userId);
  },
});

export const updateWorkspace = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const t = args.name.trim();
    if (!t) throw new Error("Navn kan ikke være tomt.");
    await ctx.db.patch(args.workspaceId, { name: t });
  },
});

export const deleteWorkspace = mutation({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const members = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    for (const m of members) {
      await ctx.db.delete(m._id);
    }
    const assessments = await ctx.db
      .query("assessments")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    for (const a of assessments) {
      const drafts = await ctx.db
        .query("assessmentDrafts")
        .withIndex("by_assessment", (q) => q.eq("assessmentId", a._id))
        .collect();
      for (const d of drafts) await ctx.db.delete(d._id);
      const versions = await ctx.db
        .query("assessmentVersions")
        .withIndex("by_assessment", (q) => q.eq("assessmentId", a._id))
        .collect();
      for (const ver of versions) await ctx.db.delete(ver._id);
      const collabs = await ctx.db
        .query("assessmentCollaborators")
        .withIndex("by_assessment", (q) => q.eq("assessmentId", a._id))
        .collect();
      for (const c of collabs) await ctx.db.delete(c._id);
      await ctx.db.delete(a._id);
    }
    const invites = await ctx.db
      .query("workspaceInvites")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    for (const i of invites) await ctx.db.delete(i._id);
    const userInvites = await ctx.db
      .query("workspaceUserInvites")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    for (const i of userInvites) await ctx.db.delete(i._id);
    await ctx.db.delete(args.workspaceId);
  },
});

export const removeMemberFromWorkspace = mutation({
  args: {
    membershipId: v.id("workspaceMembers"),
  },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const m = await ctx.db.get(args.membershipId);
    if (!m) throw new Error("Medlemskap finnes ikke.");
    await ctx.db.delete(args.membershipId);
  },
});

export const updateMemberRole = mutation({
  args: {
    membershipId: v.id("workspaceMembers"),
    role: v.union(
      v.literal("owner"),
      v.literal("admin"),
      v.literal("member"),
      v.literal("viewer"),
    ),
  },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const m = await ctx.db.get(args.membershipId);
    if (!m) throw new Error("Medlemskap finnes ikke.");
    await ctx.db.patch(args.membershipId, { role: args.role });
  },
});

export const createUser = mutation({
  args: {
    firstName: v.string(),
    lastName: v.string(),
    email: v.string(),
    password: v.string(),
    age: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const email = args.email.trim().toLowerCase();
    if (!email) throw new Error("E-post kan ikke være tom.");
    if (args.password.length < 8) {
      throw new Error("Passord må være minst 8 tegn.");
    }
    const existing = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .unique();
    if (existing) throw new Error(`Bruker med e-post «${email}» finnes allerede.`);

    const fullName = [args.firstName, args.lastName].filter(Boolean).join(" ").trim() || undefined;
    const userId = await ctx.db.insert("users", { name: fullName, email });

    const hashedPassword = await new Scrypt().hash(args.password);
    await ctx.db.insert("authAccounts", {
      userId,
      provider: "password",
      providerAccountId: email,
      secret: hashedPassword,
    });

    await ctx.db.insert("userSettings", {
      userId,
      firstName: args.firstName.trim() || undefined,
      lastName: args.lastName.trim() || undefined,
      age: args.age ?? undefined,
    });

    return userId;
  },
});

export const updateUser = mutation({
  args: {
    userId: v.id("users"),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("Bruker finnes ikke.");
    const patch: Record<string, unknown> = {};
    if (args.name !== undefined) patch.name = args.name.trim() || undefined;
    if (args.email !== undefined) {
      const email = args.email.trim().toLowerCase();
      if (!email) throw new Error("E-post kan ikke være tom.");
      const dup = await ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", email))
        .unique();
      if (dup && dup._id !== args.userId) {
        throw new Error(`E-post «${email}» er allerede i bruk.`);
      }
      patch.email = email;
    }
    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(args.userId, patch);
    }
  },
});

export const createWorkspace = mutation({
  args: {
    name: v.string(),
    ownerUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const name = args.name.trim();
    if (!name) throw new Error("Navn kan ikke være tomt.");
    const owner = await ctx.db.get(args.ownerUserId);
    if (!owner) throw new Error("Eier finnes ikke.");
    const now = Date.now();
    const wid = await ctx.db.insert("workspaces", {
      name,
      ownerUserId: args.ownerUserId,
      createdAt: now,
    });
    await ctx.db.insert("workspaceMembers", {
      workspaceId: wid,
      userId: args.ownerUserId,
      role: "owner",
      joinedAt: now,
    });
    return wid;
  },
});

export const addMemberToWorkspace = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    role: v.union(
      v.literal("owner"),
      v.literal("admin"),
      v.literal("member"),
      v.literal("viewer"),
    ),
  },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const existing = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_user_workspace", (q) =>
        q.eq("userId", args.userId).eq("workspaceId", args.workspaceId),
      )
      .unique();
    if (existing) throw new Error("Brukeren er allerede medlem.");
    await ctx.db.insert("workspaceMembers", {
      workspaceId: args.workspaceId,
      userId: args.userId,
      role: args.role,
      joinedAt: Date.now(),
    });
  },
});
