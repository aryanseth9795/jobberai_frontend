"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Settings as SettingsIcon } from "lucide-react";

import { getMe } from "@/lib/api";
import { clearTokens, isAuthenticated } from "@/lib/auth";

const HIDDEN_ON = ["/login", "/register"];

/**
 * A slim account strip above whatever nav each page already renders.
 *
 * Every page in this app builds its own header inline, so rather than
 * rewriting six of them, the account controls — who you're signed in as,
 * settings, sign out — live in the root layout. None of the existing navs
 * carry them, so there is nothing to duplicate.
 */
export default function AccountBar() {
  const pathname = usePathname();
  const [email, setEmail] = useState<string | null>(null);

  const hidden = HIDDEN_ON.includes(pathname);

  useEffect(() => {
    if (hidden || !isAuthenticated()) return;
    let cancelled = false;
    getMe()
      .then((me) => {
        if (!cancelled) setEmail(me.email);
      })
      .catch(() => {
        // A failure here is cosmetic — the bar just shows no address. The
        // real session handling lives in authFetch, which has already
        // redirected if the session is genuinely gone.
      });
    return () => {
      cancelled = true;
    };
  }, [hidden, pathname]);

  if (hidden) return null;

  const handleLogout = () => {
    clearTokens();
    // Hard navigation so middleware re-evaluates against the cleared cookie.
    window.location.replace("/login");
  };

  return (
    <div
      style={{
        background: "var(--bg-secondary)",
        borderBottom: "1px solid var(--border)",
        fontSize: 12,
      }}
    >
      <div className="max-w-6xl mx-auto px-6 py-1.5 flex items-center justify-end gap-4">
        {email && <span style={{ color: "var(--text-muted)" }}>{email}</span>}
        <Link
          href="/settings"
          className="inline-flex items-center gap-1"
          style={{ color: "var(--text-secondary)", textDecoration: "none" }}
        >
          <SettingsIcon size={13} /> Settings
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          className="inline-flex items-center gap-1"
          style={{ color: "var(--text-secondary)", background: "none", border: "none", cursor: "pointer", fontSize: 12 }}
        >
          <LogOut size={13} /> Sign out
        </button>
      </div>
    </div>
  );
}
