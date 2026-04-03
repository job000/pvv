import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { escapeHtml } from "./lib/emailHtml";

export const runWeeklyDraftDigest = internalAction({
  args: {},
  handler: async (
    ctx,
  ): Promise<
    | { sent: number; recipients: number; reason: "no_api_key" }
    | { sent: number; recipients: number }
  > => {
    const key = process.env.RESEND_API_KEY;
    const from =
      process.env.RESEND_FROM_EMAIL ?? "FRO <onboarding@resend.dev>";
    const publicUrl = (process.env.PUBLIC_APP_URL ?? "http://localhost:3000").replace(
      /\/$/,
      "",
    );
    const now = Date.now();

    const targets = await ctx.runQuery(
      internal.weeklyDigestInternal.listWeeklyDraftDigestTargets,
      { now },
    );

    if (!key) {
      console.log(
        `[FRO] ukentlig utkast-sammendrag: ${targets.length} mottakere (RESEND_API_KEY mangler)`,
      );
      return { sent: 0, recipients: targets.length, reason: "no_api_key" };
    }

    let sent = 0;
    for (const t of targets) {
      const lines = t.items
        .slice(0, 40)
        .map((item) => {
          const link = `${publicUrl}/w/${item.workspaceId}/a/${item.assessmentId}`;
          const safe = escapeHtml(item.title);
          return `<li><a href="${link}">${safe}</a></li>`;
        })
        .join("");
      const more =
        t.items.length > 40
          ? `<p>… og ${t.items.length - 40} flere (åpne FRO for full liste).</p>`
          : "";

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [t.email],
          subject: `[FRO] Ukentlig oversikt: ${t.items.length} åpne vurderinger`,
          html: `<p>Hei,</p>
<p>Du har <strong>${t.items.length}</strong> vurdering(er) som ikke er markert som ferdig. Her er en rask liste:</p>
<ul>${lines}</ul>
${more}
<p>Du får denne e-posten fordi du er satt som eier (eller oppretter) av vurderingene. Den sendes omtrent én gang i uken når du har åpne saker.</p>
<p><a href="${publicUrl}/dashboard">Åpne FRO</a> · <a href="${publicUrl}/bruker/innstillinger">Varslingsinnstillinger</a></p>`,
        }),
      });
      if (!res.ok) {
        console.error(`Resend weekly digest for ${t.userId}:`, await res.text());
        continue;
      }
      await ctx.runMutation(internal.weeklyDigestInternal.markWeeklyDigestSent, {
        userId: t.userId,
        sentAt: now,
      });
      sent += 1;
    }
    return { sent, recipients: targets.length };
  },
});
