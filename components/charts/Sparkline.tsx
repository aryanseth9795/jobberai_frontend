"use client";

import { linePath, type Pt } from "./scale";

/**
 * The shape of a trend, inside a stat tile. No axes, no labels, no hover —
 * the number beside it is the value, and this only says which way it has been
 * going.
 *
 * Drawn at a fixed size rather than measured, because a tile's sparkline is
 * decoration for a figure that is already exact: a few pixels of stretch costs
 * nothing here, and a ResizeObserver per tile in a KPI row costs more.
 */
export function Sparkline({
  values,
  width = 96,
  height = 28,
  color = "var(--chart-1)",
  label,
}: {
  values: number[];
  width?: number;
  height?: number;
  /** A token, not a hex. Defaults to the de-emphasis series colour. */
  color?: string;
  /** Screen-reader description. The visible label lives on the tile. */
  label?: string;
}) {
  if (values.length < 2) {
    // One point is not a trend. Drawing a dot implies a flat line, which is a
    // claim about history this data does not support.
    return <div style={{ width, height }} aria-hidden="true" />;
  }

  const pad = 3; // room for the end dot's radius so it is never clipped
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;

  const points: Pt[] = values.map((v, i) => [
    pad + (i / (values.length - 1)) * (width - pad * 2),
    height - pad - ((v - min) / span) * (height - pad * 2),
  ]);

  const last = points[points.length - 1];

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role={label ? "img" : "presentation"}
      aria-label={label}
      aria-hidden={label ? undefined : "true"}
      style={{ overflow: "visible" }}
    >
      <path
        d={linePath(points)}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* The surface ring keeps the end dot readable where it sits on top of
          the line it terminates. */}
      <circle cx={last[0]} cy={last[1]} r={3} fill={color} stroke="var(--surface)" strokeWidth={2} />
    </svg>
  );
}
