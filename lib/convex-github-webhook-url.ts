/**
 * Full webhook-URL som skal legges inn i GitHub (Repository → Webhooks).
 *
 * Prioritet:
 * 1. `NEXT_PUBLIC_GITHUB_WEBHOOK_URL` — full URL hvis du vil overstyre (f.eks. annet domene).
 * 2. Avledet fra `NEXT_PUBLIC_CONVEX_URL` (…convex.cloud → …convex.site).
 */
export function getConvexGithubWebhookUrl(): string | null {
  const explicit = process.env.NEXT_PUBLIC_GITHUB_WEBHOOK_URL?.trim();
  if (explicit) {
    return explicit.replace(/\/$/, "");
  }
  const u = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!u) return null;
  try {
    const url = new URL(u);
    const host = url.hostname.replace(/\.convex\.cloud$/i, ".convex.site");
    return `${url.protocol}//${host}/github/webhook`;
  } catch {
    return null;
  }
}
