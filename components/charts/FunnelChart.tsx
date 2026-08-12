"use client";

import { percent } from "@/lib/format";
import { statusMeta } from "@/lib/status";

export interface FunnelDatum {
  /** An application status — `applied`, `interview`, `offer`. Its register
   *  decides the colour, so the funnel cannot disagree with the badge on the
   *  same row of the table below it. */
  stage: string;
  count: number;
}

/**
 * Applied → interview → offer.
 *
 * The stages are ordinal, but they are not coloured with an ordinal ramp. Two
 * of the three mean *a human replied*, and in this product that is a status,
 * not a position in a sequence — so the waiting stage stays grey and the two
 * live stages take the signal colour they wear everywhere else. The reader
 * sees the shape of the thing immediately: one long grey bar, two short warm
 * ones.
 *
 * Every value is direct-labelled, so nothing here is gated behind a hover.
 */
export function FunnelChart({ data }: { data: FunnelDatum[] }) {
  if (data.length === 0 || data[0].count === 0) {
    return (
      <p className="py-6 text-center text-[12.5px] text-muted">
        No applications in this range yet.
      </p>
    );
  }

  const entry = data[0].count;

  return (
    <ol className="flex flex-col gap-3">
      {data.map((d, i) => {
        const meta = statusMeta(d.stage);
        const colour = meta.register === "live" ? "var(--signal)" : "var(--chart-1)";
        const previous = i === 0 ? null : data[i - 1].count;

        return (
          <li key={d.stage}>
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <span className="text-[12.5px] font-medium">{meta.label}</span>
              <span className="flex items-baseline gap-2">
                <span className="text-[13px] font-semibold tabular-nums">{d.count}</span>
                {/* Conversion from the step before, which is the number the
                    reader is actually after — the drop, not the total. */}
                {previous !== null && (
                  <span className="text-[11px] tabular-nums text-faint">
                    {previous > 0 ? `${percent(d.count / previous, 0)} of previous` : "—"}
                  </span>
                )}
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-sm" style={{ background: "var(--surface-2)" }}>
              <div
                className="h-full transition-[width] duration-300 motion-reduce:transition-none"
                style={{
                  width: `${Math.max(d.count > 0 ? 2 : 0, (d.count / entry) * 100)}%`,
                  background: colour,
                  borderRadius: "0 4px 4px 0",
                }}
              />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
