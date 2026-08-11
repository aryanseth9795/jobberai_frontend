"use client";

import { cn } from "@/lib/cn";

export interface TabItem<T extends string> {
  id: T;
  label: string;
  /** A row count, shown after the label. Rendered muted so a tab with 300
   *  items does not read as more important than one with 3. */
  count?: number;
  icon?: React.ReactNode;
}

/**
 * Underlined tabs.
 *
 * Underline rather than filled pills: these switch which rows a table shows,
 * which is navigation, and a filled control reads as a button that does
 * something. The distinction matters on the dashboard, where real buttons sit
 * on the same row.
 */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  className,
}: {
  items: TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  className?: string;
}) {
  return (
    <div role="tablist" className={cn("flex items-center gap-1 border-b border-border", className)}>
      {items.map((item) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.id)}
            className={cn(
              "-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-[13px] font-medium transition-colors",
              active
                ? "border-accent text-text"
                : "border-transparent text-muted hover:border-[var(--border-strong)] hover:text-text"
            )}
          >
            {item.icon}
            {item.label}
            {item.count !== undefined && (
              <span className="tabular text-[11px] text-faint">{item.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/**
 * A row of mutually exclusive choices where the choice is a *filter*, not a
 * destination — the dashboard's 7/30/90-day range picker. Segmented rather
 * than underlined precisely because it is not navigation.
 */
export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex items-center gap-0.5 rounded-md border border-border p-0.5"
      style={{ background: "var(--surface-2)" }}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-sm px-2.5 py-1 text-[12px] font-medium transition-colors",
              active ? "text-text" : "text-muted hover:text-text"
            )}
            style={active ? { background: "var(--surface)", boxShadow: "var(--shadow-sm)" } : undefined}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
