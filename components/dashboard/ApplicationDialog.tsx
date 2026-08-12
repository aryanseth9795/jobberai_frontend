"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";

import { updateJobStatus, type JobApplication } from "@/lib/api";
import { longDate } from "@/lib/format";
import { PIPELINE_STATUSES, statusMeta } from "@/lib/status";
import { Button, Dialog, StatusBadge, useToast } from "@/components/ui";

function timestamp(iso?: string): string {
  if (!iso) return "—";
  // Motor serialises naive datetimes with no offset, which the browser then
  // reads as local time — an hour or more adrift depending on where the reader
  // is. The stored value is UTC, so say so.
  const normalised = iso.endsWith("Z") || iso.includes("+") ? iso : `${iso}Z`;
  const date = new Date(normalised);
  if (Number.isNaN(date.getTime())) return iso;
  return `${longDate(date.toISOString().slice(0, 10))}, ${date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

export function ApplicationDialog({
  application,
  onClose,
  onStatusChange,
}: {
  application: JobApplication | null;
  onClose: () => void;
  onStatusChange: (id: string, status: string) => void;
}) {
  const toast = useToast();
  const [saving, setSaving] = useState<string | null>(null);

  if (!application) return null;

  const handleStatus = async (next: string) => {
    if (next === application.status) return;
    setSaving(next);
    try {
      await updateJobStatus(application._id, next);
      onStatusChange(application._id, next);
      toast.success(`Marked as ${statusMeta(next).label.toLowerCase()}.`);
    } catch (err) {
      // The previous version swallowed this, so a failed update looked
      // identical to a successful one until the next reload put the old
      // status back.
      toast.error(err instanceof Error ? err.message : "Could not update the status.");
    } finally {
      setSaving(null);
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={application.role || "Untitled role"}
      description={`${application.company_name || "Unknown company"} · ${timestamp(application.applied_at)}`}
      footer={<Button onClick={onClose}>Close</Button>}
    >
      <dl className="mb-5 grid gap-2 sm:grid-cols-2">
        <Detail label="Company" value={application.company_name} />
        <Detail label="Role" value={application.role} />
        <Detail label="Recruiter email" value={application.hr_email} mono />
        <Detail label="Location" value={application.location} />
      </dl>

      <div className="mb-5">
        <p className="label mb-2">Status</p>
        <div className="flex flex-wrap gap-1.5">
          {PIPELINE_STATUSES.map((s) => {
            const active = application.status === s;
            return (
              <Button
                key={s}
                size="sm"
                variant={active ? "primary" : "secondary"}
                loading={saving === s}
                disabled={saving !== null}
                onClick={() => handleStatus(s)}
                aria-pressed={active}
              >
                {statusMeta(s).label}
              </Button>
            );
          })}
        </div>
      </div>

      {application.cover_email_subject && (
        <section className="overflow-hidden rounded-md border border-border">
          <header className="border-b border-border px-3.5 py-2.5" style={{ background: "var(--surface-2)" }}>
            <p className="label mb-1">Cover email sent</p>
            <p className="text-[13px] font-medium">{application.cover_email_subject}</p>
          </header>
          {application.cover_email_body && (
            <div className="max-h-60 overflow-y-auto px-3.5 py-3">
              <p className="whitespace-pre-wrap break-words text-[12.5px] leading-relaxed text-muted">
                {application.cover_email_body}
              </p>
            </div>
          )}
        </section>
      )}
    </Dialog>
  );
}

function Detail({ label, value, mono }: { label: string; value?: string; mono?: boolean }) {
  return (
    <div className="rounded-md border border-border px-3 py-2" style={{ background: "var(--surface-2)" }}>
      <dt className="label mb-1">{label}</dt>
      <dd className={`break-words text-[12.5px] ${mono ? "font-mono text-[11.5px]" : ""}`}>
        {value || "—"}
      </dd>
    </div>
  );
}

export function FormSessionDialog({
  session,
  onClose,
}: {
  session: {
    form_url: string;
    form_title: string;
    company: string;
    role: string;
    status: string;
    filled_at: string;
    questions?: { index: number; question: string }[];
    answers?: { index: number; question: string; answer: string | string[] }[];
  } | null;
  onClose: () => void;
}) {
  if (!session) return null;

  return (
    <Dialog
      open
      onClose={onClose}
      title={session.role || session.form_title || "Untitled form"}
      description={`${session.company || "Unknown company"} · ${timestamp(session.filled_at)}`}
      footer={<Button onClick={onClose}>Close</Button>}
    >
      <div className="mb-4 flex items-center gap-3">
        <StatusBadge status={session.status} />
        {session.form_url && (
          <a
            href={session.form_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[12.5px] text-accent hover:underline"
          >
            <ExternalLink size={12} /> Open the original form
          </a>
        )}
      </div>

      <p className="label mb-2">Questions and answers</p>
      {session.answers && session.answers.length > 0 ? (
        <ol className="flex flex-col gap-2">
          {session.answers.map((answer, i) => {
            const question =
              session.questions?.find((q) => q.index === answer.index)?.question ?? answer.question;
            return (
              <li key={i} className="rounded-md border border-border p-3" style={{ background: "var(--surface-2)" }}>
                <p className="mb-1 text-[12.5px] font-medium">{question}</p>
                <p className="whitespace-pre-wrap text-[12.5px] text-muted">
                  {Array.isArray(answer.answer) ? answer.answer.join(", ") : answer.answer}
                </p>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="text-[12.5px] text-muted">This session recorded no answers.</p>
      )}
    </Dialog>
  );
}
