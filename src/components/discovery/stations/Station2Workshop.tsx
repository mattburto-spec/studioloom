"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { UseDiscoverySessionReturn } from "@/hooks/useDiscoverySession";
import { getStation2Content } from "@/lib/discovery/content";
import {
  STATION_2_KIT_DIALOGUE,
  computeScenarioArchetypeSignals,
  computePeopleArchetypeSignals,
} from "@/lib/discovery/content/station-2-workshop";
import type {
  Station2Data,
  ArchetypeScenario,
  DesignArchetype,
  PanicResponseAnalysis,
} from "@/lib/discovery/types";

/**
 * Station 2: The Workshop — Archetype Scenarios
 *
 * Sub-steps:
 * 1. Intro — Kit explains the format
 * 2. Story — Kit tells the "broken chair" story
 * 3. Text prompt — Panic response (friend messages you at 9pm)
 * 4. Scenarios — 6 archetype scenarios, one at a time
 * 5. People grid — "What do people come to you for?" (pick 2-3)
 * 6. Reveal — Pattern summary with emerging archetype signals
 *
 * Must NOT feel like a test. Scenario options are designed
 * so none sounds "best" — all are equally valid approaches.
 *
 * @see docs/specs/discovery-engine-build-plan.md Part 2, Station 2
 */

interface Station2WorkshopProps {
  session: UseDiscoverySessionReturn;
}

