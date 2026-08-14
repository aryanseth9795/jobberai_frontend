// background.js — MV3 module service worker.
//
// The only place in the extension that touches the network or the token store.
// The popup is destroyed every time it closes, so anything long-running has to
// live here and report progress through chrome.storage instead of a response
// callback the popup may no longer be listening for.

import { authFetch, login } from "./lib/api.js";
import { getConfig, setConfig } from "./lib/config.js";
import { clearTokens, getTokens, getUser, setUser } from "./lib/tokens.js";
import { toWireError } from "./lib/errors.js";
import {
  clearAllFormStates,
  clearFormState,
  getFormState,
  isFormStateKey,
  setFormState,
  tabIdFromKey,
} from "./lib/formState.js";

const FORM_URL_PATTERN = /^https:\/\/docs\.google\.com\/forms\//;

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

// ── Handlers ──

async function handleGetState() {
  const [tokens, user, config, tab] = await Promise.all([
    getTokens(),
    getUser(),
    getConfig(),
    activeTab(),
  ]);

  let signedIn = Boolean(tokens?.access_token);
  let currentUser = user;

  // Pre-flight the setup gate. Without this the user sees "Ready to fill",
  // waits through a generation, and only then learns their account was never
  // finished — the exact late-refusal problem modules/auth/onboarding.py was
  // written to eliminate. A miss here is not fatal: the 403 still catches it.
  let onboarding = null;
  if (signedIn) {
    try {
      onboarding = await authFetch("/api/auth/me/onboarding");
    } catch (error) {
      // authFetch already cleared the stored tokens on an unrecoverable 401
      // (see lib/api.js). Reflect that here instead of swallowing it —
      // otherwise this returns signedIn:true with the cached user, the popup
      // shows "Ready to fill", and the user only discovers they're signed
      // out after sitting through a wasted scrape+generate (I1). Any other
      // error (a network blip, the backend being down) is still swallowed:
      // the popup should keep working rather than bounce to sign-in.
      if (error?.name === "AuthExpired") {
        signedIn = false;
        currentUser = null;
      }
      onboarding = null;
    }
  }

  const formState = tab ? await getFormState(tab.id, tab.url || "") : null;

  // An error state is a one-shot notification, not durable state: the
  // return below still carries it so the popup can show it this one time,
  // but it's cleared immediately after so the next GET_STATE — including
  // the one boot() fires right after a successful sign-in, or after the
  // user finishes onboarding — doesn't re-show a problem that's already
  // fixed and lock the tab forever (C1).
  if (formState?.status === "error" && tab) {
    await clearFormState(tab.id);
  }

  return {
    signedIn,
    user: currentUser,
    config,
    onboarding,
    isGoogleForm: FORM_URL_PATTERN.test(tab?.url || ""),
    formState,
  };
}

async function handleSignIn({ email, password }) {
  await login(email, password);

  // Tokens are already written to disk by login() at this point. If the
  // profile fetch below fails, don't leave them there: SIGN_IN would report
  // success:false while chrome.storage.local already holds a working access
  // token, so reopening the popup shows signedIn:true with an empty avatar
  // chip nobody ever confirmed (Minor).
  let me;
  try {
    me = await authFetch("/api/auth/me");
  } catch (error) {
    await clearTokens();
    throw error;
  }

  await setUser({ email: me.email });

  // A fresh sign-in always starts clean. On a shared machine the previous
  // account's draft — answers built from their résumé and profile — must
  // never surface for whoever just signed in on the same tab (C2).
  await clearAllFormStates();

  return { user: { email: me.email } };
}

async function handleSignOut() {
  await clearTokens();
  // Same reasoning as the sign-in side: a draft keyed only by tab id has no
  // notion of which account it belongs to, so it has to be wiped on the way
  // out too, not just on the way in (C2).
  await clearAllFormStates();
  return {};
}

async function handleSaveConfig(payload) {
  const config = await setConfig(payload);
  return { config };
}

async function handleScrapeAndGenerate() {
  const tab = await activeTab();
  if (!tab) throw new Error("No active tab.");

  const formUrl = tab.url || "";

  try {
    // startedAt lets getFormState recognize and discard this entry if the
    // worker gets reaped before either branch below runs (I2).
    await setFormState(tab.id, { status: "loading", startedAt: Date.now(), formUrl });

    const scrape = await chrome.tabs.sendMessage(tab.id, { action: "SCRAPE_FORM" });
    if (!scrape?.success || !scrape.questions.length) {
      throw new Error("No questions found. Make sure the form has finished loading.");
    }

    const data = await authFetch("/api/gform/fill-form", {
      method: "POST",
      body: JSON.stringify({
        questions: scrape.questions,
        form_url: tab.url || "",
        form_title: tab.title || "",
      }),
    });

    // Carry type AND options through. The review cards need the type for their
    // badge, and REGENERATE_ONE needs the options — re-answering a radio question
    // without its choices produces an answer that matches none of them, which
    // then silently fails to fill (content.js §9.2).
    const answers = data.answers.map((answer) => {
      const question = scrape.questions.find((q) => q.index === answer.index);
      return {
        ...answer,
        type: question?.type || "text",
        options: question?.options || [],
      };
    });

    // formUrl binds this draft to the form it was generated for, so a later
    // getFormState call on a tab that has since navigated elsewhere returns
    // null instead of the wrong form's answers (C2). tabId lets
    // handleFillWithAnswers deliver the fill to exactly this tab without
    // re-querying "whichever tab is active now" (Minor #1).
    const state = { status: "done", answers, metadata: data.metadata || {}, formUrl, tabId: tab.id };
    await setFormState(tab.id, state);
    return state;
  } catch (error) {
    // Own this tab's recovery here, against the tab id already captured above.
    // The backend round-trip takes seconds; if the outer listener re-queried
    // the active tab instead, the user could have switched tabs by the time
    // the error lands, stranding this tab in "loading" forever while the
    // error gets recorded against whichever tab is now active.
    await setFormState(tab.id, { status: "error", error: toWireError(error), formUrl });
    throw error;
  }
}

