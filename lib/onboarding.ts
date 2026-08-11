// The onboarding state, mirrored from the backend.
//
// `modules/auth/onboarding.py` is the authority: it derives the same four
// steps per request and returns 403 from every route that drafts, sends, fills
// or scrapes until they are all done. Nothing here enforces anything — this
// module only decides what the wizard shows and where it opens.

import { API_BASE, ONBOARDED_COOKIE } from "./config";

export { ONBOARDED_COOKIE };

export const ONBOARDING_STEPS = ["identity", "gemini", "email", "resume"] as const;
export type OnboardingStepId = (typeof ONBOARDING_STEPS)[number];

/** Must match `ONBOARDING_INCOMPLETE_CODE` in modules/auth/onboarding.py.
 *  It is what tells a "you are not set up" 403 apart from every other 403,
 *  without parsing prose that could be reworded. */
export const ONBOARDING_INCOMPLETE_CODE = "onboarding_incomplete";

export interface OnboardingStepState {
  complete: boolean;
  /** The specific fields still outstanding, so the wizard can mark them rather
   *  than re-asking for the whole step. */
  missing: string[];
}

export interface OnboardingState {
  complete: boolean;
  incomplete_steps: OnboardingStepId[];
  steps: Record<OnboardingStepId, OnboardingStepState>;
  /** Chunks in the vector store. Display only — the gate checks that the file
   *  exists, because counting chunks needs a round trip too slow to put in a
   *  per-request dependency. */
  profile_chunks: number;
}

export interface StepCopy {
  id: OnboardingStepId;
  title: string;
  /** What this step is for, in terms of what breaks without it. A setup screen
   *  that just lists fields gives the user no way to judge whether an answer
   *  is worth the effort. */
  blurb: string;
}

export const STEP_COPY: Record<OnboardingStepId, StepCopy> = {
  identity: {
    id: "identity",
    title: "Who the letters are from",
    blurb:
      "These sign every cover email you send. They are typed rather than read out of your résumé, because a model asked to find a phone number can return a plausible wrong one and nobody notices until an application goes out with a dead number on it.",
  },
  gemini: {
    id: "gemini",
    title: "Connect Gemini",
    blurb:
      "Drafting runs on your own Gemini key, not a shared one. The key is checked against Google before it is saved, so a typo fails here rather than on your first application.",
  },
  email: {
    id: "email",
    title: "Set up sending",
    blurb:
      "Applications go out from your address on your own Resend account. The sender has to be on a domain you have verified with Resend, or their API will refuse the send.",
  },
  resume: {
    id: "resume",
    title: "Add your résumé",
    blurb:
      "This is what the AI writes from. Your experience and projects are pulled from it for each application; without it the letters have nothing specific to say about you.",
  },
};

/** Human-readable name for a field the backend reported as missing. Falls back
 *  to the raw key so a field added server-side shows up as *something* rather
 *  than vanishing from the list. */
const FIELD_LABELS: Record<string, string> = {
  full_name: "Full name",
  headline: "Headline",
  phone: "Phone",
  contact_email: "Contact email",
  gemini_api_key: "Gemini API key",
  resend_api_key: "Resend API key",
  sender_email: "Sender email",
  resume: "Résumé",
};

export function fieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field;
}

/**
 * Which step the wizard should open on: the first incomplete one.
 *
 * Not "the first one the user has not visited" — the state is derived from the
 * server every time, so someone who filled identity on another device lands on
 * the Gemini step here rather than being asked again.
 */
export function firstIncompleteStep(state: OnboardingState | null): OnboardingStepId {
  if (!state) return "identity";
  return state.incomplete_steps[0] ?? "resume";
}

export function completedCount(state: OnboardingState | null): number {
  if (!state) return 0;
  return ONBOARDING_STEPS.filter((step) => state.steps[step]?.complete).length;
}

// ── The hint cookie ──
//
// Written from the client because the server never sets cookies for this app
// (it authenticates on a bearer header). Session-scoped rather than
// long-lived: it is a hint, and a stale one costs one redirect.

export function markOnboarded(): void {
  if (typeof document === "undefined") return;
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${ONBOARDED_COOKIE}=1; Path=/; Max-Age=${30 * 24 * 60 * 60}; SameSite=Lax${secure}`;
}

export function clearOnboarded(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${ONBOARDED_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}

/** Keep the hint in step with a freshly fetched state, in one call, so a
 *  caller cannot fetch the state and forget to reconcile the cookie. */
export function syncOnboardedCookie(state: OnboardingState): OnboardingState {
  if (state.complete) markOnboarded();
  else clearOnboarded();
  return state;
}

export { API_BASE };
