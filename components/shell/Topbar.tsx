"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Menu, Monitor, Moon, Search, Settings, Sun } from "lucide-react";

import { cn } from "@/lib/cn";
import { clearTokens } from "@/lib/auth";
import { useClientValue } from "@/lib/clientStore";
import { useTheme, type ThemeChoice } from "@/components/ThemeProvider";
import { Button } from "@/components/ui";
import { activeItem } from "./nav";

const MODIFIER_LABEL = () =>
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl";

function ThemeToggle() {
  const { choice, setChoice } = useTheme();
  const options: { value: ThemeChoice; icon: React.ReactNode; label: string }[] = [
    { value: "light", icon: <Sun size={13} />, label: "Light" },
    { value: "dark", icon: <Moon size={13} />, label: "Dark" },
    { value: "system", icon: <Monitor size={13} />, label: "Match system" },
  ];

  return (
    <div
      role="group"
      aria-label="Theme"
      className="hidden items-center gap-0.5 rounded-md border border-border p-0.5 sm:flex"
      style={{ background: "var(--surface-2)" }}
    >
      {options.map((option) => {
        const active = choice === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => setChoice(option.value)}
            aria-pressed={active}
            title={option.label}
            className={cn(
              "rounded-sm p-1.5 transition-colors",
              active ? "text-text" : "text-faint hover:text-muted"
            )}
            style={active ? { background: "var(--surface)", boxShadow: "var(--shadow-sm)" } : undefined}
          >
            {option.icon}
            <span className="sr-only">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function AccountMenu({ email }: { email: string | null }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const signOut = () => {
    clearTokens();
    // Hard navigation, not router.push: the route gate in proxy.ts runs on the
    // server and has to re-evaluate against the now-absent cookie.
    window.location.replace("/login");
  };

  const initial = (email ?? "?").charAt(0).toUpperCase();

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold transition-opacity hover:opacity-85"
        style={{ background: "var(--accent)", color: "var(--text-on-accent)" }}
      >
        {initial}
        <span className="sr-only">Account menu</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-9 z-50 w-56 overflow-hidden rounded-md border border-border animate-rise"
          style={{ background: "var(--surface)", boxShadow: "var(--shadow-md)" }}
        >
          <div className="border-b border-border px-3 py-2.5">
            <p className="label mb-0.5">Signed in as</p>
            <p className="truncate font-mono text-[12px]">{email ?? "—"}</p>
          </div>
          <Link
            href="/settings"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-[13px] text-muted transition-colors hover:bg-surface-2 hover:text-text"
          >
            <Settings size={14} /> Settings
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={signOut}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-muted transition-colors hover:bg-surface-2 hover:text-text"
          >
            <LogOut size={14} /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export function Topbar({
  email,
  onOpenNav,
  onOpenSearch,
}: {
  email: string | null;
  onOpenNav: () => void;
  onOpenSearch: () => void;
}) {
  const pathname = usePathname();
  const current = activeItem(pathname);

  // `navigator` does not exist during the server render, and guessing wrong
  // renders a shortcut hint the user's keyboard does not have. "Ctrl" is the
  // server snapshot because it is the more common keyboard, so the correction
  // on a Mac is the rarer of the two.
  const modifier = useClientValue(MODIFIER_LABEL, "Ctrl");

  return (
    <header
      className="sticky top-0 z-30 flex items-center gap-3 border-b border-border px-3"
      style={{ height: "var(--topbar-h)", background: "var(--surface)" }}
    >
      <Button variant="ghost" size="sm" onClick={onOpenNav} aria-label="Open navigation" className="lg:hidden">
        <Menu size={16} />
      </Button>

      <div className="min-w-0 flex-1">
        <h1 className="truncate font-display text-[14px] font-semibold">{current?.label ?? "Jobber"}</h1>
      </div>

      <button
        type="button"
        onClick={onOpenSearch}
        className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5 text-[12px] text-faint transition-colors hover:border-[var(--border-strong)] hover:text-muted"
        style={{ background: "var(--surface-2)" }}
      >
        <Search size={13} />
        <span className="hidden sm:inline">Search</span>
        <kbd className="hidden font-mono text-[10px] opacity-70 sm:inline">{modifier}K</kbd>
      </button>

      <ThemeToggle />
      <AccountMenu email={email} />
    </header>
  );
}
