// Payload construction for PUT /api/auth/me/keys.
//
// Kept out of the page component so it can be tested directly — the rules
// here are subtle enough that getting them wrong silently destroys a user's
// stored settings.

import type { KeysResponse, UpdateKeysRequest } from "./api";

/** Free text. A blank value is meaningful: it *clears* the stored field. */
export const IDENTITY_TEXT_FIELDS = [
  "full_name",
  "headline",
  "phone",
  "portfolio_url",
  "github_url",
  "linkedin_url",
  "writing_notes",
] as const;

/**
 * Typed `Optional[EmailStr]` on the backend, which rejects "" with a 422
 * rather than treating it as "clear this". Sending a blank one would surface
 * as a validation error on an unrelated field, so a blank is omitted instead
 * — meaning these three cannot currently be cleared through the UI. That is a
 * known backend inconsistency (logged as deferred in the 1.5g ledger), worked
 * around here rather than papered over.
 */
export const IDENTITY_EMAIL_FIELDS = [
  "sender_email",
  "reply_to_email",
  "contact_email",
] as const;

/** Masked on read, so their current value can never be echoed back. */
export const SECRET_FIELDS = ["gemini_api_key", "resend_api_key"] as const;

export type SettingsForm = Record<string, string>;

/** The editable fields of a KeysResponse, as form strings. Masked secrets are
 * deliberately *not* seeded into the form — see buildKeysPayload. */
export function formFromKeys(keys: KeysResponse): SettingsForm {
  const form: SettingsForm = {};
  for (const field of [...IDENTITY_TEXT_FIELDS, ...IDENTITY_EMAIL_FIELDS]) {
    form[field] = keys[field] ?? "";
  }
  for (const field of SECRET_FIELDS) {
    form[field] = "";
  }
  return form;
}

/**
 * Build the partial update.
 *
 * `PUT /me/keys` $sets only the fields present in the body, so *omitting* a
 * field leaves it untouched while sending a blank string clears it. The two
 * cases must not be confused:
 *
 *  - A secret the user didn't retype is omitted. Sending back the masked
 *    display string ("AIza…7f2c") would overwrite the real key with garbage.
 *  - An identity field the user blanked is sent as "" so it actually clears.
 *  - An identity field the user didn't touch is omitted, keeping the request
 *    small and avoiding pointless rewrites.
 */
export function buildKeysPayload(
  initial: KeysResponse,
  form: SettingsForm
): UpdateKeysRequest {
  const payload: Record<string, string> = {};

  for (const field of SECRET_FIELDS) {
    const typed = (form[field] ?? "").trim();
    if (typed) payload[field] = typed;
  }

  for (const field of IDENTITY_TEXT_FIELDS) {
    const next = form[field] ?? "";
    if (next !== (initial[field] ?? "")) payload[field] = next;
  }

  for (const field of IDENTITY_EMAIL_FIELDS) {
    const next = (form[field] ?? "").trim();
    if (next && next !== (initial[field] ?? "")) payload[field] = next;
  }

  return payload as UpdateKeysRequest;
}

/** True when the form has nothing worth sending. */
export function isEmptyPayload(payload: UpdateKeysRequest): boolean {
  return Object.keys(payload).length === 0;
}
