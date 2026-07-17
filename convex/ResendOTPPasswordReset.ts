import { Email } from "@convex-dev/auth/providers/Email";
import { RandomReader, generateRandomString } from "@oslojs/crypto/random";
import { ConvexError } from "convex/values";
import { Resend as ResendAPI } from "resend";
import { PRODUCT_NAME } from "../lib/brand";
import {
  allowPasswordResetLogFallback,
  resendEnv,
} from "./lib/resendEnv";

/**
 * OTP via Resend for glemt-passord (Password-providerens `reset`).
 * Bruker AUTH_RESEND_KEY eller RESEND_API_KEY.
 *
 * Uten nøkkel på localhost: koden logges i Convex-logger slik at flyten
 * kan testes lokalt. I øvrige miljøer feiler sending med tydelig melding.
 */
export const ResendOTPPasswordReset = Email({
  id: "resend-otp",
  maxAge: 60 * 15, // 15 minutter
  async generateVerificationToken() {
    const random: RandomReader = {
      read(bytes) {
        crypto.getRandomValues(bytes);
      },
    };
    return generateRandomString(random, "0123456789", 8);
  },
  async sendVerificationRequest({ identifier: email, token }) {
    const { key, from } = resendEnv();

    if (!key) {
      const msg =
        `[Zorlin] Passordreset-kode for ${email}: ${token}` +
        ` (RESEND_API_KEY / AUTH_RESEND_KEY mangler — e-post ikke sendt)`;
      console.error(msg);
      if (allowPasswordResetLogFallback()) {
        return;
      }
      throw new ConvexError(
        "E-post for passordreset er ikke konfigurert. Sett RESEND_API_KEY i Convex-miljøet.",
      );
    }

    const resend = new ResendAPI(key);
    const { error } = await resend.emails.send({
      from,
      to: [email],
      subject: `Tilbakestill passord i ${PRODUCT_NAME}`,
      text:
        `Hei!\n\n` +
        `Din kode for å tilbakestille passordet i ${PRODUCT_NAME} er: ${token}\n\n` +
        `Koden er gyldig i 15 minutter. Hvis du ikke ba om dette, kan du ignorere e-posten.\n`,
      html:
        `<p>Hei!</p>` +
        `<p>Din kode for å tilbakestille passordet i <strong>${PRODUCT_NAME}</strong> er:</p>` +
        `<p style="font-size:24px;letter-spacing:0.2em;font-weight:700">${token}</p>` +
        `<p style="color:#64748b;font-size:14px">Koden er gyldig i 15 minutter. Hvis du ikke ba om dette, kan du ignorere e-posten.</p>`,
    });

    if (error) {
      console.error("Resend password reset:", error);
      throw new ConvexError("Kunne ikke sende e-post. Prøv igjen senere.");
    }
  },
});
