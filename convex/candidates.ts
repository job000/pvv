import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
} from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Doc, Id } from "./_generated/dataModel";
import {
  canReadAssessment,
  requireUserId,
  requireWorkspaceMember,
} from "./lib/access";
import {
  extractPvvSyncedFieldsFromGithubIssueBody,
  hasPvvSyncMarkersInBody,
} from "./lib/githubCandidateSync";
import { normalizeGithubRepoFullName } from "./lib/github";
import {
  cascadeDeleteAssessmentData,
  cascadeDeleteRosAnalysisData,
} from "./lib/cascadeDeletePvv";
import {
  assertGithubIssueNotIntakeLinked,
  assertGithubProjectItemNotIntakeLinked,
  loadIntakeGithubOccupiedRefs,
} from "./lib/intakeGithubOccupiedRefs";
import { payloadToSnapshot } from "./lib/payloadSnapshot";
import { computeAllResults } from "./lib/rpaScoring";

function normalizeProcessCode(raw: string): string {
  return raw.trim().toUpperCase();
}

/** Utkast kan lagre enten prosesskode (P-XXX) eller Convex kandidat-ID. */
function draftPayloadMatchesCandidate(
  payload: { candidateId?: string } | undefined,
  candidate: Doc<"candidates">,
): boolean {
  const raw = (payload?.candidateId ?? "").trim();
  if (!raw) return false;
  if (raw === String(candidate._id)) return true;
  return normalizeProcessCode(raw) === normalizeProcessCode(candidate.code);
}

async function collectAssessmentIdsLinkedToCandidate(
  ctx: MutationCtx,
  candidate: Doc<"candidates">,
): Promise<Id<"assessments">[]> {
  const assessments = await ctx.db
    .query("assessments")
    .withIndex("by_workspace", (q) =>
      q.eq("workspaceId", candidate.workspaceId),
    )
    .collect();
  const out: Id<"assessments">[] = [];
  for (const a of assessments) {
    const draft = await ctx.db
      .query("assessmentDrafts")
      .withIndex("by_assessment", (q) => q.eq("assessmentId", a._id))
      .unique();
    if (!draft) continue;
    const payload = draft.payload as { candidateId?: string };
    if (draftPayloadMatchesCandidate(payload, candidate)) {
      out.push(a._id);
    }
  }
  return out;
}

export type PvvAssessmentResultSummary = {
  /** Fra siste utkast — samme modell som i PVV */
  ap: number;
  criticality: number;
  priorityScore: number;
  feasible: boolean;
  ease: number;
  easeLabel: string;
  hoursY: number;
  fte: number;
  costY: number;
  benH: number;
  benC: number;
  benFte: number;
};

export const getCandidateForGithub = internalQuery({
  args: { candidateId: v.id("candidates") },
  handler: async (ctx, args) => {
    const candidate = await ctx.db.get(args.candidateId);
    if (!candidate) {
      return null;
    }
    const workspace = await ctx.db.get(candidate.workspaceId);
    return { candidate, workspace };
  },
});

export const assertMemberForWorkspace = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await requireWorkspaceMember(ctx, args.workspaceId, args.userId, "member");
    return true;
  },
});

