"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  getJobs,
  getJobStats,
  updateJobStatus,
  deleteJob,
  JobApplication,
  DashboardStats,
  FormSession,
  getFormHistory,
} from "@/lib/api";

// ─── helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso?: string) {
  if (!iso) return "—";
  
  // Fastapi/Motor often serializes naive datetimes without a timezone. 
  // We append 'Z' to force JavaScript to treat it as UTC so it converts to local IST correctly.
  const dateStr = iso.endsWith('Z') || iso.includes('+') ? iso : iso + 'Z';
  
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    applied:  { bg: "#e8f0fe", color: "#1a73e8", label: "Applied" },
    sent:     { bg: "#e8f0fe", color: "#1a73e8", label: "Sent" },
    failed:   { bg: "#fce8e6", color: "#c5221f", label: "Failed" },
    rejected: { bg: "#fce8e6", color: "#c5221f", label: "Rejected" },
    interview:{ bg: "#e6f4ea", color: "#1e8e3e", label: "Interview 🎉" },
    offer:    { bg: "#e6f4ea", color: "#1e8e3e", label: "Offer 🎉" },
    ghosted:  { bg: "#f1f3f4", color: "#9e9e9e", label: "Ghosted" },
  };
  const c = map[status.toLowerCase()] ?? { bg: "#f1f3f4", color: "#5f6368", label: status };
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        padding: "3px 10px",
        borderRadius: 12,
        background: c.bg,
        color: c.color,
        whiteSpace: "nowrap",
        fontFamily: '"Google Sans", Roboto, sans-serif',
        textTransform: "capitalize",
      }}
    >
      {c.label}
    </span>
  );
}

// ─── stat card ───────────────────────────────────────────────────────────────

