"use client";

import { useState } from "react";
import { DraftResponse } from "@/lib/api";
import EmailEditor from "./EmailEditor";

interface Props {
  draft: DraftResponse;
  approved: boolean;
  onToggleApprove: (draftId: string, approved: boolean) => void;
  onUpdateEmail: (draftId: string, hrEmail: string, subject: string, body: string) => void;
}

export default function DraftCard({ draft, approved, onToggleApprove, onUpdateEmail }: Props) {
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const { job_info, cover_email, draft_status, duplicate_details, error } = draft;
  const isActionable = draft_status === "drafted";

  const statusConfig = {
    drafted: { label: "Drafted", cls: "badge-drafted", icon: "✨" },
    duplicate: { label: "Duplicate", cls: "badge-duplicate", icon: "⚠️" },
    error: { label: "Error", cls: "badge-error", icon: "✕" },
  };
  const sc = statusConfig[draft_status] || statusConfig.drafted;

  return (
    <>
      <div
        className="glass-card p-5 flex flex-col gap-4 fade-in"
        style={{
          borderColor: approved ? "rgba(16,185,129,0.3)" : undefined,
          background: approved ? "rgba(16,185,129,0.04)" : undefined,
        }}
      >
        {/* Header row */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`badge ${sc.cls}`}>{sc.icon} {sc.label}</span>
              {approved && <span className="badge badge-approved">✓ Approved</span>}
              {!approved && isActionable && <span className="badge badge-rejected">✕ Rejected</span>}
            </div>
            <h3 className="font-bold text-lg mt-2 truncate" style={{ color: "var(--text-primary)" }}>
              {job_info.role || "Unknown Role"}{" "}
              <span style={{ color: "var(--text-secondary)", fontWeight: 400 }}>
                @ {job_info.company_name || "Unknown Company"}
              </span>
            </h3>
            <div className="flex items-center gap-4 mt-1 flex-wrap">
              {job_info.location && (
                <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                  📍 {job_info.location}
                </span>
              )}
              {job_info.salary_range && (
                <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                  💰 {job_info.salary_range}
                </span>
              )}
              {job_info.hr_email ? (
                <span className="text-sm" style={{ color: "var(--accent-light)" }}>
                  ✉ {job_info.hr_email}
                </span>
              ) : (
                <span className="text-sm" style={{ color: "var(--danger)" }}>
                  ⚠ No HR email found
                </span>
              )}
            </div>
          </div>

          {/* Action buttons */}
          {isActionable && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setEditing(true)}
                className="btn-ghost text-sm px-3 py-2"
                title="Edit email"
              >
                ✏️ Edit
              </button>
              <button
                onClick={() => onToggleApprove(draft.draft_id, !approved)}
                className={approved ? "btn-ghost text-sm px-3 py-2" : "btn-success text-sm px-3 py-2"}
                style={approved ? { borderColor: "rgba(239,68,68,0.4)", color: "#f87171" } : {}}
              >
                {approved ? "✕ Reject" : "✓ Approve"}
              </button>
            </div>
          )}
        </div>

        {/* Duplicate info */}
        {draft_status === "duplicate" && duplicate_details && (
          <div
            className="rounded-xl p-3 text-sm"
            style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}
          >
            <p style={{ color: "#fbbf24" }}>
              Already applied {duplicate_details.applied_on
                ? `on ${new Date(duplicate_details.applied_on).toLocaleDateString()}`
                : "recently"}{" "}
              (similarity: {Math.round(duplicate_details.similarity_score * 100)}%)
            </p>
          </div>
        )}

        {/* Error info */}
        {draft_status === "error" && error && (
          <div
            className="rounded-xl p-3 text-sm"
            style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}
          >
            <p style={{ color: "#f87171" }}>{error}</p>
          </div>
        )}

        {/* Email preview */}
        {cover_email && (
          <div
            className="rounded-xl p-4"
            style={{ background: "rgba(0,0,0,0.2)", border: "1px solid var(--border)" }}
          >
            <p className="text-xs font-semibold mb-1" style={{ color: "var(--text-muted)" }}>
              SUBJECT
            </p>
            <p className="text-sm font-medium mb-3" style={{ color: "var(--text-primary)" }}>
              {cover_email.subject}
            </p>
            <p className="text-xs font-semibold mb-1" style={{ color: "var(--text-muted)" }}>
              BODY
            </p>
            <p
              className="text-sm leading-relaxed"
              style={{
                color: "var(--text-secondary)",
                maxHeight: expanded ? "none" : "80px",
                overflow: "hidden",
              }}
            >
              {cover_email.body}
            </p>
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs mt-2 hover:underline"
              style={{ color: "var(--accent-light)" }}
            >
              {expanded ? "Show less" : "Show more ↓"}
            </button>
          </div>
        )}
      </div>

      {/* Email editor modal */}
      {editing && cover_email && (
        <EmailEditor
          hrEmail={job_info.hr_email || ""}
          subject={cover_email.subject}
          body={cover_email.body}
          jobTitle={`${job_info.role} @ ${job_info.company_name}`}
          onSave={(hrEmail: string, subject: string, body: string) => {
            onUpdateEmail(draft.draft_id, hrEmail, subject, body);
            setEditing(false);
          }}
          onClose={() => setEditing(false)}
        />
      )}
    </>
  );
}
