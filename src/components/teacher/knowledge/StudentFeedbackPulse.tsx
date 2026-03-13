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
// Emoji scales
// ---------------------------------------------------------------------------
const UNDERSTANDING_EMOJIS = [
  { value: 1, emoji: "😵", label: "Lost" },
  { value: 2, emoji: "😕", label: "Confused" },
  { value: 3, emoji: "🤔", label: "Getting there" },
  { value: 4, emoji: "😊", label: "Got it" },
  { value: 5, emoji: "🤩", label: "Nailed it" },
] as const;

const ENGAGEMENT_EMOJIS = [
  { value: 1, emoji: "😴", label: "Boring" },
  { value: 2, emoji: "😐", label: "Meh" },
  { value: 3, emoji: "🙂", label: "Okay" },
  { value: 4, emoji: "😃", label: "Fun" },
  { value: 5, emoji: "🔥", label: "Loved it" },
] as const;

const PACE_OPTIONS = [
  { value: "too_slow" as const, emoji: "🐢", label: "Too slow" },
  { value: "just_right" as const, emoji: "👌", label: "Just right" },
  { value: "too_fast" as const, emoji: "🏃", label: "Too fast" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function StudentFeedbackPulse({
  lessonProfileId,
  unitId,
  pageId,
  studentId,
  onSubmit,
  onClose,
}: StudentFeedbackPulseProps) {
  const [understanding, setUnderstanding] = useState<number>(0);
  const [engagement, setEngagement] = useState<number>(0);
  const [pace, setPace] = useState<StudentPostLessonFeedback["pace"] | "">("");
  const [highlight, setHighlight] = useState("");
  const [struggle, setStruggle] = useState("");
  const [wantMore, setWantMore] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit() {
    if (understanding === 0) {
      setError("Tap how well you understood today's lesson");
      return;
    }
    if (engagement === 0) {
      setError("Tap how interesting today's lesson was");
      return;
    }
    if (!pace) {
      setError("Was the pace too slow, just right, or too fast?");
      return;
    }

    setSubmitting(true);
    setError("");

    const feedbackData: StudentPostLessonFeedback = {
      student_id: studentId,
      submitted_at: new Date().toISOString(),
      understanding: understanding as 1 | 2 | 3 | 4 | 5,
      engagement: engagement as 1 | 2 | 3 | 4 | 5,
      pace: pace as StudentPostLessonFeedback["pace"],
      ...(highlight.trim() && { highlight: highlight.trim() }),
      ...(struggle.trim() && { struggle: struggle.trim() }),
      ...(wantMore.trim() && { want_more: wantMore.trim() }),
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
      <div className="bg-green-50 border border-green-200 rounded-2xl p-8 text-center max-w-sm mx-auto">
        <div className="text-4xl mb-3">🎉</div>
        <h3 className="text-lg font-semibold text-green-800 mb-1">Thanks!</h3>
        <p className="text-sm text-green-600">Your feedback helps make lessons better.</p>
      </div>
    );
  }

  // ─── Form (designed for mobile-first, ~30 seconds) ───
  return (
    <div className="bg-white border border-border rounded-2xl shadow-sm max-w-sm mx-auto overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 px-5 py-4 border-b border-border">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-text-primary">
            Quick Check-In
          </h3>
          <span className="text-[10px] text-text-tertiary bg-white/60 px-2 py-0.5 rounded-full">
            ⏱ 30 sec
          </span>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* 1. Understanding — emoji scale */}
        <div>
          <p className="text-sm font-medium text-text-primary mb-3">
            How well do you understand?
          </p>
          <div className="flex justify-between gap-1">
            {UNDERSTANDING_EMOJIS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setUnderstanding(opt.value)}
                className={`flex-1 py-2 rounded-xl text-center transition-all ${
                  understanding === opt.value
                    ? "bg-brand-purple/10 border-2 border-brand-purple scale-105"
                    : "border-2 border-transparent hover:bg-surface-secondary"
                }`}
              >
                <span className="block text-2xl">{opt.emoji}</span>
                <span className="block text-[9px] text-text-tertiary mt-0.5">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 2. Engagement — emoji scale */}
        <div>
          <p className="text-sm font-medium text-text-primary mb-3">
            How interesting was today?
          </p>
          <div className="flex justify-between gap-1">
            {ENGAGEMENT_EMOJIS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setEngagement(opt.value)}
                className={`flex-1 py-2 rounded-xl text-center transition-all ${
                  engagement === opt.value
                    ? "bg-brand-purple/10 border-2 border-brand-purple scale-105"
                    : "border-2 border-transparent hover:bg-surface-secondary"
                }`}
              >
                <span className="block text-2xl">{opt.emoji}</span>
                <span className="block text-[9px] text-text-tertiary mt-0.5">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 3. Pace — three big buttons */}
        <div>
          <p className="text-sm font-medium text-text-primary mb-3">
            How was the pace?
          </p>
          <div className="flex gap-2">
            {PACE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setPace(opt.value)}
                className={`flex-1 py-3 rounded-xl text-center transition-all ${
                  pace === opt.value
                    ? "bg-brand-purple/10 border-2 border-brand-purple"
                    : "border-2 border-border hover:border-border-hover"
                }`}
              >
                <span className="block text-xl">{opt.emoji}</span>
                <span className="block text-xs text-text-secondary mt-0.5">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 4. Optional quick text — sentence starters */}
        <div className="space-y-2">
          <p className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wide">
            Optional — one sentence each
          </p>
          <div className="relative">
            <span className="absolute left-3 top-1.5 text-xs text-text-tertiary">The best part was...</span>
            <input
              type="text"
              value={highlight}
              onChange={(e) => setHighlight(e.target.value)}
              className="w-full px-3 pt-5 pb-1.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-purple/30"
            />
          </div>
          <div className="relative">
            <span className="absolute left-3 top-1.5 text-xs text-text-tertiary">I found it hard to...</span>
            <input
              type="text"
              value={struggle}
              onChange={(e) => setStruggle(e.target.value)}
              className="w-full px-3 pt-5 pb-1.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-purple/30"
            />
          </div>
          <div className="relative">
            <span className="absolute left-3 top-1.5 text-xs text-text-tertiary">I wish we had more time for...</span>
            <input
              type="text"
              value={wantMore}
              onChange={(e) => setWantMore(e.target.value)}
              className="w-full px-3 pt-5 pb-1.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-purple/30"
            />
          </div>
        </div>

        {/* Error */}
        {error && (
          <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg text-center">
            {error}
          </p>
        )}

        {/* Submit */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || understanding === 0 || engagement === 0 || !pace}
          className="w-full py-3 bg-brand-purple text-white text-sm font-semibold rounded-xl hover:bg-brand-purple-dark disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          {submitting ? "Sending..." : "Done ✓"}
        </button>
      </div>
    </div>
  );
}
