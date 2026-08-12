// The writing-notes word cap.
//
// Mirrors `WRITING_NOTES_MAX_WORDS` and `count_words` in
// backend/modules/auth/models.py. The backend is authoritative — this side
// exists so the user finds out before a round trip, not so the browser gets
// to decide.
//
// "A word is a run of non-whitespace" is chosen because it is the one
// definition that means the same thing in Python's `re` and in JavaScript's
// RegExp without either side special-casing anything. The same fixtures are
// pinned in both test suites so the two cannot quietly drift apart.
//
// Deliberately not surfaced in the UI: there is no counter and no "10,000"
// anywhere on the settings page. It is a ceiling nobody writing real emphasis
// notes will approach, and showing it would invite people to treat it as a
// target.

export const WRITING_NOTES_MAX_WORDS = 10_000;

/** Words in a piece of free text, where a word is a run of non-whitespace. */
export function countWords(text: string): number {
  return text.match(/\S+/g)?.length ?? 0;
}

/** `null` when the text is within the cap, otherwise the message to show.
 *
 *  The message names the limit only once it has actually been exceeded — at
 *  that point the number is the useful thing to say, and staying vague would
 *  leave the user guessing how much to cut. */
export function writingNotesError(text: string): string | null {
  const words = countWords(text);
  if (words <= WRITING_NOTES_MAX_WORDS) return null;
  return `Writing notes are ${words.toLocaleString()} words — the limit is ${WRITING_NOTES_MAX_WORDS.toLocaleString()}.`;
}
