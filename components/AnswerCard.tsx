"use client";

import { useState } from "react";
import { AlertCircle, Check, Info, Pencil, X } from "lucide-react";

import type { FormAnswer, FormField } from "@/lib/api";
import { Badge, Button, Input, Textarea } from "@/components/ui";

/**
 * How sure the model is about an answer.
 *
 * Worth showing because the user is about to submit this to a real employer,
 * and a low-confidence answer is the one worth reading before it goes. The
 * badge always carries the number as text — the colour is a second cue, never
 * the only one.
 */
function Confidence({ score }: { score: number }) {
  const tone = score >= 0.8 ? "success" : score >= 0.5 ? "warning" : "danger";
  return <Badge tone={tone}>{Math.round(score * 100)}% sure</Badge>;
}

export default function AnswerCard({
  field,
  answer,
  onEdit,
  isEditingAny,
  setIsEditingAny,
}: {
  field: FormField;
  answer?: FormAnswer;
  onEdit: (fieldId: string, value: string | string[]) => void;
  isEditingAny: boolean;
  setIsEditingAny: (editing: boolean) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState<string | string[]>(answer?.answer ?? "");

  const save = () => {
    onEdit(field.field_id, value);
    setEditing(false);
    setIsEditingAny(false);
  };

  const cancel = () => {
    setValue(answer?.answer ?? "");
    setEditing(false);
    setIsEditingAny(false);
  };

  const hasOptions = field.options && field.options.length > 0;

  return (
    <div className="rounded-lg border border-border bg-surface p-3.5">
      <div className="mb-2 flex items-start justify-between gap-3">
        <p className="flex-1 text-[12.5px] font-medium">
          {field.question}
          {field.is_required && (
            <span style={{ color: "var(--danger)" }} aria-label="required">
              {" "}
              *
            </span>
          )}
        </p>
        <div className="flex shrink-0 items-center gap-1.5">
          {answer && <Confidence score={answer.confidence} />}
          {!editing && (
            <Button
              size="sm"
              variant="ghost"
              disabled={isEditingAny}
              aria-label={`Edit the answer to "${field.question}"`}
              onClick={() => {
                setEditing(true);
                setIsEditingAny(true);
              }}
            >
              <Pencil size={12} />
            </Button>
          )}
        </div>
      </div>

      {field.helper_text && (
        <p className="mb-2 flex items-start gap-1.5 text-[11.5px] text-muted">
          <Info size={12} className="mt-px shrink-0 text-faint" />
          <span>{field.helper_text}</span>
        </p>
      )}

      {editing ? (
        <div className="flex flex-col gap-2">
          {field.question_type === "long_text" ? (
            <Textarea rows={4} value={value as string} onChange={(e) => setValue(e.target.value)} autoFocus />
          ) : hasOptions ? (
            <div className="flex flex-col gap-0.5">
              {field.options.map((option) => {
                const checked = Array.isArray(value) ? value.includes(option) : value === option;
                const multi = field.question_type === "checkbox";
                return (
                  <label
                    key={option}
                    className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-[12.5px] hover:bg-surface-2"
                  >
                    <input
                      type={multi ? "checkbox" : "radio"}
                      name={field.field_id}
                      checked={checked}
                      onChange={(e) => {
                        if (!multi) return setValue(option);
                        const current = Array.isArray(value) ? value : [];
                        setValue(
                          e.target.checked
                            ? [...current, option]
                            : current.filter((v) => v !== option)
                        );
                      }}
                      className="h-3.5 w-3.5 accent-[var(--accent)]"
                    />
                    {option}
                  </label>
                );
              })}
            </div>
          ) : (
            <Input value={value as string} onChange={(e) => setValue(e.target.value)} autoFocus />
          )}

          <div className="flex justify-end gap-1.5">
            <Button size="sm" variant="ghost" icon={<X size={12} />} onClick={cancel}>
              Cancel
            </Button>
            <Button size="sm" variant="primary" icon={<Check size={12} />} onClick={save}>
              Save
            </Button>
          </div>
        </div>
      ) : (
        <>
          {answer?.answer && (Array.isArray(answer.answer) ? answer.answer.length > 0 : true) ? (
            <p className="whitespace-pre-wrap text-[12.5px]">
              {Array.isArray(answer.answer) ? answer.answer.join(", ") : answer.answer}
            </p>
          ) : (
            <p className="flex items-center gap-1.5 text-[12.5px]" style={{ color: "var(--warning)" }}>
              <AlertCircle size={12} /> No answer — edit this before submitting
            </p>
          )}
          {answer?.reasoning && (
            <p className="mt-1.5 text-[11.5px] text-muted">{answer.reasoning}</p>
          )}
        </>
      )}
    </div>
  );
}
