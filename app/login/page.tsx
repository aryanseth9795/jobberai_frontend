"use client";

import AuthForm from "@/components/AuthForm";
import { login } from "@/lib/api";
import { setTokens } from "@/lib/auth";

export default function LoginPage() {
  const handleLogin = async (email: string, password: string) => {
    const pair = await login(email, password);
    setTokens(pair);

    // `next` is read here rather than via useSearchParams because it is only
    // needed at submit time. Reading it during render would drag the page into
    // a Suspense boundary for no benefit.
    const next = new URLSearchParams(window.location.search).get("next");

    // Only same-origin paths: `next` comes from the URL bar, so an absolute
    // URL here would turn the login form into an open redirect.
    const target = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";

    // Hard navigation, not router.push — middleware has to re-run against the
    // cookie that was just written, and a client-side transition skips it.
    window.location.replace(target);
  };

  return (
    <AuthForm
      title="Sign in"
      subtitle="AI-powered job application automation"
      submitLabel="Sign in"
      onSubmit={handleLogin}
      passwordAutoComplete="current-password"
      footer={{
        prompt: "Don't have an account?",
        linkLabel: "Create one",
        href: "/register",
      }}
    />
  );
}
