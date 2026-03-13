"use client";

import { useState } from "react";
import type { TeacherPostLessonFeedback } from "@/types/lesson-intelligence";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface TeacherFeedbackFormProps {
  /** Lesson profile ID — optional if unitId is provided */
  lessonProfileId?: string;
  lessonTitle?: string;
  /** Optionally pre-fill from the lesson profile's lesson_flow phases */
  phases?: Array<{ title: string; duration_minutes: number }>;
  unitId?: string;
  pageId?: string;
  classId?: string;
  onSubmit?: (feedbackId: string) => void;
  onClose?: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const ENGAGEMENT_OPTIONS: { value: TeacherPostLessonFeedback["student_engagement"]; label: string; emoji: string }[] = [
  { value: "low", label: "Low", emoji: "😴" },
  { value: "mixed", label: "Mixed", emoji: "🤷" },
  { value: "good", label: "Good", emoji: "😊" },
  { value: "excellent", label: "Excellent", emoji: "🔥" },
];

const WENT_WELL_SUGGESTIONS = [
  "Students were engaged throughout",
  "Scaffolding worked well",
  "Good peer collaboration",
  "Timing was spot-on",
  "Differentiation helped all levels",
  "Strong inquiry questions from students",
  "Smooth transitions between activities",
  "Clear student understanding shown",
];

const TO_CHANGE_SUGGESTIONS = [
  "Needed more time for main activity",
  "Instructions were unclear",
  "Too much teacher talk",
  "Differentiation needed adjustment",
  "Students lost focus midway",
  "Resources weren't ready",
  "Pacing was too fast",
  "Assessment didn't capture learning",
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function TeacherFeedbackForm({
  lessonProfileId,
  lessonTitle,
  phases,
  unitId,
  pageId,
  classId,
  onSubmit,
  onClose,
}: TeacherFeedbackFormProps) {
  // Quick-capture fields
  const [overallRating, setOverallRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [engagement, setEngagement] = useState<TeacherPostLessonFeedback["student_engagement"] | "">("");
  const [wentWell, setWentWell] = useState<string[]>([]);
  const [wentWellCustom, setWentWellCustom] = useState("");
  const [toChange, setToChange] = useState<string[]>([]);
  const [toChangeCustom, setToChangeCustom] = useState("");
  const [actualDuration, setActualDuration] = useState<string>("");
  const [wouldUseAgain, setWouldUseAgain] = useState<boolean | null>(null);
  const [modifications, setModifications] = useState("");

  // Optional expanded fields
  const [showMore, setShowMore] = useState(false);
  const [timeOfDay, setTimeOfDay] = useState("");
  const [classEnergy, setClassEnergy] = useState("");
  const [misconceptions, setMisconceptions] = useState("");
  const [unexpectedSuccesses, setUnexpectedSuccesses] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  // Toggle a suggestion chip
  function toggleChip(list: string[], setList: (v: string[]) => void, item: string) {
    setList(list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);
  }

  async function handleSubmit() {
    if (overallRating === 0) {
      setError("Please give an overall rating");
      return;
    }
    if (!engagement) {
      setError("Please select student engagement level");
      return;
    }

    setSubmitting(true);
    setError("");

    const allWentWell = [...wentWell];
    if (wentWellCustom.trim()) allWentWell.push(wentWellCustom.trim());

    const allToChange = [...toChange];
    if (toChangeCustom.trim()) allToChange.push(toChangeCustom.trim());

    const allModifications = modifications
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

    const feedbackData: TeacherPostLessonFeedback = {
      lesson_profile_id: lessonProfileId || "",
      unit_id: unitId,
      page_id: pageId,
      class_id: classId,
      taught_at: new Date().toISOString(),
      overall_rating: overallRating as 1 | 2 | 3 | 4 | 5,
      went_well: allWentWell,
      to_change: allToChange,
      student_engagement: engagement as TeacherPostLessonFeedback["student_engagement"],
      actual_duration_minutes: actualDuration ? parseInt(actualDuration, 10) : 0,
      would_use_again: wouldUseAgain ?? true,
      modifications_for_next_time: allModifications,
      ...(timeOfDay && { time_of_day: timeOfDay }),
      ...(classEnergy && { class_energy: classEnergy as TeacherPostLessonFeedback["class_energy"] }),
      ...(misconceptions.trim() && {
        misconceptions_observed: misconceptions.split("\n").map((s) => s.trim()).filter(Boolean),
      }),
      ...(unexpectedSuccesses.trim() && {
        unexpected_successes: unexpectedSuccesses.split("\n").map((s) => s.trim()).filter(Boolean),
      }),
    };

    try {
      const res = await fetch("/api/teacher/knowledge/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feedback_type: "teacher",
          ...(lessonProfileId && { lesson_profile_id: lessonProfileId }),
          unit_id: unitId,
          page_id: pageId,
          class_id: classId,
          feedback_data: feedbackData,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to submit feedback");
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

  // ─── Success state ───
  if (submitted) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
        <div className="text-3xl mb-2">✅</div>
        <h3 className="text-lg font-semibold text-green-800 mb-1">Feedback saved</h3>
        <p className="text-sm text-green-600 mb-4">
          This will improve future AI-generated lessons for similar content.
        </p>
        <button
          onClick={onClose}
          className="text-sm text-green-700 hover:text-green-900 underline"
        >
          Close
        </button>
      </div>
    );
  }

  // ─── Form ───
  return (
    <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-brand-purple/5 to-brand-purple/10 px-5 py-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-text-primary">
              Post-Lesson Reflection
            </h3>
            {lessonTitle && (
              <p className="text-xs text-text-secondary mt-0.5">{lessonTitle}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-text-tertiary bg-white/60 px-2 py-0.5 rounded-full">
              ⏱ ~60 seconds
            </span>
            {onClose && (
              <button onClick={onClose} className="text-text-tertiary hover:text-text-primary text-lg leading-none">
                ×
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* 1. Overall Rating — stars */}
        <div>
          <label className="text-xs font-semibold text-text-secondary uppercase tracking-wide block mb-2">
            How did this lesson go?
          </label>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                onClick={() => setOverallRating(star)}
                className="text-2xl transition-transform hover:scale-110"
              >
                {star <= (hoverRating || overallRating) ? "⭐" : "☆"}
              </button>
            ))}
            {overallRating > 0 && (
              <span className="text-xs text-text-secondary self-center ml-2">
                {["", "Rough", "Below average", "Decent", "Good", "Excellent"][overallRating]}
              </span>
            )}
          </div>
        </div>

        {/* 2. Student Engagement */}
        <div>
          <label className="text-xs font-semibold text-text-secondary uppercase tracking-wide block mb-2">
            Student engagement
          </label>
          <div className="flex gap-2">
            {ENGAGEMENT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setEngagement(opt.value)}
                className={`flex-1 py-2 px-3 rounded-lg border text-center transition-all text-sm ${
                  engagement === opt.value
                    ? "border-brand-purple bg-brand-purple/5 text-brand-purple font-medium"
                    : "border-border text-text-secondary hover:border-border-hover"
                }`}
              >
                <span className="block text-lg">{opt.emoji}</span>
                <span className="block text-[10px] mt-0.5">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 3. What went well — chip selector */}
        <div>
          <label className="text-xs font-semibold text-text-secondary uppercase tracking-wide block mb-2">
            What went well?
          </label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {WENT_WELL_SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => toggleChip(wentWell, setWentWell, s)}
                className={`px-2.5 py-1 rounded-full text-xs transition-all ${
                  wentWell.includes(s)
                    ? "bg-green-100 text-green-800 border border-green-300"
                    : "bg-surface-secondary text-text-secondary border border-transparent hover:border-border"
                }`}
              >
                {wentWell.includes(s) && "✓ "}{s}
              </button>
            ))}
          </div>
          <input
            type="text"
            placeholder="Add your own..."
            value={wentWellCustom}
            onChange={(e) => setWentWellCustom(e.target.value)}
            className="w-full px-3 py-1.5 text-xs border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-purple/30"
          />
        </div>

        {/* 4. What to change — chip selector */}
        <div>
          <label className="text-xs font-semibold text-text-secondary uppercase tracking-wide block mb-2">
            What would you change?
          </label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {TO_CHANGE_SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => toggleChip(toChange, setToChange, s)}
                className={`px-2.5 py-1 rounded-full text-xs transition-all ${
                  toChange.includes(s)
                    ? "bg-orange-100 text-orange-800 border border-orange-300"
                    : "bg-surface-secondary text-text-secondary border border-transparent hover:border-border"
                }`}
              >
                {toChange.includes(s) && "✓ "}{s}
              </button>
            ))}
          </div>
          <input
            type="text"
            placeholder="Add your own..."
            value={toChangeCustom}
            onChange={(e) => setToChangeCustom(e.target.value)}
            className="w-full px-3 py-1.5 text-xs border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-purple/30"
          />
        </div>

        {/* 5. Duration + Would use again (inline) */}
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="text-xs font-semibold text-text-secondary uppercase tracking-wide block mb-2">
              Actual duration (min)
            </label>
            <input
              type="number"
              min={0}
              max={300}
              value={actualDuration}
              onChange={(e) => setActualDuration(e.target.value)}
              placeholder="e.g. 45"
              className="w-full px-3 py-1.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-purple/30"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs font-semibold text-text-secondary uppercase tracking-wide block mb-2">
              Use again?
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setWouldUseAgain(true)}
                className={`flex-1 py-1.5 rounded-lg border text-sm transition-all ${
                  wouldUseAgain === true
                    ? "border-green-400 bg-green-50 text-green-700 font-medium"
                    : "border-border text-text-secondary hover:border-border-hover"
                }`}
              >
                👍 Yes
              </button>
              <button
                type="button"
                onClick={() => setWouldUseAgain(false)}
                className={`flex-1 py-1.5 rounded-lg border text-sm transition-all ${
                  wouldUseAgain === false
                    ? "border-red-400 bg-red-50 text-red-700 font-medium"
                    : "border-border text-text-secondary hover:border-border-hover"
                }`}
              >
                👎 No
              </button>
            </div>
          </div>
        </div>

        {/* 6. Modifications for next time */}
        <div>
          <label className="text-xs font-semibold text-text-secondary uppercase tracking-wide block mb-2">
            Changes for next time
          </label>
          <textarea
            value={modifications}
            onChange={(e) => setModifications(e.target.value)}
            placeholder="One change per line..."
            rows={2}
            className="w-full px-3 py-2 text-xs border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-purple/30 resize-none"
          />
        </div>

        {/* ─── Expandable: More Detail ─── */}
        <button
          type="button"
          onClick={() => setShowMore(!showMore)}
          className="text-xs text-brand-purple hover:text-brand-purple-dark flex items-center gap-1"
        >
          <svg className={`w-3 h-3 transition-transform ${showMore ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          {showMore ? "Less detail" : "Add more detail (optional)"}
        </button>

        {showMore && (
          <div className="space-y-4 pl-3 border-l-2 border-brand-purple/10">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-semibold text-text-secondary uppercase block mb-1">
                  Time of day
                </label>
                <input
                  type="text"
                  value={timeOfDay}
                  onChange={(e) => setTimeOfDay(e.target.value)}
                  placeholder="e.g. Period 3, after lunch"
                  className="w-full px-2 py-1 text-xs border border-border rounded focus:outline-none focus:ring-1 focus:ring-brand-purple/30"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-text-secondary uppercase block mb-1">
                  Class energy
                </label>
                <select
                  value={classEnergy}
                  onChange={(e) => setClassEnergy(e.target.value)}
                  className="w-full px-2 py-1 text-xs border border-border rounded focus:outline-none focus:ring-1 focus:ring-brand-purple/30"
                >
                  <option value="">Select...</option>
                  <option value="calm_focus">Calm focus</option>
                  <option value="restless">Restless</option>
                  <option value="creative_energy">Creative energy</option>
                  <option value="tired">Tired / low energy</option>
                  <option value="excitable">Excitable / chatty</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-text-secondary uppercase block mb-1">
                Misconceptions observed
              </label>
              <textarea
                value={misconceptions}
                onChange={(e) => setMisconceptions(e.target.value)}
                placeholder="One per line..."
                rows={2}
                className="w-full px-2 py-1.5 text-xs border border-border rounded focus:outline-none focus:ring-1 focus:ring-brand-purple/30 resize-none"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-text-secondary uppercase block mb-1">
                Unexpected successes
              </label>
              <textarea
                value={unexpectedSuccesses}
                onChange={(e) => setUnexpectedSuccesses(e.target.value)}
                placeholder="Things that worked better than expected..."
                rows={2}
                className="w-full px-2 py-1.5 text-xs border border-border rounded focus:outline-none focus:ring-1 focus:ring-brand-purple/30 resize-none"
              />
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
        )}

        {/* Submit */}
        <div className="flex items-center justify-between pt-2 border-t border-border">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="text-xs text-text-secondary hover:text-text-primary"
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || overallRating === 0}
            className="ml-auto px-5 py-2 bg-brand-purple text-white text-sm font-medium rounded-lg hover:bg-brand-purple-dark disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {submitting ? "Saving..." : "Save Reflection"}
          </button>
        </div>
      </div>
    </div>
  );
}
