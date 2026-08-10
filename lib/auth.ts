// Token storage, refresh, and logout for the JobberAI backend.
//
// The backend authenticates on an `Authorization: Bearer <jwt>` header and
// never reads a cookie, so tokens are stored in *JS-readable* cookies rather
// than httpOnly ones — the client has to be able to read the access token to
// build that header. That is no weaker than localStorage, and because the
// server ignores cookies entirely there is no CSRF surface: a forged
// cross-site request carries the cookie but cannot set the header.
//
// Cookies (rather than localStorage) specifically so that middleware.ts, which
// runs on the server and cannot see localStorage, can redirect an
// unauthenticated visitor *before* a protected page renders.

import { ACCESS_COOKIE, API_BASE, REFRESH_COOKIE } from "./config";

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type?: string;
}

export { ACCESS_COOKIE, REFRESH_COOKIE };

// Mirrors backend/shared/config.py:30-31 (access_token_expire_minutes = 15,
// refresh_token_expire_days = 30). The cookie outliving its JWT would only
// mean sending a token the backend rejects; the cookie dying first costs a
// pointless 401. Keeping them equal makes "cookie present" mean "token
// plausibly live".
const ACCESS_MAX_AGE = 15 * 60;
const REFRESH_MAX_AGE = 30 * 24 * 60 * 60;

function canUseCookies(): boolean {
  return typeof document !== "undefined";
}

function writeCookie(name: string, value: string, maxAgeSeconds: number): void {
  if (!canUseCookies()) return;
  const secure =
    typeof location !== "undefined" && location.protocol === "https:" ? "; Secure" : "";
  document.cookie =
    `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax${secure}`;
}

function readCookie(name: string): string | null {
  if (!canUseCookies()) return null;
  for (const part of document.cookie.split(";")) {
    const raw = part.trim();
    if (raw.startsWith(`${name}=`)) {
      return decodeURIComponent(raw.slice(name.length + 1));
    }
  }
  return null;
}

function deleteCookie(name: string): void {
  if (!canUseCookies()) return;
  document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export function setTokens(pair: TokenPair): void {
  writeCookie(ACCESS_COOKIE, pair.access_token, ACCESS_MAX_AGE);
  writeCookie(REFRESH_COOKIE, pair.refresh_token, REFRESH_MAX_AGE);
}

export function clearTokens(): void {
  deleteCookie(ACCESS_COOKIE);
  deleteCookie(REFRESH_COOKIE);
}

export function getAccessToken(): string | null {
  return readCookie(ACCESS_COOKIE);
}

export function getRefreshToken(): string | null {
  return readCookie(REFRESH_COOKIE);
}

/** Is there a session at all? Keyed on the *refresh* token, which outlives the
 * 15-minute access token — an idle user still has a recoverable session. */
export function isAuthenticated(): boolean {
  return getRefreshToken() !== null;
}

/** Drop the session and send the user to /login, preserving where they were
 * so login can send them back. Uses a hard navigation because this is reached
 * from plain async code, not only from inside a React tree. */
export function forceLogout(): void {
  clearTokens();
  if (typeof window === "undefined") return;
  const here = window.location.pathname + window.location.search;
  const next = here && here !== "/login" ? `?next=${encodeURIComponent(here)}` : "";
  window.location.replace(`/login${next}`);
}

// ── Single-flight refresh ────────────────────────────────────────────────
//
// A page like /dashboard fires several requests at once. Once the access token
// expires they all 401 together, and a naive implementation would fire one
// /refresh per failed request — a burst of concurrent refreshes racing to
// overwrite each other's cookies. Holding the in-flight attempt in a
// module-level promise means N concurrent 401s produce exactly one network
// call, and every caller awaits the same answer.

let refreshInFlight: Promise<string | null> | null = null;

async function requestRefresh(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    forceLogout();
    return null;
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
  } catch {
    // A network failure says nothing about whether the token is still valid.
    // Logging out here would destroy a perfectly good session over a dropped
    // wifi connection, so leave the tokens alone and let the caller surface
    // the error.
    return null;
  }

  if (!res.ok) {
    // The server actively rejected the refresh token — expired, revoked, or
    // malformed. This one *is* terminal.
    forceLogout();
    return null;
  }

  const pair: TokenPair = await res.json();
  setTokens(pair);
  return pair.access_token;
}

export function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = requestRefresh().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

/** Test seam: drops any in-flight refresh so each test starts clean. */
export function __resetRefreshState(): void {
  refreshInFlight = null;
}
