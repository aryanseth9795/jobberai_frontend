// popup.js — view router and interactions. Sends messages; never fetches.

const SETUP_STEP_LABELS = {
  identity: "Your name and contact details",
  gemini: "A Gemini API key",
  email: "A Resend key and sender address",
  resume: "Your résumé",
};

const state = {
  config: { apiBase: "", appBase: "" },
  answers: [],
  metadata: {},
};

const $ = (id) => document.getElementById(id);

function send(action, payload = {}) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action, ...payload }, (response) => {
      if (chrome.runtime.lastError) {
        resolve({
          success: false,
          error: { name: "Error", message: "Extension error. Reload the tab." },
        });
        return;
      }
      resolve(response);
    });
  });
}

function show(viewName) {
  for (const view of document.querySelectorAll(".view")) {
    view.classList.toggle("active", view.id === `view-${viewName}`);
  }
  renderFooter(viewName);
}

function openPanel(id) { $(id).classList.add("open"); }
function closePanel(id) { $(id).classList.remove("open"); }

function setMessage(el, text, kind = "error") {
  el.textContent = text || "";
  el.className = `msg ${text ? kind : ""}`;
}

// ── Footer: the primary action changes with the view ──

function renderFooter(viewName) {
  const footer = $("footer");
  footer.innerHTML = "";

  if (viewName === "ready") {
    const button = document.createElement("button");
    button.className = "btn";
    button.textContent = "Fill this form";
    button.addEventListener("click", startGeneration);
    footer.appendChild(button);
  }

  if (viewName === "review") {
    const button = document.createElement("button");
    button.className = "btn";
    button.textContent = `Confirm & fill (${state.answers.length})`;
    button.addEventListener("click", confirmFill);
    footer.appendChild(button);
  }
}

// ── Error routing: one place decides which view an error means ──

function handleError(error, inlineTarget) {
  if (error?.name === "AuthExpired") {
    show("signedOut");
    setMessage($("signInError"), error.message);
    return;
  }
  if (error?.name === "SetupIncomplete") {
    renderSetupSteps(error.steps || []);
    show("setupIncomplete");
    return;
  }
  if (inlineTarget) setMessage(inlineTarget, error?.message || "Something went wrong.");
}

function renderSetupSteps(steps) {
  const list = $("setupSteps");
  list.innerHTML = "";
  for (const step of steps) {
    const item = document.createElement("li");
    item.textContent = SETUP_STEP_LABELS[step] || step;
    list.appendChild(item);
  }
}

// ── Boot ──

async function boot() {
  const result = await send("GET_STATE");
  if (!result.success) {
    show("signedOut");
    return;
  }

  state.config = result.config;
  $("apiBase").value = result.config.apiBase;
  $("appBase").value = result.config.appBase;

  if (!result.signedIn) {
    show("signedOut");
    return;
  }

  $("btnHistory").hidden = false;
  $("btnAccount").hidden = false;
  const email = result.user?.email || "";
  $("accountEmail").textContent = email;
  $("btnAccount").textContent = email.slice(0, 2).toUpperCase();

  const formState = result.formState;
  if (formState?.status === "loading") { show("working"); return; }
  if (formState?.status === "done") { renderReview(formState); return; }
  if (formState?.status === "error") {
    handleError(formState.error, null);
    if (!document.querySelector(".view.active:not(#view-loading)")) show("ready");
    return;
  }

  // Pre-flight: refuse up front rather than after a wasted generation.
  if (result.onboarding && result.onboarding.complete === false) {
    renderSetupSteps(result.onboarding.incomplete_steps || []);
    show("setupIncomplete");
    return;
  }

  show(result.isGoogleForm ? "ready" : "notAForm");
}

// ── Auth ──

async function signIn() {
  const email = $("email").value.trim();
  const password = $("password").value;
  if (!email || !password) {
    setMessage($("signInError"), "Enter your email and password.");
    return;
  }

  $("btnSignIn").disabled = true;
  $("btnSignIn").textContent = "Signing in…";
  setMessage($("signInError"), "");

  const result = await send("SIGN_IN", { email, password });

  $("btnSignIn").disabled = false;
  $("btnSignIn").textContent = "Sign in";

  if (!result.success) {
    setMessage($("signInError"), result.error?.message || "Sign-in failed.");
    return;
  }

  $("password").value = "";
  await boot();
}

