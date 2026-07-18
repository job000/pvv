import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { requirePulsBoardAccess } from "./lib/access";

const columnValidator = v.object({
  _id: v.id("pulsBoardColumns"),
  boardId: v.id("pulsBoards"),
  workspaceId: v.id("workspaces"),
  name: v.string(),
  order: v.number(),
  isDone: v.boolean(),
  createdAt: v.number(),
});

type ColumnDto = {
  _id: Id<"pulsBoardColumns">;
  boardId: Id<"pulsBoards">;
  workspaceId: Id<"workspaces">;
  name: string;
  order: number;
  isDone: boolean;
  createdAt: number;
};

function toColumnDto(col: Doc<"pulsBoardColumns">): ColumnDto {
  return {
    _id: col._id,
    boardId: col.boardId,
    workspaceId: col.workspaceId,
    name: col.name,
    order: col.order,
    isDone: col.isDone,
    createdAt: col.createdAt,
  };
}

export type ColumnTemplateId = "priority" | "phases" | "empty";

type TemplateColumn = { name: string; isDone: boolean };

/** Standard kolonnestrukturer for Puls-tavler (brukes ved oppretting og bytte) */
export const COLUMN_TEMPLATES: Record<
  ColumnTemplateId,
  {
    id: ColumnTemplateId;
    label: string;
    description: string;
    columns: TemplateColumn[];
  }
> = {
  empty: {
    id: "empty",
    label: "Tom tavle",
    description: "Minimal start — én åpen kolonne og Ferdig. Bygg selv videre.",
    columns: [
      { name: "Åpen", isDone: false },
      { name: "Ferdig", isDone: true },
    ],
  },
  priority: {
    id: "priority",
    label: "Prioritet",
    description: "Klassisk P1–P5 med Ferdig — sorter etter viktighet.",
    columns: [
      { name: "Prioritet 1", isDone: false },
      { name: "Prioritet 2", isDone: false },
      { name: "Prioritet 3", isDone: false },
      { name: "Prioritet 4", isDone: false },
      { name: "Prioritet 5", isDone: false },
      { name: "Ferdig", isDone: true },
    ],
  },
  phases: {
    id: "phases",
    label: "Utviklingsfaser",
    description:
      "Backlog → Til vurdering → Under utvikling → Blokkert → Review → Ferdig.",
    columns: [
      { name: "Backlog", isDone: false },
      { name: "Til vurdering", isDone: false },
      { name: "Under utvikling", isDone: false },
      { name: "Blokkert", isDone: false },
      { name: "Review", isDone: false },
      { name: "Ferdig", isDone: true },
    ],
  },
};

/** Opprett kolonner fra mal på en tavle uten eksisterende kolonner. */
export async function seedColumnsFromTemplate(
  ctx: MutationCtx,
  board: Doc<"pulsBoards">,
  templateId: ColumnTemplateId,
): Promise<Doc<"pulsBoardColumns">[]> {
  const existing = await listColumnsForBoard(ctx, board._id);
  if (existing.length > 0) return existing;

  const template = COLUMN_TEMPLATES[templateId];
  const now = Date.now();
  for (let i = 0; i < template.columns.length; i++) {
    const def = template.columns[i]!;
    await ctx.db.insert("pulsBoardColumns", {
      boardId: board._id,
      workspaceId: board.workspaceId,
      name: def.name,
      order: i,
      isDone: def.isDone,
      createdAt: now,
    });
  }
  await ctx.db.patch(board._id, {
    columnTemplate: templateId,
    updatedAt: now,
  });
  return await listColumnsForBoard(ctx, board._id);
}

export async function listColumnsForBoard(
  ctx: QueryCtx | MutationCtx,
  boardId: Id<"pulsBoards">,
) {
  const cols = await ctx.db
    .query("pulsBoardColumns")
    .withIndex("by_board", (q) => q.eq("boardId", boardId))
    .collect();
  cols.sort((a, b) => a.order - b.order);
  return cols;
}

