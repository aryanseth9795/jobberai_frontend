"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, MapPin, Paperclip, Pencil, TriangleAlert, Wallet } from "lucide-react";

import type { DraftResponse } from "@/lib/api";
import { cn } from "@/lib/cn";
import { Badge, Button } from "@/components/ui";
import DuplicateAlertModal from "./DuplicateAlertModal";
import EmailEditor from "./EmailEditor";

export interface DraftCardProps {
  draft: DraftResponse;
  index: number;
  approved: boolean;
  onToggleApprove: (draftId: string, approved: boolean) => void;
  onUpdateEmail: (draftId: string, hrEmail: string, subject: string, body: string) => void;
  /** What will actually be attached when this batch is sent. Passed in rather
   *  than assumed: the card used to render "Resume.pdf" and "Cover Letter.pdf"
   *  unconditionally, so it listed attachments the user had switched off and
   *  files they had never uploaded. */
  attachments: string[];
  /** The address the email is sent from, for the preview header. Previously
   *  hard-coded to a placeholder gmail address that was not the user's. */
  senderEmail?: string | null;
}

export default function DraftCard({
  draft,
  index,
  approved,
  onToggleApprove,
  onUpdateEmail,
  attachments,
  senderEmail,
}: DraftCardProps) {
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showDuplicate, setShowDuplicate] = useState(false);

  const { job_info, cover_email, draft_status, duplicate_details, error } = draft;

  const actionable = draft_status === "drafted";
  const flaggedDuplicate = actionable && Boolean(duplicate_details);
  const failed = draft_status === "error";
  const missingRecipient = actionable && !job_info.hr_email;

  const lines = cover_email?.body?.split("\n") ?? [];
  const clipped = lines.length > 5;

  return (
    <>
      <article
        className={cn(
          "overflow-hidden rounded-lg border bg-surface transition-colors",
          approved ? "border-[var(--accent)]" : "border-border"
        )}
      >
        <header className="border-b border-border px-4 py-3" style={{ background: "var(--surface-2)" }}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-medium tabular-nums text-faint">#{index}</span>
                {failed && <Badge tone="danger">Couldn&apos;t draft</Badge>}
                {flaggedDuplicate && <Badge tone="warning">Possible duplicate</Badge>}
                {actionable && (approved ? <Badge tone="accent">Will send</Badge> : <Badge>Skipped</Badge>)}
              </div>

              <h3 className="text-[14px] font-semibold">
                {job_info.role || "Untitled role"}
                <span className="font-normal text-muted"> · {job_info.company_name || "Unknown company"}</span>
              </h3>

              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-muted">
                {job_info.location && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin size={11} /> {job_info.location}
                  </span>
                )}
                {job_info.salary_range && (
                  <span className="inline-flex items-center gap-1">
                    <Wallet size={11} /> {job_info.salary_range}
                  </span>
                )}
                {job_info.hr_email ? (
                  <span className="font-mono text-[11px]">{job_info.hr_email}</span>
                ) : (
                  <span className="inline-flex items-center gap-1" style={{ color: "var(--warning)" }}>
                    <TriangleAlert size={11} /> No recipient found — add one before sending
                  </span>
                )}
              </div>
            </div>

            {actionable && (
              <div className="flex shrink-0 items-center gap-1.5">
                <Button size="sm" variant="ghost" icon={<Pencil size={12} />} onClick={() => setEditing(true)}>
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant={approved ? "secondary" : "primary"}
                  // A draft with nowhere to send it cannot be approved — the
                  // send would fail server-side with a less clear message.
                  disabled={!approved && missingRecipient}
                  onClick={() => onToggleApprove(draft.draft_id, !approved)}
                >
                  {approved ? "Skip" : "Approve"}
                </Button>
              </div>
            )}
          </div>
        </header>

        {flaggedDuplicate && duplicate_details && (
          <div
            className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5"
            style={{ background: "var(--warning-soft)", borderColor: "var(--warning-line)" }}
          >
            <p className="text-[12px]" style={{ color: "var(--warning)" }}>
              {Math.round(duplicate_details.similarity_score * 100)}% match with something you already
              sent. You still decide whether this goes out.
            </p>
            <Button size="sm" variant="ghost" onClick={() => setShowDuplicate(true)}>
              Compare
            </Button>
          </div>
        )}

        {failed && error && (
          <div
            className="border-b px-4 py-2.5"
            style={{ background: "var(--danger-soft)", borderColor: "var(--danger-line)" }}
          >
            <p className="text-[12px]" style={{ color: "var(--danger)" }}>
              {error}
            </p>
          </div>
        )}

        {cover_email && (
          <div>
            <div className="border-b border-border px-4 py-3">
              <p className="text-[13px] font-semibold">{cover_email.subject}</p>
              <p className="mt-0.5 text-[11.5px] text-muted">
                {senderEmail ? `From ${senderEmail}` : "From your configured sender address"}
                {job_info.hr_email ? ` · to ${job_info.hr_email}` : ""}
              </p>
            </div>

            <div className="relative px-4 py-3">
              <p
                className={cn(
                  "whitespace-pre-wrap text-[12.5px] leading-relaxed text-muted",
                  !expanded && clipped && "max-h-32 overflow-hidden"
                )}
              >
                {cover_email.body}
              </p>
              {!expanded && clipped && (
                <div
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-12"
                  style={{ background: "linear-gradient(transparent, var(--surface))" }}
                />
              )}
            </div>

            {clipped && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="flex w-full items-center justify-center gap-1 border-t border-border py-2 text-[12px] text-muted hover:text-text"
              >
                {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                {expanded ? "Show less" : "Show the whole email"}
              </button>
            )}

            <div
              className="flex flex-wrap items-center gap-1.5 border-t border-border px-4 py-2.5"
              style={{ background: "var(--surface-2)" }}
            >
              <Paperclip size={12} className="text-faint" />
              {attachments.length === 0 ? (
                <span className="text-[11.5px] text-muted">No attachments</span>
              ) : (
                attachments.map((name) => (
                  <Badge key={name}>{name}</Badge>
                ))
              )}
            </div>
          </div>
        )}
      </article>

      {editing && cover_email && (
        <EmailEditor
          hrEmail={job_info.hr_email || ""}
          subject={cover_email.subject}
          body={cover_email.body}
          jobTitle={`${job_info.role || "Untitled role"} · ${job_info.company_name || "Unknown company"}`}
          onSave={(hrEmail, subject, body) => {
            onUpdateEmail(draft.draft_id, hrEmail, subject, body);
            setEditing(false);
          }}
          onClose={() => setEditing(false)}
        />
      )}

      {showDuplicate && duplicate_details && (
        <DuplicateAlertModal
          isOpen={showDuplicate}
          onClose={() => setShowDuplicate(false)}
          duplicateDetails={duplicate_details}
          jobTitle={`${job_info.role || "Untitled role"} · ${job_info.company_name || "Unknown company"}`}
        />
      )}
    </>
  );
}
