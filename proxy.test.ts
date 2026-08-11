// @vitest-environment node

import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { proxy } from "./proxy";

function request(path: string, cookie?: string): NextRequest {
  return new NextRequest(new URL(path, "http://localhost:3000"), {
    headers: cookie ? { cookie } : {},
  });
}

/** A signed-in user who has not finished setup. */
const SESSION = "jobber_rt=refresh-token-value";
/** A signed-in user who has. Both gates are cookie-presence checks, so the
 *  two are independent and every combination is reachable. */
const READY = "jobber_rt=refresh-token-value; jobber_ob=1";

function locationOf(res: Response): URL | null {
  const location = res.headers.get("location");
  return location ? new URL(location) : null;
}

describe("the session gate", () => {
  it("redirects an anonymous visitor to /login", () => {
    const res = proxy(request("/dashboard"));

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("remembers where the visitor was headed, query string included", () => {
    const res = proxy(request("/dashboard?status=sent"));

    expect(locationOf(res)!.searchParams.get("next")).toBe("/dashboard?status=sent");
  });

  it("does not add a next param for the root path", () => {
    const res = proxy(request("/"));

    expect(locationOf(res)!.searchParams.has("next")).toBe(false);
  });

  it("lets a session through", () => {
    const res = proxy(request("/dashboard", READY));

    expect(res.headers.get("location")).toBeNull();
  });

  it("gates on the refresh cookie, not the 15-minute access cookie", () => {
    // An idle user still holds a refresh token after the access token dies.
    // Gating on jobber_at would bounce them to /login mid-session even though
    // a silent refresh would have worked.
    const res = proxy(request("/dashboard", "jobber_rt=still-here; jobber_ob=1"));

    expect(res.headers.get("location")).toBeNull();
  });

  it("does not treat a lone access cookie as a session", () => {
    const res = proxy(request("/dashboard", "jobber_at=orphan"));

    expect(res.headers.get("location")).toContain("/login");
  });

  it("leaves the login page reachable when signed out", () => {
    const res = proxy(request("/login"));

    expect(res.headers.get("location")).toBeNull();
  });

  it("pushes a signed-in user off the login and register pages", () => {
    for (const path of ["/login", "/register"]) {
      const res = proxy(request(path, READY));
      expect(locationOf(res)!.pathname).toBe("/");
    }
  });
});

describe("the onboarding gate", () => {
  it("sends a signed-in user who has not finished setup to the wizard", () => {
    for (const path of ["/", "/dashboard", "/settings", "/pipeline"]) {
      expect(locationOf(proxy(request(path, SESSION)))!.pathname).toBe("/onboarding");
    }
  });

  it("lets that user reach the wizard itself", () => {
    // Redirecting /onboarding to /onboarding is an infinite loop, and the
    // browser is what finds out.
    expect(proxy(request("/onboarding", SESSION)).headers.get("location")).toBeNull();
  });

  it("keeps a finished user out of the wizard", () => {
    expect(locationOf(proxy(request("/onboarding", READY)))!.pathname).toBe("/dashboard");
  });

  it("checks authentication before setup", () => {
    // An anonymous visitor has no onboarding state to speak of. Sending them
    // to the wizard would strand them on a page whose every request 401s.
    expect(locationOf(proxy(request("/onboarding")))!.pathname).toBe("/login");
  });

  it("does not accept the hint cookie as a substitute for a session", () => {
    // The hint is not a credential — it says nothing about who you are. On its
    // own it must not get anybody past the session gate.
    expect(locationOf(proxy(request("/dashboard", "jobber_ob=1")))!.pathname).toBe("/login");
  });

  it("is a hint only, which is why the API re-checks", () => {
    // Presence, never validity — exactly like the session gate above. A forged
    // cookie buys one page render, and then the first API call returns 403 and
    // lib/api.ts sends the user back here. Pinned so nobody later "fixes" this
    // by trying to verify setup at the edge, which would put a network round
    // trip in front of every navigation.
    expect(proxy(request("/dashboard", "jobber_rt=x; jobber_ob=anything")).headers.get("location")).toBeNull();
  });
});
