"use client";

import { useState, useCallback } from "react";
import type { UseDiscoverySessionReturn } from "@/hooks/useDiscoverySession";
import { getStation1Content } from "@/lib/discovery/content";
import {
  computeWorkingStyle,
  computeDominantStyle,
  QUICK_FIRE_REFLECTIONS,
  STATION_1_KIT_DIALOGUE,
} from "@/lib/discovery/content/station-1-campfire";
import type {
  Station1Data,
  WorkingStyleDimension,
  BinaryPair,
} from "@/lib/discovery/types";

/**
 * Station 1: The Campfire — Quick-Fire Binary Pairs
 *
 * Sub-steps:
 * 1. Intro — Kit explains the format
 * 2. Quick-fire — 12 binary pairs, one at a time
 * 3. Reflection — Kit reflects on the working style result
 *
 * Must feel fast and fun — no overthinking.
 * Kit comments at halfway and at the end.
 *
 * @see docs/specs/discovery-engine-build-plan.md Part 2, Station 1
 */

interface Station1CampfireProps {
  session: UseDiscoverySessionReturn;
}

export function Station1Campfire({ session }: Station1CampfireProps) {
  const { machine, profile } = session;
  const { current } = machine;
  const station1 = profile.station1;
  const { binaryPairs, kitDialogue } = getStation1Content(profile.ageBand);

  const [currentPairIndex, setCurrentPairIndex] = useState(() => {
    // Resume at the first unanswered pair
    const answered = Object.keys(station1.dimensions).length;
    return Math.min(answered, binaryPairs.length - 1);
  });

  const updateData = useCallback(
    (updates: Partial<Station1Data>) => {
      session.updateStation("station1", { ...station1, ...updates });
    },
    [session, station1],
  );

  const handleAnswer = useCallback(
    (pair: BinaryPair, choice: "a" | "b") => {
      const newDimensions = {
        ...station1.dimensions,
        [pair.dimension]: choice,
      };
      const answeredCount = Object.keys(newDimensions).length;

      // If all 12 answered, compute working style
      if (answeredCount >= 12) {
        const workingStyle = computeWorkingStyle(
          newDimensions as Record<WorkingStyleDimension, "a" | "b">,
        );
        const dominantStyle = computeDominantStyle(workingStyle);
        const kitReflection = QUICK_FIRE_REFLECTIONS[dominantStyle];

        updateData({
          dimensions: newDimensions as Record<WorkingStyleDimension, "a" | "b">,
          workingStyle,
          dominantStyle,
          kitReflection,
        });

        // Also update the top-level profile composites
        session.updateProfile({
          station1: {
            ...station1,
            dimensions: newDimensions as Record<WorkingStyleDimension, "a" | "b">,
            workingStyle,
            dominantStyle,
            kitReflection,
          },
          workingStyle,
          dominantStyle,
        });
      } else {
        updateData({
          dimensions: newDimensions as Record<WorkingStyleDimension, "a" | "b">,
        });
      }

      // Advance to next pair (with slight delay for feel)
      if (currentPairIndex < binaryPairs.length - 1) {
        setTimeout(() => {
          setCurrentPairIndex((prev) => prev + 1);
        }, 300);
      }
    },
    [station1, currentPairIndex, binaryPairs.length, updateData, session],
  );

  // ─── Intro ─────────────────────────────────────────────────
  if (current === "station_1" || current === "station_1_intro") {
    return (
      <div className="text-center">
        <div className="text-5xl mb-4">🔥</div>
        <h2 className="text-2xl font-bold text-white mb-3">The Campfire</h2>
        <p className="text-white/70 text-base max-w-md mx-auto leading-relaxed mb-4">
          {kitDialogue.intro}
        </p>
        <p className="text-white/60 text-base max-w-md mx-auto leading-relaxed">
          {kitDialogue.quickfire_setup}
        </p>
      </div>
    );
  }

  // ─── Quick-Fire ────────────────────────────────────────────
  if (current === "station_1_quickfire") {
    const pair = binaryPairs[currentPairIndex];
    if (!pair) return null;

    const answeredCount = Object.keys(station1.dimensions).length;
    const isHalfway = answeredCount === 6;
    const isSelected = station1.dimensions[pair.dimension as WorkingStyleDimension];

    return (
      <div>
        {/* Progress dots */}
        <div className="flex justify-center gap-1.5 mb-6">
          {binaryPairs.map((p, i) => {
            const isAnswered = !!station1.dimensions[p.dimension as WorkingStyleDimension];
            const isCurrent = i === currentPairIndex;
            return (
              <button
                key={p.id}
                onClick={() => setCurrentPairIndex(i)}
                className={`w-2.5 h-2.5 rounded-full transition-all duration-200 ${
                  isCurrent
                    ? "bg-orange-400 scale-125"
                    : isAnswered
                      ? "bg-orange-400/40"
                      : "bg-white/10"
                }`}
              />
            );
          })}
        </div>

        {/* Halfway message */}
        {isHalfway && !isSelected && (
          <p className="text-orange-300/60 text-sm text-center mb-4 italic">
            {kitDialogue.quickfire_halfway}
          </p>
        )}

        {/* Question */}
        <p className="text-white/90 text-center text-base mb-6 font-medium">
          {pair.prompt}
        </p>

        {/* Options */}
        <div className="space-y-3">
          <button
            onClick={() => handleAnswer(pair, "a")}
            className={`w-full text-left rounded-xl p-4 transition-all duration-200 ${
              isSelected === "a"
                ? "ring-2 ring-orange-400 bg-orange-400/10"
                : "bg-white/5 hover:bg-white/10 ring-1 ring-white/10 hover:ring-white/30"
            }`}
          >
            <div className="flex items-start gap-3">
              <span className="text-xl">{pair.optionA.icon}</span>
              <span className="text-sm text-white/80 leading-relaxed">
                {pair.optionA.label}
              </span>
            </div>
          </button>

          <button
            onClick={() => handleAnswer(pair, "b")}
            className={`w-full text-left rounded-xl p-4 transition-all duration-200 ${
              isSelected === "b"
                ? "ring-2 ring-orange-400 bg-orange-400/10"
                : "bg-white/5 hover:bg-white/10 ring-1 ring-white/10 hover:ring-white/30"
            }`}
          >
            <div className="flex items-start gap-3">
              <span className="text-xl">{pair.optionB.icon}</span>
              <span className="text-sm text-white/80 leading-relaxed">
                {pair.optionB.label}
              </span>
            </div>
          </button>
        </div>

        {/* Counter */}
        <p className="text-white/50 text-sm text-center mt-4">
          {answeredCount} / {binaryPairs.length}
        </p>
      </div>
    );
  }

  // ─── Reflection ────────────────────────────────────────────
  if (current === "station_1_reflection") {
    const style = station1.dominantStyle;
    const reflection = station1.kitReflection;

    return (
      <div className="text-center">
        <p className="text-orange-300/60 text-sm mb-4">
          {kitDialogue.quickfire_done}
        </p>

        {/* Dominant style badge */}
        {style && (
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-400/10 border border-orange-400/20 mb-6">
            <span className="text-base font-medium text-orange-300 capitalize">
              {style}
            </span>
          </div>
        )}

        {/* Kit's reflection */}
        <p className="text-white/80 text-base max-w-md mx-auto leading-relaxed mb-4">
          {kitDialogue.reflection_intro}
        </p>

        {reflection && (
          <p className="text-white/70 text-base max-w-md mx-auto leading-relaxed italic">
            &ldquo;{reflection}&rdquo;
          </p>
        )}

        <p className="text-white/60 text-sm max-w-md mx-auto mt-6">
          {kitDialogue.complete}
        </p>
      </div>
    );
  }

  return null;
}
