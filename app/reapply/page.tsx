"use client";

import { useState } from "react";
import Link from "next/link";
import {
  reapplyDraft,
  reapplyConfirm,
  ReapplyDraft,
  ReapplyBatchResponse,
  ReapplySendResult,
  CoverEmail,
} from "@/lib/api";

// ─── helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso?: string) {
  if (!iso) return "—";
  const s = iso.endsWith("Z") || iso.includes("+") ? iso : iso + "Z";
  return new Date(s).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric",
  });
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function sevenDaysAgo() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
}

// ─── nav header ───────────────────────────────────────────────────────────────

function NavHeader() {
  return (
    <header
      style={{
        background: "#fff",
        borderBottom: "1px solid #e0e0e0",
        position: "sticky",
        top: 0,
        zIndex: 40,
      }}
    >
      <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            style={{
              width: 36, height: 36, borderRadius: 8,
              background: "#7c3aed",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18,
            }}
          >
            🔄
          </div>
          <div>
            <p style={{ fontWeight: 600, fontSize: 16, color: "#202124", fontFamily: '"Google Sans", Roboto, sans-serif', lineHeight: 1.2 }}>
              Re-Apply
            </p>
            <p style={{ fontSize: 11, color: "#5f6368" }}>Bulk email redraft &amp; resend</p>
          </div>
        </div>
        <nav className="flex gap-2">
          <Link href="/" className="btn-ghost" style={{ textDecoration: "none", padding: "7px 16px", fontSize: 13 }}>Mail</Link>
          <Link href="/forms" className="btn-ghost" style={{ textDecoration: "none", padding: "7px 16px", fontSize: 13 }}>Forms</Link>
          <Link href="/scraping" className="btn-ghost" style={{ textDecoration: "none", padding: "7px 16px", fontSize: 13 }}>Scraping</Link>
          <div style={{ width: 1, backgroundColor: "#e0e0e0", margin: "0 4px" }} />
          <Link href="/dashboard" className="btn-ghost" style={{ textDecoration: "none", padding: "7px 16px", fontSize: 13 }}>Dashboard</Link>
          <Link href="/reapply" style={{
            textDecoration: "none", padding: "7px 16px", fontSize: 13,
            background: "#7c3aed", color: "#fff", borderRadius: 6, fontWeight: 600,
          }}>Re-Apply</Link>
          <Link href="/profile" className="btn-ghost" style={{ textDecoration: "none", padding: "7px 16px", fontSize: 13 }}>Profile</Link>
        </nav>
      </div>
    </header>
  );
}

// ─── draft card ───────────────────────────────────────────────────────────────

interface DraftCardState {
  draft: ReapplyDraft;
  approved: boolean;
  editingEmail: string;  // hr_email override
  editingSubject: string;
  editingBody: string;
  editingHr: boolean;
  editingContent: boolean;
}

