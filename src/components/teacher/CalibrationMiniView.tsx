"use client";

/**
 * AG.4 follow-up — Calibration Mini-View modal.
 *
 * Opens when a teacher clicks an attention-rotation row. Shows per-
 * element side-by-side state:
 *   - Student's most recent self-rating (read-only chip)
 *   - Teacher's most recent observation (if any) + rating buttons to
 *     replace/extend it
 *   - Per-element comment textarea (the "2-min discussion notes" land
 *     on whichever element they're discussing)
 *
 * Save → POST /api/teacher/nm-observation with all element entries
 * the teacher actually rated (empty rows skipped).
 *
 * Closes per-Cowork's "1:1 rotation" workflow: 2-3 students per
 * lesson, quick chat, capture observation, move on.
 */

import { useEffect, useState } from "react";
import {
  loadCalibrationForStudent,
  saveCalibration,
  CalibrationApiError,
  type CalibrationLoad,
  type ElementCalibrationState,
} from "@/lib/unit-tools/attention/calibration-client";
import {
  STUDENT_RATING_SCALE,
  TEACHER_RATING_SCALE,
} from "@/lib/nm/constants";

interface CalibrationMiniViewProps {
  unitId: string;
  classId: string;
  studentId: string;
  studentDisplayName: string;
  onClose: () => void;
  /** Fired after successful save so the parent can refresh attention-panel data. */
  onSaved?: () => void;
}

type LoadStatus = "loading" | "ready" | "error";

interface PendingEntry {
  rating: number | null;
  comment: string;
}

