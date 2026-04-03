import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

/** Eksklusiv øvre grense for prefikssøk i leksikografisk rekkefølge (e-post). */
export function emailPrefixUpperBound(prefix: string): string {
  const p = prefix.trim().toLowerCase();
  if (p.length === 0) {
    return "\uffff";
  }
  const lastCp = p.codePointAt(p.length - 1);
  if (lastCp === undefined) {
    return "\uffff";
  }
  if (lastCp >= 0x10ffff) {
    return `${p}\uffff`;
  }
  const charLen = lastCp > 0xffff ? 2 : 1;
  const before = p.slice(0, p.length - charLen);
  return before + String.fromCodePoint(lastCp + 1);
}

/**
 * Brukere med e-post i området [prefix, upper) via indeks på `users.email`.
 * Krever minst to tegn i prefiks før kall (sjekkes av kaller).
 */
export async function queryUsersByEmailPrefix(
  ctx: QueryCtx,
  prefix: string,
  take: number,
): Promise<Doc<"users">[]> {
  const raw = prefix.trim().toLowerCase();
  if (raw.length < 2) {
    return [];
  }
  const upper = emailPrefixUpperBound(raw);
  const rows = await ctx.db
    .query("users")
    .withIndex("email", (q) => q.gte("email", raw).lt("email", upper))
    .take(take);
  return rows.filter((u) => u.email);
}
