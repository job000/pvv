import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import {
  getEffectivePulsBoardRole,
  getPulsBoardMembership,
  getWorkspaceMembership,
  requirePulsBoardAccess,
  requireUserId,
  requireWorkspaceMember,
  type PulsBoardRole,
} from "./lib/access";
import {
  ensureDefaultColumns,
  seedColumnsFromNames,
  seedColumnsFromTemplate,
  type ColumnTemplateId,
} from "./pulsBoardColumns";
import { ensureDefaultViews } from "./pulsBoardViews";
import { queryUsersForInviteSuggest } from "./lib/userSearch";
import { insertUserInAppNotification } from "./userInAppNotifications";

const roleValidator = v.union(
  v.literal("owner"),
  v.literal("editor"),
  v.literal("viewer"),
);

const inviteRoleValidator = v.union(v.literal("editor"), v.literal("viewer"));

function roleNb(role: PulsBoardRole) {
  if (role === "owner") return "eier";
  if (role === "editor") return "skriver";
  return "leser";
}

async function countOpenCards(
  ctx: QueryCtx | MutationCtx,
  boardId: Id<"pulsBoards">,
) {
  const tasks = await ctx.db
    .query("assessmentTasks")
    .withIndex("by_board", (q) => q.eq("boardId", boardId))
    .take(500);
  return tasks.filter((t) => t.status === "open").length;
}

async function ownerNameForBoard(
  ctx: QueryCtx | MutationCtx,
  boardId: Id<"pulsBoards">,
) {
  const members = await ctx.db
    .query("pulsBoardMembers")
    .withIndex("by_board", (q) => q.eq("boardId", boardId))
    .collect();
  const owner = members.find((m) => m.role === "owner");
  if (!owner) return null;
  const u = await ctx.db.get(owner.userId);
  return u?.name?.trim() || u?.email || null;
}

/**
 * Opprett «Hovedtavle» hvis workspace mangler tavler, og backfill boardId på kort.
 * Trygg å kalle gjentatte ganger.
 */
export async function ensureDefaultPulsBoard(
  ctx: MutationCtx,
  workspaceId: Id<"workspaces">,
  actorUserId: Id<"users">,
): Promise<Id<"pulsBoards">> {
  const existing = await ctx.db
    .query("pulsBoards")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
    .first();
  if (existing) {
    const orphanTasks = await ctx.db
      .query("assessmentTasks")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .take(500);
    for (const t of orphanTasks) {
      if (t.boardId === undefined) {
        await ctx.db.patch(t._id, { boardId: existing._id });
      }
    }
    await ensureDefaultColumns(ctx, existing);
    await ensureDefaultViews(ctx, existing, actorUserId);
    return existing._id;
  }

  const now = Date.now();
  const boardId = await ctx.db.insert("pulsBoards", {
    workspaceId,
    name: "Hovedtavle",
    description: "Standardtavle for arbeidsområdet",
    createdByUserId: actorUserId,
    createdAt: now,
    updatedAt: now,
  });

  const wsMembers = await ctx.db
    .query("workspaceMembers")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
    .collect();

  const added = new Set<Id<"users">>();
  for (const m of wsMembers) {
    if (m.role === "owner" || m.role === "admin") {
      await ctx.db.insert("pulsBoardMembers", {
        boardId,
        workspaceId,
        userId: m.userId,
        role: "owner",
        addedAt: now,
      });
      added.add(m.userId);
    }
  }
  if (!added.has(actorUserId)) {
    await ctx.db.insert("pulsBoardMembers", {
      boardId,
      workspaceId,
      userId: actorUserId,
      role: "owner",
      addedAt: now,
    });
  }

  const tasks = await ctx.db
    .query("assessmentTasks")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
    .take(500);
  for (const t of tasks) {
    if (t.boardId === undefined) {
      await ctx.db.patch(t._id, { boardId });
    }
  }

  const board = await ctx.db.get(boardId);
  if (board) {
    await ensureDefaultColumns(ctx, board);
    await ensureDefaultViews(ctx, board, actorUserId);
  }

  return boardId;
}

export const ensureDefaults = mutation({
  args: { workspaceId: v.id("workspaces") },
  returns: v.id("pulsBoards"),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireWorkspaceMember(ctx, args.workspaceId, userId, "viewer");
    return await ensureDefaultPulsBoard(ctx, args.workspaceId, userId);
  },
});