/**
 * Opprett standardkolonner (P1–P5 + Ferdig) hvis tavlen mangler kolonner.
 * Backfiller columnId på kort uten kolonne.
 */
export async function ensureDefaultColumns(
  ctx: MutationCtx,
  board: Doc<"pulsBoards">,
): Promise<Doc<"pulsBoardColumns">[]> {
  let cols = await listColumnsForBoard(ctx, board._id);
  if (cols.length === 0) {
    cols = await seedColumnsFromTemplate(ctx, board, "priority");
  }

  const openCols = cols.filter((c) => !c.isDone);
  const doneCol = cols.find((c) => c.isDone) ?? cols[cols.length - 1];
  if (!doneCol) return cols;

  const tasks = await ctx.db
    .query("assessmentTasks")
    .withIndex("by_board", (q) => q.eq("boardId", board._id))
    .take(500);

  for (const t of tasks) {
    if (t.columnId) {
      const still = cols.some((c) => c._id === t.columnId);
      if (still) continue;
    }
    let target: Doc<"pulsBoardColumns"> | undefined;
    if (t.status === "done") {
      target = doneCol;
    } else {
      const p = Math.min(5, Math.max(1, Math.round(t.priority ?? 3)));
      target = openCols[p - 1] ?? openCols[0] ?? doneCol;
    }
    if (target) {
      await ctx.db.patch(t._id, { columnId: target._id });
    }
  }

  return cols;
}

export function resolveColumnForLegacy(
  cols: Doc<"pulsBoardColumns">[],
  task: Pick<Doc<"assessmentTasks">, "status" | "priority" | "columnId">,
): Id<"pulsBoardColumns"> | null {
  if (task.columnId && cols.some((c) => c._id === task.columnId)) {
    return task.columnId;
  }
  const doneCol = cols.find((c) => c.isDone);
  const openCols = cols.filter((c) => !c.isDone);
  if (task.status === "done") return doneCol?._id ?? null;
  const p = Math.min(5, Math.max(1, Math.round(task.priority ?? 3)));
  return openCols[p - 1]?._id ?? openCols[0]?._id ?? doneCol?._id ?? null;
}

export const listByBoard = query({
  args: { boardId: v.id("pulsBoards") },
  returns: v.array(columnValidator),
  handler: async (ctx, args) => {
    await requirePulsBoardAccess(ctx, args.boardId, "viewer");
    const cols = await listColumnsForBoard(ctx, args.boardId);
    return cols.map(toColumnDto);
  },
});

export const ensureForBoard = mutation({
  args: { boardId: v.id("pulsBoards") },
  returns: v.array(columnValidator),
  handler: async (ctx, args) => {
    const { board } = await requirePulsBoardAccess(ctx, args.boardId, "viewer");
    const cols = await ensureDefaultColumns(ctx, board);
    return cols.map(toColumnDto);
  },
});

export const create = mutation({
  args: {
    boardId: v.id("pulsBoards"),
    name: v.string(),
    /** Sett true for ekstra «ferdig»-kolonne (sjelden). */
    isDone: v.optional(v.boolean()),
  },
  returns: v.id("pulsBoardColumns"),
  handler: async (ctx, args) => {
    const { board } = await requirePulsBoardAccess(ctx, args.boardId, "owner");
    const name = args.name.trim();
    if (!name) throw new Error("Gi kolonnen et navn.");
    if (name.length > 80) throw new Error("Navnet er for langt.");

    const cols = await ensureDefaultColumns(ctx, board);
    const isDone = args.isDone === true;
    if (isDone && cols.some((c) => c.isDone)) {
      throw new Error("Tavlen har allerede en Ferdig-kolonne.");
    }

    const openCols = cols.filter((c) => !c.isDone);
    const doneCols = cols.filter((c) => c.isDone);
    const now = Date.now();

    let order: number;
    if (isDone) {
      order = cols.length > 0 ? Math.max(...cols.map((c) => c.order)) + 1 : 0;
    } else {
      // Sett inn før første Ferdig-kolonne
      const firstDoneOrder =
        doneCols.length > 0
          ? Math.min(...doneCols.map((c) => c.order))
          : openCols.length > 0
            ? Math.max(...openCols.map((c) => c.order)) + 1
            : 0;
      order = firstDoneOrder;
      for (const c of doneCols) {
        await ctx.db.patch(c._id, { order: c.order + 1 });
      }
    }

    const id = await ctx.db.insert("pulsBoardColumns", {
      boardId: board._id,
      workspaceId: board.workspaceId,
      name,
      order,
      isDone,
      createdAt: now,
    });
    await ctx.db.patch(board._id, {
      updatedAt: now,
      columnTemplate: "custom",
    });
    return id;
  },
});

