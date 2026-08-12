"use client";

import { compact } from "@/lib/format";
import { axisMax } from "./scale";

export interface BarDatum {
  label: string;
  value: number;
  /** A token. Omit for the default series colour — which is the right answer
   *  for nominal categories (companies, teams): colouring each bar by its own
   *  size re-encodes the length as hue and spends the identity channel on
   *  something the bar already says. Pass a colour only when it means
   *  something the length does not, such as a status register. */
  color?: string;
}

/**
 * Horizontal bars, built in HTML rather than SVG.
 *
 * The labels here are company names — long, arbitrary, and user-supplied — and
 * HTML truncates, wraps and reads them out to a screen reader for free, where
 * SVG `<text>` would need all three hand-rolled.
 */
export function BarChart({
  data,
  max,
  emptyLabel = "Nothing to show yet.",
}: {
  data: BarDatum[];
  /** Override the scale, so two stacked charts can share one. */
  max?: number;
  emptyLabel?: string;
}) {
  if (data.length === 0) {
    return <p className="py-6 text-center text-[12.5px] text-muted">{emptyLabel}</p>;
  }

  const top = axisMax(max ?? Math.max(...data.map((d) => d.value)), 4);

  return (
    <ul className="flex flex-col gap-2.5">
      {data.map((d) => (
        <li key={d.label} className="group flex items-center gap-3">
          <span className="w-[38%] shrink-0 truncate text-[12.5px] text-muted" title={d.label}>
            {d.label}
          </span>

          <span className="relative h-2.5 min-w-0 flex-1 overflow-hidden rounded-sm" style={{ background: "var(--surface-2)" }}>
            <span
              className="absolute inset-y-0 left-0 transition-[width] duration-300 motion-reduce:transition-none"
              style={{
                width: `${Math.max(d.value > 0 ? 2 : 0, (d.value / top) * 100)}%`,
                background: d.color ?? "var(--chart-1)",
                // Square where it leaves the baseline, rounded at the data end.
                borderRadius: "0 4px 4px 0",
              }}
            />
          </span>

          <span className="w-9 shrink-0 text-right text-[12.5px] font-medium tabular-nums">
            {compact(d.value)}
          </span>
        </li>
      ))}
    </ul>
  );
}
