// Route protection.
//
// Runs on the server before a protected page renders, which is the whole
// reason tokens live in cookies rather than localStorage — this cannot see
// localStorage, so a client-side guard would have to let the protected page
// start rendering before it could redirect.
//
// Named `proxy.ts` rather than `middleware.ts`: Next 16 deprecated the
// middleware file convention in favour of this one, and warns about it on
// every build.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { ONBOARDED_COOKIE, REFRESH_COOKIE } from "./lib/config";

const PUBLIC_PATHS = ["/login", "/register"];

const ONBOARDING_PATH = "/onboarding";

/**
 * Gate on the *refresh* cookie, not the access cookie.
 *
 * The access token lives 15 minutes. Gating on it would bounce a logged-in
 * user to /login the first time they idled through lunch, even though a
 * silent refresh would have succeeded. The 30-day refresh cookie is the real
 * "is there a session here" signal.
 *
 * This checks presence only — never validity. Verifying the signature is the
 * backend's job, and duplicating it here would mean shipping the JWT secret
 * to the edge. A stale-but-present token therefore passes middleware, 401s at
 * the API, and gets cleaned up by the refresh path in lib/auth.ts. That is
 * the intended flow, not a hole.
 */
export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const hasSession = req.cookies.has(REFRESH_COOKIE);
  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
  const isOnboarding = pathname === ONBOARDING_PATH;

  if (!hasSession && !isPublic) {
    const url = new URL("/login", req.url);
    if (pathname !== "/") url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }

  // Someone with a live session has no business on the login form.
  if (hasSession && isPublic) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  // ── The onboarding gate, edge half ──
  //
  // Presence-only, exactly like the session check above and for exactly the
  // same reason: the truth lives on the server, which re-derives all four
  // steps on every request and answers 403 until they are done. This cookie
  // only avoids rendering a page the user is about to be thrown out of.
  //
  // Forging it therefore buys one page render: the first API call that page
  // makes returns the 403, and lib/api.ts clears the cookie and redirects
  // here. That is the same "stale-but-present token passes middleware and gets
  // cleaned up by the API" flow the session gate already relies on.
  if (hasSession) {
    const onboarded = req.cookies.has(ONBOARDED_COOKIE);
    if (!onboarded && !isOnboarding) {
      return NextResponse.redirect(new URL(ONBOARDING_PATH, req.url));
    }
    // Finished users have no route back into the wizard. Without this, the
    // last step's own redirect would race the cookie write and bounce.
    if (onboarded && isOnboarding) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  // Everything except Next's own assets and static files. /api is excluded
  // because the backend is a separate origin — nothing under /api is served
  // by this app.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|txt|xml)$).*)",
  ],
};
