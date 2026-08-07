// content.js — Runs on docs.google.com/forms/*

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

    const questionText = questionTextEl.innerText.trim();
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
       const selectEl = block.querySelector('div[role="listbox"]');
       // In newer forms, dropdown options are deeply nested or only loaded on click.
       // It's a known limitation without complex DOM simulation. We'll do our best.
       // Often data-params has them.
       if (questionTextEl && questionTextEl.getAttribute('data-params')) {
           try {
               const params = JSON.parse(questionTextEl.getAttribute('data-params').substring(4)); // Strip leading "%.@." 
               // This is fragile but works sometimes. For robust, we just let LLM guess if no options found.
               if (params && params[0] && params[0][4] && params[0][4][0] && params[0][4][0][1]) {
                   options = params[0][4][0][1].map(opt => opt[0]);
               }
           } catch(e) {}
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

function fillQuestion(questionObj, answer) {
  const block = questionObj.element;

  if (!answer || answer.trim() === "") return;

  switch (questionObj.type) {

    case "short_text": {
      const input = block.querySelector('input[type="text"]');
      if (input) setReactInputValue(input, answer);
      break;
    }

    case "long_text": {
      const textarea = block.querySelector('textarea');
      if (textarea) setReactTextareaValue(textarea, answer);
      break;
    }

    case "radio": {
      const radioOptions = block.querySelectorAll('[role="radio"]');
      radioOptions.forEach(opt => {
        const label = opt.closest('[data-value]')?.getAttribute('data-value') || "";
        if (label.toLowerCase().trim() === answer.toLowerCase().trim()) {
          opt.click();
        }
      });
      break;
    }

    case "checkbox": {
      const answersToCheck = answer.split(",").map(a => a.toLowerCase().trim());
      const checkboxOptions = block.querySelectorAll('[role="checkbox"]');
      checkboxOptions.forEach(opt => {
        const label = opt.closest('[data-value]')?.getAttribute('data-value')?.toLowerCase().trim() || "";
        if (answersToCheck.includes(label)) {
          const isChecked = opt.getAttribute("aria-checked") === "true";
          if (!isChecked) opt.click();
        }
      });
      break;
    }

    case "dropdown": {
      const listbox = block.querySelector('[role="listbox"]');
      if (listbox) {
        // Open dropdown
        listbox.click();
        setTimeout(() => {
          // Find the option in the newly rendered portal/dropdown list
          // Google forms usually renders dropdowns at the end of the body
          const dropdownOptions = document.querySelectorAll('div[role="option"]');
          dropdownOptions.forEach(opt => {
            // Avoid selecting the first placeholder option
            if (opt.innerText && opt.innerText.toLowerCase().trim() === answer.toLowerCase().trim()) {
              opt.click();
            }
          });
        }, 500); // Wait for the animation to render
      }
      break;
    }
  }
}


// ─────────────────────────────────────────
// MESSAGE LISTENER — Receives commands from background.js
// ─────────────────────────────────────────

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
    window.__neuralMailerQuestions = questions;
  }

  if (message.action === "FILL_FORM") {
    const answers = message.answers; // [{ index, question, answer }, ...]

    answers.forEach(ans => {
      const questionObj = window.__neuralMailerQuestions?.find(q => q.index === ans.index);
      if (questionObj) fillQuestion(questionObj, ans.answer);
    });

    sendResponse({ success: true });
  }

  return true; // Keep message channel open for async sendResponse
});
