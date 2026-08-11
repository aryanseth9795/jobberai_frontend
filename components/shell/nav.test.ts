import { describe, expect, it } from "vitest";

import { ALL_NAV_ITEMS, NAV, activeItem } from "./nav";

describe("NAV", () => {
  it("has no duplicate destinations", () => {
    const hrefs = ALL_NAV_ITEMS.map((item) => item.href);

    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("flattens to every item in every group", () => {
    // The sidebar renders NAV; the command palette renders ALL_NAV_ITEMS. A
    // page reachable from one and not the other is the exact failure that the
    // old per-page inline headers had — six headers, each listing a different
    // subset of the other five.
    const fromGroups = NAV.flatMap((group) => group.items);

    expect(ALL_NAV_ITEMS).toEqual(fromGroups);
  });

  it("gives every item a hint, which the palette shows as its subtitle", () => {
    for (const item of ALL_NAV_ITEMS) {
      expect(item.hint.length).toBeGreaterThan(0);
      expect(item.label.length).toBeGreaterThan(0);
    }
  });

  it("points every destination at an absolute path", () => {
    for (const item of ALL_NAV_ITEMS) {
      expect(item.href.startsWith("/")).toBe(true);
    }
  });
});

describe("activeItem", () => {
  it("matches a page exactly", () => {
    expect(activeItem("/dashboard")?.label).toBe("Overview");
  });

  it("does not light up the root item on every other page", () => {
    // "/" is a prefix of every path, so a startsWith test would mark Draft
    // active everywhere in the app.
    expect(activeItem("/settings")?.href).toBe("/settings");
    expect(activeItem("/settings")?.href).not.toBe("/");
  });

  it("returns undefined for a path that is not in the nav", () => {
    expect(activeItem("/onboarding")).toBeUndefined();
  });
});
