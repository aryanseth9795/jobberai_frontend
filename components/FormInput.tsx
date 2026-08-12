"use client";

import { useState } from "react";
import { Link2 } from "lucide-react";

import { Button, Card, CardBody, CardHeader, Field, Input, Textarea } from "@/components/ui";

export default function FormInput({
  onSubmit,
  isLoading,
}: {
  onSubmit: (url: string, instructions: string) => void;
  isLoading: boolean;
}) {
  const [url, setUrl] = useState("");
  const [instructions, setInstructions] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    onSubmit(url.trim(), instructions.trim());
  };

  return (
    <Card>
      <CardHeader
        title="Fill an application form"
        description="Paste a Google Form, Typeform or Jotform link. The questions are read, answered from your profile, and shown to you before anything is submitted."
      />
      <CardBody>
        <form onSubmit={handleSubmit}>
          <Field label="Form URL" required>
            {(p) => (
              <div className="relative">
                <Link2
                  size={14}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint"
                />
                <Input
                  {...p}
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  disabled={isLoading}
                  placeholder="https://docs.google.com/forms/…"
                  className="pl-8"
                />
              </div>
            )}
          </Field>

          <Field
            label="Instructions"
            hint="Optional. Steers how the answers are written, the same way writing notes do for cover emails."
          >
            {(p) => (
              <Textarea
                {...p}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                disabled={isLoading}
                rows={3}
                placeholder="Emphasise my Next.js experience. Prefer remote options."
              />
            )}
          </Field>

          <Button type="submit" variant="primary" loading={isLoading} disabled={!url.trim()}>
            {isLoading ? "Reading the form…" : "Read and answer"}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
