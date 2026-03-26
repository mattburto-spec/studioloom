"use client";

import { useEffect, useState } from "react";

/**
 * TransitionScreen — cinematic pause between stations.
 *
 * Shows Kit's reflection on what just happened + preview of where
 * we're going. Auto-advances after 4 seconds or click to continue.
 *
 * Each transition has a unique Kit line that bridges the two stations.
 *
 * @see docs/specs/discovery-engine-ux-design.md
 */

interface TransitionScreenProps {
  fromStation: number;
  toStation: number;
  fromName: string;
  toName: string;
  toEmoji: string;
  toDescription: string;
  onContinue: () => void;
}

/**
 * Kit's bridging dialogue for each transition.
 * These are the "walk between rooms" moments.
 * Kit reflects on what she learned + teases what's next.
 */
const TRANSITION_KIT_LINES: Record<string, string> = {
  "0_1":
    "Nice identity card. Now I know your aesthetic. But aesthetics are just the surface — let's find out how you actually think.",
  "1_2":
    "Quick-fire round done. I'm starting to see how your brain works. Now let's put that to the test with some real situations.",
  "2_3":
    "I'm building a picture of your strengths. Now I need to know what you actually care about — what grabs your attention and what makes you angry.",
  "3_4":
    "Your collection wall says a lot about you. Now let's look outward — there's a world of problems out there. Let's see which ones call to you.",
  "4_5":
    "You've got an eye for problems. Now the reality check — what tools and resources do you actually have to work with?",
  "5_6":
    "I know your strengths, your interests, your resources. Now comes the moment of truth — three paths forward. Only one is yours.",
  "6_7":
    "You've chosen your path. One last thing before you go — let's make it real. A statement, a commitment, a launch.",
};

const TRANSITION_ACCENT: Record<number, string> = {
  0: "#7B2FF2",
  1: "#F97316",
  2: "#F59E0B",
  3: "#14B8A6",
  4: "#3B82F6",
  5: "#10B981",
  6: "#8B5CF6",
  7: "#F43F5E",
};

export function TransitionScreen({
  fromStation,
  toStation,
  fromName,
  toName,
  toEmoji,
  toDescription,
  onContinue,
}: TransitionScreenProps) {
  const [showContent, setShowContent] = useState(false);
  const [showButton, setShowButton] = useState(false);

  const kitLine =
    TRANSITION_KIT_LINES[`${fromStation}_${toStation}`] ?? "Let's keep going.";
  const accent = TRANSITION_ACCENT[toStation] ?? "#7B2FF2";

  // Staggered reveal animation
  useEffect(() => {
    const t1 = setTimeout(() => setShowContent(true), 300);
    const t2 = setTimeout(() => setShowButton(true), 1500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  return (
    <div className="text-center max-w-md mx-auto">
      {/* Leaving indicator */}
      <div
        className="text-xs uppercase tracking-widest mb-8 transition-opacity duration-700"
        style={{
          color: `${TRANSITION_ACCENT[fromStation]}88`,
          opacity: showContent ? 1 : 0,
        }}
      >
        ✓ {fromName} complete
      </div>

      {/* Kit's reflection */}
      <div
        className="relative bg-white/5 backdrop-blur-sm rounded-2xl px-6 py-5 mb-8 text-left transition-all duration-700"
        style={{
          opacity: showContent ? 1 : 0,
          transform: showContent ? "translateY(0)" : "translateY(12px)",
          border: `1px solid ${accent}22`,
        }}
      >
        <div className="flex items-start gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-xl shrink-0"
            style={{
              background: `linear-gradient(135deg, ${accent}33, ${accent}66)`,
              border: `2px solid ${accent}88`,
            }}
          >
            😊
          </div>
          <p className="text-white/90 text-base leading-relaxed italic">
            &ldquo;{kitLine}&rdquo;
          </p>
        </div>
      </div>

      {/* Next station preview */}
      <div
        className="transition-all duration-700 delay-300"
        style={{
          opacity: showContent ? 1 : 0,
          transform: showContent ? "translateY(0)" : "translateY(12px)",
        }}
      >
        <div className="text-5xl mb-3">{toEmoji}</div>
        <h2
          className="text-2xl font-bold mb-1"
          style={{ color: `${accent}dd` }}
        >
          {toName}
        </h2>
        <p className="text-white/60 text-base">{toDescription}</p>
      </div>

      {/* Continue button */}
      <button
        onClick={onContinue}
        className="mt-8 px-8 py-3 rounded-full text-sm font-medium transition-all duration-500"
        style={{
          opacity: showButton ? 1 : 0,
          transform: showButton ? "translateY(0)" : "translateY(8px)",
          background: `${accent}22`,
          color: `${accent}ee`,
          border: `1px solid ${accent}44`,
        }}
      >
        Continue →
      </button>
    </div>
  );
}
