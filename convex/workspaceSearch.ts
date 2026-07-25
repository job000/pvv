import { v } from "convex/values";
import { query } from "./_generated/server";
import {
  canReadAssessment,
  requireUserId,
  requireWorkspaceMember,
} from "./lib/access";

const PER_KIND = 8;
const MAX_TOTAL = 40;

const resultValidator = v.object({
  id: v.string(),
  kind: v.union(
    v.literal("assessment"),
    v.literal("candidate"),
    v.literal("ros"),
    v.literal("pdd"),
    v.literal("form"),
    v.literal("board"),
    v.literal("orgUnit"),
    v.literal("task"),
  ),
  group: v.string(),
  label: v.string(),
  hint: v.optional(v.string()),
  href: v.string(),
});

function normalize(s: string): string {
  return s.toLocaleLowerCase("nb-NO").trim();
}

function matches(haystack: string, needle: string): boolean {
  if (!needle) return false;
  return normalize(haystack).includes(needle);
}

function scoreMatch(label: string, needle: string): number {
  const n = normalize(label);
  if (n === needle) return 0;
  if (n.startsWith(needle)) return 1;
  if (n.includes(` ${needle}`)) return 2;
  return 3;
}

type SearchHit = {
  id: string;
  kind:
    | "assessment"
    | "candidate"
    | "ros"
    | "pdd"
    | "form"
    | "board"
    | "orgUnit"
    | "task";
  group: string;
  label: string;
  hint?: string;
  href: string;
  score: number;
};

/**
 * Fritstekstsøk i arbeidsområdet for kommandopaletten (⌘K).
 * Matcher titler/navn — ikke fulltekst i dokumenter.
 */