/** Data til rik Markdown for GitHub-prosjekt-utkast (PVV + ROS + notater). */
export const getCandidateGithubSyncContext = internalQuery({
  args: { candidateId: v.id("candidates") },
  handler: async (ctx, args) => {
    const candidate = await ctx.db.get(args.candidateId);
    if (!candidate) {
      return null;
    }
    const workspace = await ctx.db.get(candidate.workspaceId);
    if (!workspace) {
      return null;
    }
    let orgUnitName: string | null = null;
    if (candidate.orgUnitId) {
      const ou = await ctx.db.get(candidate.orgUnitId);
      orgUnitName = ou?.name ?? null;
    }
    const assessments = await ctx.db
      .query("assessments")
      .withIndex("by_workspace", (q) =>
        q.eq("workspaceId", candidate.workspaceId),
      )
      .collect();
    const linkedAssessments: Array<{
      assessmentId: Id<"assessments">;
      title: string;
      processNameDraft: string | undefined;
      pipelineStatus: string | undefined;
      rosStatus: string | undefined;
      rosNotes: string | undefined;
      rosUrl: string | undefined;
      pddStatus: string | undefined;
      manualPriorityOverride: number | undefined;
      cachedPriorityScore: number | undefined;
      cachedAp: number | undefined;
      cachedCriticality: number | undefined;
      draftUpdatedAt: number | undefined;
      pvvResult: PvvAssessmentResultSummary | null;
      processDescriptionShort: string | undefined;
      notes: Array<{ body: string; createdAt: number; authorLabel: string }>;
    }> = [];
    for (const a of assessments) {
      const draft = await ctx.db
        .query("assessmentDrafts")
        .withIndex("by_assessment", (q) => q.eq("assessmentId", a._id))
        .first();
      const payload = draft?.payload as { candidateId?: string } | undefined;
      if (!draft?.payload || !draftPayloadMatchesCandidate(payload, candidate)) {
        continue;
      }
      const pd = draft.payload.processDescription?.trim();
      const pName = draft.payload.processName?.trim();
      let pvvResult: PvvAssessmentResultSummary | null = null;
      try {
        const snap = computeAllResults(
          payloadToSnapshot(draft.payload as Record<string, unknown>),
        );
        pvvResult = {
          ap: snap.ap,
          criticality: snap.criticality,
          priorityScore: snap.priorityScore,
          feasible: snap.feasible,
          ease: snap.ease,
          easeLabel: snap.easeLabel,
          hoursY: snap.hoursY,
          fte: snap.fte,
          costY: snap.costY,
          benH: snap.benH,
          benC: snap.benC,
          benFte: snap.benFte,
        };
      } catch {
        pvvResult = null;
      }
      const noteRows = await ctx.db
        .query("assessmentNotes")
        .withIndex("by_assessment", (q) => q.eq("assessmentId", a._id))
        .collect();
      noteRows.sort((x, y) => y.createdAt - x.createdAt);
      const notes: Array<{
        body: string;
        createdAt: number;
        authorLabel: string;
      }> = [];
      for (const n of noteRows.slice(0, 15)) {
        const u = await ctx.db.get(n.authorUserId);
        notes.push({
          body: n.body,
          createdAt: n.createdAt,
          authorLabel: u?.name ?? u?.email ?? "Bruker",
        });
      }
      linkedAssessments.push({
        assessmentId: a._id,
        title: a.title,
        processNameDraft:
          pName && pName.length > 0 ? pName.slice(0, 500) : undefined,
        pipelineStatus: a.pipelineStatus,
        rosStatus: a.rosStatus,
        rosNotes: a.rosNotes,
        rosUrl: a.rosUrl,
        pddStatus: a.pddStatus,
        manualPriorityOverride: a.manualPriorityOverride,
        cachedPriorityScore: a.cachedPriorityScore,
        cachedAp: a.cachedAp,
        cachedCriticality: a.cachedCriticality,
        draftUpdatedAt: draft.updatedAt,
        pvvResult,
        processDescriptionShort:
          pd && pd.length > 0 ? pd.slice(0, 2000) : undefined,
        notes,
      });
    }
    const rosAnalyses = await ctx.db
      .query("rosAnalyses")
      .withIndex("by_candidate", (q) => q.eq("candidateId", args.candidateId))
      .collect();
    const rosOut = rosAnalyses.map((r: Doc<"rosAnalyses">) => ({
      _id: r._id,
      notes: r.notes,
      methodologyStatement: r.methodologyStatement,
      contextSummary: r.contextSummary,
      scopeAndCriteria: r.scopeAndCriteria,
      updatedAt: r.updatedAt,
    }));
    const creator = await ctx.db.get(candidate.createdByUserId);
    let createdByLabel: string | null = null;
    if (creator) {
      const name = creator.name?.trim();
      const email = creator.email?.trim();
      if (name && email) {
        createdByLabel = `${name} (${email})`;
      } else if (name) {
        createdByLabel = name;
      } else if (email) {
        createdByLabel = email;
      }
    }
    return {
      candidate,
      workspaceName: workspace.name,
      workspaceId: candidate.workspaceId,
      createdByLabel,
      orgUnitName,
      linkedAssessments,
      rosAnalyses: rosOut,
    };
  },
});

