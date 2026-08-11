"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type ThemeChoice = "system" | "light" | "dark";

const STORAGE_KEY = "jobber-theme";

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

function systemPrefersDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function apply(choice: ThemeChoice) {
  const root = document.documentElement;
  if (choice === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", choice);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // "system" on the server and on the first client render, so hydration
  // matches the markup. The inline script has already put the right attribute
  // on <html>; the effect below reconciles React's state with it.
  const [choice, setChoiceState] = useState<ThemeChoice>("system");
  const [resolved, setResolved] = useState<"light" | "dark">("light");

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(STORAGE_KEY);
    } catch {
      /* see THEME_SCRIPT */
    }
    const initial: ThemeChoice = stored === "light" || stored === "dark" ? stored : "system";
    setChoiceState(initial);
    setResolved(initial === "system" ? (systemPrefersDark() ? "dark" : "light") : initial);
  }, []);

  // Only matters while the choice is "system" — but the listener is cheap and
  // unconditional, and the guard inside keeps an explicit choice from being
  // overridden when the OS flips at sunset.
  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (choice === "system") setResolved(query.matches ? "dark" : "light");
    };
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [choice]);

  const setChoice = useCallback((next: ThemeChoice) => {
    setChoiceState(next);
    setResolved(next === "system" ? (systemPrefersDark() ? "dark" : "light") : next);
    apply(next);
    try {
      if (next === "system") localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* The theme still applies for this session; it just will not persist. */
    }
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
