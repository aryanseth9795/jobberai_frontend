import { beforeEach, describe, expect, it } from "vitest";
import { installFakeChrome, type FakeTab } from "./testing/fakeChrome";
import {
  STALE_MS,
  clearAllFormStates,
  clearFormState,
  getFormState,
  sameFormUrl,
  setFormState,
  stateKey,
} from "./formState.js";

const FORM_A = "https://docs.google.com/forms/d/e/1FAIpQLSf-A/viewform";
const FORM_A_RELOADED = "https://docs.google.com/forms/d/e/1FAIpQLSf-A/viewform?usp=header";
const FORM_B = "https://docs.google.com/forms/d/e/1FAIpQLSf-B/viewform";

let store: Map<string, unknown>;
let tabs: Map<number, FakeTab>;

beforeEach(() => {
  ({ store, tabs } = installFakeChrome());
  tabs.set(1, { id: 1, url: FORM_A });
  tabs.set(2, { id: 2, url: FORM_B });
});

describe("stateKey", () => {
  it("namespaces by tab id", () => {
    expect(stateKey(7)).toBe("form_state_7");
  });
});

describe("sameFormUrl", () => {
  it("matches the same form despite a differing query string", () => {
    expect(sameFormUrl(FORM_A, FORM_A_RELOADED)).toBe(true);
  });

  it("does not match a different form", () => {
    expect(sameFormUrl(FORM_A, FORM_B)).toBe(false);
  });

  it("treats a missing url on either side as a mismatch", () => {
    expect(sameFormUrl(undefined, FORM_A)).toBe(false);
    expect(sameFormUrl(FORM_A, undefined)).toBe(false);
  });
});

describe("setFormState / getFormState", () => {
  it("round-trips a stored state for a live tab", async () => {
    const written = { status: "done", answers: [{ index: 0, answer: "x" }], formUrl: FORM_A };
    await setFormState(1, written);

    expect(await getFormState(1, FORM_A)).toEqual(written);
  });

  it("returns null when the current url belongs to a different form", async () => {
    await setFormState(1, { status: "done", answers: [], formUrl: FORM_A });
    expect(await getFormState(1, FORM_B)).toBeNull();
  });

  it("returns the state when the form url matches, ignoring query-string drift", async () => {
    await setFormState(1, { status: "done", answers: [], formUrl: FORM_A });
    expect(await getFormState(1, FORM_A_RELOADED)).not.toBeNull();
  });

  it("treats a loading state older than STALE_MS as absent", async () => {
    await setFormState(1, {
      status: "loading",
      startedAt: Date.now() - STALE_MS - 1000,
      formUrl: FORM_A,
    });

    expect(await getFormState(1, FORM_A)).toBeNull();
  });

  it("returns a recent loading state normally", async () => {
    await setFormState(1, { status: "loading", startedAt: Date.now(), formUrl: FORM_A });

    const state = await getFormState(1, FORM_A);
    expect(state?.status).toBe("loading");
  });

  it("does not write state for a tab that no longer exists", async () => {
    await setFormState(999, { status: "done", answers: [], formUrl: FORM_A });
    expect(store.has(stateKey(999))).toBe(false);
  });
});

describe("clearFormState", () => {
  it("removes only the one tab's key", async () => {
    await setFormState(1, { status: "done", answers: [], formUrl: FORM_A });
    await setFormState(2, { status: "done", answers: [], formUrl: FORM_B });

    await clearFormState(1);

    expect(await getFormState(1, FORM_A)).toBeNull();
    expect(await getFormState(2, FORM_B)).not.toBeNull();
  });
});

describe("clearAllFormStates", () => {
  it("removes every form_state_* key and leaves auth/user/config untouched", async () => {
    await setFormState(1, { status: "done", answers: [], formUrl: FORM_A });
    await setFormState(2, { status: "done", answers: [], formUrl: FORM_B });
    store.set("jobber_auth", { access_token: "a", refresh_token: "r" });
    store.set("jobber_user", { email: "a@example.com" });
    store.set("jobber_config", { apiBase: "http://localhost:8000" });

    await clearAllFormStates();

    expect(await getFormState(1, FORM_A)).toBeNull();
    expect(await getFormState(2, FORM_B)).toBeNull();
    expect(store.get("jobber_auth")).toEqual({ access_token: "a", refresh_token: "r" });
    expect(store.get("jobber_user")).toEqual({ email: "a@example.com" });
    expect(store.get("jobber_config")).toEqual({ apiBase: "http://localhost:8000" });
  });
});
