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

  // Auto-submit when emoji is tapped
  async function handleEmojiTap(value: number) {
    setVibe(value);
    setError("");

    // Auto-submit after a brief visual feedback
    setSubmitting(true);
    const feedbackData: StudentPostLessonFeedback = {
      student_id: studentId,
      submitted_at: new Date().toISOString(),
      understanding: value as 1 | 2 | 3 | 4 | 5,
      engagement: value as 1 | 2 | 3 | 4 | 5,
      pace: "just_right",
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

      if (!res.ok) throw new Error("Failed to submit");
      const data = await res.json();
      setSubmitted(true);
      onSubmit?.(data.feedbackId);
    } catch {
      setError("Couldn't save — tap again");
      setSubmitting(false);
    }
  }

  // ─── Form — just tap an emoji, done ───
  return (
    <div className="text-center">
      <p className="text-base font-semibold text-gray-900 mb-1">How did this lesson go?</p>
      <p className="text-sm text-gray-400 mb-5">Just tap one</p>

      <div className="flex justify-center gap-2">
        {VIBE_EMOJIS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            disabled={submitting}
            onClick={() => handleEmojiTap(opt.value)}
            className={`w-14 h-14 rounded-2xl text-center transition-all ${
              vibe === opt.value
                ? "bg-purple-100 border-2 border-purple-400 scale-110"
                : "border-2 border-gray-100 hover:border-gray-200 hover:bg-gray-50"
            } ${submitting ? "opacity-50" : ""}`}
          >
            <span className="text-2xl">{opt.emoji}</span>
          </button>
        ))}
      </div>

      {/* Labels below emojis */}
      <div className="flex justify-center gap-2 mt-1.5">
        {VIBE_EMOJIS.map((opt) => (
          <span key={opt.value} className="w-14 text-[9px] text-gray-400 text-center">
            {opt.label}
          </span>
        ))}
      </div>

      {error && (
        <p className="text-xs text-red-500 mt-3">{error}</p>
      )}

      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="mt-4 text-xs text-gray-400 hover:text-gray-600 transition"
        >
          Skip
        </button>
      )}
    </div>
  );
}