async function handleRegenerateOne(payload) {
  const data = await authFetch("/api/gform/regenerate-answer", {
    method: "POST",
    body: JSON.stringify({
      question: {
        index: payload.index,
        question: payload.question,
        type: payload.type || "text",
        options: payload.options || [],
      },
      company: payload.company || null,
      role: payload.role || null,
    }),
  });
  return { answer: data.answer };
}

async function handleFillWithAnswers({ answers, tabId }) {
  // Use the tab the review was generated for, not "whichever tab is active
  // right now" — the identical hazard handleScrapeAndGenerate already
  // guards against above. Re-querying here would let generated answers land
  // in a tab the user switched to after opening the review, which may not
  // even be showing the same form anymore (Minor #1).
  if (!tabId) throw new Error("Missing tab for this fill. Reopen the form and try again.");
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  if (!tab) throw new Error("That tab is no longer open.");

  const result = await chrome.tabs.sendMessage(tab.id, {
    action: "FILL_FORM",
    answers,
  });

  if (!result?.success) throw new Error("Couldn't reach the form. Reload the tab.");

  // Only clear the saved draft on a clean fill. If something was missed the
  // user may reopen the popup to fix it by hand.
  if (!result.failed.length) await clearFormState(tab.id);

  return { filled: result.filled, failed: result.failed };
}

// Belt-and-braces escape for a stuck "working" view (I2): if the service
// worker was reaped mid-generation, neither handleScrapeAndGenerate's
// success nor error branch ever runs, and getFormState's staleness check
// only kicks in after STALE_MS. This lets the user bail out immediately.
async function handleClearFormState() {
  const tab = await activeTab();
  if (tab) await clearFormState(tab.id);
  return {};
}

async function handleGetHistory() {
  const data = await authFetch("/api/gform/fill-form/history?limit=20");
  return { sessions: data.sessions || [] };
}

const HANDLERS = {
  GET_STATE: handleGetState,
  SIGN_IN: handleSignIn,
  SIGN_OUT: handleSignOut,
  SAVE_CONFIG: handleSaveConfig,
  SCRAPE_AND_GENERATE: handleScrapeAndGenerate,
  REGENERATE_ONE: handleRegenerateOne,
  FILL_WITH_ANSWERS: handleFillWithAnswers,
  CLEAR_FORM_STATE: handleClearFormState,
  GET_HISTORY: handleGetHistory,
};

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const handler = HANDLERS[message?.action];
  if (!handler) return false;

  handler(message)
    .then((result) => sendResponse({ success: true, ...result }))
    .catch((error) => {
      // sendResponse must fire on every path, or a popup left waiting on this
      // callback hangs with a spinner forever. Per-handler state recovery
      // (e.g. SCRAPE_AND_GENERATE's form_state write) happens inside the
      // handler itself, against the tab id it already owns — not here.
      sendResponse({ success: false, error: toWireError(error) });
    });

  return true; // keep the channel open for the async response
});

// Drop per-tab drafts when their tab goes away, so storage does not grow
// unbounded across a long browser session.
chrome.tabs.onRemoved.addListener((tabId) => {
  clearFormState(tabId);
});

// A form_state_* entry can still be written for a tab id that's already
// gone: onRemoved above fires, but a handler that captured that tab id
// earlier (handleScrapeAndGenerate) can still be mid-flight and write its
// terminal state afterward. setFormState's own alive-check stops new writes
// once the tab is gone, but Chrome reuses low tab ids every session, so
// anything that landed before this fix — or in the brief window before
// onRemoved fires — is a permanent orphan that can silently reattach to an
// unrelated tab later (I3). Sweep them at browser startup.
chrome.runtime.onStartup.addListener(async () => {
  const all = await chrome.storage.local.get(null);
  const openTabs = await chrome.tabs.query({});
  const openIds = new Set(openTabs.map((tab) => tab.id));

  const orphaned = Object.keys(all).filter(
    (key) => isFormStateKey(key) && !openIds.has(tabIdFromKey(key)),
  );
  if (orphaned.length) await chrome.storage.local.remove(orphaned);
});
