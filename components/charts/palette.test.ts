// @vitest-environment node

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * The chart palette, checked against the tokens it actually renders with.
 *
 * A chart mark that drops below 3:1 on its own surface is invisible to a
 * chunk of readers, and nothing else in the test suite would notice — the
 * component still mounts, the path still has a `d`, the snapshot still
 * matches. So this reads globals.css rather than a copy of the values, and
 * fails when somebody re-tunes a token without re-checking the plots.
 *
 * The full six-check validation (lightness band, chroma floor, CVD ΔE) was run
 * separately with the dataviz validator; the reasoning and the two deliberate
 * departures are recorded in Agent/plan/ui-revamp/decisions.md (D9). Contrast
 * is pinned here because it is the check most likely to be broken by an
 * innocent-looking token edit.
 */

const CSS = readFileSync(join(process.cwd(), "app", "globals.css"), "utf8");

function block(selector: string): Record<string, string> {
  const start = CSS.indexOf(selector);
  if (start === -1) throw new Error(`no ${selector} block in globals.css`);
  const body = CSS.slice(start, CSS.indexOf("\n}", start));

  const tokens: Record<string, string> = {};
  for (const [, name, value] of body.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{3,8})\s*;/g)) {
    tokens[name] = value;
  }
  return tokens;
}

const LIGHT = block(":root {");
const DARK = block(':root[data-theme="dark"] {');

function channel(v: number): number {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? [...h].map((c) => c + c).join("") : h;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Every token that gets painted as a chart mark — a line, a bar, a dot. */
const MARKS = ["chart-1", "signal", "closed", "warning", "accent"];

describe("chart marks against their surface", () => {
  for (const [mode, tokens] of [
    ["light", LIGHT],
    ["dark", DARK],
  ] as const) {
    describe(mode, () => {
      for (const mark of MARKS) {
        it(`--${mark} clears 3:1`, () => {
          expect(tokens[mark], `--${mark} missing from the ${mode} block`).toBeTruthy();
          expect(contrast(tokens[mark], tokens.surface)).toBeGreaterThanOrEqual(3);
        });
      }

      it("axis and tooltip text clears 3:1", () => {
        // These are small text, not marks. They carry the values that are not
        // direct-labelled, so they are load-bearing rather than decorative.
        expect(contrast(tokens["text-faint"], tokens.surface)).toBeGreaterThanOrEqual(3);
        expect(contrast(tokens["text-muted"], tokens.surface)).toBeGreaterThanOrEqual(4.5);
      });

      it("gridlines stay recessive", () => {
        // The opposite failure: a grid loud enough to compete with the data.
        // One step off the surface, and never more than two.
        expect(contrast(tokens.grid, tokens.surface)).toBeLessThan(2);
      });
    });
  }
});

describe("the signal reservation", () => {
  it("is not the same colour as the de-emphasis series", () => {
    // The entire palette rests on --signal being the only saturated ink. If
    // the neutral series ever equals it, every chart starts claiming that
    // sending an application is the same event as getting a reply.
    expect(LIGHT["chart-1"]).not.toBe(LIGHT.signal);
    expect(DARK["chart-1"]).not.toBe(DARK.signal);
  });

  it("is clearly separable from the de-emphasis series in both modes", () => {
    // Verified under simulated protanopia and deuteranopia with the dataviz
    // validator (ΔE 15.1 light / 15.7 dark, against a target of 8). This is
    // the cheap standing guard: the two must not drift together.
    for (const tokens of [LIGHT, DARK]) {
      const ratio = contrast(tokens["chart-1"], tokens.signal);
      expect(ratio).toBeGreaterThan(1.1);
    }
  });
});