export const setGithubProjectItem = internalMutation({
  args: {
    candidateId: v.id("candidates"),
    itemNodeId: v.union(v.string(), v.null()),
    statusOptionId: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    if (args.itemNodeId === null) {
      await ctx.db.patch(args.candidateId, {
        githubProjectItemNodeId: undefined,
        githubProjectStatusOptionId: undefined,
        githubRepoFullName: undefined,
        githubIssueNumber: undefined,
        githubIssueNodeId: undefined,
        updatedAt: now,
      });
      return;
    }
    await ctx.db.patch(args.candidateId, {
      githubProjectItemNodeId: args.itemNodeId,
      updatedAt: now,
      ...(args.statusOptionId !== undefined
        ? {
            githubProjectStatusOptionId:
              args.statusOptionId === null ? undefined : args.statusOptionId,
          }
        : {}),
    });
  },
});

/** Etter REST-opprettet issue + addProjectV2ItemById — én atomisk kobling til PVV. */
export const setGithubProjectItemWithIssueLink = internalMutation({
  args: {
    candidateId: v.id("candidates"),
    itemNodeId: v.string(),
    statusOptionId: v.string(),
    githubRepoFullName: v.string(),
    githubIssueNumber: v.number(),
    githubIssueNodeId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let repo: string;
    try {
      repo = normalizeGithubRepoFullName(args.githubRepoFullName);
    } catch {
      throw new Error("Ugyldig repo-navn.");
    }
    const n = Math.floor(args.githubIssueNumber);
    if (!Number.isFinite(n) || n < 1) {
      throw new Error("Ugyldig issue-nummer.");
    }
    const now = Date.now();
    await ctx.db.patch(args.candidateId, {
      githubProjectItemNodeId: args.itemNodeId.trim(),
      githubProjectStatusOptionId: args.statusOptionId.trim(),
      githubRepoFullName: repo,
      githubIssueNumber: n,
      githubIssueNodeId: args.githubIssueNodeId?.trim() || undefined,
      updatedAt: now,
    });
  },
});

export const setGithubIssueLinkFromGithub = internalMutation({
  args: {
    candidateId: v.id("candidates"),
    githubRepoFullName: v.string(),
    githubIssueNumber: v.number(),
    githubIssueNodeId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let repo: string;
    try {
      repo = normalizeGithubRepoFullName(args.githubRepoFullName);
    } catch {
      return;
    }
    await ctx.db.patch(args.candidateId, {
      githubRepoFullName: repo,
      githubIssueNumber: args.githubIssueNumber,
      githubIssueNodeId: args.githubIssueNodeId?.trim() || undefined,
      updatedAt: Date.now(),
    });
  },
});

export const clearGithubIssueLink = internalMutation({
  args: { candidateId: v.id("candidates") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.candidateId, {
      githubRepoFullName: undefined,
      githubIssueNumber: undefined,
      githubIssueNodeId: undefined,
      updatedAt: Date.now(),
    });
  },
});

/** Kontekst for valgfri GitHub-kommentar når ROS settes til fullført på en vurdering. */
export const getGithubRosCompletedCommentContext = internalQuery({
  args: { assessmentId: v.id("assessments") },
  handler: async (ctx, args) => {
    const assessment = await ctx.db.get(args.assessmentId);
    if (!assessment) {
      return null;
    }
    const draft = await ctx.db
      .query("assessmentDrafts")
      .withIndex("by_assessment", (q) => q.eq("assessmentId", assessment._id))
      .first();
    const raw = draft?.payload as { candidateId?: string } | undefined;
    const code = raw?.candidateId?.trim() ?? "";
    if (!code) {
      return null;
    }
    const candidate = await ctx.db
      .query("candidates")
      .withIndex("by_workspace_code", (q) =>
        q.eq("workspaceId", assessment.workspaceId).eq("code", code),
      )
      .unique();
    if (!candidate) {
      return null;
    }
    if (
      candidate.githubRepoFullName === undefined ||
      candidate.githubIssueNumber === undefined
    ) {
      return null;
    }
    return {
      workspaceId: assessment.workspaceId,
      assessmentTitle: assessment.title,
      processCode: candidate.code,
      processName: candidate.name,
      githubRepoFullName: candidate.githubRepoFullName,
      githubIssueNumber: candidate.githubIssueNumber,
    };
  },
});

