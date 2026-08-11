"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Loader2, TriangleAlert } from "lucide-react";

import { getKeys, updateKeys, KeyStatus, KeysResponse } from "@/lib/api";
import {
  buildKeysPayload,
  formFromKeys,
  isEmptyPayload,
  SettingsForm,
} from "@/lib/settings";

function StatusBadge({ status }: { status: KeyStatus }) {
  // Three states, not two. `unreadable` means a key is stored but cannot be
  // decrypted — usually a rotated ENCRYPTION_KEY. Rendering that as
  // "configured" would tell the user everything is fine while every draft
  // fails, which is exactly why the backend exposes status separately from
  // the boolean.
  const styles: Record<KeyStatus, { label: string; bg: string; fg: string; border: string }> = {
    ok: {
      label: "Configured",
      bg: "var(--success-bg)",
      fg: "var(--success)",
      border: "var(--success-border)",
    },
    unreadable: {
      label: "Stored but unreadable — re-enter it",
      bg: "var(--danger-bg)",
      fg: "var(--danger)",
      border: "var(--danger-border)",
    },
    unset: {
      label: "Not set",
      bg: "var(--bg-card-hover)",
      fg: "var(--text-muted)",
      border: "var(--border)",
    },
  };
  const s = styles[status] ?? styles.unset;
  return (
    <span
      className="px-2 py-0.5 rounded"
      style={{ background: s.bg, color: s.fg, border: `1px solid ${s.border}`, fontSize: 11 }}
    >
      {s.label}
    </span>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  hint,
  type = "text",
  multiline = false,
  maxLength,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  type?: string;
  multiline?: boolean;
  maxLength?: number;
  required?: boolean;
}) {
  const style = {
    background: "var(--bg-secondary)",
    border: "1px solid var(--border)",
    color: "var(--text-primary)",
    fontSize: 14,
  } as const;

  return (
    <label className="block mb-4">
      {/* Empty label = the caller already rendered its own heading row (the
          key fields pair a label with a status badge). */}
      {label && (
        <span className="hud-label block mb-1.5">
          {label}
          {required && <span style={{ color: "var(--danger)" }}> *</span>}
        </span>
      )}
      {multiline ? (
        <textarea
          value={value}
          maxLength={maxLength}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          className="w-full px-3 py-2 rounded outline-none resize-y"
          style={style}
        />
      ) : (
        <input
          type={type}
          value={value}
          maxLength={maxLength}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 rounded outline-none"
          style={style}
        />
      )}
      {hint && (
        <span style={{ color: "var(--text-muted)", fontSize: 12 }} className="block mt-1">
          {hint}
        </span>
      )}
    </label>
  );
}

