"use client";

import AuthForm from "@/components/AuthForm";
import { register } from "@/lib/api";
import { setTokens } from "@/lib/auth";

export default function RegisterPage() {
  const handleRegister = async (email: string, password: string) => {
    const pair = await register(email, password);
    setTokens(pair);

    // Straight to settings rather than the app: a brand-new account has no
    // Gemini key and no full_name, and drafting refuses without both. Landing
    // on the apply page would mean the user's first action fails.
    window.location.replace("/settings?first_run=1");
  };

  return (
    <AuthForm
      title="Create your account"
      subtitle="AI-powered job application automation"
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
