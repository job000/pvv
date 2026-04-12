import { v } from "convex/values";
import {
  mutation,
  query,
  type MutationCtx,
} from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Doc, Id } from "./_generated/dataModel";
import {
  canEditAssessment,
  requireAssessmentEdit,
  getAssessmentIfReadable,
} from "./lib/access";
import {
  processDesignDocumentPayloadValidator,
  type ProcessDesignDocumentPayload,
} from "./schema";

const MAX_STEP_ROWS = 200;
const MAX_APP_ROWS = 80;
const MAX_CONTACT_ROWS = 40;
const MAX_HISTORY_ROWS = 60;
const MAX_EXCEPTION_ROWS = 120;
const MAX_APPROVAL_ROWS = 24;
const MAX_HUKI_ROWS = 120;
const MAX_STRING = 48_000;
/** tldraw JSON — hold under dokumentgrensen (Convex ~1 MiB totalt på dokumentet) */
const MAX_DIAGRAM_SNAPSHOT_CHARS = 320_000;
/** Maks antall lagrede versjoner per dokument (eldste slettes ved nye innskudd). */
const MAX_DOCUMENT_VERSION_ROWS = 50;
const AUTO_SAVE_VERSION_NOTE = "Lagret";

function clampStr(s: string | undefined, max: number): string | undefined {
  if (s === undefined) return undefined;
  const t = s.trim();
  if (!t) return undefined;
  return t.length > max ? t.slice(0, max) : t;
}

