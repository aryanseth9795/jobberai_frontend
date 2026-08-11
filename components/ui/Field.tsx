"use client";

import { forwardRef, useId } from "react";

import { cn } from "@/lib/cn";

// ── The controls ──
//
// One shared shell so an input, a select and a textarea line up when they sit
// next to each other in a form. Before this, every page styled its own.

const CONTROL = cn(
  "w-full rounded-md border border-border bg-surface px-3 text-[13px] text-text",
  "placeholder:text-faint",
  "transition-colors duration-150",
  "hover:border-[var(--border-strong)]",
  "focus:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:ring-offset-0",
  "disabled:opacity-50 disabled:cursor-not-allowed",
  // `aria-invalid` rather than a prop, so the red border and the thing screen
  // readers announce can never disagree.
  "aria-[invalid=true]:border-[var(--danger-line)]"
);

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return <input ref={ref} className={cn(CONTROL, "h-9", className)} {...rest} />;
  }
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, rows = 4, ...rest }, ref) {
  return <textarea ref={ref} rows={rows} className={cn(CONTROL, "py-2 resize-y", className)} {...rest} />;
});

export const Select = forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, children, ...rest }, ref) {
  return (
    <select ref={ref} className={cn(CONTROL, "h-9 cursor-pointer pr-8", className)} {...rest}>
      {children}
    </select>
  );
});

// ── The wrapper ──

export interface FieldProps {
  label: string;
  /** Renders the asterisk *and* sets `required` on the control, so the visual
   *  mark and the browser's own validation cannot disagree. */
  required?: boolean;
  /** Static guidance. Always visible — a hint that only appears on focus is a
   *  hint nobody reads before they start typing. */
  hint?: string;
  /** A validation failure. Replaces the hint while present: showing both makes
   *  the user hunt for which line is the actionable one. */
  error?: string;
  /** Right-aligned on the label row, for a character counter or a status
   *  badge next to the field it describes. */
  aside?: React.ReactNode;
  children: (props: {
    id: string;
    required?: boolean;
    "aria-invalid"?: boolean;
    "aria-describedby"?: string;
  }) => React.ReactNode;
}

/**
 * Label, control, and exactly one line of supporting text underneath.
 *
 * Takes a render prop rather than wrapping `<input>` directly so the same
 * layout serves inputs, selects, textareas, file drop zones and radio groups.
 * The ids it generates are what tie the label and the hint to the control for
 * assistive tech — the caller cannot forget to wire them up because it never
 * sees them.
 */
export function Field({ label, required, hint, error, aside, children }: FieldProps) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className="mb-4">
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="label">
          {label}
          {required && <span style={{ color: "var(--danger)" }} aria-hidden="true"> *</span>}
        </label>
        {aside}
      </div>

      {children({
        id,
        required,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": describedBy,
      })}

      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-[12px]" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-[12px] text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
