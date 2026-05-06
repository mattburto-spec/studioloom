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

import { useCallback, useRef, useState } from "react";
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
  parseComposedContent,
  submitButtonLabel,
  validateResponses,
  type PromptValidationError,
} from "@/lib/structured-prompts/payload";
import type {
  StructuredPromptResponses,
  StructuredPromptsConfig,
} from "@/lib/structured-prompts/types";
import { useIntegrityTracking } from "@/hooks/useIntegrityTracking";
import type { IntegrityMetadata } from "@/components/student/MonitoredTextarea";

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
  /**
   * Smoke-fix 6 May 2026 — the lesson's existing response value for this
   * section_index, if previously saved. Non-empty means the student has
   * already written this journal once; we render the saved content as a
   * preview with an Edit button instead of a fresh empty form. This is
   * also what feeds the Narrative aggregator (Narrative reads from
   * student_progress.responses, not portfolio_entries).
   */
  savedValue?: string;
  /**
   * Smoke-fix 6 May 2026 — write the composed journal text into
   * student_progress.responses[section_${i}] so the Narrative view picks
   * it up. Without this, journals saved successfully to portfolio_entries
   * but the Narrative empty-state ("No responses yet") still showed
   * because it filters auto-captured entries out by design.
   */
  onChange?: (composedContent: string) => void;
  /**
   * Round 11 (6 May 2026) — bypass-debounce save. When provided, the
   * journal save uses this instead of `onChange` so the lesson
   * progress persists immediately (not after the parent's 2s
   * autosave). Without this, a student who saves a journal and
   * navigates away within 2s loses the entry on reload because
   * student_progress.responses never gets the composed content.
   */
  onSaveImmediate?: (composedContent: string) => Promise<void>;
  /** Called after a successful save. Parent uses this to refresh portfolio panel, mark activity done, etc. */
  onSaved?: (savedPayload: { content: string; nextMove: string | null }) => void;
  /**
   * Round 18 (6 May 2026) — academic integrity tracking. Mirrors the
   * MonitoredTextarea contract used by other response types (text /
   * upload / etc.) so the teacher's Writing Playback + integrity score
   * surfaces work identically for structured-prompts content. When
   * disabled (default), the hook is a no-op.
   */
  enableIntegrityMonitoring?: boolean;
  onIntegrityUpdate?: (metadata: IntegrityMetadata) => void;
}

export default function StructuredPromptsResponse({
  prompts,
  unitId,
  pageId,
  sectionIndex,
  requirePhoto = false,
  autoCreateKanbanCardOnSave = false,
  savedValue,
  onChange,
  onSaveImmediate,
  onSaved,
  enableIntegrityMonitoring = false,
  onIntegrityUpdate,
}: StructuredPromptsResponseProps) {
  const hasSavedEntry = (savedValue ?? "").trim().length > 0;
  // When an entry is already saved on this section_index, start in the
  // "saved preview" state. Edit re-opens the form pre-filled with the
  // saved responses (parsed back from the composed markdown via
  // parseComposedContent — round 4 fix; round 3 left it as an empty form
  // which forced students to re-type).
  const [editing, setEditing] = useState(!hasSavedEntry);
  const [responses, setResponses] = useState<StructuredPromptResponses>(() =>
    hasSavedEntry ? parseComposedContent(prompts, savedValue ?? "") : {}
  );

  // Round 18 — keep a ref to the latest composed text so the integrity
  // hook can compute keystroke/paste metrics against the FULL combined
  // value (not a single field) without re-creating the hook on every
  // keystroke.
  const responsesRef = useRef(responses);
  responsesRef.current = responses;

  const integrity = useIntegrityTracking({
    enabled: enableIntegrityMonitoring,
    onIntegrityUpdate,
    getCombinedText: useCallback(
      () => composeContent(prompts, responsesRef.current),
      [prompts]
    ),
  });
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

      // Round 18 — flush integrity metrics before lesson save fires so
      // the parent's integrityMetadataRef has the latest snapshot when
      // the autosave (and the immediate save below) compose the
      // /api/student/progress payload.
      integrity.flush();

      setSavedToast("Saved to portfolio");
      setShowFieldErrors(false);

      // Smoke-fix 6 May 2026 — also write the composed text into the
      // lesson's responses object so the Narrative aggregator picks it
      // up. Narrative deliberately filters out auto-captured portfolio
      // entries; the lesson responses path is the canonical place for
      // structured-prompts content to live.
      //
      // Round 11 — prefer onSaveImmediate (bypass debounce) so the
      // journal survives a navigate-within-2s. Fall back to onChange
      // if the parent didn't wire the immediate-save path. Either way,
      // failures here don't undo the portfolio save above — the entry
      // is at minimum recoverable from portfolio_entries.
      if (onSaveImmediate) {
        try {
          await onSaveImmediate(content);
        } catch (err) {
          console.warn("[journal] immediate progress save failed", err);
          // Fall through to onChange so the autosave still has a chance
          onChange?.(content);
        }
      } else {
        onChange?.(content);
      }

      onSaved?.({ content, nextMove });

      // Collapse to the saved-preview view so the student sees what was
      // saved (and the Edit button to re-open if they want to revise).
      setEditing(false);
      setResponses({});
      setPhotoFile(null);
      if (photoPreview) {
        URL.revokeObjectURL(photoPreview);
        setPhotoPreview(null);
      }

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

  // ─── SAVED PREVIEW MODE ────────────────────────────────────────────────
  // Smoke-fix 6 May 2026 — when a journal has been saved previously, show
  // the composed text as a read-only preview with an Edit affordance,
  // rather than re-prompting with an empty form.
  if (!editing && (savedValue ?? "").trim().length > 0) {
    return (
      <div
        className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg"
        data-testid="structured-prompts-response"
        data-mode="saved"
      >
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="text-[10.5px] font-semibold text-emerald-800 uppercase tracking-wide flex items-center gap-1.5">
            <span aria-hidden="true">✓</span> Journal saved
          </div>
          <button
            type="button"
            onClick={() => {
              // Round 4 fix: pre-fill the form with the saved responses
              // when re-opening so students don't have to retype.
              setResponses(parseComposedContent(prompts, savedValue ?? ""));
              setEditing(true);
            }}
            className="text-[11.5px] text-emerald-700 hover:text-emerald-900 font-semibold underline underline-offset-2"
            data-testid="structured-prompts-edit"
          >
            Edit
          </button>
        </div>
        <pre
          className="whitespace-pre-wrap text-[12.5px] text-gray-800 font-sans leading-relaxed"
          data-testid="structured-prompts-saved-preview"
        >
          {savedValue}
        </pre>
        <p className="text-[10.5px] text-emerald-700 mt-2">
          This entry is also visible in your Portfolio panel. Editing will
          replace the saved version.
        </p>
      </div>
    );
  }

  // ─── EDIT / FRESH-FORM MODE ────────────────────────────────────────────
  return (
    <div
      className="space-y-3 p-4 bg-white border border-gray-200 rounded-lg"
      data-testid="structured-prompts-response"
      data-mode="editing"
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
              onPaste={integrity.handlers.onPaste}
              onKeyDown={integrity.handlers.onKeyDown}
              onFocus={integrity.handlers.onFocus}
              onBlur={integrity.handlers.onBlur}
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
          {submitting
            ? "Saving…"
            : submitButtonLabel({
                hasSavedEntry,
                autoCreateKanbanCardOnSave,
                hasNextMove: extractNextMove(responses) !== null,
              })}
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

// `submitButtonLabel` lives in @/lib/structured-prompts/payload as a pure
// helper so tests can import it without the JSX boundary (Lesson #71).
