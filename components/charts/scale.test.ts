import { describe, expect, it } from "vitest";

import { areaPath, axisMax, bucket, labelledIndices, linePath, nearestIndex, ticks } from "./scale";

describe("ticks", () => {
  it("lands on numbers a person would choose", () => {
    expect(ticks(7)).toEqual([0, 2, 4, 6, 8]);
    expect(ticks(38)).toEqual([0, 10, 20, 30, 40]);
  });

  it("does not round 100 up to an axis that tops out at 200", () => {
    // 100/4 = 25, which is only reachable because 2.5 is in the step list.
    // Without it the axis jumps to a step of 50 and the data uses half the card.
    expect(ticks(100)).toEqual([0, 25, 50, 75, 100]);
  });

  it("uses unit ticks for small counts", () => {
    // A quiet week topping out at 2 must not be drawn against an axis that
    // runs to 4 — it makes real activity look like a failure.
    expect(ticks(2)).toEqual([0, 1, 2]);
    expect(ticks(4)).toEqual([0, 1, 2, 3, 4]);
  });

  it("never produces a fractional tick", () => {
    // The data is a count of applications. Half an application does not exist,
    // and an axis that implies otherwise misstates the resolution.
    for (const max of [1, 3, 5, 9, 13, 27, 61, 143, 999]) {
      for (const tick of ticks(max)) {
        expect(Number.isInteger(tick)).toBe(true);
      }
    }
  });

  it("always spans the data", () => {
    for (const max of [1, 2, 6, 7, 23, 38, 99, 100, 101, 512, 4999]) {
      expect(axisMax(max)).toBeGreaterThanOrEqual(max);
    }
  });

  it("survives an empty or all-zero series", () => {
    // A brand-new account has no applications at all, and a divide-by-zero
    // here would take the whole dashboard down on the one render that matters
    // most for a first impression.
    expect(ticks(0)).toEqual([0, 1]);
    expect(ticks(-5)).toEqual([0, 1]);
    expect(ticks(NaN)).toEqual([0, 1]);
    expect(axisMax(0)).toBe(1);
  });
});

describe("paths", () => {
  it("moves to the first point and lines to the rest", () => {
    expect(linePath([[0, 10], [5, 20]])).toBe("M0,10 L5,20");
  });

  it("closes an area down to the baseline", () => {
    expect(areaPath([[0, 10], [5, 20]], 100)).toBe("M0,10 L5,20 L5,100 L0,100 Z");
  });

  it("returns nothing for no points rather than a broken path", () => {
    // "M" alone renders as an SVG parse error in the console on every frame.
    expect(linePath([])).toBe("");
    expect(areaPath([], 100)).toBe("");
  });

  it("draws a single point without producing NaN", () => {
    expect(linePath([[3, 4]])).toBe("M3,4");
    expect(areaPath([[3, 4]], 50)).toBe("M3,4 L3,50 L3,50 Z");
  });

  it("rounds coordinates", () => {
    expect(linePath([[1.23456, 9.87654]])).toBe("M1.23,9.88");
  });
});

describe("nearestIndex", () => {
  const [left, right, count] = [0, 100, 5]; // points at 0, 25, 50, 75, 100

  it("snaps to the closest point, not the one under the cursor", () => {
    expect(nearestIndex(0, count, left, right)).toBe(0);
    expect(nearestIndex(24, count, left, right)).toBe(1);
    expect(nearestIndex(51, count, left, right)).toBe(2);
    expect(nearestIndex(100, count, left, right)).toBe(4);
  });

  it("clamps outside the plot instead of indexing off the end", () => {
    // The pointer keeps reporting while the button is held, including well
    // past the axis. Reading data[-1] there is a crash, not a missing tooltip.
    expect(nearestIndex(-40, count, left, right)).toBe(0);
    expect(nearestIndex(999, count, left, right)).toBe(4);
  });

  it("handles a zero-width plot during first layout", () => {
    expect(nearestIndex(10, count, 50, 50)).toBe(0);
    expect(nearestIndex(10, 1, left, right)).toBe(0);
  });
});

describe("bucket", () => {
  it("leaves a series shorter than the bucket count alone", () => {
    expect(bucket([1, 2, 3], 10)).toEqual([1, 2, 3]);
  });

  it("sums each run", () => {
    expect(bucket([1, 1, 2, 2, 3, 3], 3)).toEqual([2, 4, 6]);
  });

  it("keeps the total, so a spike is never dropped", () => {
    // Sampling every nth point would silently lose the one busy day in a
    // quiet month, which is the single most interesting thing in the series.
    const values = Array.from({ length: 90 }, (_, i) => (i === 41 ? 17 : 1));
    const summed = bucket(values, 20).reduce((a, b) => a + b, 0);
    expect(summed).toBe(values.reduce((a, b) => a + b, 0));
  });

  it("returns the right number of buckets for an uneven division", () => {
    expect(bucket(Array(90).fill(1), 20)).toHaveLength(20);
    expect(bucket(Array(7).fill(1), 4)).toHaveLength(4);
  });

  it("handles the degenerate cases", () => {
    expect(bucket([], 5)).toEqual([]);
    expect(bucket([1, 2, 3], 0)).toEqual([]);
  });
});

describe("labelledIndices", () => {
  it("labels everything when everything fits", () => {
    expect(labelledIndices(4, 6)).toEqual([0, 1, 2, 3]);
  });

  it("always keeps the first and last", () => {
    for (const count of [7, 30, 31, 90, 365]) {
      const out = labelledIndices(count, 6);
      expect(out[0]).toBe(0);
      expect(out[out.length - 1]).toBe(count - 1);
    }
  });

  it("thins the middle to fit", () => {
    expect(labelledIndices(90, 6).length).toBeLessThanOrEqual(6);
  });

  it("does not put a label immediately beside the last one", () => {
    // Two labels one pixel apart overlap into an unreadable smudge, and it is
    // always the final date — the one being looked for — that loses.
    for (const count of [11, 21, 26, 31, 61, 91]) {
      const out = labelledIndices(count, 6);
      expect(out[out.length - 1] - out[out.length - 2]).toBeGreaterThan(1);
    }
  });

  it("returns nothing for no data", () => {
    expect(labelledIndices(0, 6)).toEqual([]);
  });
});
