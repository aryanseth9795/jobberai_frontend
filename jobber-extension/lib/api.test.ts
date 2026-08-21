import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_CONFIG } from "./config.js";
import { installFakeChrome } from "./testing/fakeChrome";

// api.js keeps its single-flight refresh promise in module scope, so each test
// gets a fresh module instance rather than inheriting the previous one's.
let api: typeof import("./api.js");
let tokens: typeof import("./tokens.js");

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(async () => {
  vi.resetModules();
  installFakeChrome();
  api = await import("./api.js");
  tokens = await import("./tokens.js");
});

describe("authFetch", () => {
  it("throws AuthExpired without calling the network when no token is stored", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(api.authFetch("/api/gform/fill-form")).rejects.toMatchObject({
      name: "AuthExpired",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("attaches the bearer token", async () => {
    await tokens.setTokens({ access_token: "good", refresh_token: "r" });
    const fetchMock = vi.fn(async () => jsonResponse(200, { ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await api.authFetch("/api/auth/me");

    const headers = new Headers(fetchMock.mock.calls[0][1].headers);
    expect(headers.get("Authorization")).toBe("Bearer good");
  });

  it("refreshes once and retries when the access token is stale", async () => {
    await tokens.setTokens({ access_token: "stale", refresh_token: "r1" });

    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      if (String(url).endsWith("/api/auth/refresh")) {
        return jsonResponse(200, { access_token: "fresh", refresh_token: "r2" });
      }
      const auth = new Headers(init.headers).get("Authorization");
      return auth === "Bearer stale"
        ? jsonResponse(401, { detail: "Could not validate credentials" })
        : jsonResponse(200, { ok: true });
    });
    vi.stubGlobal("fetch", fetchMock);

    expect(await api.authFetch("/api/auth/me")).toEqual({ ok: true });
    expect(await tokens.getTokens()).toEqual({
      access_token: "fresh",
      refresh_token: "r2",
    });
  });

  it("refreshes exactly once for three concurrent 401s", async () => {
    await tokens.setTokens({ access_token: "stale", refresh_token: "r1" });

    let refreshCalls = 0;
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      if (String(url).endsWith("/api/auth/refresh")) {
        refreshCalls += 1;
        // Delay so all three requests are genuinely in flight together.
        await new Promise((resolve) => setTimeout(resolve, 10));
        return jsonResponse(200, { access_token: "fresh", refresh_token: "r2" });
      }
      const auth = new Headers(init.headers).get("Authorization");
      return auth === "Bearer stale"
        ? jsonResponse(401, { detail: "nope" })
        : jsonResponse(200, { ok: true });
    });
    vi.stubGlobal("fetch", fetchMock);

    const results = await Promise.all([
      api.authFetch("/api/a"),
      api.authFetch("/api/b"),
      api.authFetch("/api/c"),
    ]);

    expect(refreshCalls).toBe(1);
    expect(results).toEqual([{ ok: true }, { ok: true }, { ok: true }]);
  });

  it("clears the tokens and throws AuthExpired when the refresh itself fails", async () => {
    await tokens.setTokens({ access_token: "stale", refresh_token: "dead" });

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        String(url).endsWith("/api/auth/refresh")
          ? jsonResponse(401, { detail: "bad refresh token" })
          : jsonResponse(401, { detail: "nope" }),
      ),
    );

    await expect(api.authFetch("/api/auth/me")).rejects.toMatchObject({
      name: "AuthExpired",
    });
    expect(await tokens.getTokens()).toBeNull();
  });

  it("turns the onboarding 403 into SetupIncomplete carrying its steps", async () => {
    await tokens.setTokens({ access_token: "good", refresh_token: "r" });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(403, {
          detail: {
            code: "onboarding_incomplete",
            message: "Your account setup isn't finished.",
            incomplete_steps: ["gemini", "resume"],
          },
        }),
      ),
    );

    await expect(api.authFetch("/api/gform/fill-form")).rejects.toMatchObject({
      name: "SetupIncomplete",
      steps: ["gemini", "resume"],
    });
  });

  it("turns a rejected fetch into NetworkError naming the configured host", async () => {
    await tokens.setTokens({ access_token: "good", refresh_token: "r" });
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }));

    // DEFAULT_CONFIG rather than the literal host: the claim is that the
    // error names *whatever* host is configured, so pinning a URL here just
    // makes this test fail again the next time the default moves.
    await expect(api.authFetch("/api/auth/me")).rejects.toMatchObject({
      name: "NetworkError",
      apiBase: DEFAULT_CONFIG.apiBase,
    });
  });
});

describe("login", () => {
  it("stores the returned pair", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse(200, { access_token: "a", refresh_token: "r" })),
    );

    await api.login("me@example.com", "pw");

    expect(await tokens.getTokens()).toEqual({ access_token: "a", refresh_token: "r" });
  });

  it("reports bad credentials as a plain message, not a status code", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse(401, { detail: "Incorrect email or password" })),
    );

    await expect(api.login("me@example.com", "wrong")).rejects.toMatchObject({
      name: "ApiError",
      message: "Wrong email or password.",
    });
  });
});
