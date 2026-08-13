import { beforeEach, describe, expect, it } from "vitest";
import { fillQuestion, matchesOption, normalizeOption, scrapeFormQuestions } from "./content.js";

describe("normalizeOption", () => {
  it("collapses case, whitespace and trailing punctuation", () => {
    expect(normalizeOption("  Yes.  ")).toBe("yes");
    expect(normalizeOption("Full-Time   Role")).toBe("full-time role");
  });

  it("survives null and undefined", () => {
    expect(normalizeOption(null)).toBe("");
    expect(normalizeOption(undefined)).toBe("");
  });
});

describe("matchesOption", () => {
  it("matches despite case and trailing punctuation", () => {
    expect(matchesOption("Yes", "yes.")).toBe(true);
  });

  it("matches despite doubled whitespace", () => {
    expect(matchesOption("Full  Time", "Full Time")).toBe(true);
  });

  it("does not match a different option", () => {
    expect(matchesOption("Yes", "No")).toBe(false);
  });

  it("does not treat empty strings as a match", () => {
    expect(matchesOption("", "Yes")).toBe(false);
    expect(matchesOption("Yes", "")).toBe(false);
  });
});

// ── Fixture DOM ──
// Mirrors the parts of Google Forms' markup the scraper actually relies on:
// role="listitem" blocks, a [data-params] title element, and role="radio"
// options carrying data-value.

function textQuestion(text: string) {
  return `
    <div role="listitem">
      <div data-params="%.@.[[null]]">${text}</div>
      <input type="text" />
    </div>`;
}

function longTextQuestion(text: string) {
  return `
    <div role="listitem">
      <div data-params="%.@.[[null]]">${text}</div>
      <textarea></textarea>
    </div>`;
}

function radioQuestion(text: string, options: string[]) {
  const choices = options
    .map((option) => `<div data-value="${option}"><div role="radio"></div></div>`)
    .join("");
  return `
    <div role="listitem">
      <div data-params="%.@.[[null]]">${text}</div>
      ${choices}
    </div>`;
}

describe("scrapeFormQuestions", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("reads a short text question", () => {
    document.body.innerHTML = textQuestion("Your full name");

    const questions = scrapeFormQuestions();

    expect(questions).toHaveLength(1);
    expect(questions[0].question).toBe("Your full name");
    expect(questions[0].type).toBe("short_text");
  });

  it("distinguishes a textarea as long_text", () => {
    document.body.innerHTML = longTextQuestion("Why this role?");
    expect(scrapeFormQuestions()[0].type).toBe("long_text");
  });

  it("collects radio options", () => {
    document.body.innerHTML = radioQuestion("Work authorisation?", ["Yes", "No"]);

    const [question] = scrapeFormQuestions();

    expect(question.type).toBe("radio");
    expect(question.options).toEqual(["Yes", "No"]);
  });

  it("indexes questions so answers can be matched back", () => {
    document.body.innerHTML = textQuestion("One") + longTextQuestion("Two");

    const questions = scrapeFormQuestions();

    expect(questions.map((q) => q.index)).toEqual([0, 1]);
  });
});

describe("fillQuestion", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("fills a text input and reports success", async () => {
    document.body.innerHTML = textQuestion("Your full name");
    const [question] = scrapeFormQuestions();

    expect(await fillQuestion(question, "Aryan")).toBe(true);
    expect(document.querySelector("input")!.value).toBe("Aryan");
  });

  it("selects a radio option despite a trailing period", async () => {
    document.body.innerHTML = radioQuestion("Authorised?", ["Yes", "No"]);
    const [question] = scrapeFormQuestions();

    let clicked = "";
    for (const wrapper of document.querySelectorAll("[data-value]")) {
      wrapper.querySelector('[role="radio"]')!.addEventListener("click", () => {
        clicked = wrapper.getAttribute("data-value")!;
      });
    }

    expect(await fillQuestion(question, "yes.")).toBe(true);
    expect(clicked).toBe("Yes");
  });

  it("reports a miss when no option matches, instead of claiming success", async () => {
    document.body.innerHTML = radioQuestion("Authorised?", ["Yes", "No"]);
    const [question] = scrapeFormQuestions();

    expect(await fillQuestion(question, "Maybe")).toBe(false);
  });

  it("reports a miss for a detached block rather than silently no-opping", async () => {
    document.body.innerHTML = textQuestion("Your full name");
    const [question] = scrapeFormQuestions();
    document.body.innerHTML = "";

    expect(await fillQuestion(question, "Aryan")).toBe(false);
  });

  it("treats a blank answer as nothing to do", async () => {
    document.body.innerHTML = textQuestion("Your full name");
    const [question] = scrapeFormQuestions();

    expect(await fillQuestion(question, "   ")).toBe(false);
  });
});
