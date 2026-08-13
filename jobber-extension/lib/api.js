import { getConfig } from "./config.js";
import { clearTokens, getTokens, setTokens } from "./tokens.js";
import { ApiError, AuthExpired, NetworkError, SetupIncomplete } from "./errors.js";

// Single-flight guard. N concurrent 401s must produce ONE refresh call, not N:
// per-question regenerate can fire several requests at once, and racing
// refreshes would both rotate the token and overwrite each other's result.
//
// A service-worker teardown resets this to undefined. That is fine — workers
// never run concurrently with themselves, so the guard holds for the window
// in which it can matter.
let refreshPromise = null;

async function rawFetch(url, options) {
  try {
    return await fetch(url, options);
  } catch {
    const { apiBase } = await getConfig();
    throw new NetworkError(apiBase);
  }
}

async function readDetail(response) {
  try {
    return (await response.json())?.detail ?? null;
  } catch {
    return null;
  }
}

function detailMessage(detail) {
  if (typeof detail === "string") return detail;
  return detail?.message || null;
}

async function refreshTokens() {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const stored = await getTokens();
      if (!stored?.refresh_token) throw new AuthExpired();

      const { apiBase } = await getConfig();
      const response = await rawFetch(`${apiBase}/api/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: stored.refresh_token }),
      });

      if (!response.ok) {
        await clearTokens();
        throw new AuthExpired();
      }

      const pair = await response.json();
      await setTokens(pair);
      return pair;
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

export async function authFetch(path, options = {}) {
  const stored = await getTokens();
  if (!stored?.access_token) throw new AuthExpired();

  const { apiBase } = await getConfig();

  const send = (accessToken) =>
    rawFetch(`${apiBase}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
        Authorization: `Bearer ${accessToken}`,
      },
    });

  let response = await send(stored.access_token);

  if (response.status === 401) {
    const pair = await refreshTokens();
    response = await send(pair.access_token);
  }

  if (response.status === 401) {
    await clearTokens();
    throw new AuthExpired();
  }

  if (response.status === 403) {
    const detail = await readDetail(response);
    if (detail?.code === "onboarding_incomplete") {
      throw new SetupIncomplete(detail.incomplete_steps || []);
    }
    throw new ApiError(403, detailMessage(detail));
  }

  if (!response.ok) {
    throw new ApiError(response.status, detailMessage(await readDetail(response)));
  }

  return response.json();
}

export async function login(email, password) {
  const { apiBase } = await getConfig();
  const response = await rawFetch(`${apiBase}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  // The backend's own wording here is about credentials being invalid; say
  // that plainly rather than surfacing a 401 the user cannot act on.
  if (response.status === 401) throw new ApiError(401, "Wrong email or password.");
  if (!response.ok) {
    throw new ApiError(response.status, detailMessage(await readDetail(response)));
  }

  const pair = await response.json();
  await setTokens(pair);
  return pair;
}
