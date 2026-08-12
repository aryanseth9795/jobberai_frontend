"use client";

import type { DuplicateDetails } from "@/lib/api";
import { longDate } from "@/lib/format";
import { Badge, Button, Dialog } from "@/components/ui";

/**
 * How alike the two applications are.
 *
 * The number is always shown as text alongside the wording, because the
 * decision it feeds — send anyway, or skip — is the user's, and a colour
 * alone does not tell them how close the call is.
 */
function verdict(score: number): { tone: "danger" | "warning" | "success"; text: string } {
  if (score >= 0.97) return { tone: "danger", text: "Almost certainly the same job" };
  if (score >= 0.93) return { tone: "warning", text: "Very likely the same job" };
  return { tone: "success", text: "Similar, but probably a different role" };
}

export default function DuplicateAlertModal({
  isOpen,
  onClose,
  duplicateDetails,
  jobTitle,
  previousApp,
}: {
  isOpen: boolean;
  onClose: () => void;
  duplicateDetails: DuplicateDetails;
  jobTitle: string;
  previousApp?: {
    company_name?: string;
    role?: string;
    hr_email?: string;
    applied_at?: string;
    cover_email_subject?: string;
    cover_email_body?: string;
  };
}) {
  if (!isOpen) return null;

  const score = duplicateDetails.similarity_score;
  const { tone, text } = verdict(score);

  return (
    <Dialog
      open
      onClose={onClose}
      title="You may have applied to this already"
      description={jobTitle}
      footer={<Button onClick={onClose}>Close</Button>}
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge tone={tone}>{Math.round(score * 100)}% match</Badge>
        <span className="text-[12.5px] text-muted">{text}</span>
      </div>

      <dl className="mb-4 grid gap-2 sm:grid-cols-2">
        <div className="rounded-md border border-border px-3 py-2" style={{ background: "var(--surface-2)" }}>
          <dt className="label mb-1">Matched against</dt>
          <dd className="text-[12.5px]">{duplicateDetails.matched_job || "—"}</dd>
        </div>
        <div className="rounded-md border border-border px-3 py-2" style={{ background: "var(--surface-2)" }}>
          <dt className="label mb-1">You applied</dt>
          <dd className="text-[12.5px]">
            {duplicateDetails.applied_on
              ? longDate(duplicateDetails.applied_on.slice(0, 10))
              : "Date not recorded"}
          </dd>
        </div>
      </dl>

      {duplicateDetails.reason && (
        <div className="mb-4 rounded-md border border-border px-3 py-2.5">
          <p className="label mb-1">Why it was flagged</p>
          <p className="text-[12.5px] text-muted">{duplicateDetails.reason}</p>
        </div>
      )}

      {previousApp?.cover_email_body && (
        <div className="rounded-md border border-border">
          <div className="border-b border-border px-3 py-2" style={{ background: "var(--surface-2)" }}>
            <p className="label mb-0.5">What you sent last time</p>
            <p className="text-[12.5px] font-medium">{previousApp.cover_email_subject}</p>
          </div>
          <div className="max-h-52 overflow-y-auto px-3 py-2.5">
            <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-muted">
              {previousApp.cover_email_body}
            </p>
          </div>
        </div>
      )}

      <p className="mt-4 text-[12px] text-muted">
        This is a warning, not a block — the draft is still yours to approve or skip.
      </p>
    </Dialog>
  );
}
