import { beforeEach, describe, expect, it, vi } from "vitest";

import { authFetch, getJobs, register } from "./api";
import { __resetRefreshState, getAccessToken, setTokens } from "./auth";

function stubLocation() {
  const replace = vi.fn();
  Object.defineProperty(window, "location", {
    configurable: true,
    writable: true,
    value: { protocol: "http:", pathname: "/dashboard", search: "", replace },
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

function headersOf(call: unknown[]): Headers {
  return (call[1] as RequestInit).headers as Headers;
}

beforeEach(() => {
  __resetRefreshState();
  stubLocation();
});

describe("authFetch", () => {
  it("attaches the access token as a bearer header", async () => {
    setTokens({ access_token: "acc-1", refresh_token: "ref-1" });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({}));

    await authFetch("/api/shared/jobs");

    expect(headersOf(fetchMock.mock.calls[0]).get("Authorization")).toBe("Bearer acc-1");
  });

  it("sets a JSON content type for a plain body", async () => {
    setTokens({ access_token: "acc-1", refresh_token: "ref-1" });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({}));

    await authFetch("/api/x", { method: "POST", body: JSON.stringify({ a: 1 }) });

    expect(headersOf(fetchMock.mock.calls[0]).get("Content-Type")).toBe("application/json");
  });

  it("leaves Content-Type unset for FormData", async () => {
    // The browser has to append the multipart boundary itself. Naming the
    // type here strips it and the upload fails to parse server-side — which
    // is how both résumé upload and the unified apply endpoint would break.
    setTokens({ access_token: "acc-1", refresh_token: "ref-1" });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({}));

    const body = new FormData();
    body.append("files", new Blob(["cv"]), "cv.pdf");
    await authFetch("/api/shared/ingest", { method: "POST", body });

    expect(headersOf(fetchMock.mock.calls[0]).has("Content-Type")).toBe(false);
  });

  it("refreshes and retries once on a 401", async () => {
    setTokens({ access_token: "stale", refresh_token: "ref-1" });
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse({ detail: "expired" }, 401))
      .mockResolvedValueOnce(jsonResponse({ access_token: "fresh", refresh_token: "ref-2" }))
      .mockResolvedValueOnce(jsonResponse({ total: 0, applications: [] }));

    const res = await authFetch("/api/shared/jobs");

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(headersOf(fetchMock.mock.calls[2]).get("Authorization")).toBe("Bearer fresh");
  });

  it("gives up after a second 401 rather than looping", async () => {
    setTokens({ access_token: "stale", refresh_token: "ref-1" });
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse({ detail: "expired" }, 401))
      .mockResolvedValueOnce(jsonResponse({ access_token: "fresh", refresh_token: "ref-2" }))
      .mockResolvedValueOnce(jsonResponse({ detail: "forbidden" }, 401));

    const res = await authFetch("/api/shared/jobs");

    expect(res.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("refreshes up front when the access cookie has expired but the session hasn't", async () => {
    setTokens({ access_token: "acc-1", refresh_token: "ref-1" });
    document.cookie = "jobber_at=; Path=/; Max-Age=0";
    expect(getAccessToken()).toBeNull();

    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse({ access_token: "fresh", refresh_token: "ref-2" }))
      .mockResolvedValueOnce(jsonResponse({}));

    await authFetch("/api/shared/jobs");

    // Two calls, not three: the refresh happened before the request rather
    // than after a guaranteed 401.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0][0])).toContain("/api/auth/refresh");
    expect(headersOf(fetchMock.mock.calls[1]).get("Authorization")).toBe("Bearer fresh");
  });

  it("fires a single refresh for concurrent 401s", async () => {
    setTokens({ access_token: "stale", refresh_token: "ref-1" });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      if (String(input).includes("/api/auth/refresh")) {
        return Promise.resolve(
          jsonResponse({ access_token: "fresh", refresh_token: "ref-2" })
        );
      }
      return Promise.resolve(jsonResponse({ detail: "expired" }, 401));
    });

    await Promise.all([
      authFetch("/api/shared/jobs"),
      authFetch("/api/shared/jobs/stats"),
      authFetch("/api/gform/fill-form/history"),
    ]);

    const refreshCalls = fetchMock.mock.calls.filter((c) =>
      String(c[0]).includes("/api/auth/refresh")
    );
    expect(refreshCalls).toHaveLength(1);
  });
});

describe("error unwrapping", () => {
  it("throws the backend's detail string", async () => {
    setTokens({ access_token: "acc-1", refresh_token: "ref-1" });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ detail: "Full name is not set" }, 400)
    );

    await expect(getJobs()).rejects.toThrow("Full name is not set");
  });

  it("flattens a 422 validation array instead of rendering [object Object]", async () => {
    // FastAPI returns `detail` as a list for validation errors — which is
    // exactly what registration returns for a short password.
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse(
        {
          detail: [
            { loc: ["body", "password"], msg: "password must be at least 8 characters" },
          ],
        },
        422
      )
    );

    await expect(register("a@b.com", "short")).rejects.toThrow(
      "password must be at least 8 characters"
    );
  });

  it("falls back to the status code when there is no detail", async () => {
    setTokens({ access_token: "acc-1", refresh_token: "ref-1" });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({}, 500));

    await expect(getJobs()).rejects.toThrow("HTTP 500");
  });
});

describe("register and login", () => {
  it("do not attach a bearer header or trigger a refresh", async () => {
    // A stale cookie must not make a fresh sign-in attempt fire a refresh.
    setTokens({ access_token: "stale", refresh_token: "ref-1" });
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse({ access_token: "a", refresh_token: "b" }));

    await register("new@user.com", "hunter2hunter2");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(new Headers(init.headers).has("Authorization")).toBe(false);
  });
});
