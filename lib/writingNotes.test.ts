import { describe, expect, it } from "vitest";

import { WRITING_NOTES_MAX_WORDS, countWords, writingNotesError } from "./writingNotes";

/**
 * The shared fixtures.
 *
 * backend/tests/test_writing_notes.py pins this exact table against the
 * Python implementation. A word cap enforced in two places is only a cap if
 * both places agree on what a word is; if these two lists ever disagree, one
 * of the suites fails rather than a user hitting a limit the UI said they had
 * not reached.
 */
export const WORD_COUNT_FIXTURES: [string, number][] = [
  ["", 0],
  ["   ", 0],
  ["\n\t  \n", 0],
  ["one", 1],
  ["two words", 2],
  ["  leading and trailing  ", 3],
  ["multiple   internal    spaces", 3],
  ["line\nbreaks\ncount", 3],
  ["tabs\tcount\ttoo", 3],
  ["mixed \n\t whitespace \n runs", 3],
  ["punctuation, isn't a separator", 4],
  ["hyphenated-words count once", 3],
  ["em—dash joins", 2],
  ["trailing newline\n", 2],
  ["CJK 日本語 text", 3],
  ["emoji 🚀 counts", 3],
];

describe("countWords", () => {
  it.each(WORD_COUNT_FIXTURES)("counts %j as %i", (text, expected) => {
    expect(countWords(text)).toBe(expected);
  });

  it("counts a run of non-whitespace as one word, however long", () => {
    // The rule is deliberately crude. A URL is one word; so is a paragraph
    // with no spaces. What matters is that Python agrees.
    expect(countWords("https://example.com/a/very/long/path?q=1")).toBe(1);
  });
});

describe("writingNotesError", () => {
  it("says nothing for ordinary notes", () => {
    expect(writingNotesError("Lead with the internship, then side projects.")).toBeNull();
  });

  it("says nothing for empty notes", () => {
    expect(writingNotesError("")).toBeNull();
  });

  it("allows exactly the limit", () => {
    // Off-by-one here would reject text the backend accepts, which is the
    // worse direction: the user would be blocked by a check that is not the
    // real gate.
    expect(writingNotesError(Array(WRITING_NOTES_MAX_WORDS).fill("word").join(" "))).toBeNull();
  });

  it("rejects one word past the limit", () => {
    const text = Array(WRITING_NOTES_MAX_WORDS + 1).fill("word").join(" ");
    expect(writingNotesError(text)).toContain("10,001");
  });

  it("names the limit only once it has been exceeded", () => {
    // The cap is not advertised anywhere in the UI, so the one place a number
    // may appear is here — where the user needs it to know how much to cut.
    const message = writingNotesError(Array(WRITING_NOTES_MAX_WORDS + 5).fill("w").join(" "));
    expect(message).toContain("10,000");
  });
});
