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
// Pace options — the ONE thing worth collecting from students
// Feeds directly into the timing model for future lesson generation.
// ---------------------------------------------------------------------------
const PACE_OPTIONS = [
  { value: "too_slow" as const, emoji: "🐢", label: "Too slow" },
  { value: "just_right" as const, emoji: "👌", label: "Just right" },
  { value: "too_fast" as const, emoji: "🏃", label: "Too fast" },
];

// ---------------------------------------------------------------------------
// Component — one tap, done. Data feeds the timing model.
//
// Schema note: StudentPostLessonFeedback requires understanding + engagement
// fields. We set those to 3 (neutral) since we're not collecting them.
// The pace field is what matters for the timing learning pipeline.
// ---------------------------------------------------------------------------
export default function StudentFeedbackPulse({
  lessonProfileId,
  unitId,
  pageId,
  studentId,
  onSubmit,
  onClose,
}: StudentFeedbackPulseProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  async function handleTap(pace: "too_slow" | "just_right" | "too_fast") {
    setSelected(pace);
    setError("");
    setSubmitting(true);

    const feedbackData: StudentPostLessonFeedback = {
      student_id: studentId,
      submitted_at: new Date().toISOString(),
      // Neutral defaults — we're only collecting pace
      understanding: 3,
      engagement: 3,
      pace,
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
      setSelected(null);
    }
  }

  if (submitted) {
    return (
      <div className="text-center py-2">
        <span className="text-2xl">👍</span>
        <p className="text-sm text-gray-500 mt-1">Thanks!</p>
      </div>
    );
  }

  return (
    <div className="text-center">
      <p className="text-base font-semibold text-gray-900 mb-1">
        How was the pace?
      </p>
      <p className="text-sm text-gray-400 mb-4">Just tap one</p>

      <div className="flex justify-center gap-3">
        {PACE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            disabled={submitting}
            onClick={() => handleTap(opt.value)}
            className={`flex flex-col items-center gap-1.5 px-5 py-3 rounded-2xl transition-all ${
              selected === opt.value
                ? "bg-purple-50 border-2 border-purple-400 scale-105"
                : "border-2 border-gray-100 hover:border-gray-200 hover:bg-gray-50"
            } ${submitting ? "opacity-50" : ""}`}
          >
            <span className="text-3xl">{opt.emoji}</span>
            <span className="text-xs font-medium text-gray-500">{opt.label}</span>
          </button>
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
