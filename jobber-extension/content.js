// content.js — Runs on docs.google.com/forms/*

// Exposed to tests at the bottom of the file, see edit (e) — NOT with `export`,
// which is a SyntaxError in a classic content script. Google Forms' data-value
// strings and the model's answers disagree over case, padding and trailing
// punctuation often enough that exact comparison silently selects nothing.
function normalizeOption(value) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ").replace(/[.,;:!]+$/, "").toLowerCase();
}

function matchesOption(a, b) {
  const left = normalizeOption(a);
  const right = normalizeOption(b);
  return left !== "" && left === right;
}

// Matches a stored answer back to a freshly (re-)scraped question. Prefers
// the question text — stable across a reload, and the only thing that still
// identifies a question correctly if the page re-rendered with the
// questions in a different order — and falls back to positional index only
// when no question's text matches. Matching on index alone is what let a
// wrong-form fill (C2) or a reordered re-scrape silently type an answer into
// the wrong field.
// `used` holds the question objects already claimed by earlier answers in this
// fill pass. Without it, a form with two identically-worded blocks ("Additional
// comments" twice, say) resolves both answers to the same first match: the block
// is filled twice, `filled` counts two, nothing lands in `failed`, and the popup
// reports a complete fill over a field that is still blank. Skipping claimed
// questions pairs each answer with its own block, and honestly reports a miss
// when there is no unclaimed block left.
function findQuestionForAnswer(questions, answer, used = new Set()) {
  if (answer?.question) {
    const byText = questions.find((q) => q.question === answer.question && !used.has(q));
    if (byText) return byText;
  }
  const byIndex = questions.find((q) => q.index === answer.index);
  return byIndex && !used.has(byIndex) ? byIndex : null;
}

// ─────────────────────────────────────────
// SCRAPER — Extract all questions from the form
// ─────────────────────────────────────────

function scrapeFormQuestions() {
  const questions = [];

  // Each question block in Google Forms has role="listitem"
  const questionBlocks = document.querySelectorAll('[role="listitem"]');

  questionBlocks.forEach((block, index) => {
    const questionTextEl = block.querySelector('[data-params]') ||
                           block.querySelector('.freebirdFormviewerComponentsQuestionBaseTitle');

    if (!questionTextEl) return;

    // innerText is unimplemented in jsdom (tests), so fall back to textContent
    // there; real Chrome always has innerText and uses it unchanged.
    const questionText = (questionTextEl.innerText ?? questionTextEl.textContent ?? "").trim();
    let fieldType = "text"; // default

    if (block.querySelector('input[type="text"], textarea')) {
      fieldType = block.querySelector('textarea') ? "long_text" : "short_text";
    } else if (block.querySelector('[role="radio"]')) {
      fieldType = "radio";
    } else if (block.querySelector('[role="checkbox"]')) {
      fieldType = "checkbox";
    } else if (block.querySelector('[role="listbox"]')) {
      fieldType = "dropdown";
    }

    // For radio/checkbox — collect available options
    let options = [];
    if (["radio", "checkbox"].includes(fieldType)) {
      block.querySelectorAll('[role="radio"], [role="checkbox"]').forEach(opt => {
        const label = opt.closest('[data-value]')?.getAttribute('data-value') ||
                      opt.parentElement?.innerText?.trim();
        if (label) options.push(label);
      });
    }

    // For dropdown — options are harder to scrape initially unless clicked, 
    // but some are in data-params. Let's try basic extraction.
    if (fieldType === "dropdown") {
       // In newer forms, dropdown options are deeply nested or only loaded on
       // click, so the listbox element is not read here — the options come out
       // of the data-params blob below instead. A known limitation without
       // complex DOM simulation.
       // Often data-params has them.
       if (questionTextEl && questionTextEl.getAttribute('data-params')) {
           try {
               const params = JSON.parse(questionTextEl.getAttribute('data-params').substring(4)); // Strip leading "%.@." 
               // This is fragile but works sometimes. For robust, we just let LLM guess if no options found.
               if (params && params[0] && params[0][4] && params[0][4][0] && params[0][4][0][1]) {
                   options = params[0][4][0][1].map(opt => opt[0]);
               }
           } catch { /* the params blob is undocumented and its shape varies */ }
       }
    }

    questions.push({
      index,
      question: questionText,
      type: fieldType,
      options,
      element: block   // keep DOM reference for filling later
    });
  });

  return questions;
}


// ─────────────────────────────────────────
// FILLER — Inject answers back into the DOM
// ─────────────────────────────────────────

function setReactInputValue(inputEl, value) {
  const nativeSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype, 'value'
  ).set;
  nativeSetter.call(inputEl, value);
  inputEl.dispatchEvent(new Event('input', { bubbles: true }));
}

