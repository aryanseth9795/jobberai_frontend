import { cn } from "@/lib/cn";
import { statusMeta, statusStyle } from "@/lib/status";

type Tone = "neutral" | "accent" | "signal" | "success" | "warning" | "danger";

const TONES: Record<Tone, React.CSSProperties> = {
  neutral: { background: "var(--surface-2)", color: "var(--text-muted)", borderColor: "var(--border)" },
  accent:  { background: "var(--accent-soft)", color: "var(--accent)", borderColor: "var(--accent-line)" },
  signal:  { background: "var(--signal-soft)", color: "var(--signal)", borderColor: "var(--signal-line)" },
  success: { background: "var(--success-soft)", color: "var(--success)", borderColor: "var(--success-line)" },
  warning: { background: "var(--warning-soft)", color: "var(--warning)", borderColor: "var(--warning-line)" },
  danger:  { background: "var(--danger-soft)", color: "var(--danger)", borderColor: "var(--danger-line)" },
};

const BASE =
  "inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[11px] font-medium leading-none whitespace-nowrap";

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span className={cn(BASE, className)} style={TONES[tone]}>
      {children}
    </span>
  );
}

/**
 * An application's status, coloured by what it means rather than by a lookup
 * table kept next to the table that renders it. See lib/status.ts — the rule
 * is that saturation means a human came back to you, and it has to hold
 * everywhere at once or it stops being readable at a glance.
 */
export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span className={cn(BASE, className)} style={statusStyle(status)}>
      {statusMeta(status).label}
    </span>
  );
}
