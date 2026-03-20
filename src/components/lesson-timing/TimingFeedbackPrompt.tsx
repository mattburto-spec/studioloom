"use client";

import { useState, type FC } from "react";

// =========================================================================
// Types
// =========================================================================

export interface PhaseFeedback {
  phaseId: "opening" | "miniLesson" | "workTime" | "debrief";
  /** -1 = too short, 0 = about right, 1 = too long */
  rating: -1 | 0 | 1;
  /** Optional: actual duration if teacher tracked it */
  actualMinutes?: number;
}

export interface TimingFeedbackData {
  lessonId: string;
  phaseFeedback: PhaseFeedback[];
  /** Did early finishers complete the extension? */
  extensionsCompleted: "yes" | "partial" | "no" | null;
  /** Free-text note */
  note?: string;
}

export interface TimingFeedbackPromptProps {
  lessonId: string;
  lessonTitle: string;
  /** Planned phase durations for reference */
  plannedPhases: { id: string; label: string; durationMinutes: number; color: string }[];
  onSubmit: (feedback: TimingFeedbackData) => void;
  onDismiss: () => void;
}

// =========================================================================
// Component
// =========================================================================

const RATING_OPTIONS = [
  { value: -1 as const, label: "Too Short", emoji: "⏪" },
  { value: 0 as const, label: "About Right", emoji: "✓" },
  { value: 1 as const, label: "Too Long", emoji: "⏩" },
];

const TimingFeedbackPrompt: FC<TimingFeedbackPromptProps> = ({
  lessonId,
  lessonTitle,
  plannedPhases,
  onSubmit,
  onDismiss,
}) => {
  const [ratings, setRatings] = useState<Record<string, -1 | 0 | 1>>({});
  const [actuals, setActuals] = useState<Record<string, string>>({});
  const [extensionsCompleted, setExtensionsCompleted] = useState<"yes" | "partial" | "no" | null>(null);
  const [note, setNote] = useState("");
  const [showActuals, setShowActuals] = useState(false);

  const handleSubmit = () => {
    const phaseFeedback: PhaseFeedback[] = plannedPhases.map((p) => ({
      phaseId: p.id as PhaseFeedback["phaseId"],
      rating: ratings[p.id] ?? 0,
      ...(actuals[p.id] ? { actualMinutes: parseInt(actuals[p.id], 10) } : {}),
    }));

    onSubmit({
      lessonId,
      phaseFeedback,
      extensionsCompleted,
      note: note.trim() || undefined,
    });
  };

  const hasAtLeastOneRating = Object.keys(ratings).length > 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 max-w-lg">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">How did the timing go?</h3>
          <p className="text-xs text-gray-500 mt-0.5">{lessonTitle}</p>
        </div>
        <button onClick={onDismiss} className="text-gray-400 hover:text-gray-600 p-1">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
          </svg>
        </button>
      </div>

      {/* Per-phase ratings */}
      <div className="space-y-3 mb-4">
        {plannedPhases.map((phase) => (
          <div key={phase.id} className="flex items-center gap-3">
            <div className="w-20 text-xs font-medium" style={{ color: phase.color }}>
              {phase.label}
              <span className="text-gray-400 ml-1">({phase.durationMinutes}m)</span>
            </div>
            <div className="flex gap-1">
              {RATING_OPTIONS.map((opt) => {
                const isSelected = ratings[phase.id] === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setRatings((r) => ({ ...r, [phase.id]: opt.value }))}
                    className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                      isSelected
                        ? "bg-purple-100 border-purple-300 text-purple-700 font-medium"
                        : "border-gray-200 text-gray-500 hover:bg-gray-50"
                    }`}
                  >
                    {opt.emoji} {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Optional: actual durations */}
      <button
        onClick={() => setShowActuals(!showActuals)}
        className="text-xs text-purple-600 hover:text-purple-800 mb-3 flex items-center gap-1"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
          <path fillRule="evenodd" d="M8 2a6 6 0 1 0 0 12A6 6 0 0 0 8 2ZM5.354 5.354a.5.5 0 0 1 .708 0L8 7.293l1.938-1.939a.5.5 0 0 1 .708.708L8.354 8.354a.5.5 0 0 1-.708 0L5.354 6.062a.5.5 0 0 1 0-.708Z" clipRule="evenodd" />
        </svg>
        {showActuals ? "Hide" : "Log"} actual durations (optional)
      </button>

      {showActuals && (
        <div className="flex gap-2 mb-4">
          {plannedPhases.map((phase) => (
            <div key={phase.id} className="flex-1">
              <label className="text-[10px] text-gray-500 mb-0.5 block">{phase.label}</label>
              <input
                type="number"
                min={0}
                max={120}
                placeholder={`${phase.durationMinutes}`}
                value={actuals[phase.id] || ""}
                onChange={(e) => setActuals((a) => ({ ...a, [phase.id]: e.target.value }))}
                className="w-full px-2 py-1 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-300"
              />
            </div>
          ))}
        </div>
      )}

      {/* Extensions completion */}
      <div className="mb-4">
        <p className="text-xs text-gray-600 mb-1.5">Did early finishers complete the extension?</p>
        <div className="flex gap-1.5">
          {(["yes", "partial", "no"] as const).map((opt) => (
            <button
              key={opt}
              onClick={() => setExtensionsCompleted(opt)}
              className={`px-3 py-1 text-xs rounded-full border transition-colors capitalize ${
                extensionsCompleted === opt
                  ? "bg-purple-100 border-purple-300 text-purple-700 font-medium"
                  : "border-gray-200 text-gray-500 hover:bg-gray-50"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      {/* Note */}
      <textarea
        placeholder="Any notes on timing? (optional)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-300 mb-4 resize-none"
        rows={2}
      />

      {/* Actions */}
      <div className="flex gap-2 justify-end">
        <button
          onClick={onDismiss}
          className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700"
        >
          Skip
        </button>
        <button
          onClick={handleSubmit}
          disabled={!hasAtLeastOneRating}
          className="px-4 py-1.5 text-xs font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Save Feedback
        </button>
      </div>
    </div>
  );
};

export default TimingFeedbackPrompt;
