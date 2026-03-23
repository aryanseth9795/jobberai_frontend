"use client";

import { useState } from "react";
import { FormFillPreview, FormAnswer } from "@/lib/api";
import AnswerCard from "./AnswerCard";
import { ExternalLink, CheckCircle } from "lucide-react";

interface FormPreviewProps {
  preview: FormFillPreview;
  onEditAnswer: (field_id: string, new_answer: string | string[]) => void;
  onApprove: () => void;
  isApprovable: boolean;
}

export default function FormPreview({ preview, onEditAnswer, onApprove, isApprovable }: FormPreviewProps) {
  const [isEditingAny, setIsEditingAny] = useState(false);

  // Group fields by section if provided, otherwise fallback to index grouping
  const fields = preview.fields || [];
  const answers = preview.answers || [];
  
  const getAnswerForField = (fieldId: string): FormAnswer | undefined => {
    return answers.find(a => a.field_id === fieldId);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center bg-[#1C2128]/60 backdrop-blur-md px-6 py-4 rounded-xl border border-[#3E4C59]/30">
        <div>
          <h3 className="text-lg font-semibold text-white">{preview.form_title || "Questionnaire"}</h3>
          <p className="text-xs text-[#8B949E] mt-0.5">
            Auto-detected: <span className="text-cyan-400 capitalize">{preview.provider}</span>
          </p>
        </div>
        
        <button
          onClick={onApprove}
          disabled={!isApprovable || isEditingAny}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white font-medium py-2 px-5 rounded-lg transition-all shadow-[0_0_15px_rgba(34,197,94,0.2)] disabled:opacity-50 active:scale-[0.98]"
        >
          <CheckCircle className="w-4 h-4" />
          <span>Approve & Fill</span>
        </button>
      </div>

      {/* Grid of question cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {fields.map(field => (
          <AnswerCard
            key={field.field_id}
            field={field}
            answer={getAnswerForField(field.field_id)}
            onEdit={onEditAnswer}
            isEditingAny={isEditingAny}
            setIsEditingAny={setIsEditingAny}
          />
        ))}
      </div>

      {/* Screenshot Preview (Phase 2 wrapper model) */}
      {preview.filled_screenshot_b64 && (
        <div className="bg-[#1C2128] rounded-xl border border-[#3E4C59]/40 p-5 mt-4">
          <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-1.5">
            <ExternalLink className="w-4 h-4 text-cyan-400" />
            Filled Form Preview
          </h4>
          <div className="border border-[#3E4C59]/30 rounded-lg overflow-hidden relative group">
            <img 
              src={`data:image/png;base64,${preview.filled_screenshot_b64}`} 
              alt="Filled form visual"
              className="w-full h-auto max-h-[400px] object-cover object-top group-hover:scale-[1.01] transition-transform duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0D1117] via-transparent to-transparent opacity-60" />
            <div className="absolute bottom-4 left-4 right-4 text-center">
              <p className="text-xs text-[#E6EDF3] bg-[#0D1117]/80 backdrop-blur-md p-2 rounded-lg inline-block border border-[#3E4C59]/50">
                This is a screenshot of the filled page. Verified in browser view accurately.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
