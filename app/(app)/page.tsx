"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FileText, ImageIcon, Paperclip, RotateCcw, Send, Sparkles, X } from "lucide-react";

import {
  applyUnified,
  confirmBatch,
  getKeys,
  getUploadedFiles,
  regenerateBatch,
  type BatchResponse,
  type DraftResponse,
  type SendResult,
  type UploadedFiles,
} from "@/lib/api";
import DraftCard from "@/components/DraftCard";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  ErrorNote,
  Textarea,
  useToast,
} from "@/components/ui";

type Stage = "compose" | "review" | "sent";

interface DraftState {
  draft: DraftResponse;
  approved: boolean;
}

/**
 * Seconds since a piece of work started, or null when nothing is running.
 *
 * This is the honest version of a progress bar for a request whose duration
 * cannot be known: the elapsed count is real information — it tells the user
 * whether they are 5 seconds or 90 seconds in — where a bar creeping toward
 * an invented finish line is not.
 *
 * Each sample is stored with the run it came from. That is what lets a stale
 * count from the previous request be discarded at read time rather than
 * cleared in an effect — and it keeps `Date.now()`, which is impure, out of
 * the render path.
 */
function useElapsed(since: number | null): number | null {
  const [sample, setSample] = useState<{ since: number; seconds: number } | null>(null);

  useEffect(() => {
    if (since === null) return;
    const timer = setInterval(
      () => setSample({ since, seconds: Math.round((Date.now() - since) / 1000) }),
      1000
    );
    return () => clearInterval(timer);
  }, [since]);

  return since !== null && sample?.since === since ? sample.seconds : null;
}

function Working({ label, seconds }: { label: string; seconds: number | null }) {
  return (
    <div className="flex items-center gap-2.5 rounded-md border border-border px-3 py-2.5" style={{ background: "var(--surface-2)" }}>
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full motion-safe:animate-[pulse_1.4s_ease-in-out_infinite]"
        style={{ background: "var(--accent)" }}
      />
      <p className="text-[12.5px] text-muted">
        {label}
        {seconds !== null && seconds >= 3 && (
          <span className="tabular-nums text-faint"> · {seconds}s</span>
        )}
      </p>
    </div>
  );
}

function mergeFiles(existing: File[], incoming: File[]): File[] {
  const byName = new Map(existing.map((f) => [f.name, f]));
  for (const file of incoming) byName.set(file.name, file);
  return [...byName.values()];
}