function ReapplyDraftCard({
  state,
  onChange,
}: {
  state: DraftCardState;
  onChange: (updated: Partial<DraftCardState>) => void;
}) {
  const { draft, approved, editingEmail, editingSubject, editingBody, editingHr, editingContent } = state;
  const isError = draft.draft_status === "error";

  return (
    <div
      style={{
        background: "#fff",
        border: `1.5px solid ${approved ? "#a8d5b5" : isError ? "#f5c6c5" : "#e0e0e0"}`,
        borderRadius: 12,
        overflow: "hidden",
        boxShadow: "0 1px 4px rgba(60,64,67,0.08)",
        transition: "border-color 0.2s",
        opacity: isError ? 0.75 : 1,
      }}
    >
      {/* Card header */}
      <div
        style={{
          padding: "14px 18px",
          background: approved ? "#f0fdf4" : isError ? "#fce8e6" : "#f8f9fa",
          borderBottom: "1px solid #e0e0e0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <input
            type="checkbox"
            checked={approved}
            disabled={isError}
            onChange={(e) => onChange({ approved: e.target.checked })}
            style={{ width: 17, height: 17, accentColor: "#1e8e3e", cursor: isError ? "not-allowed" : "pointer", flexShrink: 0 }}
          />
          <div>
            <p style={{ fontSize: 15, fontWeight: 600, color: "#202124", fontFamily: '"Google Sans", Roboto, sans-serif', margin: 0 }}>
              {draft.company_name || "—"} &nbsp;·&nbsp;
              <span style={{ color: "#5f6368", fontWeight: 400 }}>{draft.role || "—"}</span>
            </p>
            {/* HR email row */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
              {editingHr ? (
                <input
                  value={editingEmail}
                  autoFocus
                  onChange={(e) => onChange({ editingEmail: e.target.value })}
                  onBlur={() => onChange({ editingHr: false })}
                  style={{
                    fontSize: 12, color: "#1a73e8", fontFamily: "monospace",
                    border: "1px solid #1a73e8", borderRadius: 4, padding: "2px 6px",
                    outline: "none", background: "#fff",
                  }}
                />
              ) : (
                <span style={{ fontSize: 12, color: "#1a73e8", fontFamily: "monospace" }}>
                  {editingEmail || draft.hr_email || "—"}
                </span>
              )}
              <button
                onClick={() => onChange({ editingHr: !editingHr })}
                title={editingHr ? "Done" : "Edit HR email"}
                style={{
                  background: "none", border: "none", cursor: "pointer", fontSize: 12,
                  color: "#9e9e9e", padding: "1px 4px",
                }}
              >
                {editingHr ? "✓" : "✏"}
              </button>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {isError ? (
            <span style={{ fontSize: 12, color: "#c5221f", background: "#fce8e6", padding: "3px 10px", borderRadius: 10, fontWeight: 600 }}>
              ✕ Draft failed
            </span>
          ) : (
            <span style={{ fontSize: 12, color: "#1e8e3e", background: "#e6f4ea", padding: "3px 10px", borderRadius: 10, fontWeight: 600 }}>
              ✓ Ready
            </span>
          )}
        </div>
      </div>

      {/* Error message */}
      {isError && draft.error && (
        <div style={{ padding: "10px 18px", background: "#fce8e6", borderBottom: "1px solid #f5c6c5" }}>
          <p style={{ fontSize: 12, color: "#c5221f", margin: 0 }}>⚠ {draft.error}</p>
        </div>
      )}

      {/* Side-by-side comparison */}
      {!isError && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 0,
            borderTop: "1px solid #f1f3f4",
          }}
        >
          {/* Original */}
          <div style={{ padding: 16, borderRight: "1px solid #e0e0e0" }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: "#9e9e9e", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 10px" }}>
              📋 Original
            </p>
            <p style={{ fontSize: 11, fontWeight: 600, color: "#5f6368", margin: "0 0 4px" }}>{draft.original_subject || "—"}</p>
            <p style={{
              fontSize: 12, color: "#9e9e9e", lineHeight: 1.65, whiteSpace: "pre-wrap",
              maxHeight: 160, overflowY: "auto", margin: 0,
            }}>
              {draft.original_body || "—"}
            </p>
          </div>

          {/* New draft */}
          <div style={{ padding: 16, background: "#fafffe" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: "#1a73e8", textTransform: "uppercase", letterSpacing: "0.07em", margin: 0 }}>
                ✨ New Draft
              </p>
              <button
                onClick={() => onChange({ editingContent: !editingContent })}
                style={{
                  fontSize: 11, color: editingContent ? "#1e8e3e" : "#1a73e8",
                  background: editingContent ? "#e6f4ea" : "#e8f0fe",
                  border: "none", borderRadius: 8, padding: "3px 10px",
                  cursor: "pointer", fontWeight: 600,
                }}
              >
                {editingContent ? "✓ Done" : "✏ Edit"}
              </button>
            </div>

            {editingContent ? (
              <>
                <input
                  value={editingSubject}
                  onChange={(e) => onChange({ editingSubject: e.target.value })}
                  placeholder="Subject"
                  style={{
                    width: "100%", fontSize: 12, fontWeight: 600, color: "#202124",
                    border: "1px solid #dadce0", borderRadius: 4, padding: "5px 8px",
                    marginBottom: 8, outline: "none", fontFamily: "Roboto, sans-serif",
                    boxSizing: "border-box",
                  }}
                />
                <textarea
                  value={editingBody}
                  onChange={(e) => onChange({ editingBody: e.target.value })}
                  style={{
                    width: "100%", minHeight: 140, fontSize: 12, color: "#202124",
                    border: "1px solid #dadce0", borderRadius: 4, padding: "6px 8px",
                    outline: "none", fontFamily: "Roboto, sans-serif", resize: "vertical",
                    lineHeight: 1.65, boxSizing: "border-box",
                  }}
                />
              </>
            ) : (
              <>
                <p style={{ fontSize: 11, fontWeight: 600, color: "#202124", margin: "0 0 4px" }}>
                  {editingSubject || draft.new_cover_email?.subject || "—"}
                </p>
                <p style={{
                  fontSize: 12, color: "#5f6368", lineHeight: 1.65, whiteSpace: "pre-wrap",
                  maxHeight: 160, overflowY: "auto", margin: 0,
                }}>
                  {editingBody || draft.new_cover_email?.body || "—"}
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Attachment toggles (only shown when approved + not error) */}
      {approved && !isError && (
        <div
          style={{
            padding: "10px 18px",
            borderTop: "1px solid #f1f3f4",
            background: "#f0fdf4",
            display: "flex",
            gap: 16,
          }}
        >
          <span style={{ fontSize: 11, color: "#5f6368", alignSelf: "center" }}>Attachments:</span>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#5f6368", cursor: "pointer" }}>
            <input type="checkbox" defaultChecked style={{ accentColor: "#1a73e8" }} id={`resume-${draft.original_app_id}`} />
            Resume
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#5f6368", cursor: "pointer" }}>
            <input type="checkbox" defaultChecked style={{ accentColor: "#1a73e8" }} id={`cl-${draft.original_app_id}`} />
            Cover Letter
          </label>
        </div>
      )}
    </div>
  );
}

// ─── main page ────────────────────────────────────────────────────────────────

type Phase = "setup" | "reviewing" | "results";

export default function ReApplyPage() {
  const [phase, setPhase] = useState<Phase>("setup");

  // Setup state
  const [startDate, setStartDate] = useState(sevenDaysAgo());
  const [endDate, setEndDate] = useState(today());
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Review state
  const [batchId, setBatchId] = useState("");
  const [cardStates, setCardStates] = useState<DraftCardState[]>([]);
  const [stats, setStats] = useState<{ found: number; drafted: number } | null>(null);

  // Send state
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<ReapplySendResult[]>([]);

  // ── Phase 1: fetch & redraft ──

  const handleFetch = async () => {
    if (!startDate || !endDate) return;
    setLoading(true);
    setError(null);
    try {
      const res: ReapplyBatchResponse = await reapplyDraft(
        startDate,
        endDate,
        statusFilter || undefined,
      );
      setBatchId(res.batch_id);
      setStats({ found: res.total_found, drafted: res.total_drafted });
      setCardStates(
        res.drafts.map((d) => ({
          draft: d,
          approved: d.draft_status === "drafted",
          editingEmail: d.hr_email,
          editingSubject: d.new_cover_email?.subject ?? "",
          editingBody: d.new_cover_email?.body ?? "",
          editingHr: false,
          editingContent: false,
        }))
      );
      setPhase("reviewing");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch applications.");
    } finally {
      setLoading(false);
    }
  };

  const updateCard = (appId: string, patch: Partial<DraftCardState>) => {
    setCardStates((prev) =>
      prev.map((c) => (c.draft.original_app_id === appId ? { ...c, ...patch } : c))
    );
  };

  // ── Phase 2: send ──

  const approvedCards = cardStates.filter((c) => c.approved && c.draft.draft_status === "drafted");

  const handleSend = async () => {
    if (approvedCards.length === 0) return;
    setSending(true);
    setError(null);
    try {
      const approved = approvedCards.map((c) => {
        // Read attachment checkbox values
        const resumeEl = document.getElementById(`resume-${c.draft.original_app_id}`) as HTMLInputElement | null;
        const clEl = document.getElementById(`cl-${c.draft.original_app_id}`) as HTMLInputElement | null;

        const coverEmail: CoverEmail = {
          subject: c.editingSubject || c.draft.new_cover_email?.subject || "",
          body: c.editingBody || c.draft.new_cover_email?.body || "",
        };

        return {
          original_app_id: c.draft.original_app_id,
          cover_email: coverEmail,
          hr_email: c.editingEmail !== c.draft.hr_email ? c.editingEmail : undefined,
          attach_resume: resumeEl?.checked ?? true,
          attach_cover_letter: clEl?.checked ?? true,
        };
      });

      const res = await reapplyConfirm(batchId, approved);
      setResults(res.results);
      setPhase("results");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send emails.");
    } finally {
      setSending(false);
    }
  };

  const reset = () => {
    setPhase("setup");
    setError(null);
    setCardStates([]);
    setResults([]);
    setBatchId("");
    setStats(null);
  };

  const sentCount = results.filter((r) => r.status === "sent").length;
  const failedCount = results.filter((r) => r.status === "failed").length;

  return (
    <main className="min-h-screen" style={{ background: "#f6f8fc" }}>
      <NavHeader />

      <div className="max-w-6xl mx-auto px-6 py-8">

        {/* ── Page title ── */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: "#202124", fontFamily: '"Google Sans", Roboto, sans-serif', margin: 0 }}>
            Bulk Re-Apply
          </h1>
          <p style={{ fontSize: 14, color: "#5f6368", marginTop: 4 }}>
            Select a date range to re-draft and resend cover emails for past applications.
          </p>
        </div>

        {/* ═══════════════ PHASE: SETUP ═══════════════ */}
        {phase === "setup" && (
          <div className="fade-in">

            {/* Controls card */}
            <div
              className="hud-card"
              style={{ padding: 24, marginBottom: 24, maxWidth: 680 }}
            >
              <p style={{ fontSize: 13, fontWeight: 600, color: "#202124", marginBottom: 16, fontFamily: '"Google Sans", Roboto, sans-serif' }}>
                Select Date Range
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 12, alignItems: "end" }}>
                {/* Start date */}
                <div>
                  <label style={{ fontSize: 11, color: "#9e9e9e", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 5 }}>
                    From
                  </label>
                  <input
                    type="date"
                    id="reapply-start-date"
                    value={startDate}
                    max={endDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    style={{
                      width: "100%", padding: "8px 10px",
                      border: "1px solid #dadce0", borderRadius: 6,
                      fontSize: 13, color: "#202124", outline: "none",
                      fontFamily: "Roboto, sans-serif",
                    }}
                  />
                </div>

                {/* End date */}
                <div>
                  <label style={{ fontSize: 11, color: "#9e9e9e", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 5 }}>
                    To
                  </label>
                  <input
                    type="date"
                    id="reapply-end-date"
                    value={endDate}
                    min={startDate}
                    max={today()}
                    onChange={(e) => setEndDate(e.target.value)}
                    style={{
                      width: "100%", padding: "8px 10px",
                      border: "1px solid #dadce0", borderRadius: 6,
                      fontSize: 13, color: "#202124", outline: "none",
                      fontFamily: "Roboto, sans-serif",
                    }}
                  />
                </div>

                {/* Status filter */}
                <div>
                  <label style={{ fontSize: 11, color: "#9e9e9e", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 5 }}>
                    Status (optional)
                  </label>
                  <select
                    id="reapply-status-filter"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    style={{
                      width: "100%", padding: "8px 10px",
                      border: "1px solid #dadce0", borderRadius: 6,
                      fontSize: 13, color: "#202124", background: "#fff",
                      outline: "none", cursor: "pointer",
                    }}
                  >
                    <option value="">All statuses</option>
                    <option value="applied">Applied</option>
                    <option value="ghosted">Ghosted</option>
                    <option value="rejected">Rejected</option>
                    <option value="interview">Interview</option>
                  </select>
                </div>

                {/* Submit */}
                <button
                  id="reapply-fetch-btn"
                  onClick={handleFetch}
                  disabled={loading || !startDate || !endDate}
                  style={{
                    padding: "8px 20px",
                    background: loading ? "#e8f0fe" : "#7c3aed",
                    color: loading ? "#1a73e8" : "#fff",
                    border: "none", borderRadius: 6, fontSize: 13, fontWeight: 600,
                    cursor: loading ? "not-allowed" : "pointer",
                    whiteSpace: "nowrap",
                    display: "flex", alignItems: "center", gap: 8,
                    transition: "background 0.2s",
                  }}
                >
                  {loading ? (
                    <>
                      <div style={{ width: 14, height: 14, border: "2px solid #e8f0fe", borderTopColor: "#1a73e8", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                      Drafting...
                    </>
                  ) : (
                    "🔍 Fetch & Redraft"
                  )}
                </button>
              </div>

              {loading && (
                <div style={{ marginTop: 16, padding: "10px 14px", background: "#f8f9fa", borderRadius: 6, border: "1px solid #e0e0e0" }}>
                  <p style={{ fontSize: 12, color: "#5f6368", margin: 0 }}>
                    ⏳ Fetching applications and re-drafting cover emails… Up to 5 processed concurrently. This may take a moment.
                  </p>
                </div>
              )}
            </div>

            {error && (
              <div style={{ background: "#fce8e6", border: "1px solid #f5c6c5", borderRadius: 8, padding: "12px 16px", marginBottom: 20, fontSize: 13, color: "#c5221f" }}>
                ⚠ {error}
              </div>
            )}

            {/* Info cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, maxWidth: 680 }}>
              {[
                { icon: "📅", title: "Date Range Query", desc: "Applications are fetched from MongoDB by their applied_at timestamp." },
                { icon: "✨", title: "Fresh Drafts", desc: "Each email is re-drafted using your latest profile context via RAG." },
                { icon: "🗄", title: "Isolated Storage", desc: "Re-applied emails are saved separately — your original records stay unchanged." },
              ].map((c) => (
                <div key={c.title} className="hud-card" style={{ padding: 18 }}>
                  <span style={{ fontSize: 22 }}>{c.icon}</span>
                  <p style={{ fontWeight: 600, fontSize: 13, color: "#202124", margin: "8px 0 4px", fontFamily: '"Google Sans", Roboto, sans-serif' }}>{c.title}</p>
                  <p style={{ fontSize: 12, color: "#5f6368", lineHeight: 1.6, margin: 0 }}>{c.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══════════════ PHASE: REVIEWING ═══════════════ */}
        {phase === "reviewing" && (
          <div className="fade-in">

            {/* Summary bar */}
            <div className="hud-card" style={{ padding: "16px 20px", marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                <div style={{ display: "flex", gap: 24 }}>
                  <div>
                    <p style={{ fontSize: 24, fontWeight: 700, color: "#202124", margin: 0, fontFamily: '"Google Sans", Roboto, sans-serif' }}>{stats?.found ?? 0}</p>
                    <p style={{ fontSize: 12, color: "#5f6368", margin: "2px 0 0" }}>Found in range</p>
                  </div>
                  <div>
                    <p style={{ fontSize: 24, fontWeight: 700, color: "#1e8e3e", margin: 0, fontFamily: '"Google Sans", Roboto, sans-serif' }}>{stats?.drafted ?? 0}</p>
                    <p style={{ fontSize: 12, color: "#5f6368", margin: "2px 0 0" }}>Drafted</p>
                  </div>
                  <div>
                    <p style={{ fontSize: 24, fontWeight: 700, color: "#7c3aed", margin: 0, fontFamily: '"Google Sans", Roboto, sans-serif' }}>{approvedCards.length}</p>
                    <p style={{ fontSize: 12, color: "#5f6368", margin: "2px 0 0" }}>Selected</p>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: "#5f6368" }}>
                    {startDate} → {endDate}
                    {statusFilter ? ` · status: ${statusFilter}` : ""}
                  </span>
                  <button onClick={reset} className="btn-ghost" style={{ fontSize: 13, padding: "6px 14px" }}>
                    ← New search
                  </button>
                  <button
                    id="reapply-send-btn"
                    onClick={handleSend}
                    disabled={approvedCards.length === 0 || sending}
                    style={{
                      padding: "8px 20px",
                      background: approvedCards.length === 0 ? "#e0e0e0" : "#7c3aed",
                      color: approvedCards.length === 0 ? "#9e9e9e" : "#fff",
                      border: "none", borderRadius: 6, fontSize: 13, fontWeight: 600,
                      cursor: approvedCards.length === 0 ? "not-allowed" : "pointer",
                      display: "flex", alignItems: "center", gap: 8,
                    }}
                  >
                    {sending ? (
                      <>
                        <div style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                        Sending...
                      </>
                    ) : (
                      `📤 Send ${approvedCards.length} Email${approvedCards.length !== 1 ? "s" : ""}`
                    )}
                  </button>
                </div>
              </div>
            </div>

            {error && (
              <div style={{ background: "#fce8e6", border: "1px solid #f5c6c5", borderRadius: 8, padding: "12px 16px", marginBottom: 16, fontSize: 13, color: "#c5221f" }}>
                ⚠ {error}
              </div>
            )}

            {/* Draft cards */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {cardStates.map((cs, idx) => (
                <div key={cs.draft.original_app_id} style={{ position: "relative" }}>
                  {/* Index badge */}
                  <div style={{
                    position: "absolute", top: -10, left: -10,
                    background: "#7c3aed", color: "#fff",
                    width: 28, height: 28, borderRadius: "50%",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 12, fontWeight: 600,
                    boxShadow: "0 2px 6px rgba(124,58,237,0.35)",
                    zIndex: 10,
                  }}>
                    #{idx + 1}
                  </div>
                  <ReapplyDraftCard
                    state={cs}
                    onChange={(patch) => updateCard(cs.draft.original_app_id, patch)}
                  />
                </div>
              ))}
            </div>

            {/* Sticky send button */}
            {approvedCards.length > 0 && (
              <div style={{ position: "sticky", bottom: 24, display: "flex", justifyContent: "flex-end", marginTop: 24 }}>
                <button
                  onClick={handleSend}
                  disabled={sending}
                  style={{
                    padding: "12px 28px",
                    background: "#7c3aed",
                    color: "#fff",
                    border: "none", borderRadius: 24, fontSize: 14, fontWeight: 600,
                    cursor: "pointer",
                    boxShadow: "0 4px 16px rgba(124,58,237,0.35)",
                    display: "flex", alignItems: "center", gap: 10,
                    transition: "transform 0.15s, box-shadow 0.15s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 6px 20px rgba(124,58,237,0.45)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 4px 16px rgba(124,58,237,0.35)"; }}
                >
                  {sending ? (
                    <>
                      <div style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                      Sending…
                    </>
                  ) : (
                    `📤 Send ${approvedCards.length} Selected Email${approvedCards.length !== 1 ? "s" : ""}`
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════ PHASE: RESULTS ═══════════════ */}
        {phase === "results" && (
          <div className="fade-in" style={{ textAlign: "center" }}>
            <div style={{ marginBottom: 32 }}>
              <div style={{
                width: 72, height: 72, margin: "0 auto 20px",
                borderRadius: "50%",
                background: failedCount === 0 ? "#e6f4ea" : "#fef7e0",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 32,
              }}>
                {failedCount === 0 ? "✅" : "⚠️"}
              </div>
              <h2 style={{ fontSize: 26, fontWeight: 700, color: "#202124", fontFamily: '"Google Sans", Roboto, sans-serif', marginBottom: 8 }}>
                {failedCount === 0 ? "Re-apply complete!" : "Partially sent"}
              </h2>
              <p style={{ fontSize: 14, color: "#5f6368" }}>
                {sentCount} sent · {failedCount} failed
              </p>
              <p style={{ fontSize: 12, color: "#9e9e9e", marginTop: 4 }}>
                Results saved to the <code style={{ background: "#f1f3f4", padding: "1px 4px", borderRadius: 3 }}>reapplications</code> collection.
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 520, margin: "0 auto 32px", textAlign: "left" }}>
              {results.map((r) => {
                const card = cardStates.find((c) => c.draft.original_app_id === r.original_app_id);
                return (
                  <div
                    key={r.original_app_id}
                    style={{
                      padding: "12px 16px",
                      background: r.status === "sent" ? "#e6f4ea" : "#fce8e6",
                      border: `1px solid ${r.status === "sent" ? "#a8d5b5" : "#f5c6c5"}`,
                      borderRadius: 8,
                      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                    }}
                  >
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 500, color: "#202124", margin: 0 }}>
                        {card?.draft.company_name || "—"} · {card?.draft.role || "—"}
                      </p>
                      <p style={{ fontSize: 12, color: "#5f6368", margin: "2px 0 0", fontFamily: "monospace" }}>
                        {card?.editingEmail || card?.draft.hr_email || "—"}
                      </p>
                      {r.error && <p style={{ fontSize: 12, color: "#c5221f", margin: "4px 0 0" }}>{r.error}</p>}
                    </div>
                    <span style={{
                      fontSize: 12, fontWeight: 700, padding: "3px 12px", borderRadius: 10,
                      background: r.status === "sent" ? "#1e8e3e" : "#c5221f",
                      color: "#fff", whiteSpace: "nowrap",
                    }}>
                      {r.status === "sent" ? "✓ Sent" : "✕ Failed"}
                    </span>
                  </div>
                );
              })}
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button
                onClick={reset}
                style={{
                  padding: "10px 28px", background: "#7c3aed", color: "#fff",
                  border: "none", borderRadius: 20, fontSize: 14, fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                🔄 New Re-Apply
              </button>
              <Link href="/dashboard">
                <button style={{
                  padding: "10px 28px", background: "#f1f3f4", color: "#202124",
                  border: "none", borderRadius: 20, fontSize: 14, fontWeight: 600,
                  cursor: "pointer",
                }}>
                  📊 View Dashboard
                </button>
              </Link>
            </div>
          </div>
        )}

      </div>
    </main>
  );
}
