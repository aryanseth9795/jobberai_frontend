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

import { REFRESH_COOKIE } from "./lib/config";

const PUBLIC_PATHS = ["/login", "/register"];

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

  if (!hasSession && !isPublic) {
    const url = new URL("/login", req.url);
    if (pathname !== "/") url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }

  // Someone with a live session has no business on the login form.
  if (hasSession && isPublic) {
    return NextResponse.redirect(new URL("/", req.url));
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
