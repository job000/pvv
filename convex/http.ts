import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { auth } from "./auth";

const http = httpRouter();

auth.addHttpRoutes(http);

async function verifyGithubSignature(
  body: string,
  signatureHeader: string | null,
  secret: string,
): Promise<boolean> {
  if (!signatureHeader?.startsWith("sha256=")) {
    return false;
  }
  const expectedHex = signatureHeader.slice(7);
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(body),
  );
  const hex = [...new Uint8Array(sig)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  if (hex.length !== expectedHex.length) {
    return false;
  }
  let out = 0;
  for (let i = 0; i < hex.length; i++) {
    out |= hex.charCodeAt(i) ^ expectedHex.charCodeAt(i);
  }
  return out === 0;
}

http.route({
  path: "/github/webhook",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const secret = process.env.GITHUB_WEBHOOK_SECRET;
    if (!secret) {
      return new Response("Webhook not configured", { status: 503 });
    }
    const bodyText = await req.text();
    const sig = req.headers.get("X-Hub-Signature-256");
    const ok = await verifyGithubSignature(bodyText, sig, secret);
    if (!ok) {
      return new Response("Invalid signature", { status: 401 });
    }
    const event = req.headers.get("X-GitHub-Event");
    if (event !== "issues") {
      return new Response("ok", { status: 200 });
    }
    let payload: {
      repository?: { full_name?: string };
      issue?: { number?: number; state?: string };
    };
    try {
      payload = JSON.parse(bodyText) as typeof payload;
    } catch {
      return new Response("Bad JSON", { status: 400 });
    }
    const repo = payload.repository?.full_name?.toLowerCase();
    const num = payload.issue?.number;
    const state = payload.issue?.state;
    if (
      repo === undefined ||
      num === undefined ||
      typeof num !== "number" ||
      Number.isNaN(num)
    ) {
      return new Response("ok", { status: 200 });
    }
    if (state !== "open" && state !== "closed") {
      return new Response("ok", { status: 200 });
    }
    await ctx.runMutation(internal.githubTasks.applyWebhookIssueState, {
      repoFullName: repo,
      issueNumber: num,
      state,
    });
    return new Response("ok", { status: 200 });
  }),
});

export default http;
