const KEY = "jobber_config";

// Production. `getConfig()` spreads stored config over these, so anyone who
// set their own values in the settings panel keeps them — this only changes
// what a fresh install points at.
//
// Both are the same origin now: nginx serves the app at / and the API under
// /api/ on one host, so there is no separate api. subdomain to configure.
export const DEFAULT_CONFIG = {
  apiBase: "https://app.jobberai.aryantechie.in",
  appBase: "https://app.jobberai.aryantechie.in",
};

function normalize(url) {
  return url.trim().replace(/\/+$/, "");
}

export async function getConfig() {
  const stored = await chrome.storage.local.get(KEY);
  return { ...DEFAULT_CONFIG, ...(stored[KEY] || {}) };
}

// Accepts a partial patch. A blank or non-string value is ignored rather than
// stored — an empty apiBase would make every request fail with a confusing
// relative-URL error.
export async function setConfig(patch) {
  const next = { ...(await getConfig()) };
  for (const key of ["apiBase", "appBase"]) {
    const value = patch?.[key];
    if (typeof value === "string" && value.trim()) next[key] = normalize(value);
  }
  await chrome.storage.local.set({ [KEY]: next });
  return next;
}
