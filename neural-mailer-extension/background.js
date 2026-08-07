// background.js — Service Worker
// Two-phase pipeline:
//   1) SCRAPE_AND_GENERATE — scrape form, call backend, return answers to popup
//   2) FILL_WITH_ANSWERS   — send (possibly edited) answers to content script

const FASTAPI_URL = "http://localhost:8000/api/gform/fill-form";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // ── Phase 1: Scrape → Backend → Return answers to popup ──
  if (message.action === "SCRAPE_AND_GENERATE") {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const tabId = tabs[0].id;

      try {
        await chrome.storage.local.set({
          [`form_state_${tabId}`]: { status: "loading" },
        });

        // Ask content script to scrape the form
        const scrapeResult = await chrome.tabs.sendMessage(tabId, {
          action: "SCRAPE_FORM",
        });

        if (!scrapeResult.success) {
          const errMsg =
            "Failed to scrape form. Make sure you are on a Google Form page.";
          await chrome.storage.local.set({
            [`form_state_${tabId}`]: { status: "error", error: errMsg },
          });
          sendResponse({ success: false, error: errMsg });
          return;
        }

        // Send questions + form metadata to FastAPI backend
        const response = await fetch(FASTAPI_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            questions: scrapeResult.questions,
            form_url: tabs[0].url || "",
            form_title: tabs[0].title || "",
          }),
        });

        if (!response.ok) {
          const errMsg = `Backend error: ${response.status}`;
          await chrome.storage.local.set({
            [`form_state_${tabId}`]: { status: "error", error: errMsg },
          });
          sendResponse({ success: false, error: errMsg });
          return;
        }

        const data = await response.json();

        // Include question types in the answers for the preview UI
        const answersWithType = data.answers.map((ans) => {
          const q = scrapeResult.questions.find((q) => q.index === ans.index);
          return { ...ans, type: q?.type || "text" };
        });

        const successData = {
          status: "done",
          answers: answersWithType,
          metadata: data.metadata || {},
        };
        await chrome.storage.local.set({
          [`form_state_${tabId}`]: successData,
        });

        // Return answers to popup for preview (DO NOT fill yet)
        sendResponse({
          success: true,
          answers: successData.answers,
          metadata: successData.metadata,
        });
      } catch (err) {
        await chrome.storage.local.set({
          [`form_state_${tabId}`]: { status: "error", error: err.message },
        });
        sendResponse({ success: false, error: err.message });
      }
    });

    return true; // Keep channel open for async
  }

  // ── Phase 2: Fill form with (possibly edited) answers ──
  if (message.action === "FILL_WITH_ANSWERS") {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const tabId = tabs[0].id;

      try {
        const fillResult = await chrome.tabs.sendMessage(tabId, {
          action: "FILL_FORM",
          answers: message.answers,
        });

        if (fillResult?.success) {
          await chrome.storage.local.remove(`form_state_${tabId}`);
          sendResponse({ success: true, message: "Form filled successfully!" });
        } else {
          sendResponse({
            success: false,
            error: "Failed to inject answers into form.",
          });
        }
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    });

    return true;
  }
});
