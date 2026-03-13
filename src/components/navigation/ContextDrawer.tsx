"use client";

import { useState } from "react";
import type { VocabWarmup as VocabWarmupType } from "@/types";
import { VocabWarmup } from "@/components/student/VocabWarmup";
import { TextToSpeech } from "@/components/student/TextToSpeech";

interface ContextDrawerProps {
  learningGoal?: string;
  vocabWarmup?: VocabWarmupType;
  introduction?: {
    text: string;
    media?: { type: "image" | "video"; url: string };
  };
  ellLevel: number;
  pageColor: string;
}

export function ContextDrawer({
  learningGoal,
  vocabWarmup,
  introduction,
  ellLevel,
  pageColor,
}: ContextDrawerProps) {
  // Auto-expand for ELL 1 students who need the scaffolding most
  const [isOpen, setIsOpen] = useState(ellLevel === 1);

  // Don't render if there's nothing to show
  if (!learningGoal && !vocabWarmup && !introduction) return null;

  return (
    <div className="mb-6 relative">
      {/* Collapsed bar — always visible */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full bg-white/90 backdrop-blur-sm border border-border/50 px-4 py-3 flex items-center gap-3 text-left transition-all duration-150 hover:bg-white hover:shadow-sm border-l-4 ${
          isOpen ? "rounded-t-xl" : "rounded-xl"
        }`}
        style={{ borderLeftColor: pageColor }}
      >
        {/* Chevron with page color */}
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-200"
          style={{ backgroundColor: pageColor + "15" }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke={pageColor}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="transition-transform duration-200"
            style={{ transform: isOpen ? "rotate(90deg)" : "rotate(0deg)" }}
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </div>

        <span className="text-xs font-semibold text-text-secondary uppercase tracking-wide flex-shrink-0">
          Context & Scaffolding
        </span>

        {/* Truncated learning goal preview when collapsed */}
        {!isOpen && learningGoal && (
          <span className="text-xs text-text-secondary/60 truncate min-w-0 flex-1">
            — {learningGoal}
          </span>
        )}
      </button>

      {/* Pull tab hanging from bottom edge when collapsed */}
      {!isOpen && (
        <div className="absolute left-1/2 -translate-x-1/2 -bottom-2.5 z-10">
          <svg width="28" height="12" viewBox="0 0 28 12">
            <path d="M0 0 L14 10 L28 0 Z" fill="#FF3366" opacity="0.75" />
          </svg>
        </div>
      )}

      {/* Expandable content */}
      <div className={`drawer-content ${isOpen ? "open" : ""}`}>
        <div>
          <div className="bg-white rounded-b-xl border border-t-0 border-border/50 px-5 pb-5 pt-3 space-y-4">
            {/* Learning Goal */}
            {learningGoal && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
                    Learning Goal
                  </p>
                  <TextToSpeech text={learningGoal} />
                </div>
                <p className="text-sm text-text-primary">{learningGoal}</p>
              </div>
            )}

            {/* Vocab Warm-up */}
            {vocabWarmup && (
              <div>
                <VocabWarmup warmup={vocabWarmup} ellLevel={ellLevel} />
              </div>
            )}

            {/* Introduction */}
            {introduction && (
              <div>
                <div className="flex items-start gap-2">
                  <p className="text-text-primary leading-relaxed text-sm flex-1">
                    {introduction.text}
                  </p>
                  <TextToSpeech text={introduction.text} />
                </div>
                {introduction.media?.type === "image" && (
                  <div className="mt-3 rounded-lg overflow-hidden bg-surface-alt">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={introduction.media.url}
                      alt=""
                      className="w-full"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
