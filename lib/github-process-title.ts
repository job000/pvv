/**
 * Tolker titler som `[P01] Prosessnavn` fra GitHub-prosjektkort (issues/utkast).
 */
export function parseSuggestedCodeAndNameFromGithubTitle(title: string): {
  code: string;
  name: string;
} {
  const t = title.trim();
  const m = t.match(/^\[([^\]]+)\]\s*([\s\S]+)$/);
  if (m) {
    const rawCode = m[1].trim();
    const code = rawCode
      .toUpperCase()
      .replace(/\s+/g, "-")
      .replace(/[^A-Z0-9_-]/g, "")
      .slice(0, 40);
    const name = m[2].trim().slice(0, 240) || rawCode;
    if (code.length > 0) {
      return { code, name };
    }
  }
  const name = t.slice(0, 240) || "Prosess";
  const fallback = name
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 12);
  return {
    code: fallback.length > 0 ? fallback : "NY",
    name,
  };
}
