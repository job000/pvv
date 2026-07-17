import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import type { DataModel } from "./_generated/dataModel";
import { ResendOTPPasswordReset } from "./ResendOTPPasswordReset";

/**
 * Sesjon: maks tid fra innlogging + hvor lenge hvert refresh-token lever (ruller ved aktivitet).
 * Høyere inactiveDurationMs = du forblir innlogget selv etter lengre pauser mellom besøk.
 */
const MS_PER_DAY = 1000 * 60 * 60 * 24;

/** Maks innlogget tid fra første innlogging (opp til dette må du logge inn på nytt). */
const SESSION_TOTAL_DAYS = 400;
/** Tid før refresh-token utløper uten ny utstedelse — må være i tråd med vanlig bruk. */
const SESSION_INACTIVE_DAYS = 365;
/** JWT levetid — lengre gir færre stille feil ved kort nettverksavbrudd; refresh-token sikrer fortsatt utlogging ved tyveri. */
const JWT_DAYS = 7;

function requireEmail(params: Record<string, unknown>): string {
  const email = String(params.email ?? "")
    .trim()
    .toLowerCase();
  if (!email || !email.includes("@")) {
    throw new ConvexError("Ugyldig e-postadresse.");
  }
  return email;
}

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password<DataModel>({
      reset: ResendOTPPasswordReset,
      profile(params) {
        const email = requireEmail(params as Record<string, unknown>);
        const nameRaw = String(params.name ?? "").trim();
        const first = String(params.firstName ?? "").trim();
        const last = String(params.lastName ?? "").trim();
        const name =
          nameRaw ||
          [first, last].filter(Boolean).join(" ").trim() ||
          undefined;
        return {
          email,
          ...(name ? { name } : {}),
        };
      },
      validatePasswordRequirements: (password) => {
        if (password.length < 8) {
          throw new ConvexError("Passordet må være minst 8 tegn.");
        }
      },
    }),
  ],
  session: {
    totalDurationMs: MS_PER_DAY * SESSION_TOTAL_DAYS,
    inactiveDurationMs: MS_PER_DAY * SESSION_INACTIVE_DAYS,
  },
  jwt: {
    durationMs: MS_PER_DAY * JWT_DAYS,
  },
});