export function Station2Workshop({ session }: Station2WorkshopProps) {
  const { machine, profile } = session;
  const { current } = machine;
  const station2 = profile.station2;
  const { scenarios, peopleIcons, kitDialogue } = getStation2Content(
    profile.ageBand,
  );

  const [scenarioIndex, setScenarioIndex] = useState(() => {
    // Resume at first unanswered scenario
    const answered = Object.keys(station2.scenarioChoices).length;
    return Math.min(answered, scenarios.length - 1);
  });

  // AI analysis state for panic response
  const [kitPanicResponse, setKitPanicResponse] = useState<string | null>(
    station2.panicResponseAiAnalysis?.kit_response ?? null,
  );
  const [isAnalyzingPanic, setIsAnalyzingPanic] = useState(false);
  const panicAnalyzedRef = useRef(!!station2.panicResponseAiAnalysis);

  const updateData = useCallback(
    (updates: Partial<Station2Data>) => {
      session.updateStation("station2", { ...station2, ...updates });
    },
    [session, station2],
  );

  // ─── AI: Analyze panic response when entering scenarios ─────
  useEffect(() => {
    if (current !== "station_2_scenarios") return;
    if (panicAnalyzedRef.current) return;
    if (!station2.panicResponse || station2.panicResponse.trim().length < 10) return;

    panicAnalyzedRef.current = true;
    setIsAnalyzingPanic(true);

    fetch("/api/discovery/reflect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "s2_panic",
        studentText: station2.panicResponse,
        context: {
          dominantStyle: profile.dominantStyle ?? "unknown",
          vectorSummary: profile.workingStyle
            ? `${profile.workingStyle.planning}-${profile.workingStyle.decision}`
            : "no data",
        },
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        const result = data.result as PanicResponseAnalysis | { response: string };
        if ("kit_response" in result) {
          setKitPanicResponse(result.kit_response);
          updateData({ panicResponseAiAnalysis: result as PanicResponseAnalysis });
        } else if ("response" in result) {
          setKitPanicResponse(result.response);
        }
      })
      .catch((err) => {
        console.error("[S2] Panic analysis failed:", err);
        setKitPanicResponse("That tells me a lot about how you handle pressure.");
      })
      .finally(() => setIsAnalyzingPanic(false));
  }, [current]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Intro ─────────────────────────────────────────────────
  if (current === "station_2" || current === "station_2_intro") {
    return (
      <div className="text-center">
        <div className="text-5xl mb-4">🔧</div>
        <h2 className="text-2xl font-bold text-white mb-3">The Workshop</h2>
        <p className="text-white/70 text-base max-w-md mx-auto leading-relaxed">
          {kitDialogue.intro}
        </p>
      </div>
    );
  }

  // ─── Kit's Story ────────────────────────────────────────────
  if (current === "station_2_story") {
    return (
      <div className="text-center max-w-lg mx-auto">
        <div className="text-4xl mb-4">🪑</div>
        <p className="text-white/80 text-base leading-relaxed italic">
          &ldquo;{kitDialogue.story}&rdquo;
        </p>
        <p className="text-white/60 text-sm mt-6">
          Kit pauses, then looks at you.
        </p>
      </div>
    );
  }

  // ─── Panic Text Prompt ──────────────────────────────────────
  if (current === "station_2_text_prompt") {
    return (
      <div className="max-w-lg mx-auto">
        <p className="text-white/80 text-base mb-6 leading-relaxed text-center">
          {kitDialogue.text_prompt}
        </p>

        <textarea
          value={station2.panicResponse ?? ""}
          onChange={(e) => updateData({ panicResponse: e.target.value })}
          placeholder="Tell them what to actually do..."
          rows={5}
          className="w-full rounded-xl bg-white/5 border border-white/10 text-white/90 text-base p-4 placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-amber-400/40 resize-none"
        />

        {/* Word count indicator */}
        <div className="flex justify-between items-center mt-2">
          <p className="text-white/60 text-sm">
            Be specific — what's your actual plan for them?
          </p>
          <p
            className={`text-sm ${
              (station2.panicResponse?.trim().length ?? 0) >= 10
                ? "text-amber-400/60"
                : "text-white/40"
            }`}
          >
            {station2.panicResponse?.trim().split(/\s+/).filter(Boolean)
              .length ?? 0}{" "}
            words
          </p>
        </div>
      </div>
    );
  }

  // ─── Scenarios ──────────────────────────────────────────────
  if (current === "station_2_scenarios") {
    const scenario = scenarios[scenarioIndex];
    if (!scenario) return null;

    const answeredCount = Object.keys(station2.scenarioChoices).length;
    const chosenForThis = station2.scenarioChoices[scenario.id];

    const handleScenarioChoice = (
      scenario: ArchetypeScenario,
      optionId: string,
    ) => {
      const newChoices = {
        ...station2.scenarioChoices,
        [scenario.id]: optionId,
      };

      updateData({ scenarioChoices: newChoices });

      // Auto-advance to next scenario after brief pause
      if (scenarioIndex < scenarios.length - 1) {
        setTimeout(() => {
          setScenarioIndex((prev) => prev + 1);
        }, 400);
      }
    };

    return (
      <div>
        {/* Kit's response to panic text */}
        {(kitPanicResponse || isAnalyzingPanic) && (
          <div className="mb-5 p-3 rounded-xl bg-amber-400/5 border border-amber-400/10 max-w-lg mx-auto">
            {isAnalyzingPanic ? (
              <p className="text-white/60 text-sm italic animate-pulse">Kit is thinking about what you said...</p>
            ) : (
              <p className="text-white/80 text-base leading-relaxed italic">
                &ldquo;{kitPanicResponse}&rdquo;
              </p>
            )}
          </div>
        )}

        {/* Header */}
        <p className="text-white/60 text-sm text-center mb-2">
          {kitDialogue.scenarios_intro}
        </p>

        {/* Progress dots */}
        <div className="flex justify-center gap-1.5 mb-6">
          {scenarios.map((s, i) => {
            const isAnswered = !!station2.scenarioChoices[s.id];
            const isCurrent = i === scenarioIndex;
            return (
              <button
                key={s.id}
                onClick={() => setScenarioIndex(i)}
                className={`w-2.5 h-2.5 rounded-full transition-all duration-200 ${
                  isCurrent
                    ? "bg-amber-400 scale-125"
                    : isAnswered
                      ? "bg-amber-400/40"
                      : "bg-white/10"
                }`}
              />
            );
          })}
        </div>

        {/* Scenario prompt */}
        <p className="text-white/90 text-base mb-5 leading-relaxed font-medium text-center max-w-lg mx-auto">
          {scenario.prompt}
        </p>

        {/* Options */}
        <div className="space-y-2.5 max-w-lg mx-auto">
          {scenario.options.map((option) => {
            const isSelected = chosenForThis === option.id;
            return (
              <button
                key={option.id}
                onClick={() => handleScenarioChoice(scenario, option.id)}
                className={`w-full text-left rounded-xl p-3.5 transition-all duration-200 ${
                  isSelected
                    ? "ring-2 ring-amber-400 bg-amber-400/10"
                    : "bg-white/5 hover:bg-white/10 ring-1 ring-white/10 hover:ring-white/30"
                }`}
              >
                <span className="text-base text-white/90 leading-relaxed">
                  {option.text}
                </span>
              </button>
            );
          })}
        </div>

        {/* Counter */}
        <p className="text-white/50 text-sm text-center mt-4">
          {answeredCount} / {scenarios.length}
        </p>
      </div>
    );
  }

  // ─── People Grid ────────────────────────────────────────────
  if (current === "station_2_people_grid") {
    const selectedCount = station2.peopleIcons.length;
    const atLimit = selectedCount >= 3;

    return (
      <div>
        <p className="text-white/80 text-base mb-2 text-center">
          {kitDialogue.people_grid_intro}
        </p>
        <p className="text-white/60 text-sm mb-6 text-center">
          {kitDialogue.people_grid_subtitle} — {selectedCount}/3 selected
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 max-w-xl mx-auto">
          {peopleIcons.map((person) => {
            const isSelected = station2.peopleIcons.includes(person.id);
            return (
              <button
                key={person.id}
                onClick={() => {
                  if (isSelected) {
                    updateData({
                      peopleIcons: station2.peopleIcons.filter(
                        (p) => p !== person.id,
                      ),
                    });
                  } else if (!atLimit) {
                    updateData({
                      peopleIcons: [...station2.peopleIcons, person.id],
                    });
                  }
                }}
                disabled={!isSelected && atLimit}
                className={`rounded-xl p-4 text-center transition-all duration-200 ${
                  isSelected
                    ? "ring-2 ring-amber-400 bg-amber-400/10 scale-105"
                    : atLimit
                      ? "opacity-30 cursor-not-allowed bg-white/5"
                      : "bg-white/5 hover:bg-white/10 ring-1 ring-white/10 hover:ring-white/30"
                }`}
              >
                <div className="text-2xl mb-1">{person.icon}</div>
                <div className="text-sm text-white/80 leading-tight">
                  {person.label}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ─── Reveal ─────────────────────────────────────────────────
  if (current === "station_2_reveal") {
    // Compute archetype signals from scenarios + people + AI analysis
    const scenarioSignals = computeScenarioArchetypeSignals(
      scenarios,
      station2.scenarioChoices,
    );
    const peopleSignals = computePeopleArchetypeSignals(
      station2.peopleIcons,
    );
    const aiSignals = station2.panicResponseAiAnalysis?.archetype_signals ?? {};

    // Combine signals (scenarios weighted 0.25, people 0.20, AI panic analysis 0.15)
    const combined: Record<string, number> = {};
    for (const arch of [
      "Maker",
      "Researcher",
      "Leader",
      "Communicator",
      "Creative",
      "Systems",
    ] as const) {
      combined[arch] =
        (scenarioSignals[arch] ?? 0) +
        (peopleSignals[arch] ?? 0) +
        ((aiSignals as Record<string, number>)[arch] ?? 0);
    }

    // Find top 2
    const sorted = Object.entries(combined).sort(([, a], [, b]) => b - a);
    const primary = sorted[0]?.[0] ?? "Creative";
    const secondary = sorted[1]?.[1]! > 0 ? sorted[1]?.[0] : null;

    // Persist archetype reveal into profile (runs once on mount via effect-like pattern)
    if (!station2.archetypeReveal || station2.archetypeReveal.primary !== (primary as DesignArchetype)) {
      const maxScore = sorted[0]?.[1] ?? 0;
      const secondScore = sorted[1]?.[1] ?? 0;
      const isPolymath = maxScore > 0 && secondScore >= maxScore * 0.8;
      const revealData = {
        primary: primary as DesignArchetype,
        secondary: (secondary ?? null) as DesignArchetype | null,
        isPolymath,
        scores: combined as Record<DesignArchetype, number>,
      };
      updateData({ archetypeReveal: revealData });

      // Also update profile-level composite archetypeScores
      session.updateProfile({
        station2: { ...station2, archetypeReveal: revealData },
        archetypeScores: combined as Record<DesignArchetype, number>,
        archetypeResult: revealData,
      });
    }

    // Archetype emoji map
    const archetypeEmoji: Record<string, string> = {
      Maker: "🔨",
      Researcher: "🔬",
      Leader: "👑",
      Communicator: "🗣️",
      Creative: "✨",
      Systems: "⚙️",
    };

    return (
      <div className="text-center max-w-lg mx-auto">
        <p className="text-white/50 text-xs mb-6">{kitDialogue.reveal}</p>

        {/* Primary archetype badge */}
        <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-amber-400/10 border border-amber-400/20 mb-4">
          <span className="text-xl">{archetypeEmoji[primary]}</span>
          <span className="text-sm font-semibold text-amber-300">
            {primary}
          </span>
        </div>

        {/* Secondary */}
        {secondary && (
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 ml-2 mb-4">
            <span className="text-lg">{archetypeEmoji[secondary]}</span>
            <span className="text-xs font-medium text-white/60">
              {secondary}
            </span>
          </div>
        )}

        {/* Mini bar chart */}
        <div className="space-y-2 mt-6 text-left">
          {sorted.slice(0, 4).map(([arch, score]) => {
            const maxScore = sorted[0]?.[1] ?? 1;
            const pct = maxScore > 0 ? (score / maxScore) * 100 : 0;
            return (
              <div key={arch} className="flex items-center gap-3">
                <span className="text-xs text-white/50 w-28 text-right">
                  {archetypeEmoji[arch]} {arch}
                </span>
                <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-amber-400/50 transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-white/40 text-xs mt-6">
          This is just the start — more data coming from the next stations.
        </p>
      </div>
    );
  }

  return null;
}
