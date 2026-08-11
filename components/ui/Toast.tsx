"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, Info, X } from "lucide-react";

type ToastKind = "success" | "error" | "info";

interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  /** One optional retry/undo. More than one turns a notification into a
   *  decision, and a notification that times out is the wrong place for one. */
  action?: { label: string; onClick: () => void };
}

interface ToastApi {
  success: (message: string) => void;
  /** Errors do not auto-dismiss. Something went wrong and the user has not
   *  necessarily been looking at the screen; a message that removes itself
   *  after four seconds means they find out by noticing the work did not
   *  happen. */
  error: (message: string, action?: Toast["action"]) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const AUTO_DISMISS_MS = 4200;

const STYLES: Record<ToastKind, { icon: React.ReactNode; color: string; bg: string; border: string }> = {
  success: { icon: <Check size={14} />, color: "var(--success)", bg: "var(--success-soft)", border: "var(--success-line)" },
  error:   { icon: <AlertTriangle size={14} />, color: "var(--danger)", bg: "var(--danger-soft)", border: "var(--danger-line)" },
  info:    { icon: <Info size={14} />, color: "var(--accent)", bg: "var(--accent-soft)", border: "var(--accent-line)" },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((kind: ToastKind, message: string, action?: Toast["action"]) => {
    const id = nextId.current++;
    setToasts((current) => [...current, { id, kind, message, action }]);
    if (kind !== "error") {
      setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    }
  }, [dismiss]);

  const api = useMemo<ToastApi>(
    () => ({
      success: (message) => push("success", message),
      error: (message, action) => push("error", message, action),
      info: (message) => push("info", message),
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* `polite` rather than `assertive`: these report what just happened, and
          interrupting whatever a screen-reader user is reading mid-sentence to
          say "Saved." is worse than telling them a moment later. */}
      <div
        aria-live="polite"
        aria-relevant="additions"
        className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2"
      >
        {toasts.map((toast) => (
          <ToastRow key={toast.id} toast={toast} onDismiss={() => dismiss(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastRow({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const style = STYLES[toast.kind];
  return (
    <div
      className="pointer-events-auto flex items-start gap-2.5 rounded-md border px-3 py-2.5 animate-slide"
      style={{ background: style.bg, borderColor: style.border, boxShadow: "var(--shadow-md)" }}
    >
      <span style={{ color: style.color }} className="mt-0.5 shrink-0">
        {style.icon}
      </span>
      <p className="min-w-0 flex-1 text-[12.5px] leading-snug" style={{ color: "var(--text)" }}>
        {toast.message}
      </p>
      {toast.action && (
        <button
          type="button"
          onClick={() => {
            toast.action?.onClick();
            onDismiss();
          }}
          className="shrink-0 text-[12px] font-medium underline underline-offset-2"
          style={{ color: style.color }}
        >
          {toast.action.label}
        </button>
      )}
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="shrink-0 opacity-50 transition-opacity hover:opacity-100"
        style={{ color: "var(--text)" }}
      >
        <X size={13} />
      </button>
    </div>
  );
}

/**
 * Report the outcome of something the user did.
 *
 * Throws when used outside the provider rather than returning a no-op API:
 * a silently swallowed error toast is exactly the failure this replaced —
 * pages used to `catch {}` a failed delete and leave the row on screen as if
 * it had worked.
 */
export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error("useToast must be used inside <ToastProvider>");
  return api;
}

/** Optional variant for components that may render outside the provider (an
 *  error boundary, a page rendered in a test without the shell). */
export function useOptionalToast(): ToastApi | null {
  return useContext(ToastContext);
}

/** Escape hatch for module-level code with no React context — see lib/api.ts,
 *  which reports a lost session from inside a plain async function. */
export function useToastBridge(register: (api: ToastApi) => void) {
  const api = useToast();
  useEffect(() => register(api), [api, register]);
}
