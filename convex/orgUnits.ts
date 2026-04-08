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
        "Kun øverste nivå (selskap/konsern) kan opprettes uten overordnet enhet.",
      );
    }
    return;
  }
  if (parent.kind === "helseforetak" && kind !== "avdeling") {
    throw new Error(
      "Under hovedselskap kan det bare opprettes avdelinger eller forretningsenheter.",
    );
  }
  if (parent.kind === "avdeling" && kind !== "seksjon") {
    throw new Error(
      "Under avdeling kan det bare opprettes team, grupper eller seksjoner.",
    );
  }
  if (parent.kind === "seksjon") {
    throw new Error(
      "Laveste nivå (team/gruppe) kan ikke ha underenheter i dette hierarkiet.",
    );
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
    const rosAnalyses = await ctx.db
      .query("rosAnalyses")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", row.workspaceId))
      .collect();
    if (rosAnalyses.some((r) => r.orgUnitId === args.orgUnitId)) {
      throw new Error(
        "Enheten er knyttet til ROS-analyser. Fjern eller endre koblingen i ROS først.",
      );
    }
    const intakeFormsForWs = await ctx.db
      .query("intakeForms")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", row.workspaceId))
      .collect();
    if (intakeFormsForWs.some((f) => f.orgUnitId === args.orgUnitId)) {
      throw new Error(
        "Enheten er knyttet til inntaksskjema. Fjern eller endre koblingen under Skjemaer først.",
      );
    }
    await ctx.db.delete(args.orgUnitId);
    return null;
  },
});

/**
 * Aggregerer aktivitet per org.-enhet (inkl. underenheter):
 * prosesser (kandidater), ROS-analyser, PVV-vurderinger, godkjente inntak (inntak → vurdering),
 * og inntaksskjema med direkte org.-kobling.
 */
export type OrgUnitRosRollup = {
  candidateCount: number;
  analysisCount: number;
  maxBefore: number;
  maxAfter: number;
  /** PVV-vurderinger med org.-enhet i under-treet */
  assessmentCount: number;
  /** Godkjente inntak der tilknyttet vurdering har org.-enhet i under-treet */
  intakeSubmissionCount: number;
  /** Inntaksskjema direkte knyttet til enhet i under-treet */
  intakeFormCount: number;
};

function maxMatrixValues(m: number[][] | undefined): number {
  if (!m?.length) return 0;
  let x = 0;
  for (const row of m) {
    for (const v of row ?? []) {
      if (v > x) x = v;
    }
  }
  return x;
}

function maxAfterLevel(a: Doc<"rosAnalyses">): number {
  const m = a.matrixValuesAfter;
  if (m && m.length > 0) return maxMatrixValues(m);
  return 0;
}

