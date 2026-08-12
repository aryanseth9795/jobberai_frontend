import { describe, expect, it } from "vitest";

import { compact, delta, longDate, percent, shortDate } from "./format";

describe("compact", () => {
  it("keeps four-digit counts exact", () => {
    // 1,284 is legible and true; 1.3K throws away information to save one
    // character.
    expect(compact(1284)).toBe("1,284");
    expect(compact(9999)).toBe("9,999");
  });

  it("shortens past five digits", () => {
    expect(compact(12_900)).toBe("12.9K");
    expect(compact(1_500_000)).toBe("1.5M");
  });

  it("drops a trailing zero decimal", () => {
    expect(compact(12_000)).toBe("12K");
    expect(compact(2_000_000)).toBe("2M");
  });

  it("renders zero as zero, not an em dash", () => {
    // A real count of nothing is information. Only a missing value is "—".
    expect(compact(0)).toBe("0");
  });

  it("does not print NaN into the UI", () => {
    expect(compact(NaN)).toBe("—");
    expect(compact(Infinity)).toBe("—");
  });
});

describe("percent", () => {
  it("keeps one decimal by default", () => {
    // Across 30 applications, 6% versus 6.7% is a whole extra reply.
    expect(percent(0.067)).toBe("6.7%");
  });

  it("drops a pointless decimal", () => {
    expect(percent(0.25)).toBe("25%");
  });

  it("rounds to whole numbers when asked", () => {
    expect(percent(0.067, 0)).toBe("7%");
  });
});

describe("dates", () => {
  it("formats a bare ISO date", () => {
    expect(shortDate("2026-08-12")).toBe("12 Aug");
    expect(longDate("2026-08-12")).toBe("12 Aug 2026");
  });

  it("does not shift the day by timezone", () => {
    // new Date("2026-01-01") is UTC midnight, so anywhere west of Greenwich
    // it renders as 31 Dec. Splitting the string sidesteps the whole class of
    // bug — and this test fails on a machine set to New York if anyone
    // "simplifies" it back to the Date constructor.
    expect(shortDate("2026-01-01")).toBe("1 Jan");
    expect(shortDate("2026-12-31")).toBe("31 Dec");
  });

  it("passes through anything that is not a date", () => {
    expect(shortDate("")).toBe("");
    expect(shortDate("not-a-date")).toBe("not-a-date");
  });
});

describe("delta", () => {
  it("signs the direction", () => {
    expect(delta(120, 100)).toEqual({ text: "+20%", direction: 1 });
    expect(delta(80, 100)).toEqual({ text: "-20%", direction: -1 });
  });

  it("reports no movement as flat rather than as a rise", () => {
    expect(delta(100, 100)).toEqual({ text: "0%", direction: 0 });
  });

  it("returns nothing when there is no prior period", () => {
    // Every first week would otherwise show "+100%" against a zero baseline,
    // which is arithmetic rather than information.
    expect(delta(12, 0)).toBeNull();
    expect(delta(0, 0)).toBeNull();
  });
});
