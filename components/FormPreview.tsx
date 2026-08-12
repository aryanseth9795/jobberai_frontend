"use client";

import { useState } from "react";
import Image from "next/image";
import { Check } from "lucide-react";

import type { FormAnswer, FormFillPreview } from "@/lib/api";
import { Badge, Button, Card, CardBody, CardHeader } from "@/components/ui";
import AnswerCard from "./AnswerCard";

export default function FormPreview({
  preview,
  onEditAnswer,
  onApprove,
  isApprovable,
  approving = false,
}: {
  preview: FormFillPreview;
  onEditAnswer: (fieldId: string, value: string | string[]) => void;
  onApprove: () => void;
  isApprovable: boolean;
  approving?: boolean;
}) {
  const [editingAny, setEditingAny] = useState(false);

  const fields = preview.fields ?? [];
  const answers = preview.answers ?? [];
  const answerFor = (fieldId: string): FormAnswer | undefined =>
    answers.find((a) => a.field_id === fieldId);

  const unanswered = fields.filter((f) => {
    const value = answerFor(f.field_id)?.answer;
    return f.is_required && (!value || (Array.isArray(value) && value.length === 0));
  }).length;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader
          title={preview.form_title || "Untitled form"}
          description={`${fields.length} question${fields.length === 1 ? "" : "s"} · ${preview.provider}`}
          action={
            <div className="flex items-center gap-2">
              {unanswered > 0 && <Badge tone="warning">{unanswered} required blank</Badge>}
              <Button
                variant="primary"
                size="sm"
                icon={<Check size={13} />}
                onClick={onApprove}
                loading={approving}
                // Blocked while a card is open: submitting mid-edit would send
                // the previous answer and silently discard what is on screen.
                disabled={!isApprovable || editingAny}
              >
                Approve and fill
              </Button>
            </div>
          }
        />
        {editingAny && (
          <CardBody className="py-2.5">
            <p className="text-[12px] text-muted">Finish editing to enable submission.</p>
          </CardBody>
        )}
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        {fields.map((field) => (
          <AnswerCard
            key={field.field_id}
            field={field}
            answer={answerFor(field.field_id)}
            onEdit={onEditAnswer}
            isEditingAny={editingAny}
            setIsEditingAny={setEditingAny}
          />
        ))}
      </div>

      {preview.filled_screenshot_b64 && (
        <Card>
          <CardHeader
            title="The filled form"
            description="A screenshot of the page after filling, so you can check it before submitting."
          />
          <CardBody>
            <div className="overflow-hidden rounded-md border border-border">
              <Image
                src={`data:image/png;base64,${preview.filled_screenshot_b64}`}
                alt="The application form, filled in"
                width={1200}
                height={800}
                unoptimized
                className="h-auto w-full"
              />
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
