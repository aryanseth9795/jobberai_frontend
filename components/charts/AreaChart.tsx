"use client";

import { useState } from "react";

import { areaPath, labelledIndices, linePath, nearestIndex, ticks, type Pt } from "./scale";
import { useWidth } from "./useWidth";

export interface AreaSeries {
  key: string;
  label: string;
  /** A token — `var(--signal)`, `var(--chart-1)`. Never a raw hex. */
  color: string;
  /** Draw a 10% wash beneath the line. At most one series should: two
   *  overlapping washes make a third colour that means nothing. */
  fill?: boolean;
}

export interface AreaPoint {
  /** The x value, as stored — an ISO date. Used as a key and in the table. */
  id: string;
  /** The x value, formatted for the axis. */
  label: string;
  values: Record<string, number>;
}

const PAD = { top: 12, right: 14, bottom: 24, left: 40 };

/**
 * Two series over time, with a crosshair.
 *
 * This is an *emphasis* chart, not a categorical one: the second series is the
 * story (a human replied) and the first is the context it is read against. So
 * the wash and the muted stroke carry volume, and the only saturated ink on
 * the plot is the reply line.
 *
 * `height` is the height of the whole chart including the x-axis band, so a
 * card sized to it cannot end up with the axis cropped behind a scrollbar.
 */
export function AreaChart({
  points,
  series,
  height = 240,
  valueLabel = "applications",
}: {
  points: AreaPoint[];
  series: AreaSeries[];
  height?: number;
  valueLabel?: string;
}) {
  const [wrapRef, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);

  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = Math.max(0, height - PAD.top - PAD.bottom);

  const max = Math.max(0, ...points.flatMap((p) => series.map((s) => p.values[s.key] ?? 0)));
  const scale = ticks(max);
  const top = scale[scale.length - 1];

  const xAt = (i: number) => PAD.left + (points.length <= 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
  const yAt = (v: number) => PAD.top + plotH - (v / top) * plotH;

  const ready = width > 0 && points.length > 0;

  function pointerIndex(clientX: number, el: SVGSVGElement) {
    const rect = el.getBoundingClientRect();
    return nearestIndex(clientX - rect.left, points.length, PAD.left, PAD.left + plotW);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    // Without this the browser scrolls the page while the reader is trying to
    // walk the series.
    e.preventDefault();
    const step = e.key === "ArrowLeft" ? -1 : 1;
    setActive((prev) => {
      const next = (prev ?? points.length - 1) + step;
      return Math.min(points.length - 1, Math.max(0, next));
    });
  }

  const activePoint = active === null ? null : points[active];

  return (
    <div ref={wrapRef} className="relative" style={{ height }}>
      {ready && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={`${valueLabel} over time`}
          tabIndex={0}
          className="touch-pan-y outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded"
          onPointerMove={(e) => setActive(pointerIndex(e.clientX, e.currentTarget))}
          onPointerLeave={() => setActive(null)}
          onFocus={() => setActive((prev) => prev ?? points.length - 1)}
          onBlur={() => setActive(null)}
          onKeyDown={onKeyDown}
        >
          {/* Gridlines: solid hairlines one step off the surface. Dashed rules
              read as thresholds, and these are just a grid. */}
          {scale.map((t) => (
            <g key={t}>
              <line
                x1={PAD.left}
                x2={PAD.left + plotW}
                y1={yAt(t)}
                y2={yAt(t)}
                stroke="var(--grid)"
                strokeWidth={1}
                shapeRendering="crispEdges"
              />
              <text
                x={PAD.left - 8}
                y={yAt(t)}
                textAnchor="end"
                dominantBaseline="middle"
                fill="var(--text-faint)"
                style={{ fontSize: 10.5, fontVariantNumeric: "tabular-nums" }}
              >
                {t}
              </text>
            </g>
          ))}

          {series.map((s) => {
            const pts: Pt[] = points.map((p, i) => [xAt(i), yAt(p.values[s.key] ?? 0)]);
            return (
              <g key={s.key}>
                {s.fill && <path d={areaPath(pts, PAD.top + plotH)} fill={s.color} opacity={0.1} />}
                <path
                  d={linePath(pts)}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </g>
            );
          })}

          {/* x-axis labels, thinned so they cannot collide */}
          {labelledIndices(points.length, Math.max(2, Math.floor(plotW / 68))).map((i) => (
            <text
              key={points[i].id}
              x={xAt(i)}
              y={height - 8}
              textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"}
              fill="var(--text-faint)"
              style={{ fontSize: 10.5 }}
            >
              {points[i].label}
            </text>
          ))}

          {active !== null && activePoint && (
            <g>
              <line
                x1={xAt(active)}
                x2={xAt(active)}
                y1={PAD.top}
                y2={PAD.top + plotH}
                stroke="var(--border-strong)"
                strokeWidth={1}
                shapeRendering="crispEdges"
              />
              {series.map((s) => (
                <circle
                  key={s.key}
                  cx={xAt(active)}
                  cy={yAt(activePoint.values[s.key] ?? 0)}
                  r={4}
                  fill={s.color}
                  stroke="var(--surface)"
                  strokeWidth={2}
                />
              ))}
            </g>
          )}
        </svg>
      )}

      {activePoint && (
        <Tooltip
          x={xAt(active!)}
          width={width}
          date={activePoint.label}
          rows={series.map((s) => ({
            label: s.label,
            color: s.color,
            value: activePoint.values[s.key] ?? 0,
          }))}
        />
      )}
    </div>
  );
}