export default function ApplyPage() {
  const toast = useToast();

  const [stage, setStage] = useState<Stage>("compose");
  const [jobText, setJobText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);

  const [drafting, setDrafting] = useState(false);
  const [sending, setSending] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [batchId, setBatchId] = useState("");
  const [drafts, setDrafts] = useState<DraftState[]>([]);
  const [feedback, setFeedback] = useState("");
  const [results, setResults] = useState<SendResult[]>([]);

  const [uploads, setUploads] = useState<UploadedFiles | null>(null);
  const [senderEmail, setSenderEmail] = useState<string | null>(null);
  const [attachResume, setAttachResume] = useState(true);
  const [attachCoverLetter, setAttachCoverLetter] = useState(true);

  const inputRef = useRef<HTMLInputElement>(null);

  // One timestamp for whichever request is in flight, set by the handler that
  // starts it, so the elapsed figure is always measured from the real start.
  const [busySince, setBusySince] = useState<number | null>(null);
  const elapsed = useElapsed(busySince);

  // What can actually be attached, so the toggles below describe files that
  // exist rather than offering to attach nothing.
  useEffect(() => {
    getUploadedFiles()
      .then(setUploads)
      .catch(() => {
        /* The toggles fall back to enabled; the send itself is the real check. */
      });
    getKeys()
      .then((keys) => setSenderEmail(keys.sender_email))
      .catch(() => {
        /* Cosmetic — only used for the "from" line in the preview. */
      });
  }, []);

  // Screenshots are usually in the clipboard, not on disk. Pasting is the
  // fastest path from "I saw a job posting" to a draft.
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const pasted: File[] = [];
      for (const item of event.clipboardData?.items ?? []) {
        if (item.kind !== "file") continue;
        const file = item.getAsFile();
        if (!file) continue;
        const extension = file.type.split("/")[1] || "png";
        const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
        pasted.push(new File([file], `pasted-${stamp}.${extension}`, { type: file.type }));
      }
      if (pasted.length > 0) setFiles((prev) => mergeFiles(prev, pasted));
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  const attachmentNames = [
    attachResume && uploads?.resume.uploaded ? "Résumé" : null,
    attachCoverLetter && uploads?.cover_letter.uploaded ? "Cover letter" : null,
  ].filter(Boolean) as string[];

  const handleDraft = async () => {
    if (!jobText.trim() && files.length === 0) return;
    setDrafting(true);
    setBusySince(Date.now());
    setError(null);
    try {
      const response: BatchResponse = await applyUnified(jobText, files);
      setBatchId(response.batch_id);
      setDrafts(response.drafts.map((d) => ({ draft: d, approved: d.draft_status === "drafted" })));
      setFeedback("");
      setStage("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Drafting failed.");
    } finally {
      setDrafting(false);
      setBusySince(null);
    }
  };

  const handleRegenerate = async () => {
    if (!feedback.trim()) return;
    setRegenerating(true);
    setBusySince(Date.now());
    setError(null);
    try {
      const response = await regenerateBatch(batchId, feedback);
      setDrafts(response.drafts.map((d) => ({ draft: d, approved: d.draft_status === "drafted" })));
      setFeedback("");
      toast.success(`${response.drafts.length} draft${response.drafts.length === 1 ? "" : "s"} updated.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the drafts.");
    } finally {
      setRegenerating(false);
      setBusySince(null);
    }
  };

  const approved = drafts.filter((d) => d.approved && d.draft.cover_email);

  const handleSend = async () => {
    if (approved.length === 0) return;
    setSending(true);
    setBusySince(Date.now());
    setError(null);
    try {
      const response = await confirmBatch(
        batchId,
        approved.map((d) => ({
          draft_id: d.draft.draft_id,
          cover_email: d.draft.cover_email!,
          hr_email: d.draft.job_info.hr_email,
          attach_resume: attachResume,
          attach_cover_letter: attachCoverLetter,
        }))
      );
      setResults(response.results);
      setStage("sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sending failed.");
    } finally {
      setSending(false);
      setBusySince(null);
    }
  };

  const reset = useCallback(() => {
    setStage("compose");
    setJobText("");
    setFiles([]);
    setDrafts([]);
    setResults([]);
    setError(null);
    setFeedback("");
  }, []);

  const sent = results.filter((r) => r.status === "sent").length;
  const failed = results.filter((r) => r.status !== "sent").length;

  // ── Compose ──

  if (stage === "compose") {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <header className="mb-5">
          <h1 className="font-display text-[22px] font-semibold">Draft an application</h1>
          <p className="mt-0.5 text-[13px] text-muted">
            Paste a job posting, or drop screenshots of one. Nothing is sent until you have read
            what was written.
          </p>
        </header>

        <Card>
          <CardBody>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                setFiles((prev) => mergeFiles(prev, [...e.dataTransfer.files]));
              }}
              className="rounded-md border-2 border-dashed p-3 transition-colors"
              style={{
                borderColor: dragging ? "var(--accent)" : "var(--border)",
                background: dragging ? "var(--accent-soft)" : "transparent",
              }}
            >
              <Textarea
                value={jobText}
                onChange={(e) => setJobText(e.target.value)}
                rows={7}
                aria-label="Job posting"
                placeholder="Paste the job description, the company, and anything about who to contact. Or drop screenshots here — you can paste them straight from your clipboard."
                className="border-0 bg-transparent px-0 focus:ring-0"
              />

              <div className="mt-2 flex items-center justify-between gap-3">
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<Paperclip size={13} />}
                  onClick={() => inputRef.current?.click()}
                >
                  Attach files
                </Button>
                <input
                  ref={inputRef}
                  type="file"
                  multiple
                  accept=".png,.jpg,.jpeg,.webp,.pdf"
                  className="hidden"
                  onChange={(e) => {
                    setFiles((prev) => mergeFiles(prev, [...(e.target.files ?? [])]));
                    e.target.value = "";
                  }}
                />
                <span className="text-[11.5px] text-faint">PNG, JPG or PDF</span>
              </div>
            </div>

            {files.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {files.map((file) => (
                  <li
                    key={file.name}
                    className="flex items-center gap-1.5 rounded-sm border border-border px-2 py-1 text-[11.5px]"
                    style={{ background: "var(--surface-2)" }}
                  >
                    {file.name.endsWith(".pdf") ? <FileText size={11} /> : <ImageIcon size={11} />}
                    <span className="max-w-[160px] truncate">{file.name}</span>
                    <button
                      onClick={() => setFiles((prev) => prev.filter((f) => f.name !== file.name))}
                      aria-label={`Remove ${file.name}`}
                      className="text-faint hover:text-text"
                    >
                      <X size={11} />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {error && (
              <div className="mt-3">
                <ErrorNote>{error}</ErrorNote>
              </div>
            )}

            {drafting && (
              <div className="mt-3">
                <Working
                  label={
                    files.length > 0
                      ? `Reading ${files.length} file${files.length === 1 ? "" : "s"} and drafting`
                      : "Drafting"
                  }
                  seconds={elapsed}
                />
              </div>
            )}

            <Button
              variant="primary"
              className="mt-4 w-full"
              icon={<Sparkles size={14} />}
              loading={drafting}
              disabled={!jobText.trim() && files.length === 0}
              onClick={handleDraft}
            >
              {drafting ? "Drafting…" : "Write the cover email"}
            </Button>
          </CardBody>
        </Card>
      </div>
    );
  }

  // ── Review ──

  if (stage === "review") {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-[22px] font-semibold">Review before sending</h1>
            <p className="mt-0.5 text-[13px] text-muted">
              {drafts.length} draft{drafts.length === 1 ? "" : "s"} · {approved.length} approved
            </p>
          </div>
          <Button size="sm" variant="ghost" icon={<RotateCcw size={13} />} onClick={reset}>
            Start over
          </Button>
        </header>

        <Card className="mb-4">
          <CardBody className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-col gap-1.5">
              <p className="label">Attach to every email</p>
              <div className="flex flex-wrap gap-3">
                {(
                  [
                    { key: "resume" as const, label: "Résumé", checked: attachResume, set: setAttachResume },
                    {
                      key: "cover_letter" as const,
                      label: "Cover letter",
                      checked: attachCoverLetter,
                      set: setAttachCoverLetter,
                    },
                  ]
                ).map(({ key, label, checked, set }) => {
                  const available = uploads ? uploads[key].uploaded : true;
                  return (
                    <label
                      key={key}
                      className="flex items-center gap-1.5 text-[12.5px]"
                      style={{ opacity: available ? 1 : 0.5 }}
                    >
                      <input
                        type="checkbox"
                        checked={checked && available}
                        disabled={!available}
                        onChange={(e) => set(e.target.checked)}
                        className="h-3.5 w-3.5 accent-[var(--accent)]"
                      />
                      {label}
                      {!available && <span className="text-[11px] text-faint">(not uploaded)</span>}
                    </label>
                  );
                })}
              </div>
            </div>

            <Button
              variant="primary"
              icon={<Send size={13} />}
              loading={sending}
              disabled={approved.length === 0}
              onClick={handleSend}
            >
              Send {approved.length} application{approved.length === 1 ? "" : "s"}
            </Button>
          </CardBody>
        </Card>

        <Card className="mb-4">
          <CardHeader
            title="Change all of them at once"
            description="Describe what to fix and every draft is rewritten — merge two that are the same job, drop one, change the emphasis."
          />
          <CardBody>
            <Textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={2}
              disabled={regenerating || sending}
              aria-label="Instructions for rewriting the drafts"
              placeholder="Drafts 1 and 2 are the same job — merge them. Lead with the internship rather than the coursework."
            />
            <div className="mt-2 flex items-center justify-between gap-3">
              {regenerating ? (
                <Working label="Rewriting every draft" seconds={elapsed} />
              ) : (
                <span />
              )}
              <Button
                variant="secondary"
                loading={regenerating}
                disabled={sending || !feedback.trim()}
                onClick={handleRegenerate}
              >
                Rewrite drafts
              </Button>
            </div>
          </CardBody>
        </Card>

        {error && (
          <div className="mb-4">
            <ErrorNote>{error}</ErrorNote>
          </div>
        )}

        <div
          className="flex flex-col gap-3"
          style={{ opacity: regenerating ? 0.55 : 1, pointerEvents: regenerating ? "none" : "auto" }}
        >
          {drafts.map((state, i) => (
            <DraftCard
              key={state.draft.draft_id}
              draft={state.draft}
              index={i + 1}
              approved={state.approved}
              attachments={attachmentNames}
              senderEmail={senderEmail}
              onToggleApprove={(id, next) =>
                setDrafts((prev) =>
                  prev.map((d) => (d.draft.draft_id === id ? { ...d, approved: next } : d))
                )
              }
              onUpdateEmail={(id, hrEmail, subject, body) =>
                setDrafts((prev) =>
                  prev.map((d) =>
                    d.draft.draft_id === id
                      ? {
                          ...d,
                          draft: {
                            ...d.draft,
                            job_info: { ...d.draft.job_info, hr_email: hrEmail },
                            cover_email: { subject, body },
                          },
                        }
                      : d
                  )
                )
              }
            />
          ))}
        </div>

        {sending && (
          <div className="mt-4">
            <Working
              label={`Sending ${approved.length} application${approved.length === 1 ? "" : "s"}`}
              seconds={elapsed}
            />
          </div>
        )}
      </div>
    );
  }

  // ── Sent ──

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <header className="mb-5">
        <h1 className="font-display text-[22px] font-semibold">
          {failed === 0 ? "Sent" : "Partly sent"}
        </h1>
        <p className="mt-0.5 text-[13px] text-muted">
          {sent} delivered{failed > 0 ? `, ${failed} failed` : ""}.
        </p>
      </header>

      <ul className="mb-5 flex flex-col gap-2">
        {results.map((result) => {
          const match = drafts.find((d) => d.draft.draft_id === result.draft_id);
          const ok = result.status === "sent";
          return (
            <li
              key={result.draft_id}
              className="flex items-start justify-between gap-3 rounded-lg border border-border bg-surface px-3.5 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium">
                  {match?.draft.job_info.role || "Untitled role"}
                  <span className="font-normal text-muted">
                    {" · "}
                    {match?.draft.job_info.company_name || "Unknown company"}
                  </span>
                </p>
                <p className="mt-0.5 truncate font-mono text-[11px] text-muted">
                  {match?.draft.job_info.hr_email}
                </p>
                {result.error && (
                  <p className="mt-1 text-[12px]" style={{ color: "var(--danger)" }}>
                    {result.error}
                  </p>
                )}
              </div>
              <Badge tone={ok ? "success" : "danger"}>{ok ? "Sent" : "Failed"}</Badge>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={reset}>
          Draft another
        </Button>
        <Button onClick={() => (window.location.href = "/dashboard")}>See the dashboard</Button>
      </div>
    </div>
  );
}
