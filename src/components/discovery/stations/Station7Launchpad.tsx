"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import type { UseDiscoverySessionReturn } from "@/hooks/useDiscoverySession";
import {
  getCriteriaForStudent,
  getExcitementReaction,
  buildCriteriaReaction,
  S7_KIT_DIALOGUE,
  GO_BACK_MESSAGE,
} from "@/lib/discovery/content/station-7-launchpad";
import type { Station7Data } from "@/lib/discovery/types";

/**
 * Station 7: The Launchpad — Commitment & Grand Reveal
 *
 * This is the final station where students commit to their project.
 *
 * Sub-steps flow:
 * 1. station_7 / station_7_intro — Intro with 🚀 emoji
 * 2. station_7_ascent — Brief transitional screen
 * 3. station_7_statement — Project statement builder
 * 4. station_7_criteria — Success criteria selection (toggle + custom)
 * 5. station_7_excitement — Excitement slider with optional backtrack
 * 6. station_7_grand_reveal — The big reveal (archetype + strengths)
 * 7. station_7_share — Final share screen with teacher summary
 *
 * @see docs/specs/discovery-engine-build-plan.md Part 7
 */

interface Station7LaunchpadProps {
  session: UseDiscoverySessionReturn;
}

export function Station7Launchpad({ session }: Station7LaunchpadProps) {
  const { machine, profile } = session;
  const { current } = machine;
  const station7 = profile.station7;
  const archetypeResult = profile.archetypeResult;

  // Local UI state
  const [customCriteriaInput, setCustomCriteriaInput] = useState("");
  const [selectedCriteria, setSelectedCriteria] = useState<Set<string>>(
    new Set(station7.successCriteria || []),
  );
  const [revealNarrative, setRevealNarrative] = useState<string | null>(null);
  const [revealLoading, setRevealLoading] = useState(false);

  // Get all available criteria
  const allCriteria = useMemo(
    () =>
      archetypeResult
        ? getCriteriaForStudent(
            archetypeResult.primary,
            archetypeResult.secondary,
          )
        : [],
    [archetypeResult],
  );

  const updateData = useCallback(
    (updates: Partial<Station7Data>) => {
      session.updateStation("station7", { ...station7, ...updates });
    },
    [session, station7],
  );

  // ─── Intro ──────────────────────────────────────────────────

  if (current === "station_7" || current === "station_7_intro") {
    return (
      <div className="text-center">
        <div className="text-5xl mb-4">🚀</div>
        <h2 className="text-2xl font-bold text-white mb-3">The Launchpad</h2>
        <p className="text-white/80 text-base max-w-md mx-auto leading-relaxed">
          {S7_KIT_DIALOGUE.intro}
        </p>
      </div>
    );
  }

  // ─── Ascent (Motivational transition) ───────────────────────

  if (current === "station_7_ascent") {
    return (
      <div className="text-center max-w-md mx-auto">
        <p className="text-white/70 text-sm leading-relaxed">
          {S7_KIT_DIALOGUE.ascent}
        </p>
      </div>
    );
  }

  // ─── Project Statement ──────────────────────────────────────

  if (current === "station_7_statement") {
    const statement = station7.projectStatement || "";
    const wordCount = statement.trim().split(/\s+/).filter(Boolean).length;
    const isValid = wordCount >= 10;

    return (
      <div className="max-w-2xl mx-auto">
        <p className="text-white/70 text-sm mb-4 leading-relaxed">
          {S7_KIT_DIALOGUE.beforeStatement}
        </p>

        {/* Template hint */}
        <div className="bg-white/5 border border-white/10 rounded-lg p-3 mb-4 text-white/50 text-xs italic">
          {S7_KIT_DIALOGUE.statementPrompt}
        </div>

        {/* Textarea */}
        <textarea
          value={statement}
          onChange={(e) => updateData({ projectStatement: e.target.value })}
          placeholder="Write your project statement here..."
          className="w-full h-32 bg-white/5 border border-white/10 rounded-lg p-4 text-white placeholder-white/30 focus:outline-none focus:border-purple-500/50 resize-none"
        />

        {/* Word count indicator */}
        <div className="mt-3 flex justify-between items-center text-xs">
          <span className={isValid ? "text-emerald-400" : "text-amber-400"}>
            {wordCount} words
            {!isValid && " (need 10+)"}
          </span>
          {isValid && <span className="text-emerald-400">✓ Ready</span>}
        </div>
      </div>
    );
  }

  // ─── Success Criteria Selection ──────────────────────────────

  if (current === "station_7_criteria") {
    const handleToggle = (criterion: string) => {
      const newSet = new Set(selectedCriteria);
      if (newSet.has(criterion)) {
        newSet.delete(criterion);
      } else {
        newSet.add(criterion);
      }
      setSelectedCriteria(newSet);
      updateData({ successCriteria: Array.from(newSet) });
    };

    const handleAddCustom = () => {
      if (customCriteriaInput.trim() && customCriteriaInput.length >= 5) {
        handleToggle(customCriteriaInput.trim());
        setCustomCriteriaInput("");
      }
    };

    const criteriaReaction = buildCriteriaReaction(
      Array.from(selectedCriteria),
      archetypeResult?.primary || "Maker",
    );

    return (
      <div className="max-w-2xl mx-auto">
        <p className="text-white/70 text-sm mb-4 leading-relaxed">
          {S7_KIT_DIALOGUE.beforeCriteria}
        </p>

        {/* Criteria counter */}
        <div className="text-xs mb-4">
          <span className={selectedCriteria.size >= 3 ? "text-emerald-400" : "text-amber-400"}>
            Selected: {selectedCriteria.size}
          </span>
          <span className="text-white/50"> / 3-5 recommended</span>
          {selectedCriteria.size < 3 && (
            <span className="text-amber-400 ml-2">
              (pick at least {3 - selectedCriteria.size} more to continue)
            </span>
          )}
          {selectedCriteria.size > 5 && (
            <span className="text-amber-400 ml-2">
              — that's a lot. Make sure they're not pulling you in opposite directions.
            </span>
          )}
        </div>

        {/* Criteria chips */}
        <div className="space-y-2 mb-6 max-h-96 overflow-y-auto">
          {allCriteria.map((criterion) => (
            <button
              key={criterion}
              onClick={() => handleToggle(criterion)}
              className={`w-full text-left px-4 py-3 rounded-lg border transition-all text-sm ${
                selectedCriteria.has(criterion)
                  ? "bg-purple-500/30 border-purple-400 text-white"
                  : "bg-white/5 border-white/10 text-white/60 hover:border-white/20"
              }`}
            >
              <span className="mr-2">
                {selectedCriteria.has(criterion) ? "✓" : "○"}
              </span>
              {criterion}
            </button>
          ))}
        </div>

        {/* Custom criteria input */}
        <div className="mb-6 p-4 bg-white/5 border border-white/10 rounded-lg">
          <label className="block text-xs text-white/50 mb-2">
            Or write your own criterion
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={customCriteriaInput}
              onChange={(e) => setCustomCriteriaInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleAddCustom();
                }
              }}
              placeholder="I will..."
              className="flex-1 bg-white/5 border border-white/10 rounded px-3 py-2 text-white placeholder-white/30 text-sm focus:outline-none focus:border-purple-500/50"
            />
            <button
              onClick={handleAddCustom}
              disabled={customCriteriaInput.trim().length < 5}
              className="px-4 py-2 bg-purple-500/30 border border-purple-400 rounded text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-purple-500/40 transition-all"
            >
              Add
            </button>
          </div>
        </div>

        {/* Kit's reaction to criteria */}
        {selectedCriteria.size > 0 && (
          <div className="p-3 bg-white/5 border border-white/10 rounded-lg text-white/70 text-sm italic leading-relaxed">
            "{criteriaReaction}"
          </div>
        )}
      </div>
    );
  }

  // ─── Excitement Slider ──────────────────────────────────────

  if (current === "station_7_excitement") {
    const score = station7.excitementScore ?? 50;
    const reaction = getExcitementReaction(score);

    return (
      <div className="max-w-md mx-auto text-center">
        <p className="text-white/70 text-sm mb-6 leading-relaxed">
          {S7_KIT_DIALOGUE.beforeExcitement}
        </p>

        <p className="text-white/60 text-sm mb-4 font-medium">
          {S7_KIT_DIALOGUE.excitementPrompt}
        </p>

        {/* Excitement score display */}
        <div className="text-4xl font-bold text-xsurple-400 mb-2">{score}</div>

        {/* Slider */}
        <div className="mb-6">
          <input
            type="range"
            min={0}
            max={100}
            value={score}
            onChange={(e) => {
              const newScore = parseInt(e.target.value, 10);
              updateData({ excitementScore: newScore });
            }}
            className="w-full h-2 bg-purple-500/20 rounded-lg appearance-none cursor-pointer accent-purple-500"
          />

          {/* Slider labels */}
          <div className="flex justify-between text-xs text-white/40 mt-2">
            <span>Honestly? Not very.</span>
            <span>I can't wait to start.</span>
          </div>
        </div>

        {/* Kit's reaction */}
        <div className="p-4 bg-white/5 border border-white/10 rounded-lg mb-6 text-white/70 text-sm leading-relaxed">
          "{reaction.response}"
        </div>

        {/* Backtrack button (for low excitement) */}
        {reaction.offerBacktrack && (
          <div className="space-y-2">
            <p className="text-white/50 text-xs italic">{GO_BACK_MESSAGE}</p>
            <button
              onClick={() => session.goToStep("station_6_explore_1")}
              className="w-full px-4 py-2 bg-amber-500/20 border border-amber-500/50 text-amber-100 rounded-lg text-sm hover:bg-amber-500/30 transition-all"
            >
              Go Back to Door Selection
            </button>
          </div>
        )}
      </div>
    );
  }

  // ─── Grand Reveal ───────────────────────────────────────────

  // Fetch AI-personalized narrative when entering grand reveal
  useEffect(() => {
    if (current !== "station_7_grand_reveal") return;
    if (revealNarrative || revealLoading) return;

    setRevealLoading(true);

    const chosenDoor =
      profile.station6?.chosenDoorIndex != null && profile.station6?.doors
        ? profile.station6.doors[profile.station6.chosenDoorIndex]?.title
        : profile.station6?.customDoor ?? null;

    fetch("/api/discovery/reflect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "s7_grand_reveal",
        context: {
          primaryArchetype: archetypeResult?.primary ?? "unknown",
          secondaryArchetype: archetypeResult?.secondary ?? null,
          isPolymath: archetypeResult?.isPolymath ?? false,
          interests: profile.station3?.interests?.slice(0, 5) ?? [],
          irritationSummary:
            profile.station3?.irritationFreeText ??
            profile.station3?.irritationPresets?.join(", ") ??
            "none",
          coreValues: profile.station3?.valuesRanking?.core ?? [],
          chosenDoor,
          projectStatement: station7.projectStatement ?? "none",
          fearCards: profile.station6?.fearCards ?? [],
          dominantStyle: profile.dominantStyle ?? "unknown",
        },
      }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.result?.narrative) {
          setRevealNarrative(data.result.narrative);
        }
      })
      .catch(() => {})
      .finally(() => setRevealLoading(false));
  }, [current, revealNarrative, revealLoading, archetypeResult, profile, station7.projectStatement]);

  if (current === "station_7_grand_reveal") {
    const archetype = archetypeResult?.primary;
    const secondary = archetypeResult?.secondary;

    const station3 = profile.station3;
    const interestMap = station3?.interests?.slice(0, 5) ?? [];

    return (
      <div className="max-w-2xl mx-auto">
        <p className="text-white/70 text-sm mb-6 leading-relaxed">
          {S7_KIT_DIALOGUE.beforeGrandReveal}
        </p>

        {/* Grand Reveal Card */}
        <div className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 border-2 border-purple-500/30 rounded-xl p-6 mb-6">
          {/* Archetype Card */}
          {archetype && (
            <div className="mb-6 pb-6 border-b border-white/10">
              <h3 className="text-2xl font-bold text-white mb-2">{archetype}</h3>
              {secondary && (
                <p className="text-white/60 text-sm mb-3">
                  with{" "}
                  <span className="text-white/80 font-medium">
                    {secondary}
                  </span>{" "}
                  strengths
                </p>
              )}
              {archetypeResult?.isPolymath && (
                <span className="inline-block px-2 py-0.5 bg-amber-400/20 text-amber-300 text-[10px] font-medium rounded-full mb-2">
                  Polymath
                </span>
              )}
            </div>
          )}

          {/* AI-Personalized Narrative */}
          <div className="mb-6 pb-6 border-b border-white/10">
            {revealLoading ? (
              <div className="flex items-center gap-2 text-white/50 text-sm">
                <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                Kit is putting it all together...
              </div>
            ) : revealNarrative ? (
              <p className="text-white/80 text-sm leading-relaxed italic">
                &ldquo;{revealNarrative}&rdquo;
              </p>
            ) : (
              <p className="text-white/60 text-sm leading-relaxed italic">
                &ldquo;{S7_KIT_DIALOGUE.afterGrandReveal}&rdquo;
              </p>
            )}
          </div>

          {/* Interests Map */}
          {interestMap.length > 0 && (
            <div>
              <p className="text-xs text-white/40 mb-2 uppercase tracking-wider">
                What Drives You
              </p>
              <div className="flex flex-wrap gap-2">
                {interestMap.map((interest) => (
                  <span
                    key={interest}
                    className="px-3 py-1 bg-white/10 border border-white/20 rounded-full text-white/70 text-xs"
                  >
                    {interest}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── Share (Final confirmation) ─────────────────────────────

  if (current === "station_7_share") {
    return (
      <div className="max-w-md mx-auto text-center">
        <p className="text-white/70 text-sm mb-6 leading-relaxed">
          {S7_KIT_DIALOGUE.share}
        </p>

        {/* Summary of what's shared */}
        <div className="bg-white/5 border border-white/10 rounded-lg p-4 mb-6 text-white/60 text-xs space-y-2">
          <div>✓ Your design archetype</div>
          <div>✓ Key strengths & interests</div>
          <div>✓ Your project statement</div>
          <div>✓ Success criteria</div>
        </div>

        {/* Privacy note */}
        <p className="text-white/60 text-sm mb-6 italic">
          Your full responses stay between you and Kit. Your teacher sees only
          what helps them support your learning.
        </p>

        {/* Complete button */}
        <button
          onClick={() => session.completeJourney()}
          className="w-full px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold text-sm transition-all"
        >
          Complete Discovery
        </button>
      </div>
    );
  }

  // Fallback
  return (
    <div className="text-center text-white/50">
      <p>Unknown step: {current}</p>
    </div>
  );
}
