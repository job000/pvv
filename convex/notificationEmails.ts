import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { escapeHtml } from "./lib/emailHtml";

function resendEnv() {
  const key = process.env.RESEND_API_KEY;
  const from =
    process.env.RESEND_FROM_EMAIL ?? "FRO <onboarding@resend.dev>";
  const publicUrl = process.env.PUBLIC_APP_URL ?? "http://localhost:3000";
  return { key, from, publicUrl: publicUrl.replace(/\/$/, "") };
}

export const sendPendingWorkspaceInvite = internalAction({
  args: { inviteId: v.id("workspaceInvites") },
  handler: async (ctx, args) => {
    const { key, from, publicUrl } = resendEnv();
    const payload = await ctx.runQuery(
      internal.notificationEmailInternal.getPendingWorkspaceInviteEmailPayload,
      { inviteId: args.inviteId },
    );
    if (!payload) {
      return { ok: false as const, reason: "missing_invite" as const };
    }
    if (!key) {
      console.log(
        `[FRO] workspace-invite e-post til ${payload.toEmail} hoppet over (RESEND_API_KEY mangler)`,
      );
      return { ok: false as const, reason: "no_api_key" as const };
    }
    const dashboardUrl = `${publicUrl}/dashboard`;
    const safeWs = escapeHtml(payload.workspaceName);
    const safeInviter = escapeHtml(payload.inviterName);
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [payload.toEmail],
        subject: `[FRO] Invitasjon til arbeidsområdet ${payload.workspaceName}`,
        html: `<p>Hei,</p>
<p><strong>${safeInviter}</strong> har invitert deg til arbeidsområdet <strong>${safeWs}</strong> med rollen <strong>${escapeHtml(payload.roleLabel)}</strong>.</p>
<p>Logg inn i FRO med <strong>denne e-postadressen</strong>. Under <strong>Oversikt</strong> kan du godta eller avslå invitasjonen.</p>
<p><a href="${dashboardUrl}">Åpne FRO</a></p>
<p>Hvis du ikke forventet denne invitasjonen, kan du avslå i appen eller se bort fra e-posten.</p>`,
      }),
    });
    if (!res.ok) {
      console.error("Resend workspace-invite:", await res.text());
      return { ok: false as const, reason: "resend_error" as const };
    }
    return { ok: true as const };
  },
});

export const sendWorkspaceUserInviteEmail = internalAction({
  args: {
    userId: v.id("users"),
    workspaceId: v.id("workspaces"),
    role: v.union(
      v.literal("admin"),
      v.literal("member"),
      v.literal("viewer"),
    ),
  },
  handler: async (ctx, args) => {
    const { key, from, publicUrl } = resendEnv();
    const payload = await ctx.runQuery(
      internal.notificationEmailInternal.getWorkspaceUserInviteEmailPayload,
      args,
    );
    if (!payload) {
      return { ok: false as const, reason: "skipped" as const };
    }
    if (!key) {
      return { ok: false as const, reason: "no_api_key" as const };
    }
    const dashboardUrl = `${publicUrl}/dashboard`;
    const safeWs = escapeHtml(payload.workspaceName);
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [payload.toEmail],
        subject: `[FRO] Invitasjon til ${payload.workspaceName}`,
        html: `<p>Hei,</p>
<p>Du er invitert til arbeidsområdet <strong>${safeWs}</strong> som <strong>${escapeHtml(payload.roleLabel)}</strong>.</p>
<p>Logg inn og gå til <strong>Oversikt</strong> for å <strong>godta</strong> eller <strong>avslå</strong>.</p>
<p><a href="${dashboardUrl}">Åpne FRO</a></p>
<p>Du kan skru av slike varsler under Varslinger i FRO.</p>`,
      }),
    });
    if (!res.ok) {
      console.error("Resend workspace user-invite:", await res.text());
      return { ok: false as const, reason: "resend_error" as const };
    }
    return { ok: true as const };
  },
});

