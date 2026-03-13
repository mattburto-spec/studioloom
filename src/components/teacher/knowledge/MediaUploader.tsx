"use client";

import { useState, useRef } from "react";
import { compressImage } from "@/lib/compress-image";

interface MediaUploaderProps {
  value: string | null;
  onChange: (url: string | null) => void;
  accept?: string;
  label?: string;
  maxSizeMB?: number;
}

export default function MediaUploader({
  value,
  onChange,
  accept = "image/*,video/*,audio/*,.pdf",
  label = "Upload media",
  maxSizeMB = 50,
}: MediaUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError("");
    setUploading(true);

    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(`File too large (max ${maxSizeMB}MB)`);
      setUploading(false);
      return;
    }

    try {
      // Compress images
      setProgress("Preparing...");
      const processed = await compressImage(file, { maxSizeMB: 2, maxWidthOrHeight: 2400 });

      setProgress("Uploading...");
      const formData = new FormData();
      formData.append("file", processed);

      const res = await fetch("/api/teacher/knowledge/media", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Upload failed");
      }

      const data = await res.json();
      onChange(data.url);
      setProgress("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setProgress("");
    } finally {
      setUploading(false);
    }
  }

  function handleRemove() {
    onChange(null);
  }

  const isImage = value?.match(/\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i);

  return (
    <div>
      {value ? (
        <div className="border border-border rounded-lg p-3 bg-gray-50/50">
          <div className="flex items-center gap-3">
            {isImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={value}
                alt="Uploaded media"
                className="w-16 h-16 rounded-lg object-cover"
              />
            ) : (
              <div className="w-16 h-16 rounded-lg bg-gray-200 flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs text-text-secondary truncate">{value.split("/").pop()}</p>
            </div>
            <button
              type="button"
              onClick={handleRemove}
              className="text-text-secondary/40 hover:text-red-400 transition"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      ) : (
        <div
          className="border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:border-brand-purple/40 transition"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files[0];
            if (file) handleFile(file);
          }}
        >
          {uploading ? (
            <div className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-brand-purple/30 border-t-brand-purple rounded-full animate-spin" />
              <span className="text-xs text-text-secondary">{progress}</span>
            </div>
          ) : (
            <>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-1">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <p className="text-xs text-text-secondary">{label}</p>
            </>
          )}
        </div>
      )}

      {error && (
        <p className="text-xs text-red-500 mt-1">{error}</p>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
