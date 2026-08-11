"use client";

import { useState } from "react";
import FormInput from "@/components/FormInput";
import FormStatus from "@/components/FormStatus";
import FormPreview from "@/components/FormPreview";
import { fillForm, getFormPreview, editAnswer, approveForm, FormFillPreview } from "@/lib/api";
import { ArrowLeft, Sparkles } from "lucide-react";

export default function FormsPage() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>("idle"); // idle, extracting, generating, preview, filling, filled_awaiting_review, error
  const [error, setError] = useState<string>("");
  const [preview, setPreview] = useState<FormFillPreview | null>(null);

  const handleFormSubmit = async (url: string, instructions: string) => {
    setLoading(true);
    setError("");
    setStatus("extracting");
    
    try {
      const res = await fillForm(url, instructions);
      setPreview(res);
      setStatus(res.status); // Usually "preview" after extraction
      
      if (res.error) {
        setError(res.error);
        setStatus("error");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred during form extraction");
      setStatus("error");
    } finally {
      setLoading(false);
    }
  };

  const handleEditAnswer = async (field_id: string, new_answer: string | string[]) => {
    if (!preview) return;
    try {
      const updated = await editAnswer(preview.preview_id, field_id, new_answer);
      setPreview(updated);
    } catch (err: any) {
      console.error("Failed to edit answer:", err);
    }
  };

  const handleApprove = async () => {
    if (!preview) return;
    setLoading(true);
    setStatus("filling"); // Dummy status for frontend UI
    
    try {
      const res = await approveForm(preview.preview_id);
      
      // Re-fetch preview to get updated status and screenshot
      const updated = await getFormPreview(preview.preview_id);
      setPreview(updated);
      setStatus(updated.status); // Should be filled_awaiting_review
      
      if (res.screenshot_b64) {
         setPreview({ ...updated, filled_screenshot_b64: res.screenshot_b64 });
      }
    } catch (err: any) {
      setError(err.message || "Failed to fill form");
      setStatus("error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#0D1117] text-[#E6EDF3] py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Breadcrumb / Top Bar */}
        <div className="flex items-center justify-between">
          <a href="/" className="flex items-center gap-1.5 text-sm text-[#8B949E] hover:text-cyan-400 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span>Back to NeuralMailer</span>
          </a>
          <div className="flex items-center gap-2 text-xs text-[#8B949E]">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span>NeuralAgent Microservice Online</span>
          </div>
        </div>

        {/* Input Pane */}
        {status === "idle" || status === "error" ? (
          <FormInput onSubmit={handleFormSubmit} isLoading={loading} />
        ) : null}

        {/* Status Pane */}
        {status !== "idle" && (
          <FormStatus status={status} error={error} />
        ) }

        {/* Error view with retry */}
        {status === "error" && (
           <div className="text-center bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
             {error}
           </div>
        )}

        {/* Preview and Action Pane */}
        {preview && (status === "preview" || status === "filled_awaiting_review" || status === "filling") && (
          <FormPreview 
            preview={preview}
            onEditAnswer={handleEditAnswer}
            onApprove={handleApprove}
            isApprovable={status === "preview"} // Only allow click in correct state
          />
        )}

      </div>
    </main>
  );
}
