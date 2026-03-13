"use client";

import { useState, useRef, useEffect } from "react";
import { compressImage } from "@/lib/compress-image";

interface QuickCaptureFABProps {
  unitId?: string;
  availableUnits?: Array<{ id: string; title: string }>;
  onEntryCreated?: () => void;
  hidden?: boolean;
}

export function QuickCaptureFAB({
  unitId,
  availableUnits,
  onEntryCreated,
  hidden = false,
}: QuickCaptureFABProps) {
  const [open, setOpen] = useState(false);
  const [selectedUnitId, setSelectedUnitId] = useState(unitId || "");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Form state
  const [noteText, setNoteText] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (unitId) setSelectedUnitId(unitId);
  }, [unitId]);

  // Generate photo preview when file changes
  useEffect(() => {
    if (!photoFile) {
      setPhotoPreview(null);
      return;
    }
    const url = URL.createObjectURL(photoFile);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photoFile]);

  // Close form when hidden changes
  useEffect(() => {
    if (hidden) {
      setOpen(false);
    }
  }, [hidden]);

  // Listen for external trigger to open the form
  useEffect(() => {
    function handleOpenCapture() {
      setOpen(true);
    }
    window.addEventListener("questerra:open-capture", handleOpenCapture);
    return () => window.removeEventListener("questerra:open-capture", handleOpenCapture);
  }, []);

  if (hidden) return null;

  const effectiveUnitId = unitId || selectedUnitId;
  const needsUnitPicker =
    !unitId && availableUnits && availableUnits.length > 0;
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  const hasContent = noteText.trim() || linkUrl.trim() || photoFile;

  function reset() {
    setNoteText("");
    setLinkUrl("");
    setPhotoFile(null);
    setPhotoPreview(null);
    setOpen(false);
  }

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 2000);
  }

  async function handleSubmit() {
    if (!effectiveUnitId || !hasContent) return;
    setSubmitting(true);

    try {
      let mediaUrl: string | undefined;

      // Upload photo first if present (compress before upload)
      if (photoFile) {
        const compressed = await compressImage(photoFile);
        const formData = new FormData();
        formData.append("file", compressed);
        formData.append("unitId", effectiveUnitId);
        formData.append("pageId", "portfolio");

        const uploadRes = await fetch("/api/student/upload", {
          method: "POST",
          body: formData,
        });
        const uploadData = await uploadRes.json();
        if (uploadData.url) {
          mediaUrl = uploadData.url;
        }
      }

      const fullLink = linkUrl.trim()
        ? linkUrl.startsWith("http")
          ? linkUrl.trim()
          : `https://${linkUrl.trim()}`
        : undefined;

      const res = await fetch("/api/student/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unitId: effectiveUnitId,
          type: "entry",
          content: noteText.trim() || undefined,
          mediaUrl,
          linkUrl: fullLink,
        }),
      });

      if (res.ok) {
        showToast("Entry added!");
        reset();
        onEntryCreated?.();
      }
    } catch {
      // fail silently
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] px-4 py-2 bg-accent-green text-white text-sm font-medium rounded-full shadow-lg">
          {toast}
        </div>
      )}

      {/* Entry form — positioned to the left of the portfolio panel */}
      {open && (
        <>
          {/* Backdrop for form only */}
          <div
            className="fixed inset-0 z-[55]"
            onClick={() => reset()}
          />

          <div className="fixed top-1/2 -translate-y-1/2 z-[56] w-80 bg-white rounded-xl shadow-2xl border border-border overflow-hidden"
            style={{ right: "calc(min(100%, 28rem) + 1.5rem)" }}
          >
            {/* Date header */}
            <div className="px-4 pt-4 pb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full gradient-cta flex items-center justify-center">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </div>
                <span className="text-sm font-semibold text-text-primary">
                  {today}
                </span>
              </div>
              <button
                onClick={() => reset()}
                className="w-6 h-6 rounded-full hover:bg-surface-alt flex items-center justify-center text-text-secondary/50 hover:text-text-primary text-xs"
              >
                ✕
              </button>
            </div>

            {/* Unit picker (dashboard only) */}
            {needsUnitPicker && (
              <div className="px-4 pb-2">
                <select
                  value={selectedUnitId}
                  onChange={(e) => setSelectedUnitId(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-blue bg-surface-alt"
                >
                  <option value="">Select unit...</option>
                  {availableUnits!.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.title}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Note */}
            <div className="px-4 pb-2">
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="What are you working on?"
                rows={3}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-pink/30 resize-none"
                autoFocus
              />
            </div>

            {/* Link input */}
            <div className="px-4 pb-2">
              <div className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg focus-within:ring-2 focus-within:ring-brand-pink/30">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-text-secondary/40 flex-shrink-0"
                >
                  <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
                </svg>
                <input
                  type="url"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="Paste a link (optional)"
                  className="flex-1 text-sm focus:outline-none bg-transparent"
                />
              </div>
            </div>

            {/* Photo */}
            <div className="px-4 pb-3">
              {photoPreview ? (
                <div className="relative inline-block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photoPreview}
                    alt=""
                    className="w-20 h-20 rounded-lg object-cover"
                  />
                  <button
                    onClick={() => {
                      setPhotoFile(null);
                      setPhotoPreview(null);
                    }}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-400 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-500"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-border hover:border-brand-pink hover:bg-brand-pink/5 transition text-sm text-text-secondary"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                  Add photo
                </button>
              )}
            </div>

            {/* Submit */}
            <div className="px-4 pb-4">
              <button
                onClick={handleSubmit}
                disabled={!effectiveUnitId || !hasContent || submitting}
                className="w-full py-2.5 gradient-cta text-white rounded-lg text-sm font-medium hover:opacity-90 transition disabled:opacity-40"
              >
                {submitting ? "Saving..." : "Add to Portfolio"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Hidden file input */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) setPhotoFile(file);
          e.target.value = "";
        }}
      />
    </>
  );
}
