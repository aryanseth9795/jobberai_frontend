"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, KeyRound, Monitor, Moon, Send, Sun, TriangleAlert, User } from "lucide-react";

import { getKeys, updateKeys, type KeyStatus, type KeysResponse } from "@/lib/api";
import { buildKeysPayload, formFromKeys, isEmptyPayload, type SettingsForm } from "@/lib/settings";
import { writingNotesError } from "@/lib/writingNotes";
import { useTheme, type ThemeChoice } from "@/components/ThemeProvider";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Field,
  Input,
  Skeleton,
  Tabs,
  Textarea,
  useToast,
} from "@/components/ui";

type TabId = "identity" | "keys" | "email" | "preferences";

/**
 * Three states, not two.
 *
 * `unreadable` means a key is stored but cannot be decrypted — usually a
 * rotated ENCRYPTION_KEY. Rendering that as "configured" would tell the user
 * everything is fine while every draft fails, which is exactly why the
 * backend reports status separately from the boolean.
 */
function KeyState({ status }: { status: KeyStatus }) {
  if (status === "ok") return <Badge tone="success">Configured</Badge>;
  if (status === "unreadable") return <Badge tone="danger">Unreadable — re-enter it</Badge>;
  return <Badge>Not set</Badge>;
}

export default function SettingsPage() {
  const toast = useToast();
  const { choice, setChoice } = useTheme();

  const [tab, setTab] = useState<TabId>("identity");
  const [keys, setKeys] = useState<KeysResponse | null>(null);
  const [form, setForm] = useState<SettingsForm>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getKeys();
      setKeys(data);
      setForm(formFromKeys(data));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load your settings.");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const set = (field: string) => (value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
  };

  // Checked on every render rather than only on submit, so the message clears
  // itself as soon as enough is deleted.
  const notesError = writingNotesError(form.writing_notes ?? "");

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keys) return;

    if (notesError) {
      // The backend rejects this too. Stopping here just spares the round
      // trip and puts the message on the field rather than in a toast.
      setTab("identity");
      return;
    }

    const payload = buildKeysPayload(keys, form);
    if (isEmptyPayload(payload)) {
      toast.info("Nothing to save — no fields changed.");
      return;
    }

    setSaving(true);
    try {
      const updated = await updateKeys(payload);
      setKeys(updated);
      // Reset from the server's response so the secret inputs go back to empty
      // and the identity fields show what was actually stored after validation
      // and trimming.
      setForm(formFromKeys(updated));
      setSaved(true);
      toast.success("Settings saved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save your settings.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <Skeleton className="mb-5 h-8 w-40" />
        <Skeleton className="mb-3 h-9 w-full" />
        <Skeleton className="h-96 rounded-lg" />
      </div>
    );
  }

  const missingName = !keys?.full_name;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <header className="mb-5">
        <h1 className="font-display text-[22px] font-semibold">Settings</h1>
        <p className="mt-0.5 text-[13px] text-muted">
          Your keys and the identity that signs your cover emails. Everything here is
          per-account — none of it is shared with other users.
        </p>
      </header>

      {missingName && (
        <div
          className="mb-4 flex items-start gap-2 rounded-md border px-3 py-2.5 text-[12.5px]"
          style={{
            background: "var(--warning-soft)",
            borderColor: "var(--warning-line)",
            color: "var(--warning)",
          }}
        >
          <TriangleAlert size={14} className="mt-px shrink-0" />
          <span>Your full name isn&apos;t set, so drafting a cover email will fail.</span>
        </div>
      )}

      <div className="mb-4">
        <Tabs
          items={[
            { id: "identity", label: "Identity", icon: <User size={13} /> },
            { id: "keys", label: "API keys", icon: <KeyRound size={13} /> },
            { id: "email", label: "Email", icon: <Send size={13} /> },
            { id: "preferences", label: "Preferences", icon: <Monitor size={13} /> },
          ]}
          value={tab}
          onChange={(id: TabId) => setTab(id)}
        />
      </div>

      {tab === "preferences" ? (
        <Card>
          <CardHeader title="Appearance" description="Applies to this browser." />
          <CardBody>
            <p className="label mb-2">Theme</p>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { value: "light", label: "Light", icon: <Sun size={13} /> },
                  { value: "dark", label: "Dark", icon: <Moon size={13} /> },
                  { value: "system", label: "Match system", icon: <Monitor size={13} /> },
                ] as { value: ThemeChoice; label: string; icon: React.ReactNode }[]
              ).map((option) => (
                <Button
                  key={option.value}
                  variant={choice === option.value ? "primary" : "secondary"}
                  size="sm"
                  icon={option.icon}
                  aria-pressed={choice === option.value}
                  onClick={() => setChoice(option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
            <p className="mt-3 text-[12px] text-muted">
              &ldquo;Match system&rdquo; follows your operating system as it changes, including
              automatically at sunset.
            </p>
          </CardBody>
        </Card>
      ) : (
        <form onSubmit={handleSave}>
          {tab === "identity" && (
            <Card>
              <CardHeader
                title="Candidate identity"
                description="Typed in rather than read out of your résumé: a model asked to infer a phone number can produce a plausible wrong one, and nobody notices until an application goes out with a dead number on it. Your experience and projects still come from your uploaded documents."
              />
              <CardBody>
                <div className="grid gap-x-4 sm:grid-cols-2">
                  <Field label="Full name" required hint="Signs every cover email.">
                    {(p) => <Input {...p} value={form.full_name ?? ""} onChange={(e) => set("full_name")(e.target.value)} />}
                  </Field>
                  <Field label="Headline">
                    {(p) => (
                      <Input
                        {...p}
                        value={form.headline ?? ""}
                        onChange={(e) => set("headline")(e.target.value)}
                        placeholder="B.Tech ECE, IIIT Bhagalpur (2025)"
                      />
                    )}
                  </Field>
                  <Field label="Phone">
                    {(p) => <Input {...p} value={form.phone ?? ""} onChange={(e) => set("phone")(e.target.value)} />}
                  </Field>
                  <Field label="Contact email" hint="Falls back to your account email when unset.">
                    {(p) => (
                      <Input
                        {...p}
                        type="email"
                        value={form.contact_email ?? ""}
                        onChange={(e) => set("contact_email")(e.target.value)}
                      />
                    )}
                  </Field>
                  <Field label="Portfolio URL">
                    {(p) => (
                      <Input {...p} value={form.portfolio_url ?? ""} onChange={(e) => set("portfolio_url")(e.target.value)} />
                    )}
                  </Field>
                  <Field label="GitHub URL">
                    {(p) => <Input {...p} value={form.github_url ?? ""} onChange={(e) => set("github_url")(e.target.value)} />}
                  </Field>
                </div>

                <Field label="LinkedIn URL">
                  {(p) => <Input {...p} value={form.linkedin_url ?? ""} onChange={(e) => set("linkedin_url")(e.target.value)} />}
                </Field>

                {/* No counter and no `maxLength`. The cap is deliberately not
                    advertised — see lib/writingNotes.ts — so the only time a
                    number appears is when the text has actually gone past it,
                    where staying vague would leave the user guessing how much
                    to cut. `maxLength` is absent on purpose too: it silently
                    swallows the tail of a paste, which is the one failure mode
                    that gives no feedback at all. */}
                <Field
                  label="Writing notes"
                  hint="Emphasis and ordering preferences, injected verbatim into the prompt."
                  error={notesError ?? undefined}
                >
                  {(p) => (
                    <Textarea
                      {...p}
                      rows={4}
                      value={form.writing_notes ?? ""}
                      onChange={(e) => set("writing_notes")(e.target.value)}
                      placeholder="Lead with the internship, then side projects. Never mention years of experience."
                    />
                  )}
                </Field>
              </CardBody>
            </Card>
          )}

          {tab === "keys" && (
            <Card>
              <CardHeader
                title="Gemini"
                description="Used for drafting. The key is validated against Google before it is stored, so a typo fails here rather than at your first application."
              />
              <CardBody>
                <Field
                  label="Gemini API key"
                  hint="Leave blank to keep the current key."
                  aside={keys ? <KeyState status={keys.gemini_status} /> : null}
                >
                  {(p) => (
                    <Input
                      {...p}
                      type="password"
                      autoComplete="off"
                      value={form.gemini_api_key ?? ""}
                      onChange={(e) => set("gemini_api_key")(e.target.value)}
                      placeholder={keys?.gemini_api_key ?? "Paste your key"}
                    />
                  )}
                </Field>
              </CardBody>
            </Card>
          )}

          {tab === "email" && (
            <Card>
              <CardHeader
                title="Email delivery"
                description="Resend sends your applications. The sender address must be on a domain you have verified with them."
              />
              <CardBody>
                <Field
                  label="Resend API key"
                  hint="Leave blank to keep the current key."
                  aside={keys ? <KeyState status={keys.resend_status} /> : null}
                >
                  {(p) => (
                    <Input
                      {...p}
                      type="password"
                      autoComplete="off"
                      value={form.resend_api_key ?? ""}
                      onChange={(e) => set("resend_api_key")(e.target.value)}
                      placeholder={keys?.resend_api_key ?? "Paste your key"}
                    />
                  )}
                </Field>

                <div className="grid gap-x-4 sm:grid-cols-2">
                  <Field label="Sender email" hint="Must be on a domain verified with Resend.">
                    {(p) => (
                      <Input
                        {...p}
                        type="email"
                        value={form.sender_email ?? ""}
                        onChange={(e) => set("sender_email")(e.target.value)}
                      />
                    )}
                  </Field>
                  <Field label="Reply-to email" hint="Where replies land, if that differs.">
                    {(p) => (
                      <Input
                        {...p}
                        type="email"
                        value={form.reply_to_email ?? ""}
                        onChange={(e) => set("reply_to_email")(e.target.value)}
                      />
                    )}
                  </Field>
                </div>
              </CardBody>
            </Card>
          )}

          <div className="mt-4 flex items-center gap-3">
            <Button type="submit" variant="primary" loading={saving}>
              Save settings
            </Button>
            {saved && (
              <span className="flex items-center gap-1.5 text-[12.5px]" style={{ color: "var(--success)" }}>
                <Check size={13} /> Saved
              </span>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
