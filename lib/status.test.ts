import { describe, expect, it } from "vitest";

import { PIPELINE_STATUSES, STATUS_META, statusMeta, statusStyle } from "./status";

describe("statusMeta", () => {
  it("is case-insensitive, because the backend stores whatever it was sent", () => {
    expect(statusMeta("INTERVIEW").register).toBe("live");
    expect(statusMeta("Interview").register).toBe("live");
  });

  it("falls back rather than throwing on a status it has no case for", () => {
    // PATCH /jobs/{id}/status takes any string, so the UI has to render
    // something for a value this table has never seen. Blanking the cell would
    // make a row look broken.
    const meta = statusMeta("on_hold");

    expect(meta.label).toBe("on_hold");
    expect(meta.register).toBe("waiting");
    expect(meta.responded).toBe(false);
  });

  it("survives an empty status", () => {
    expect(statusMeta("").label).toBe("Unknown");
  });
});

describe("the colour rule", () => {
  // globals.css reserves `--signal` for "a human came back to you". If that
  // stops being true, the palette stops carrying information and becomes
  // decoration — so it is pinned here rather than left to a code review.

  it("gives the signal colour to open conversations and to nothing else", () => {
    const signalled = Object.keys(STATUS_META).filter(
      (status) => STATUS_META[status].register === "live"
    );

    expect(signalled.sort()).toEqual(["interview", "offer"]);
  });

  it("keeps waiting states greyscale", () => {
    for (const status of ["applied", "sent", "ghosted"]) {
      expect(statusStyle(status).color).toBe("var(--text-muted)");
    }
  });

  it("separates 'no answer' from 'answered no'", () => {
    // Both are bad news, but only one of them is *news*. Rendering them the
    // same way loses the distinction the pipeline is there to show.
    expect(statusMeta("ghosted").responded).toBe(false);
    expect(statusMeta("rejected").responded).toBe(true);
    expect(statusStyle("ghosted").color).not.toBe(statusStyle("rejected").color);
  });

  it("treats a failed send as the user's problem, not a recruiter's answer", () => {
    expect(statusMeta("failed").responded).toBe(false);
    expect(statusStyle("failed").color).toBe("var(--warning)");
  });
});

describe("responded", () => {
  it("matches the backend's RESPONDED_STATUSES exactly", () => {
    // shared/mongodb.py: RESPONDED_STATUSES = ("interview", "offer", "rejected").
    // The dashboard shows a response rate computed there next to badges
    // coloured here; if the two lists drift, the number and the colours
    // disagree on the same screen.
    const responded = Object.keys(STATUS_META).filter((s) => STATUS_META[s].responded);

    expect(responded.sort()).toEqual(["interview", "offer", "rejected"]);
  });
});

describe("PIPELINE_STATUSES", () => {
  it("runs in funnel order", () => {
    expect(PIPELINE_STATUSES).toEqual(["applied", "interview", "offer", "rejected", "ghosted"]);
  });

  it("omits `failed`, which describes a send error rather than a user choice", () => {
    expect(PIPELINE_STATUSES).not.toContain("failed");
  });

  it("only contains statuses the badge knows how to render", () => {
    for (const status of PIPELINE_STATUSES) {
      expect(STATUS_META[status]).toBeDefined();
    }
  });
});
