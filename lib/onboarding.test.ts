import { beforeEach, describe, expect, it } from "vitest";

import {
  ONBOARDED_COOKIE,
  ONBOARDING_STEPS,
  STEP_COPY,
  clearOnboarded,
  completedCount,
  fieldLabel,
  firstIncompleteStep,
  markOnboarded,
  syncOnboardedCookie,
  type OnboardingState,
  type OnboardingStepId,
} from "./onboarding";

function state(complete: OnboardingStepId[]): OnboardingState {
  const steps = Object.fromEntries(
    ONBOARDING_STEPS.map((step) => [
      step,
      { complete: complete.includes(step), missing: complete.includes(step) ? [] : ["something"] },
    ])
  ) as OnboardingState["steps"];

  return {
    complete: complete.length === ONBOARDING_STEPS.length,
    incomplete_steps: ONBOARDING_STEPS.filter((step) => !complete.includes(step)),
    steps,
    profile_chunks: 0,
  };
}

describe("firstIncompleteStep", () => {
  it("opens on identity for a brand-new account", () => {
    expect(firstIncompleteStep(state([]))).toBe("identity");
  });

  it("skips steps already done on another device", () => {
    // Progress is re-derived from the server on every load rather than kept in
    // React state, so someone who filled identity elsewhere is not asked again.
    expect(firstIncompleteStep(state(["identity", "gemini"]))).toBe("email");
  });

  it("does not skip a later step just because an earlier one is outstanding", () => {
    expect(firstIncompleteStep(state(["gemini", "email", "resume"]))).toBe("identity");
  });

  it("falls back to identity when the state has not loaded yet", () => {
    expect(firstIncompleteStep(null)).toBe("identity");
  });
});

describe("completedCount", () => {
  it("counts finished steps", () => {
    expect(completedCount(state([]))).toBe(0);
    expect(completedCount(state(["identity", "resume"]))).toBe(2);
    expect(completedCount(state([...ONBOARDING_STEPS]))).toBe(4);
  });

  it("is zero before anything has loaded", () => {
    expect(completedCount(null)).toBe(0);
  });
});

describe("the hint cookie", () => {
  beforeEach(() => clearOnboarded());

  it("is written when setup completes and cleared when it regresses", () => {
    // The cookie is only a hint — proxy.ts reads it to avoid rendering a page
    // the user is about to be thrown out of, and the backend re-derives the
    // truth on every request. Syncing it from the fetched state in one call is
    // what stops the two from drifting.
    syncOnboardedCookie(state([...ONBOARDING_STEPS]));
    expect(document.cookie).toContain(`${ONBOARDED_COOKIE}=1`);

    syncOnboardedCookie(state(["identity"]));
    expect(document.cookie).not.toContain(`${ONBOARDED_COOKIE}=1`);
  });

  it("returns the state it was given, so it can wrap a fetch", () => {
    const value = state(["identity"]);

    expect(syncOnboardedCookie(value)).toBe(value);
  });

  it("can be set and cleared directly", () => {
    markOnboarded();
    expect(document.cookie).toContain(`${ONBOARDED_COOKIE}=1`);

    clearOnboarded();
    expect(document.cookie).not.toContain(`${ONBOARDED_COOKIE}=1`);
  });
});

describe("copy", () => {
  it("covers every step", () => {
    // A step with no copy renders a blank card, which is worse than a wrong
    // heading — the user has no idea what is being asked of them.
    for (const step of ONBOARDING_STEPS) {
      expect(STEP_COPY[step].title.length).toBeGreaterThan(0);
      expect(STEP_COPY[step].blurb.length).toBeGreaterThan(0);
    }
  });

  it("names known fields and falls back to the raw key for unknown ones", () => {
    expect(fieldLabel("full_name")).toBe("Full name");
    // A field added server-side must still show as something rather than
    // vanishing from the list of what is outstanding.
    expect(fieldLabel("some_new_field")).toBe("some_new_field");
  });
});

describe("step order", () => {
  it("asks for identity before anything that costs money or time", () => {
    expect(ONBOARDING_STEPS[0]).toBe("identity");
    expect(ONBOARDING_STEPS).toEqual(["identity", "gemini", "email", "resume"]);
  });
});
