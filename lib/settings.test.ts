import { describe, expect, it } from "vitest";

import type { KeysResponse } from "./api";
import { buildKeysPayload, formFromKeys, isEmptyPayload } from "./settings";

const STORED: KeysResponse = {
  gemini_api_key: "AIza…7f2c", // masked display form, never the real key
  gemini_configured: true,
  gemini_status: "ok",
  resend_api_key: null,
  resend_configured: false,
  resend_status: "unset",
  sender_email: "me@example.com",
  reply_to_email: null,
  full_name: "Aryan",
  headline: "B.Tech ECE",
  phone: "+91 90000 00000",
  portfolio_url: null,
  github_url: null,
  linkedin_url: null,
  contact_email: "me@example.com",
  writing_notes: null,
};

describe("formFromKeys", () => {
  it("seeds identity fields but never the masked secrets", () => {
    const form = formFromKeys(STORED);

    expect(form.full_name).toBe("Aryan");
    expect(form.sender_email).toBe("me@example.com");
    expect(form.portfolio_url).toBe("");
    // Critical: seeding the masked string would let an untouched save write
    // "AIza…7f2c" over the real key.
    expect(form.gemini_api_key).toBe("");
  });
});

describe("buildKeysPayload", () => {
  it("sends nothing when nothing changed", () => {
    const payload = buildKeysPayload(STORED, formFromKeys(STORED));

    expect(payload).toEqual({});
    expect(isEmptyPayload(payload)).toBe(true);
  });

  it("never echoes a masked key back to the server", () => {
    const form = formFromKeys(STORED);
    form.gemini_api_key = STORED.gemini_api_key!; // as if the field were pre-filled

    const payload = buildKeysPayload(STORED, form);

    // It is included only because the string differs from empty — the guard
    // that matters is that formFromKeys never puts it there in the first
    // place. This test pins the pairing of the two.
    expect(formFromKeys(STORED).gemini_api_key).toBe("");
    expect(buildKeysPayload(STORED, formFromKeys(STORED)).gemini_api_key).toBeUndefined();
    expect(payload.gemini_api_key).toBe(STORED.gemini_api_key);
  });

  it("includes a newly typed key", () => {
    const form = formFromKeys(STORED);
    form.resend_api_key = "  re_live_abc123  ";

    const payload = buildKeysPayload(STORED, form);

    expect(payload.resend_api_key).toBe("re_live_abc123");
  });

  it("sends a blank identity field so it actually clears", () => {
    const form = formFromKeys(STORED);
    form.phone = "";

    const payload = buildKeysPayload(STORED, form);

    expect(payload).toHaveProperty("phone", "");
  });

  it("omits an email field the user blanked, rather than 422ing the whole save", () => {
    // sender_email / reply_to_email / contact_email are Optional[EmailStr] on
    // the backend and reject "" outright. Sending one would fail the entire
    // request, taking every other edited field down with it.
    const form = formFromKeys(STORED);
    form.contact_email = "";
    form.sender_email = "";
    form.full_name = "Aryan Kumar";

    const payload = buildKeysPayload(STORED, form);

    expect(payload).not.toHaveProperty("contact_email");
    expect(payload).not.toHaveProperty("sender_email");
    expect(payload.full_name).toBe("Aryan Kumar");
  });

  it("includes a changed email address", () => {
    const form = formFromKeys(STORED);
    form.reply_to_email = "replies@example.com";

    const payload = buildKeysPayload(STORED, form);

    expect(payload.reply_to_email).toBe("replies@example.com");
  });

  it("leaves untouched fields out entirely", () => {
    const form = formFromKeys(STORED);
    form.writing_notes = "Lead with the internship.";

    const payload = buildKeysPayload(STORED, form);

    expect(Object.keys(payload)).toEqual(["writing_notes"]);
  });
});
