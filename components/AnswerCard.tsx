"use client";

import { useState } from "react";
import { Edit2, Check, X, AlertCircle, Info } from "lucide-react";
import { FormAnswer, FormField } from "@/lib/api";

interface AnswerCardProps {
  field: FormField;
  answer?: FormAnswer;
  onEdit: (field_id: string, new_answer: string | string[]) => void;
  isEditingAny: boolean;
  setIsEditingAny: (isEditing: boolean) => void;
}

export default function AnswerCard({ field, answer, onEdit, isEditingAny, setIsEditingAny }: AnswerCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedValue, setEditedValue] = useState<string | string[]>(answer?.answer || "");

  const handleSave = () => {
    onEdit(field.field_id, editedValue);
    setIsEditing(false);
    setIsEditingAny(false);
  };

  const handleCancel = () => {
    setEditedValue(answer?.answer || "");
    setIsEditing(false);
    setIsEditingAny(false);
  };

  const startEdit = () => {
    setIsEditing(true);
    setIsEditingAny(true);
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 0.8) return "text-green-400 bg-green-500/10 border-green-500/30";
    if (score >= 0.5) return "text-yellow-400 bg-yellow-500/10 border-yellow-500/30";
    return "text-red-400 bg-red-500/10 border-red-500/30";
  };

  return (
    <div className="bg-[#1C2128] rounded-xl border border-[#3E4C59]/40 p-5 hover:border-cyan-500/20 transition-all group/card relative">
      
      {/* Header */}
      <div className="flex justify-between items-start gap-4 mb-3">
        <label className="text-sm font-semibold text-white flex items-center gap-1.5 flex-1">
          {field.question}
          {field.is_required && <span className="text-red-400 text-xs">*</span>}
        </label>
        
        <div className="flex items-center gap-2">
          {answer && (
            <div className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${getConfidenceColor(answer.confidence)}`}>
              {Math.round(answer.confidence * 100)}% Match
            </div>
          )}
          {!isEditing && (
            <button 
              onClick={startEdit}
              className="p-1 hover:bg-[#3E4C59]/20 rounded-lg text-[#8B949E] hover:text-cyan-400 opacity-0 group-hover/card:opacity-100 transition-opacity"
              disabled={isEditingAny}
            >
              <Edit2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Helper Text */}
      {field.helper_text && (
        <p className="text-xs text-[#8B949E] mb-3 flex items-start gap-1">
          <Info className="w-3.5 h-3.5 mt-0.5 text-cyan-500/50" />
          <span>{field.helper_text}</span>
        </p>
      )}

      {/* Answer Area */}
      {isEditing ? (
        <div className="space-y-2">
          {field.question_type === "long_text" ? (
            <textarea
              value={editedValue as string}
              onChange={(e) => setEditedValue(e.target.value)}
              className="w-full p-2 bg-[#0D1117] border border-cyan-500/40 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500 min-h-[80px]"
            />
          ) : field.options && field.options.length > 0 ? (
            <div className="space-y-1 ml-1">
              {field.options.map(opt => {
                const isChecked = Array.isArray(editedValue) 
                  ? editedValue.includes(opt) 
                  : editedValue === opt;
                
                return (
                  <label key={opt} className="flex items-center gap-2 text-sm text-[#E6EDF3] hover:bg-[#3E4C59]/10 p-1 rounded-md cursor-pointer">
                    <input
                      type={field.question_type === "checkbox" ? "checkbox" : "radio"}
                      name={field.field_id}
                      checked={isChecked}
                      onChange={(e) => {
                        if (field.question_type === "checkbox") {
                          const current = Array.isArray(editedValue) ? editedValue : [];
                          if (e.target.checked) {
                            setEditedValue([...current, opt]);
                          } else {
                            setEditedValue(current.filter(v => v !== opt));
                          }
                        } else {
                          setEditedValue(opt);
                        }
                      }}
                      className="rounded border-[#3E4C59] bg-[#0D1117] text-cyan-600 focus:ring-cyan-500/40 focus:ring-offset-0"
                    />
                    <span>{opt}</span>
                  </label>
                );
              })}
            </div>
          ) : (
            <input
              type="text"
              value={editedValue as string}
              onChange={(e) => setEditedValue(e.target.value)}
              className="w-full p-2 bg-[#0D1117] border border-cyan-500/40 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          )}
          
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={handleCancel} className="p-1.5 hover:bg-[#3E4C59]/20 rounded-lg text-red-400">
              <X className="w-4 h-4" />
            </button>
            <button onClick={handleSave} className="p-1.5 hover:bg-cyan-500/10 rounded-lg text-cyan-400">
              <Check className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <div className="pl-1">
          <p className="text-sm font-medium text-[#E6EDF3]">
            {answer?.answer 
              ? (Array.isArray(answer.answer) ? answer.answer.join(", ") : answer.answer) 
              : <span className="text-red-400 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> Empty</span>}
          </p>
          {answer?.reasoning && (
            <p className="text-xs text-[#8B949E] mt-1.5 italic">
              Why: {answer.reasoning}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
