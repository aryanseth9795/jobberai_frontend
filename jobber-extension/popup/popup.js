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

  for (const button of document.querySelectorAll("[data-close-panel]")) {
    button.addEventListener("click", () => closePanel(button.dataset.closePanel));
  }

  boot();
});
