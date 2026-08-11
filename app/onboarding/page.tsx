"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, LogOut } from "lucide-react";

import { cn } from "@/lib/cn";
import { getKeys, getOnboarding, type KeysResponse } from "@/lib/api";
import { clearTokens } from "@/lib/auth";
import {
  ONBOARDING_STEPS,
  STEP_COPY,
  completedCount,
  firstIncompleteStep,
  markOnboarded,
  type OnboardingState,
  type OnboardingStepId,
} from "@/lib/onboarding";
import { Spinner } from "@/components/ui";
import { EmailStep, GeminiStep, IdentityStep, ResumeStep, type StepProps } from "./steps";

const BODIES: Record<OnboardingStepId, (props: StepProps) => React.ReactNode> = {
  identity: IdentityStep,
  gemini: GeminiStep,
  email: EmailStep,
  resume: ResumeStep,
};

/**
 * Setup, required before the app will do anything.
 *
 * Four steps, no skip. Each one is a real precondition rather than a
 * preference: without identity there is nobody to sign the letter as, without
 * the Gemini key nothing drafts, without Resend nothing sends, and without a
 * résumé the letters have no experience to draw on. A user allowed past any of
 * them reaches the draft screen and watches it fail — which is what this
 * replaces.
 *
 * Progress comes from the server on every load, not from React state, so
 * refreshing mid-setup or continuing on another machine resumes where it left
 * off. Steps already satisfied are shown done and are not asked again.
 */
export default function OnboardingPage() {
  const [state, setState] = useState<OnboardingState | null>(null);
  const [keys, setKeys] = useState<KeysResponse | null>(null);
  const [current, setCurrent] = useState<OnboardingStepId>("identity");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (): Promise<OnboardingState | null> => {
    try {
      const [next, storedKeys] = await Promise.all([getOnboarding(), getKeys()]);
      setState(next);
      setKeys(storedKeys);
      return next;
    } catch {
      // A failure here leaves the wizard on its current step with whatever it
      // already knows. authFetch has already redirected if the session is gone,
      // so the remaining cases are transient and retried by the next save.
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load().then((next) => {
      if (next) setCurrent(firstIncompleteStep(next));
    });
  }, [load]);

  /** Called by a step once its save has succeeded. */
  const handleSaved = useCallback(async () => {
    const next = await load();
    if (!next) return;

    if (next.complete) {
      // Cookie first, then a hard navigation: proxy.ts reads the cookie on the
      // server, and a client-side router push would race the write and bounce
      // straight back here.
      markOnboarded();
      window.location.replace("/dashboard");
      return;
    }
    setCurrent(firstIncompleteStep(next));
  }, [load]);

  const signOut = () => {
    clearTokens();
    window.location.replace("/login");
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size={18} label="Loading your setup" />
      </div>
    );
  }

  const done = completedCount(state);
  const copy = STEP_COPY[current];
  const Body = BODIES[current];

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-4 py-8 sm:px-6">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <div className="mb-3 flex items-center gap-2.5">
            <span
              className="flex h-8 w-8 items-center justify-center rounded-md font-display text-[14px] font-bold"
              style={{ background: "var(--accent)", color: "var(--text-on-accent)" }}
              aria-hidden="true"
            >
              J
            </span>
            <span className="font-display text-[16px] font-semibold tracking-tight">Jobber</span>
          </div>
          <h1 className="font-display text-[22px] font-semibold tracking-tight">Finish setting up</h1>
          <p className="mt-1 text-[13px] text-muted">
            Four things Jobber needs before it can write anything. {done} of {ONBOARDING_STEPS.length} done.
          </p>
        </div>

        <button
          type="button"
          onClick={signOut}
          className="inline-flex shrink-0 items-center gap-1.5 text-[12px] text-faint transition-colors hover:text-muted"
        >
          <LogOut size={13} /> Sign out
        </button>
      </header>

      {/* Progress rail. Completed steps are clickable so a user can go back and
          correct something; incomplete ones ahead of the current step are not,
          because the order is the order the product needs them in. */}
      <ol className="mb-6 grid grid-cols-4 gap-2" aria-label="Setup progress">
        {ONBOARDING_STEPS.map((step, index) => {
          const complete = state?.steps[step]?.complete ?? false;
          const active = step === current;
          const reachable = complete || active;
          return (
            <li key={step}>
              <button
                type="button"
                disabled={!reachable}
                onClick={() => reachable && setCurrent(step)}
                aria-current={active ? "step" : undefined}
                className={cn(
                  "w-full border-t-2 pt-2 text-left transition-colors",
                  reachable ? "cursor-pointer" : "cursor-default"
                )}
                style={{
                  borderColor: complete
                    ? "var(--accent)"
                    : active
                    ? "var(--accent)"
                    : "var(--border)",
                }}
              >
                <span className="label flex items-center gap-1">
                  {complete ? <Check size={11} style={{ color: "var(--accent)" }} /> : `0${index + 1}`}
                  <span className={cn(active && "text-[var(--accent)]")}>
                    {step === "identity"
                      ? "You"
                      : step === "gemini"
                      ? "Drafting"
                      : step === "email"
                      ? "Sending"
                      : "Résumé"}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="rounded-lg border border-border p-6" style={{ background: "var(--surface)" }}>
        <h2 className="font-display text-[17px] font-semibold tracking-tight">{copy.title}</h2>
        <p className="mb-6 mt-1.5 text-[13px] leading-relaxed text-muted">{copy.blurb}</p>

        <Body keys={keys} onSaved={handleSaved} />
      </div>

      <p className="mt-4 text-center text-[11.5px] text-faint">
        Your keys are encrypted before they are stored and are used only for your own account.
      </p>
    </div>
  );
}
