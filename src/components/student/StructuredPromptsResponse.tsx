"use client";

/**
 * AG.1.2 — StructuredPromptsResponse
 *
 * Student-side component for activities with responseType="structured-prompts".
 * Renders N text fields (per the prompts config) + optional photo upload.
 * On submit, writes a single portfolio_entries row via auto-capture path
 * (type='auto', dedup by student/unit/page/sectionIndex unique index).
 *
 * Mirrors QuickCaptureFAB photo-handling pattern:
 *   1. Client-side image moderation (checkClientImage)
 *   2. Compress (compressImage)
 *   3. Upload to /api/student/upload (FormData) → URL
 *   4. POST to /api/student/portfolio with composed content + URL
 *
 * Per Lesson #71: pure logic (validateResponses, composeContent,
 * extractNextMove) lives in src/lib/structured-prompts/. This file is
 * the JSX shell + side-effects (fetch, photo handling, state).
 */

import { useState } from "react";
import { compressImage } from "@/lib/compress-image";
import {
  checkClientImage,
  IMAGE_MODERATION_MESSAGES,
} from "@/lib/content-safety/client-image-filter";
import {
  charCountStatus,
  composeContent,
  extractNextMove,
  isReadyToSubmit,
  validateResponses,
  type PromptValidationError,
} from "@/lib/structured-prompts/payload";
import type {
  StructuredPromptResponses,
  StructuredPromptsConfig,
} from "@/lib/structured-prompts/types";

interface StructuredPromptsResponseProps {
  prompts: StructuredPromptsConfig;
  unitId: string;
  pageId: string;
  sectionIndex: number;
  /** When true, photo is required before submit. Default false. */
  requirePhoto?: boolean;
  /**
   * AG.2.4 — when true, after a successful save, fire-and-forget append
   * a Kanban backlog card with the "next" prompt's response (if non-empty).
   * Card carries source='journal_next' + lessonLink so the student can
   * trace the card back to the lesson it came from. Failures are silent
   * (kanban save errors don't block the journal save).
   */
  autoCreateKanbanCardOnSave?: boolean;
  /** Called after a successful save. Parent uses this to refresh portfolio panel, mark activity done, etc. */
  onSaved?: (savedPayload: { content: string; nextMove: string | null }) => void;
}

