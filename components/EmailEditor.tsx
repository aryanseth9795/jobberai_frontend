"use client";

import { useState } from "react";

import { Button, Dialog, Field, Input, Textarea } from "@/components/ui";

export default function EmailEditor({
  hrEmail: initialHrEmail,
  subject: initialSubject,
  body: initialBody,
  jobTitle,
  onSave,
  onClose,
}: {
  hrEmail: string;
  subject: string;
  body: string;
  jobTitle: string;
  onSave: (hrEmail: string, subject: string, body: string) => void;
  onClose: () => void;
}) {
  const [hrEmail, setHrEmail] = useState(initialHrEmail || "");
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);

  const changed =
    hrEmail !== (initialHrEmail || "") || subject !== initialSubject || body !== initialBody;

  return (
    <Dialog
      open
      onClose={onClose}
      title="Edit this email"
      description={jobTitle}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!changed}
            onClick={() => onSave(hrEmail.trim(), subject, body)}
          >
            Save changes
          </Button>
        </>
      }
    >
      <Field
        label="To"
        required
        hint="Where the application is sent. Nothing goes out until you send the batch."
      >
        {(p) => (
          <Input
            {...p}
            type="email"
            value={hrEmail}
            onChange={(e) => setHrEmail(e.target.value)}
            placeholder="recruiter@company.com"
          />
        )}
      </Field>

      <Field label="Subject">
        {(p) => <Input {...p} value={subject} onChange={(e) => setSubject(e.target.value)} />}
      </Field>

      <Field
        label="Message"
        aside={
          <span className="text-[11px] tabular-nums text-faint">{body.length} characters</span>
        }
      >
        {(p) => (
          <Textarea
            {...p}
            rows={16}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="font-mono text-[12.5px] leading-relaxed"
          />
        )}
      </Field>
    </Dialog>
  );
}