async function signOut() {
  await send("SIGN_OUT");
  closePanel("panel-account");
  $("btnHistory").hidden = true;
  $("btnAccount").hidden = true;
  show("signedOut");
}

// ── Generation (Task 8 renders the review body) ──

async function startGeneration() {
  show("working");
  const result = await send("SCRAPE_AND_GENERATE");
  if (!result.success) {
    handleError(result.error, null);
    if (result.error?.name !== "AuthExpired" && result.error?.name !== "SetupIncomplete") {
      show("ready");
      window.alert(result.error?.message || "Couldn't generate answers.");
    }
    return;
  }
  renderReview(result);
}

// ── Review ──

function escapeText(value) {
  const node = document.createElement("span");
  node.textContent = value ?? "";
  return node.textContent;
}

function renderReview(payload) {
  state.answers = payload.answers || [];
  state.metadata = payload.metadata || {};

  const pills = $("reviewPills");
  pills.innerHTML = "";
  for (const key of ["company", "role"]) {
    const value = state.metadata[key];
    if (!value || value === "Unknown") continue;
    const pill = document.createElement("span");
    pill.className = "pill";
    pill.textContent = value;
    pills.appendChild(pill);
  }

  const container = $("reviewCards");
  container.innerHTML = "";
  state.answers.forEach((answer, position) => {
    container.appendChild(buildCard(answer, position));
  });

  show("review");
}

function buildCard(answer, position) {
  const card = document.createElement("div");
  card.className = "card";

  const top = document.createElement("div");
  top.className = "card-top";

  const number = document.createElement("span");
  number.className = "card-num";
  number.textContent = `Q${position + 1}`;

  const badge = document.createElement("span");
  badge.className = "badge";
  badge.textContent = answer.type || "text";

  const spacer = document.createElement("span");
  spacer.className = "spacer";

  const regenerate = document.createElement("button");
  regenerate.className = "icon-btn";
  regenerate.title = "Rewrite this answer";
  regenerate.textContent = "\u21BB";
  regenerate.addEventListener("click", () => regenerateOne(answer, card, regenerate));

  top.append(number, badge, spacer, regenerate);

  const question = document.createElement("span");
  question.className = "question";
  question.textContent = escapeText(answer.question);

  // A long answer gets a textarea; a short one an input. Building these as DOM
  // nodes rather than an innerHTML template is what keeps a form question
  // containing markup from being parsed as HTML.
  const isLong = (answer.answer || "").length > 60;
  const input = document.createElement(isLong ? "textarea" : "input");
  if (!isLong) input.type = "text";
  if (isLong) input.rows = Math.min(Math.ceil(answer.answer.length / 46), 6);
  input.className = "answer-input";
  input.value = answer.answer || "";
  input.dataset.index = String(answer.index);
  input.addEventListener("input", () => {
    const target = state.answers.find((item) => item.index === answer.index);
    if (target) target.answer = input.value;
  });

  card.append(top, question, input);
  return card;
}

async function regenerateOne(answer, card, button) {
  card.classList.add("regenerating");
  button.disabled = true;

  const result = await send("REGENERATE_ONE", {
    index: answer.index,
    question: answer.question,
    type: answer.type,
    options: answer.options || [],
    company: state.metadata.company,
    role: state.metadata.role,
  });

  card.classList.remove("regenerating");
  button.disabled = false;

  if (!result.success) {
    handleError(result.error, null);
    if (result.error?.name !== "AuthExpired" && result.error?.name !== "SetupIncomplete") {
      window.alert(result.error?.message || "Couldn't rewrite that answer.");
    }
    return;
  }

  const target = state.answers.find((item) => item.index === answer.index);
  if (target) target.answer = result.answer;
  const input = card.querySelector(".answer-input");
  if (input) input.value = result.answer;
}

async function confirmFill() {
  const button = $("footer").querySelector("button");
  if (button) {
    button.disabled = true;
    button.textContent = "Filling…";
  }

  const result = await send("FILL_WITH_ANSWERS", {
    answers: state.answers.map((answer) => ({
      index: answer.index,
      question: answer.question,
      answer: answer.answer,
    })),
  });

  if (!result.success) {
    if (button) {
      button.disabled = false;
      button.textContent = `Confirm & fill (${state.answers.length})`;
    }
    handleError(result.error, null);
    window.alert(result.error?.message || "Couldn't fill the form.");
    return;
  }

  const failed = result.failed || [];
  const total = result.filled + failed.length;

  $("doneTitle").textContent = failed.length
    ? `Filled ${result.filled} of ${total}`
    : "Form filled";

  $("doneDetail").textContent = failed.length
    ? `Couldn't match: ${failed.join(", ")}. Fill those in yourself, then submit.`
    : "Review the page and submit it yourself.";

  show("done");

  // Auto-close only on a clean fill. Closing on a partial one would hide the
  // list of fields the user still has to handle.
  if (!failed.length) setTimeout(() => window.close(), 1200);
}