export const rename = mutation({
  args: {
    columnId: v.id("pulsBoardColumns"),
    name: v.string(),
  },
  returns: v.object({ ok: v.literal(true) }),
  handler: async (ctx, args) => {
    const col = await ctx.db.get(args.columnId);
    if (!col) throw new Error("Fant ikke kolonnen.");
    await requirePulsBoardAccess(ctx, col.boardId, "owner");
    const name = args.name.trim();
    if (!name) throw new Error("Gi kolonnen et navn.");
    if (name.length > 80) throw new Error("Navnet er for langt.");
    await ctx.db.patch(args.columnId, { name });
    await ctx.db.patch(col.boardId, {
      updatedAt: Date.now(),
      columnTemplate: "custom",
    });
    return { ok: true as const };
  },
});

export const remove = mutation({
  args: {
    columnId: v.id("pulsBoardColumns"),
    /** Flytt kort hit før sletting (påkrevd hvis kolonnen har kort). */
    moveCardsToColumnId: v.optional(v.id("pulsBoardColumns")),
  },
  returns: v.object({ ok: v.literal(true) }),
  handler: async (ctx, args) => {
    const col = await ctx.db.get(args.columnId);
    if (!col) throw new Error("Fant ikke kolonnen.");
    const { board } = await requirePulsBoardAccess(ctx, col.boardId, "owner");
    const cols = await listColumnsForBoard(ctx, board._id);
    if (cols.length <= 1) {
      throw new Error("Du må ha minst én kolonne på tavlen.");
    }
    if (col.isDone) {
      const otherDone = cols.filter((c) => c.isDone && c._id !== col._id);
      if (otherDone.length === 0) {
        throw new Error(
          "Behold minst én Ferdig-kolonne, eller opprett en ny før du sletter.",
        );
      }
    } else {
      const otherOpen = cols.filter((c) => !c.isDone && c._id !== col._id);
      if (otherOpen.length === 0) {
        throw new Error("Behold minst én åpen kolonne.");
      }
    }

    const cards = await ctx.db
      .query("assessmentTasks")
      .withIndex("by_column", (q) => q.eq("columnId", args.columnId))
      .take(500);

    let targetId = args.moveCardsToColumnId;
    if (!targetId || targetId === args.columnId) {
      const fallback =
        cols.find((c) => c._id !== col._id && c.isDone === col.isDone) ??
        cols.find((c) => c._id !== col._id);
      targetId = fallback?._id;
    }
    if (!targetId) throw new Error("Fant ikke kolonne å flytte kort til.");
    const target = await ctx.db.get(targetId);
    if (!target || target.boardId !== board._id) {
      throw new Error("Målkolonnen finnes ikke på denne tavlen.");
    }

    for (const card of cards) {
      await ctx.db.patch(card._id, {
        columnId: targetId,
        status: target.isDone ? "done" : "open",
      });
    }

    await ctx.db.delete(args.columnId);
    await ctx.db.patch(board._id, {
      updatedAt: Date.now(),
      columnTemplate: "custom",
    });
    return { ok: true as const };
  },
});

const templateIdValidator = v.union(
  v.literal("empty"),
  v.literal("priority"),
  v.literal("phases"),
);