function sanitizeDiagramSnapshotField(
  raw: string | undefined,
  label: string,
): string | undefined {
  if (raw === undefined) return undefined;
  const t = raw.trim();
  if (!t) return undefined;
  if (t.length > MAX_DIAGRAM_SNAPSHOT_CHARS) {
    throw new Error(
      `${label} er for stort. Fjern store bilder eller forenkle diagrammet.`,
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(t);
  } catch {
    throw new Error(`${label} er ikke gyldig JSON.`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${label} har uventet format.`);
  }
  const root = parsed as Record<string, unknown>;
  const doc = root.document;
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) {
    throw new Error(`${label} mangler dokumentdel (document).`);
  }
  const d = doc as Record<string, unknown>;
  if (
    !d.store ||
    typeof d.store !== "object" ||
    d.store === null ||
    Array.isArray(d.store)
  ) {
    throw new Error(`${label} mangler tegnedata (document.store).`);
  }
  if (
    d.schema !== undefined &&
    (typeof d.schema !== "object" ||
      d.schema === null ||
      Array.isArray(d.schema))
  ) {
    throw new Error(`${label} har ugyldig document.schema.`);
  }
  const normalized = JSON.stringify(parsed);
  if (normalized.length > MAX_DIAGRAM_SNAPSHOT_CHARS) {
    throw new Error(`${label} er for stort etter validering.`);
  }
  return normalized;
}

function sanitizePayload(
  raw: ProcessDesignDocumentPayload,
): ProcessDesignDocumentPayload {
  const out: ProcessDesignDocumentPayload = {};
  const copyStr = (k: keyof ProcessDesignDocumentPayload) => {
    const v = raw[k];
    if (typeof v === "string") {
      const c = clampStr(v, MAX_STRING);
      if (c !== undefined) {
        (out as Record<string, unknown>)[k as string] = c;
      }
    }
  };

  for (const key of [
    "orgPrimaryUnit",
    "orgOperatingUnits",
    "orgRolloutNotes",
    "orgRosCoverage",
    "executiveSummary",
    "purpose",
    "objectives",
    "prerequisites",
    "asIsProcessName",
    "asIsProcessArea",
    "asIsDepartment",
    "asIsShortDescription",
    "asIsRoles",
    "asIsSchedule",
    "asIsVolume",
    "asIsHandleTime",
    "asIsExecutionTime",
    "asIsPeak",
    "asIsFte",
    "asIsInputData",
    "asIsOutputData",
    "asIsProcessMap",
    "toBeMap",
    "toBeSteps",
    "parallelInitiatives",
    "inScope",
    "outOfScope",
    "businessExceptionsUnknown",
    "appErrorsUnknown",
    "reporting",
    "otherObservations",
    "additionalSources",
    "targetTimeline",
    "appendix",
  ] as const) {
    copyStr(key);
  }

  const asIsDia = sanitizeDiagramSnapshotField(
    raw.asIsDiagramSnapshot,
    "As-Is diagram",
  );
  if (asIsDia !== undefined) {
    out.asIsDiagramSnapshot = asIsDia;
  }
  const toBeDia = sanitizeDiagramSnapshotField(
    raw.toBeDiagramSnapshot,
    "To-Be diagram",
  );
  if (toBeDia !== undefined) {
    out.toBeDiagramSnapshot = toBeDia;
  }

  if (raw.keyContacts?.length) {
    out.keyContacts = raw.keyContacts
      .slice(0, MAX_CONTACT_ROWS)
      .map((r) => ({
        role: (r.role ?? "").trim().slice(0, 200),
        name: (r.name ?? "").trim().slice(0, 200),
        contact: (r.contact ?? "").trim().slice(0, 400),
        notes: clampStr(r.notes, 2000),
      }))
      .filter((r) => r.role && r.name);
  }
  if (raw.asIsApplications?.length) {
    out.asIsApplications = raw.asIsApplications
      .slice(0, MAX_APP_ROWS)
      .map((r) => ({
        name: (r.name ?? "").trim().slice(0, 300),
        type: clampStr(r.type, 200),
        env: clampStr(r.env, 200),
        comments: clampStr(r.comments, 2000),
        phase: clampStr(r.phase, 120),
      }))
      .filter((r) => r.name);
  }
  if (raw.asIsSteps?.length) {
    out.asIsSteps = raw.asIsSteps
      .slice(0, MAX_STEP_ROWS)
      .map((r) => ({
        stepNo: clampStr(r.stepNo, 40),
        input: clampStr(r.input, 2000),
        description: (r.description ?? "").trim().slice(0, 8000),
        details: clampStr(r.details, 4000),
        exception: clampStr(r.exception, 2000),
        actions: clampStr(r.actions, 2000),
        rules: clampStr(r.rules, 2000),
      }))
      .filter((r) => r.description);
  }
  if (raw.businessExceptionsKnown?.length) {
    out.businessExceptionsKnown = raw.businessExceptionsKnown
      .slice(0, MAX_EXCEPTION_ROWS)
      .map((r) => ({
        id: clampStr(r.id, 80),
        name: (r.name ?? "").trim().slice(0, 400),
        step: clampStr(r.step, 200),
        params: clampStr(r.params, 2000),
        action: (r.action ?? "").trim().slice(0, 4000),
      }))
      .filter((r) => r.name && r.action);
  }
  if (raw.appErrorsKnown?.length) {
    out.appErrorsKnown = raw.appErrorsKnown
      .slice(0, MAX_EXCEPTION_ROWS)
      .map((r) => ({
        id: clampStr(r.id, 80),
        name: (r.name ?? "").trim().slice(0, 400),
        step: clampStr(r.step, 200),
        params: clampStr(r.params, 2000),
        action: (r.action ?? "").trim().slice(0, 4000),
      }))
      .filter((r) => r.name && r.action);
  }
  if (raw.documentHistory?.length) {
    out.documentHistory = raw.documentHistory
      .slice(0, MAX_HISTORY_ROWS)
      .map((r) => ({
        date: (r.date ?? "").trim().slice(0, 120),
        version: (r.version ?? "").trim().slice(0, 80),
        role: (r.role ?? "").trim().slice(0, 200),
        name: (r.name ?? "").trim().slice(0, 200),
        organization: clampStr(r.organization, 200),
        comments: clampStr(r.comments, 2000),
      }))
      .filter((r) => r.date || r.version || r.name);
  }
  if (raw.approvalRows?.length) {
    out.approvalRows = raw.approvalRows
      .slice(0, MAX_APPROVAL_ROWS)
      .map((r) => ({
        version: clampStr(r.version, 80),
        flow: clampStr(r.flow, 400),
        role: clampStr(r.role, 200),
        name: clampStr(r.name, 200),
        org: clampStr(r.org, 200),
        signature: clampStr(r.signature, 400),
      }))
      .filter((r) => r.flow || r.role || r.name);
  }
  if (raw.hukiRows?.length) {
    out.hukiRows = raw.hukiRows.slice(0, MAX_HUKI_ROWS).map((r) => ({
      // Preserve newly added rows during autosave so users can fill them in
      // without the server roundtrip removing the row immediately.
      activity: (r.activity ?? "").trim().slice(0, 400),
      h: (r.h ?? "").trim().slice(0, 200),
      u: (r.u ?? "").trim().slice(0, 200),
      k: (r.k ?? "").trim().slice(0, 200),
      i: (r.i ?? "").trim().slice(0, 200),
    }));
  }
  return out;
}

async function getDocByAssessment(
  ctx: MutationCtx,
  assessmentId: Id<"assessments">,
): Promise<Doc<"processDesignDocuments"> | null> {
  return await ctx.db
    .query("processDesignDocuments")
    .withIndex("by_assessment", (q) => q.eq("assessmentId", assessmentId))
    .unique();
}

async function pruneOldestDocumentVersions(
  ctx: MutationCtx,
  documentId: Id<"processDesignDocuments">,
) {
  const rows = await ctx.db
    .query("processDesignDocumentVersions")
    .withIndex("by_document", (q) => q.eq("documentId", documentId))
    .collect();
  if (rows.length < MAX_DOCUMENT_VERSION_ROWS) return;
  rows.sort((a, b) => a.version - b.version);
  const deleteCount = rows.length - MAX_DOCUMENT_VERSION_ROWS + 1;
  for (let i = 0; i < deleteCount; i++) {
    await ctx.db.delete(rows[i]._id);
  }
}

/** Opprett én versjonsrad (brukes ved manuell snapshot og ved vellykket lagring). */
async function insertDocumentVersion(
  ctx: MutationCtx,
  args: {
    workspaceId: Id<"workspaces">;
    documentId: Id<"processDesignDocuments">;
    assessmentId: Id<"assessments">;
    userId: Id<"users">;
    payload: ProcessDesignDocumentPayload;
    note?: string;
  },
): Promise<{ version: number }> {
  await pruneOldestDocumentVersions(ctx, args.documentId);
  const last = await ctx.db
    .query("processDesignDocumentVersions")
    .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
    .order("desc")
    .first();
  const nextVersion = (last?.version ?? 0) + 1;
  const now = Date.now();
  await ctx.db.insert("processDesignDocumentVersions", {
    workspaceId: args.workspaceId,
    documentId: args.documentId,
    assessmentId: args.assessmentId,
    version: nextVersion,
    note: args.note,
    payload: args.payload,
    createdAt: now,
    createdByUserId: args.userId,
  });
  return { version: nextVersion };
}

export const getForAssessment = query({
  args: { assessmentId: v.id("assessments") },
  handler: async (ctx, args) => {
    const readable = await getAssessmentIfReadable(ctx, args.assessmentId);
    if (!readable) {
      return null;
    }
    const doc = await ctx.db
      .query("processDesignDocuments")
      .withIndex("by_assessment", (q) => q.eq("assessmentId", args.assessmentId))
      .unique();
    if (!doc) {
      return {
        assessment: readable.assessment,
        document: null as Doc<"processDesignDocuments"> | null,
        versions: [] as Doc<"processDesignDocumentVersions">[],
        canEdit: await canEditAssessment(
          ctx,
          readable.assessment,
          readable.userId,
        ),
      };
    }
    const versions = await ctx.db
      .query("processDesignDocumentVersions")
      .withIndex("by_document", (q) => q.eq("documentId", doc._id))
      .order("desc")
      .take(80);
    return {
      assessment: readable.assessment,
      document: doc,
      versions,
      canEdit: await canEditAssessment(
        ctx,
        readable.assessment,
        readable.userId,
      ),
    };
  },
});

export const ensureDocument = mutation({
  args: { assessmentId: v.id("assessments") },
  handler: async (ctx, args) => {
    const { assessment, userId } = await requireAssessmentEdit(
      ctx,
      args.assessmentId,
    );
    const existing = await getDocByAssessment(ctx, args.assessmentId);
    if (existing) {
      return existing._id;
    }
    const now = Date.now();
    return await ctx.db.insert("processDesignDocuments", {
      workspaceId: assessment.workspaceId,
      assessmentId: args.assessmentId,
      payload: {},
      revision: 1,
      updatedAt: now,
      updatedByUserId: userId,
      createdAt: now,
      createdByUserId: userId,
    });
  },
});

export const saveDraft = mutation({
  args: {
    assessmentId: v.id("assessments"),
    expectedRevision: v.number(),
    organizationLine: v.optional(v.union(v.string(), v.null())),
    payload: processDesignDocumentPayloadValidator,
  },
  handler: async (ctx, args) => {
    const { assessment, userId } = await requireAssessmentEdit(
      ctx,
      args.assessmentId,
    );
    if (
      !Number.isInteger(args.expectedRevision) ||
      args.expectedRevision < 0
    ) {
      throw new Error("Ugyldig revisjon.");
    }
    const doc = await getDocByAssessment(ctx, args.assessmentId);
    if (!doc) {
      throw new Error("Dokumentet finnes ikke. Opprett det først.");
    }
    if (doc.workspaceId !== assessment.workspaceId) {
      throw new Error("Ugyldig dokument.");
    }
    const serverRev = doc.revision ?? 0;
    if (args.expectedRevision !== serverRev) {
      const u = await ctx.db.get(doc.updatedByUserId);
      return {
        ok: false as const,
        conflict: {
          serverRevision: serverRev,
          payload: doc.payload as ProcessDesignDocumentPayload,
          organizationLine: doc.organizationLine,
          updatedAt: doc.updatedAt,
          updatedByName: u?.name ?? u?.email ?? null,
        },
      };
    }
    const now = Date.now();
    const org =
      args.organizationLine === null
        ? undefined
        : args.organizationLine !== undefined
          ? clampStr(args.organizationLine, 400)
          : doc.organizationLine;
    const newRev = serverRev + 1;
    const clean = sanitizePayload(args.payload);
    await ctx.db.patch(doc._id, {
      organizationLine: org,
      payload: clean,
      revision: newRev,
      updatedAt: now,
      updatedByUserId: userId,
    });
    await insertDocumentVersion(ctx, {
      workspaceId: assessment.workspaceId,
      documentId: doc._id,
      assessmentId: args.assessmentId,
      userId,
      payload: clean,
      note: AUTO_SAVE_VERSION_NOTE,
    });
    await ctx.db.patch(assessment._id, { updatedAt: now });
    return { ok: true as const, revision: newRev };
  },
});

export const createVersionSnapshot = mutation({
  args: {
    assessmentId: v.id("assessments"),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { assessment, userId } = await requireAssessmentEdit(
      ctx,
      args.assessmentId,
    );
    const doc = await getDocByAssessment(ctx, args.assessmentId);
    if (!doc || doc.workspaceId !== assessment.workspaceId) {
      throw new Error("Dokumentet finnes ikke.");
    }
    const note = clampStr(args.note, 2000);
    const { version } = await insertDocumentVersion(ctx, {
      workspaceId: assessment.workspaceId,
      documentId: doc._id,
      assessmentId: args.assessmentId,
      userId,
      payload: doc.payload as ProcessDesignDocumentPayload,
      note,
    });
    const now = Date.now();
    await ctx.db.patch(doc._id, {
      updatedAt: now,
      updatedByUserId: userId,
    });
    await ctx.db.patch(assessment._id, { updatedAt: now });
    return { version };
  },
});

export const restoreVersion = mutation({
  args: {
    assessmentId: v.id("assessments"),
    version: v.number(),
    expectedRevision: v.number(),
  },
  handler: async (ctx, args) => {
    const { assessment, userId } = await requireAssessmentEdit(
      ctx,
      args.assessmentId,
    );
    const doc = await getDocByAssessment(ctx, args.assessmentId);
    if (!doc || doc.workspaceId !== assessment.workspaceId) {
      throw new Error("Dokumentet finnes ikke.");
    }
    const serverRev = doc.revision ?? 0;
    if (args.expectedRevision !== serverRev) {
      throw new Error(
        "Revisjonen stemmer ikke. Last siden på nytt og prøv igjen.",
      );
    }
    const snap = await ctx.db
      .query("processDesignDocumentVersions")
      .withIndex("by_document_version", (q) =>
        q.eq("documentId", doc._id).eq("version", args.version),
      )
      .unique();
    if (!snap) {
      throw new Error("Fant ikke denne versjonen.");
    }
    const now = Date.now();
    const newRev = serverRev + 1;
    await ctx.db.patch(doc._id, {
      payload: snap.payload as ProcessDesignDocumentPayload,
      revision: newRev,
      updatedAt: now,
      updatedByUserId: userId,
    });
    await ctx.db.patch(assessment._id, { updatedAt: now });
    return { ok: true as const, revision: newRev };
  },
});