// ── Panels ──

async function openHistory() {
  openPanel("panel-history");
  const body = $("historyBody");
  body.innerHTML = '<div class="empty">Loading…</div>';

  const result = await send("GET_HISTORY");
  if (!result.success) {
    body.innerHTML = "";
    const msg = document.createElement("div");
    msg.className = "msg error";
    msg.textContent = result.error?.message || "Couldn't load history.";
    body.appendChild(msg);
    return;
  }

  body.innerHTML = "";
  if (!result.sessions.length) {
    body.innerHTML = '<div class="empty">No forms filled yet.</div>';
    return;
  }

  for (const session of result.sessions) {
    const row = document.createElement("div");
    row.className = "row";

    const title = document.createElement("span");
    title.className = "row-title";
    title.textContent = session.company && session.company !== "Unknown"
      ? session.company
      : session.form_title || "Untitled form";

    const meta = document.createElement("span");
    meta.className = "row-meta";
    const when = session.filled_at ? new Date(session.filled_at).toLocaleDateString() : "";
    meta.textContent = [session.role, when].filter(Boolean).join(" · ");

    row.append(title, meta);
    body.appendChild(row);
  }
}

// ── Settings ──

// chrome.permissions.request must run inside a user gesture, so it is called
// straight from the click handler rather than after an await on storage.
function requestHostAccess(origin) {
  return new Promise((resolve) => {
    chrome.permissions.request({ origins: [`${origin}/*`] }, (granted) =>
      resolve(Boolean(granted)),
    );
  });
}

function originOf(value) {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

async function saveSettings() {
  const apiBase = $("apiBase").value.trim();
  const appBase = $("appBase").value.trim();
  const message = $("settingsMsg");

  const apiOrigin = originOf(apiBase);
  if (!apiOrigin) {
    setMessage(message, "Enter a full backend URL, like http://localhost:8000");
    return;
  }
  if (appBase && !originOf(appBase)) {
    setMessage(message, "Enter a full web app URL, like http://localhost:3000");
    return;
  }

  // Already-declared hosts are granted at install; contains() keeps us from
  // showing a permission prompt for localhost, which never needs one.
  const alreadyGranted = await new Promise((resolve) => {
    chrome.permissions.contains({ origins: [`${apiOrigin}/*`] }, (has) => resolve(Boolean(has)));
  });

  if (!alreadyGranted) {
    const granted = await requestHostAccess(apiOrigin);
    if (!granted) {
      setMessage(
        message,
        `JobberAI needs permission to reach ${apiOrigin}. The previous URL is still in use.`,
      );
      return;
    }
  }

  const result = await send("SAVE_CONFIG", { apiBase, appBase });
  if (!result.success) {
    setMessage(message, result.error?.message || "Couldn't save.");
    return;
  }

  state.config = result.config;
  setMessage(message, "Saved.", "success");
  setTimeout(() => setMessage(message, ""), 2000);
}

// ── Wiring ──

document.addEventListener("DOMContentLoaded", () => {
  $("btnSignIn").addEventListener("click", signIn);
  $("password").addEventListener("keydown", (event) => {
    if (event.key === "Enter") signIn();
  });
  $("linkRegister").addEventListener("click", () => {
    chrome.tabs.create({ url: `${state.config.appBase}/register` });
  });
  $("btnOpenSetup").addEventListener("click", () => {
    chrome.tabs.create({ url: `${state.config.appBase}/onboarding` });
  });

  $("btnHistory").addEventListener("click", openHistory);
  $("btnSettings").addEventListener("click", () => openPanel("panel-settings"));
  $("btnAccount").addEventListener("click", () => openPanel("panel-account"));
  $("btnSignOut").addEventListener("click", signOut);
  $("btnSaveSettings").addEventListener("click", saveSettings);

  for (const button of document.querySelectorAll("[data-close-panel]")) {
    button.addEventListener("click", () => closePanel(button.dataset.closePanel));
  }

  boot();
});
