"use client";

import { DuplicateDetails } from "@/lib/api";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  duplicateDetails: DuplicateDetails;
  jobTitle: string;
  /** Optional: pass the full previous application */
  previousApp?: {
    company_name?: string;
    role?: string;
    hr_email?: string;
    applied_at?: string;
    cover_email_subject?: string;
    cover_email_body?: string;
  };
}

function formatDate(iso: string): string {
  if (!iso) return "Unknown date";
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function similarityColor(score: number): string {
  if (score >= 0.97) return "#c5221f";
  if (score >= 0.93) return "#b06000";
  return "#1e8e3e";
}

export default function DuplicateAlertModal({
  isOpen,
  onClose,
  duplicateDetails,
  jobTitle,
  previousApp,
}: Props) {
  if (!isOpen) return null;

  const simPct = Math.round(duplicateDetails.similarity_score * 100);
  const appliedDate = formatDate(duplicateDetails.applied_on || previousApp?.applied_at || "");

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-xl fade-in"
        style={{
          background: "#fff",
          borderRadius: 8,
          boxShadow: "0 8px 32px rgba(60,64,67,0.3)",
          overflow: "hidden",
          maxHeight: "88vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div
          style={{
            background: "#fef7e0",
            borderBottom: "1px solid #fce39e",
            padding: "16px 20px",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <span style={{ fontSize: 22, flexShrink: 0 }}>⚠️</span>
            <div>
              <p
                style={{
                  fontWeight: 600,
                  fontSize: 15,
                  color: "#202124",
                  fontFamily: '"Google Sans", Roboto, sans-serif',
                  marginBottom: 2,
                }}
              >
                Similar Application Already Sent
              </p>
              <p style={{ fontSize: 13, color: "#5f6368" }}>
                You previously applied to a very similar role. Review the details below before deciding.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 18,
              color: "#5f6368",
              padding: 2,
              flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={{ overflowY: "auto", flex: 1, padding: "20px" }}>
          {/* Current job */}
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", color: "#9e9e9e", marginBottom: 6 }}>
              Current Draft
            </p>
            <p style={{ fontSize: 14, fontWeight: 500, color: "#202124" }}>{jobTitle}</p>
          </div>

          {/* Similarity badge */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 14px",
              background: "#f8f9fa",
              borderRadius: 8,
              marginBottom: 20,
            }}
          >
            <div
              style={{
                fontWeight: 700,
                fontSize: 20,
                color: similarityColor(duplicateDetails.similarity_score),
              }}
            >
              {simPct}%
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 500, color: "#202124" }}>Similarity match</p>
              <p style={{ fontSize: 12, color: "#5f6368" }}>
                Applied on {appliedDate}
              </p>
            </div>
          </div>

          {/* Previous app details */}
          <div>
            <p
              style={{
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: "#9e9e9e",
                marginBottom: 10,
              }}
            >
              Previous Application Details
            </p>

            {/* Meta fields */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
                marginBottom: 14,
              }}
            >
              {[
                { label: "Company", value: previousApp?.company_name || "—" },
                { label: "Role", value: previousApp?.role || "—" },
                { label: "HR Email", value: previousApp?.hr_email || "—" },
                { label: "Date Applied", value: appliedDate },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  style={{
                    padding: "10px 12px",
                    background: "#f8f9fa",
                    borderRadius: 6,
                    border: "1px solid #e0e0e0",
                  }}
                >
                  <p style={{ fontSize: 10, color: "#9e9e9e", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 }}>
                    {label}
                  </p>
                  <p style={{ fontSize: 13, color: "#202124", fontWeight: 500, wordBreak: "break-all" }}>
                    {value}
                  </p>
                </div>
              ))}
            </div>

            {/* Previous cover email */}
            {previousApp?.cover_email_subject && (
              <div
                style={{
                  border: "1px solid #e0e0e0",
                  borderRadius: 6,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    padding: "8px 14px",
                    background: "#f8f9fa",
                    borderBottom: "1px solid #e0e0e0",
                  }}
                >
                  <p style={{ fontSize: 11, color: "#9e9e9e", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>
                    Subject Sent
                  </p>
                  <p style={{ fontSize: 13, fontWeight: 500, color: "#202124" }}>
                    {previousApp.cover_email_subject}
                  </p>
                </div>
                {previousApp.cover_email_body && (
                  <div style={{ padding: "12px 14px", maxHeight: 180, overflowY: "auto" }}>
                    <p
                      style={{
                        fontSize: 12,
                        color: "#202124",
                        lineHeight: 1.7,
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                      }}
                    >
                      {previousApp.cover_email_body}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Raw matched snippet if no full details */}
            {!previousApp?.cover_email_subject && duplicateDetails.matched_job && (
              <div
                style={{
                  padding: "10px 14px",
                  background: "#f8f9fa",
                  borderRadius: 6,
                  border: "1px solid #e0e0e0",
                }}
              >
                <p style={{ fontSize: 11, color: "#9e9e9e", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
                  Matched content snippet
                </p>
                <p style={{ fontSize: 12, color: "#5f6368", lineHeight: 1.6 }}>
                  {duplicateDetails.matched_job}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "14px 20px",
            borderTop: "1px solid #e0e0e0",
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            background: "#fff",
          }}
        >
          <button
            onClick={onClose}
            style={{
              background: "#1a73e8",
              color: "#fff",
              border: "none",
              borderRadius: 4,
              padding: "8px 20px",
              fontSize: 14,
              fontFamily: '"Google Sans", Roboto, sans-serif',
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Got it — keep my draft
          </button>
        </div>
      </div>
    </div>
  );
}
