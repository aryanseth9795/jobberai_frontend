"use client";

import { useRef, useState } from "react";
import { FileText, Upload } from "lucide-react";

import { cn } from "@/lib/cn";
import { updateKeys, uploadCanonicalFile, type KeysResponse } from "@/lib/api";
import { Button, Field, Input } from "@/components/ui";

/**
 * The four step bodies.
 *
 * Each one owns its own submit and reports success upward; the wizard shell
 * owns navigation and progress. Splitting it this way is what lets a step save
 * to the server the moment it is completed rather than batching everything to
 * the end — which matters because the state is re-derived from the server on
 * every load, so a refresh mid-setup resumes exactly where it left off instead
 * of starting over.
 */
export interface StepProps {
  keys: KeysResponse | null;
  /** Re-fetches onboarding state and advances if the step is now satisfied. */
  onSaved: () => Promise<void>;
}

function useSubmit(onSaved: () => Promise<void>) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const run = async (work: () => Promise<unknown>) => {
    setError("");
    setSaving(true);
    try {
      await work();
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return { saving, error, setError, run };
}

function StepError({ message }: { message: string }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="mb-4 rounded-md border px-3 py-2 text-[12.5px]"
      style={{ background: "var(--danger-soft)", borderColor: "var(--danger-line)", color: "var(--danger)" }}
    >
      {message}
    </p>
  );
}

// ── 1. Identity ──

export function IdentityStep({ keys, onSaved }: StepProps) {
  const [form, setForm] = useState({
    full_name: keys?.full_name ?? "",
    headline: keys?.headline ?? "",
    phone: keys?.phone ?? "",
    contact_email: keys?.contact_email ?? "",
  });
  const { saving, error, run } = useSubmit(onSaved);
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const incomplete = Object.values(form).some((value) => !value.trim());

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run(() =>
          updateKeys({
            full_name: form.full_name.trim(),
            headline: form.headline.trim(),
            phone: form.phone.trim(),
            contact_email: form.contact_email.trim(),
          })
        );
      }}
    >
      <StepError message={error} />

      <Field label="Full name" required hint="Signs every cover email you send.">
        {(props) => <Input {...props} value={form.full_name} onChange={set("full_name")} autoFocus />}
      </Field>

      <Field
        label="Headline"
        required
        hint="One line the letter can introduce you with — a degree, a role, a specialism."
      >
        {(props) => (
          <Input
            {...props}
            value={form.headline}
            onChange={set("headline")}
            placeholder="B.Tech ECE, IIIT Bhagalpur (2025)"
          />
        )}
      </Field>

      <Field label="Phone" required hint="Printed in the sign-off, exactly as you type it here.">
        {(props) => <Input {...props} value={form.phone} onChange={set("phone")} />}
      </Field>

      <Field label="Contact email" required hint="Where you want replies to reach you.">
        {(props) => (
          <Input {...props} type="email" value={form.contact_email} onChange={set("contact_email")} />
        )}
      </Field>

      <Button type="submit" variant="primary" size="lg" loading={saving} disabled={incomplete} className="w-full">
        Continue
      </Button>
    </form>
  );
}

// ── 2 & 3. The two provider keys ──

function KeyStep({
  onSaved,
  fieldLabel,
  hint,
  placeholder,
  payloadKey,
  extra,
}: StepProps & {
  fieldLabel: string;
  hint: string;
  placeholder: string;
  payloadKey: "gemini_api_key" | "resend_api_key";
  /** The sender-email field, on the Resend step only. */
  extra?: { value: string; onChange: (v: string) => void };
}) {
  const [key, setKey] = useState("");
  const { saving, error, run } = useSubmit(onSaved);

  const incomplete = !key.trim() || (extra !== undefined && !extra.value.trim());

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run(() =>
          updateKeys({
            [payloadKey]: key.trim(),
            ...(extra ? { sender_email: extra.value.trim() } : {}),
          })
        );
      }}
    >
      <StepError message={error} />

      <Field label={fieldLabel} required hint={hint}>
        {(props) => (
          <Input
            {...props}
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder={placeholder}
            autoComplete="off"
            autoFocus
          />
        )}
      </Field>

      {extra && (
        <Field
          label="Sender email"
          required
          hint="Must be on a domain you have verified with Resend, or the send is refused."
        >
          {(props) => (
            <Input
              {...props}
              type="email"
              value={extra.value}
              onChange={(e) => extra.onChange(e.target.value)}
              placeholder="you@yourdomain.com"
            />
          )}
        </Field>
      )}

      <Button type="submit" variant="primary" size="lg" loading={saving} disabled={incomplete} className="w-full">
        {saving ? "Checking the key…" : "Continue"}
      </Button>
    </form>
  );
}

export function GeminiStep(props: StepProps) {
  return (
    <KeyStep
      {...props}
      payloadKey="gemini_api_key"
      fieldLabel="Gemini API key"
      placeholder="AIza…"
      hint="Get one free at aistudio.google.com/apikey. It is encrypted before it is stored and is only ever used for your own drafts."
    />
  );
}

export function EmailStep(props: StepProps) {
  const [senderEmail, setSenderEmail] = useState(props.keys?.sender_email ?? "");
  return (
    <KeyStep
      {...props}
      payloadKey="resend_api_key"
      fieldLabel="Resend API key"
      placeholder="re_…"
      hint="From resend.com/api-keys. Applications are sent on this key, from your own account."
      extra={{ value: senderEmail, onChange: setSenderEmail }}
    />
  );
}

// ── 4. Résumé ──

export function ResumeStep({ onSaved }: StepProps) {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { saving, error, setError, run } = useSubmit(onSaved);

  const accept = (incoming: File | undefined) => {
    if (!incoming) return;
    if (!incoming.name.toLowerCase().endsWith(".pdf")) {
      setError("Résumés have to be PDFs — that is the format attached to your applications.");
      return;
    }
    setError("");
    setFile(incoming);
  };

  return (
    <div>
      <StepError message={error} />

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          accept(e.dataTransfer.files[0]);
        }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "mb-4 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors",
          dragging ? "border-accent" : "border-border hover:border-[var(--border-strong)]"
        )}
        style={{ background: dragging ? "var(--accent-soft)" : "var(--surface)" }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,application/pdf"
          className="hidden"
          onChange={(e) => {
            accept(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        {file ? (
          <>
            <FileText size={22} className="mb-2 text-accent" />
            <p className="text-[13px] font-medium">{file.name}</p>
            <p className="mt-0.5 text-[12px] text-muted">{(file.size / 1024).toFixed(0)} KB · click to replace</p>
          </>
        ) : (
          <>
            <Upload size={22} className="mb-2 text-faint" />
            <p className="text-[13px] font-medium">Drop your résumé here</p>
            <p className="mt-0.5 text-[12px] text-muted">PDF, up to a few megabytes</p>
          </>
        )}
      </div>

      <Button
        variant="primary"
        size="lg"
        className="w-full"
        loading={saving}
        disabled={!file}
        onClick={() => file && run(() => uploadCanonicalFile("resume", file))}
      >
        {saving ? "Reading your résumé…" : "Finish setup"}
      </Button>
    </div>
  );
}