function Tooltip({
  x,
  width,
  date,
  rows,
}: {
  x: number;
  width: number;
  date: string;
  rows: { label: string; color: string; value: number }[];
}) {
  const W = 150;
  // Clamped so the readout never hangs off the card and gets clipped by the
  // card's own overflow.
  const left = Math.min(Math.max(x - W / 2, 0), Math.max(0, width - W));

  return (
    <div
      className="pointer-events-none absolute top-1 rounded-md border border-border px-2.5 py-2 shadow-sm"
      style={{ left, width: W, background: "var(--surface)" }}
      role="status"
    >
      <p className="mb-1.5 text-[11px] text-faint">{date}</p>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2 py-0.5">
          {/* A line key, not a filled box: at this density a swatch is
              data-weight ink doing a label's job. */}
          <span className="h-0.5 w-3 shrink-0 rounded-full" style={{ background: r.color }} />
          {/* The value leads and the series name follows — the reader already
              knows which series they are on and wants the number. */}
          <span className="text-[13px] font-semibold tabular-nums">{r.value}</span>
          <span className="truncate text-[11.5px] text-muted">{r.label}</span>
        </div>
      ))}
    </div>
  );
}

/** The chart's values as a table.
 *
 *  Not a fallback — the equivalent. A value that can only be reached by
 *  hovering is unreachable on a touchscreen and to a screen reader, so the
 *  dashboard offers this beside every plot rather than behind one. */
export function SeriesTable({ points, series }: { points: AreaPoint[]; series: AreaSeries[] }) {
  return (
    <div className="max-h-[240px] overflow-y-auto">
      <table className="w-full text-[12.5px]">
        <thead className="sticky top-0" style={{ background: "var(--surface)" }}>
          <tr className="border-b border-border text-left">
            <th className="py-1.5 pr-3 font-medium text-muted">Date</th>
            {series.map((s) => (
              <th key={s.key} className="py-1.5 pl-3 text-right font-medium text-muted">
                {s.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.id} className="border-b border-border last:border-b-0">
              <td className="py-1.5 pr-3 text-muted">{p.label}</td>
              {series.map((s) => (
                <td key={s.key} className="py-1.5 pl-3 text-right tabular-nums">
                  {p.values[s.key] ?? 0}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
