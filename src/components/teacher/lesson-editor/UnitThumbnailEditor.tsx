"use client";

import { useRef, useState, useMemo } from "react";

interface UnitThumbnailEditorProps {
  unitId: string;
  thumbnailUrl: string | null;
  unitTitle: string | null;
  onThumbnailChange: (url: string) => void;
}

// Match the gradient palette from UnitThumbnail.tsx
const GRADIENT_PALETTE = [
  "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
  "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
  "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
  "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
  "linear-gradient(135deg, #30cfd0 0%, #330867 100%)",
  "linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)",
  "linear-gradient(135deg, #ff9a56 0%, #ff6a88 100%)",
];

function hashTitle(title: string): number {
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    const char = title.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash) % GRADIENT_PALETTE.length;
}

export default function UnitThumbnailEditor({
  unitId,
  thumbnailUrl,
  unitTitle,
  onThumbnailChange,
}: UnitThumbnailEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const gradient = useMemo(
    () => GRADIENT_PALETTE[hashTitle(unitTitle || "Unit")],
    [unitTitle]
  );

  const handleUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Only images allowed");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Max 5MB");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("unitId", unitId);

      const res = await fetch("/api/teacher/upload-unit-image", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Upload failed");
        return;
      }

      const { url } = await res.json();
      onThumbnailChange(url);
    } catch {
      setError("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="relative group">
      {/* Thumbnail preview */}
      <div
        className="w-full aspect-[16/5] rounded-lg overflow-hidden cursor-pointer border border-gray-200"
        onClick={() => fileInputRef.current?.click()}
      >
        {thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbnailUrl}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ background: gradient }}
          >
            <svg
              width="32"
              height="32"
              viewBox="0 0 100 100"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              style={{ opacity: 0.4 }}
            >
              <line x1="30" y1="20" x2="30" y2="80" stroke="white" strokeWidth="8" strokeLinecap="round" />
              <line x1="70" y1="20" x2="70" y2="80" stroke="white" strokeWidth="8" strokeLinecap="round" />
              <line x1="20" y1="40" x2="80" y2="40" stroke="white" strokeWidth="8" strokeLinecap="round" />
              <line x1="20" y1="60" x2="80" y2="60" stroke="white" strokeWidth="8" strokeLinecap="round" />
            </svg>
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors rounded-lg flex items-center justify-center">
          <span className="opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs font-medium flex items-center gap-1.5">
            {uploading ? (
              <div className="animate-spin w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            )}
            {uploading ? "Uploading..." : "Change image"}
          </span>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleUpload(file);
          e.target.value = "";
        }}
      />

      {/* Error message */}
      {error && (
        <p className="text-[10px] text-red-500 mt-1 px-1">{error}</p>
      )}
    </div>
  );
}
