"use client";

import { AlertCircle, Check, Loader2 } from "lucide-react";

import { cn } from "@/lib/cn";

/**
 * Where the form-filling run has got to.
 *
 * Unlike a progress animation on a timer, every stage here is a status the
 * backend actually reported, so the stepper cannot claim progress that has
 * not happened.
 */
const STEPS = [
  { id: "extracting", label: "Reading the form" },
  { id: "generating", label: "Writing answers" },
  { id: "preview", label: "Waiting for you" },
  { id: "filled_awaiting_review", label: "Filled" },
];

export default function FormStatus({ status, error }: { status: string; error?: string }) {
  const failed = status === "error";
  const done = status === "filled_awaiting_review";
  const currentIndex = failed ? -1 : STEPS.findIndex((s) => s.id === status);

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          {failed ? (
            <AlertCircle size={16} style={{ color: "var(--danger)" }} />
          ) : done ? (
            <Check size={16} style={{ color: "var(--success)" }} />
          ) : (
            <Loader2 size={16} className="animate-[spin_0.7s_linear_infinite] text-muted" />
          )}
          <div>
            <p className="text-[13px] font-medium">
              {failed ? "That didn't work" : done ? "Form filled" : "Working on it"}
            </p>
            <p className="text-[12px] text-muted">
              {error ||
                (status === "preview"
                  ? "Check the answers below before anything is submitted."
                  : "This takes a few seconds.")}
            </p>
          </div>
        </div>

        <ol className="hidden items-center gap-1.5 sm:flex">
          {STEPS.map((step, index) => {
            const complete = done || index < currentIndex;
            const active = index === currentIndex;
            return (
              <li
                key={step.id}
                className={cn(
                  "rounded-sm border px-2 py-1 text-[11px] font-medium whitespace-nowrap",
                  !complete && !active && "opacity-55"
                )}
                style={{
                  background: complete
                    ? "var(--success-soft)"
                    : active
                      ? "var(--accent-soft)"
                      : "var(--surface-2)",
                  borderColor: complete
                    ? "var(--success-line)"
                    : active
                      ? "var(--accent-line)"
                      : "var(--border)",
                  color: complete
                    ? "var(--success)"
                    : active
                      ? "var(--accent)"
                      : "var(--text-muted)",
                }}
              >
                {step.label}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
