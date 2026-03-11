"use client";

import { useState } from "react";

interface Props {
  hrEmail: string;
  subject: string;
  body: string;
  jobTitle: string;
  onSave: (hrEmail: string, subject: string, body: string) => void;
  onClose: () => void;
}

export default function EmailEditor({ hrEmail: initHrEmail, subject: initSubject, body: initBody, jobTitle, onSave, onClose }: Props) {
  const [hrEmail, setHrEmail] = useState(initHrEmail || "");
  const [subject, setSubject] = useState(initSubject);
  const [body, setBody] = useState(initBody);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-2xl rounded-2xl p-6 flex flex-col gap-4 fade-in"
        style={{
          background: "#13131f",
          border: "1px solid var(--border-hover)",
          maxHeight: "90vh",
          overflow: "auto",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
              ✏️ Edit Cover Email
            </h2>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
              {jobTitle}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-xl hover:text-white transition-colors"
            style={{ color: "var(--text-muted)" }}
          >
            ✕
          </button>
        </div>

        {/* HR Email */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            HR Email Address
          </label>
          <input
            value={hrEmail}
            onChange={(e) => setHrEmail(e.target.value)}
            placeholder="hr@company.com"
            className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid var(--border)",
              color: "var(--text-primary)",
            }}
            onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
            onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
          />
        </div>

        {/* Subject */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Subject
          </label>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid var(--border)",
              color: "var(--text-primary)",
            }}
            onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
            onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
          />
        </div>

        {/* Body */}
        <div className="flex flex-col gap-1.5 flex-1">
          <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Email Body
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={16}
            className="w-full rounded-xl px-4 py-3 text-sm leading-relaxed outline-none transition-all resize-none"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid var(--border)",
              color: "var(--text-primary)",
              fontFamily: "inherit",
            }}
            onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
            onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <button className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={() => onSave(hrEmail, subject, body)}
            disabled={!subject.trim() || !body.trim() || !hrEmail.trim()}
          >
            ✓ Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
