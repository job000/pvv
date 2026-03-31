import { convexAuthNextjsMiddleware } from "@convex-dev/auth/nextjs/server";

/** Sekunder — matcher lang server-side sesjon (Convex Auth), slik at informasjonskapsler ikke er «session only». */
const AUTH_COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 180;

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
