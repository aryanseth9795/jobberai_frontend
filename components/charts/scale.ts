// Chart maths, kept out of the components so it can be tested without a DOM.
//
// Everything here is pure: given the same numbers it returns the same path
// string. The components own pixels and pointers; this owns arithmetic.

export type Pt = readonly [number, number];

/**
 * Axis ticks that land on numbers a person would choose — 0/2/4/6/8, never
 * 0/1.75/3.5/5.25/7.
 *
 * Small counts get unit ticks instead of a padded axis: with a maximum of 2,
 * an axis that runs to 4 makes a real week look like a failure.
 */
export function ticks(max: number, steps = 4): number[] {
  if (!Number.isFinite(max) || max <= 0) return [0, 1];
  if (max <= steps) {
    return Array.from({ length: Math.ceil(max) + 1 }, (_, i) => i);
  }

  const raw = max / steps;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const normalised = raw / magnitude;
  // 2.5 is in the list so that a maximum of 100 gives 0/25/50/75/100 rather
  // than being rounded up to an axis that tops out at 200.
  const step = (normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 2.5 ? 2.5 : normalised <= 5 ? 5 : 10) * magnitude;
  // Counts are whole numbers, so a fractional tick would be a lie about the
  // resolution of the data.
  const whole = Math.max(1, Math.round(step));
  return Array.from({ length: steps + 1 }, (_, i) => i * whole);
}

/** The top of the axis — the last tick, not the data's own maximum. */
export function axisMax(max: number, steps = 4): number {
  const t = ticks(max, steps);
  return t[t.length - 1] || 1;
}

/** `M x,y L x,y …` through every point. */
export function linePath(points: readonly Pt[]): string {
  if (points.length === 0) return "";
  return points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${round(x)},${round(y)}`).join(" ");
}

/** The same line, closed down to the baseline, for a wash under a series. */
export function areaPath(points: readonly Pt[], baseline: number): string {
  if (points.length === 0) return "";
  const first = points[0];
  const last = points[points.length - 1];
  return `${linePath(points)} L${round(last[0])},${round(baseline)} L${round(first[0])},${round(baseline)} Z`;
}

// Sub-pixel precision in a path string is bytes nobody can see.
function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * The index whose x sits closest to the pointer.
 *
 * Nearest rather than "the one under the cursor" so the reader aims at a date
 * rather than at a 2px line, which is the difference between a crosshair that
 * feels sticky and one that feels broken.
 */
export function nearestIndex(x: number, count: number, left: number, right: number): number {
  if (count <= 1) return 0;
  const span = right - left;
  if (span <= 0) return 0;
  const ratio = (x - left) / span;
  return Math.min(count - 1, Math.max(0, Math.round(ratio * (count - 1))));
}

/**
 * Squash a long series down to `count` buckets by summing each run.
 *
 * A 90-day series drawn into a 96px sparkline puts a point every pixel, which
 * renders as a grey scribble rather than a trend. Summing rather than sampling
 * so a spike is never dropped — the shape stays honest, it just gets coarser.
 */
export function bucket(values: readonly number[], count: number): number[] {
  if (count <= 0) return [];
  if (values.length <= count) return [...values];

  const size = values.length / count;
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    const from = Math.floor(i * size);
    const to = Math.floor((i + 1) * size);
    let sum = 0;
    for (let j = from; j < to; j++) sum += values[j];
    out.push(sum);
  }
  return out;
}

/**
 * Which x positions get a label.
 *
 * A tick per day turns the axis into a grey smear at any realistic width, so
 * the first and last are always labelled and the middle is thinned to fit.
 */
export function labelledIndices(count: number, maxLabels: number): number[] {
  if (count <= 0) return [];
  if (count <= maxLabels) return Array.from({ length: count }, (_, i) => i);

  const stride = Math.ceil((count - 1) / (maxLabels - 1));
  const out: number[] = [];
  for (let i = 0; i < count - 1; i += stride) out.push(i);
  // The last point is the one the reader looks for first — never drop it, and
  // drop its neighbour instead of letting the two labels collide.
  if (out[out.length - 1] === count - 2) out.pop();
  out.push(count - 1);
  return out;
}
