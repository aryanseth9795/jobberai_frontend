import { Loader2 } from "lucide-react";

import { cn } from "@/lib/cn";

// ── Skeleton ──

/**
 * A placeholder the shape of the thing that is loading.
 *
 * Preferred over a centred spinner for anything with known structure: the
 * layout does not jump when the data lands, and the user can start reading the
 * page's shape while they wait.
 */
export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={cn("skeleton", className)} style={style} aria-hidden="true" />;
}

/** Rows of skeleton cells sized like the table they stand in for. */
export function SkeletonTable({ rows = 6, columns }: { rows?: number; columns: string }) {
  return (
    <div aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, row) => (
        <div
          key={row}
          className="grid items-center gap-4 border-b border-border px-4 py-3 last:border-b-0"
          style={{ gridTemplateColumns: columns }}
        >
          {columns.split(" ").map((_, cell) => (
            <Skeleton key={cell} className="h-3.5" style={{ width: `${55 + ((row * 7 + cell * 13) % 35)}%` }} />
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Spinner ──

export function Spinner({ size = 16, label }: { size?: number; label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-muted" role="status">
      <Loader2 size={size} className="animate-[spin_0.7s_linear_infinite]" />
      {label && <span className="text-[13px]">{label}</span>}
      {!label && <span className="sr-only">Loading</span>}
    </span>
  );
}

// ── Empty state ──

/**
 * What the user sees before there is anything to see.
 *
 * `action` is not optional in spirit: an empty screen is an invitation to do
 * the thing that fills it, and one without a way forward is a dead end. The
 * `title` says what is not here; the `body` says how to change that.
 */
export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  body?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {icon && (
        <div
          className="mb-3.5 flex h-10 w-10 items-center justify-center rounded-lg border border-border"
          style={{ background: "var(--surface-2)", color: "var(--text-faint)" }}
        >
          {icon}
        </div>
      )}
      <p className="font-display text-[14px] font-semibold">{title}</p>
      {body && <p className="mt-1 max-w-sm text-[12.5px] text-muted">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ── Inline error ──

/** A failure attached to the thing that failed, for cases a toast would lose —
 *  a form that cannot submit, a panel whose data never arrived. */
export function ErrorNote({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div
      role="alert"
      className="flex items-start justify-between gap-3 rounded-md border px-3 py-2.5 text-[12.5px]"
      style={{ background: "var(--danger-soft)", borderColor: "var(--danger-line)", color: "var(--danger)" }}
    >
      <span className="min-w-0">{children}</span>
      {action}
    </div>
  );
}
