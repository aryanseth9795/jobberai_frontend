"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import { ingestProfile, getProfileStatus } from "@/lib/api";

interface ProfileStatus {
  status: "empty" | "ready" | "error" | null;
  chunks: number;
  sources: string[];
  message: string;
}

interface IngestResult {
  status: string;
  message: string;
  chunks_ingested: number;
  sources: string[];
  skipped?: string[];
}

const ACCEPTED_TYPES = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain", "text/markdown"];
const ACCEPTED_EXT = ".pdf,.docx,.txt,.md";

function fileIcon(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "📄";
  if (ext === "docx" || ext === "doc") return "📝";
  return "📃";
}

export default function ProfilePage() {
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<IngestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentStatus, setCurrentStatus] = useState<{ chunks: number; sources: string[] } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load current profile status on mount
  useEffect(() => {
    getProfileStatus()
      .then((s) => {
        if (s.status === "ready") setCurrentStatus({ chunks: s.chunks, sources: s.sources });
      })
      .catch(() => {}); // silently ignore if backend not up
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const dropped = Array.from(e.dataTransfer.files);
    setFiles((prev) => mergeFiles(prev, dropped));
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    setFiles((prev) => mergeFiles(prev, selected));
  };

  // Merge keeping unique filenames (new file replaces old with same name)
  const mergeFiles = (existing: File[], incoming: File[]) => {
    const map = new Map(existing.map((f) => [f.name, f]));
    incoming.forEach((f) => map.set(f.name, f));
    return Array.from(map.values());
  };

  const removeFile = (name: string) =>
    setFiles((prev) => prev.filter((f) => f.name !== name));

  const handleIngest = async () => {
    if (files.length === 0) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await ingestProfile(files);
      setResult(res as IngestResult);
      // Update the "current profile" banner to reflect new state
      if ((res as IngestResult).status === "success") {
        setCurrentStatus({ chunks: (res as IngestResult).chunks_ingested, sources: (res as IngestResult).sources });
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ingestion failed");
    } finally {
      setLoading(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  const isSuccess = result?.status === "success";
  const isWarning = result?.status === "warning";

  return (
    <main
      className="min-h-screen"
      style={{
        background: "radial-gradient(ellipse at top, rgba(99,102,241,0.08) 0%, var(--bg-primary) 60%)",
      }}
    >
      {/* Header */}
      <div className="border-b" style={{ borderColor: "var(--border)" }}>
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold gradient-text">Job Application Agent</h1>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              AI-powered cover email automation
            </p>
          </div>
          <nav className="flex items-center gap-2">
            <Link
              href="/"
              className="btn-ghost text-sm px-4 py-2"
            >
              Apply
            </Link>
            <Link
              href="/profile"
              className="btn-primary text-sm px-4 py-2"
              style={{ boxShadow: "0 0 16px var(--accent-glow)" }}
            >
              Profile
            </Link>
          </nav>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-10">
        {/* Page heading */}
        <div className="text-center mb-10">
          <h2 className="text-4xl font-bold gradient-text mb-3">Your Profile</h2>
          <p style={{ color: "var(--text-secondary)" }}>
            Upload your resume, cover letter, portfolio, or any profile documents.
            <br />
            The AI uses these to write personalized cover emails.
          </p>
          <p className="text-sm mt-2" style={{ color: "var(--text-muted)" }}>
            Uploading new files <strong style={{ color: "var(--accent-light)" }}>replaces</strong> the existing profile — always a fresh start.
          </p>
        </div>

        {/* Current profile status banner */}
        {currentStatus && !result && (
          <div
            className="glass-card p-5 mb-6 fade-in"
            style={{ borderColor: "rgba(16,185,129,0.25)", background: "rgba(16,185,129,0.04)" }}
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl">🧠</span>
              <div className="flex-1">
                <p className="font-semibold" style={{ color: "var(--text-primary)" }}>
                  Profile active — {currentStatus.chunks} chunks in AI memory
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {currentStatus.sources.map((src) => (
                    <span
                      key={src}
                      className="text-xs px-2 py-1 rounded-lg"
                      style={{ background: "rgba(16,185,129,0.1)", color: "#34d399", border: "1px solid rgba(16,185,129,0.2)" }}
                    >
                      {fileIcon(src)} {src}
                    </span>
                  ))}
                </div>
                <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
                  Upload new files below to replace this profile.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className="rounded-2xl border-2 border-dashed transition-all duration-300 cursor-pointer mb-6"
          style={{
            borderColor: dragging ? "var(--accent)" : "var(--border-hover)",
            background: dragging ? "var(--accent-glow)" : "var(--bg-card)",
            minHeight: 180,
          }}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPTED_EXT}
            className="hidden"
            onChange={handleFileInput}
          />
          <div className="flex flex-col items-center justify-center gap-3 p-10">
            <div
              className="text-5xl transition-transform duration-300"
              style={{ transform: dragging ? "scale(1.2)" : "scale(1)" }}
            >
              📂
            </div>
            <p className="font-semibold text-lg" style={{ color: "var(--text-primary)" }}>
              Drop your profile files here
            </p>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              PDF, DOCX, TXT, MD supported
            </p>
            <span className="btn-ghost text-sm mt-1">Browse Files</span>
          </div>
        </div>

        {/* File list */}
        {files.length > 0 && (
          <div className="glass-card p-5 mb-6 fade-in">
            <div className="flex items-center justify-between mb-4">
              <p className="font-semibold" style={{ color: "var(--text-primary)" }}>
                {files.length} file{files.length > 1 ? "s" : ""} selected
              </p>
              <button
                className="text-xs hover:underline"
                style={{ color: "var(--text-muted)" }}
                onClick={() => setFiles([])}
              >
                Clear all
              </button>
            </div>

            <div className="flex flex-col gap-2">
              {files.map((file) => (
                <div
                  key={file.name}
                  className="flex items-center justify-between rounded-xl px-4 py-3"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)" }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xl shrink-0">{fileIcon(file.name)}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                        {file.name}
                      </p>
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {formatSize(file.size)}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeFile(file.name); }}
                    className="text-sm hover:text-red-400 transition-colors shrink-0 ml-4"
                    style={{ color: "var(--text-muted)" }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            {/* Ingest button */}
            <button
              className="btn-primary w-full mt-4 py-3 flex items-center justify-center gap-3"
              onClick={handleIngest}
              disabled={loading}
            >
              {loading ? (
                <><div className="spinner" /> Ingesting into AI memory...</>
              ) : (
                <><span>🧠</span><span>Update Profile</span></>
              )}
            </button>
          </div>
        )}

        {/* Error */}
        {error && (
          <div
            className="rounded-xl p-4 mb-6 text-sm fade-in"
            style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171" }}
          >
            ⚠ {error}
          </div>
        )}

        {/* Result */}
        {result && (
          <div
            className="glass-card p-6 fade-in"
            style={{
              borderColor: isSuccess ? "rgba(16,185,129,0.3)" : "rgba(245,158,11,0.3)",
              background: isSuccess ? "rgba(16,185,129,0.04)" : "rgba(245,158,11,0.04)",
            }}
          >
            <div className="flex items-start gap-4">
              <div className="text-3xl">{isSuccess ? "✅" : "⚠️"}</div>
              <div className="flex-1">
                <p className="font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                  {result.message}
                </p>

                {result.sources?.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
                      Ingested files
                    </p>
                    <div className="flex flex-col gap-1">
                      {result.sources.map((src) => (
                        <div key={src} className="flex items-center gap-2">
                          <span className="text-sm">{fileIcon(src)}</span>
                          <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{src}</span>
                          <span className="badge badge-approved ml-auto text-xs">✓</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {result.skipped && result.skipped.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
                      Skipped (unsupported format)
                    </p>
                    {result.skipped.map((src) => (
                      <p key={src} className="text-sm" style={{ color: "#fbbf24" }}>⚠ {src}</p>
                    ))}
                  </div>
                )}

                <div className="mt-4 flex items-center gap-2">
                  <span className="badge badge-drafted">
                    {result.chunks_ingested} chunks in AI memory
                  </span>
                </div>

                {isSuccess && (
                  <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--border)"}}>
                    <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                      Ready! Go to the{" "}
                      <Link href="/" className="hover:underline" style={{ color: "var(--accent-light)" }}>
                        Apply tab
                      </Link>{" "}
                      to start uploading job screenshots.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tip box */}
        {files.length === 0 && !result && (
          <div
            className="rounded-2xl p-5 fade-in"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
          >
            <p className="text-sm font-semibold mb-3" style={{ color: "var(--text-secondary)" }}>
              Recommended files to upload
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { icon: "📄", label: "Resume PDF", hint: "Your most important file" },
                { icon: "✉", label: "Cover Letter", hint: "Optional base template" },
                { icon: "💼", label: "Portfolio summary", hint: "Projects you've worked on" },
                { icon: "🔗", label: "LinkedIn export", hint: "Download from LinkedIn settings" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-3 rounded-xl px-4 py-3"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}
                >
                  <span className="text-2xl">{item.icon}</span>
                  <div>
                    <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{item.label}</p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>{item.hint}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
