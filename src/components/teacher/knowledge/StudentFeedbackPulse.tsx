"use client";

import { useState } from "react";
import type { StudentPostLessonFeedback } from "@/types/lesson-intelligence";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface StudentFeedbackPulseProps {
  lessonProfileId?: string;
  unitId?: string;
  pageId?: string;
  studentId: string;
  onSubmit?: (feedbackId: string) => void;
  onClose?: () => void;
}

// ---------------------------------------------------------------------------
// Single vibe scale — combines understanding + engagement into one question
// ---------------------------------------------------------------------------
const VIBE_EMOJIS = [
  { value: 1, emoji: "😵", label: "Lost" },
  { value: 2, emoji: "😕", label: "Struggled" },
  { value: 3, emoji: "🤔", label: "Okay" },
  { value: 4, emoji: "😊", label: "Good" },
  { value: 5, emoji: "🤩", label: "Great" },
] as const;

// ---------------------------------------------------------------------------
// Component — one tap required, one optional text field, done
// ---------------------------------------------------------------------------
export default function StudentFeedbackPulse({
  lessonProfileId,
  unitId,
  pageId,
  studentId,
  onSubmit,
  onClose,
}: StudentFeedbackPulseProps) {
  const [vibe, setVibe] = useState<number>(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit() {
    if (vibe === 0) return;

    setSubmitting(true);
    setError("");

    // Map single vibe to the existing schema fields
    // understanding = vibe, engagement = vibe, pace = "just_right" (default)
    const feedbackData: StudentPostLessonFeedback = {
      student_id: studentId,
      submitted_at: new Date().toISOString(),
      understanding: vibe as 1 | 2 | 3 | 4 | 5,
      engagement: vibe as 1 | 2 | 3 | 4 | 5,
      pace: "just_right",
      ...(comment.trim() && { highlight: comment.trim() }),
    };

    try {
      const res = await fetch("/api/teacher/knowledge/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feedback_type: "student",
          lesson_profile_id: lessonProfileId,
          unit_id: unitId,
          page_id: pageId,
          feedback_data: feedbackData,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to submit");
      }

      const data = await res.json();
      setSubmitted(true);
      onSubmit?.(data.feedbackId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Success ───
  if (submitted) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center max-w-sm mx-auto">
        <div className="text-3xl mb-2">👍</div>
        <p className="text-sm text-green-700 font-medium">Thanks!</p>
      </div>
    );
  }

  // ─── Form — one tap + optional text ───
  return (
    <div className="bg-white border border-border rounded-2xl shadow-sm max-w-sm mx-auto overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-2">
        <h3 className="text-base font-semibold text-text-primary">
          How did today go?
        </h3>
      </div>

      <div className="px-5 pb-5 space-y-4">
        {/* Emoji vibe scale */}
        <div className="flex justify-between gap-1">
          {VIBE_EMOJIS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                setVibe(opt.value);
                setError("");
              }}
              className={`flex-1 py-3 rounded-xl text-center transition-all ${
                vibe === opt.value
                  ? "bg-brand-purple/10 border-2 border-brand-purple scale-110"
                  : "border-2 border-transparent hover:bg-surface-secondary"
              }`}
            >
              <span className="block text-3xl">{opt.emoji}</span>
              <span className="block text-[9px] text-text-tertiary mt-1">{opt.label}</span>
            </button>
          ))}
        </div>

        {/* Optional comment — only appears after emoji tap */}
        {vibe > 0 && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-200">
            <input
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Anything else? (optional)"
              className="w-full px-3 py-2.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-purple/30 placeholder:text-text-tertiary"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSubmit();
              }}
            />
          </div>
        )}

        {/* Error */}
        {error && (
          <p className="text-xs text-red-600 text-center">{error}</p>
        )}

        {/* Submit — enabled as soon as an emoji is tapped */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || vibe === 0}
          className={`w-full py-3 text-white text-sm font-semibold rounded-xl transition-all ${
            vibe > 0
              ? "bg-brand-purple hover:bg-brand-purple-dark"
              : "bg-gray-200 text-gray-400 cursor-not-allowed"
          }`}
        >
          {submitting ? "Sending..." : "Done ✓"}
        </button>
      </div>

      {/* Dismiss area */}
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="w-full py-2 text-xs text-text-tertiary hover:text-text-secondary border-t border-border transition"
        >
          Not now
        </button>
      )}
    </div>
  );
}
