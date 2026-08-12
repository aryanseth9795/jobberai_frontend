"use client";

import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";

import { delta as computeDelta } from "@/lib/format";
import { Sparkline } from "./Sparkline";

/**
 * A number that is its own chart.
 *
 * A single current value does not need a plot — a one-bar bar chart says
 * nothing the number does not. What it can use is context: which way it is
 * going, and against what.
 */
export function StatTile({
  label,
  value,
  previous,
  current,
  periodLabel,
  trend,
  upIsGood = true,
  accent = false,
}: {
  label: string;
  /** Already formatted — the tile does not guess at units. */
  value: string;
  /** The two raw numbers behind the delta. Both required for one to show. */
  current?: number;
  previous?: number;
  /** What the delta is measured against: "vs previous 30 days". */
  periodLabel?: string;
  trend?: number[];
  /** Whether a rise is good news. Applications sent going up is not obviously
   *  either, so those tiles pass `upIsGood` and get a neutral delta. */
  upIsGood?: boolean;
  /** Reserve for the one tile that means a human replied. */
  accent?: boolean;
}) {
  const change =
    current !== undefined && previous !== undefined ? computeDelta(current, previous) : null;

  // Colour states direction only where direction has a meaning. It is also
  // never the only cue — the arrow and the signed number say the same thing,
  // which is the rule for anything wearing a status colour.
  const deltaColour =
    !change || change.direction === 0
      ? "var(--text-faint)"
      : change.direction === 1
        ? upIsGood
          ? "var(--success)"
          : "var(--text-muted)"
        : upIsGood
          ? "var(--closed)"
          : "var(--text-muted)";

  const Arrow = !change || change.direction === 0 ? ArrowRight : change.direction === 1 ? ArrowUpRight : ArrowDownRight;

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="label mb-2">{label}</p>

      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          {/* Proportional figures, not tabular: at this size equal-width digits
              make a number like 121 look loose. */}
          <p
            className="font-display text-[26px] font-semibold leading-none"
            style={accent ? { color: "var(--signal)" } : undefined}
          >
            {value}
          </p>

          {change && (
            <p className="mt-2 flex items-center gap-1 text-[11.5px]" style={{ color: deltaColour }}>
              <Arrow size={12} aria-hidden="true" />
              <span className="tabular-nums font-medium">{change.text}</span>
              {periodLabel && <span className="text-faint">{periodLabel}</span>}
            </p>
          )}
        </div>

        {trend && trend.length > 1 && (
          <Sparkline
            values={trend}
            color={accent ? "var(--signal)" : "var(--chart-1)"}
            label={`${label} trend`}
          />
        )}
      </div>
    </div>
  );
}
