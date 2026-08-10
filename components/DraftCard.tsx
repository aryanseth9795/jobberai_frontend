"use client";

import { useState } from "react";
import { DraftResponse } from "@/lib/api";
import EmailEditor from "./EmailEditor";
import DuplicateAlertModal from "./DuplicateAlertModal";

interface Props {
  draft: DraftResponse;
  approved: boolean;
  onToggleApprove: (draftId: string, approved: boolean) => void;
  onUpdateEmail: (draftId: string, hrEmail: string, subject: string, body: string) => void;
}

/** Returns initials for the avatar from the sender name / company */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Returns a deterministic color from a string for the avatar */
const AVATAR_COLORS = [
  "#1a73e8", "#34a853", "#fbbc04", "#ea4335",
  "#9334e6", "#00879f", "#e37400", "#1e8e3e",
];
function avatarColor(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

/** Format a date as Gmail does: "Mar 12, 2026" */
function formatDate(dateStr?: string): string {
  if (!dateStr) return new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function DraftCard({ draft, approved, onToggleApprove, onUpdateEmail }: Props) {
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showDupModal, setShowDupModal] = useState(false);

  const { job_info, cover_email, draft_status, duplicate_details, error } = draft;
  // A draft is "actionable" if it has a cover email (regardless of duplicate flag)
  const isActionable = draft_status === "drafted";
  // Duplicate warning: flagged but email still generated (non-blocking flow)
  const isDuplicateWarning = isActionable && !!duplicate_details;

  const statusConfig = {
    drafted:   { label: "Ready to send",  cls: "badge-drafted",   icon: "✉" },
    duplicate: { label: "Already applied", cls: "badge-duplicate", icon: "⊗" },
    error:     { label: "Error",           cls: "badge-error",     icon: "!" },
  };
  const sc = statusConfig[draft_status as keyof typeof statusConfig] || statusConfig.drafted;

  // Sender info — use company name as "From" to mimic the outgoing email
  const senderName = "You (via Job Agent)";
  const senderEmail = "your.email@gmail.com";
  const recipientEmail = job_info.hr_email || "hr@company.com";
  const companyName = job_info.company_name || "Company";
  const initials = getInitials(senderName);
  const avColor = avatarColor(senderName + companyName);

  // Truncated body for collapsed view
  const PREVIEW_LINES = 4;
  const bodyLines = cover_email?.body?.split("\n") ?? [];
  const collapsedBody = bodyLines.slice(0, PREVIEW_LINES).join("\n");
  const hasMore = bodyLines.length > PREVIEW_LINES;

  return (
    <>
      <div
        className="hud-card fade-in"
        style={{
          borderColor: isDuplicateWarning
            ? "#fbbc04"
            : approved
            ? "#34a853"
            : draft_status === "error" ? "#ea4335"
            : "#dadce0",
          borderWidth: approved || isDuplicateWarning ? "2px" : "1px",
          borderRadius: 8,
          overflow: "hidden",
        }}
      >
        {/* ── Card top bar: status + job + actions ── */}
        <div
          style={{
            padding: "14px 18px",
            borderBottom: "1px solid #f1f3f4",
            background: isDuplicateWarning
              ? "#fffbf0"
              : approved ? "#e6f4ea"
              : draft_status === "error" ? "#fce8e6"
              : "#fafafa",
          }}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              {/* Badges */}
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <span className={`badge ${sc.cls}`}>{sc.icon} {sc.label}</span>
                {isDuplicateWarning && (
                  <span className="badge badge-duplicate">⚠ Possible duplicate</span>
                )}
                {approved && <span className="badge badge-approved">✓ Approved</span>}
                {!approved && isActionable && <span className="badge badge-rejected">✕ Skipped</span>}
              </div>

              {/* Role + Company */}
              <h3 style={{ fontSize: 15, fontWeight: 600, color: "#202124", margin: 0 }}>
                {job_info.role || "Unknown Role"}{" "}
                <span style={{ color: "#5f6368", fontWeight: 400 }}>
                  @ {companyName}
                </span>
              </h3>

              {/* Meta chips */}
              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                {job_info.location && (
                  <span style={{ fontSize: 12, color: "#5f6368" }}>📍 {job_info.location}</span>
                )}
                {job_info.salary_range && (
                  <span style={{ fontSize: 12, color: "#5f6368" }}>💰 {job_info.salary_range}</span>
                )}
                {job_info.hr_email ? (
                  <span style={{ fontSize: 12, color: "#1a73e8", fontFamily: "monospace" }}>
                    ✉ {job_info.hr_email}
                  </span>
                ) : (
                  <span style={{ fontSize: 12, color: "#ea4335" }}>⚠ No HR email detected</span>
                )}
              </div>
            </div>

            {/* Action buttons */}
            {isActionable && (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setEditing(true)}
                  className="btn-ghost"
                  style={{ fontSize: 13, padding: "6px 14px" }}
                >
                  ✏ Edit
                </button>
                <button
                  onClick={() => onToggleApprove(draft.draft_id, !approved)}
                  style={{
                    fontSize: 13,
                    padding: "6px 14px",
                    background: approved ? "transparent" : "#1e8e3e",
                    color: approved ? "#ea4335" : "#fff",
                    border: approved ? "1px solid #f5c6c5" : "none",
                    borderRadius: 4,
                    cursor: "pointer",
                    fontFamily: '"Google Sans", Roboto, sans-serif',
                    fontWeight: 500,
                    transition: "all 0.15s",
                  }}
                >
                  {approved ? "✕ Reject" : "✓ Approve"}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Duplicate warning banner (non-blocking) ── */}
        {isDuplicateWarning && duplicate_details && (
          <div
            style={{
              padding: "10px 18px",
              background: "#fef7e0",
              borderBottom: "1px solid #fce39e",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 15 }}>⚠️</span>
              <span style={{ fontSize: 13, color: "#b06000" }}>
                You applied to a similar role{" "}
                {duplicate_details.applied_on
                  ? `on ${new Date(duplicate_details.applied_on).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
                  : "recently"}
                {" · "}
                <strong>{Math.round(duplicate_details.similarity_score * 100)}% match. </strong>
                {duplicate_details.reason ? (
                  <span style={{ fontStyle: "italic", marginLeft: 4 }}>{duplicate_details.reason}</span>
                ) : (
                  <span>You still decide whether to send.</span>
                )}
              </span>
            </div>
            <button
              onClick={() => setShowDupModal(true)}
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "#b06000",
                background: "none",
                border: "1px solid #fce39e",
                borderRadius: 4,
                padding: "4px 12px",
                cursor: "pointer",
                whiteSpace: "nowrap",
                fontFamily: '"Google Sans", Roboto, sans-serif',
              }}
            >
              View Previous Application →
            </button>
          </div>
        )}

        {/* ── Error info ── */}
        {draft_status === "error" && error && (
          <div style={{ padding: "10px 18px", background: "#fce8e6", borderBottom: "1px solid #f5c6c5" }}>
            <span style={{ fontSize: 12, color: "#c5221f" }}>⚠ {error}</span>
          </div>
        )}

        {/* ── Gmail-style email preview ── */}
        {cover_email && (
          <div className="gmail-preview" style={{ border: "none", borderRadius: 0 }}>

            {/* Gmail message header */}
            <div className="gmail-preview-header">
              <h2 className="gmail-subject-line">{cover_email.subject}</h2>

              <div className="gmail-sender-row">
                {/* Avatar */}
                <div
                  className="gmail-avatar"
                  style={{ background: avColor }}
                  title={senderName}
                >
                  {initials}
                </div>

                {/* Sender details */}
                <div className="gmail-sender-info">
                  <div className="gmail-sender-name">
                    {senderName}
                    <span style={{ color: "#5f6368", fontWeight: 400, fontSize: 12, marginLeft: 6 }}>
                      &lt;{senderEmail}&gt;
                    </span>
                  </div>
                  <div className="gmail-to-line">
                    to <span style={{ color: "#202124" }}>{recipientEmail}</span>
                  </div>
                </div>

                {/* Timestamp */}
                <div className="gmail-timestamp">{formatDate()}</div>
              </div>
            </div>

            {/* Gmail message body */}
            <div
              className="gmail-body"
              style={{
                maxHeight: expanded ? "none" : "160px",
                overflow: expanded ? "visible" : "hidden",
                position: "relative",
              }}
            >
              {expanded ? cover_email.body : collapsedBody}
              {!expanded && hasMore && (
                <div
                  style={{
                    position: "absolute",
                    bottom: 0, left: 0, right: 0,
                    height: 48,
                    background: "linear-gradient(transparent, #fff)",
                  }}
                />
              )}
            </div>

            {/* Expand/collapse */}
            <button
              onClick={() => setExpanded(!expanded)}
              className="gmail-expand-btn"
            >
              {expanded ? "▲ Collapse" : "▼ Show full email"}
            </button>

            {/* Attachment chips */}
            <div className="gmail-attachment-bar">
              <div className="gmail-attachment-chip">
                <span style={{ fontSize: 16 }}>📄</span>
                <span>Resume.pdf</span>
              </div>
              <div className="gmail-attachment-chip">
                <span style={{ fontSize: 16 }}>📝</span>
                <span>Cover Letter.pdf</span>
              </div>
            </div>
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

      {/* Duplicate alert modal */}
      {showDupModal && duplicate_details && (
        <DuplicateAlertModal
          isOpen={showDupModal}
          onClose={() => setShowDupModal(false)}
          duplicateDetails={duplicate_details}
          jobTitle={`${job_info.role || "Unknown Role"} @ ${companyName}`}
          previousApp={{
            company_name: draft.job_info.company_name,
            role: draft.job_info.role,
            hr_email: draft.job_info.hr_email,
          }}
        />
      )}
    </>
  );
}
