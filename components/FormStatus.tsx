"use client";

import { CheckCircle2, Circle, Loader2, AlertCircle } from "lucide-react";

interface FormStatusProps {
  status: string; // "extracting" | "generating" | "preview" | "filling" | "filled_awaiting_review" | "error"
  error?: string;
}

export default function FormStatus({ status, error }: FormStatusProps) {
  const steps = [
    { id: "extracting", label: "Analyze Form structure", activeStatuses: ["extracting"] },
    { id: "generating", label: "Generate Answers (RAG)", activeStatuses: ["generating"] },
    { id: "preview", label: "Awaiting review", activeStatuses: ["preview"] },
    { id: "filled_awaiting_review", label: "Form Filled", activeStatuses: ["filled_awaiting_review"] },
  ];

  const getCurrentStepIndex = () => {
    if (status === "error") return -1;
    return steps.findIndex(s => s.activeStatuses.includes(status));
  };

  const currentIndex = getCurrentStepIndex();

  return (
    <div className="bg-[#1C2128]/80 backdrop-blur-md rounded-2xl border border-[#3E4C59]/30 p-5 shadow-lg">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {status === "error" ? (
            <div className="w-10 h-10 bg-red-500/10 rounded-xl flex items-center justify-center border border-red-500/30">
              <AlertCircle className="w-5 h-5 text-red-400" />
            </div>
          ) : status === "filled_awaiting_review" ? (
            <div className="w-10 h-10 bg-green-500/10 rounded-xl flex items-center justify-center border border-green-500/30">
              <CheckCircle2 className="w-5 h-5 text-green-400" />
            </div>
          ) : (
            <div className="w-10 h-10 bg-cyan-500/10 rounded-xl flex items-center justify-center border border-cyan-500/30">
              <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
            </div>
          )}
          <div>
            <h3 className="font-medium text-white">
              {status === "error" ? "Task Failed" : status === "filled_awaiting_review" ? "Form Filled!" : "Processing Form..."}
            </h3>
            <p className="text-xs text-[#8B949E] mt-0.5">
              {error || (status === "preview" ? "Verify answers below before filling" : "NeuralAgent is running workflows")}
            </p>
          </div>
        </div>

        {/* Desktop Pipeline Visualizer */}
        <div className="hidden sm:flex items-center gap-1">
          {steps.map((step, idx) => {
            const isCompleted = idx < currentIndex || status === "filled_awaiting_review";
            const isCurrent = idx === currentIndex;
            
            return (
              <div key={step.id} className="flex items-center">
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${
                  isCompleted 
                    ? "bg-green-500/10 border-green-500/30 text-green-400" 
                    : isCurrent 
                    ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-400" 
                    : "bg-[#0D1117] border-[#3E4C59]/40 text-[#8B949E]"
                }`}>
                  {isCompleted ? <CheckCircle2 className="w-3.5 h-3.5" /> : isCurrent ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Circle className="w-3.5 h-3.5" />}
                  <span>{step.label}</span>
                </div>
                {idx < steps.length - 1 && (
                  <div className={`h-[1px] w-4 ${isCompleted ? "bg-green-500/40" : "bg-[#3E4C59]/40"}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
