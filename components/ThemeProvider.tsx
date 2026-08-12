"use client";

import { createContext, useCallback, useContext, useSyncExternalStore } from "react";

import { usePersistedChoice, write } from "@/lib/clientStore";

export type ThemeChoice = "system" | "light" | "dark";

const STORAGE_KEY = "jobber-theme";
const CHOICES = ["system", "light", "dark"] as const;

/**
 * Runs before first paint, inlined into <head>.
 *
 * Without it the server sends markup with no `data-theme`, the browser paints
 * the light palette from bare `:root`, and only then does React hydrate and
 * stamp the attribute — a white flash on every hard navigation for anyone
 * using dark mode. Because it is inline and synchronous, the attribute is on
 * <html> before the first pixel.
 *
 * "system" deliberately writes *no* attribute rather than resolving the
 * preference itself: with nothing stamped, the `prefers-color-scheme` media
 * query in globals.css is what decides, so a user who changes their OS theme
 * while the tab is open follows along with no JavaScript involved.
 */
export const THEME_SCRIPT = `
(function () {
  try {
    var choice = localStorage.getItem(${JSON.stringify(STORAGE_KEY)});
    if (choice === "light" || choice === "dark") {
      document.documentElement.setAttribute("data-theme", choice);
    }
  } catch (e) {
    /* Private mode denies localStorage. Falling through leaves the system
       preference in charge, which is the right default anyway. */
  }
})();
`;

interface ThemeApi {
  /** What the user picked, which may be "system". */
  choice: ThemeChoice;
  /** What is actually on screen right now. */
  resolved: "light" | "dark";
  setChoice: (choice: ThemeChoice) => void;
}

const ThemeContext = createContext<ThemeApi | null>(null);

function apply(choice: ThemeChoice) {
  const root = document.documentElement;
  if (choice === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", choice);
}

// The OS preference, as an external store. Subscribing rather than reading
// once is what makes a "system" choice follow the OS flipping at sunset with
// the tab already open.
function subscribeSystem(onChange: () => void): () => void {
  const query = window.matchMedia("(prefers-color-scheme: dark)");
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function readSystem(): "light" | "dark" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Both of these render as their server snapshot during hydration, so the
  // markup matches; the real values arrive on the same pass React does for
  // any external store. The inline THEME_SCRIPT has meanwhile already put the
  // correct attribute on <html>, so nothing flashes while that happens.
  const choice = usePersistedChoice<ThemeChoice>(STORAGE_KEY, CHOICES, "system");
  const system = useSyncExternalStore(subscribeSystem, readSystem, () => "light" as const);

  const resolved = choice === "system" ? system : choice;

  const setChoice = useCallback((next: ThemeChoice) => {
    apply(next);
    // Writing notifies every reader, in this tab and — via the `storage`
    // event — in the others. `system` is stored as the absence of a value so
    // that the media query stays in charge.
    write(STORAGE_KEY, next === "system" ? null : next);
  }, []);

  return (
    <ThemeContext.Provider value={{ choice, resolved, setChoice }}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeApi {
  const api = useContext(ThemeContext);
  if (!api) throw new Error("useTheme must be used inside <ThemeProvider>");
  return api;
}
