"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";

interface AuthFormProps {
  title: string;
  subtitle: string;
  submitLabel: string;
  /** Resolves once the caller has stored tokens and navigated. */
  onSubmit: (email: string, password: string) => Promise<void>;
  footer: { prompt: string; linkLabel: string; href: string };
  /** Shown under the password field on the register form. */
  passwordHint?: string;
  /** "new-password" on register so password managers offer to generate one;
   * "current-password" on login so they offer to fill. */
  passwordAutoComplete: "new-password" | "current-password";
}

export default function AuthForm({
  title,
  subtitle,
  submitLabel,
  onSubmit,
  footer,
  passwordHint,
  passwordAutoComplete,
}: AuthFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await onSubmit(email.trim(), password);
      // Deliberately no setLoading(false) on success: onSubmit navigates away,
      // and re-enabling the button first just invites a double submit.
    } catch (err) {
      // The backend's own message, including the 422 validation text for a
      // password that's too short.
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "var(--bg-primary)" }}
    >
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-semibold gradient-text mb-2">JobberAI</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>{subtitle}</p>
        </div>

        <form onSubmit={handleSubmit} className="glass-card p-8">
          <h2
            className="text-lg font-medium mb-6"
            style={{ color: "var(--text-primary)" }}
          >
            {title}
          </h2>

          <label className="block mb-4">
            <span className="hud-label block mb-1.5">Email</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 rounded outline-none"
              style={{
                background: "var(--bg-secondary)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
                fontSize: 14,
              }}
            />
          </label>

          <label className="block mb-2">
            <span className="hud-label block mb-1.5">Password</span>
            <input
              type="password"
              required
              autoComplete={passwordAutoComplete}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 rounded outline-none"
              style={{
                background: "var(--bg-secondary)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
                fontSize: 14,
              }}
            />
          </label>

          {passwordHint && (
            <p style={{ color: "var(--text-muted)", fontSize: 12 }} className="mb-4">
              {passwordHint}
            </p>
          )}

          {error && (
            <div
              className="mb-4 px-3 py-2 rounded"
              role="alert"
              style={{
                background: "var(--danger-bg)",
                border: "1px solid var(--danger-border)",
                color: "var(--danger)",
                fontSize: 13,
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full flex items-center justify-center gap-2 mt-2"
          >
            {loading && <Loader2 size={15} className="animate-spin" />}
            {loading ? "Working…" : submitLabel}
          </button>

          <p
            className="text-center mt-6"
            style={{ color: "var(--text-secondary)", fontSize: 13 }}
          >
            {footer.prompt}{" "}
            <Link href={footer.href} style={{ color: "var(--accent)" }}>
              {footer.linkLabel}
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
