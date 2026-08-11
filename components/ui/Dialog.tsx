"use client";

import { useCallback, useEffect, useRef } from "react";
import { X } from "lucide-react";

import { cn } from "@/lib/cn";
import { Button } from "./Button";

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Buttons for the footer. Omit for a purely informational dialog — it still
   *  closes on Escape, the backdrop, and the header's ✕. */
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  children?: React.ReactNode;
}

const SIZES = { sm: "max-w-md", md: "max-w-2xl", lg: "max-w-4xl" } as const;

/**
 * Modal dialog.
 *
 * Replaces the two hand-rolled modals that were copied between the dashboard's
 * application and form views, and the browser `confirm()` the delete button
 * used — which cannot be styled, cannot say what is about to be deleted, and
 * blocks the whole tab while it waits.
 *
 * Three things it does that the copies did not: it restores focus to whatever
 * was focused before it opened, it traps Tab inside itself while open, and it
 * stops the page underneath from scrolling.
 */
export function Dialog({ open, onClose, title, description, footer, size = "md", children }: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusTo = useRef<HTMLElement | null>(null);

  const focusables = useCallback(() => {
    if (!panelRef.current) return [] as HTMLElement[];
    return Array.from(
      panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
      )
    );
  }, []);

  useEffect(() => {
    if (!open) return;

    restoreFocusTo.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Focus the panel itself rather than its first control: opening a dialog
    // with the cursor already in a text field means a stray keystroke edits
    // something the user has not read yet.
    panelRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      // Without this, Tab walks out of the dialog and into the page behind it,
      // which is still there and still interactive as far as the browser is
      // concerned — the backdrop only hides it visually.
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || active === panelRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = previousOverflow;
      restoreFocusTo.current?.focus?.();
    };
  }, [open, onClose, focusables]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade"
      style={{ background: "var(--overlay)" }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
        tabIndex={-1}
        className={cn(
          "flex max-h-[88vh] w-full flex-col overflow-hidden rounded-lg border border-border bg-surface animate-slide",
          SIZES[size]
        )}
        style={{ boxShadow: "var(--shadow-md)" }}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-3.5">
          <div className="min-w-0">
            <h2 className="font-display text-[15px] font-semibold">{title}</h2>
            {description && <p className="mt-0.5 text-[12.5px] text-muted">{description}</p>}
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close" className="-mr-1.5 shrink-0">
            <X size={15} />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">{footer}</div>
        )}
      </div>
    </div>
  );
}

/**
 * The "are you sure" case, which is almost every use of a dialog in this app.
 *
 * Takes the item's name so the question can be specific: "Delete the Acme
 * application?" is answerable at a glance in a way that "Are you sure?" is not.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  body,
  confirmLabel = "Delete",
  loading = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  body: React.ReactNode;
  confirmLabel?: string;
  loading?: boolean;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-[13px] text-muted">{body}</p>
    </Dialog>
  );
}
