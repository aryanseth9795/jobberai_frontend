import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ACCESS_COOKIE,
  __resetRefreshState,
  clearTokens,
  getAccessToken,
  getRefreshToken,
  isAuthenticated,
  refreshAccessToken,
  setTokens,
} from "./auth";

/** Replace window.location with a stub whose replace() we can assert on. */
function stubLocation(protocol = "http:") {
  const replace = vi.fn();
  Object.defineProperty(window, "location", {
    configurable: true,
    writable: true,
    value: { protocol, pathname: "/dashboard", search: "", replace },
  });
  return replace;
}

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

beforeEach(() => {
  __resetRefreshState();
  stubLocation();
});

describe("cookie storage", () => {
  it("round-trips a token pair", () => {
    setTokens({ access_token: "acc-1", refresh_token: "ref-1" });

    expect(getAccessToken()).toBe("acc-1");
    expect(getRefreshToken()).toBe("ref-1");
  });

  it("reports a session from the refresh token, which outlives the access token", () => {
    setTokens({ access_token: "acc-1", refresh_token: "ref-1" });
    // Simulate the 15-minute access cookie expiring while the 30-day refresh
    // cookie is still there.
    document.cookie = `${ACCESS_COOKIE}=; Path=/; Max-Age=0`;

    expect(getAccessToken()).toBeNull();
    expect(isAuthenticated()).toBe(true);
  });

  it("clears both cookies on logout", () => {
    setTokens({ access_token: "acc-1", refresh_token: "ref-1" });
    clearTokens();

    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
    expect(isAuthenticated()).toBe(false);
  });

  it("marks cookies Secure only over https", () => {
    // Capture the raw cookie strings: jsdom parses and discards the
    // attributes, so the only way to assert on `Secure` is to intercept the
    // setter. Defining an own property shadows the prototype accessor;
    // deleting it puts the real one back.
    const written: string[] = [];
    Object.defineProperty(document, "cookie", {
      configurable: true,
      get: () => "",
      set: (v: string) => {
        written.push(v);
      },
    });

    try {
      stubLocation("http:");
      setTokens({ access_token: "a", refresh_token: "b" });
      expect(written).not.toHaveLength(0);
      expect(written.every((c) => !c.includes("Secure"))).toBe(true);

      written.length = 0;
      stubLocation("https:");
      setTokens({ access_token: "a", refresh_token: "b" });
      expect(written).not.toHaveLength(0);
      expect(written.every((c) => c.includes("Secure"))).toBe(true);
    } finally {
      delete (document as unknown as Record<string, unknown>).cookie;
    }
  });
});

describe("refresh", () => {
  it("stores the new pair and returns the new access token", async () => {
    setTokens({ access_token: "old", refresh_token: "ref-1" });
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse({ access_token: "new", refresh_token: "ref-2" }));

    const token = await refreshAccessToken();

    expect(token).toBe("new");
    expect(getAccessToken()).toBe("new");
    expect(getRefreshToken()).toBe("ref-2");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("sends the stored refresh token in the body", async () => {
    setTokens({ access_token: "old", refresh_token: "ref-1" });
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse({ access_token: "new", refresh_token: "ref-2" }));

    await refreshAccessToken();

    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(String(init?.body))).toEqual({ refresh_token: "ref-1" });
  });

  it("makes exactly ONE network call for concurrent refreshes", async () => {
    // The single-flight guarantee. A page firing several requests at once
    // will see them all 401 together; without the shared promise each one
    // would start its own refresh, and the racing responses would overwrite
    // each other's cookies.
    setTokens({ access_token: "old", refresh_token: "ref-1" });

    let release!: (r: Response) => void;
    const pending = new Promise<Response>((resolve) => {
      release = resolve;
    });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockReturnValue(pending);

    const all = Promise.all([
      refreshAccessToken(),
      refreshAccessToken(),
      refreshAccessToken(),
    ]);
    release(jsonResponse({ access_token: "new", refresh_token: "ref-2" }));
    const results = await all;

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(results).toEqual(["new", "new", "new"]);
  });

  it("allows a fresh attempt once the previous one settles", async () => {
    setTokens({ access_token: "old", refresh_token: "ref-1" });
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse({ access_token: "new", refresh_token: "ref-2" }));

    await refreshAccessToken();
    await refreshAccessToken();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("logs out when the server rejects the refresh token", async () => {
    const replace = stubLocation();
    setTokens({ access_token: "old", refresh_token: "ref-1" });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ detail: "expired" }, 401));

    const token = await refreshAccessToken();

    expect(token).toBeNull();
    expect(getRefreshToken()).toBeNull();
    expect(replace).toHaveBeenCalledWith("/login?next=%2Fdashboard");
  });

  it("keeps the session when the network fails", async () => {
    // A dropped connection says nothing about whether the token is valid.
    // Logging out here would destroy a good session over a wifi blip.
    const replace = stubLocation();
    setTokens({ access_token: "old", refresh_token: "ref-1" });
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("network down"));

    const token = await refreshAccessToken();

    expect(token).toBeNull();
    expect(getRefreshToken()).toBe("ref-1");
    expect(replace).not.toHaveBeenCalled();
  });

  it("logs out immediately when there is no refresh token at all", async () => {
    const replace = stubLocation();
    const fetchMock = vi.spyOn(globalThis, "fetch");

    const token = await refreshAccessToken();

    expect(token).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(replace).toHaveBeenCalled();
  });
});
