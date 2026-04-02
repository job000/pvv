import {
  convexAuthNextjsMiddleware,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";

/**
 * Seconds — must be at least as long as `session.totalDurationMs` in convex/auth.ts,
 * otherwise browser cookies expire before the Convex session, causing visual logouts.
 * 400 d ≈ practical upper bound for first-party cookies in modern browsers.
 */
const AUTH_COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 400;

const IS_DEV = process.env.NODE_ENV === "development";

export default convexAuthNextjsMiddleware(
  async (request, { convexAuth }) => {
    const isAuth = await convexAuth.isAuthenticated();
    const pathname = new URL(request.url).pathname;

    if (IS_DEV) {
      console.debug(
        `[auth-proxy] ${request.method} ${pathname} | authenticated=${isAuth}`,
      );
    }

    const isPublicRoute =
      pathname === "/" ||
      pathname === "/sign-in" ||
      pathname === "/sign-up" ||
      pathname.startsWith("/s/") ||
      pathname === "/manifest.webmanifest" ||
      pathname === "/sw.js" ||
      pathname === "/icon" ||
      pathname === "/apple-icon";

    if (!isAuth && !isPublicRoute) {
      if (IS_DEV) {
        console.debug(
          `[auth-proxy] Not authenticated, redirecting to /sign-in`,
        );
      }
      return nextjsMiddlewareRedirect(
        request,
        `/sign-in?next=${encodeURIComponent(pathname)}`,
      );
    }
  },
  {
    cookieConfig: {
      maxAge: AUTH_COOKIE_MAX_AGE_SEC,
    },
    verbose: IS_DEV,
  },
);

export const config = {
  matcher: [
    "/((?!.*\\..*|_next).*)",
    "/",
    "/(api|trpc)(.*)",
  ],
};
