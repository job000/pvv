import { v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Doc, Id } from "./_generated/dataModel";
import {
  requireUserId,
  requireWorkspaceMember,
} from "./lib/access";

const kindValidator = v.union(
  v.literal("helseforetak"),
  v.literal("avdeling"),
  v.literal("seksjon"),
);

function assertValidHierarchy(
  kind: "helseforetak" | "avdeling" | "seksjon",
  parent: Doc<"orgUnits"> | null,
) {
  if (!parent) {
    if (kind !== "helseforetak") {
      throw new Error(
        "Kun helseforetak kan ligge øverst (uten overordnet enhet).",
      );
    }
    return;
  }
  if (parent.kind === "helseforetak" && kind !== "avdeling") {
    throw new Error("Under helseforetak kan det bare opprettes avdelinger.");
  }
  if (parent.kind === "avdeling" && kind !== "seksjon") {
    throw new Error("Under avdeling kan det bare opprettes seksjoner.");
  }
  if (parent.kind === "seksjon") {
    throw new Error("Seksjon kan ikke ha underenheter i dette hierarkiet.");
  }
}

export const listByWorkspace = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }
    await requireWorkspaceMember(ctx, args.workspaceId, userId, "viewer");
    const rows = await ctx.db
      .query("orgUnits")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    return rows.sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) {
        return a.sortOrder - b.sortOrder;
      }
      return a.name.localeCompare(b.name, "nb");
    });
  },
});

export const getBreadcrumb = query({
  args: { orgUnitId: v.id("orgUnits") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }
    const unit = await ctx.db.get(args.orgUnitId);
    if (!unit) {
      return null;
    }
    await requireWorkspaceMember(ctx, unit.workspaceId, userId, "viewer");
    const chain: Doc<"orgUnits">[] = [];
    let cur: Doc<"orgUnits"> | null = unit;
    const guard = new Set<string>();
    while (cur && !guard.has(cur._id)) {
      guard.add(cur._id);
      chain.unshift(cur);
      if (!cur.parentId) {
        break;
      }
      cur = await ctx.db.get(cur.parentId);
    }
    return { workspaceId: unit.workspaceId, chain };
  },
});

export const listContactsByWorkspace = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }
    await requireWorkspaceMember(ctx, args.workspaceId, userId, "viewer");
    const rows = await ctx.db
      .query("orgUnitContacts")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    return rows.sort((a, b) => {
      if (a.orgUnitId !== b.orgUnitId) {
        return String(a.orgUnitId).localeCompare(String(b.orgUnitId));
      }
      if (a.sortOrder !== b.sortOrder) {
        return a.sortOrder - b.sortOrder;
      }
      return a.name.localeCompare(b.name, "nb");
    });
  },
});

