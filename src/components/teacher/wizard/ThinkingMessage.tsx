"use client";

import { useState, useEffect } from "react";
import type { GenerationStatus } from "@/hooks/useWizardState";

interface Props {
  batches: Array<{ lessonIds: string[]; status: GenerationStatus }>;
  endGoal: string;
  isComplete: boolean;
  /** Per-lesson generation statuses (two-stage skeleton mode) */
  lessonStatuses?: Array<{ lessonId: string; status: GenerationStatus }>;
}

const EARLY_MESSAGES = [
  "Planning backwards from the end goal...",
  "Designing the opening hook to grab attention...",
  "Choosing the right entry point for your students...",
  "Setting up the inquiry question...",
  "Mapping out the skill progression...",
];

const MID_MESSAGES = [
  "Connecting lessons with skill bridges...",
  "Adding hands-on making activities...",
  "Weaving in assessment checkpoints...",
  "Building complexity toward the final project...",
  "Balancing theory with practical application...",
  "Scaffolding for different ability levels...",
];

const LATE_MESSAGES = [
  "Designing the culminating experience...",
  "Adding reflection and self-assessment...",
  "Ensuring all criteria are covered...",
  "Polishing the learning arc...",
  "Final touches on the journey...",
];

function getPerLessonMessages(statuses: Array<{ lessonId: string; status: GenerationStatus }>): string[] {
  const completed = statuses.filter(s => s.status === "done").length;
  const ratio = statuses.length > 0 ? completed / statuses.length : 0;
  if (ratio < 0.3) return EARLY_MESSAGES;
  if (ratio < 0.7) return MID_MESSAGES;
  return LATE_MESSAGES;
}

function getPhaseMessages(batches: Props["batches"]): string[] {
  if (batches.length === 0) return EARLY_MESSAGES;
  const currentBatchIndex = batches.findIndex(b => b.status === "generating");
  if (currentBatchIndex <= 0) return EARLY_MESSAGES;
  if (currentBatchIndex >= batches.length - 1) return LATE_MESSAGES;
  return MID_MESSAGES;
}

export function ThinkingMessage({ batches, endGoal, isComplete, lessonStatuses }: Props) {
  const [messageIndex, setMessageIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  // Use per-lesson statuses if available (skeleton mode), otherwise use batches
  const usePerLesson = lessonStatuses && lessonStatuses.length > 0;

  const messages = usePerLesson
    ? getPerLessonMessages(lessonStatuses!)
    : getPhaseMessages(batches);

  // Rotate messages every 3.5s
  useEffect(() => {
    if (isComplete) return;
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setMessageIndex((prev) => (prev + 1) % messages.length);
        setVisible(true);
      }, 300);
    }, 3500);
    return () => clearInterval(interval);
  }, [messages, isComplete]);

  // Reset index when phase messages change
  useEffect(() => {
    setMessageIndex(0);
  }, [messages]);

  if (isComplete) return null;

  // Per-lesson progress display
  if (usePerLesson) {
    const completed = lessonStatuses!.filter(s => s.status === "done").length;
    const generating = lessonStatuses!.filter(s => s.status === "generating");
    const total = lessonStatuses!.length;

    return (
      <div className="flex flex-col items-center gap-3 py-4">
        {/* Animated thinking indicator */}
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-purple animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="w-1.5 h-1.5 rounded-full bg-brand-purple animate-bounce" style={{ animationDelay: "150ms" }} />
            <span className="w-1.5 h-1.5 rounded-full bg-brand-purple animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
          <span
            className={`text-sm text-text-secondary italic transition-opacity duration-300 ${visible ? "opacity-100" : "opacity-0"}`}
          >
            {messages[messageIndex % messages.length]}
          </span>
        </div>

        {/* Per-lesson progress pills */}
        <div className="flex items-center gap-3 text-[11px] text-text-tertiary">
          <span>Lesson {completed + 1} of {total}</span>
          <div className="flex items-center gap-1">
            {lessonStatuses!.map((s) => (
              <div
                key={s.lessonId}
                className={`w-2 h-2 rounded-full transition-colors ${
                  s.status === "done"
                    ? "bg-green-400"
                    : s.status === "generating"
                      ? "bg-brand-purple animate-pulse"
                      : s.status === "error"
                        ? "bg-red-400"
                        : "bg-gray-200"
                }`}
                title={`${s.lessonId}: ${s.status}`}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Batch-based progress display (legacy)
  const totalLessons = batches.reduce((sum, b) => sum + b.lessonIds.length, 0);
  const completedLessons = batches
    .filter(b => b.status === "done")
    .reduce((sum, b) => sum + b.lessonIds.length, 0);
  const currentBatch = batches.find(b => b.status === "generating");

  return (
    <div className="flex flex-col items-center gap-3 py-4">
      {/* Animated thinking indicator */}
      <div className="flex items-center gap-2">
        <div className="flex gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-purple animate-bounce" style={{ animationDelay: "0ms" }} />
          <span className="w-1.5 h-1.5 rounded-full bg-brand-purple animate-bounce" style={{ animationDelay: "150ms" }} />
          <span className="w-1.5 h-1.5 rounded-full bg-brand-purple animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
        <span
          className={`text-sm text-text-secondary italic transition-opacity duration-300 ${visible ? "opacity-100" : "opacity-0"}`}
        >
          {messages[messageIndex % messages.length]}
        </span>
      </div>

      {/* Progress count */}
      {totalLessons > 0 && (
        <div className="flex items-center gap-2 text-[11px] text-text-tertiary">
          {currentBatch && (
            <span>
              Generating {currentBatch.lessonIds[0]}–{currentBatch.lessonIds[currentBatch.lessonIds.length - 1]}
            </span>
          )}
          <span className="text-text-tertiary/40">·</span>
          <span>{completedLessons} of {totalLessons} lessons</span>
        </div>
      )}
    </div>
  );
}