export const searchInWorkspace = query({
  args: {
    workspaceId: v.id("workspaces"),
    query: v.string(),
  },
  returns: v.array(resultValidator),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireWorkspaceMember(ctx, args.workspaceId, userId, "viewer");

    const needle = normalize(args.query);
    if (needle.length < 2) {
      return [];
    }

    const wid = args.workspaceId;
    const base = `/w/${wid}`;
    const hits: SearchHit[] = [];

    const pushCapped = (
      kindHits: SearchHit[],
      hit: Omit<SearchHit, "score"> & { score?: number },
    ) => {
      if (kindHits.length >= PER_KIND) return;
      kindHits.push({
        ...hit,
        score: hit.score ?? scoreMatch(hit.label, needle),
      });
    };

    // --- Vurderinger ---
    const assessments = await ctx.db
      .query("assessments")
      .withIndex("by_workspace_updated", (q) => q.eq("workspaceId", wid))
      .order("desc")
      .take(200);
    const assessmentHits: SearchHit[] = [];
    for (const a of assessments) {
      if (!matches(a.title, needle)) continue;
      if (!(await canReadAssessment(ctx, a, userId))) continue;
      pushCapped(assessmentHits, {
        id: `assessment:${a._id}`,
        kind: "assessment",
        group: "Vurderinger",
        label: a.title,
        hint: "Vurdering",
        href: `${base}/a/${a._id}`,
      });
    }
    hits.push(...assessmentHits);

    // --- Prosesser (kandidater) ---
    const candidates = await ctx.db
      .query("candidates")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", wid))
      .take(200);
    const candidateHits: SearchHit[] = [];
    for (const c of candidates) {
      const hay = `${c.name} ${c.code} ${c.notes ?? ""}`;
      if (!matches(hay, needle)) continue;
      pushCapped(candidateHits, {
        id: `candidate:${c._id}`,
        kind: "candidate",
        group: "Prosesser",
        label: c.name,
        hint: c.code ? `Prosess · ${c.code}` : "Prosess",
        href: `${base}/vurderinger?fane=prosesser`,
        score: Math.min(
          scoreMatch(c.name, needle),
          scoreMatch(c.code, needle),
        ),
      });
    }
    hits.push(...candidateHits);

    // --- ROS ---
    const rosRows = await ctx.db
      .query("rosAnalyses")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", wid))
      .take(200);
    const rosHits: SearchHit[] = [];
    for (const r of rosRows) {
      if (!matches(r.title, needle)) continue;
      pushCapped(rosHits, {
        id: `ros:${r._id}`,
        kind: "ros",
        group: "Risiko (ROS)",
        label: r.title,
        hint: "ROS-analyse",
        href: `${base}/ros/a/${r._id}`,
      });
    }
    hits.push(...rosHits);

    // --- Prosessdesign (PDD) ---
    const pddRows = await ctx.db
      .query("processDesignDocuments")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", wid))
      .take(120);
    const pddHits: SearchHit[] = [];
    for (const doc of pddRows) {
      const assessment = await ctx.db.get(doc.assessmentId);
      if (!assessment || !(await canReadAssessment(ctx, assessment, userId))) {
        continue;
      }
      const processTitle = doc.payload.processTitle?.trim() || "";
      const asIsName = doc.payload.asIsProcessName?.trim() || "";
      const hay = `${assessment.title} ${processTitle} ${asIsName}`;
      if (!matches(hay, needle)) continue;
      const label =
        processTitle || asIsName || assessment.title || "Prosessdesign";
      pushCapped(pddHits, {
        id: `pdd:${doc._id}`,
        kind: "pdd",
        group: "Prosessdesign",
        label,
        hint: "PDD",
        href: `${base}/a/${doc.assessmentId}/prosessdesign`,
        score: scoreMatch(label, needle),
      });
    }
    hits.push(...pddHits);

    // --- Skjemaer ---
    const forms = await ctx.db
      .query("intakeForms")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", wid))
      .take(120);
    const formHits: SearchHit[] = [];
    for (const f of forms) {
      const hay = `${f.title} ${f.description ?? ""}`;
      if (!matches(hay, needle)) continue;
      pushCapped(formHits, {
        id: `form:${f._id}`,
        kind: "form",
        group: "Skjemaer",
        label: f.title,
        hint: "Skjema",
        href: `${base}/skjemaer`,
      });
    }
    hits.push(...formHits);

    // --- Tavler ---
    const boards = await ctx.db
      .query("pulsBoards")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", wid))
      .take(80);
    const boardHits: SearchHit[] = [];
    for (const b of boards) {
      const hay = `${b.name} ${b.description ?? ""}`;
      if (!matches(hay, needle)) continue;
      pushCapped(boardHits, {
        id: `board:${b._id}`,
        kind: "board",
        group: "Tavler",
        label: b.name,
        hint: "Tavle",
        href: `${base}/tavler/${b._id}`,
      });
    }
    hits.push(...boardHits);

    // --- Organisasjon ---
    const units = await ctx.db
      .query("orgUnits")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", wid))
      .take(200);
    const orgHits: SearchHit[] = [];
    for (const u of units) {
      const hay = `${u.name} ${u.shortName ?? ""} ${u.localCode ?? ""}`;
      if (!matches(hay, needle)) continue;
      pushCapped(orgHits, {
        id: `org:${u._id}`,
        kind: "orgUnit",
        group: "Organisasjon",
        label: u.name,
        hint: u.kind,
        href: `${base}/organisasjon`,
        score: scoreMatch(u.name, needle),
      });
    }
    hits.push(...orgHits);

    // --- Oppgaver (Puls-kort) ---
    const tasks = await ctx.db
      .query("assessmentTasks")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", wid))
      .take(200);
    const taskHits: SearchHit[] = [];
    for (const t of tasks) {
      if (t.status === "done") continue;
      const hay = `${t.title} ${t.description ?? ""}`;
      if (!matches(hay, needle)) continue;
      if (t.assessmentId) {
        const assessment = await ctx.db.get(t.assessmentId);
        if (
          !assessment ||
          !(await canReadAssessment(ctx, assessment, userId))
        ) {
          continue;
        }
      }
      const href = t.boardId
        ? `${base}/tavler/${t.boardId}/task/${t._id}`
        : `${base}/oppgaver`;
      pushCapped(taskHits, {
        id: `task:${t._id}`,
        kind: "task",
        group: "Oppgaver",
        label: t.title,
        hint: "Oppgave",
        href,
      });
    }
    hits.push(...taskHits);

    hits.sort((a, b) => a.score - b.score || a.label.localeCompare(b.label, "nb"));

    return hits.slice(0, MAX_TOTAL).map(({ score: _score, ...rest }) => rest);
  },
});
