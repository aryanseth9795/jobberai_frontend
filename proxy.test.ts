// @vitest-environment node

import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { proxy } from "./proxy";

function request(path: string, cookie?: string): NextRequest {
  return new NextRequest(new URL(path, "http://localhost:3000"), {
    headers: cookie ? { cookie } : {},
  });
}

const SESSION = "jobber_rt=refresh-token-value";

describe("proxy", () => {
  it("redirects an anonymous visitor to /login", () => {
    const res = proxy(request("/dashboard"));

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("remembers where the visitor was headed", () => {
    const res = proxy(request("/dashboard?status=sent"));

    const location = new URL(res.headers.get("location")!);
    expect(location.searchParams.get("next")).toBe("/dashboard?status=sent");
  });

  it("does not add a next param for the root path", () => {
    const res = proxy(request("/"));

    expect(new URL(res.headers.get("location")!).searchParams.has("next")).toBe(false);
  });

  it("lets a session through", () => {
    const res = proxy(request("/dashboard", SESSION));

    expect(res.headers.get("location")).toBeNull();
  });

  it("gates on the refresh cookie, not the 15-minute access cookie", () => {
    // An idle user still holds a refresh token after the access token dies.
    // Gating on jobber_at would bounce them to /login mid-session even though
    // a silent refresh would have worked.
    const res = proxy(request("/dashboard", "jobber_rt=still-here"));

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
      const res = proxy(request(path, SESSION));
      expect(new URL(res.headers.get("location")!).pathname).toBe("/");
    }
  });
});
