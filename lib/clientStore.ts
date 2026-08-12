"use client";

import { useSyncExternalStore } from "react";

/**
 * Reading browser-only state without lying to the server renderer.
 *
 * The obvious version of this — `useState(false)` plus an effect that reads
 * `localStorage` and calls `setState` — renders once with the wrong value and
 * once with the right one, which React 19 flags (`set-state-in-effect`)
 * because it is a cascading render on every mount. `useSyncExternalStore` is
 * the built-in answer: it takes a server snapshot and a client snapshot
 * separately, so hydration matches the markup and the real value arrives
 * without a second render pass of our making.
 *
 * The subscription is shared, which buys something the effect version could
 * not: writes notify every component reading the same key, and the browser's
 * own `storage` event carries the change to other tabs. Change the theme in
 * one tab and the others follow.
 */

const listeners = new Set<() => void>();

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  // `storage` fires only in *other* tabs, which is exactly the half this
  // module cannot see by itself.
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Tell every reader in this tab that a key changed. */
function notify(): void {
  for (const listener of listeners) listener();
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    // Private mode denies access entirely. Callers fall back to their default,
    // which is always the "nothing has been chosen yet" state.
    return null;
  }
}

export function write(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* Not persisting a preference is not worth interrupting anyone over. */
  }
  notify();
}

/**
 * A persisted string, narrowed to a known set of values.
 *
 * Anything unrecognised — a stale key from an older build, a value typed into
 * devtools — reads as `fallback` rather than being passed through, so a bad
 * entry cannot put the UI into a state it has no styles for.
 */
export function usePersistedChoice<T extends string>(
  key: string,
  allowed: readonly T[],
  fallback: T
): T {
  return useSyncExternalStore(
    subscribe,
    () => {
      const stored = read(key);
      return allowed.includes(stored as T) ? (stored as T) : fallback;
    },
    () => fallback
  );
}

/** A persisted boolean, stored as "1" / "0". */
export function usePersistedFlag(key: string, fallback = false): boolean {
  return useSyncExternalStore(
    subscribe,
    () => {
      const stored = read(key);
      return stored === null ? fallback : stored === "1";
    },
    () => fallback
  );
}

export function writeFlag(key: string, value: boolean): void {
  write(key, value ? "1" : "0");
}

// A stable identity, so passing it to useSyncExternalStore does not resubscribe
// on every render.
const NEVER_CHANGES = () => () => {};

/**
 * A value that only exists in the browser and never changes afterwards —
 * whether the platform is a Mac, whether a codec is supported.
 *
 * `server` is what renders on the server and during hydration, so it should be
 * the safer of the two guesses rather than the more common one.
 */
export function useClientValue<T>(read: () => T, server: T): T {
  return useSyncExternalStore(NEVER_CHANGES, read, () => server);
}
