import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";

export const assignmentStatusValidator = v.union(
  v.literal("pending"),
  v.literal("accepted"),
  v.literal("declined"),
  v.literal("done"),
);

export type AssignmentStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "done";

export const assigneeStateValidator = v.object({
  userId: v.id("users"),
  status: assignmentStatusValidator,
  /** Hvem som tildelte denne brukeren (for returnering). */
  assignedByUserId: v.optional(v.id("users")),
  note: v.optional(v.string()),
  updatedAt: v.number(),
});

export type AssigneeState = {
  userId: Id<"users">;
  status: AssignmentStatus;
  assignedByUserId?: Id<"users">;
  note?: string;
  updatedAt: number;
};

/** Bygg state-liste ved ny/endret tildeling. Nye får pending (eller accepted hvis selv). */
export function buildAssigneeStates(args: {
  assigneeIds: Id<"users">[];
  actorUserId: Id<"users">;
  previous?: AssigneeState[] | undefined;
  now: number;
}): AssigneeState[] {
  const prevByUser = new Map(
    (args.previous ?? []).map((s) => [s.userId, s] as const),
  );
  return args.assigneeIds.map((uid) => {
    const prev = prevByUser.get(uid);
    if (prev && prev.status !== "declined") {
      return prev;
    }
    return {
      userId: uid,
      status: uid === args.actorUserId ? ("accepted" as const) : ("pending" as const),
      assignedByUserId: args.actorUserId,
      updatedAt: args.now,
    };
  });
}

/** Status for en bruker: mangler state på eldre oppgaver → treated as accepted. */
export function resolveMyAssignmentStatus(
  assigneeIds: Id<"users">[],
  states: AssigneeState[] | undefined,
  userId: Id<"users">,
  taskStatus: "open" | "done",
): AssignmentStatus | null {
  if (!assigneeIds.includes(userId)) return null;
  const mine = states?.find((s) => s.userId === userId);
  if (mine) return mine.status;
  if (taskStatus === "done") return "done";
  return "accepted";
}

/** Hvem oppgaven skal returneres til for denne tildelte. */
export function resolveAssignerUserId(
  states: AssigneeState[] | undefined,
  assigneeUserId: Id<"users">,
  fallbackCreatedByUserId: Id<"users">,
): Id<"users"> {
  const mine = states?.find((s) => s.userId === assigneeUserId);
  return mine?.assignedByUserId ?? fallbackCreatedByUserId;
}

export function upsertAssigneeState(
  states: AssigneeState[] | undefined,
  userId: Id<"users">,
  status: AssignmentStatus,
  now: number,
  extras?: {
    note?: string;
    assignedByUserId?: Id<"users">;
  },
): AssigneeState[] {
  const next = [...(states ?? [])];
  const idx = next.findIndex((s) => s.userId === userId);
  const prev = idx >= 0 ? next[idx] : undefined;
  const row: AssigneeState = {
    userId,
    status,
    updatedAt: now,
    assignedByUserId:
      extras?.assignedByUserId ?? prev?.assignedByUserId,
    ...(extras?.note !== undefined
      ? { note: extras.note.trim() || undefined }
      : prev?.note
        ? { note: prev.note }
        : {}),
  };
  if (idx >= 0) {
    next[idx] = row;
  } else {
    next.push(row);
  }
  return next;
}

/**
 * Returner oppgave: fjern assignee, gi den tilbake til den som tildelte.
 */
export function returnAssigneeToAssigner(args: {
  assigneeIds: Id<"users">[];
  states: AssigneeState[] | undefined;
  returningUserId: Id<"users">;
  assignerUserId: Id<"users">;
  now: number;
}): { assigneeIds: Id<"users">[]; states: AssigneeState[] } {
  const withoutReturner = args.assigneeIds.filter(
    (id) => id !== args.returningUserId,
  );
  const nextIds = withoutReturner.includes(args.assignerUserId)
    ? withoutReturner
    : [...withoutReturner, args.assignerUserId];

  let nextStates = (args.states ?? []).filter(
    (s) => s.userId !== args.returningUserId,
  );
  // Assigner får oppgaven tilbake som godtatt (åpen for handling).
  nextStates = upsertAssigneeState(
    nextStates,
    args.assignerUserId,
    "accepted",
    args.now,
    { assignedByUserId: args.returningUserId },
  );
  // Behold kun states for gjenværende ansvarlige
  nextStates = nextStates.filter((s) => nextIds.includes(s.userId));
  return { assigneeIds: nextIds, states: nextStates };
}
