"use client";

import { useCallback, useEffect, useState } from "react";

import { cn } from "@/lib/cn";
import { getMe } from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";
import { CommandPalette } from "@/components/CommandPalette";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

const COLLAPSE_KEY = "jobber-sidebar-collapsed";

/**
 * The frame every signed-in page renders inside.
 *
 * This replaces six separately maintained inline `<header>` blocks — one per
 * page, each linking to a different subset of the others, none of them
 * carrying the account controls (which is why `AccountBar` existed as a strip
 * bolted above them all). Navigation is now defined once in `nav.ts` and read
 * by the sidebar and the command palette together.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  // Read after mount rather than during render: localStorage does not exist on
  // the server, and reading it in an initialiser makes the first client render
  // disagree with the markup it is hydrating.
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      /* private mode — the rail just starts expanded every time */
    }
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((current) => {
      const next = !current;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        /* not persisting a sidebar width is not worth surfacing */
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!isAuthenticated()) return;
    let cancelled = false;
    getMe()
      .then((me) => {
        if (!cancelled) setEmail(me.email);
      })
      .catch(() => {
        // Cosmetic: the avatar falls back to "?". Real session handling lives
        // in authFetch, which has already redirected if the session is gone.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg)" }}>
      {/* Desktop rail. Width is animated rather than the whole layout, so the
          content column reflows once instead of every frame. */}
      <aside
        className="fixed inset-y-0 left-0 z-40 hidden transition-[width] duration-200 lg:block"
        style={{ width: collapsed ? "var(--sidebar-w-collapsed)" : "var(--sidebar-w)" }}
      >
        <Sidebar collapsed={collapsed} onToggle={toggleCollapsed} />
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden animate-fade"
          style={{ background: "var(--overlay)" }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setDrawerOpen(false);
          }}
        >
          <div className="h-full w-[var(--sidebar-w)] animate-rise">
            <Sidebar collapsed={false} onToggle={() => setDrawerOpen(false)} onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}

      {/* The rail is `fixed`, so the content column is pushed clear of it by
          padding — but only at `lg`, where the rail actually occupies space.
          Below that it is a drawer and the offset must be zero, which an
          inline `paddingLeft` cannot express. Hence the custom property: the
          value is dynamic, and the breakpoint that consumes it is a class. */}
      <div
        className={cn(
          "flex min-h-screen min-w-0 flex-1 flex-col transition-[padding] duration-200",
          "lg:pl-[var(--rail)]"
        )}
        style={{ ["--rail" as string]: collapsed ? "var(--sidebar-w-collapsed)" : "var(--sidebar-w)" }}
      >
        <Topbar
          email={email}
          onOpenNav={() => setDrawerOpen(true)}
          onOpenSearch={() => setPaletteOpen(true)}
        />
        <main className="min-w-0 flex-1">{children}</main>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}

/** Standard page padding and max width. Every page inside the shell wraps its
 *  content in this so the gutters and the measure match across the app rather
 *  than being re-chosen per page, which is how the old headers drifted. */
export function PageBody({
  children,
  className,
  wide = false,
}: {
  children: React.ReactNode;
  className?: string;
  /** Data views (the table, the board) want the full width; forms and reading
   *  views want a measure that does not run to 1400px. */
  wide?: boolean;
}) {
  return (
    <div className={cn("mx-auto w-full px-4 py-5 sm:px-6", wide ? "max-w-[1400px]" : "max-w-3xl", className)}>
      {children}
    </div>
  );
}
