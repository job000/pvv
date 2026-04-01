import { convexAuthNextjsMiddleware } from "@convex-dev/auth/nextjs/server";

/**
 * Sekunder — må være minst på linje med `session.totalDurationMs` i convex/auth.ts,
 * ellers slettes nettleserkapsler før Convex-sesjonen er utløpt og du «mister» innlogging visuelt.
 * 400 d ≈ vanlig øvre grense for førsteparts-cookies i moderne nettlesere.
 */
const AUTH_COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 400;

export default convexAuthNextjsMiddleware(undefined, {
  cookieConfig: {
    maxAge: AUTH_COOKIE_MAX_AGE_SEC,
  },
});

export const config = {
  matcher: [
    "/((?!.*\\..*|_next).*)",
    "/",
    "/(api|trpc)(.*)",
  ],
};