export const listTemplates = query({
  args: {
    /** Ved oppretting: inkluder «Tom tavle». Ved bytte: kun ferdige maler. */
    includeEmpty: v.optional(v.boolean()),
  },
  returns: v.array(
    v.object({
      id: templateIdValidator,
      label: v.string(),
      description: v.string(),
      columnNames: v.array(v.string()),
    }),
  ),
  handler: async (_ctx, args) => {
    const ids = (
      Object.keys(COLUMN_TEMPLATES) as ColumnTemplateId[]
    ).filter((id) => args.includeEmpty === true || id !== "empty");
    return ids.map((id) => {
      const t = COLUMN_TEMPLATES[id];
      return {
        id: t.id,
        label: t.label,
        description: t.description,
        columnNames: t.columns.map((c) => c.name),
      };
    });
  },
});

/**
 * Erstatt kolonnestruktur med en mal. Kort mappes best-effort
 * (samme relative posisjon blant åpne kolonner; Ferdig → Ferdig).
 */
export const applyTemplate = mutation({
  args: {
    boardId: v.id("pulsBoards"),
    templateId: templateIdValidator,
  },
  returns: v.array(columnValidator),
  handler: async (ctx, args) => {
    const { board } = await requirePulsBoardAccess(ctx, args.boardId, "owner");
    const template = COLUMN_TEMPLATES[args.templateId];
    if (!template) throw new Error("Ukjent mal.");
    const oldCols = await listColumnsForBoard(ctx, board._id);
    const oldOpen = oldCols.filter((c) => !c.isDone);
    const oldDone = oldCols.find((c) => c.isDone);

    const tasks = await ctx.db
      .query("assessmentTasks")
      .withIndex("by_board", (q) => q.eq("boardId", board._id))
      .take(500);

    const now = Date.now();
    const newIds: Id<"pulsBoardColumns">[] = [];
    for (let i = 0; i < template.columns.length; i++) {
      const def = template.columns[i]!;
      const id = await ctx.db.insert("pulsBoardColumns", {
        boardId: board._id,
        workspaceId: board.workspaceId,
        name: def.name,
        order: i,
        isDone: def.isDone,
        createdAt: now,
      });
      newIds.push(id);
    }

    const newCols = await listColumnsForBoard(ctx, board._id);
    // Kun de vi nettopp opprettet (gammel + ny midlertidig)
    const fresh = newCols.filter((c) => newIds.includes(c._id));
    const freshOpen = fresh.filter((c) => !c.isDone);
    const freshDone = fresh.find((c) => c.isDone) ?? fresh[fresh.length - 1];

    for (const task of tasks) {
      let targetId: Id<"pulsBoardColumns"> | undefined;
      if (task.status === "done" || (oldDone && task.columnId === oldDone._id)) {
        targetId = freshDone?._id;
      } else {
        const oldIdx = oldOpen.findIndex((c) => c._id === task.columnId);
        if (oldIdx >= 0 && freshOpen.length > 0) {
          const mapped = Math.min(
            freshOpen.length - 1,
            Math.round(
              (oldIdx / Math.max(1, oldOpen.length - 1)) *
                (freshOpen.length - 1),
            ),
          );
          targetId = freshOpen[mapped]?._id ?? freshOpen[0]?._id;
        } else {
          const p = Math.min(5, Math.max(1, Math.round(task.priority ?? 3)));
          targetId =
            freshOpen[Math.min(freshOpen.length - 1, p - 1)]?._id ??
            freshOpen[0]?._id ??
            freshDone?._id;
        }
      }
      if (targetId) {
        const col = fresh.find((c) => c._id === targetId);
        await ctx.db.patch(task._id, {
          columnId: targetId,
          status: col?.isDone ? "done" : task.status === "done" ? "done" : "open",
        });
      }
    }

    for (const old of oldCols) {
      await ctx.db.delete(old._id);
    }

    await ctx.db.patch(board._id, {
      columnTemplate: args.templateId,
      updatedAt: now,
    });

    const finalCols = await listColumnsForBoard(ctx, board._id);
    return finalCols.map(toColumnDto);
  },
});
