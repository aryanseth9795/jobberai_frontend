"use client";

import { useState } from "react";
import { Link, Sparkles, Send } from "lucide-react";

interface FormInputProps {
  onSubmit: (url: string, instructions: string) => void;
  isLoading: boolean;
}

export default function FormInput({ onSubmit, isLoading }: FormInputProps) {
  const [url, setUrl] = useState("");
  const [instructions, setInstructions] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    onSubmit(url.trim(), instructions.trim());
  };

  return (
    <div className="bg-[#1C2128] rounded-2xl border border-[#3E4C59]/40 p-6 sm:p-8 shadow-2xl relative overflow-hidden group">
      {/* Decorative gradient orb */}
      <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl group-hover:bg-cyan-500/20 transition-all duration-700" />
      
      <div className="relative z-10 flex flex-col items-center mb-8">
        <div className="w-16 h-16 bg-gradient-to-tr from-cyan-600/20 to-teal-400/20 rounded-2xl p-0.5 border border-cyan-500/30 mb-4 shadow-[0_0_15px_rgba(6,182,212,0.15)] flex items-center justify-center">
          <Sparkles className="w-8 h-8 text-cyan-400" />
        </div>
        <h2 className="text-2xl font-semibold text-white tracking-tight mb-2">NeuralAgent</h2>
        <p className="text-[#8B949E] text-center text-sm max-w-md">
          Provide a link to any Google Form, Typeform, or Jotform. I'll analyze the questions, structure the best answers, and fill it for you.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="relative z-10 space-y-4">
        {/* URL Input */}
        <div className="group/input relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Link className="h-5 w-5 text-cyan-500/50 group-focus-within/input:text-cyan-400 transition-colors" />
          </div>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={isLoading}
            placeholder="https://docs.google.com/forms/..."
            className="block w-full pl-12 pr-4 py-4 bg-[#0D1117] border border-[#3E4C59] rounded-xl text-white placeholder-[#8B949E] focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all shadow-inner disabled:opacity-50"
            required
          />
        </div>
        
        {/* Instructions Input */}
        <div className="group/input relative">
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            disabled={isLoading}
            placeholder="Optional instructions (e.g. 'Emphasize my Next.js experience', 'Prefer remote options')"
            className="block w-full p-4 bg-[#0D1117] border border-[#3E4C59] rounded-xl text-white placeholder-[#8B949E] focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all shadow-inner disabled:opacity-50 min-h-[100px] resize-y"
          />
        </div>

        {/* Action Bar */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isLoading || !url.trim()}
            className="flex items-center gap-2 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white font-medium py-3 px-8 rounded-xl transition-all duration-300 transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(6,182,212,0.2)] hover:shadow-[0_0_30px_rgba(6,182,212,0.4)]"
          >
            {isLoading ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Initializing Agent...</span>
              </>
            ) : (
              <>
                <span>Extract & Answer</span>
                <Send className="w-4 h-4 ml-1" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
