import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";

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

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Password],
  session: {
    totalDurationMs: MS_PER_DAY * SESSION_TOTAL_DAYS,
    inactiveDurationMs: MS_PER_DAY * SESSION_INACTIVE_DAYS,
  },
  jwt: {
    durationMs: MS_PER_DAY * JWT_DAYS,
  },
});
