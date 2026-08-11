"use client";

import AuthForm from "@/components/AuthForm";
import { register } from "@/lib/api";
import { setTokens } from "@/lib/auth";
import { clearOnboarded } from "@/lib/onboarding";

export default function RegisterPage() {
  const handleRegister = async (email: string, password: string) => {
    const pair = await register(email, password);
    setTokens(pair);

    // A brand-new account has completed none of the four setup steps, so clear
    // any hint cookie left behind by a previous account on this browser —
    // otherwise proxy.ts waves the new user straight into an app whose every
    // action returns 403.
    clearOnboarded();
    window.location.replace("/onboarding");
  };

  return (
    <AuthForm
      title="Create your account"
      subtitle="Set up takes about two minutes."
      submitLabel="Create account"
      onSubmit={handleRegister}
      passwordAutoComplete="new-password"
      passwordHint="At least 8 characters."
      footer={{
        prompt: "Already have an account?",
        linkLabel: "Sign in",
        href: "/login",
      }}
    />
  );
}