export const create = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    parentId: v.union(v.id("orgUnits"), v.null()),
    kind: kindValidator,
    name: v.string(),
    shortName: v.optional(v.string()),
    extraInfo: v.optional(v.string()),
    localCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireWorkspaceMember(ctx, args.workspaceId, userId, "member");
    const name = args.name.trim();
    if (!name) {
      throw new Error("Navn er påkrevd.");
    }
    let parent: Doc<"orgUnits"> | null = null;
    if (args.parentId !== null) {
      parent = await ctx.db.get(args.parentId);
      if (!parent || parent.workspaceId !== args.workspaceId) {
        throw new Error("Ugyldig overordnet enhet.");
      }
    }
    assertValidHierarchy(args.kind, parent);
    const rows = await ctx.db
      .query("orgUnits")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    const sortOrder =
      rows.length === 0
        ? 0
        : Math.max(...rows.map((r) => r.sortOrder)) + 1;
    const now = Date.now();
    return await ctx.db.insert("orgUnits", {
      workspaceId: args.workspaceId,
      parentId: args.parentId === null ? undefined : args.parentId,
      kind: args.kind,
      name,
      shortName: args.shortName?.trim() || undefined,
      sortOrder,
      extraInfo: args.extraInfo?.trim() || undefined,
      localCode: args.localCode?.trim() || undefined,
      createdByUserId: userId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

async function nextContactSortOrder(
  ctx: MutationCtx,
  orgUnitId: Id<"orgUnits">,
): Promise<number> {
  const existing = await ctx.db
    .query("orgUnitContacts")
    .withIndex("by_org_unit", (q) => q.eq("orgUnitId", orgUnitId))
    .collect();
  if (existing.length === 0) {
    return 0;
  }
  return Math.max(...existing.map((r) => r.sortOrder)) + 1;
}

export const addContact = mutation({
  args: {
    orgUnitId: v.id("orgUnits"),
    name: v.string(),
    title: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const unit = await ctx.db.get(args.orgUnitId);
    if (!unit) {
      throw new Error("Enheten finnes ikke.");
    }
    await requireWorkspaceMember(ctx, unit.workspaceId, userId, "member");
    const name = args.name.trim();
    if (!name) {
      throw new Error("Navn er påkrevd.");
    }
    const now = Date.now();
    const sortOrder = await nextContactSortOrder(ctx, args.orgUnitId);
    return await ctx.db.insert("orgUnitContacts", {
      workspaceId: unit.workspaceId,
      orgUnitId: args.orgUnitId,
      name,
      title: args.title?.trim() || undefined,
      email: args.email?.trim() || undefined,
      phone: args.phone?.trim() || undefined,
      notes: args.notes?.trim() || undefined,
      sortOrder,
      createdByUserId: userId,
      createdAt: now,
    });
  },
});

export const updateContact = mutation({
  args: {
    contactId: v.id("orgUnitContacts"),
    name: v.optional(v.string()),
    title: v.optional(v.union(v.string(), v.null())),
    email: v.optional(v.union(v.string(), v.null())),
    phone: v.optional(v.union(v.string(), v.null())),
    notes: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const row = await ctx.db.get(args.contactId);
    if (!row) {
      throw new Error("Kontakten finnes ikke.");
    }
    await requireWorkspaceMember(ctx, row.workspaceId, userId, "member");
    const patch: {
      name?: string;
      title?: string;
      email?: string;
      phone?: string;
      notes?: string;
    } = {};
    if (args.name !== undefined) {
      const n = args.name.trim();
      if (!n) {
        throw new Error("Navn kan ikke være tomt.");
      }
      patch.name = n;
    }
    const opt = (v: string | null | undefined) =>
      v === null || v === undefined ? undefined : v.trim() || undefined;
    if (args.title !== undefined) {
      patch.title = opt(args.title);
    }
    if (args.email !== undefined) {
      patch.email = opt(args.email);
    }
    if (args.phone !== undefined) {
      patch.phone = opt(args.phone);
    }
    if (args.notes !== undefined) {
      patch.notes = opt(args.notes);
    }
    await ctx.db.patch(args.contactId, patch);
    return null;
  },
});

export const removeContact = mutation({
  args: { contactId: v.id("orgUnitContacts") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const row = await ctx.db.get(args.contactId);
    if (!row) {
      throw new Error("Kontakten finnes ikke.");
    }
    await requireWorkspaceMember(ctx, row.workspaceId, userId, "member");
    await ctx.db.delete(args.contactId);
    return null;
  },
});

/** Flytt gammel enkelt-kontakt fra orgUnit-felt til egen rad (valgfritt opprydding). */
export const importLegacyContact = mutation({
  args: { orgUnitId: v.id("orgUnits") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const unit = await ctx.db.get(args.orgUnitId);
    if (!unit) {
      throw new Error("Enheten finnes ikke.");
    }
    await requireWorkspaceMember(ctx, unit.workspaceId, userId, "member");
    const hasLegacy = !!(
      unit.merkantilContactName ||
      unit.merkantilContactEmail ||
      unit.merkantilContactPhone
    );
    if (!hasLegacy) {
      throw new Error("Ingen gammel kontakt å importere.");
    }
    const existing = await ctx.db
      .query("orgUnitContacts")
      .withIndex("by_org_unit", (q) => q.eq("orgUnitId", args.orgUnitId))
      .collect();
    if (existing.length > 0) {
      throw new Error("Enheten har allerede kontakter i listen.");
    }
    const now = Date.now();
    await ctx.db.insert("orgUnitContacts", {
      workspaceId: unit.workspaceId,
      orgUnitId: args.orgUnitId,
      name: unit.merkantilContactName?.trim() || "Merkantil",
      title: unit.merkantilContactTitle?.trim() || undefined,
      email: unit.merkantilContactEmail?.trim() || undefined,
      phone: unit.merkantilContactPhone?.trim() || undefined,
      sortOrder: 0,
      createdByUserId: userId,
      createdAt: now,
    });
    await ctx.db.patch(args.orgUnitId, {
      merkantilContactName: undefined,
      merkantilContactEmail: undefined,
      merkantilContactPhone: undefined,
      merkantilContactTitle: undefined,
      updatedAt: now,
    });
    return null;
  },
});

export const update = mutation({
  args: {
    orgUnitId: v.id("orgUnits"),
    name: v.optional(v.string()),
    shortName: v.optional(v.union(v.string(), v.null())),
    merkantilContactName: v.optional(v.union(v.string(), v.null())),
    merkantilContactEmail: v.optional(v.union(v.string(), v.null())),
    merkantilContactPhone: v.optional(v.union(v.string(), v.null())),
    merkantilContactTitle: v.optional(v.union(v.string(), v.null())),
    extraInfo: v.optional(v.union(v.string(), v.null())),
    localCode: v.optional(v.union(v.string(), v.null())),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const row = await ctx.db.get(args.orgUnitId);
    if (!row) {
      throw new Error("Enheten finnes ikke.");
    }
    await requireWorkspaceMember(ctx, row.workspaceId, userId, "member");
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.name !== undefined) {
      const n = args.name.trim();
      if (!n) {
        throw new Error("Navn kan ikke være tomt.");
      }
      patch.name = n;
    }
    const clear = (key: string, val: string | null | undefined) => {
      if (val === null || val === undefined) {
        patch[key] = undefined;
      } else {
        patch[key] = val.trim() || undefined;
      }
    };
    if (args.shortName !== undefined) {
      clear("shortName", args.shortName);
    }
    if (args.merkantilContactName !== undefined) {
      clear("merkantilContactName", args.merkantilContactName);
    }
    if (args.merkantilContactEmail !== undefined) {
      clear("merkantilContactEmail", args.merkantilContactEmail);
    }
    if (args.merkantilContactPhone !== undefined) {
      clear("merkantilContactPhone", args.merkantilContactPhone);
    }
    if (args.merkantilContactTitle !== undefined) {
      clear("merkantilContactTitle", args.merkantilContactTitle);
    }
    if (args.extraInfo !== undefined) {
      clear("extraInfo", args.extraInfo);
    }
    if (args.localCode !== undefined) {
      clear("localCode", args.localCode);
    }
    if (args.sortOrder !== undefined) {
      patch.sortOrder = args.sortOrder;
    }
    await ctx.db.patch(args.orgUnitId, patch as Partial<Doc<"orgUnits">>);
    return null;
  },
});

export const remove = mutation({
  args: { orgUnitId: v.id("orgUnits") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const row = await ctx.db.get(args.orgUnitId);
    if (!row) {
      throw new Error("Enheten finnes ikke.");
    }
    await requireWorkspaceMember(ctx, row.workspaceId, userId, "admin");
    const contacts = await ctx.db
      .query("orgUnitContacts")
      .withIndex("by_org_unit", (q) => q.eq("orgUnitId", args.orgUnitId))
      .collect();
    for (const c of contacts) {
      await ctx.db.delete(c._id);
    }
    const children = await ctx.db
      .query("orgUnits")
      .withIndex("by_parent", (q) => q.eq("parentId", args.orgUnitId))
      .collect();
    if (children.length > 0) {
      throw new Error("Fjern eller flytt underenheter først.");
    }
    const assessments = await ctx.db
      .query("assessments")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", row.workspaceId))
      .collect();
    if (assessments.some((a) => a.orgUnitId === args.orgUnitId)) {
      throw new Error("Enheten er knyttet til vurderinger.");
    }
    const candidates = await ctx.db
      .query("candidates")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", row.workspaceId))
      .collect();
    if (candidates.some((c) => c.orgUnitId === args.orgUnitId)) {
      throw new Error("Enheten er knyttet til kandidater.");
    }
    await ctx.db.delete(args.orgUnitId);
    return null;
  },
});