const boardSummaryValidator = v.object({
  _id: v.id("pulsBoards"),
  name: v.string(),
  description: v.optional(v.string()),
  workspaceId: v.id("workspaces"),
  myRole: roleValidator,
  ownerName: v.union(v.string(), v.null()),
  openCardCount: v.number(),
  updatedAt: v.number(),
  createdAt: v.number(),
});

export const listMineInWorkspace = query({
  args: { workspaceId: v.id("workspaces") },
  returns: v.object({
    boards: v.array(boardSummaryValidator),
    pendingInvites: v.array(
      v.object({
        inviteId: v.id("pulsBoardInvites"),
        boardId: v.id("pulsBoards"),
        boardName: v.string(),
        role: inviteRoleValidator,
        createdAt: v.number(),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return { boards: [], pendingInvites: [] };
    }
    const wm = await getWorkspaceMembership(ctx, args.workspaceId, userId);
    if (!wm) {
      return { boards: [], pendingInvites: [] };
    }

    const isWsAdmin = wm.role === "owner" || wm.role === "admin";
    const allBoards = await ctx.db
      .query("pulsBoards")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    const boards: Array<{
      _id: Id<"pulsBoards">;
      name: string;
      description?: string;
      workspaceId: Id<"workspaces">;
      myRole: PulsBoardRole;
      ownerName: string | null;
      openCardCount: number;
      updatedAt: number;
      createdAt: number;
    }> = [];

    for (const board of allBoards) {
      const role = await getEffectivePulsBoardRole(ctx, board, userId);
      if (!role && !isWsAdmin) continue;
      const myRole = role ?? ("viewer" as const);
      boards.push({
        _id: board._id,
        name: board.name,
        description: board.description,
        workspaceId: board.workspaceId,
        myRole,
        ownerName: await ownerNameForBoard(ctx, board._id),
        openCardCount: await countOpenCards(ctx, board._id),
        updatedAt: board.updatedAt,
        createdAt: board.createdAt,
      });
    }

    boards.sort((a, b) => b.updatedAt - a.updatedAt);

    const user = await ctx.db.get(userId);
    const email = user?.email?.trim().toLowerCase();
    const pendingInvites: Array<{
      inviteId: Id<"pulsBoardInvites">;
      boardId: Id<"pulsBoards">;
      boardName: string;
      role: "editor" | "viewer";
      createdAt: number;
    }> = [];
    if (email) {
      const invites = await ctx.db
        .query("pulsBoardInvites")
        .withIndex("by_email", (q) => q.eq("email", email))
        .collect();
      for (const inv of invites) {
        if (inv.workspaceId !== args.workspaceId) continue;
        const board = await ctx.db.get(inv.boardId);
        if (!board) continue;
        pendingInvites.push({
          inviteId: inv._id,
          boardId: inv.boardId,
          boardName: board.name,
          role: inv.role,
          createdAt: inv.createdAt,
        });
      }
    }

    return { boards, pendingInvites };
  },
});

export const get = query({
  args: { boardId: v.id("pulsBoards") },
  returns: v.union(
    v.object({
      _id: v.id("pulsBoards"),
      name: v.string(),
      description: v.optional(v.string()),
      workspaceId: v.id("workspaces"),
      createdByUserId: v.id("users"),
      createdAt: v.number(),
      updatedAt: v.number(),
      columnTemplate: v.optional(
        v.union(
          v.literal("priority"),
          v.literal("phases"),
          v.literal("empty"),
          v.literal("custom"),
        ),
      ),
      myRole: roleValidator,
      canEdit: v.boolean(),
      canManage: v.boolean(),
      ownerName: v.union(v.string(), v.null()),
      openCardCount: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const board = await ctx.db.get(args.boardId);
    if (!board) return null;
    const role = await getEffectivePulsBoardRole(ctx, board, userId);
    if (!role) return null;
    return {
      _id: board._id,
      name: board.name,
      description: board.description,
      workspaceId: board.workspaceId,
      createdByUserId: board.createdByUserId,
      createdAt: board.createdAt,
      updatedAt: board.updatedAt,
      columnTemplate: board.columnTemplate,
      myRole: role,
      canEdit: role === "owner" || role === "editor",
      canManage: role === "owner",
      ownerName: await ownerNameForBoard(ctx, board._id),
      openCardCount: await countOpenCards(ctx, board._id),
    };
  },
});

export const create = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.string(),
    description: v.optional(v.string()),
    /** Kolonnestruktur ved oppretting */
    columnTemplate: v.optional(
      v.union(
        v.literal("empty"),
        v.literal("priority"),
        v.literal("phases"),
      ),
    ),
    /**
     * Importerte kolonnenavn (f.eks. fra GitHub Projects statusfelt).
     * Når satt, brukes disse i stedet for columnTemplate.
     */
    columnNames: v.optional(v.array(v.string())),
  },
  returns: v.id("pulsBoards"),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireWorkspaceMember(ctx, args.workspaceId, userId, "member");
    const name = args.name.trim();
    if (!name) throw new Error("Navn mangler.");

    const importedNames = (args.columnNames ?? [])
      .map((n) => n.trim())
      .filter((n) => n.length > 0);
    const useImport = importedNames.length > 0;
    const templateId: ColumnTemplateId = args.columnTemplate ?? "priority";
    const now = Date.now();
    const boardId = await ctx.db.insert("pulsBoards", {
      workspaceId: args.workspaceId,
      name,
      description: args.description?.trim() || undefined,
      createdByUserId: userId,
      createdAt: now,
      updatedAt: now,
      columnTemplate: useImport ? "custom" : templateId,
    });
    await ctx.db.insert("pulsBoardMembers", {
      boardId,
      workspaceId: args.workspaceId,
      userId,
      role: "owner",
      addedAt: now,
    });
    const board = await ctx.db.get(boardId);
    if (board) {
      if (useImport) {
        await seedColumnsFromNames(ctx, board, importedNames);
      } else {
        await seedColumnsFromTemplate(ctx, board, templateId);
      }
      await ensureDefaultViews(ctx, board, userId);
    }
    return boardId;
  },
});

export const update = mutation({
  args: {
    boardId: v.id("pulsBoards"),
    name: v.optional(v.string()),
    description: v.optional(v.union(v.string(), v.null())),
  },
  returns: v.object({ ok: v.literal(true) }),
  handler: async (ctx, args) => {
    const { board } = await requirePulsBoardAccess(ctx, args.boardId, "owner");
    const patch: Partial<Doc<"pulsBoards">> = { updatedAt: Date.now() };
    if (args.name !== undefined) {
      const name = args.name.trim();
      if (!name) throw new Error("Navn kan ikke være tomt.");
      patch.name = name;
    }
    if (args.description !== undefined) {
      patch.description =
        args.description === null
          ? undefined
          : args.description.trim() || undefined;
    }
    await ctx.db.patch(board._id, patch);
    return { ok: true as const };
  },
});

/**
 * Slett kort og tilhørende notater/filer.
 * Berører aldri GitHub — kun Convex/Puls-data.
 */
async function deletePulsBoardTaskCascade(
  ctx: MutationCtx,
  taskId: Id<"assessmentTasks">,
) {
  const notes = await ctx.db
    .query("assessmentTaskNotes")
    .withIndex("by_task", (q) => q.eq("taskId", taskId))
    .collect();
  for (const n of notes) {
    await ctx.db.delete(n._id);
  }
  const files = await ctx.db
    .query("assessmentTaskFiles")
    .withIndex("by_task", (q) => q.eq("taskId", taskId))
    .collect();
  for (const f of files) {
    try {
      await ctx.storage.delete(f.storageId);
    } catch {
      /* storage kan allerede være borte */
    }
    await ctx.db.delete(f._id);
  }
  await ctx.db.delete(taskId);
}

/**
 * Slett tavle (eier).
 * Kun lokal Puls-data — ingen sletting/endring i GitHub Projects eller issues.
 */
export const remove = mutation({
  args: { boardId: v.id("pulsBoards") },
  returns: v.object({
    ok: v.literal(true),
    deletedCards: v.number(),
  }),
  handler: async (ctx, args) => {
    const { board } = await requirePulsBoardAccess(ctx, args.boardId, "owner");
    const siblings = await ctx.db
      .query("pulsBoards")
      .withIndex("by_workspace", (q) =>
        q.eq("workspaceId", board.workspaceId),
      )
      .collect();
    if (siblings.length <= 1) {
      throw new Error("Du kan ikke slette den siste tavlen i arbeidsområdet.");
    }

    // Slett kort på tavlen (kopier/lokale kort — GitHub urørt)
    let deletedCards = 0;
    for (;;) {
      const batch = await ctx.db
        .query("assessmentTasks")
        .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
        .take(40);
      if (batch.length === 0) break;
      for (const t of batch) {
        await deletePulsBoardTaskCascade(ctx, t._id);
        deletedCards += 1;
      }
      if (deletedCards > 2_000) {
        throw new Error(
          "Tavlen har for mange kort til å slettes i ett steg. Slett noen kort manuelt og prøv igjen.",
        );
      }
    }

    const members = await ctx.db
      .query("pulsBoardMembers")
      .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
      .collect();
    for (const m of members) {
      const pref = await ctx.db
        .query("pulsBoardUserPrefs")
        .withIndex("by_user_board", (q) =>
          q.eq("userId", m.userId).eq("boardId", args.boardId),
        )
        .unique();
      if (pref) await ctx.db.delete(pref._id);
      await ctx.db.delete(m._id);
    }

    const invites = await ctx.db
      .query("pulsBoardInvites")
      .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
      .collect();
    for (const inv of invites) await ctx.db.delete(inv._id);

    const cols = await ctx.db
      .query("pulsBoardColumns")
      .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
      .collect();
    for (const c of cols) await ctx.db.delete(c._id);

    const views = await ctx.db
      .query("pulsBoardViews")
      .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
      .collect();
    for (const view of views) await ctx.db.delete(view._id);

    await ctx.db.delete(args.boardId);
    return { ok: true as const, deletedCards };
  },
});

export const listMembers = query({
  args: { boardId: v.id("pulsBoards") },
  returns: v.array(
    v.object({
      membershipId: v.id("pulsBoardMembers"),
      userId: v.id("users"),
      role: roleValidator,
      name: v.string(),
      email: v.union(v.string(), v.null()),
      addedAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const board = await ctx.db.get(args.boardId);
    if (!board) return [];
    const role = await getEffectivePulsBoardRole(ctx, board, userId);
    if (!role) return [];

    const members = await ctx.db
      .query("pulsBoardMembers")
      .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
      .collect();
    const out = [];
    for (const m of members) {
      const u = await ctx.db.get(m.userId);
      out.push({
        membershipId: m._id,
        userId: m.userId,
        role: m.role,
        name: u?.name?.trim() || u?.email || "Medlem",
        email: u?.email ?? null,
        addedAt: m.addedAt,
      });
    }
    out.sort((a, b) => {
      const rank = { owner: 0, editor: 1, viewer: 2 } as const;
      if (rank[a.role] !== rank[b.role]) return rank[a.role] - rank[b.role];
      return a.name.localeCompare(b.name, "nb");
    });
    return out;
  },
});

export const listPendingInvites = query({
  args: { boardId: v.id("pulsBoards") },
  returns: v.array(
    v.object({
      inviteId: v.id("pulsBoardInvites"),
      email: v.string(),
      role: inviteRoleValidator,
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    try {
      await requirePulsBoardAccess(ctx, args.boardId, "owner");
    } catch {
      return [];
    }
    const invites = await ctx.db
      .query("pulsBoardInvites")
      .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
      .collect();
    return invites.map((inv) => ({
      inviteId: inv._id,
      email: inv.email,
      role: inv.role,
      createdAt: inv.createdAt,
    }));
  },
});

export const setMemberRole = mutation({
  args: {
    boardId: v.id("pulsBoards"),
    userId: v.id("users"),
    role: roleValidator,
  },
  returns: v.object({ ok: v.literal(true) }),
  handler: async (ctx, args) => {
    await requirePulsBoardAccess(ctx, args.boardId, "owner");
    const membership = await getPulsBoardMembership(
      ctx,
      args.boardId,
      args.userId,
    );
    if (!membership) throw new Error("Medlemmet finnes ikke på tavlen.");

    if (membership.role === "owner" && args.role !== "owner") {
      const members = await ctx.db
        .query("pulsBoardMembers")
        .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
        .collect();
      const owners = members.filter((m) => m.role === "owner");
      if (owners.length <= 1) {
        throw new Error("Tavlen må ha minst én eier.");
      }
    }

    await ctx.db.patch(membership._id, { role: args.role });
    await ctx.db.patch(args.boardId, { updatedAt: Date.now() });
    return { ok: true as const };
  },
});

export const removeMember = mutation({
  args: {
    boardId: v.id("pulsBoards"),
    userId: v.id("users"),
  },
  returns: v.object({ ok: v.literal(true) }),
  handler: async (ctx, args) => {
    const { userId: actorId } = await requirePulsBoardAccess(
      ctx,
      args.boardId,
      "owner",
    );
    const membership = await getPulsBoardMembership(
      ctx,
      args.boardId,
      args.userId,
    );
    if (!membership) return { ok: true as const };

    if (membership.role === "owner") {
      const members = await ctx.db
        .query("pulsBoardMembers")
        .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
        .collect();
      if (members.filter((m) => m.role === "owner").length <= 1) {
        throw new Error("Du kan ikke fjerne den siste eieren.");
      }
    }

    await ctx.db.delete(membership._id);
    if (args.userId !== actorId) {
      const board = await ctx.db.get(args.boardId);
      if (board) {
        await insertUserInAppNotification(ctx, {
          userId: args.userId,
          title: `Fjernet fra tavlen «${board.name}»`,
          body: "Du har ikke lenger tilgang til denne tavlen.",
          href: `/w/${board.workspaceId}/tavler`,
        });
      }
    }
    return { ok: true as const };
  },
});

export const suggestUsersForBoardInvite = query({
  args: {
    boardId: v.id("pulsBoards"),
    prefix: v.string(),
  },
  returns: v.array(
    v.object({
      email: v.string(),
      name: v.union(v.string(), v.null()),
      alreadyMember: v.boolean(),
    }),
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    let board: Doc<"pulsBoards">;
    try {
      ({ board } = await requirePulsBoardAccess(ctx, args.boardId, "owner"));
    } catch {
      return [];
    }
    const raw = args.prefix.trim().toLowerCase();
    if (raw.length < 2) return [];

    const rows = await queryUsersForInviteSuggest(ctx, {
      query: raw,
      workspaceId: board.workspaceId,
      take: 24,
    });
    const members = await ctx.db
      .query("pulsBoardMembers")
      .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
      .collect();
    const memberIds = new Set(members.map((m) => m.userId));

    const out: Array<{
      email: string;
      name: string | null;
      alreadyMember: boolean;
    }> = [];
    for (const u of rows) {
      if (!u.email) continue;
      out.push({
        email: u.email,
        name: u.name?.trim() || null,
        alreadyMember: memberIds.has(u._id),
      });
      if (out.length >= 12) break;
    }
    out.sort((a, b) => {
      if (a.alreadyMember !== b.alreadyMember) {
        return a.alreadyMember ? 1 : -1;
      }
      const an = (a.name || a.email).toLowerCase();
      const bn = (b.name || b.email).toLowerCase();
      return an.localeCompare(bn, "nb");
    });
    return out;
  },
});

export const inviteByEmail = mutation({
  args: {
    boardId: v.id("pulsBoards"),
    email: v.string(),
    role: inviteRoleValidator,
  },
  returns: v.object({
    kind: v.union(
      v.literal("linked"),
      v.literal("updated"),
      v.literal("already"),
      v.literal("pending"),
    ),
  }),
  handler: async (ctx, args) => {
    const { board, userId } = await requirePulsBoardAccess(
      ctx,
      args.boardId,
      "owner",
    );
    const email = args.email.trim().toLowerCase();
    if (!email) throw new Error("E-post mangler.");

    const foundUser = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .unique();

    if (foundUser) {
      const existing = await getPulsBoardMembership(
        ctx,
        args.boardId,
        foundUser._id,
      );
      if (!existing) {
        const wm = await getWorkspaceMembership(
          ctx,
          board.workspaceId,
          foundUser._id,
        );
        if (!wm) {
          await ctx.db.insert("workspaceMembers", {
            workspaceId: board.workspaceId,
            userId: foundUser._id,
            role: "viewer",
            joinedAt: Date.now(),
          });
        }
        await ctx.db.insert("pulsBoardMembers", {
          boardId: args.boardId,
          workspaceId: board.workspaceId,
          userId: foundUser._id,
          role: args.role,
          addedAt: Date.now(),
        });
        await insertUserInAppNotification(ctx, {
          userId: foundUser._id,
          title: `Du er lagt til på tavlen «${board.name}»`,
          body: `Rolle: ${roleNb(args.role)}.`,
          href: `/w/${board.workspaceId}/tavler/${args.boardId}`,
        });
        await ctx.db.patch(args.boardId, { updatedAt: Date.now() });
        return { kind: "linked" as const };
      }
      if (existing.role === "owner") {
        return { kind: "already" as const };
      }
      if (existing.role !== args.role) {
        await ctx.db.patch(existing._id, { role: args.role });
        return { kind: "updated" as const };
      }
      return { kind: "already" as const };
    }

    const existingInvite = await ctx.db
      .query("pulsBoardInvites")
      .withIndex("by_email", (q) => q.eq("email", email))
      .collect();
    const forBoard = existingInvite.find((i) => i.boardId === args.boardId);
    if (forBoard) {
      if (forBoard.role !== args.role) {
        await ctx.db.patch(forBoard._id, { role: args.role });
        return { kind: "updated" as const };
      }
      return { kind: "already" as const };
    }

    const token = `pinv_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    await ctx.db.insert("pulsBoardInvites", {
      boardId: args.boardId,
      workspaceId: board.workspaceId,
      email,
      role: args.role,
      token,
      invitedByUserId: userId,
      createdAt: Date.now(),
    });
    return { kind: "pending" as const };
  },
});

export const acceptInvite = mutation({
  args: { inviteId: v.id("pulsBoardInvites") },
  returns: v.object({
    boardId: v.id("pulsBoards"),
    workspaceId: v.id("workspaces"),
  }),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const user = await ctx.db.get(userId);
    const email = user?.email?.trim().toLowerCase();
    if (!email) throw new Error("Kontoen mangler e-post.");

    const inv = await ctx.db.get(args.inviteId);
    if (!inv || inv.email !== email) {
      throw new Error("Invitasjonen finnes ikke.");
    }
    const board = await ctx.db.get(inv.boardId);
    if (!board) {
      await ctx.db.delete(inv._id);
      throw new Error("Tavlen finnes ikke lenger.");
    }

    const wm = await getWorkspaceMembership(ctx, board.workspaceId, userId);
    if (!wm) {
      await ctx.db.insert("workspaceMembers", {
        workspaceId: board.workspaceId,
        userId,
        role: "viewer",
        joinedAt: Date.now(),
      });
    }

    const existing = await getPulsBoardMembership(ctx, inv.boardId, userId);
    if (!existing) {
      await ctx.db.insert("pulsBoardMembers", {
        boardId: inv.boardId,
        workspaceId: board.workspaceId,
        userId,
        role: inv.role,
        addedAt: Date.now(),
      });
    }

    await ctx.db.delete(inv._id);
    return { boardId: inv.boardId, workspaceId: board.workspaceId };
  },
});

export const acceptInvitesForEmail = mutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const user = await ctx.db.get(userId);
    const email = user?.email?.trim().toLowerCase();
    if (!email) return 0;

    const invites = await ctx.db
      .query("pulsBoardInvites")
      .withIndex("by_email", (q) => q.eq("email", email))
      .collect();
    let n = 0;
    for (const inv of invites) {
      const board = await ctx.db.get(inv.boardId);
      if (!board) {
        await ctx.db.delete(inv._id);
        continue;
      }
      const wm = await getWorkspaceMembership(ctx, board.workspaceId, userId);
      if (!wm) {
        await ctx.db.insert("workspaceMembers", {
          workspaceId: board.workspaceId,
          userId,
          role: "viewer",
          joinedAt: Date.now(),
        });
      }
      const existing = await getPulsBoardMembership(ctx, inv.boardId, userId);
      if (!existing) {
        await ctx.db.insert("pulsBoardMembers", {
          boardId: inv.boardId,
          workspaceId: board.workspaceId,
          userId,
          role: inv.role,
          addedAt: Date.now(),
        });
      }
      await ctx.db.delete(inv._id);
      n += 1;
    }
    return n;
  },
});

export const revokeInvite = mutation({
  args: { inviteId: v.id("pulsBoardInvites") },
  returns: v.object({ ok: v.literal(true) }),
  handler: async (ctx, args) => {
    const inv = await ctx.db.get(args.inviteId);
    if (!inv) return { ok: true as const };
    await requirePulsBoardAccess(ctx, inv.boardId, "owner");
    await ctx.db.delete(args.inviteId);
    return { ok: true as const };
  },
});