function StatCard({
  value,
  label,
  icon,
  accent,
}: {
  value: number | string;
  label: string;
  icon: string;
  accent?: string;
}) {
  return (
    <div
      className="hud-card"
      style={{
        padding: "18px 20px",
        display: "flex",
        alignItems: "center",
        gap: 14,
        flex: 1,
        minWidth: 140,
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 10,
          background: accent ? `${accent}18` : "#e8f0fe",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 20,
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div>
        <p
          style={{
            fontSize: 28,
            fontWeight: 700,
            color: accent || "#202124",
            fontFamily: '"Google Sans", Roboto, sans-serif',
            lineHeight: 1,
            margin: 0,
          }}
        >
          {value}
        </p>
        <p style={{ fontSize: 12, color: "#5f6368", margin: "4px 0 0", fontFamily: "Roboto, sans-serif" }}>{label}</p>
      </div>
    </div>
  );
}

// ─── detail modal ─────────────────────────────────────────────────────────────

const STATUS_OPTIONS = ["applied", "interview", "offer", "rejected", "ghosted"];

function DetailModal({
  app,
  onClose,
  onStatusChange,
}: {
  app: JobApplication;
  onClose: () => void;
  onStatusChange: (id: string, status: string) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [localStatus, setLocalStatus] = useState(app.status);

  const handleStatusChange = async (newStatus: string) => {
    setSaving(true);
    try {
      await updateJobStatus(app._id, newStatus);
      setLocalStatus(newStatus);
      onStatusChange(app._id, newStatus);
    } catch {
      // silently ignore
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-2xl fade-in"
        style={{
          background: "#fff",
          borderRadius: 8,
          boxShadow: "0 8px 32px rgba(60,64,67,0.3)",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Modal header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid #e0e0e0",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div>
            <h2
              style={{
                fontSize: 17,
                fontWeight: 600,
                color: "#202124",
                margin: 0,
                fontFamily: '"Google Sans", Roboto, sans-serif',
              }}
            >
              {app.role || "Unknown Role"}
            </h2>
            <p style={{ fontSize: 14, color: "#5f6368", margin: "3px 0 0" }}>
              {app.company_name} · {formatDate(app.applied_at)}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: 18,
              cursor: "pointer",
              color: "#5f6368",
              padding: 2,
              flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>

        {/* Modal body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>

          {/* Meta grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
            {[
              { label: "Company", value: app.company_name },
              { label: "Role", value: app.role },
              { label: "HR Email", value: app.hr_email },
              { label: "Applied On", value: formatDate(app.applied_at) },
            ].map(({ label, value }) => (
              <div
                key={label}
                style={{
                  padding: "10px 14px",
                  background: "#f8f9fa",
                  borderRadius: 6,
                  border: "1px solid #e0e0e0",
                }}
              >
                <p style={{ fontSize: 10, color: "#9e9e9e", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 }}>
                  {label}
                </p>
                <p style={{ fontSize: 13, color: "#202124", fontWeight: 500, wordBreak: "break-all" }}>
                  {value || "—"}
                </p>
              </div>
            ))}
          </div>

          {/* Status changer */}
          <div style={{ marginBottom: 20 }}>
            <p style={{ fontSize: 11, color: "#9e9e9e", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
              Update Status
            </p>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {STATUS_OPTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => handleStatusChange(s)}
                  disabled={saving}
                  style={{
                    fontSize: 12,
                    padding: "5px 14px",
                    borderRadius: 12,
                    cursor: "pointer",
                    fontFamily: '"Google Sans", Roboto, sans-serif',
                    fontWeight: localStatus === s ? 600 : 400,
                    background: localStatus === s ? "#1a73e8" : "#f1f3f4",
                    color: localStatus === s ? "#fff" : "#5f6368",
                    border: "none",
                    transition: "all 0.15s",
                    textTransform: "capitalize",
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Cover email */}
          {app.cover_email_subject && (
            <div style={{ border: "1px solid #e0e0e0", borderRadius: 6, overflow: "hidden" }}>
              <div
                style={{
                  padding: "10px 14px",
                  background: "#f8f9fa",
                  borderBottom: "1px solid #e0e0e0",
                }}
              >
                <p style={{ fontSize: 10, color: "#9e9e9e", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 }}>
                  Cover Email Sent
                </p>
                <p style={{ fontSize: 14, fontWeight: 500, color: "#202124" }}>
                  {app.cover_email_subject}
                </p>
              </div>
              {app.cover_email_body && (
                <div style={{ padding: "14px", maxHeight: 240, overflowY: "auto" }}>
                  <p
                    style={{
                      fontSize: 13,
                      color: "#202124",
                      lineHeight: 1.75,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}
                  >
                    {app.cover_email_body}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal footer */}
        <div
          style={{
            padding: "12px 20px",
            borderTop: "1px solid #e0e0e0",
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <button
            onClick={onClose}
            className="btn-ghost"
            style={{ fontSize: 13, padding: "7px 20px" }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── form detail modal ────────────────────────────────────────────────────────

function FormDetailModal({
  session,
  onClose,
}: {
  session: FormSession;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-2xl fade-in"
        style={{
          background: "#fff",
          borderRadius: 8,
          boxShadow: "0 8px 32px rgba(60,64,67,0.3)",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #e0e0e0", display: "flex", justifyContent: "space-between" }}>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 600, color: "#202124", margin: 0 }}>
              {session.role || "Unknown Role"}
            </h2>
            <p style={{ fontSize: 14, color: "#5f6368", margin: "3px 0 0" }}>
              {session.company} · {formatDate(session.filled_at)}
            </p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#5f6368" }}>✕</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
          <div style={{ marginBottom: 20 }}>
            {session.form_url && (
              <a href={session.form_url} target="_blank" style={{ fontSize: 13, color: "#1a73e8", textDecoration: "none" }}>🔗 View Original Form</a>
            )}
          </div>
          
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "#202124", marginBottom: 12 }}>Extracted Questions & Answers</h3>
          
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {session.answers?.map((ans, i) => {
              const questionText = session.questions?.find(q => q.index === ans.index)?.question || ans.question;
              return (
                <div key={i} style={{ background: "#f8f9fa", border: "1px solid #e0e0e0", borderRadius: 8, padding: 14 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#202124", marginBottom: 6 }}>{questionText}</p>
                  <p style={{ fontSize: 13, color: "#5f6368", whiteSpace: "pre-wrap" }}>{ans.answer}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── main dashboard page ──────────────────────────────────────────────────────

const PAGE_SIZE = 15;

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<"emails" | "forms">("emails");
  const [apps, setApps] = useState<JobApplication[]>([]);
  const [formSessions, setFormSessions] = useState<FormSession[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [selected, setSelected] = useState<JobApplication | null>(null);
  const [selectedForm, setSelectedForm] = useState<FormSession | null>(null);
  
  const [deleting, setDeleting] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (activeTab === "emails") {
        const [jobRes, statsRes] = await Promise.all([
          getJobs({ skip: page * PAGE_SIZE, limit: PAGE_SIZE, status: statusFilter || undefined, search: search || undefined }),
          getJobStats(),
        ]);
        setApps(jobRes.applications);
        setTotal(jobRes.total);
        setStats(statsRes);
      } else {
        const formRes = await getFormHistory({ skip: page * PAGE_SIZE, limit: PAGE_SIZE });
        setFormSessions(formRes.sessions);
        setTotal(formRes.total);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, activeTab]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(0);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this application record?")) return;
    setDeleting(id);
    try {
      await deleteJob(id);
      setApps((prev) => prev.filter((a) => a._id !== id));
      setTotal((t) => t - 1);
      loadData(); // refresh stats
    } catch {
      // ignore
    } finally {
      setDeleting(null);
    }
  };

  const handleStatusChange = (id: string, newStatus: string) => {
    setApps((prev) =>
      prev.map((a) => (a._id === id ? { ...a, status: newStatus } : a))
    );
    loadData(); // refresh stats
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // ─── nav header (same as main pages) ────────────────────────────────────
  const navHeader = (
    <header
      style={{
        background: "#ffffff",
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
              width: 36,
              height: 36,
              borderRadius: 8,
              background: "#1a73e8",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
            }}
          >
            ✉
          </div>
          <div>
            <p style={{ fontWeight: 600, fontSize: 16, color: "#202124", fontFamily: '"Google Sans", Roboto, sans-serif', lineHeight: 1.2 }}>
              Job Agent
            </p>
            <p style={{ fontSize: 11, color: "#5f6368" }}>AI cover email automation</p>
          </div>
        </div>
        <nav className="flex gap-2">
          <Link href="/" className="btn-ghost" style={{ textDecoration: "none", padding: "7px 16px", fontSize: 13 }}>Apply</Link>
          <Link href="/reapply" className="btn-ghost" style={{ textDecoration: "none", padding: "7px 16px", fontSize: 13 }}>Re-Apply</Link>
          <Link href="/dashboard" className="btn-primary" style={{ textDecoration: "none", padding: "7px 16px", fontSize: 13 }}>Dashboard</Link>
          <Link href="/profile" className="btn-ghost" style={{ textDecoration: "none", padding: "7px 16px", fontSize: 13 }}>Profile</Link>
        </nav>
      </div>
    </header>
  );

  return (
    <main className="min-h-screen" style={{ background: "#f6f8fc" }}>
      {navHeader}

      <div className="max-w-6xl mx-auto px-6 py-8">

        {/* page title */}
        <div style={{ marginBottom: 28 }}>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 700,
              color: "#202124",
              fontFamily: '"Google Sans", Roboto, sans-serif',
              margin: 0,
            }}
          >
            Applications Dashboard
          </h1>
          <p style={{ fontSize: 14, color: "#5f6368", marginTop: 4 }}>
            Track all your job applications, update statuses, and review emails sent.
          </p>
        </div>

        {/* ── Stats row ── */}
        {stats && (
          <div className="flex flex-wrap gap-4 mb-8">
            <StatCard value={stats.total}      label="Total sent"     icon="✉"  accent="#1a73e8" />
            <StatCard value={stats.today}      label="Today"          icon="📅" accent="#9334e6" />
            <StatCard value={stats.this_week}  label="This week"      icon="📈" accent="#00879f" />
            <StatCard value={stats.sent}       label="Applied"        icon="✅" accent="#1e8e3e" />
            <StatCard value={stats.failed}     label="Failed sends"   icon="❌" accent="#ea4335" />
            <StatCard value={stats.rejected}   label="Rejected"       icon="⛔" accent="#b06000" />
          </div>
        )}

        {/* ── Tabs Toggle ── */}
        <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
          <button
            onClick={() => { setActiveTab("emails"); setPage(0); }}
            style={{
              padding: "10px 20px",
              borderRadius: "8px",
              border: "none",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              background: activeTab === "emails" ? "#1a73e8" : "#fff",
              color: activeTab === "emails" ? "#fff" : "#5f6368",
              boxShadow: activeTab === "emails" ? "0 2px 6px rgba(26,115,232,0.3)" : "0 1px 3px rgba(0,0,0,0.1)",
              transition: "all 0.2s"
            }}
          >
            ✉ Email Campaigns
          </button>
          <button
            onClick={() => { setActiveTab("forms"); setPage(0); }}
            style={{
              padding: "10px 20px",
              borderRadius: "8px",
              border: "none",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              background: activeTab === "forms" ? "#0891b2" : "#fff",
              color: activeTab === "forms" ? "#fff" : "#5f6368",
              boxShadow: activeTab === "forms" ? "0 2px 6px rgba(8,145,178,0.3)" : "0 1px 3px rgba(0,0,0,0.1)",
              transition: "all 0.2s"
            }}
          >
            ⚡ Form Fills (Extension)
          </button>
        </div>

        {/* ── Filters + search (Emails only) ── */}
        {activeTab === "emails" && (
          <div
            className="hud-card"
            style={{ padding: "14px 18px", marginBottom: 16, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}
          >
            {/* Search */}
            <form onSubmit={handleSearch} className="flex items-center gap-2" style={{ flex: 1, minWidth: 200 }}>
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search company, role, or email..."
              style={{
                flex: 1,
                padding: "7px 12px",
                border: "1px solid #dadce0",
                borderRadius: 4,
                fontSize: 13,
                color: "#202124",
                fontFamily: "Roboto, sans-serif",
                outline: "none",
              }}
            />
            <button type="submit" className="btn-primary" style={{ padding: "7px 16px", fontSize: 13 }}>
              Search
            </button>
            {search && (
              <button
                type="button"
                className="btn-ghost"
                style={{ padding: "7px 12px", fontSize: 13 }}
                onClick={() => { setSearch(""); setSearchInput(""); setPage(0); }}
              >
                Clear
              </button>
            )}
          </form>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
            style={{
              padding: "7px 12px",
              border: "1px solid #dadce0",
              borderRadius: 4,
              fontSize: 13,
              color: "#202124",
              background: "#fff",
              cursor: "pointer",
              outline: "none",
            }}
          >
            <option value="">All statuses</option>
            <option value="applied">Applied</option>
            <option value="interview">Interview</option>
            <option value="offer">Offer</option>
            <option value="rejected">Rejected</option>
            <option value="ghosted">Ghosted</option>
            <option value="failed">Failed</option>
          </select>

          <button onClick={loadData} className="btn-ghost" style={{ padding: "7px 12px", fontSize: 13 }}>
            ↻ Refresh
          </button>
        </div>
        )}

        {/* ── Table/List Area ── */}
        {error && (
          <div
            className="fade-in"
            style={{
              background: "#fce8e6",
              border: "1px solid #f5c6c5",
              borderRadius: 8,
              padding: 14,
              marginBottom: 20,
              fontSize: 13,
              color: "#c5221f",
            }}
          >
            ⚠ {error}
          </div>
        )}

        {loading ? (
          <div className="hud-card" style={{ padding: 40, textAlign: "center" }}>
            <div
              style={{
                width: 32,
                height: 32,
                border: "3px solid #e8f0fe",
                borderTopColor: activeTab === "forms" ? "#0891b2" : "#1a73e8",
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
                margin: "0 auto 12px",
              }}
            />
            <p style={{ fontSize: 14, color: "#5f6368" }}>Loading records...</p>
          </div>
        ) : (activeTab === "emails" ? apps.length === 0 : formSessions.length === 0) ? (
          <div
            className="hud-card"
            style={{ padding: 48, textAlign: "center" }}
          >
            <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
            <p style={{ fontSize: 16, fontWeight: 500, color: "#202124", fontFamily: '"Google Sans", Roboto, sans-serif', marginBottom: 6 }}>
              {activeTab === "emails" 
                ? (search || statusFilter ? "No applications match your filters" : "No email applications yet")
                : "No form filling sessions yet"}
            </p>
            <p style={{ fontSize: 13, color: "#5f6368" }}>
              {activeTab === "emails"
                ? (search || statusFilter ? "Try clearing filters" : "Head to the Apply tab to send your first cover email.")
                : "Use the Chrome Extension on a Google Form to start logging data here."}
            </p>
          </div>
        ) : (
          <>
            {/* Table */}
            <div
              className="hud-card"
              style={{ overflow: "hidden", padding: 0 }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: activeTab === "emails" 
                    ? "2fr 1.5fr 2fr 1fr 100px 36px"
                    : "2fr 2fr 1.5fr 100px",
                  gap: 0,
                  padding: "10px 18px",
                  background: "#f8f9fa",
                  borderBottom: "1px solid #e0e0e0",
                }}
              >
                {(activeTab === "emails" 
                  ? ["Company", "Role", "HR Email", "Date", "Status", ""] 
                  : ["Company", "Role", "Filled On", "Status"]
                ).map((h, idx) => (
                  <span
                    key={idx}
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: "#5f6368",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    {h}
                  </span>
                ))}
              </div>

              {activeTab === "emails" && apps.map((app, i) => (
                <div
                  key={app._id}
                  onClick={() => setSelected(app)}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "2fr 1.5fr 2fr 1fr 100px 36px",
                    gap: 0,
                    padding: "12px 18px",
                    borderBottom: i < apps.length - 1 ? "1px solid #f1f3f4" : "none",
                    cursor: "pointer",
                    transition: "background 0.1s",
                    alignItems: "center",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f8f9fa")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                >
                  <span style={{ fontSize: 14, fontWeight: 500, color: "#202124", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 8 }}>
                    {app.company_name || "—"}
                  </span>
                  <span style={{ fontSize: 13, color: "#5f6368", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 8 }}>
                    {app.role || "—"}
                  </span>
                  <span style={{ fontSize: 12, color: "#1a73e8", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 8 }}>
                    {app.hr_email || "—"}
                  </span>
                  <span style={{ fontSize: 12, color: "#9e9e9e", whiteSpace: "nowrap" }}>
                    {formatDate(app.applied_at)}
                  </span>
                  <StatusBadge status={app.status} />
                  <button
                    onClick={(e) => handleDelete(app._id, e)}
                    disabled={deleting === app._id}
                    title="Delete application"
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      fontSize: 15,
                      color: "#9e9e9e",
                      padding: 4,
                      borderRadius: 4,
                      transition: "color 0.15s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "#ea4335")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "#9e9e9e")}
                  >
                    {deleting === app._id ? "…" : "🗑"}
                  </button>
                </div>
              ))}

              {activeTab === "forms" && formSessions.map((session, i) => (
                <div
                  key={session.preview_id}
                  onClick={() => setSelectedForm(session)}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "2fr 2fr 1.5fr 100px",
                    gap: 0,
                    padding: "12px 18px",
                    borderBottom: i < formSessions.length - 1 ? "1px solid #f1f3f4" : "none",
                    cursor: "pointer",
                    transition: "background 0.1s",
                    alignItems: "center",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f8f9fa")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                >
                  <span style={{ fontSize: 14, fontWeight: 500, color: "#202124", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 8 }}>
                    {session.company || "Unknown"}
                  </span>
                  <span style={{ fontSize: 13, color: "#5f6368", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 8 }}>
                    {session.role || session.form_title || "Unknown"}
                  </span>
                  <span style={{ fontSize: 12, color: "#9e9e9e", whiteSpace: "nowrap" }}>
                    {formatDate(session.filled_at)}
                  </span>
                  <StatusBadge status={session.status} />
                </div>
              ))}
            </div>

            {/* Pagination */}
            <div
              style={{
                marginTop: 16,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              <span style={{ fontSize: 13, color: "#5f6368" }}>
                Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total} applications
              </span>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  className="btn-ghost"
                  style={{ padding: "6px 14px", fontSize: 13, opacity: page === 0 ? 0.4 : 1 }}
                >
                  ← Prev
                </button>
                <span
                  style={{
                    padding: "6px 14px",
                    fontSize: 13,
                    color: "#202124",
                    background: "#e8f0fe",
                    borderRadius: 4,
                    fontWeight: 500,
                  }}
                >
                  {page + 1} / {totalPages}
                </span>
                <button
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  className="btn-ghost"
                  style={{ padding: "6px 14px", fontSize: 13, opacity: page >= totalPages - 1 ? 0.4 : 1 }}
                >
                  Next →
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Detail modals */}
      {selected && (
        <DetailModal
          app={selected}
          onClose={() => setSelected(null)}
          onStatusChange={(id, status) => {
            handleStatusChange(id, status);
            setSelected((s) => (s && s._id === id ? { ...s, status } : s));
          }}
        />
      )}
      
      {selectedForm && (
        <FormDetailModal
          session={selectedForm}
          onClose={() => setSelectedForm(null)}
        />
      )}
    </main>
  );
}