export const rosRollupByOrgUnit = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }
    await requireWorkspaceMember(ctx, args.workspaceId, userId, "viewer");

    const orgUnits = await ctx.db
      .query("orgUnits")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    const candidates = await ctx.db
      .query("candidates")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    const assessments = await ctx.db
      .query("assessments")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    const intakeForms = await ctx.db
      .query("intakeForms")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    const intakeSubmissions = await ctx.db
      .query("intakeSubmissions")
      .withIndex("by_workspace_and_submitted_at", (q) =>
        q.eq("workspaceId", args.workspaceId),
      )
      .collect();

    const approvedAssessmentIds = new Set<Id<"assessments">>();
    for (const s of intakeSubmissions) {
      if (s.approvedAssessmentId) {
        approvedAssessmentIds.add(s.approvedAssessmentId);
      }
    }
    const assessmentById = new Map<Id<"assessments">, Doc<"assessments">>();
    for (const aid of approvedAssessmentIds) {
      const a = await ctx.db.get(aid);
      if (a && a.workspaceId === args.workspaceId) {
        assessmentById.set(aid, a);
      }
    }

    /** Direkte antall vurderinger per org.-enhet (kun egen enhet, ikke subtre ennå). */
    const directAssessmentCount = new Map<Id<"orgUnits">, number>();
    for (const a of assessments) {
      if (!a.orgUnitId) continue;
      const k = a.orgUnitId;
      directAssessmentCount.set(k, (directAssessmentCount.get(k) ?? 0) + 1);
    }

    /** Godkjente inntak per org.-enhet (via vurderingens orgUnitId). */
    const directIntakeSubmissionCount = new Map<Id<"orgUnits">, number>();
    for (const s of intakeSubmissions) {
      if (!s.approvedAssessmentId) continue;
      const a = assessmentById.get(s.approvedAssessmentId);
      if (!a?.orgUnitId) continue;
      const k = a.orgUnitId;
      directIntakeSubmissionCount.set(
        k,
        (directIntakeSubmissionCount.get(k) ?? 0) + 1,
      );
    }

    /** Inntaksskjema direkte merket med org.-enhet. */
    const directIntakeFormCount = new Map<Id<"orgUnits">, number>();
    for (const f of intakeForms) {
      if (!f.orgUnitId) continue;
      const k = f.orgUnitId;
      directIntakeFormCount.set(k, (directIntakeFormCount.get(k) ?? 0) + 1);
    }

    const rosRows = await ctx.db
      .query("rosAnalyses")
      .withIndex("by_workspace_updated", (q) =>
        q.eq("workspaceId", args.workspaceId),
      )
      .collect();

    const candidateById = new Map<Id<"candidates">, Doc<"candidates">>();
    for (const c of candidates) {
      candidateById.set(c._id, c);
    }

    /** Prosess sin enhet, ellers direkte kobling på ROS-analysen. */
    function effectiveOrgForRos(
      r: Doc<"rosAnalyses">,
    ): Id<"orgUnits"> | undefined {
      if (r.candidateId) {
        const c = candidateById.get(r.candidateId);
        return c?.orgUnitId ?? r.orgUnitId;
      }
      return r.orgUnitId;
    }

    const childrenById = new Map<Id<"orgUnits">, Id<"orgUnits">[]>();
    for (const u of orgUnits) {
      childrenById.set(u._id, []);
    }
    for (const u of orgUnits) {
      if (u.parentId) {
        if (!childrenById.has(u.parentId)) {
          childrenById.set(u.parentId, []);
        }
        childrenById.get(u.parentId)!.push(u._id);
      }
    }

    function subtreeIds(root: Id<"orgUnits">): Set<Id<"orgUnits">> {
      const s = new Set<Id<"orgUnits">>();
      const q: Id<"orgUnits">[] = [root];
      while (q.length) {
        const id = q.shift()!;
        s.add(id);
        for (const ch of childrenById.get(id) ?? []) {
          q.push(ch);
        }
      }
      return s;
    }

    function rollupForSubtree(sub: Set<Id<"orgUnits">>): OrgUnitRosRollup {
      let candidateCount = 0;
      for (const c of candidates) {
        if (!c.orgUnitId || !sub.has(c.orgUnitId)) continue;
        candidateCount++;
      }
      let analysisCount = 0;
      let maxBefore = 0;
      let maxAfter = 0;
      for (const r of rosRows) {
        const eo = effectiveOrgForRos(r);
        if (!eo || !sub.has(eo)) continue;
        analysisCount++;
        maxBefore = Math.max(maxBefore, maxMatrixValues(r.matrixValues));
        maxAfter = Math.max(maxAfter, maxAfterLevel(r));
      }
      let assessmentCount = 0;
      for (const [oid, n] of directAssessmentCount) {
        if (sub.has(oid)) assessmentCount += n;
      }
      let intakeSubmissionCount = 0;
      for (const [oid, n] of directIntakeSubmissionCount) {
        if (sub.has(oid)) intakeSubmissionCount += n;
      }
      let intakeFormCount = 0;
      for (const [oid, n] of directIntakeFormCount) {
        if (sub.has(oid)) intakeFormCount += n;
      }
      return {
        candidateCount,
        analysisCount,
        maxBefore,
        maxAfter,
        assessmentCount,
        intakeSubmissionCount,
        intakeFormCount,
      };
    }

    const byOrgUnitId: Record<string, OrgUnitRosRollup> = {};
    for (const u of orgUnits) {
      const sub = subtreeIds(u._id);
      byOrgUnitId[u._id] = rollupForSubtree(sub);
    }

    let unCand = 0;
    for (const c of candidates) {
      if (c.orgUnitId) continue;
      unCand++;
    }
    let unAnalysis = 0;
    let unMaxB = 0;
    let unMaxA = 0;
    for (const r of rosRows) {
      if (effectiveOrgForRos(r) !== undefined) continue;
      unAnalysis++;
      unMaxB = Math.max(unMaxB, maxMatrixValues(r.matrixValues));
      unMaxA = Math.max(unMaxA, maxAfterLevel(r));
    }
    let unAssess = 0;
    for (const a of assessments) {
      if (!a.orgUnitId) unAssess++;
    }
    let unIntake = 0;
    for (const s of intakeSubmissions) {
      if (!s.approvedAssessmentId) {
        unIntake++;
        continue;
      }
      const a = assessmentById.get(s.approvedAssessmentId);
      if (!a?.orgUnitId) unIntake++;
    }
    let unIntakeForm = 0;
    for (const f of intakeForms) {
      if (!f.orgUnitId) unIntakeForm++;
    }
    const unassigned: OrgUnitRosRollup = {
      candidateCount: unCand,
      analysisCount: unAnalysis,
      maxBefore: unMaxB,
      maxAfter: unMaxA,
      assessmentCount: unAssess,
      intakeSubmissionCount: unIntake,
      intakeFormCount: unIntakeForm,
    };

    return { byOrgUnitId, unassigned };
  },
});
