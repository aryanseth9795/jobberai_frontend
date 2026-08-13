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

const FORM_URL_PATTERN = /^https:\/\/docs\.google\.com\/forms\//;

function stateKey(tabId) {
  return `form_state_${tabId}`;
}

async function setFormState(tabId, state) {
  await chrome.storage.local.set({ [stateKey(tabId)]: state });
}

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

  const signedIn = Boolean(tokens?.access_token);
  const stored = tab ? await chrome.storage.local.get(stateKey(tab.id)) : {};

  // Pre-flight the setup gate. Without this the user sees "Ready to fill",
  // waits through a generation, and only then learns their account was never
  // finished — the exact late-refusal problem modules/auth/onboarding.py was
  // written to eliminate. A miss here is not fatal: the 403 still catches it.
  let onboarding = null;
  if (signedIn) {
    try {
      onboarding = await authFetch("/api/auth/me/onboarding");
    } catch {
      onboarding = null;
    }
  }

  return {
    signedIn,
    user,
    config,
    onboarding,
    isGoogleForm: FORM_URL_PATTERN.test(tab?.url || ""),
    formState: tab ? stored[stateKey(tab.id)] || null : null,
  };
}

async function handleSignIn({ email, password }) {
  await login(email, password);
  const me = await authFetch("/api/auth/me");
  await setUser({ email: me.email });
  return { user: { email: me.email } };
}

async function handleSignOut() {
  await clearTokens();
  return {};
}

async function handleSaveConfig(payload) {
  const config = await setConfig(payload);
  return { config };
}

async function handleScrapeAndGenerate() {
  const tab = await activeTab();
  if (!tab) throw new Error("No active tab.");

  await setFormState(tab.id, { status: "loading" });

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

  const state = { status: "done", answers, metadata: data.metadata || {} };
  await setFormState(tab.id, state);
  return state;
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

async function handleFillWithAnswers({ answers }) {
  const tab = await activeTab();
  if (!tab) throw new Error("No active tab.");

  const result = await chrome.tabs.sendMessage(tab.id, {
    action: "FILL_FORM",
    answers,
  });

  if (!result?.success) throw new Error("Couldn't reach the form. Reload the tab.");

  // Only clear the saved draft on a clean fill. If something was missed the
  // user may reopen the popup to fix it by hand.
  if (!result.failed.length) await chrome.storage.local.remove(stateKey(tab.id));

  return { filled: result.filled, failed: result.failed };
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
  GET_HISTORY: handleGetHistory,
};

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const handler = HANDLERS[message?.action];
  if (!handler) return false;

  handler(message)
    .then((result) => sendResponse({ success: true, ...result }))
    .catch(async (error) => {
      // Persist the failure so a popup that was closed during generation still
      // finds out why when it reopens.
      const tab = await activeTab();
      if (tab && message.action === "SCRAPE_AND_GENERATE") {
        await setFormState(tab.id, { status: "error", error: toWireError(error) });
      }
      sendResponse({ success: false, error: toWireError(error) });
    });

  return true; // keep the channel open for the async response
});

// Drop per-tab drafts when their tab goes away, so storage does not grow
// unbounded across a long browser session.
chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.local.remove(stateKey(tabId));
});
