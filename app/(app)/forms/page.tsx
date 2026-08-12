"use client";

import { useState } from "react";

import { approveForm, editAnswer, fillForm, getFormPreview, type FormFillPreview } from "@/lib/api";
import FormInput from "@/components/FormInput";
import FormPreview from "@/components/FormPreview";
import FormStatus from "@/components/FormStatus";
import { Button, ErrorNote, useToast } from "@/components/ui";

/** The statuses the backend reports, plus the two the UI owns while a request
 *  is in flight. Typed rather than a bare string so a typo in a comparison is
 *  a compile error instead of a branch that silently never runs. */
type Status =
  | "idle"
  | "extracting"
  | "generating"
  | "preview"
  | "filling"
  | "filled_awaiting_review"
  | "error";

export default function FormsPage() {
  const toast = useToast();
  const [status, setStatus] = useState<Status>("idle");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<FormFillPreview | null>(null);

  const handleSubmit = async (url: string, instructions: string) => {
    setLoading(true);
    setError("");
    setStatus("extracting");

    try {
      const res = await fillForm(url, instructions);
      setPreview(res);
      if (res.error) {
        setError(res.error);
        setStatus("error");
      } else {
        setStatus(res.status as Status);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read that form.");
      setStatus("error");
    } finally {
      setLoading(false);
    }
  };

  const handleEditAnswer = async (fieldId: string, value: string | string[]) => {
    if (!preview) return;
    try {
      setPreview(await editAnswer(preview.preview_id, fieldId, value));
    } catch (err) {
      // Previously logged to the console, so a rejected edit looked like it
      // had been accepted until the form was submitted with the old answer.
      toast.error(err instanceof Error ? err.message : "That edit wasn't saved.");
    }
  };

  const handleApprove = async () => {
    if (!preview) return;
    setLoading(true);
    setStatus("filling");

    try {
      const res = await approveForm(preview.preview_id);
      const updated = await getFormPreview(preview.preview_id);
      setPreview(res.screenshot_b64 ? { ...updated, filled_screenshot_b64: res.screenshot_b64 } : updated);
      setStatus(updated.status as Status);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not fill the form.");
      setStatus("error");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setStatus("idle");
    setPreview(null);
    setError("");
  };

  const showPreview =
    preview && (status === "preview" || status === "filled_awaiting_review" || status === "filling");

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[22px] font-semibold">Forms</h1>
          <p className="mt-0.5 text-[13px] text-muted">
            Answer an application form from your profile — reviewed by you before it is submitted.
          </p>
        </div>
        {status !== "idle" && (
          <Button size="sm" variant="ghost" onClick={reset}>
            Start over
          </Button>
        )}
      </header>

      <div className="flex flex-col gap-4">
        {(status === "idle" || status === "error") && (
          <FormInput onSubmit={handleSubmit} isLoading={loading} />
        )}

        {status !== "idle" && <FormStatus status={status} error={error} />}

        {status === "error" && error && <ErrorNote>{error}</ErrorNote>}

        {showPreview && (
          <FormPreview
            preview={preview}
            onEditAnswer={handleEditAnswer}
            onApprove={handleApprove}
            isApprovable={status === "preview"}
            approving={status === "filling"}
          />
        )}
      </div>
    </div>
  );
}