/** Webhook: oppdater synkbare felt fra issue-body når markører finnes. */
export const applyGithubIssueBodyToCandidate = internalMutation({
  args: {
    repoFullName: v.string(),
    issueNumber: v.number(),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    let repo: string;
    try {
      repo = normalizeGithubRepoFullName(args.repoFullName);
    } catch {
      return { updated: false as const };
    }
    if (!hasPvvSyncMarkersInBody(args.body)) {
      return { updated: false as const };
    }
    const candidate = await ctx.db
      .query("candidates")
      .withIndex("by_github_issue", (q) =>
        q.eq("githubRepoFullName", repo).eq("githubIssueNumber", args.issueNumber),
      )
      .first();
    if (!candidate) {
      return { updated: false as const };
    }
    const fields = extractPvvSyncedFieldsFromGithubIssueBody(args.body);
    const patch: {
      notes?: string;
      linkHintBusinessOwner?: string;
      linkHintSystems?: string;
      linkHintComplianceNotes?: string;
      updatedAt: number;
    } = { updatedAt: Date.now() };
    if (fields.notes !== undefined) {
      patch.notes = fields.notes.trim() || undefined;
    }
    if (fields.linkHintBusinessOwner !== undefined) {
      patch.linkHintBusinessOwner =
        fields.linkHintBusinessOwner.trim() || undefined;
    }
    if (fields.linkHintSystems !== undefined) {
      patch.linkHintSystems = fields.linkHintSystems.trim() || undefined;
    }
    if (fields.linkHintComplianceNotes !== undefined) {
      patch.linkHintComplianceNotes =
        fields.linkHintComplianceNotes.trim() || undefined;
    }
    await ctx.db.patch(candidate._id, patch);
    return { updated: true as const, candidateId: candidate._id };
  },
});

/**
 * Manuell «hent fra GitHub»: parser PVV-markører i utkast/issue-body og oppdaterer prosessen.
 * (Webhook bruker `applyGithubIssueBodyToCandidate` når issue oppdateres.)
 */
export const applyPvvSyncedMarkersFromBody = internalMutation({
  args: {
    candidateId: v.id("candidates"),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    if (!hasPvvSyncMarkersInBody(args.body)) {
      return {
        applied: false as const,
        reason: "no_markers" as const,
      };
    }
    const fields = extractPvvSyncedFieldsFromGithubIssueBody(args.body);
    const candidate = await ctx.db.get(args.candidateId);
    if (!candidate) {
      throw new Error("Prosess finnes ikke.");
    }
    const patch: {
      notes?: string;
      linkHintBusinessOwner?: string;
      linkHintSystems?: string;
      linkHintComplianceNotes?: string;
      updatedAt: number;
    } = { updatedAt: Date.now() };
    let any = false;
    if (fields.notes !== undefined) {
      patch.notes = fields.notes.trim() || undefined;
      any = true;
    }
    if (fields.linkHintBusinessOwner !== undefined) {
      patch.linkHintBusinessOwner =
        fields.linkHintBusinessOwner.trim() || undefined;
      any = true;
    }
    if (fields.linkHintSystems !== undefined) {
      patch.linkHintSystems = fields.linkHintSystems.trim() || undefined;
      any = true;
    }
    if (fields.linkHintComplianceNotes !== undefined) {
      patch.linkHintComplianceNotes =
        fields.linkHintComplianceNotes.trim() || undefined;
      any = true;
    }
    if (!any) {
      return {
        applied: false as const,
        reason: "no_extracted_fields" as const,
      };
    }
    await ctx.db.patch(args.candidateId, patch);
    return {
      applied: true as const,
      updatedKeys: Object.keys(patch).filter((k) => k !== "updatedAt"),
    };
  },
});

export const listByWorkspace = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }
    await requireWorkspaceMember(ctx, args.workspaceId, userId, "viewer");
    return await ctx.db
      .query("candidates")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
  },
});

