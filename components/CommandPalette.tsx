"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, CornerDownLeft, Search } from "lucide-react";

import { cn } from "@/lib/cn";
import { getJobs, type JobApplication } from "@/lib/api";
import { statusMeta } from "@/lib/status";
import { ALL_NAV_ITEMS, NAV } from "@/components/shell/nav";
import { Spinner } from "@/components/ui";

interface Result {
  id: string;
  title: string;
  subtitle: string;
  group: string;
  icon: React.ReactNode;
  run: () => void;
}

const SEARCH_DEBOUNCE_MS = 220;

/**
 * Match a query against a label.
 *
 * Substring, not fuzzy. A fuzzy matcher on a list this small mostly produces
 * confident nonsense — "sett" scoring a hit on "Follow up" because the letters
 * appear in order — and there are eight destinations, so the honest match is
 * the one the user can predict.
 */
function matches(query: string, ...fields: string[]): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return fields.some((field) => field.toLowerCase().includes(needle));
}

/**
 * Mounted only while open, so closing it discards its state.
 *
 * The alternative — staying mounted and clearing the query in an effect when
 * an `open` prop flips — is a render with stale contents followed by a render
 * that fixes it, on every single open. Unmounting says the same thing to
 * React and needs no effect to enforce it.
 */
export function CommandPalette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [searching, setSearching] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const trimmed = query.trim();
  const searchable = trimmed.length >= 2;

  // Applications come from the server, so the query is debounced and every
  // in-flight response is checked against the query that is current when it
  // lands — otherwise a slow reply for "ac" overwrites a fast one for "acme".
  useEffect(() => {
    if (trimmed.length < 2) return;

    let cancelled = false;
    const timer = setTimeout(() => {
      if (cancelled) return;
      setSearching(true);
      getJobs({ search: trimmed, limit: 6 })
        .then((response) => {
          if (!cancelled) setApplications(response.applications);
        })
        .catch(() => {
          // A failed search shows no application results. Surfacing an error
          // here would put a red box over a list the user is still typing into.
          if (!cancelled) setApplications([]);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trimmed]);

  // Derived rather than cleared in an effect: below two characters there are
  // no application results, whatever the last response happened to contain.
  const found = searchable ? applications : [];

  const go = useCallback(
    (href: string) => {
      onClose();
      router.push(href);
    },
    [onClose, router]
  );

  const results = useMemo<Result[]>(() => {
    const pages: Result[] = NAV.flatMap((group) =>
      group.items
        .filter((item) => matches(query, item.label, item.hint))
        .map((item) => {
          const Icon = item.icon;
          return {
            id: `nav:${item.href}`,
            title: item.label,
            subtitle: item.hint,
            group: group.name,
            icon: <Icon size={15} />,
            run: () => go(item.href),
          };
        })
    );

    const jobs: Result[] = found.map((app) => ({
      id: `job:${app._id}`,
      title: app.company_name || "Unknown company",
      subtitle: [app.role, statusMeta(app.status).label].filter(Boolean).join(" · "),
      group: "Applications",
      icon: <Building2 size={15} />,
      // The dashboard opens the detail view for an id in the query string.
      run: () => go(`/dashboard?application=${encodeURIComponent(app._id)}`),
    }));

    return [...pages, ...jobs];
  }, [query, found, go]);

  // Clamped at read time rather than corrected in an effect. The list shrinks
  // as the user types, so the stored cursor can point past the end; clamping
  // here keeps the highlight on the last row without a render that shows the
  // out-of-range value first. It stays *stored* unclamped so that deleting a
  // character puts the highlight back where it was.
  const cursorAt = Math.min(cursor, Math.max(0, results.length - 1));

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${cursorAt}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [cursorAt]);

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setCursor(results.length ? (cursorAt + 1) % results.length : 0);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setCursor(results.length ? (cursorAt - 1 + results.length) % results.length : 0);
    } else if (event.key === "Enter") {
      event.preventDefault();
      results[cursorAt]?.run();
    } else if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  };

  let lastGroup = "";

  return (
    <div
      className="fixed inset-0 z-[90] flex items-start justify-center p-4 pt-[12vh] animate-fade"
      style={{ background: "var(--overlay)" }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search and navigate"
        className="w-full max-w-lg overflow-hidden rounded-lg border border-border animate-slide"
        style={{ background: "var(--surface)", boxShadow: "var(--shadow-md)" }}
      >
        <div className="flex items-center gap-2.5 border-b border-border px-3.5">
          <Search size={15} className="shrink-0 text-faint" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Go to a page, or search your applications"
            aria-label="Search"
            className="h-11 flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-faint"
          />
          {searchable && searching && <Spinner size={13} />}
        </div>

        <div ref={listRef} className="max-h-[52vh] overflow-y-auto py-1.5" role="listbox">
          {results.length === 0 ? (
            <p className="px-3.5 py-6 text-center text-[12.5px] text-muted">
              Nothing matches “{query.trim()}”.
            </p>
          ) : (
            results.map((result, index) => {
              const showGroup = result.group !== lastGroup;
              lastGroup = result.group;
              const active = index === cursorAt;
              return (
                <div key={result.id}>
                  {showGroup && <p className="label px-3.5 pb-1 pt-2">{result.group}</p>}
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    data-index={index}
                    onMouseEnter={() => setCursor(index)}
                    onClick={result.run}
                    className={cn(
                      "flex w-full items-center gap-2.5 px-3.5 py-2 text-left transition-colors",
                      active ? "text-text" : "text-muted"
                    )}
                    style={active ? { background: "var(--accent-soft)" } : undefined}
                  >
                    <span className="shrink-0 text-faint">{result.icon}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium">{result.title}</span>
                      <span className="block truncate text-[11.5px] text-faint">{result.subtitle}</span>
                    </span>
                    {active && <CornerDownLeft size={13} className="shrink-0 text-faint" />}
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="flex items-center gap-3 border-t border-border px-3.5 py-2 text-[11px] text-faint">
          <span>
            <kbd className="font-mono">↑↓</kbd> navigate
          </span>
          <span>
            <kbd className="font-mono">↵</kbd> open
          </span>
          <span>
            <kbd className="font-mono">esc</kbd> close
          </span>
        </div>
      </div>
    </div>
  );
}

/** Every destination the palette can reach, for the test that asserts it and
 *  the sidebar cannot disagree. */
export const PALETTE_DESTINATIONS = ALL_NAV_ITEMS.map((item) => item.href);