function setReactTextareaValue(textareaEl, value) {
  const nativeSetter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype, 'value'
  ).set;
  nativeSetter.call(textareaEl, value);
  textareaEl.dispatchEvent(new Event('input', { bubbles: true }));
}

// Returns true when the field was actually populated. The old version returned
// nothing and the caller reported success unconditionally, so a form that was
// half filled still looked like a clean run.
async function fillQuestion(questionObj, answer) {
  const block = questionObj.element;
  if (!answer || !answer.trim()) return false;
  if (!block || !block.isConnected) return false;

  switch (questionObj.type) {
    case "short_text": {
      const input = block.querySelector('input[type="text"]');
      if (!input) return false;
      setReactInputValue(input, answer);
      return true;
    }

    case "long_text": {
      const textarea = block.querySelector("textarea");
      if (!textarea) return false;
      setReactTextareaValue(textarea, answer);
      return true;
    }

    case "radio": {
      for (const option of block.querySelectorAll('[role="radio"]')) {
        const label = option.closest("[data-value]")?.getAttribute("data-value");
        if (matchesOption(label, answer)) {
          option.click();
          return true;
        }
      }
      return false;
    }

    case "checkbox": {
      const wanted = answer.split(",").filter((part) => part.trim());
      let hits = 0;
      for (const option of block.querySelectorAll('[role="checkbox"]')) {
        const label = option.closest("[data-value]")?.getAttribute("data-value");
        if (!wanted.some((want) => matchesOption(label, want))) continue;
        if (option.getAttribute("aria-checked") !== "true") option.click();
        hits += 1;
      }
      return hits > 0;
    }

    case "dropdown": {
      const listbox = block.querySelector('[role="listbox"]');
      if (!listbox) return false;
      listbox.click();

      // Poll rather than guess at an animation duration. The old code used a
      // fire-and-forget setTimeout(500) and reported success before the option
      // had been clicked — or when it was never found at all.
      const deadline = Date.now() + 2000;
      while (Date.now() < deadline) {
        for (const option of document.querySelectorAll('div[role="option"]')) {
          if (matchesOption(option.innerText, answer)) {
            option.click();
            return true;
          }
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      return false;
    }

    default:
      return false;
  }
}


// ─────────────────────────────────────────
// MESSAGE LISTENER — Receives commands from background.js
// ─────────────────────────────────────────

// Guarded so the functions above can be imported by content.test.ts, where no
// extension APIs exist. In Chrome this is always true.
if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

    if (message.action === "SCRAPE_FORM") {
      const questions = scrapeFormQuestions();

      // Strip DOM element references before sending over message channel
      const payload = questions.map(q => ({
        index: q.index,
        question: q.question,
        type: q.type,
        options: q.options
      }));

      sendResponse({ success: true, questions: payload });

      // Save DOM references globally for filling later
      window.__jobberQuestions = questions;
    }

    if (message.action === "FILL_FORM") {
      (async () => {
        let questions = window.__jobberQuestions || [];

        // A form that re-rendered between scrape and fill leaves detached nodes
        // behind, and filling them is a silent no-op. Re-scrape and re-match.
        // Also re-scrape when the cache is simply empty: a page reload gives
        // the content script a fresh `window`, so a restored review (the
        // draft survives in chrome.storage.local) has nothing cached to fill
        // from. `[].some(...)` is false, so the old guard let this case slip
        // through and report "Filled 0 of N" (C3).
        if (!questions.length || questions.some((q) => !q.element?.isConnected)) {
          questions = scrapeFormQuestions();
          window.__jobberQuestions = questions;
        }

        let filled = 0;
        const failed = [];
        const used = new Set();

        for (const answer of message.answers) {
          const question = findQuestionForAnswer(questions, answer, used);
          if (!question) {
            failed.push(answer.question || `Question ${answer.index + 1}`);
            continue;
          }
          used.add(question);
          if (await fillQuestion(question, answer.answer)) {
            filled += 1;
          } else {
            failed.push(question.question || `Question ${answer.index + 1}`);
          }
        }

        sendResponse({ success: true, filled, failed });
      })();

      return true; // async response
    }

    return true; // Keep message channel open for async sendResponse
  });
}

// Chrome loads this as a classic content script, where `module` is undefined
// and this block is skipped. Vitest resolves .js as CommonJS (package.json
// declares no "type": "module"), so this is what lets content.test.ts reach
// the functions above. Verified: named imports work through this pattern.
if (typeof module !== "undefined") {
  module.exports = {
    normalizeOption,
    matchesOption,
    findQuestionForAnswer,
    scrapeFormQuestions,
    fillQuestion,
  };
}
