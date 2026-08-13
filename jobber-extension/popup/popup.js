// popup.js — Two-phase flow: Scrape → Preview/Edit → Confirm & Fill

const fillBtn     = document.getElementById("fillBtn");
const confirmBtn  = document.getElementById("confirmBtn");
const statusEl    = document.getElementById("status");
const initialView = document.getElementById("initialView");
const previewPanel = document.getElementById("previewPanel");
const footer      = document.getElementById("footer");
const answerList  = document.getElementById("answerList");
const answerCount = document.getElementById("answerCount");
const metaPills   = document.getElementById("metaPills");

// Store the answers from the backend so we can edit them
let currentAnswers = [];
let currentMetadata = {};

function setStatus(msg, type = "") {
  statusEl.textContent = msg;
  statusEl.className = type;
}

function showPreview(answers, metadata) {
  currentAnswers = answers;
  currentMetadata = metadata || {};

  // Hide initial view, show preview
  initialView.style.display = "none";
  previewPanel.style.display = "block";
  footer.style.display = "block";

  // Metadata pills
  metaPills.innerHTML = "";
  if (currentMetadata.company && currentMetadata.company !== "Unknown") {
    metaPills.innerHTML += `<span class="pill">🏢 <strong>${currentMetadata.company}</strong></span>`;
  }
  if (currentMetadata.role && currentMetadata.role !== "Unknown") {
    metaPills.innerHTML += `<span class="pill">💼 <strong>${currentMetadata.role}</strong></span>`;
  }

  answerCount.textContent = `${answers.length} fields`;

  // Render answer cards
  answerList.innerHTML = "";
  answers.forEach((ans) => {
    const card = document.createElement("div");
    card.className = "answer-card";

    const isLong = ans.answer.length > 60;
    const inputTag = isLong ? "textarea" : "input";
    const rows = isLong ? `rows="${Math.min(Math.ceil(ans.answer.length / 50), 6)}"` : "";

    card.innerHTML = `
      <div class="q-label">Q${ans.index + 1} <span class="type-badge">${ans.type || "text"}</span></div>
      <div class="question">${escapeHtml(ans.question)}</div>
      <${inputTag} class="answer-input" data-index="${ans.index}" ${rows}
        ${inputTag === "input" ? `type="text" value="${escapeAttr(ans.answer)}"` : ""}
      >${inputTag === "textarea" ? escapeHtml(ans.answer) : ""}</${inputTag}>
    `;
    answerList.appendChild(card);
  });

  setStatus("Review the answers below. Edit if needed, then confirm.", "");

  // Add event listeners to input fields to save changes to state
  const inputs = answerList.querySelectorAll(".answer-input");
  inputs.forEach(input => {
    input.addEventListener("input", () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs[0]) return;
        const tabId = tabs[0].id;
        const edited = getEditedAnswers();
        chrome.storage.local.get([`form_state_${tabId}`], (result) => {
          const state = result[`form_state_${tabId}`];
          if (state && state.status === 'done') {
            state.answers = edited;
            chrome.storage.local.set({ [`form_state_${tabId}`]: state });
          }
        });
      });
    });
  });
}

function getEditedAnswers() {
  const inputs = answerList.querySelectorAll(".answer-input");
  const edited = [];
  inputs.forEach(input => {
    const idx = parseInt(input.dataset.index, 10);
    const original = currentAnswers.find(a => a.index === idx);
    edited.push({
      index: idx,
      question: original?.question || "",
      answer: input.value || input.textContent || ""
    });
  });
  return edited;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function escapeAttr(text) {
  return text.replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}


// ── Phase 1: Click "Fill This Form" ──
fillBtn.addEventListener("click", () => {
  fillBtn.disabled = true;
  setStatus("⏳ Scraping form & generating answers...", "loading");

  chrome.runtime.sendMessage({ action: "SCRAPE_AND_GENERATE" }, (response) => {
    fillBtn.disabled = false;

    if (chrome.runtime.lastError) {
      setStatus("❌ Extension error. Reload the form tab.", "error");
      return;
    }

    if (response?.success) {
      showPreview(response.answers, response.metadata);
    } else {
      setStatus(`❌ ${response?.error || "Unknown error"}`, "error");
    }
  });
});


// ── Phase 2: Click "Confirm & Fill" ──
confirmBtn.addEventListener("click", () => {
  confirmBtn.disabled = true;
  setStatus("⏳ Filling form...", "loading");

  const editedAnswers = getEditedAnswers();

  chrome.runtime.sendMessage({
    action: "FILL_WITH_ANSWERS",
    answers: editedAnswers
  }, (response) => {
    confirmBtn.disabled = false;

    if (chrome.runtime.lastError) {
      setStatus("❌ Extension error. Reload the form tab.", "error");
      return;
    }

    if (response?.success) {
      setStatus("✅ Form filled! Review in the page and submit manually.", "success");
      // Close the popup now that filling is successful
      setTimeout(() => window.close(), 1000); // Wait 1 second so the user can see the checkmark before it closes
    } else {
      setStatus(`❌ ${response?.error || "Fill failed"}`, "error");
    }
  });
});

// ── Initialization & State Restoration ──
document.addEventListener("DOMContentLoaded", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]) return;
    const tabId = tabs[0].id;
    const stateKey = `form_state_${tabId}`;

    // Read initial state
    chrome.storage.local.get([stateKey], (result) => {
      handleState(result[stateKey]);
    });

    // Listen for state changes (e.g. background finishes while popup is open)
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local' && changes[stateKey]) {
        handleState(changes[stateKey].newValue);
      }
    });
  });
});

function handleState(state) {
  if (!state) return;
  
  if (state.status === 'loading') {
    fillBtn.disabled = true;
    setStatus("⏳ Scraping form & generating answers...", "loading");
    initialView.style.display = "block";
    previewPanel.style.display = "none";
    footer.style.display = "none";
  } else if (state.status === 'done') {
    fillBtn.disabled = false;
    // Only redraw preview if we aren't currently editing it
    if (previewPanel.style.display !== "block") {
      showPreview(state.answers, state.metadata);
    }
  } else if (state.status === 'error') {
    fillBtn.disabled = false;
    setStatus(`❌ ${state.error}`, "error");
    initialView.style.display = "block";
    previewPanel.style.display = "none";
    footer.style.display = "none";
  }
}