/**
 * Per prosess: koblede PVV-vurderinger (via utkastets prosess-ID) og ROS-analyser,
 * med tidspunkt — for oversiktskort i prosessregisteret.
 */
export const listProcessCoverage = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }
    await requireWorkspaceMember(ctx, args.workspaceId, userId, "viewer");

    const candidates = await ctx.db
      .query("candidates")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    const assessments = await ctx.db
      .query("assessments")
      .withIndex("by_workspace_updated", (q) =>
        q.eq("workspaceId", args.workspaceId),
      )
      .collect();

    const pvvByCode = new Map<
      string,
      Array<{
        assessmentId: Id<"assessments">;
        title: string;
        updatedAt: number;
        pipelineStatus: string;
      }>
    >();

    for (const a of assessments) {
      if (!(await canReadAssessment(ctx, a, userId))) {
        continue;
      }
      const draft = await ctx.db
        .query("assessmentDrafts")
        .withIndex("by_assessment", (q) => q.eq("assessmentId", a._id))
        .unique();
      const payload = draft?.payload as { candidateId?: string } | undefined;
      const codeRaw = (payload?.candidateId ?? "").trim();
      if (!codeRaw) {
        continue;
      }
      const codeKey = normalizeProcessCode(codeRaw);
      const row = {
        assessmentId: a._id,
        title: a.title,
        updatedAt: a.updatedAt,
        pipelineStatus: a.pipelineStatus ?? "not_assessed",
      };
      const list = pvvByCode.get(codeKey) ?? [];
      list.push(row);
      pvvByCode.set(codeKey, list);
    }

    for (const [, list] of pvvByCode) {
      list.sort((x, y) => y.updatedAt - x.updatedAt);
    }

    const rosRows = await ctx.db
      .query("rosAnalyses")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    const rosByCandidateId = new Map<
      Id<"candidates">,
      Array<{
        analysisId: Id<"rosAnalyses">;
        title: string;
        updatedAt: number;
      }>
    >();

    for (const r of rosRows) {
      if (!r.candidateId) {
        continue;
      }
      const item = {
        analysisId: r._id,
        title: r.title,
        updatedAt: r.updatedAt,
      };
      const list = rosByCandidateId.get(r.candidateId) ?? [];
      list.push(item);
      rosByCandidateId.set(r.candidateId, list);
    }

    for (const [, list] of rosByCandidateId) {
      list.sort((x, y) => y.updatedAt - x.updatedAt);
    }

    return candidates
      .sort((a, b) =>
        a.code.localeCompare(b.code, "nb", { sensitivity: "base" }),
      )
      .map((c) => {
        const codeKey = normalizeProcessCode(c.code);
        const pvvList = pvvByCode.get(codeKey) ?? [];
        const rosList = rosByCandidateId.get(c._id) ?? [];
        return {
          candidateId: c._id,
          name: c.name,
          code: c.code,
          candidateUpdatedAt: c.updatedAt,
          githubRepoFullName: c.githubRepoFullName ?? null,
          githubIssueNumber: c.githubIssueNumber ?? null,
          githubProjectItemNodeId: c.githubProjectItemNodeId ?? null,
          pvv: {
            count: pvvList.length,
            latestAt: pvvList[0]?.updatedAt ?? null,
            assessments: pvvList,
          },
          ros: {
            count: rosList.length,
            latestAt: rosList[0]?.updatedAt ?? null,
            analyses: rosList,
          },
        };
      });
  },
});

function trimOpt(s: string | undefined): string | undefined {
  if (s === undefined) return undefined;
  const t = s.trim();
  return t || undefined;
}

const AUTO_PROCESS_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

async function allocateUniqueProcessCode(
  ctx: MutationCtx,
  workspaceId: Id<"workspaces">,
): Promise<string> {
  for (let attempt = 0; attempt < 64; attempt++) {
    let suffix = "";
    for (let j = 0; j < 6; j++) {
      suffix +=
        AUTO_PROCESS_CODE_ALPHABET[
          Math.floor(Math.random() * AUTO_PROCESS_CODE_ALPHABET.length)
        ]!;
    }
    const code = `P-${suffix}`;
    const clash = await ctx.db
      .query("candidates")
      .withIndex("by_workspace_code", (q) =>
        q.eq("workspaceId", workspaceId).eq("code", code),
      )
      .unique();
    if (!clash) {
      return code;
    }
  }
  throw new Error("Kunne ikke generere unik prosess-ID — prøv igjen.");
}

