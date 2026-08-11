"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import { ingestProfile, getProfileStatus, getUploadedFiles, deleteUploadedFile, UploadedFiles } from "@/lib/api";

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
  const [uploadsStatus, setUploadsStatus] = useState<UploadedFiles | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load current profile status on mount
  const loadUploadsStatus = () => {
    getUploadedFiles()
      .then((u) => setUploadsStatus(u))
      .catch(() => {});
  };

  useEffect(() => {
    getProfileStatus()
      .then((s) => {
        if (s.status === "ready") setCurrentStatus({ chunks: s.chunks, sources: s.sources });
      })
      .catch(() => {});
    loadUploadsStatus();
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
        loadUploadsStatus();
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
      style={{ background: "#f6f8fc" }}
    >
      {/* Header */}
      <div style={{ background: "#ffffff", borderBottom: "1px solid #e0e0e0", position: "sticky", top: 0, zIndex: 40 }}>
        <div className="max-w-3xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div style={{ width: 36, height: 36, borderRadius: 8, background: "#1a73e8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>✉</div>
            <div>
              <h1 style={{ fontSize: 16, fontWeight: 600, color: "#202124", fontFamily: '"Google Sans", Roboto, sans-serif', lineHeight: 1.2, margin: 0 }}>Job Agent</h1>
              <p style={{ fontSize: 11, color: "#5f6368", margin: 0 }}>AI cover email automation</p>
            </div>
          </div>
          <nav className="flex items-center gap-2">
            <Link href="/" className="btn-ghost" style={{ textDecoration: "none", fontSize: 13, padding: "7px 16px" }}>
              Apply
            </Link>
            <Link href="/dashboard" className="btn-ghost" style={{ textDecoration: "none", fontSize: 13, padding: "7px 16px" }}>
              Dashboard
            </Link>
            <Link href="/profile" className="btn-primary" style={{ textDecoration: "none", fontSize: 13, padding: "7px 16px" }}>
              Profile
            </Link>
          </nav>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-10">
        {/* Page heading */}
        <div className="text-center mb-10">
          <h2 style={{ fontSize: 32, fontWeight: 700, color: "#202124", fontFamily: '"Google Sans", Roboto, sans-serif', marginBottom: 12 }}>Your Profile</h2>
          <p style={{ color: "#5f6368", fontSize: 15, lineHeight: 1.6 }}>
            Upload your resume, cover letter, portfolio, or any profile documents.
            <br />
            The AI uses these to write personalized cover emails.
          </p>
          <p style={{ fontSize: 13, color: "#9e9e9e", marginTop: 8 }}>
            Uploading new files <strong style={{ color: "#c5221f" }}>replaces</strong> the existing profile.
          </p>
        </div>

        {/* Current profile status banner */}
        {currentStatus && !result && (
          <div className="glass-card fade-in" style={{ padding: 20, marginBottom: 24, borderColor: "#a8d5b5", background: "#e6f4ea" }}>
            <div className="flex items-start gap-3">
              <span style={{ fontSize: 24 }}>🧠</span>
              <div className="flex-1">
                <p style={{ fontWeight: 600, color: "#202124", fontSize: 14, fontFamily: '"Google Sans", Roboto, sans-serif' }}>
                  Profile active — {currentStatus.chunks} chunks in AI memory
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {currentStatus.sources.map((src) => (
                    <span key={src} style={{ fontSize: 12, padding: "2px 10px", borderRadius: 12, background: "#fff", color: "#1e8e3e", border: "1px solid #a8d5b5" }}>
                      {fileIcon(src)} {src}
                    </span>
                  ))}
                </div>
                <p style={{ fontSize: 12, color: "#5f6368", marginTop: 8 }}>Upload new files below to replace this profile.</p>
              </div>
            </div>
          </div>
        )}

        {/* Uploaded Attachments Section */}
        {uploadsStatus && (uploadsStatus.resume.uploaded || uploadsStatus.cover_letter.uploaded) && (
          <div className="glass-card fade-in" style={{ padding: 20, marginBottom: 24, borderColor: "#c9d9fa", background: "#e8f0fe" }}>
            <p style={{ fontWeight: 600, color: "#202124", fontSize: 14, fontFamily: '"Google Sans", Roboto, sans-serif', marginBottom: 12 }}>📎 Email Attachments</p>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between rounded px-4 py-3" style={{ background: "#fff", border: "1px solid #dadce0" }}>
                <div className="flex items-center gap-3">
                  <span style={{ fontSize: 20 }}>📄</span>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 500, color: "#202124" }}>Resume</p>
                    <p style={{ fontSize: 12, color: uploadsStatus.resume.uploaded ? "#1e8e3e" : "#9e9e9e" }}>
                      {uploadsStatus.resume.uploaded ? `✓ Uploaded (${formatSize(uploadsStatus.resume.size_bytes)})` : "✕ Not uploaded"}
                    </p>
                  </div>
                </div>
                {uploadsStatus.resume.uploaded && (
                  <button onClick={async () => { await deleteUploadedFile("resume"); loadUploadsStatus(); }}
                    style={{ fontSize: 12, padding: "4px 12px", borderRadius: 4, color: "#c5221f", border: "1px solid #f5c6c5", background: "none", cursor: "pointer" }}>Remove</button>
                )}
              </div>
              <div className="flex items-center justify-between rounded px-4 py-3" style={{ background: "#fff", border: "1px solid #dadce0" }}>
                <div className="flex items-center gap-3">
                  <span style={{ fontSize: 20 }}>✉️</span>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 500, color: "#202124" }}>Cover Letter</p>
                    <p style={{ fontSize: 12, color: uploadsStatus.cover_letter.uploaded ? "#1e8e3e" : "#9e9e9e" }}>
                      {uploadsStatus.cover_letter.uploaded ? `✓ Uploaded (${formatSize(uploadsStatus.cover_letter.size_bytes)})` : "✕ Not uploaded (optional)"}
                    </p>
                  </div>
                </div>
                {uploadsStatus.cover_letter.uploaded && (
                  <button onClick={async () => { await deleteUploadedFile("cover_letter"); loadUploadsStatus(); }}
                    style={{ fontSize: 12, padding: "4px 12px", borderRadius: 4, color: "#c5221f", border: "1px solid #f5c6c5", background: "none", cursor: "pointer" }}>Remove</button>
                )}
              </div>
            </div>
            <p style={{ fontSize: 12, color: "#5f6368", marginTop: 12 }}>These files are attached when sending cover emails.</p>
          </div>
        )}

        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`upload-zone mb-6 ${dragging ? "dragging" : ""}`}
          style={{ minHeight: 180 }}
        >
          <input ref={inputRef} type="file" multiple accept={ACCEPTED_EXT} className="hidden" onChange={handleFileInput} />
          <div className="flex flex-col items-center justify-center gap-3 p-10">
            <div style={{ fontSize: 48, transform: dragging ? "scale(1.15)" : "scale(1)", transition: "transform 0.2s" }}>📂</div>
            <p style={{ fontWeight: 500, fontSize: 16, color: "#202124", fontFamily: '"Google Sans", Roboto, sans-serif' }}>Drop your profile files here</p>
            <p style={{ fontSize: 13, color: "#5f6368" }}>PDF, DOCX, TXT, MD supported</p>
            <button className="btn-ghost" style={{ fontSize: 13 }}>Browse Files</button>
          </div>
        </div>

        {/* File list */}
        {files.length > 0 && (
          <div className="glass-card fade-in" style={{ padding: 20, marginBottom: 24 }}>
            <div className="flex items-center justify-between mb-4">
              <p style={{ fontWeight: 500, fontSize: 14, color: "#202124", fontFamily: '"Google Sans", Roboto, sans-serif' }}>
                {files.length} file{files.length > 1 ? "s" : ""} selected
              </p>
              <button onClick={() => setFiles([])} style={{ fontSize: 12, color: "#ea4335", background: "none", border: "none", cursor: "pointer" }}>Clear all</button>
            </div>
            <div className="flex flex-col gap-2">
              {files.map((file) => (
                <div key={file.name} className="flex items-center justify-between rounded px-4 py-3" style={{ background: "#f8f9fa", border: "1px solid #e0e0e0" }}>
                  <div className="flex items-center gap-3 min-w-0">
                    <span style={{ fontSize: 20, flexShrink: 0 }}>{fileIcon(file.name)}</span>
                    <div className="min-w-0">
                      <p style={{ fontSize: 14, fontWeight: 500, color: "#202124", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.name}</p>
                      <p style={{ fontSize: 12, color: "#9e9e9e" }}>{formatSize(file.size)}</p>
                    </div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); removeFile(file.name); }} style={{ color: "#9e9e9e", background: "none", border: "none", cursor: "pointer", fontSize: 14 }}>✕</button>
                </div>
              ))}
            </div>
            <button className="btn-primary w-full mt-4 flex items-center justify-center gap-3" onClick={handleIngest} disabled={loading} style={{ padding: "10px 0", fontSize: 14 }}>
              {loading ? (<><div className="spinner" /> Ingesting...</>) : (<><span>🧠</span><span>Update Profile</span></>)}
            </button>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="fade-in" style={{ background: "#fce8e6", border: "1px solid #f5c6c5", borderRadius: 8, padding: 14, marginBottom: 24, fontSize: 13, color: "#c5221f" }}>
            ⚠ {error}
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="glass-card fade-in" style={{ padding: 24, borderColor: isSuccess ? "#a8d5b5" : "#fce39e", background: isSuccess ? "#e6f4ea" : "#fef7e0" }}>
            <div className="flex items-start gap-4">
              <div style={{ fontSize: 28 }}>{isSuccess ? "✅" : "⚠️"}</div>
              <div className="flex-1">
                <p style={{ fontWeight: 600, fontFamily: '"Google Sans", Roboto, sans-serif', color: "#202124", marginBottom: 8 }}>{result.message}</p>
                {result.sources?.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "#5f6368", marginBottom: 8 }}>Ingested files</p>
                    <div className="flex flex-col gap-1">
                      {result.sources.map((src) => (
                        <div key={src} className="flex items-center gap-2">
                          <span style={{ fontSize: 14 }}>{fileIcon(src)}</span>
                          <span style={{ fontSize: 13, color: "#5f6368" }}>{src}</span>
                          <span className="badge badge-approved" style={{ marginLeft: "auto" }}>✓</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {result.skipped && result.skipped.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "#5f6368", marginBottom: 8 }}>Skipped</p>
                    {result.skipped.map((src) => (<p key={src} style={{ fontSize: 13, color: "#b06000" }}>⚠ {src}</p>))}
                  </div>
                )}
                <div style={{ marginTop: 16 }}><span className="badge badge-drafted">{result.chunks_ingested} chunks in AI memory</span></div>
                {isSuccess && (
                  <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #dadce0" }}>
                    <p style={{ fontSize: 13, color: "#5f6368" }}>Ready! Go to the <Link href="/" style={{ color: "#1a73e8", textDecoration: "none" }}>Apply tab</Link> to upload job screenshots.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tip box */}
        {files.length === 0 && !result && (
          <div className="glass-card fade-in" style={{ padding: 20 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "#5f6368", marginBottom: 12, fontFamily: '"Google Sans", Roboto, sans-serif' }}>Recommended files to upload</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { icon: "📄", label: "Resume PDF", hint: "Your most important file" },
                { icon: "✉", label: "Cover Letter", hint: "Optional base template" },
                { icon: "💼", label: "Portfolio summary", hint: "Projects you've worked on" },
                { icon: "🔗", label: "LinkedIn export", hint: "Download from LinkedIn settings" },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-3 rounded px-4 py-3" style={{ background: "#f8f9fa", border: "1px solid #e0e0e0" }}>
                  <span style={{ fontSize: 22 }}>{item.icon}</span>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 500, color: "#202124" }}>{item.label}</p>
                    <p style={{ fontSize: 12, color: "#9e9e9e" }}>{item.hint}</p>
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
