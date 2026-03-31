/** Delt GitHub GraphQL-klient for Convex-actions (unngå duplikat rate limit-håndtering). */

export const GITHUB_GRAPHQL_ENDPOINT = "https://api.github.com/graphql";

export type GithubGraphqlPayload = {
  data?: unknown;
  errors?: { message: string }[];
};

export async function githubGraphql(
  token: string,
  query: string,
  variables: Record<string, unknown>,
): Promise<GithubGraphqlPayload> {
  const res = await fetch(GITHUB_GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });
  const text = await res.text();
  let json: GithubGraphqlPayload;
  try {
    json = JSON.parse(text) as GithubGraphqlPayload;
  } catch {
    throw new Error(
      `GitHub GraphQL: ugyldig svar (HTTP ${res.status}). ${text.slice(0, 200)}`,
    );
  }
  if (!res.ok) {
    if (res.status === 403 || res.status === 429) {
      const err = new Error(
        "GitHub API: forespørselgrensen er nådd eller tilgang avvist (HTTP " +
          res.status +
          "). Vent og prøv igjen.",
      );
      (err as Error & { githubRateLimited?: boolean }).githubRateLimited = true;
      throw err;
    }
    throw new Error(
      `GitHub GraphQL: HTTP ${res.status}. ${text.slice(0, 240)}`,
    );
  }
  if (json.errors?.length) {
    const msg =
      json.errors.map((e) => e.message).join("; ") || "GraphQL feilet.";
    if (/rate limit/i.test(msg)) {
      const err = new Error(
        "GitHub API: forespørselgrensen er nådd (rate limit). Vent noen minutter og prøv igjen.",
      );
      (err as Error & { githubRateLimited?: boolean }).githubRateLimited = true;
      throw err;
    }
    throw new Error(msg);
  }
  return json;
}

function errorMessageFromUnknown(e: unknown): string {
  if (typeof e === "string") {
    return e;
  }
  if (e instanceof Error) {
    return e.message;
  }
  if (e && typeof e === "object" && "message" in e) {
    const m = (e as { message?: unknown }).message;
    if (typeof m === "string") {
      return m;
    }
  }
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

export function isGithubGraphqlRateLimitError(e: unknown): boolean {
  if (e && typeof e === "object" && "githubRateLimited" in e) {
    if ((e as { githubRateLimited?: boolean }).githubRateLimited === true) {
      return true;
    }
  }
  const msg = errorMessageFromUnknown(e);
  return /rate limit|forespørselgrensen|HTTP 403|HTTP 429/i.test(msg);
}
