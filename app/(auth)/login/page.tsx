"use client";

import AuthForm from "@/components/AuthForm";
import { getOnboarding, login } from "@/lib/api";
import { setTokens } from "@/lib/auth";

export default function LoginPage() {
  const handleLogin = async (email: string, password: string) => {
    const pair = await login(email, password);
    setTokens(pair);

    // Resolve setup state before navigating anywhere. getOnboarding() writes
    // the hint cookie proxy.ts gates on, and on a browser that has never seen
    // this account there is no cookie yet — so without this, a fully set-up
    // user signing in on a new machine gets bounced through /onboarding and
    // straight back out again. One request to skip a visible double redirect.
    let onboarded = true;
    try {
      onboarded = (await getOnboarding()).complete;
    } catch {
      // If it fails, fall through to the normal destination. The proxy and the
      // API's own 403 still route an unfinished account to the wizard.
    }

    if (!onboarded) {
      window.location.replace("/onboarding");
      return;
    }

    // `next` is read here rather than via useSearchParams because it is only
    // needed at submit time. Reading it during render would drag the page into
    // a Suspense boundary for no benefit.
    const next = new URLSearchParams(window.location.search).get("next");

    // Only same-origin paths: `next` comes from the URL bar, so an absolute
    // URL here would turn the login form into an open redirect.
    const target = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";

    // Hard navigation, not router.push — the route gate has to re-run against
    // the cookies that were just written, and a client-side transition skips it.
    window.location.replace(target);
  };

  return (
    <AuthForm
      title="Sign in"
      subtitle="Pick up where you left off."
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
