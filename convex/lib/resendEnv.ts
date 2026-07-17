import { PRODUCT_NAME } from "../../lib/brand";

/** Resend-miljø for Convex-actions (auth-reset, varsler, osv.). */
export function resendEnv() {
  const key =
    process.env.AUTH_RESEND_KEY?.trim() ||
    process.env.RESEND_API_KEY?.trim() ||
    "";
  const from =
    process.env.RESEND_FROM_EMAIL?.trim() ||
    `${PRODUCT_NAME} <onboarding@resend.dev>`;
  const publicUrl = (
    process.env.PUBLIC_APP_URL ??
    process.env.SITE_URL ??
    "http://localhost:3000"
  ).replace(/\/$/, "");
  return { key, from, publicUrl };
}

/**
 * Tillat logging av OTP i Convex-logger når Resend mangler.
 * Kun for lokal utvikling (SITE_URL/localhost) eller eksplisitt flagg.
 */
export function allowPasswordResetLogFallback(): boolean {
  if (process.env.PASSWORD_RESET_DEV_LOG === "1") return true;
  const site = (
    process.env.SITE_URL ??
    process.env.PUBLIC_APP_URL ??
    ""
  ).toLowerCase();
  return (
    site.includes("localhost") ||
    site.includes("127.0.0.1") ||
    site.includes("0.0.0.0")
  );
}
