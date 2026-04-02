import { v } from "convex/values";
import { internalAction } from "./_generated/server";

const confirmationAnswerValidator = v.object({
  questionLabel: v.string(),
  answerLabel: v.string(),
});

export const sendSubmissionConfirmation = internalAction({
  args: {
    toEmail: v.string(),
    toName: v.optional(v.string()),
    formTitle: v.string(),
    submittedAt: v.number(),
    answers: v.array(confirmationAnswerValidator),
  },
  handler: async (ctx, args) => {
    const key = process.env.RESEND_API_KEY;
    const from =
      process.env.RESEND_FROM_EMAIL ?? "PVV <onboarding@resend.dev>";
    if (!key) {
      console.log(
        `[PVV] intake confirmation skipped for ${args.toEmail} (RESEND_API_KEY mangler)`,
      );
      return { ok: false as const, reason: "no_api_key" as const };
    }

    const greeting = args.toName?.trim() ? `Hei ${escapeHtml(args.toName)},` : "Hei,";
    const submittedAt = new Date(args.submittedAt).toLocaleString("nb-NO", {
      dateStyle: "full",
      timeStyle: "short",
    });
    const answerListHtml = args.answers
      .map(
        (answer) =>
          `<li><strong>${escapeHtml(answer.questionLabel)}</strong><br/>${escapeHtml(answer.answerLabel)}</li>`,
      )
      .join("");

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [args.toEmail],
        subject: `[PVV] Bekreftelse: ${args.formTitle}`,
        html: `<p>${greeting}</p>
<p>Vi bekrefter at du har sendt inn svar på skjemaet <strong>${escapeHtml(args.formTitle)}</strong>.</p>
<p><strong>Innsendt:</strong> ${escapeHtml(submittedAt)}</p>
<p>Her er en kopi av svarene dine:</p>
<ul>${answerListHtml}</ul>
<p>Denne e-posten er sendt fordi skjemaet er satt opp med bekreftelse til svarers e-post.</p>`,
      }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Intake confirmation failed for ${args.toEmail}:`, errorText);
      return { ok: false as const, reason: "provider_error" as const };
    }
    return { ok: true as const };
  },
});

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
