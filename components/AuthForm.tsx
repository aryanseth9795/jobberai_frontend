"use client";

import { useState } from "react";
import Link from "next/link";

import { Button, ErrorNote, Field, Input } from "@/components/ui";

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

/**
 * The sign-in and registration form.
 *
 * Renders inside the split-panel auth layout, which already carries the
 * product name — so there is no logo or wordmark here. It used to draw its own
 * full-screen centred container and its own heading, which meant two competing
 * titles once the layout arrived.
 *
 * Deliberately exactly one button: the layout's footer link is an anchor, and
 * the tests lean on there being a single button to assert the disabled state.
 */
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
    <>
      <header className="mb-6">
        <h1 className="font-display text-[22px] font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-[13px] text-muted">{subtitle}</p>
      </header>

      <form onSubmit={handleSubmit}>
        <Field label="Email">
          {(p) => (
            <Input
              {...p}
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          )}
        </Field>

        <Field label="Password" hint={passwordHint}>
          {(p) => (
            <Input
              {...p}
              type="password"
              required
              autoComplete={passwordAutoComplete}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
        </Field>

        {error && (
          <div className="mb-4">
            <ErrorNote>{error}</ErrorNote>
          </div>
        )}

        <Button type="submit" variant="primary" size="lg" className="w-full" loading={loading}>
          {submitLabel}
        </Button>
      </form>

      <p className="mt-6 text-center text-[12.5px] text-muted">
        {footer.prompt}{" "}
        <Link href={footer.href} className="text-accent hover:underline">
          {footer.linkLabel}
        </Link>
      </p>
    </>
  );
}
