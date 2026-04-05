/**
 * Gjør feil fra API/Convex lesbare for sluttbrukere — uten stack traces,
 * filstier eller [CONVEX …]-prefiks.
 */
export function formatUserFacingError(
  err: unknown,
  fallback = "Noe gikk galt. Prøv igjen.",
): string {
  const raw =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : "";

  if (!raw.trim()) {
    return fallback;
  }

  let cleaned = raw
    .replace(/\[CONVEX[^\]]*]\s*/g, "")
    .replace(/\[Request ID:\s*[^\]]+]\s*/g, "")
    .replace(/\s*Called by client\.?/gi, "")
    .replace(/^Uncaught Error:\s*/i, "")
    .replace(/^Server Error\s*/i, "")
    .trim();

  const lines = cleaned
    .split("\n")
    .map((l) =>
      l
        .trim()
        .replace(/^Uncaught Error:\s*/i, "")
        .replace(/^Server Error\s*$/i, "")
        .trim(),
    )
    .filter(Boolean);

  const humanLines = lines.filter(
    (l) =>
      !/^at\s+/i.test(l) &&
      !l.includes("/convex/") &&
      !l.includes(".ts:") &&
      !l.includes("async handler") &&
      !l.includes("requireUserId") &&
      !/^server error$/i.test(l),
  );

  const substantive = humanLines.find(
    (l) => l.length >= 8 && !/^server error$/i.test(l),
  );
  const candidate = substantive ?? humanLines[0] ?? lines[0] ?? "";

  if (!candidate) {
    return fallback;
  }

  if (
    candidate.length > 240 ||
    candidate.includes("../") ||
    /Uncaught Error/i.test(candidate)
  ) {
    return fallback;
  }

  const map: Record<string, string> = {
    "Du må være innlogget.": "Du må være innlogget. Prøv å logge inn på nytt.",
    "Invalid password": "Ugyldig passord eller e-post.",
    "Invalid credentials": "Ugyldig passord eller e-post.",
  };

  const normalized = candidate.replace(/\s+/g, " ").trim();
  if (map[normalized]) {
    return map[normalized];
  }

  for (const [k, v] of Object.entries(map)) {
    if (normalized.toLowerCase().includes(k.toLowerCase())) {
      return v;
    }
  }

  return normalized;
}
