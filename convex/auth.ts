import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";

/** ~6 mnd total levetid; utlogging etter lang inaktivitet (90 dager). */
const MS_PER_DAY = 1000 * 60 * 60 * 24;

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Password],
  session: {
    totalDurationMs: MS_PER_DAY * 180,
    inactiveDurationMs: MS_PER_DAY * 90,
  },
  /** Lengre enn standard 1 t — færre token-oppdateringer; refresh håndteres fortsatt av klienten. */
  jwt: {
    durationMs: 1000 * 60 * 60 * 24,
  },
});