export const create = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.string(),
    /** Tom eller utelatt: genereres automatisk (f.eks. P-X7K2M9). */
    code: v.optional(v.string()),
    notes: v.optional(v.string()),
    linkHintBusinessOwner: v.optional(v.string()),
    linkHintSystems: v.optional(v.string()),
    linkHintComplianceNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireWorkspaceMember(ctx, args.workspaceId, userId, "member");
    const name = args.name.trim();
    if (!name) {
      throw new Error("Navn er påkrevd.");
    }
    const raw = args.code?.trim() ?? "";
    let code: string;
    if (raw === "") {
      code = await allocateUniqueProcessCode(ctx, args.workspaceId);
    } else {
      code = raw.toUpperCase().replace(/\s+/g, "-");
      if (!code) {
        throw new Error("Prosess-ID kan ikke være tom.");
      }
    }
    const clash = await ctx.db
      .query("candidates")
      .withIndex("by_workspace_code", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("code", code),
      )
      .unique();
    if (clash) {
      throw new Error("Koden er allerede i bruk i dette arbeidsområdet.");
    }
    const now = Date.now();
    const candidateId = await ctx.db.insert("candidates", {
      workspaceId: args.workspaceId,
      name,
      code,
      notes: args.notes?.trim() || undefined,
      linkHintBusinessOwner: trimOpt(args.linkHintBusinessOwner),
      linkHintSystems: trimOpt(args.linkHintSystems),
      linkHintComplianceNotes: trimOpt(args.linkHintComplianceNotes),
      createdByUserId: userId,
      createdAt: now,
      updatedAt: now,
    });
    return { candidateId, code };
  },
});

/**
 * Oppretter prosess fra eksisterende GitHub-prosjektkort (kolonnehenting) og kobler PVV til samme kort.
 * Brukes når kortet allerede ligger i prosjektet med riktig status.
 */
export const createFromGithubProjectItem = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    projectItemNodeId: v.string(),
    name: v.string(),
    code: v.string(),
    statusOptionId: v.string(),
    contentKind: v.union(
      v.literal("draft_issue"),
      v.literal("issue"),
      v.literal("pull_request"),
    ),
    githubRepoFullName: v.optional(v.string()),
    githubIssueNumber: v.optional(v.number()),
    githubIssueNodeId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireWorkspaceMember(ctx, args.workspaceId, userId, "member");
    const name = args.name.trim();
    const code = args.code
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "-")
      .replace(/[^A-Z0-9_-]/g, "");
    if (!name || !code) {
      throw new Error("Navn og prosess-ID kan ikke være tomme.");
    }
    const clash = await ctx.db
      .query("candidates")
      .withIndex("by_workspace_code", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("code", code),
      )
      .unique();
    if (clash) {
      throw new Error("Prosess-ID er allerede i bruk i dette arbeidsområdet.");
    }
    const pid = args.projectItemNodeId.trim();
    const intakeRefs = await loadIntakeGithubOccupiedRefs(ctx, args.workspaceId);
    assertGithubProjectItemNotIntakeLinked(intakeRefs, pid);
    const existing = await ctx.db
      .query("candidates")
      .withIndex("by_workspace", (q) =>
        q.eq("workspaceId", args.workspaceId),
      )
      .collect();
    for (const c of existing) {
      if (c.githubProjectItemNodeId?.trim() === pid) {
        throw new Error(
          "Dette prosjektkortet er allerede koblet til en prosess i PVV.",
        );
      }
    }
    if (
      (args.contentKind === "issue" || args.contentKind === "pull_request") &&
      (!args.githubRepoFullName?.trim() || args.githubIssueNumber == null)
    ) {
      throw new Error("Mangler repo eller nummer for GitHub-issue/PR.");
    }
    let repo: string | undefined;
    if (args.githubRepoFullName?.trim()) {
      try {
        repo = normalizeGithubRepoFullName(args.githubRepoFullName);
      } catch {
        throw new Error("Ugyldig repo-navn.");
      }
    }
    if (
      (args.contentKind === "issue" || args.contentKind === "pull_request") &&
      repo &&
      args.githubIssueNumber != null
    ) {
      assertGithubIssueNotIntakeLinked(
        intakeRefs,
        repo,
        Math.floor(args.githubIssueNumber),
        args.githubIssueNodeId,
      );
    }
    const now = Date.now();
    const id = await ctx.db.insert("candidates", {
      workspaceId: args.workspaceId,
      name,
      code,
      githubProjectItemNodeId: pid,
      githubProjectStatusOptionId: args.statusOptionId.trim(),
      ...(args.contentKind === "issue" || args.contentKind === "pull_request"
        ? {
            githubRepoFullName: repo,
            githubIssueNumber: Math.floor(args.githubIssueNumber!),
            githubIssueNodeId: args.githubIssueNodeId?.trim() || undefined,
          }
        : {}),
      createdByUserId: userId,
      createdAt: now,
      updatedAt: now,
    });
    return id;
  },
});