export const sendPendingAssessmentInvite = internalAction({
  args: { inviteId: v.id("assessmentInvites") },
  handler: async (ctx, args) => {
    const { key, from, publicUrl } = resendEnv();
    const payload = await ctx.runQuery(
      internal.notificationEmailInternal.getPendingAssessmentInviteEmailPayload,
      { inviteId: args.inviteId },
    );
    if (!payload) {
      return { ok: false as const, reason: "missing_invite" as const };
    }
    if (!key) {
      console.log(
        `[FRO] vurderings-invitasjon til ${payload.toEmail} hoppet over (RESEND_API_KEY mangler)`,
      );
      return { ok: false as const, reason: "no_api_key" as const };
    }
    const link = `${publicUrl}/w/${payload.workspaceId}/a/${payload.assessmentId}`;
    const safeTitle = escapeHtml(payload.assessmentTitle);
    const safeWs = escapeHtml(payload.workspaceName);
    const safeInviter = escapeHtml(payload.inviterName);
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [payload.toEmail],
        subject: `[FRO] Invitasjon til vurdering: ${payload.assessmentTitle}`,
        html: `<p>Hei,</p>
<p><strong>${safeInviter}</strong> har invitert deg til vurderingen <strong>${safeTitle}</strong> i <strong>${safeWs}</strong> med rollen <strong>${escapeHtml(payload.roleLabel)}</strong>.</p>
<p>Logg inn i FRO med <strong>denne e-postadressen</strong> for å godta:</p>
<p><a href="${link}">Åpne vurderingen</a></p>
<p>Hvis du ikke forventet denne invitasjonen, kan du se bort fra e-posten.</p>`,
      }),
    });
    if (!res.ok) {
      console.error("Resend assessment-invite:", await res.text());
      return { ok: false as const, reason: "resend_error" as const };
    }
    return { ok: true as const };
  },
});

export const sendWorkspaceDirectAddEmail = internalAction({
  args: {
    userId: v.id("users"),
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const { key, from, publicUrl } = resendEnv();
    const payload = await ctx.runQuery(
      internal.notificationEmailInternal.getWorkspaceDirectAddEmailPayload,
      args,
    );
    if (!payload) {
      return { ok: false as const, reason: "skipped" as const };
    }
    if (!key) {
      return { ok: false as const, reason: "no_api_key" as const };
    }
    const link = `${publicUrl}/w/${args.workspaceId}`;
    const safeWs = escapeHtml(payload.workspaceName);
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [payload.toEmail],
        subject: `[FRO] Du er lagt til i ${payload.workspaceName}`,
        html: `<p>Hei,</p>
<p>Du er nå medlem av arbeidsområdet <strong>${safeWs}</strong>.</p>
<p><a href="${link}">Åpne arbeidsområdet</a></p>
<p>Du kan skru av slike varsler under Varslinger i FRO.</p>`,
      }),
    });
    if (!res.ok) {
      console.error("Resend workspace direct-add:", await res.text());
      return { ok: false as const, reason: "resend_error" as const };
    }
    return { ok: true as const };
  },
});

export const sendAssessmentDirectAddEmail = internalAction({
  args: {
    userId: v.id("users"),
    assessmentId: v.id("assessments"),
  },
  handler: async (ctx, args) => {
    const { key, from, publicUrl } = resendEnv();
    const payload = await ctx.runQuery(
      internal.notificationEmailInternal.getAssessmentDirectAddEmailPayload,
      args,
    );
    if (!payload) {
      return { ok: false as const, reason: "skipped" as const };
    }
    if (!key) {
      return { ok: false as const, reason: "no_api_key" as const };
    }
    const link = `${publicUrl}/w/${payload.workspaceId}/a/${payload.assessmentId}`;
    const safeTitle = escapeHtml(payload.assessmentTitle);
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [payload.toEmail],
        subject: `[FRO] Du er invitert til vurdering: ${payload.assessmentTitle}`,
        html: `<p>Hei,</p>
<p>Du er lagt til på vurderingen <strong>${safeTitle}</strong>.</p>
<p><a href="${link}">Åpne vurderingen</a></p>
<p>Du kan skru av slike varsler under Varslinger i FRO.</p>`,
      }),
    });
    if (!res.ok) {
      console.error("Resend assessment direct-add:", await res.text());
      return { ok: false as const, reason: "resend_error" as const };
    }
    return { ok: true as const };
  },
});