export default function StructuredPromptsResponse({
  prompts,
  unitId,
  pageId,
  sectionIndex,
  requirePhoto = false,
  autoCreateKanbanCardOnSave = false,
  onSaved,
}: StructuredPromptsResponseProps) {
  const [responses, setResponses] = useState<StructuredPromptResponses>({});
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showFieldErrors, setShowFieldErrors] = useState(false);
  const [savedToast, setSavedToast] = useState<string | null>(null);

  const photoProvided = photoFile !== null;
  const fieldErrors: PromptValidationError[] = validateResponses(prompts, responses, {
    photoProvided,
    photoRequired: requirePhoto,
  });
  const ready = isReadyToSubmit(prompts, responses, {
    photoProvided,
    photoRequired: requirePhoto,
  });

  function setResponseFor(promptId: string, value: string) {
    setResponses((prev) => ({ ...prev, [promptId]: value }));
    if (showFieldErrors) {
      // Recompute on next render — clearing the show-errors state keeps the UI calm
      // until they hit submit again.
    }
    setErrorMsg(null);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null;
    if (file) {
      // Clean up old preview
      if (photoPreview) URL.revokeObjectURL(photoPreview);
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
      setErrorMsg(null);
    }
  }

  function clearPhoto() {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(null);
    setPhotoPreview(null);
  }

  async function handleSubmit() {
    setShowFieldErrors(true);
    if (!ready) {
      setErrorMsg("Fix the highlighted prompts before saving.");
      return;
    }
    setErrorMsg(null);
    setSubmitting(true);

    try {
      let mediaUrl: string | undefined;

      // Photo: moderate → compress → upload
      if (photoFile) {
        const imageCheck = await checkClientImage(photoFile);
        if (!imageCheck.ok) {
          setErrorMsg(IMAGE_MODERATION_MESSAGES.en);
          // Fire-and-forget log
          fetch("/api/safety/log-client-block", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              source: "portfolio",
              flags: imageCheck.flags,
              layer: "client_image",
            }),
          }).catch(() => {});
          setSubmitting(false);
          return;
        }

        const compressed = await compressImage(photoFile);
        const formData = new FormData();
        formData.append("file", compressed);
        formData.append("unitId", unitId);
        formData.append("pageId", pageId);

        const uploadRes = await fetch("/api/student/upload", {
          method: "POST",
          body: formData,
        });
        const uploadData = await uploadRes.json();
        if (!uploadRes.ok || !uploadData.url) {
          setErrorMsg("Photo upload failed. Try again.");
          setSubmitting(false);
          return;
        }
        mediaUrl = uploadData.url;
      }

      // Compose content + write portfolio entry via auto-capture path
      const content = composeContent(prompts, responses);
      const portfolioRes = await fetch("/api/student/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unitId,
          type: "auto",
          content,
          mediaUrl,
          pageId,
          sectionIndex,
        }),
      });

      if (!portfolioRes.ok) {
        const errBody = await portfolioRes.json().catch(() => ({}));
        setErrorMsg(errBody.error || "Save failed. Try again.");
        setSubmitting(false);
        return;
      }

      const nextMove = extractNextMove(responses);

      // AG.2.4 — fire-and-forget Kanban auto-create when configured + nextMove
      // present. Failures are silent (don't undo the journal save).
      if (autoCreateKanbanCardOnSave && nextMove) {
        // Lazy import keeps Kanban out of the StructuredPrompts module graph
        // for activities that don't enable this flag.
        import("@/lib/unit-tools/kanban/client")
          .then(({ appendBacklogCard }) =>
            appendBacklogCard(unitId, {
              title: nextMove,
              lessonLink: { unit_id: unitId, page_id: pageId, section_index: sectionIndex },
            })
          )
          .catch((err) => {
            // Silent failure — journal save already succeeded; don't
            // surface a Kanban-specific error to the student. Log for
            // teacher debugging only.
            console.warn("[journal] kanban auto-create failed", err);
          });
      }

      setSavedToast("Saved to portfolio");
      setShowFieldErrors(false);
      onSaved?.({ content, nextMove });

      // Clear after a moment so the student sees the toast then a clean form state
      setTimeout(() => {
        setSavedToast(null);
      }, 2500);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Save failed. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="space-y-3 p-4 bg-white border border-gray-200 rounded-lg"
      data-testid="structured-prompts-response"
    >
      {prompts.map((prompt) => {
        const response = responses[prompt.id] ?? "";
        const promptError = showFieldErrors
          ? fieldErrors.find((e) => e.promptId === prompt.id)
          : undefined;
        const charStatus = charCountStatus(prompt, response);

        return (
          <label key={prompt.id} className="block">
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-[12px] font-semibold text-gray-800">
                {prompt.label}
                {prompt.required !== false && (
                  <span className="text-rose-500 ml-0.5">*</span>
                )}
              </span>
              {prompt.softCharCap && (
                <span
                  className={`text-[10px] tabular-nums ${
                    charStatus === "over"
                      ? "text-rose-600 font-semibold"
                      : charStatus === "approaching"
                        ? "text-amber-600"
                        : "text-gray-400"
                  }`}
                >
                  {response.length} / {prompt.softCharCap}
                </span>
              )}
            </div>

            {prompt.helper && (
              <div className="text-[10.5px] text-gray-500 mb-1 leading-snug">
                {prompt.helper}
              </div>
            )}

            <textarea
              value={response}
              onChange={(e) => setResponseFor(prompt.id, e.target.value)}
              placeholder={prompt.placeholder}
              rows={3}
              className={`w-full text-[12px] px-2 py-1.5 bg-white border rounded resize-y focus:outline-none focus:ring-1 focus:ring-violet-300 focus:border-violet-500 ${
                promptError
                  ? "border-rose-400 ring-1 ring-rose-200"
                  : "border-gray-300"
              }`}
              data-testid={`structured-prompts-input-${prompt.id}`}
            />

            {promptError && (
              <div className="text-[10.5px] text-rose-600 mt-0.5">
                {promptError.message}
              </div>
            )}
          </label>
        );
      })}

      {/* Photo upload */}
      <div className="pt-1 border-t border-gray-100">
        <div className="flex items-baseline justify-between mb-1">
          <span className="text-[12px] font-semibold text-gray-800">
            Photo of one decision point
            {requirePhoto && <span className="text-rose-500 ml-0.5">*</span>}
          </span>
          {photoFile && (
            <button
              type="button"
              onClick={clearPhoto}
              className="text-[10.5px] text-gray-400 hover:text-rose-600 underline-offset-2 hover:underline"
            >
              clear
            </button>
          )}
        </div>
        {!photoPreview ? (
          <label className="flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-50 border border-dashed border-gray-300 rounded cursor-pointer hover:bg-gray-100 transition-colors">
            <span className="text-[14px]">📷</span>
            <span className="text-[11px] text-gray-600">Add photo</span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileSelect}
              className="hidden"
              data-testid="structured-prompts-photo-input"
            />
          </label>
        ) : (
          <div className="relative inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photoPreview}
              alt="Preview"
              className="max-h-32 rounded border border-gray-200"
            />
          </div>
        )}
        {showFieldErrors && requirePhoto && !photoFile && (
          <div className="text-[10.5px] text-rose-600 mt-0.5">
            Photo of one decision point is required
          </div>
        )}
      </div>

      {errorMsg && (
        <div
          className="text-[11px] text-rose-600 bg-rose-50 border border-rose-200 rounded px-2 py-1.5"
          data-testid="structured-prompts-error"
        >
          {errorMsg}
        </div>
      )}

      {savedToast && (
        <div
          className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-1.5"
          data-testid="structured-prompts-saved"
        >
          ✓ {savedToast}
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className={`text-[11.5px] px-3 py-1.5 rounded font-semibold transition-colors ${
            submitting
              ? "bg-gray-200 text-gray-500 cursor-wait"
              : ready
                ? "bg-violet-600 text-white hover:bg-violet-700"
                : "bg-violet-300 text-white"
          }`}
          data-testid="structured-prompts-submit"
        >
          {submitting ? "Saving…" : "Send to portfolio"}
        </button>
        {!ready && !submitting && fieldErrors.length > 0 && (
          <span className="text-[10.5px] text-gray-500">
            {fieldErrors.length} {fieldErrors.length === 1 ? "thing" : "things"} to fix
          </span>
        )}
      </div>
    </div>
  );
}
