"use client";

import { useRef, useState } from "react";

interface DiagramUploaderProps {
  unitId: string;
  diagramUrl: string | null;
  onUploaded: (newUrl: string | null) => void;
  onError: (message: string) => void;
  disabled?: boolean;
}

const ACCEPT = "image/jpeg,image/png,image/webp,image/gif";

/**
 * Spec diagram upload section. One image per brief; re-upload replaces.
 * Author-only on the server side; the editor passes through a disabled
 * flag during saves to prevent overlapping requests.
 *
 * UX:
 *   - Empty state: dashed dropzone + "Choose file" button.
 *   - Loaded state: image preview + Replace + Remove buttons.
 *   - Local progress flag (`busy`) gates the buttons. Network errors
 *     bubble up to the parent so they surface in the SaveStatusPill.
 */
export function DiagramUploader({
  unitId,
  diagramUrl,
  onUploaded,
  onError,
  disabled,
}: DiagramUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);

  const openPicker = () => {
    if (!busy && !disabled) {
      fileInputRef.current?.click();
    }
  };

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      onError("Only image files are allowed.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      onError("Image too large (max 10MB).");
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("unitId", unitId);
      const res = await fetch("/api/teacher/unit-brief/diagram", {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        onError(data.error ?? `Upload failed (${res.status})`);
        return;
      }
      const data = await res.json();
      onUploaded(data.brief?.diagram_url ?? null);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
      // Reset the input so re-picking the same file fires onChange again.
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const remove = async () => {
    if (busy || disabled) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/teacher/unit-brief/diagram?unitId=${encodeURIComponent(unitId)}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        onError(data.error ?? `Failed to remove diagram (${res.status})`);
        return;
      }
      onUploaded(null);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to remove diagram");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mb-8">
      <h2 className="mb-2 text-sm font-medium text-gray-700">Spec diagram</h2>
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
        data-testid="diagram-file-input"
      />

      {diagramUrl ? (
        <div className="rounded border border-gray-200 p-3">
          <div className="overflow-hidden rounded border border-gray-200 bg-gray-50">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={diagramUrl}
              alt="Spec diagram"
              data-testid="diagram-preview"
              className="block max-h-96 w-full object-contain"
            />
          </div>
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={openPicker}
              disabled={busy || disabled}
              data-testid="diagram-replace"
              className="rounded border border-gray-300 px-3 py-1 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Replace
            </button>
            <button
              type="button"
              onClick={() => void remove()}
              disabled={busy || disabled}
              data-testid="diagram-remove"
              className="rounded border border-red-300 px-3 py-1 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              Remove
            </button>
            {busy && (
              <span
                className="text-xs text-gray-500"
                data-testid="diagram-busy"
                aria-live="polite"
              >
                Working…
              </span>
            )}
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={openPicker}
          disabled={busy || disabled}
          data-testid="diagram-empty"
          className="flex w-full flex-col items-center justify-center gap-2 rounded border-2 border-dashed border-gray-300 bg-gray-50 px-3 py-8 text-sm text-gray-600 hover:border-indigo-400 hover:bg-indigo-50/40 disabled:opacity-50"
        >
          <span aria-hidden="true" className="text-3xl">📐</span>
          <span className="font-medium">
            {busy ? "Uploading…" : "Upload a spec diagram"}
          </span>
          <span className="text-xs text-gray-500">
            PNG / JPEG / WebP / GIF — up to 10MB. Replaces on re-upload.
          </span>
        </button>
      )}
    </section>
  );
}
