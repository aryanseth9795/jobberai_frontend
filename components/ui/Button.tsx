"use client";

import { forwardRef } from "react";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Shows a spinner and disables the button. Keep the label unchanged while
   *  loading — a button that renames itself mid-action makes the user wonder
   *  whether they pressed the thing they meant to. */
  loading?: boolean;
  icon?: React.ReactNode;
}

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-accent text-[var(--text-on-accent)] border border-transparent hover:bg-[var(--accent-hover)]",
  secondary:
    "bg-surface text-text border border-border hover:bg-surface-2 hover:border-[var(--border-strong)]",
  ghost:
    "bg-transparent text-muted border border-transparent hover:bg-surface-2 hover:text-text",
  // Outlined rather than filled. A destructive action should be reachable but
  // never the loudest thing on screen — a solid red button next to a quiet
  // secondary reads as the recommended choice, which it is not.
  danger:
    "bg-transparent text-danger border border-[var(--danger-line)] hover:bg-[var(--danger-soft)]",
};

const SIZES: Record<Size, string> = {
  sm: "h-7 px-2.5 text-[12px] gap-1.5",
  md: "h-9 px-3.5 text-[13px] gap-2",
  lg: "h-11 px-5 text-[14px] gap-2",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", loading = false, icon, className, children, disabled, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      // Announced rather than only shown: a spinner is invisible to a screen
      // reader, and "the button went quiet" is not useful feedback.
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-md font-medium",
        "transition-colors duration-150",
        "disabled:opacity-45 disabled:pointer-events-none",
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      {...rest}
    >
      {loading ? <Loader2 size={14} className="animate-[spin_0.7s_linear_infinite]" /> : icon}
      {children}
    </button>
  );
});