export default function SettingsPage() {
  const [keys, setKeys] = useState<KeysResponse | null>(null);
  const [form, setForm] = useState<SettingsForm>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [firstRun, setFirstRun] = useState(false);

  useEffect(() => {
    // Read after mount rather than with useSearchParams: this only drives a
    // banner, and reading it during render would force a Suspense boundary.
    setFirstRun(new URLSearchParams(window.location.search).get("first_run") === "1");
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getKeys();
      setKeys(data);
      setForm(formFromKeys(data));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const set = (field: string) => (v: string) =>
    setForm((prev) => ({ ...prev, [field]: v }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keys) return;
    setError("");
    setSaved(false);

    const payload = buildKeysPayload(keys, form);
    if (isEmptyPayload(payload)) {
      setError("Nothing to save — no fields changed.");
      return;
    }

    setSaving(true);
    try {
      const updated = await updateKeys(payload);
      setKeys(updated);
      // Reset the form from the server's response so the secret inputs go
      // back to empty and the identity fields show what was actually stored
      // after validation and trimming.
      setForm(formFromKeys(updated));
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "var(--bg-primary)", color: "var(--text-secondary)" }}
      >
        <Loader2 className="animate-spin" size={20} />
      </div>
    );
  }

  const needsName = !keys?.full_name;

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-primary)" }}>
      <div className="max-w-2xl mx-auto px-4 py-10">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 mb-6"
          style={{ color: "var(--text-secondary)", fontSize: 13 }}
        >
          <ArrowLeft size={14} /> Back to app
        </Link>

        <h1 className="text-2xl font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
          Settings
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: 14 }} className="mb-6">
          Your API keys and the identity that signs your cover emails. Both are
          per-account — nothing here is shared with other users.
        </p>

        {firstRun && (
          <div
            className="mb-6 px-4 py-3 rounded"
            style={{
              background: "var(--accent-light)",
              border: "1px solid var(--border-active)",
              color: "var(--text-primary)",
              fontSize: 13,
            }}
          >
            <strong>Welcome.</strong> Before you can draft anything, add a Gemini
            API key and your full name below — drafting refuses rather than
            inventing a name to sign off with.
          </div>
        )}

        {needsName && !firstRun && (
          <div
            className="mb-6 px-4 py-3 rounded flex items-start gap-2"
            style={{
              background: "var(--warning-bg)",
              border: "1px solid var(--warning-border)",
              color: "var(--warning)",
              fontSize: 13,
            }}
          >
            <TriangleAlert size={15} style={{ marginTop: 1, flexShrink: 0 }} />
            <span>
              Your full name isn&apos;t set, so drafting a cover email will fail.
              Add it under Candidate identity.
            </span>
          </div>
        )}

        <form onSubmit={handleSave}>
          {/* ── API keys ── */}
          <section className="glass-card p-6 mb-6">
            <h2 className="text-base font-medium mb-4" style={{ color: "var(--text-primary)" }}>
              API keys
            </h2>

            <div className="flex items-center gap-2 mb-1.5">
              <span className="hud-label">Gemini API key</span>
              {keys && <StatusBadge status={keys.gemini_status} />}
            </div>
            <Field
              label=""
              type="password"
              value={form.gemini_api_key ?? ""}
              onChange={set("gemini_api_key")}
              placeholder={keys?.gemini_api_key ?? "Paste your key"}
              hint="Required for drafting. Leave blank to keep the current key."
            />

            <div className="flex items-center gap-2 mb-1.5">
              <span className="hud-label">Resend API key</span>
              {keys && <StatusBadge status={keys.resend_status} />}
            </div>
            <Field
              label=""
              type="password"
              value={form.resend_api_key ?? ""}
              onChange={set("resend_api_key")}
              placeholder={keys?.resend_api_key ?? "Paste your key"}
              hint="Required for sending. Leave blank to keep the current key."
            />

            <Field
              label="Sender email"
              type="email"
              value={form.sender_email ?? ""}
              onChange={set("sender_email")}
              hint="Must be on a domain you've verified with Resend."
            />
            <Field
              label="Reply-to email"
              type="email"
              value={form.reply_to_email ?? ""}
              onChange={set("reply_to_email")}
              hint="Where replies land if that differs from the sender."
            />
          </section>

          {/* ── Candidate identity ── */}
          <section className="glass-card p-6 mb-6">
            <h2 className="text-base font-medium mb-1" style={{ color: "var(--text-primary)" }}>
              Candidate identity
            </h2>
            <p style={{ color: "var(--text-secondary)", fontSize: 13 }} className="mb-4">
              These are typed in rather than read out of your résumé: a model
              asked to infer a phone number can produce a plausible wrong one,
              and nobody notices until an application goes out with a dead
              number on it. Your experience and projects still come from the
              documents you upload.
            </p>

            <Field
              label="Full name"
              required
              value={form.full_name ?? ""}
              onChange={set("full_name")}
              hint="Signs every cover email. Drafting fails without it."
            />
            <Field
              label="Headline"
              value={form.headline ?? ""}
              onChange={set("headline")}
              placeholder="B.Tech ECE, IIIT Bhagalpur (2025)"
            />
            <Field label="Phone" value={form.phone ?? ""} onChange={set("phone")} />
            <Field
              label="Contact email"
              type="email"
              value={form.contact_email ?? ""}
              onChange={set("contact_email")}
              hint="Falls back to your account email when unset."
            />
            <Field
              label="Portfolio URL"
              value={form.portfolio_url ?? ""}
              onChange={set("portfolio_url")}
            />
            <Field label="GitHub URL" value={form.github_url ?? ""} onChange={set("github_url")} />
            <Field
              label="LinkedIn URL"
              value={form.linkedin_url ?? ""}
              onChange={set("linkedin_url")}
            />
            <Field
              label="Writing notes"
              multiline
              maxLength={2000}
              value={form.writing_notes ?? ""}
              onChange={set("writing_notes")}
              placeholder="Lead with the internship, then side projects. Never mention years of experience."
              hint={`Emphasis and ordering preferences, injected verbatim into the prompt. ${
                (form.writing_notes ?? "").length
              }/2000`}
            />
          </section>

          {error && (
            <div
              className="mb-4 px-3 py-2 rounded"
              role="alert"
              style={{
                background: "var(--danger-bg)",
                border: "1px solid var(--danger-border)",
                color: "var(--danger)",
                fontSize: 13,
              }}
            >
              {error}
            </div>
          )}

          {saved && (
            <div
              className="mb-4 px-3 py-2 rounded flex items-center gap-2"
              role="status"
              style={{
                background: "var(--success-bg)",
                border: "1px solid var(--success-border)",
                color: "var(--success)",
                fontSize: 13,
              }}
            >
              <Check size={14} /> Saved.
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="btn-primary flex items-center justify-center gap-2"
          >
            {saving && <Loader2 size={15} className="animate-spin" />}
            {saving ? "Saving…" : "Save settings"}
          </button>
        </form>
      </div>
    </div>
  );
}
