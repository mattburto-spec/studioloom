"use client";

import { useState, useRef } from "react";
import { compressImage } from "@/lib/compress-image";
import { checkClientImage, IMAGE_MODERATION_MESSAGES } from "@/lib/content-safety/client-image-filter";

interface UploadInputProps {
  value: string;
  onChange: (v: string) => void;
  unitId?: string;
  pageId?: string;
  sectionIndex: number;
}

export function UploadInput({
  value,
  onChange,
  unitId,
  pageId,
  sectionIndex,
}: UploadInputProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Parse existing value as JSON if it contains upload data
  const uploadData =
    value && value.startsWith("{")
      ? (() => {
          try {
            return JSON.parse(value);
          } catch {
            return null;
          }
        })()
      : null;

  async function handleFile(file: File) {
    if (!unitId || !pageId) return;
    setUploadError(null);

    // Image safety check — before compression to save CPU
    if (file.type.startsWith("image/")) {
      const imageCheck = await checkClientImage(file);
      if (!imageCheck.ok) {
        setUploadError(IMAGE_MODERATION_MESSAGES.en);
        fetch("/api/safety/log-client-block", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source: "upload_image",
            flags: imageCheck.flags,
            layer: "client_image",
          }),
        }).catch(() => {});
        return;
      }
    }

    setUploading(true);

    // Compress images before upload (5-8MB → ~400KB)
    const processedFile = await compressImage(file);

    const formData = new FormData();
    formData.append("file", processedFile);
    formData.append("unitId", unitId);
    formData.append("pageId", pageId);

    try {
      const res = await fetch("/api/student/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.url) {
        onChange(
          JSON.stringify({
            type: "upload",
            url: data.url,
            filename: data.filename || file.name,
            size: data.size || file.size,
            mimeType: data.type || file.type,
          })
        );
      }
    } catch (err) {
      console.error("Upload failed:", err);
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  return (
    <div>
      {uploadData ? (
        <div className="border border-border rounded-lg p-4 flex items-center gap-3">
          {uploadData.mimeType?.startsWith("image/") ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={uploadData.url}
              alt={uploadData.filename}
              className="w-20 h-20 object-cover rounded"
            />
          ) : (
            <div className="w-12 h-12 bg-surface-alt rounded flex items-center justify-center text-xl">
              📄
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-text-primary truncate">
              {uploadData.filename}
            </p>
            <p className="text-xs text-text-secondary">
              {(uploadData.size / 1024).toFixed(1)} KB
            </p>
          </div>
          <button
            onClick={() => onChange("")}
            className="text-xs text-red-400 hover:text-red-600"
          >
            Remove
          </button>
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition ${
            dragActive
              ? "border-accent-blue bg-accent-blue/5"
              : "border-border hover:border-accent-blue/50"
          }`}
        >
          {uploading ? (
            <div className="space-y-2">
              <div className="w-8 h-8 border-2 border-accent-blue border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-text-secondary text-sm">Uploading...</p>
            </div>
          ) : (
            <>
              <p className="text-2xl mb-2">📎</p>
              <p className="text-text-secondary text-sm">
                Drag and drop a file here, or click to browse
              </p>
              <p className="text-text-secondary/60 text-xs mt-1">
                Images, PDFs, documents (max 10MB)
              </p>
            </>
          )}
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            id={`upload-${sectionIndex}`}
            accept="image/*,.pdf,.doc,.docx,audio/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
        </div>
      )}
      {uploadError && (
        <p className="text-red-500 text-sm mt-2">{uploadError}</p>
      )}
    </div>
  );
}