export default function CalibrationMiniView({
  unitId,
  classId,
  studentId,
  studentDisplayName,
  onClose,
  onSaved,
}: CalibrationMiniViewProps) {
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [data, setData] = useState<CalibrationLoad | null>(null);
  // Map from element.id → teacher's pending input (rating + comment).
  // Pre-seeded from existing teacher observations so the form shows the
  // current state — Save replaces with the new values.
  const [pending, setPending] = useState<Record<string, PendingEntry>>({});
  const [saving, setSaving] = useState(false);
  const [savedToast, setSavedToast] = useState<string | null>(null);

  // ESC closes
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setErrorMsg(null);
    loadCalibrationForStudent({ unitId, classId, studentId })
      .then((res) => {
        if (cancelled) return;
        setData(res);
        // Seed pending state from existing teacher observations
        const seeded: Record<string, PendingEntry> = {};
        for (const e of res.elements) {
          seeded[e.element.id] = {
            rating: e.teacherRating,
            comment: e.teacherComment ?? "",
          };
        }
        setPending(seeded);
        setStatus("ready");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const msg =
          err instanceof CalibrationApiError
            ? err.message
            : err instanceof Error
            ? err.message
            : "Failed to load calibration";
        setErrorMsg(msg);
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [unitId, classId, studentId]);

  function setRating(elementId: string, rating: number) {
    setPending((prev) => ({
      ...prev,
      [elementId]: {
        rating: prev[elementId]?.rating === rating ? null : rating, // toggle off
        comment: prev[elementId]?.comment ?? "",
      },
    }));
  }

  function setComment(elementId: string, comment: string) {
    setPending((prev) => ({
      ...prev,
      [elementId]: {
        rating: prev[elementId]?.rating ?? null,
        comment,
      },
    }));
  }

  /**
   * "Dirty" entries = rows where the teacher has either
   *   (a) set/changed a rating, OR
   *   (b) edited the comment AND has a rating set
   * Empty rows are silently skipped.
   */
  function buildAssessments(): Array<{
    element: string;
    rating: number;
    comment?: string;
  }> {
    if (!data) return [];
    const out: Array<{ element: string; rating: number; comment?: string }> = [];
    for (const e of data.elements) {
      const p = pending[e.element.id];
      if (!p || p.rating === null) continue;
      // Skip if nothing changed from existing teacher observation
      const ratingUnchanged = p.rating === e.teacherRating;
      const commentUnchanged =
        (p.comment ?? "") === (e.teacherComment ?? "");
      if (ratingUnchanged && commentUnchanged) continue;
      out.push({
        element: e.element.id,
        rating: p.rating,
        comment: p.comment.trim() || undefined,
      });
    }
    return out;
  }

  async function handleSave() {
    if (!data) return;
    const assessments = buildAssessments();
    if (assessments.length === 0) {
      setSavedToast("No changes to save");
      setTimeout(() => setSavedToast(null), 2000);
      return;
    }
    setSaving(true);
    setErrorMsg(null);
    try {
      await saveCalibration({
        unitId,
        classId,
        studentId,
        assessments,
      });
      setSavedToast(
        `Saved ${assessments.length} observation${assessments.length === 1 ? "" : "s"}`
      );
      onSaved?.();
      // Close shortly after so the teacher sees the toast.
      setTimeout(() => {
        setSavedToast(null);
        onClose();
      }, 900);
    } catch (err: unknown) {
      const msg =
        err instanceof CalibrationApiError
          ? err.message
          : err instanceof Error
          ? err.message
          : "Save failed. Try again.";
      setErrorMsg(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {/* Scrim */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
        aria-hidden="true"
        data-testid="calibration-scrim"
      />
      {/* Centered card */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Calibration · ${studentDisplayName}`}
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[min(100%-2rem,720px)] max-h-[90vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        data-testid="calibration-mini-view"
      >
        {/* Header */}
        <header className="flex items-start justify-between gap-3 px-6 py-4 border-b border-gray-200">
          <div className="flex-1 min-w-0">
            <div className="text-[10.5px] uppercase tracking-wide text-violet-700 font-bold">
              Calibration
            </div>
            <h2 className="text-[18px] font-extrabold text-gray-900 leading-tight mt-0.5">
              {studentDisplayName}
            </h2>
            <p className="text-[11.5px] text-gray-500 mt-0.5">
              Side-by-side: their self-rating vs your observation. 2-minute chat,
              record what you saw, move on.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-gray-400 hover:text-gray-700 p-1 rounded hover:bg-gray-100 flex-shrink-0"
            data-testid="calibration-close"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {status === "loading" && (
            <div
              className="text-[12px] text-gray-500 italic py-8 text-center"
              data-testid="calibration-loading"
            >
              Loading calibration data…
            </div>
          )}

          {status === "error" && (
            <div
              className="text-[12px] text-rose-700 bg-rose-50 border border-rose-200 rounded p-3"
              data-testid="calibration-error"
            >
              {errorMsg ?? "Failed to load."}
            </div>
          )}

          {status === "ready" && data && data.elements.length === 0 && (
            <div
              className="text-[12px] text-gray-500 italic py-8 text-center"
              data-testid="calibration-no-elements"
            >
              No NM elements configured for this unit. Add an NM block to a
              lesson first, then come back.
            </div>
          )}

          {status === "ready" && data && data.elements.length > 0 && (
            <div
              className="flex flex-col gap-4"
              data-testid="calibration-element-list"
            >
              {data.elements.map((e) => (
                <ElementRow
                  key={e.element.id}
                  element={e}
                  pendingRating={pending[e.element.id]?.rating ?? null}
                  pendingComment={pending[e.element.id]?.comment ?? ""}
                  onSetRating={(r) => setRating(e.element.id, r)}
                  onSetComment={(c) => setComment(e.element.id, c)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="flex items-center justify-between gap-3 px-6 py-3 border-t border-gray-200 bg-gray-50">
          {savedToast ? (
            <span
              className="text-[11.5px] text-emerald-700 font-semibold"
              data-testid="calibration-toast"
            >
              ✓ {savedToast}
            </span>
          ) : errorMsg && status === "ready" ? (
            <span className="text-[11.5px] text-rose-700">{errorMsg}</span>
          ) : (
            <span className="text-[10.5px] text-gray-500">
              Empty rows are skipped. Existing observations stay unless you
              change them.
            </span>
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="text-[12px] px-3 py-1.5 rounded text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              data-testid="calibration-cancel"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || status !== "ready"}
              className={
                "text-[12px] px-4 py-1.5 rounded font-semibold transition-colors " +
                (saving || status !== "ready"
                  ? "bg-violet-300 text-white cursor-wait"
                  : "bg-violet-600 text-white hover:bg-violet-700")
              }
              data-testid="calibration-save"
            >
              {saving ? "Saving…" : "Save observation"}
            </button>
          </div>
        </footer>
      </div>
    </>
  );
}

// ─── Per-element row ───────────────────────────────────────────────────────

interface ElementRowProps {
  element: ElementCalibrationState;
  pendingRating: number | null;
  pendingComment: string;
  onSetRating: (rating: number) => void;
  onSetComment: (comment: string) => void;
}

function ElementRow({
  element,
  pendingRating,
  pendingComment,
  onSetRating,
  onSetComment,
}: ElementRowProps) {
  const studentScaleEntry =
    element.studentRating !== null
      ? STUDENT_RATING_SCALE.find((r) => r.value === element.studentRating)
      : null;

  return (
    <div
      className="border border-gray-200 rounded-lg p-4 flex flex-col gap-2.5"
      style={{ borderLeft: `4px solid ${element.element.color}` }}
      data-testid={`calibration-row-${element.element.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="font-bold text-[13.5px] text-gray-900">
            {element.element.name}
          </div>
          <p className="text-[11px] text-gray-500 mt-0.5">
            {element.element.studentDescription}
          </p>
        </div>
      </div>

      {/* Self-rating chip */}
      <div className="flex items-center gap-2 text-[11px] flex-wrap">
        <span className="text-gray-500 font-semibold uppercase tracking-wide text-[9.5px]">
          Self-rating
        </span>
        {element.studentRating !== null && studentScaleEntry ? (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-50 border border-violet-200 text-violet-900"
            title={studentScaleEntry.description}
            data-testid="calibration-self-rating"
          >
            <span className="font-bold tabular-nums">
              {element.studentRating}/3
            </span>
            <span>· {studentScaleEntry.label}</span>
          </span>
        ) : (
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 border border-gray-200 text-gray-500 italic"
            data-testid="calibration-self-rating-empty"
          >
            Not rated yet
          </span>
        )}
        {element.studentRatedAt && (
          <span
            className="text-[10px] text-gray-500"
            title={`Recorded ${new Date(element.studentRatedAt).toLocaleString()}`}
            data-testid="calibration-self-rating-date"
          >
            · {formatRelative(element.studentRatedAt)}
          </span>
        )}
        {element.studentComment && (
          <span
            className="text-[10.5px] text-gray-600 italic truncate max-w-md"
            title={element.studentComment}
          >
            &ldquo;{element.studentComment}&rdquo;
          </span>
        )}
      </div>

      {/* Teacher rating buttons */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-gray-700 font-semibold uppercase tracking-wide text-[9.5px]">
          Your observation
        </span>
        <div className="flex gap-1" role="radiogroup" aria-label={`Rate ${element.element.name}`}>
          {TEACHER_RATING_SCALE.map((opt) => {
            const isActive = pendingRating === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={isActive}
                onClick={() => onSetRating(opt.value)}
                title={opt.description}
                className={
                  "text-[11px] px-2.5 py-1 rounded-md border transition-colors font-medium " +
                  (isActive
                    ? "bg-violet-600 text-white border-violet-600"
                    : "bg-white text-gray-700 border-gray-200 hover:border-violet-300 hover:bg-violet-50")
                }
                data-testid={`calibration-rating-${element.element.id}-${opt.value}`}
              >
                <span className="tabular-nums font-bold">{opt.value}</span>
                <span className="ml-1">{opt.label}</span>
              </button>
            );
          })}
        </div>
        {element.teacherRating !== null && pendingRating === element.teacherRating && element.teacherRatedAt && (
          <span
            className="text-[10.5px] text-gray-500 italic"
            title={`Recorded ${new Date(element.teacherRatedAt).toLocaleString()}`}
            data-testid="calibration-teacher-current-date"
          >
            current · {formatRelative(element.teacherRatedAt)}
          </span>
        )}
      </div>

      {/* Comment textarea */}
      <textarea
        value={pendingComment}
        onChange={(e) => onSetComment(e.target.value)}
        placeholder="Optional: what did you see in the 2-min chat?"
        rows={2}
        maxLength={500}
        className="w-full text-[11.5px] px-2.5 py-1.5 bg-white border border-gray-200 rounded resize-y focus:outline-none focus:ring-1 focus:ring-violet-300 focus:border-violet-500"
        data-testid={`calibration-comment-${element.element.id}`}
      />

      {/* Round 9: Past observations history (collapsed by default) */}
      {element.teacherHistory.length > 0 && (
        <details
          className="text-[11px]"
          data-testid={`calibration-history-${element.element.id}`}
        >
          <summary className="cursor-pointer text-gray-600 hover:text-violet-700 font-semibold py-1">
            Past observations ({element.teacherHistory.length})
          </summary>
          <ul className="mt-1.5 space-y-1.5 pl-3 border-l-2 border-gray-100">
            {element.teacherHistory.map((entry, i) => {
              const scaleEntry = TEACHER_RATING_SCALE.find(
                (r) => r.value === entry.rating
              );
              return (
                <li
                  key={`${entry.createdAt}-${i}`}
                  className="text-[10.5px] text-gray-700 leading-snug"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 font-semibold tabular-nums">
                      {entry.rating}
                      <span className="font-normal text-gray-500">
                        {scaleEntry ? `· ${scaleEntry.label}` : ""}
                      </span>
                    </span>
                    <span
                      className="text-gray-500"
                      title={new Date(entry.createdAt).toLocaleString()}
                    >
                      {formatRelative(entry.createdAt)}
                    </span>
                  </div>
                  {entry.comment && (
                    <div className="text-gray-600 italic mt-0.5 ml-1 whitespace-pre-wrap">
                      &ldquo;{entry.comment}&rdquo;
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </details>
      )}
    </div>
  );
}

/**
 * Format an ISO timestamp as a short "X mins ago" / "today" / "Mar 5"
 * label. Pure helper kept inline since it's only used here. Hover the
 * span for the full timestamp via title attribute (set by the caller).
 */
function formatRelative(iso: string): string {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return "—";
  const now = Date.now();
  const diffMs = now - ts;
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const date = new Date(ts);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
