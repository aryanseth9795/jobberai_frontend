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
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-2xl flex flex-col fade-in"
        style={{
          background: "#ffffff",
          border: "1px solid #dadce0",
          boxShadow: "0 8px 32px rgba(60,64,67,0.28)",
          maxHeight: "90vh",
          overflow: "auto",
          borderRadius: 8,
        }}
      >
        {/* Gmail Compose Header */}
        <div
          style={{
            background: "#404040",
            padding: "10px 16px",
            borderRadius: "8px 8px 0 0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span style={{ color: "#fff", fontSize: 14, fontWeight: 500, fontFamily: '"Google Sans", Roboto, sans-serif' }}>
            New Message — {jobTitle}
          </span>
          <button
            onClick={onClose}
            style={{
              color: "#ffffffcc",
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 18,
              lineHeight: 1,
              padding: "2px 4px",
              borderRadius: 2,
            }}
          >
            ✕
          </button>
        </div>

        {/* Compose fields — Gmail style */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>

          {/* To field */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              padding: "8px 0 8px 16px",
              borderBottom: "1px solid #e0e0e0",
            }}
          >
            <span style={{ fontSize: 13, color: "#5f6368", width: 48, flexShrink: 0, fontFamily: '"Google Sans", Roboto, sans-serif' }}>
              To
            </span>
            <input
              value={hrEmail}
              onChange={e => setHrEmail(e.target.value)}
              placeholder="recipient@company.com"
              style={{
                flex: 1,
                fontSize: 14,
                color: "#202124",
                background: "none",
                border: "none",
                outline: "none",
                fontFamily: '"Google Sans", Roboto, sans-serif',
                padding: "2px 8px",
              }}
            />
          </div>

          {/* Subject field */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              padding: "8px 0 8px 16px",
              borderBottom: "1px solid #e0e0e0",
            }}
          >
            <span style={{ fontSize: 13, color: "#5f6368", width: 48, flexShrink: 0, fontFamily: '"Google Sans", Roboto, sans-serif' }}>
              Subject
            </span>
            <input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              style={{
                flex: 1,
                fontSize: 14,
                color: "#202124",
                background: "none",
                border: "none",
                outline: "none",
                fontFamily: '"Google Sans", Roboto, sans-serif',
                padding: "2px 8px",
              }}
            />
          </div>

          {/* Body */}
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            rows={16}
            style={{
              flex: 1,
              width: "100%",
              padding: "16px",
              fontSize: 14,
              lineHeight: 1.7,
              color: "#202124",
              background: "none",
              border: "none",
              outline: "none",
              resize: "none",
              fontFamily: '"Roboto", "Google Sans", sans-serif',
            }}
          />

          {/* Gmail compose footer */}
          <div
            style={{
              padding: "12px 16px",
              borderTop: "1px solid #e0e0e0",
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "#fff",
            }}
          >
            <button
              className="btn-primary"
              onClick={() => onSave(hrEmail, subject, body)}
              disabled={!subject.trim() || !body.trim() || !hrEmail.trim()}
              style={{ borderRadius: 20, padding: "8px 24px", fontSize: 14, fontWeight: 600 }}
            >
              Send
            </button>
            <button
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#5f6368",
                padding: "8px 12px",
                borderRadius: 20,
                fontSize: 14,
                fontFamily: '"Google Sans", Roboto, sans-serif',
              }}
            >
              Cancel
            </button>
            {/* Attachment indicator */}
            <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
              <span
                style={{
                  fontSize: 11,
                  color: "#5f6368",
                  background: "#f1f3f4",
                  borderRadius: 12,
                  padding: "3px 10px",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                📎 Resume.pdf
              </span>
              <span
                style={{
                  fontSize: 11,
                  color: "#5f6368",
                  background: "#f1f3f4",
                  borderRadius: 12,
                  padding: "3px 10px",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                📎 Cover Letter.pdf
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