/**
 * Oppretter prosess fra GitHub-issue uten prosjektkort (kun repo + issue, krever PAT).
 */
export const createCandidateFromGithubIssue = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.string(),
    code: v.string(),
    githubRepoFullName: v.string(),
    githubIssueNumber: v.number(),
    githubIssueNodeId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireWorkspaceMember(ctx, args.workspaceId, userId, "member");
    const name = args.name.trim();
    const code = args.code
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "-")
      .replace(/[^A-Z0-9_-]/g, "");
    if (!name || !code) {
      throw new Error("Navn og prosess-ID kan ikke være tomme.");
    }
    let repo: string;
    try {
      repo = normalizeGithubRepoFullName(args.githubRepoFullName);
    } catch {
      throw new Error("Ugyldig repo-navn.");
    }
    const issueNum = Math.floor(args.githubIssueNumber);
    if (!Number.isFinite(issueNum) || issueNum < 1) {
      throw new Error("Ugyldig issue-nummer.");
    }

    const clashCode = await ctx.db
      .query("candidates")
      .withIndex("by_workspace_code", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("code", code),
      )
      .unique();
    if (clashCode) {
      throw new Error("Prosess-ID er allerede i bruk i dette arbeidsområdet.");
    }

    const sameIssue = await ctx.db
      .query("candidates")
      .withIndex("by_github_issue", (q) =>
        q.eq("githubRepoFullName", repo).eq("githubIssueNumber", issueNum),
      )
      .collect();
    if (sameIssue.some((c) => c.workspaceId === args.workspaceId)) {
      throw new Error(
        "Denne GitHub-saken er allerede koblet til en prosess i dette arbeidsområdet.",
      );
    }

    const intakeRefs = await loadIntakeGithubOccupiedRefs(ctx, args.workspaceId);
    assertGithubIssueNotIntakeLinked(
      intakeRefs,
      repo,
      issueNum,
      args.githubIssueNodeId,
    );

    const now = Date.now();
    return await ctx.db.insert("candidates", {
      workspaceId: args.workspaceId,
      name,
      code,
      githubRepoFullName: repo,
      githubIssueNumber: issueNum,
      githubIssueNodeId: args.githubIssueNodeId?.trim() || undefined,
      createdByUserId: userId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    candidateId: v.id("candidates"),
    name: v.optional(v.string()),
    code: v.optional(v.string()),
    notes: v.optional(v.union(v.string(), v.null())),
    orgUnitId: v.optional(v.union(v.id("orgUnits"), v.null())),
    linkHintBusinessOwner: v.optional(v.union(v.string(), v.null())),
    linkHintSystems: v.optional(v.union(v.string(), v.null())),
    linkHintComplianceNotes: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const row = await ctx.db.get(args.candidateId);
    if (!row) {
      throw new Error("Kandidat finnes ikke.");
    }
    await requireWorkspaceMember(ctx, row.workspaceId, userId, "member");
    if (args.orgUnitId !== undefined && args.orgUnitId !== null) {
      const ou = await ctx.db.get(args.orgUnitId);
      if (!ou || ou.workspaceId !== row.workspaceId) {
        throw new Error("Ugyldig organisasjonsenhet.");
      }
    }
    const patch: {
      name?: string;
      code?: string;
      notes?: string;
      orgUnitId?: Id<"orgUnits">;
      linkHintBusinessOwner?: string;
      linkHintSystems?: string;
      linkHintComplianceNotes?: string;
      updatedAt: number;
    } = { updatedAt: Date.now() };
    if (args.name !== undefined) {
      patch.name = args.name.trim();
      if (!patch.name) {
        throw new Error("Navn kan ikke være tomt.");
      }
    }
    if (args.code !== undefined) {
      const code = args.code.trim().toUpperCase().replace(/\s+/g, "-");
      if (!code) {
        throw new Error("Kode kan ikke være tom.");
      }
      const clash = await ctx.db
        .query("candidates")
        .withIndex("by_workspace_code", (q) =>
          q.eq("workspaceId", row.workspaceId).eq("code", code),
        )
        .unique();
      if (clash && clash._id !== args.candidateId) {
        throw new Error("Koden er allerede i bruk.");
      }
      patch.code = code;
    }
    if (args.notes !== undefined) {
      patch.notes = args.notes === null ? undefined : args.notes.trim();
    }
    if (args.orgUnitId !== undefined) {
      patch.orgUnitId = args.orgUnitId === null ? undefined : args.orgUnitId;
    }
    if (args.linkHintBusinessOwner !== undefined) {
      patch.linkHintBusinessOwner =
        args.linkHintBusinessOwner === null
          ? undefined
          : trimOpt(args.linkHintBusinessOwner);
    }
    if (args.linkHintSystems !== undefined) {
      patch.linkHintSystems =
        args.linkHintSystems === null ? undefined : trimOpt(args.linkHintSystems);
    }
    if (args.linkHintComplianceNotes !== undefined) {
      patch.linkHintComplianceNotes =
        args.linkHintComplianceNotes === null
          ? undefined
          : trimOpt(args.linkHintComplianceNotes);
    }
    await ctx.db.patch(args.candidateId, patch);
    return null;
  },
});

