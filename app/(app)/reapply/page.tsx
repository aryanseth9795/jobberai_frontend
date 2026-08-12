"use client";

import { useState } from "react";
import { Paperclip, RotateCcw, Send } from "lucide-react";

import {
  reapplyConfirm,
  reapplyDraft,
  type CoverEmail,
  type ReapplyBatchResponse,
  type ReapplyDraft,
  type ReapplySendResult,
} from "@/lib/api";
import { statusMeta } from "@/lib/status";
import EmailEditor from "@/components/EmailEditor";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  ErrorNote,
  Field,
  Input,
  Select,
  useToast,
} from "@/components/ui";

type Phase = "setup" | "review" | "results";

/** One draft, plus the edits the user has made to it.
 *
 *  The attachment flags live here rather than being read back out of the DOM
 *  with getElementById at send time, which is what the previous version did —
 *  a checkbox that unmounted, or an id that collided, silently changed what
 *  was attached to a real email. */
interface CardState {
  draft: ReapplyDraft;
  approved: boolean;
  hrEmail: string;
  subject: string;
  body: string;
  attachResume: boolean;
  attachCoverLetter: boolean;
}

const isoToday = () => new Date().toISOString().slice(0, 10);

const isoDaysAgo = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
};

function DraftRow({
  state,
  onChange,
  onEdit,
}: {
  state: CardState;
  onChange: (patch: Partial<CardState>) => void;
  onEdit: () => void;
}) {
  const { draft, approved } = state;
  const failed = draft.draft_status === "error";

  return (
    <article
      className="overflow-hidden rounded-lg border bg-surface"
      style={{ borderColor: approved ? "var(--accent)" : "var(--border)", opacity: failed ? 0.7 : 1 }}
    >
      <header
        className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3"
        style={{ background: "var(--surface-2)" }}
      >
        <label className="flex min-w-0 cursor-pointer items-center gap-2.5">
          <input
            type="checkbox"
            checked={approved}
            disabled={failed}
            onChange={(e) => onChange({ approved: e.target.checked })}
            className="h-3.5 w-3.5 shrink-0 accent-[var(--accent)]"
          />
          <span className="min-w-0">
            <span className="block truncate text-[13.5px] font-semibold">
              {draft.company_name || "Unknown company"}
              <span className="font-normal text-muted"> · {draft.role || "Untitled role"}</span>
            </span>
            <span className="block truncate font-mono text-[11px] text-muted">{state.hrEmail}</span>
          </span>
        </label>

        <div className="flex shrink-0 items-center gap-1.5">
          {failed ? <Badge tone="danger">Couldn&apos;t redraft</Badge> : null}
          {!failed && (
            <Button size="sm" variant="ghost" onClick={onEdit}>
              Edit
            </Button>
          )}
        </div>
      </header>

      {failed && draft.error ? (
        <div className="px-4 py-3">
          <p className="text-[12px]" style={{ color: "var(--danger)" }}>
            {draft.error}
          </p>
        </div>
      ) : (
        <div className="px-4 py-3">
          <p className="text-[13px] font-medium">{state.subject}</p>
          <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-[12.5px] leading-relaxed text-muted">
            {state.body}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-border pt-2.5">
            <Paperclip size={12} className="text-faint" />
            <label className="flex cursor-pointer items-center gap-1.5 text-[12px] text-muted">
              <input
                type="checkbox"
                checked={state.attachResume}
                onChange={(e) => onChange({ attachResume: e.target.checked })}
                className="h-3 w-3 accent-[var(--accent)]"
              />
              Résumé
            </label>
            <label className="flex cursor-pointer items-center gap-1.5 text-[12px] text-muted">
              <input
                type="checkbox"
                checked={state.attachCoverLetter}
                onChange={(e) => onChange({ attachCoverLetter: e.target.checked })}
                className="h-3 w-3 accent-[var(--accent)]"
              />
              Cover letter
            </label>
          </div>
        </div>
      )}
    </article>
  );
}

