"use client";

import { useState } from "react";
import Link from "next/link";
import FileUploader from "@/components/FileUploader";
import DraftCard from "@/components/DraftCard";
import { applyBatch, confirmBatch, DraftResponse, BatchResponse, SendResult } from "@/lib/api";

type Step = "upload" | "review" | "results";

interface DraftState {
  draft: DraftResponse;
  approved: boolean; // false by default for duplicates/errors
}

export default function Home() {
  const [step, setStep] = useState<Step>("upload");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [batchId, setBatchId] = useState<string>("");
  const [draftStates, setDraftStates] = useState<DraftState[]>([]);
  const [results, setResults] = useState<SendResult[]>([]);
  const [attachResume, setAttachResume] = useState(true);

  // Step 1: Upload and draft
  const handleFilesSelected = async (files: File[]) => {
    setLoading(true);
    setError(null);
    try {
      const response: BatchResponse = await applyBatch(files);
      setBatchId(response.batch_id);
      setDraftStates(
        response.drafts.map((d) => ({
          draft: d,
          // Auto-approve drafted, auto-reject duplicates/errors
          approved: d.draft_status === "drafted",
        }))
      );
      setStep("review");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to process files");
    } finally {
      setLoading(false);
    }
  };

  // Toggle approve/reject
  const handleToggleApprove = (draftId: string, approved: boolean) => {
    setDraftStates((prev) =>
      prev.map((ds) =>
        ds.draft.draft_id === draftId ? { ...ds, approved } : ds
      )
    );
  };

  // Update email content (after editing)
  const handleUpdateEmail = (draftId: string, hrEmail: string, subject: string, body: string) => {
    setDraftStates((prev) =>
      prev.map((ds) =>
        ds.draft.draft_id === draftId
          ? {
              ...ds,
              draft: {
                ...ds.draft,
                job_info: {
                  ...ds.draft.job_info,
                  hr_email: hrEmail,
                },
                cover_email: { subject, body },
              },
            }
          : ds
      )
    );
  };

  // Step 2 → Step 3: Confirm and send
  const handleSendAll = async () => {
    const approved = draftStates.filter(
      (ds) => ds.approved && ds.draft.cover_email
    );
    if (approved.length === 0) return;

    setSending(true);
    setError(null);
    try {
      const response = await confirmBatch(
        batchId,
        approved.map((ds) => ({
          draft_id: ds.draft.draft_id,
          cover_email: ds.draft.cover_email!,
          hr_email: ds.draft.job_info.hr_email,
          attach_resume: attachResume,
        }))
      );
      setResults(response.results);
      setStep("results");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to send emails");
    } finally {
      setSending(false);
    }
  };

  const approvedCount = draftStates.filter((ds) => ds.approved).length;
  const rejectedCount = draftStates.filter((ds) => !ds.approved).length;
  const duplicateCount = draftStates.filter((ds) => ds.draft.draft_status === "duplicate").length;
  const sentCount = results.filter((r) => r.status === "sent").length;
  const failedCount = results.filter((r) => r.status === "failed").length;

  return (
    <main
      className="min-h-screen"
      style={{
        background: "radial-gradient(ellipse at top, rgba(99,102,241,0.08) 0%, var(--bg-primary) 60%)",
      }}
    >
      {/* Header */}
      <div className="border-b" style={{ borderColor: "var(--border)" }}>
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold gradient-text">Job Application Agent</h1>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              AI-powered cover email automation
            </p>
          </div>
          {/* Nav + Step progress */}
          <div className="flex items-center gap-4">
            <nav className="flex gap-2">
              <Link href="/" className="btn-primary text-sm px-4 py-2" style={{ boxShadow: "0 0 16px var(--accent-glow)" }}>
                Apply
              </Link>
              <Link href="/profile" className="btn-ghost text-sm px-4 py-2">
                Profile
              </Link>
            </nav>
            {/* Step dots */}
            <div className="flex items-center gap-2">
              {(["upload", "review", "results"] as Step[]).map((s, i) => (
                <div key={s} className="flex items-center gap-2">
                  {i > 0 && (
                    <div className="w-8 h-px" style={{ background: "var(--border)" }} />
                  )}
                  <div
                    className="step-dot"
                    style={{
                      ...(step === s ? { background: "var(--accent)", boxShadow: "0 0 8px var(--accent)" } : {}),
                      ...(
                        (s === "review" && (step === "review" || step === "results")) ||
                        (s === "upload" && step !== "upload")
                          ? { background: "var(--success)" }
                          : {}
                      ),
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-10">
        {/* STEP 1: Upload */}
        {step === "upload" && (
          <div className="fade-in">
            <div className="text-center mb-10">
              <h2 className="text-4xl font-bold gradient-text mb-3">
                Upload Job Postings
              </h2>
              <p style={{ color: "var(--text-secondary)" }}>
                Drop screenshots, PDFs, or documents containing job postings.
                <br />
                The AI will extract each job and draft a personalized cover email.
              </p>
            </div>
            {error && (
              <div
                className="rounded-xl p-4 mb-6 text-sm"
                style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171" }}
              >
                ⚠ {error}
              </div>
            )}
            <FileUploader onFilesSelected={handleFilesSelected} isLoading={loading} />
          </div>
        )}

        {/* STEP 2: Review drafts */}
        {step === "review" && (
          <div className="fade-in">
            {/* Stats bar */}
            <div
              className="rounded-2xl p-5 mb-8 flex items-center justify-between flex-wrap gap-4"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
            >
              <div className="flex gap-6 flex-wrap">
                <Stat label="Total Jobs" value={draftStates.length} color="var(--text-primary)" />
                <Stat label="Approved" value={approvedCount} color="var(--success)" />
                <Stat label="Rejected" value={rejectedCount} color="var(--danger)" />
                <Stat label="Duplicates" value={duplicateCount} color="var(--warning)" />
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: "var(--text-secondary)" }}>
                  <input
                    type="checkbox"
                    checked={attachResume}
                    onChange={(e) => setAttachResume(e.target.checked)}
                    className="w-4 h-4 accent-indigo-500"
                  />
                  Attach Resume
                </label>
                <button
                  className="btn-ghost text-sm"
                  onClick={() => { setStep("upload"); setDraftStates([]); }}
                >
                  ↩ Start over
                </button>
                <button
                  className="btn-success flex items-center gap-2"
                  onClick={handleSendAll}
                  disabled={approvedCount === 0 || sending}
                >
                  {sending ? (
                    <><div className="spinner" /> Sending...</>
                  ) : (
                    <>✉ Send {approvedCount} Email{approvedCount !== 1 ? "s" : ""}</>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div
                className="rounded-xl p-4 mb-6 text-sm"
                style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171" }}
              >
                ⚠ {error}
              </div>
            )}

            {/* Draft cards */}
            <div className="flex flex-col gap-4">
              {draftStates.map((ds) => (
                <DraftCard
                  key={ds.draft.draft_id}
                  draft={ds.draft}
                  approved={ds.approved}
                  onToggleApprove={handleToggleApprove}
                  onUpdateEmail={handleUpdateEmail}
                />
              ))}
            </div>

            {/* Bottom confirm button */}
            {approvedCount > 0 && (
              <div className="sticky bottom-6 mt-8 flex justify-end">
                <button
                  className="btn-success flex items-center gap-2 px-6 py-3 text-base shadow-2xl"
                  onClick={handleSendAll}
                  disabled={sending}
                  style={{ boxShadow: "0 8px 32px rgba(16,185,129,0.3)" }}
                >
                  {sending ? (
                    <><div className="spinner" /> Sending...</>
                  ) : (
                    <>✉ Send {approvedCount} Email{approvedCount !== 1 ? "s" : ""}</>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* STEP 3: Results */}
        {step === "results" && (
          <div className="fade-in text-center">
            <div className="text-6xl mb-6">{failedCount === 0 ? "🎉" : "⚠️"}</div>
            <h2 className="text-4xl font-bold gradient-text mb-3">
              {failedCount === 0 ? "All Emails Sent!" : "Emails Sent with Errors"}
            </h2>
            <p className="mb-10" style={{ color: "var(--text-secondary)" }}>
              {sentCount} sent successfully{failedCount > 0 ? `, ${failedCount} failed` : ""}
            </p>

            {/* Results list */}
            <div className="flex flex-col gap-3 text-left mb-10">
              {results.map((r) => {
                const ds = draftStates.find((d) => d.draft.draft_id === r.draft_id);
                const jobInfo = ds?.draft.job_info;
                return (
                  <div
                    key={r.draft_id}
                    className="glass-card p-4 flex items-center justify-between gap-4"
                  >
                    <div>
                      <p className="font-medium" style={{ color: "var(--text-primary)" }}>
                        {jobInfo?.role || "Job"} @ {jobInfo?.company_name || "Company"}
                      </p>
                      <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
                        {jobInfo?.hr_email || ""}
                      </p>
                      {r.error && (
                        <p className="text-xs mt-1" style={{ color: "var(--danger)" }}>
                          {r.error}
                        </p>
                      )}
                    </div>
                    <span className={`badge ${r.status === "sent" ? "badge-sent" : "badge-failed"}`}>
                      {r.status === "sent" ? "✓ Sent" : "✕ Failed"}
                    </span>
                  </div>
                );
              })}
            </div>

            <button
              className="btn-primary px-8 py-3 text-base"
              onClick={() => {
                setStep("upload");
                setDraftStates([]);
                setResults([]);
                setError(null);
              }}
            >
              ↩ Apply to More Jobs
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <p className="text-2xl font-bold" style={{ color }}>{value}</p>
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</p>
    </div>
  );
}