export const remove = mutation({
  args: { candidateId: v.id("candidates") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const row = await ctx.db.get(args.candidateId);
    if (!row) {
      throw new Error("Kandidat finnes ikke.");
    }
    await requireWorkspaceMember(ctx, row.workspaceId, userId, "member");

    const assessmentIds = await collectAssessmentIdsLinkedToCandidate(ctx, row);
    const rosRows = await ctx.db
      .query("rosAnalyses")
      .withIndex("by_candidate", (q) =>
        q.eq("candidateId", args.candidateId),
      )
      .collect();
    const rosIds = new Set(rosRows.map((r) => r._id));

    const intakeRows = await ctx.db
      .query("intakeSubmissions")
      .withIndex("by_workspace_and_submitted_at", (q) =>
        q.eq("workspaceId", row.workspaceId),
      )
      .take(500);
    for (const sub of intakeRows) {
      if (
        sub.approvedAssessmentId &&
        assessmentIds.includes(sub.approvedAssessmentId)
      ) {
        const patch: {
          approvedAssessmentId: undefined;
          status: "under_review";
          reviewedAt: undefined;
          reviewedByUserId: undefined;
          approvedRosAnalysisId?: undefined;
        } = {
          approvedAssessmentId: undefined,
          status: "under_review",
          reviewedAt: undefined,
          reviewedByUserId: undefined,
        };
        if (
          sub.approvedRosAnalysisId &&
          rosIds.has(sub.approvedRosAnalysisId)
        ) {
          patch.approvedRosAnalysisId = undefined;
        }
        await ctx.db.patch(sub._id, patch);
      }
    }

    for (const aid of assessmentIds) {
      await cascadeDeleteAssessmentData(ctx, aid);
    }
    for (const r of rosRows) {
      await cascadeDeleteRosAnalysisData(ctx, r._id);
    }

    await ctx.db.delete(args.candidateId);
    return null;
  },
});
