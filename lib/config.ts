// Shared client configuration.
//
// API_BASE lives here rather than in lib/api.ts because lib/auth.ts also needs
// it (for the token-refresh call) and lib/api.ts imports lib/auth.ts — putting
// it in either module would make that a cycle.

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// Cookie names live here too, because middleware.ts reads them on the server
// (edge runtime) while lib/auth.ts writes them in the browser. Keeping the
// single source of truth in a module that touches neither `document` nor
// `next/server` is what lets both sides import it safely.
export const ACCESS_COOKIE = "jobber_at";
export const REFRESH_COOKIE = "jobber_rt";
