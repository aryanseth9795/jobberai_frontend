// lib/formState.js — owns the whole form_state_${tabId} lifecycle: read,
// write, staleness, form-identity binding, and cleanup.
//
// This logic used to live inline in background.js, untested, which is how a
// stored error could permanently lock a tab, a signed-out draft could
// survive to the next user, and an orphaned write could resurrect itself
// after the tab that owned it was long gone — nine review passes in a row.
// Everything here talks to chrome.storage.local / chrome.tabs only, so
// lib/testing/fakeChrome.ts can drive it directly in tests.

const PREFIX = "form_state_";

// A "loading" entry older than this is treated as abandoned rather than
// in-progress. The service worker that was writing it was almost certainly
// evicted — MV3 idle termination, an extension auto-update, a crash — before
// it ever reached a terminal state, and nothing else was going to clear it.
export const STALE_MS = 3 * 60 * 1000;

export function stateKey(tabId) {
  return `${PREFIX}${tabId}`;
}

export function isFormStateKey(key) {
  return typeof key === "string" && key.startsWith(PREFIX);
}

export function tabIdFromKey(key) {
  return Number(key.slice(PREFIX.length));
}

// Google Form URLs carry query strings and #fragments that vary between
// visits to the *same* form (?usp=header, a re-share link, ...) without the
// form itself being different. Comparing the raw string would drop a
// perfectly good draft on a reload; comparing only origin+pathname still
// tells two genuinely different forms apart, since the form id lives in the
// path.
export function sameFormUrl(a, b) {
  if (!a || !b) return false;
  try {
    const left = new URL(a);
    const right = new URL(b);
    return left.origin === right.origin && left.pathname === right.pathname;
  } catch {
    return false;
  }
}

// Returns the stored state for this tab, or null when: there isn't one, it
// was generated for a different form than currentUrl (C2), or it's a
// "loading" entry old enough that whatever was writing it is never coming
// back (I2).
export async function getFormState(tabId, currentUrl) {
  const key = stateKey(tabId);
  const stored = await chrome.storage.local.get(key);
  const state = stored[key];
  if (!state) return null;

  if (!sameFormUrl(state.formUrl, currentUrl)) return null;

  if (state.status === "loading" && Date.now() - (state.startedAt || 0) > STALE_MS) {
    return null;
  }

  return state;
}

// Writes the tab's draft — but only while the tab still exists. A handler
// can still be mid-flight, about to write its terminal state, after the tab
// that owns it has already closed (see chrome.tabs.onRemoved below, and I3).
// Writing anyway would resurrect an orphaned entry, keyed to a tab id Chrome
// will happily reuse for someone else's tab next session, that nothing will
// ever read or clear again.
export async function setFormState(tabId, state) {
  const alive = await chrome.tabs.get(tabId).catch(() => null);
  if (!alive) return;
  await chrome.storage.local.set({ [stateKey(tabId)]: state });
}

export async function clearFormState(tabId) {
  await chrome.storage.local.remove(stateKey(tabId));
}

// Wipes every tab's draft. Used on sign-out so the next person on a shared
// machine never inherits the previous account's generated answers (C2), and
// on sign-in so a fresh session always starts clean.
export async function clearAllFormStates() {
  const all = await chrome.storage.local.get(null);
  const keys = Object.keys(all).filter(isFormStateKey);
  if (keys.length) await chrome.storage.local.remove(keys);
}
