"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { FileText, Paperclip, Trash2, Upload, X } from "lucide-react";

import {
  deleteUploadedFile,
  getProfileStatus,
  getUploadedFiles,
  ingestProfile,
  uploadCanonicalFile,
  type UploadedFiles,
} from "@/lib/api";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  ConfirmDialog,
  Skeleton,
  useToast,
} from "@/components/ui";

interface IngestResult {
  status: string;
  message: string;
  chunks_ingested: number;
  sources: string[];
  skipped?: string[];
}

const ACCEPTED = ".pdf,.docx,.txt,.md";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

/** Merge by filename, so re-picking a file replaces it rather than queueing
 *  the same document twice. */
function merge(existing: File[], incoming: File[]): File[] {
  const byName = new Map(existing.map((f) => [f.name, f]));
  for (const file of incoming) byName.set(file.name, file);
  return [...byName.values()];
}

export default function ProfilePage() {
  const toast = useToast();

  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [ingesting, setIngesting] = useState(false);
  const [result, setResult] = useState<IngestResult | null>(null);

  const [chunks, setChunks] = useState<{ chunks: number; sources: string[] } | null>(null);
  const [uploads, setUploads] = useState<UploadedFiles | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingRemove, setPendingRemove] = useState<"resume" | "cover_letter" | null>(null);
  const [removing, setRemoving] = useState(false);
  const [replacing, setReplacing] = useState<"resume" | "cover_letter" | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const resumeRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    const [status, uploaded] = await Promise.allSettled([getProfileStatus(), getUploadedFiles()]);
    if (status.status === "fulfilled" && status.value.status === "ready") {
      setChunks({ chunks: status.value.chunks, sources: status.value.sources });
    }
    if (uploaded.status === "fulfilled") setUploads(uploaded.value);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleIngest = async () => {
    if (files.length === 0) return;
    setIngesting(true);
    setResult(null);
    try {
      const res = (await ingestProfile(files)) as IngestResult;
      setResult(res);
      if (res.status === "success") {
        setChunks({ chunks: res.chunks_ingested, sources: res.sources });
        setFiles([]);
        await refresh();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not ingest those files.");
    } finally {
      setIngesting(false);
    }
  };

  /** Upload straight into the canonical slot, so the file is attached to
   *  outgoing mail whatever the user happened to call it. */
  const handleAttachment = async (kind: "resume" | "cover_letter", file: File) => {
    setReplacing(kind);
    try {
      await uploadCanonicalFile(kind, file);
      await refresh();
      toast.success(`${kind === "resume" ? "Résumé" : "Cover letter"} updated.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setReplacing(null);
    }
  };

  const confirmRemove = async () => {
    if (!pendingRemove) return;
    setRemoving(true);
    try {
      await deleteUploadedFile(pendingRemove);
      await refresh();
      toast.success("Removed.");
      setPendingRemove(null);
    } catch (err) {
      // Previously this swallowed the error and refreshed anyway, so a failed
      // delete looked exactly like a successful one.
      toast.error(err instanceof Error ? err.message : "Could not remove the file.");
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <header className="mb-5">
        <h1 className="font-display text-[22px] font-semibold">Documents</h1>
        <p className="mt-0.5 text-[13px] text-muted">
          What the AI writes from, and what gets attached to your applications.
        </p>
      </header>

      {/* ── Attachments ── */}
      <Card className="mb-4">
        <CardHeader
          title="Email attachments"
          description="Sent with every application. Whatever you name the file, it is stored in the right slot."
        />
        <CardBody className="flex flex-col gap-2">
          {loading ? (
            <>
              <Skeleton className="h-14 rounded-md" />
              <Skeleton className="h-14 rounded-md" />
            </>
          ) : (
            (
              [
                { kind: "resume" as const, label: "Résumé", ref: resumeRef, required: true },
                { kind: "cover_letter" as const, label: "Cover letter", ref: coverRef, required: false },
              ]
            ).map(({ kind, label, ref, required }) => {
              const slot = uploads?.[kind];
              return (
                <div
                  key={kind}
                  className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2.5"
                  style={{ background: "var(--surface-2)" }}
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Paperclip size={15} className="shrink-0 text-faint" />
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium">{label}</p>
                      <p className="text-[11.5px] text-muted">
                        {slot?.uploaded
                          ? `Uploaded · ${formatSize(slot.size_bytes)}`
                          : required
                            ? "Not uploaded — applications need this"
                            : "Not uploaded (optional)"}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    <input
                      ref={ref}
                      type="file"
                      accept=".pdf"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (file) handleAttachment(kind, file);
                      }}
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      loading={replacing === kind}
                      onClick={() => ref.current?.click()}
                    >
                      {slot?.uploaded ? "Replace" : "Upload"}
                    </Button>
                    {slot?.uploaded && (
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Remove ${label}`}
                        onClick={() => setPendingRemove(kind)}
                      >
                        <Trash2 size={13} />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </CardBody>
      </Card>

      {/* ── Knowledge base ── */}
      <Card className="mb-4">
        <CardHeader
          title="What the AI writes from"
          description="Your experience and projects, indexed so the model can quote them rather than invent them."
          action={chunks ? <Badge tone="accent">{chunks.chunks} chunks indexed</Badge> : undefined}
        />
        <CardBody>
          {chunks && chunks.sources.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-1.5">
              {chunks.sources.map((source) => (
                <Badge key={source}>
                  <FileText size={11} /> {source}
                </Badge>
              ))}
            </div>
          )}

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              setFiles((prev) => merge(prev, [...e.dataTransfer.files]));
            }}
            onClick={() => inputRef.current?.click()}
            className="flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed px-6 py-8 text-center transition-colors"
            style={{
              borderColor: dragging ? "var(--accent)" : "var(--border)",
              background: dragging ? "var(--accent-soft)" : "transparent",
            }}
          >
            <input
              ref={inputRef}
              type="file"
              multiple
              accept={ACCEPTED}
              className="hidden"
              onChange={(e) => {
                setFiles((prev) => merge(prev, [...(e.target.files ?? [])]));
                e.target.value = "";
              }}
            />
            <Upload size={18} className="mb-2 text-faint" />
            <p className="text-[13px] font-medium">Drop files, or click to browse</p>
            <p className="mt-0.5 text-[12px] text-muted">PDF, DOCX, TXT or Markdown</p>
          </div>

          {/* This is the one destructive thing on the page, so it is stated
              before the button rather than after it. */}
          <p className="mt-3 text-[12px] text-muted">
            Uploading replaces the whole index — send every document you want kept, not just
            the new one.
          </p>

          {files.length > 0 && (
            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="label">
                  {files.length} file{files.length === 1 ? "" : "s"} ready
                </p>
                <Button size="sm" variant="ghost" onClick={() => setFiles([])}>
                  Clear
                </Button>
              </div>
              <ul className="flex flex-col gap-1.5">
                {files.map((file) => (
                  <li
                    key={file.name}
                    className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <FileText size={13} className="shrink-0 text-faint" />
                      <span className="truncate text-[12.5px]">{file.name}</span>
                      <span className="shrink-0 text-[11px] text-faint tabular-nums">
                        {formatSize(file.size)}
                      </span>
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setFiles((prev) => prev.filter((f) => f.name !== file.name));
                      }}
                      aria-label={`Remove ${file.name}`}
                      className="shrink-0 rounded p-0.5 text-faint hover:text-text"
                    >
                      <X size={13} />
                    </button>
                  </li>
                ))}
              </ul>

              <Button
                variant="primary"
                className="mt-3 w-full"
                loading={ingesting}
                onClick={handleIngest}
              >
                {ingesting ? "Indexing…" : `Replace index with ${files.length} file${files.length === 1 ? "" : "s"}`}
              </Button>
            </div>
          )}

          {result && (
            <div
              className="mt-4 rounded-md border px-3 py-2.5"
              style={{
                background: result.status === "success" ? "var(--success-soft)" : "var(--warning-soft)",
                borderColor: result.status === "success" ? "var(--success-line)" : "var(--warning-line)",
              }}
            >
              <p
                className="text-[12.5px] font-medium"
                style={{ color: result.status === "success" ? "var(--success)" : "var(--warning)" }}
              >
                {result.message}
              </p>
              {result.skipped && result.skipped.length > 0 && (
                <p className="mt-1 text-[12px] text-muted">Skipped: {result.skipped.join(", ")}</p>
              )}
              {result.status === "success" && (
                <p className="mt-1.5 text-[12px] text-muted">
                  Ready —{" "}
                  <Link href="/" className="text-accent hover:underline">
                    draft an application
                  </Link>
                  .
                </p>
              )}
            </div>
          )}
        </CardBody>
      </Card>

      <ConfirmDialog
        open={pendingRemove !== null}
        onClose={() => setPendingRemove(null)}
        onConfirm={confirmRemove}
        loading={removing}
        title={`Remove your ${pendingRemove === "resume" ? "résumé" : "cover letter"}?`}
        confirmLabel="Remove"
        body={
          pendingRemove === "resume"
            ? "Applications will go out with no résumé attached until you upload another one."
            : "Applications will go out without a cover letter attached. That is allowed — it is an optional attachment."
        }
      />
    </div>
  );
}