export default function ReapplyPage() {
  const toast = useToast();

  const [phase, setPhase] = useState<Phase>("setup");
  const [startDate, setStartDate] = useState(isoDaysAgo(7));
  const [endDate, setEndDate] = useState(isoToday());
  const [statusFilter, setStatusFilter] = useState("");

  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [batchId, setBatchId] = useState("");
  const [cards, setCards] = useState<CardState[]>([]);
  const [found, setFound] = useState<{ found: number; drafted: number } | null>(null);
  const [results, setResults] = useState<ReapplySendResult[]>([]);
  const [editing, setEditing] = useState<CardState | null>(null);

  const handleFetch = async () => {
    if (!startDate || !endDate) return;
    setLoading(true);
    setError(null);
    try {
      const res: ReapplyBatchResponse = await reapplyDraft(
        startDate,
        endDate,
        statusFilter || undefined
      );
      setBatchId(res.batch_id);
      setFound({ found: res.total_found, drafted: res.total_drafted });
      setCards(
        res.drafts.map((draft) => ({
          draft,
          approved: draft.draft_status === "drafted",
          hrEmail: draft.hr_email,
          subject: draft.new_cover_email?.subject ?? "",
          body: draft.new_cover_email?.body ?? "",
          attachResume: true,
          attachCoverLetter: true,
        }))
      );
      setPhase("review");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load those applications.");
    } finally {
      setLoading(false);
    }
  };

  const approved = cards.filter((c) => c.approved && c.draft.draft_status === "drafted");

  const handleSend = async () => {
    if (approved.length === 0) return;
    setSending(true);
    setError(null);
    try {
      const res = await reapplyConfirm(
        batchId,
        approved.map((c) => {
          const coverEmail: CoverEmail = { subject: c.subject, body: c.body };
          return {
            original_app_id: c.draft.original_app_id,
            cover_email: coverEmail,
            hr_email: c.hrEmail !== c.draft.hr_email ? c.hrEmail : undefined,
            attach_resume: c.attachResume,
            attach_cover_letter: c.attachCoverLetter,
          };
        })
      );
      setResults(res.results);
      setPhase("results");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sending failed.");
    } finally {
      setSending(false);
    }
  };

  const reset = () => {
    setPhase("setup");
    setCards([]);
    setResults([]);
    setFound(null);
    setBatchId("");
    setError(null);
  };

  const sent = results.filter((r) => r.status === "sent").length;
  const failed = results.filter((r) => r.status !== "sent").length;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[22px] font-semibold">Follow up</h1>
          <p className="mt-0.5 text-[13px] text-muted">
            Rewrite and resend cover emails for applications you have already made.
          </p>
        </div>
        {phase !== "setup" && (
          <Button size="sm" variant="ghost" icon={<RotateCcw size={13} />} onClick={reset}>
            Start over
          </Button>
        )}
      </header>

      {error && (
        <div className="mb-4">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}

      {phase === "setup" && (
        <Card>
          <CardHeader
            title="Which applications?"
            description="Everything you sent in this window gets a fresh draft. Nothing is sent until you have read them."
          />
          <CardBody>
            <div className="grid gap-x-4 sm:grid-cols-3">
              <Field label="From">
                {(p) => (
                  <Input
                    {...p}
                    type="date"
                    value={startDate}
                    max={endDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                )}
              </Field>
              <Field label="To">
                {(p) => (
                  <Input
                    {...p}
                    type="date"
                    value={endDate}
                    min={startDate}
                    max={isoToday()}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                )}
              </Field>
              <Field label="Status" hint="Optional.">
                {(p) => (
                  <Select {...p} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                    <option value="">Any status</option>
                    {["applied", "ghosted", "rejected", "interview"].map((s) => (
                      <option key={s} value={s}>
                        {statusMeta(s).label}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>

            <Button
              variant="primary"
              loading={loading}
              disabled={!startDate || !endDate}
              onClick={handleFetch}
            >
              {loading ? "Rewriting…" : "Load and rewrite"}
            </Button>

            {loading && (
              <p className="mt-3 text-[12px] text-muted">
                Every application in the range gets its own new draft, so this scales with how
                many there are.
              </p>
            )}
          </CardBody>
        </Card>
      )}

      {phase === "review" && (
        <>
          <Card className="mb-4">
            <CardBody className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[12.5px] text-muted">
                {found?.found ?? 0} found · {found?.drafted ?? 0} redrafted ·{" "}
                <strong className="font-medium text-text">{approved.length} selected</strong>
              </p>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setCards((prev) =>
                      prev.map((c) => ({ ...c, approved: c.draft.draft_status === "drafted" }))
                    )
                  }
                >
                  Select all
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setCards((prev) => prev.map((c) => ({ ...c, approved: false })))}
                >
                  Select none
                </Button>
                <Button
                  variant="primary"
                  icon={<Send size={13} />}
                  loading={sending}
                  disabled={approved.length === 0}
                  onClick={handleSend}
                >
                  Send {approved.length}
                </Button>
              </div>
            </CardBody>
          </Card>

          {cards.length === 0 ? (
            <Card>
              <EmptyState
                icon={<RotateCcw size={18} />}
                title="Nothing in that range"
                body="No applications were found between those dates. Try widening the window or clearing the status filter."
                action={<Button onClick={reset}>Change the dates</Button>}
              />
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {cards.map((card) => (
                <DraftRow
                  key={card.draft.original_app_id}
                  state={card}
                  onEdit={() => setEditing(card)}
                  onChange={(patch) =>
                    setCards((prev) =>
                      prev.map((c) =>
                        c.draft.original_app_id === card.draft.original_app_id ? { ...c, ...patch } : c
                      )
                    )
                  }
                />
              ))}
            </div>
          )}
        </>
      )}

      {phase === "results" && (
        <>
          <p className="mb-4 text-[13px] text-muted">
            {sent} sent{failed > 0 ? `, ${failed} failed` : ""}.
          </p>
          <ul className="mb-5 flex flex-col gap-2">
            {results.map((result) => {
              const card = cards.find((c) => c.draft.original_app_id === result.original_app_id);
              const ok = result.status === "sent";
              return (
                <li
                  key={result.original_app_id}
                  className="flex items-start justify-between gap-3 rounded-lg border border-border bg-surface px-3.5 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium">
                      {card?.draft.company_name || "Unknown company"}
                      <span className="font-normal text-muted"> · {card?.draft.role}</span>
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
          <Button variant="primary" onClick={reset}>
            Follow up on more
          </Button>
        </>
      )}

      {editing && (
        <EmailEditor
          hrEmail={editing.hrEmail}
          subject={editing.subject}
          body={editing.body}
          jobTitle={`${editing.draft.company_name || "Unknown company"} · ${editing.draft.role || "Untitled role"}`}
          onClose={() => setEditing(null)}
          onSave={(hrEmail, subject, body) => {
            setCards((prev) =>
              prev.map((c) =>
                c.draft.original_app_id === editing.draft.original_app_id
                  ? { ...c, hrEmail, subject, body }
                  : c
              )
            );
            setEditing(null);
            toast.success("Draft updated.");
          }}
        />
      )}
    </div>
  );
}
