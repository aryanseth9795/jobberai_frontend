// Number and date formatting for display.
//
// Kept in one module because the same value shows up in three places — a stat
// tile, an axis tick, a table cell — and "1.2K" in one and "1,240" in another
// reads as two different numbers.

/**
 * A count, shortened only once it stops being readable in full.
 *
 * The threshold is 10,000 rather than 1,000 on purpose: `1,284` is perfectly
 * legible and exact, while `1.3K` throws away information for no gain. Past
 * five digits the exact value stops being the point.
 */
export function compact(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs < 10_000) return n.toLocaleString("en-US");
  if (abs < 1_000_000) return `${trim(n / 1_000)}K`;
  return `${trim(n / 1_000_000)}M`;
}

function trim(n: number): string {
  // 12.0K reads as spurious precision; 12K is the same number.
  return n.toFixed(1).replace(/\.0$/, "");
}

/** A 0–1 rate as a percentage. One decimal by default — with 30 applications
 *  the difference between 6% and 6.7% is a whole reply. */
export function percent(rate: number, digits = 1): string {
  if (!Number.isFinite(rate)) return "—";
  return `${(rate * 100).toFixed(digits).replace(/\.0$/, "")}%`;
}

/**
 * `2026-08-12` → `12 Aug`.
 *
 * Split rather than `new Date(iso)` deliberately. That constructor reads a
 * bare date as UTC midnight, so anyone west of Greenwich renders every point
 * one day early — an off-by-one that is invisible in London and wrong
 * everywhere else.
 */
export function shortDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${MONTHS[m - 1]}`;
}

/** `2026-08-12` → `12 Aug 2026`. */
export function longDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** A signed change, for a stat tile's delta. Returns null when there is no
 *  prior period to compare against — "+100%" against zero history is noise. */
export function delta(current: number, previous: number): { text: string; direction: 1 | 0 | -1 } | null {
  if (previous <= 0) return null;
  const change = (current - previous) / previous;
  const direction = change > 0.001 ? 1 : change < -0.001 ? -1 : 0;
  const sign = direction > 0 ? "+" : "";
  return { text: `${sign}${percent(change, 0)}`, direction };
}
