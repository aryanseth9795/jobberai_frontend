"use client";

import { useCallback, useState, useEffect } from "react";

interface Props {
  onFilesSelected: (files: File[]) => void;
  isLoading: boolean;
}

const ACCEPTED = ["image/png", "image/jpeg", "image/webp", "application/pdf"];
const ACCEPTED_EXT = ".png,.jpg,.jpeg,.webp,.pdf,.docx";

export default function FileUploader({ onFilesSelected, isLoading }: Props) {
  const [dragging, setDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  // Listen for clipboard pastes (e.g. Snipping Tool screenshots)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      // Ignore if pasting text inside an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.clipboardData && e.clipboardData.files.length > 0) {
        e.preventDefault();
        const files = Array.from(e.clipboardData.files);
        const valid = files.filter(
          (f) => ACCEPTED.includes(f.type) || f.name.endsWith(".docx")
        );
        if (valid.length > 0) {
          setSelectedFiles((prev) => {
            // Merge files to keep unique names/sizes (simple deduplication)
            const map = new Map(prev.map(f => [f.name + f.size, f]));
            valid.forEach(f => map.set(f.name + f.size, f));
            return Array.from(map.values());
          });
        }
      }
    };

    window.addEventListener("paste", handlePaste as EventListener);
    return () => window.removeEventListener("paste", handlePaste as EventListener);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const files = Array.from(e.dataTransfer.files);
      const valid = files.filter(
        (f) => ACCEPTED.includes(f.type) || f.name.endsWith(".docx")
      );
      setSelectedFiles(valid);
    },
    []
  );

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedFiles(files);
  };

  const removeFile = (idx: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = () => {
    if (selectedFiles.length > 0) {
      onFilesSelected(selectedFiles);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className="relative rounded-2xl border-2 border-dashed transition-all duration-300 cursor-pointer"
        style={{
          borderColor: dragging ? "var(--accent)" : "var(--border-hover)",
          background: dragging ? "var(--accent-glow)" : "var(--bg-card)",
          minHeight: 200,
        }}
        onClick={() => document.getElementById("file-input")?.click()}
      >
        <input
          id="file-input"
          type="file"
          multiple
          accept={ACCEPTED_EXT}
          className="hidden"
          onChange={handleFileInput}
        />
        <div className="flex flex-col items-center justify-center gap-4 p-12">
          <div
            className="text-5xl transition-transform duration-300"
            style={{ transform: dragging ? "scale(1.2)" : "scale(1)" }}
          >
            📂
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
              Drop job screenshots or files here
            </p>
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
              PNG, JPG, WebP, PDF • Multiple files supported
            </p>
          </div>
          <span className="btn-ghost text-sm px-4 py-2">Browse Files</span>
        </div>
      </div>

      {/* Selected files list */}
      {selectedFiles.length > 0 && (
        <div className="flex flex-col gap-2 fade-in">
          <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
            {selectedFiles.length} file{selectedFiles.length > 1 ? "s" : ""} selected
          </p>
          {selectedFiles.map((file, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between rounded-xl px-4 py-3"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">
                  {file.type === "application/pdf" ? "📄" : "🖼️"}
                </span>
                <div>
                  <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                    {file.name}
                  </p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {formatSize(file.size)}
                  </p>
                </div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); removeFile(idx); }}
                className="text-sm hover:text-red-400 transition-colors"
                style={{ color: "var(--text-muted)" }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Submit button */}
      <button
        className="btn-primary flex items-center justify-center gap-3 py-3 text-base"
        onClick={handleSubmit}
        disabled={selectedFiles.length === 0 || isLoading}
      >
        {isLoading ? (
          <>
            <div className="spinner" />
            <span>Analyzing jobs with AI...</span>
          </>
        ) : (
          <>
            <span>🤖</span>
            <span>Extract & Draft Emails</span>
          </>
        )}
      </button>
    </div>
  );
}
