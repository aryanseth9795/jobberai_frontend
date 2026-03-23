"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import DraftCard from "@/components/DraftCard";
import { applyUnified, confirmBatch, regenerateBatch, DraftResponse, BatchResponse, SendResult } from "@/lib/api";

type Step = "upload" | "review" | "results";
type PipelineStage = "idle" | "active" | "done" | "error";

interface DraftState {
  draft: DraftResponse;
  approved: boolean;
}

interface PipelineStep {
  id: string;
  label: string;
  sublabel: string;
  icon: string;
  state: PipelineStage;
}

const INIT_PIPELINE: PipelineStep[] = [
  { id: "ingest",   label: "Ingest",   sublabel: "Read job data",    icon: "📥", state: "idle" },
  { id: "extract",  label: "Extract",  sublabel: "Parse structure",  icon: "🔍", state: "idle" },
  { id: "dedup",    label: "Dedup",    sublabel: "Check history",    icon: "🔄", state: "idle" },
  { id: "rag",      label: "Profile",  sublabel: "Retrieve context", icon: "🧠", state: "idle" },
  { id: "generate", label: "Draft",    sublabel: "Write email",      icon: "✉",  state: "idle" },
];

// Google-style stepper pipeline
function AgentPipeline({ steps }: { steps: PipelineStep[] }) {
  return (
    <div className="flex items-center gap-0 w-full">
      {steps.map((step, i) => (
        <div key={step.id} className="flex items-center flex-1">
          {/* Node */}
          <div className="pipeline-node" style={{ minWidth: 64 }}>
            <div className={`pipeline-node-dot ${step.state}`}>
              {step.state === "done"
                ? <span style={{ fontSize: 14 }}>✓</span>
                : step.state === "error"
                ? <span style={{ fontSize: 14 }}>!</span>
                : <span style={{ fontSize: 14 }}>{step.icon}</span>
              }
            </div>
            <span style={{ fontSize: 10, color: "#5f6368", textAlign: "center", fontFamily: '"Google Sans", Roboto, sans-serif', letterSpacing: 0 }}>
              {step.label}
            </span>
          </div>
          {/* Connector */}
          {i < steps.length - 1 && (
            <div
              className={`pipeline-connector ${step.state === "done" ? "done" : step.state === "active" ? "active" : ""}`}
              style={{ height: 2 }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

export default function Home() {
  const [step, setStep]           = useState<Step>("upload");
  const [jobText, setJobText]     = useState("");
  const [loading, setLoading]     = useState(false);
  const [sending, setSending]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [batchId, setBatchId]     = useState("");
  const [draftStates, setDraftStates] = useState<DraftState[]>([]);
  const [results, setResults]     = useState<SendResult[]>([]);
  const [attachResume, setAttachResume]           = useState(true);
  const [attachCoverLetter, setAttachCoverLetter] = useState(true);
  const [files, setFiles]         = useState<File[]>([]);
  const [dragging, setDragging]   = useState(false);
  const [pipeline, setPipeline]   = useState<PipelineStep[]>(INIT_PIPELINE);
  const [statusMsg, setStatusMsg] = useState("Ready — upload job screenshots to get started");
  const [batchFeedback, setBatchFeedback] = useState("");
  const [regenerating, setRegenerating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const activatePipeline = async () => {
    const stages = ["ingest", "extract", "dedup", "rag", "generate"];
    for (let i = 0; i < stages.length; i++) {
      const id = stages[i];
      setPipeline(prev => prev.map(s => s.id === id ? { ...s, state: "active" } : s));
      const msgs: Record<string, string> = {
        ingest:   "Reading job screenshots...",
        extract:  "Extracting job information...",
        dedup:    "Checking application history...",
        rag:      "Retrieving profile context...",
        generate: "Drafting personalised cover email...",
      };
      setStatusMsg(msgs[id]);
      await new Promise(r => setTimeout(r, 600));
      setPipeline(prev => prev.map(s => s.id === id ? { ...s, state: "done" } : s));
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const dropped = Array.from(e.dataTransfer.files);
    setFiles(prev => {
      const map = new Map(prev.map(f => [f.name, f]));
      dropped.forEach(f => map.set(f.name, f));
      return Array.from(map.values());
    });
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    setFiles(prev => {
      const map = new Map(prev.map(f => [f.name, f]));
      selected.forEach(f => map.set(f.name, f));
      return Array.from(map.values());
    });
    e.target.value = "";
  };

  // Paste support
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const pastedFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === "file") {
          const file = item.getAsFile();
          if (file) {
            const ext = file.type.split("/")[1] || "png";
            const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
            const named = new File([file], `pasted-screenshot-${timestamp}.${ext}`, { type: file.type });
            pastedFiles.push(named);
          }
        }
      }
      if (pastedFiles.length > 0) {
        setFiles(prev => {
          const map = new Map(prev.map(f => [f.name, f]));
          pastedFiles.forEach(f => map.set(f.name, f));
          return Array.from(map.values());
        });
        setStatusMsg(`${pastedFiles.length} screenshot(s) pasted from clipboard`);
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, []);

  const removeFile = (name: string) => setFiles(prev => prev.filter(f => f.name !== name));

  const handleProcess = async () => {
    if (!jobText.trim() && files.length === 0) return;
    setLoading(true);
    setError(null);
    setPipeline(INIT_PIPELINE.map(s => ({ ...s, state: "idle" })));
    activatePipeline();
    try {
      const response: BatchResponse = await applyUnified(jobText, files);
      setBatchId(response.batch_id);
      setDraftStates(
        response.drafts.map(d => ({ draft: d, approved: d.draft_status === "drafted" }))
      );
      setStatusMsg(`Done — ${response.drafts.length} job(s) processed`);
      setBatchFeedback("");
      setStep("review");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Processing failed");
      setStatusMsg("Something went wrong — please try again");
      setPipeline(prev => prev.map(s => s.state === "active" ? { ...s, state: "error" } : s));
    } finally {
      setLoading(false);
    }
  };

  const handleToggleApprove = (draftId: string, approved: boolean) => {
    setDraftStates(prev => prev.map(ds => ds.draft.draft_id === draftId ? { ...ds, approved } : ds));
  };

  const handleUpdateEmail = (draftId: string, hrEmail: string, subject: string, body: string) => {
    setDraftStates(prev =>
      prev.map(ds =>
        ds.draft.draft_id === draftId
          ? { ...ds, draft: { ...ds.draft, job_info: { ...ds.draft.job_info, hr_email: hrEmail }, cover_email: { subject, body } } }
          : ds
      )
    );
  };

  const handleSendAll = async () => {
    const approved = draftStates.filter(ds => ds.approved && ds.draft.cover_email);
    if (approved.length === 0) return;
    setSending(true);
    setError(null);
    setStatusMsg(`Sending ${approved.length} application(s)...`);
    try {
      const response = await confirmBatch(
        batchId,
        approved.map(ds => ({
          draft_id: ds.draft.draft_id,
          cover_email: ds.draft.cover_email!,
          hr_email: ds.draft.job_info.hr_email,
          attach_resume: attachResume,
          attach_cover_letter: attachCoverLetter,
        }))
      );
      setResults(response.results);
      const sent = response.results.filter(r => r.status === "sent").length;
      setStatusMsg(`${sent} email(s) sent successfully`);
      setStep("results");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Sending failed");
      setStatusMsg("Failed to send — please check your settings");
    } finally {
      setSending(false);
    }
  };

  const handleRegenerateBatch = async () => {
    if (!batchFeedback.trim()) return;
    setRegenerating(true);
    setError(null);
    setStatusMsg("Regenerating drafts based on your feedback...");
    
    try {
      const response = await regenerateBatch(batchId, batchFeedback);
      
      // Update the complete list of drafts returned by the LLM
      setDraftStates(
        response.drafts.map(d => ({ draft: d, approved: d.draft_status === "drafted" }))
      );
      
      setStatusMsg(`Done — ${response.drafts.length} job(s) updated`);
      setBatchFeedback("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Regeneration failed");
      setStatusMsg("Failed to regenerate drafts — please try again");
    } finally {
      setRegenerating(false);
    }
  };

  const reset = () => {
    setStep("upload");
    setFiles([]);
    setJobText("");
    setDraftStates([]);
    setResults([]);
    setError(null);
    setPipeline(INIT_PIPELINE.map(s => ({ ...s, state: "idle" })));
    setStatusMsg("Ready — upload job screenshots to get started");
  };

  const approvedCount  = draftStates.filter(ds => ds.approved).length;
  const duplicateCount = draftStates.filter(ds => ds.draft.draft_status === "duplicate").length;
  const sentCount      = results.filter(r => r.status === "sent").length;
  const failedCount    = results.filter(r => r.status === "failed").length;

  const formatSize = (b: number) => b < 1048576 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1048576).toFixed(1)} MB`;

  const stepIndex = step === "upload" ? 0 : step === "review" ? 1 : 2;

  return (
    <>
      <main
        className="min-h-screen flex flex-col"
        style={{ background: "#f6f8fc" }}
      >
        {/* ─── HEADER ─── */}
        <header
          style={{
            background: "#ffffff",
            borderBottom: "1px solid #e0e0e0",
            position: "sticky",
            top: 0,
            zIndex: 40,
          }}
        >
          <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
            {/* Logo */}
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
                <p style={{ fontSize: 11, color: "#5f6368", fontFamily: "Roboto, sans-serif" }}>
                  AI cover email automation
                </p>
              </div>
            </div>

            {/* Step breadcrumb */}
            <div className="hidden md:flex items-center gap-2">
              {(["Upload", "Review", "Send"] as const).map((label, i) => (
                <div key={label} className="flex items-center gap-2">
                  {i > 0 && <div style={{ width: 24, height: 1, background: i <= stepIndex ? "#1a73e8" : "#e0e0e0" }} />}
                  <div className="flex items-center gap-1.5">
                    <div
                      style={{
                        width: 20, height: 20, borderRadius: "50%",
                        background: i < stepIndex ? "#1e8e3e" : i === stepIndex ? "#1a73e8" : "#e0e0e0",
                        color: i >= stepIndex && i !== stepIndex ? "#9e9e9e" : "#fff",
                        fontSize: 11, fontWeight: 600,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}
                    >
                      {i < stepIndex ? "✓" : i + 1}
                    </div>
                    <span style={{ fontSize: 13, fontFamily: '"Google Sans", Roboto, sans-serif', color: i === stepIndex ? "#1a73e8" : i < stepIndex ? "#1e8e3e" : "#9e9e9e", fontWeight: i === stepIndex ? 600 : 400 }}>
                      {label}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Nav */}
            <nav className="flex gap-2">
              <Link href="/" className="btn-primary" style={{ textDecoration: "none", padding: "7px 16px", fontSize: 13 }}>Mail</Link>
              <Link href="/forms" className="btn-ghost" style={{ textDecoration: "none", padding: "7px 16px", fontSize: 13 }}>Forms</Link>
              <Link href="/scraping" className="btn-ghost" style={{ textDecoration: "none", padding: "7px 16px", fontSize: 13 }}>Scraping</Link>
              <div style={{ width: 1, backgroundColor: "#e0e0e0", margin: "0 4px" }} />
              <Link href="/dashboard" className="btn-ghost" style={{ textDecoration: "none", padding: "7px 16px", fontSize: 13 }}>Dashboard</Link>
              <Link href="/profile" className="btn-ghost" style={{ textDecoration: "none", padding: "7px 16px", fontSize: 13 }}>Profile</Link>
            </nav>
          </div>

          {/* Status bar */}
          {(loading || statusMsg !== "Ready — upload job screenshots to get started") && (
            <div style={{ background: "#f8f9fa", borderTop: "1px solid #e0e0e0", padding: "6px 24px" }}>
              <div className="max-w-5xl mx-auto flex items-center gap-2">
                {loading ? (
                  <div className="spinner-blue" style={{ width: 12, height: 12, border: "2px solid #e8f0fe", borderTopColor: "#1a73e8" }} />
                ) : (
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#1e8e3e", display: "inline-block" }} />
                )}
                <span style={{ fontSize: 12, color: "#5f6368", fontFamily: "Roboto, sans-serif" }}>{statusMsg}</span>
              </div>
            </div>
          )}
        </header>

        {/* ─── AGENT PIPELINE ─── */}
        {loading && (
          <div
            className="fade-in"
            style={{ background: "#fff", borderBottom: "1px solid #e0e0e0", padding: "16px 24px" }}
          >
            <div className="max-w-5xl mx-auto">
              <p style={{ fontSize: 11, color: "#5f6368", fontFamily: "Roboto, sans-serif", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>
                AI Agent Pipeline
              </p>
              <AgentPipeline steps={pipeline} />
            </div>
          </div>
        )}

        <div className="flex-1 max-w-5xl w-full mx-auto px-6 py-8">

          {/* ═══════════════ STEP 1: UPLOAD ═══════════════ */}
          {step === "upload" && (
            <div className="fade-in">

              {/* Hero */}
              <div className="text-center mb-8">
                <h1
                  style={{
                    fontSize: 36,
                    fontWeight: 700,
                    color: "#202124",
                    fontFamily: '"Google Sans", Roboto, sans-serif',
                    marginBottom: 12,
                    letterSpacing: "-0.01em",
                  }}
                >
                  Job Details
                </h1>
                <p style={{ color: "#5f6368", fontSize: 16, maxWidth: 520, margin: "0 auto", lineHeight: 1.6 }}>
                  Paste job descriptions, requirements, or link references—and optionally attach screenshots or PDFs. The AI will extract details and draft a personalised cover email.
                </p>
              </div>

              {/* Unified Upload zone / Text input */}
              <div className="mb-6 fade-in" style={{ position: "relative" }}>
                 <div
                   className={`upload-zone ${dragging ? "dragging" : ""}`}
                   onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                   onDragLeave={() => setDragging(false)}
                   onDrop={handleDrop}
                   style={{
                     borderRadius: 12,
                     border: dragging ? "2px dashed #1a73e8" : "2px solid #e0e0e0",
                     background: dragging ? "#f8fbff" : "#fff",
                     padding: "20px",
                     transition: "all 0.2s"
                   }}
                 >
                   <textarea
                     value={jobText}
                     onChange={(e) => setJobText(e.target.value)}
                     placeholder="Message Job Agent... (Paste job description, company details, or drop screenshots here)"
                     style={{
                       width: "100%", minHeight: 120,
                       border: "none", background: "transparent",
                       fontSize: 15, color: "#202124", fontFamily: "Roboto, sans-serif",
                       resize: "vertical", outline: "none",
                     }}
                   />
                   
                   <div className="flex items-center justify-between mt-4">
                     {/* Attachment button */}
                     <button
                       onClick={() => inputRef.current?.click()}
                       style={{
                         display: "flex", alignItems: "center", gap: 8,
                         padding: "8px 16px", borderRadius: 20,
                         background: "#f1f3f4", color: "#5f6368",
                         fontSize: 13, fontWeight: 500, border: "none", cursor: "pointer",
                       }}
                       className="hover:opacity-80 transition-opacity"
                     >
                       <span style={{ fontSize: 16 }}>📎</span> Attach files
                     </button>
                     <input ref={inputRef} type="file" multiple accept=".png,.jpg,.jpeg,.webp,.pdf" className="hidden" onChange={handleFileInput} />
                     
                     <span style={{ fontSize: 12, color: "#9e9e9e", pointerEvents: "none" }}>
                       {dragging ? "Drop files now" : "Drag & drop files above"}
                     </span>
                   </div>
                 </div>
                 
                 {/* File previews */}
                 {files.length > 0 && (
                   <div className="mt-4 flex gap-2 flex-wrap">
                     {files.map((f, i) => (
                       <div key={i + f.name} className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background: "#e8f0fe", border: "1px solid #d2e3fc" }}>
                         <span style={{ fontSize: 14 }}>{f.name.endsWith(".pdf") ? "📄" : "🖼"}</span>
                         <span style={{ fontSize: 12, color: "#1a73e8", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                         <button onClick={() => removeFile(f.name)} style={{ color: "#1a73e8", background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: 14, marginLeft: 4 }}>✕</button>
                       </div>
                     ))}
                   </div>
                 )}

                 <button
                   className="btn-primary w-full mt-6 flex items-center justify-center gap-3"
                   onClick={handleProcess}
                   disabled={loading || (!jobText.trim() && files.length === 0)}
                   style={{ padding: "12px 0", fontSize: 15, borderRadius: 24 }}
                 >
                   {loading ? (
                     <><div className="spinner" /> Processing Context...</>
                   ) : (
                     <>✨ Generate Cover Email{files.length > 1 && !jobText.trim() ? "s" : ""}</>
                   )}
                 </button>
              </div>

              {error && (
                <div
                  className="hud-card fade-in mb-4"
                  style={{ padding: 12, borderColor: "#ea4335", background: "#fce8e6", borderRadius: 8 }}
                >
                  <p style={{ fontSize: 13, color: "#c5221f", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 16 }}>⚠</span> {error}
                  </p>
                </div>
              )}

              {/* Feature cards */}
              {files.length === 0 && !jobText.trim() && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
                  {[
                    { icon: "🔍", title: "Multimodal Agent", desc: "Paste text or drop screenshots. The AI natively merges all context into a single job understanding." },
                    { icon: "🧠", title: "RAG Profile",      desc: "Fetches your most relevant skills and projects from vector memory automatically." },
                    { icon: "✉",  title: "Auto Draft",      desc: "Generates personalised, non-generic cover emails using your real experience." },
                  ].map(item => (
                    <div key={item.title} className="hud-card" style={{ padding: 20 }}>
                       <span style={{ fontSize: 24 }}>{item.icon}</span>
                       <p style={{ fontWeight: 500, fontSize: 14, color: "#202124", margin: "8px 0 4px", fontFamily: '"Google Sans", Roboto, sans-serif' }}>{item.title}</p>
                       <p style={{ fontSize: 13, color: "#5f6368", lineHeight: 1.6 }}>{item.desc}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ═══════════════ STEP 2: REVIEW ═══════════════ */}
          {step === "review" && (
            <div className="fade-in">

              {/* Stats bar */}
              <div
                className="hud-card mb-6"
                style={{ padding: "16px 20px" }}
              >
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex gap-8 flex-wrap">
                    <div className="stat-block">
                      <span className="stat-value">{draftStates.length}</span>
                      <span className="stat-label">Jobs found</span>
                    </div>
                    <div className="stat-block">
                      <span className="stat-value" style={{ color: "#1e8e3e" }}>{approvedCount}</span>
                      <span className="stat-label">Approved</span>
                    </div>
                    <div className="stat-block">
                      <span className="stat-value" style={{ color: "#ea4335" }}>{draftStates.length - approvedCount}</span>
                      <span className="stat-label">Skipped</span>
                    </div>
                    <div className="stat-block">
                      <span className="stat-value" style={{ color: "#b06000" }}>{duplicateCount}</span>
                      <span className="stat-label">Duplicates</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-wrap">
                    {/* Attachment toggles */}
                    <div className="flex flex-col gap-1">
                      <label className="flex items-center gap-2 cursor-pointer" style={{ fontSize: 13, color: "#5f6368", fontFamily: "Roboto, sans-serif" }}>
                        <input type="checkbox" checked={attachResume} onChange={e => setAttachResume(e.target.checked)} style={{ accentColor: "#1a73e8" }} />
                        Attach Resume
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer" style={{ fontSize: 13, color: "#5f6368", fontFamily: "Roboto, sans-serif" }}>
                        <input type="checkbox" checked={attachCoverLetter} onChange={e => setAttachCoverLetter(e.target.checked)} style={{ accentColor: "#1a73e8" }} />
                        Attach Cover Letter
                      </label>
                    </div>

                    <div style={{ width: 1, height: 32, background: "#e0e0e0" }} className="hidden sm:block" />
                    <button className="btn-ghost" style={{ fontSize: 13 }} onClick={reset}>↩ Reset</button>
                    <button
                      className="btn-success flex items-center gap-2"
                      onClick={handleSendAll}
                      disabled={approvedCount === 0 || sending}
                      style={{ fontSize: 13 }}
                    >
                      {sending
                        ? <><div className="spinner" /> Sending...</>
                        : <>✉ Send {approvedCount} Email{approvedCount !== 1 ? "s" : ""}</>
                      }
                    </button>
                  </div>
                </div>
              </div>

              {error && (
                <div className="hud-card fade-in mb-4" style={{ padding: 12, borderColor: "#ea4335", background: "#fce8e6" }}>
                  <p style={{ fontSize: 13, color: "#c5221f" }}>⚠ {error}</p>
                </div>
              )}

              {/* Batch feedback input */}
              <div className="hud-card mb-6 p-4 fade-in" style={{ borderColor: regenerating ? "#1a73e8" : "#dadce0" }}>
                <p style={{ fontSize: 13, fontWeight: 500, color: "#202124", marginBottom: 8 }}>
                  Agent Feedback <span style={{ color: "#5f6368", fontWeight: 400 }}>(Tell the AI to merge, delete, or modify specific drafts)</span>
                </p>
                <div className="flex items-start gap-3 relative">
                  <div style={{ flexShrink: 0, width: 32, height: 32, borderRadius: "50%", background: "#e8f0fe", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>
                    🤖
                  </div>
                  <div className="flex-1 relative">
                    <textarea
                      value={batchFeedback}
                      onChange={(e) => setBatchFeedback(e.target.value)}
                      placeholder='e.g., "Draft 1 and Draft 2 are the same job, please merge them into a single draft and drop the other."'
                      style={{
                        width: "100%",
                        minHeight: 64,
                        padding: "12px 14px",
                        fontSize: 14,
                        color: "#202124",
                        border: "1px solid #dadce0",
                        borderRadius: 8,
                        outline: "none",
                        fontFamily: "Roboto, sans-serif",
                        resize: "vertical",
                        background: regenerating ? "#f1f3f4" : "#fff",
                      }}
                      disabled={regenerating || sending}
                    />
                    <div className="flex justify-end mt-2">
                       <button
                        className="btn-primary flex items-center gap-2"
                        onClick={handleRegenerateBatch}
                        disabled={regenerating || sending || !batchFeedback.trim()}
                        style={{ padding: "8px 20px", fontSize: 13, borderRadius: 16 }}
                      >
                        {regenerating ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Regenerating...</> : <>✨ Update Drafts</>}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Dim drafts slightly while regenerating */}
              <div className="flex flex-col gap-4" style={{ opacity: regenerating ? 0.6 : 1, transition: "opacity 0.2s", pointerEvents: regenerating ? "none" : "auto" }}>
                {draftStates.map((ds, index) => (
                  <div key={ds.draft.draft_id} style={{ position: "relative" }}>
                     {/* Floating index badge to help user reference drafts by number */}
                     <div style={{ 
                        position: "absolute", 
                        top: -10, left: -10, 
                        background: "#1a73e8", color: "#fff", 
                        width: 28, height: 28, borderRadius: "50%", 
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 12, fontWeight: 600,
                        boxShadow: "0 2px 6px rgba(26,115,232,0.3)",
                        zIndex: 10,
                     }}>
                       #{index + 1}
                     </div>
                     <DraftCard
                       draft={ds.draft}
                       approved={ds.approved}
                       onToggleApprove={handleToggleApprove}
                       onUpdateEmail={handleUpdateEmail}
                     />
                  </div>
                ))}
              </div>

              {approvedCount > 0 && (
                <div className="sticky bottom-6 mt-6 flex justify-end">
                  <button
                    className="btn-success flex items-center gap-2"
                    onClick={handleSendAll}
                    disabled={sending}
                    style={{ boxShadow: "0 4px 12px rgba(30,142,62,0.3)", fontSize: 14, padding: "10px 28px", borderRadius: 20 }}
                  >
                    {sending ? <><div className="spinner" /> Sending...</> : <>✉ Send {approvedCount} Email{approvedCount !== 1 ? "s" : ""}</>}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ═══════════════ STEP 3: RESULTS ═══════════════ */}
          {step === "results" && (
            <div className="fade-in text-center">
              <div className="mb-8">
                <div
                  style={{
                    width: 72, height: 72,
                    margin: "0 auto 20px",
                    borderRadius: "50%",
                    background: failedCount === 0 ? "#e6f4ea" : "#fef7e0",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 32,
                  }}
                >
                  {failedCount === 0 ? "✅" : "⚠️"}
                </div>
                <h2 style={{ fontSize: 28, fontWeight: 600, color: "#202124", fontFamily: '"Google Sans", Roboto, sans-serif', marginBottom: 8 }}>
                  {failedCount === 0 ? "All emails sent!" : "Partially sent"}
                </h2>
                <p style={{ color: "#5f6368", fontSize: 15 }}>
                  {sentCount} delivered{failedCount > 0 ? ` · ${failedCount} failed` : ""}
                </p>
              </div>

              <div className="flex flex-col gap-3 text-left mb-8 max-w-xl mx-auto">
                {results.map(r => {
                  const ds = draftStates.find(d => d.draft.draft_id === r.draft_id);
                  return (
                    <div
                      key={r.draft_id}
                      className="hud-card flex items-center justify-between gap-4"
                      style={{
                        padding: 16,
                        borderColor: r.status === "sent" ? "#a8d5b5" : "#f5c6c5",
                        background: r.status === "sent" ? "#e6f4ea" : "#fce8e6",
                      }}
                    >
                      <div className="text-left min-w-0">
                        <p style={{ fontWeight: 500, fontSize: 14, color: "#202124", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {ds?.draft.job_info.role || "—"} @ {ds?.draft.job_info.company_name || "—"}
                        </p>
                        <p style={{ fontSize: 12, color: "#5f6368", marginTop: 2 }}>{ds?.draft.job_info.hr_email || ""}</p>
                        {r.error && <p style={{ fontSize: 12, color: "#c5221f", marginTop: 4 }}>{r.error}</p>}
                      </div>
                      <span className={`badge ${r.status === "sent" ? "badge-approved" : "badge-rejected"} shrink-0`}>
                        {r.status === "sent" ? "✓ Sent" : "✕ Failed"}
                      </span>
                    </div>
                  );
                })}
              </div>

              <button
                className="btn-primary"
                onClick={reset}
                style={{ padding: "10px 32px", fontSize: 14, borderRadius: 20 }}
              >
                ↩ Start over
              </button>
            </div>
          )}
        </div>

        {/* ─── FOOTER ─── */}
        <footer style={{ borderTop: "1px solid #e0e0e0", background: "#ffffff", marginTop: "auto" }}>
          <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span style={{ fontSize: 12, color: "#9e9e9e", fontFamily: "Roboto, sans-serif" }}>Job Agent</span>
              <span style={{ color: "#e0e0e0" }}>·</span>
              <span style={{ fontSize: 12, color: "#9e9e9e" }}>Gemini 2.5 Flash</span>
            </div>
            <div className="flex items-center gap-2">
              <span style={{ fontSize: 12, color: "#9e9e9e" }}>ChromaDB connected</span>
              <span className="live-dot" />
            </div>
          </div>
        </footer>
      </main>
    </>
  );
}