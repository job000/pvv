import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { ComplianceReminderTarget } from "./reminderInternal";

export const runComplianceReminders = internalAction({
  args: {},
  handler: async (
    ctx,
  ): Promise<
    | { sent: number; targets: number; reason: "no_api_key" }
    | { sent: number; targets: number }
  > => {
    const key = process.env.RESEND_API_KEY;
    const from =
      process.env.RESEND_FROM_EMAIL ?? "PVV <onboarding@resend.dev>";
    const publicUrl = process.env.PUBLIC_APP_URL ?? "http://localhost:3000";

    const targets: ComplianceReminderTarget[] = await ctx.runQuery(
      internal.reminderInternal.listComplianceReminderTargets,
      { now: Date.now() },
    );

    if (!key) {
      console.log(
        `[PVV] compliance reminders: ${targets.length} mål (RESEND_API_KEY mangler — ingen e-post sendt)`,
      );
      return {
        sent: 0,
        targets: targets.length,
        reason: "no_api_key" as const,
      };
    }

    let sent = 0;
    for (const t of targets) {
      const link = `${publicUrl.replace(/\/$/, "")}/w/${t.workspaceId}/a/${t.assessmentId}`;
      const safeTitle = escapeHtml(t.title);
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [t.toEmail],
          subject: `[PVV] Påminnelse: ${t.title}`,
          html: `<p>Hei,</p>
<p>Risiko- og/eller personverndokumentasjon for vurderingen <strong>${safeTitle}</strong> er ikke merket som ferdig.</p>
<p><a href="${link}">Åpne vurderingen</a></p>
<p>Du mottar denne e-posten fordi du er eier av vurderingen. E-post sendes maks. én gang per uke per sak når dokumentasjon fortsatt mangler.</p>`,
        }),
      });
      if (!res.ok) {
        const err = await res.text();
        console.error(`Resend feilet for ${t.assessmentId}:`, err);
        continue;
      }
      await ctx.runMutation(internal.reminderInternal.markComplianceReminderSent, {
        assessmentId: t.assessmentId,
      });
      sent += 1;
    }
    return { sent, targets: targets.length };
  },
});

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
