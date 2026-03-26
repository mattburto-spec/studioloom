"use client";

import { useState, useCallback, useEffect } from "react";
import type { UseDiscoverySessionReturn } from "@/hooks/useDiscoverySession";
import { getStation5Content } from "@/lib/discovery/content";
import {
  STATION_5_KIT_DIALOGUE,
  EFFICACY_SLIDER_LABELS,
  EFFICACY_KIT_REACTIONS,
} from "@/lib/discovery/content/station-5-toolkit";
import type { Station5Data, ResourceSort } from "@/lib/discovery/types";

/**
 * Station 5: The Toolkit — Resources & Confidence
 *
 * This station has the most sub-steps (~10 mini-screens).
 * One interaction type per screen. Must NOT feel like a form.
 *
 * Sub-steps:
 * 1. Intro — "Packing your bag"
 * 2. Time — Hours per week slider
 * 3. Resources — 12 cards → Got / Could Get / Nope
 * 4. People — "Who's in your corner?" (select all that apply)
 * 5. Efficacy — 7 sliders, one at a time, with Kit reactions
 * 6. Experience — Past project count + last project outcome
 * 7. Failure — "Your project stops working. You..."
 * 8. Audience — "Who's this for?"
 * 9. Time horizon — "8 weeks from now feels like..."
 * 10. Reveal — Kit reflects on the full picture
 *
 * @see docs/specs/discovery-engine-build-plan.md Part 2, Station 5
 */

interface Station5ToolkitProps {
  session: UseDiscoverySessionReturn;
}

export function Station5Toolkit({ session }: Station5ToolkitProps) {
  const { machine, profile } = session;
  const { current } = machine;
  const station5 = profile.station5;
  const {
    resources: resourceCards,
    people: supportPeople,
    efficacy: efficacyDomains,
    pastProjectOptions,
    lastProjectOptions,
    failureOptions,
    audienceOptions,
    kitDialogue,
  } = getStation5Content();

  const [efficacyIndex, setEfficacyIndex] = useState(() => {
    const answered = Object.keys(station5.selfEfficacy).length;
    return Math.min(answered, efficacyDomains.length - 1);
  });
  const [activeBucket, setActiveBucket] = useState<keyof ResourceSort | null>(null);
  const [revealReflection, setRevealReflection] = useState<string | null>(null);
  const [revealLoading, setRevealLoading] = useState(false);

  const updateData = useCallback(
    (updates: Partial<Station5Data>) => {
      session.updateStation("station5", { ...station5, ...updates });
    },
    [session, station5],
  );

  // ─── AI Reveal fetch ───────────────────────────────────────
  useEffect(() => {
    if (current !== "station_5_reveal") return;
    if (revealReflection || revealLoading) return;

    // Compute data for the prompt
    const efficacyValues = Object.values(station5.selfEfficacy) as number[];
    const avgEff =
      efficacyValues.length > 0
        ? Math.round(efficacyValues.reduce((a: number, b: number) => a + b, 0) / efficacyValues.length)
        : 0;
    const topSkillIds = (Object.entries(station5.selfEfficacy) as [string, number][])
      .sort(([, a], [, b]) => b - a)
      .slice(0, 2)
      .map(([id]) => id);

    setRevealLoading(true);
    fetch("/api/discovery/reflect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "s5_reveal",
        context: {
          resourcesHave: station5.resources.have,
          resourcesCanGet: station5.resources.canGet,
          resourcesDontHave: station5.resources.dontHave,
          people: station5.peopleIcons,
          selfEfficacy: station5.selfEfficacy,
          topSkills: topSkillIds,
          avgEfficacy: avgEff,
          pastProjectCount: station5.pastProjectCount,
          lastProjectOutcome: station5.lastProjectOutcome,
          failureResponse: station5.failureResponse,
          audience: station5.audience,
          timeHorizon: station5.timeHorizon,
          primaryArchetype: profile.archetypeResult?.primary ?? "unknown",
        },
      }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.result?.reflection) {
          setRevealReflection(data.result.reflection);
        }
      })
      .catch(() => {})
      .finally(() => setRevealLoading(false));
  }, [current, revealReflection, revealLoading, station5, profile.archetypeResult]);

  // ─── Intro ─────────────────────────────────────────────────
  if (current === "station_5" || current === "station_5_intro") {
    return (
      <div className="text-center">
        <div className="text-5xl mb-4">🧰</div>
        <h2 className="text-2xl font-bold text-white mb-3">The Toolkit</h2>
        <p className="text-white/70 text-base max-w-md mx-auto leading-relaxed">
          {kitDialogue.intro}
        </p>
      </div>
    );
  }

  // ─── Time ───────────────────────────────────────────────────
  if (current === "station_5_time") {
    const hours = station5.timeHoursPerWeek ?? 5;

    return (
      <div className="max-w-md mx-auto text-center">
        <p className="text-white/70 text-sm mb-6 leading-relaxed">
          {kitDialogue.time_prompt}
        </p>

        <div className="text-4xl font-bold text-emerald-400 mb-2">
          {hours}
        </div>
        <p className="text-white/60 text-sm mb-6">hours per week</p>

        <input
          type="range"
          min={1}
          max={15}
          value={hours}
          onChange={(e) =>
            updateData({ timeHoursPerWeek: parseInt(e.target.value, 10) })
          }
          className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer accent-emerald-400"
        />
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-white/30">1 hr</span>
          <span className="text-[10px] text-white/30">15 hrs</span>
        </div>
      </div>
    );
  }

  // ─── Resources (3-column sort) ──────────────────────────────
  if (current === "station_5_resources") {
    const { have, canGet, dontHave } = station5.resources;
    const allSorted = [...have, ...canGet, ...dontHave];
    const unsorted = resourceCards.filter((r) => !allSorted.includes(r.id));

    const addTo = (cardId: string, bucket: keyof ResourceSort) => {
      const newResources: ResourceSort = {
        have: have.filter((id) => id !== cardId),
        canGet: canGet.filter((id) => id !== cardId),
        dontHave: dontHave.filter((id) => id !== cardId),
      };
      newResources[bucket] = [...newResources[bucket], cardId];
      updateData({ resources: newResources });
    };

    const removeFrom = (cardId: string) => {
      updateData({
        resources: {
          have: have.filter((id) => id !== cardId),
          canGet: canGet.filter((id) => id !== cardId),
          dontHave: dontHave.filter((id) => id !== cardId),
        },
      });
    };

    const buckets = [
      { key: "have" as const, label: kitDialogue.resources_columns.have, items: have, color: "emerald" },
      { key: "canGet" as const, label: kitDialogue.resources_columns.canGet, items: canGet, color: "amber" },
      { key: "dontHave" as const, label: kitDialogue.resources_columns.nope, items: dontHave, color: "red" },
    ];

    return (
      <div className="max-w-xl mx-auto">
        <p className="text-white/80 text-base mb-2 text-center">
          {kitDialogue.resources_intro}
        </p>
        <p className="text-white/60 text-sm mb-6 text-center">
          Select a column, then tap cards to sort them
        </p>

        {/* Bucket headers */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {buckets.map(({ key, label, items }) => (
            <button
              key={key}
              onClick={() => setActiveBucket(activeBucket === key ? null : key)}
              className={`text-center rounded-lg p-2 transition-all text-xs font-medium ${
                activeBucket === key
                  ? "bg-white/15 text-white ring-1 ring-white/30"
                  : "bg-white/5 text-white/50 hover:bg-white/10"
              }`}
            >
              {label}
              <span className="block text-[10px] text-white/30 mt-0.5">
                {items.length}
              </span>
            </button>
          ))}
        </div>

        {/* Sorted items in columns */}
        <div className="grid grid-cols-3 gap-2 mb-4 min-h-[60px]">
          {buckets.map(({ key, items }) => (
            <div key={key} className="space-y-1">
              {items.map((cardId) => {
                const card = resourceCards.find((r) => r.id === cardId);
                if (!card) return null;
                return (
                  <button
                    key={card.id}
                    onClick={() => removeFrom(card.id)}
                    className="w-full text-left text-[10px] text-white/60 bg-white/5 rounded-lg px-2 py-1.5 hover:bg-red-400/10 hover:text-red-300 transition-colors flex items-center gap-1.5"
                    title="Click to unsort"
                  >
                    <span>{card.icon}</span>
                    <span className="truncate">{card.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Unsorted cards */}
        {unsorted.length > 0 && (
          <div className="border-t border-white/10 pt-4">
            <p className="text-white/30 text-[10px] mb-2 text-center">
              {unsorted.length} unsorted
            </p>
            <div className="grid grid-cols-2 gap-2">
              {unsorted.map((card) => (
                <button
                  key={card.id}
                  onClick={() => {
                    if (activeBucket) addTo(card.id, activeBucket);
                  }}
                  className={`text-left rounded-xl p-3 transition-all duration-200 ${
                    activeBucket
                      ? "bg-white/5 hover:bg-white/10 ring-1 ring-white/10 hover:ring-white/30 cursor-pointer"
                      : "bg-white/5 ring-1 ring-white/5 opacity-50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{card.icon}</span>
                    <span className="text-xs text-white/70">{card.label}</span>
                  </div>
                </button>
              ))}
            </div>
            {!activeBucket && (
              <p className="text-emerald-400/40 text-[10px] text-center mt-3">
                ↑ Select a column above first
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  // ─── People ─────────────────────────────────────────────────
  if (current === "station_5_people") {
    return (
      <div>
        <p className="text-white/80 text-base mb-2 text-center">
          {kitDialogue.people_intro}
        </p>
        <p className="text-white/60 text-sm mb-6 text-center">
          {kitDialogue.people_subtitle}
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-md mx-auto">
          {supportPeople.map((person) => {
            const isSelected = station5.peopleIcons.includes(person.id);
            return (
              <button
                key={person.id}
                onClick={() => {
                  if (isSelected) {
                    updateData({
                      peopleIcons: station5.peopleIcons.filter(
                        (p) => p !== person.id,
                      ),
                    });
                  } else {
                    updateData({
                      peopleIcons: [...station5.peopleIcons, person.id],
                    });
                  }
                }}
                className={`rounded-xl p-4 text-center transition-all duration-200 ${
                  isSelected
                    ? "ring-2 ring-emerald-400 bg-emerald-400/10 scale-105"
                    : "bg-white/5 hover:bg-white/10 ring-1 ring-white/10 hover:ring-white/30"
                }`}
              >
                <div className="text-2xl mb-1">{person.icon}</div>
                <div className="text-xs text-white/70 leading-tight">
                  {person.label}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ─── Efficacy Sliders (one at a time) ───────────────────────
  if (current === "station_5_efficacy") {
    const domain = efficacyDomains[efficacyIndex];
    if (!domain) return null;

    const labels = EFFICACY_SLIDER_LABELS[domain.id];
    const reactions = EFFICACY_KIT_REACTIONS[domain.id];
    const value = station5.selfEfficacy[domain.id] ?? 50;
    const answeredCount = Object.keys(station5.selfEfficacy).length;

    // Determine Kit reaction tier
    const reactionTier = value < 33 ? "low" : value < 67 ? "mid" : "high";
    const kitReaction = reactions?.[reactionTier];

    const handleSliderChange = (val: number) => {
      updateData({
        selfEfficacy: { ...station5.selfEfficacy, [domain.id]: val },
      });
    };

    const handleNext = () => {
      if (efficacyIndex < efficacyDomains.length - 1) {
        setEfficacyIndex((prev) => prev + 1);
      }
    };

    return (
      <div className="max-w-md mx-auto">
        {/* Progress */}
        <div className="flex justify-center gap-1.5 mb-6">
          {efficacyDomains.map((d, i) => {
            const isAnswered = station5.selfEfficacy[d.id] !== undefined;
            const isCurrent = i === efficacyIndex;
            return (
              <button
                key={d.id}
                onClick={() => setEfficacyIndex(i)}
                className={`w-2.5 h-2.5 rounded-full transition-all duration-200 ${
                  isCurrent
                    ? "bg-emerald-400 scale-125"
                    : isAnswered
                      ? "bg-emerald-400/40"
                      : "bg-white/10"
                }`}
              />
            );
          })}
        </div>

        <p className="text-white/50 text-xs text-center mb-1">
          {kitDialogue.efficacy_intro}
        </p>

        {/* Domain label */}
        <h3 className="text-lg font-bold text-white text-center mb-1">
          {domain.label}
        </h3>
        <p className="text-white/60 text-sm text-center mb-6">
          {domain.description}
        </p>

        {/* Slider */}
        <input
          type="range"
          min={0}
          max={100}
          value={value}
          onChange={(e) => handleSliderChange(parseInt(e.target.value, 10))}
          className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer accent-emerald-400"
        />
        {labels && (
          <div className="flex justify-between mt-1 mb-4">
            <span className="text-[10px] text-white/30 max-w-[45%]">
              {labels.left}
            </span>
            <span className="text-[10px] text-white/30 max-w-[45%] text-right">
              {labels.right}
            </span>
          </div>
        )}

        {/* Kit reaction */}
        {kitReaction && station5.selfEfficacy[domain.id] !== undefined && (
          <p className="text-emerald-300/50 text-xs text-center italic mt-2">
            {kitReaction}
          </p>
        )}

        {/* Next domain button */}
        {efficacyIndex < efficacyDomains.length - 1 && (
          <button
            onClick={handleNext}
            className="block mx-auto mt-6 text-xs text-emerald-400/60 hover:text-emerald-400/80 transition-colors"
          >
            Next skill →
          </button>
        )}

        <p className="text-white/30 text-xs text-center mt-4">
          {answeredCount} / {efficacyDomains.length}
        </p>
      </div>
    );
  }

  // ─── Experience ─────────────────────────────────────────────
  if (current === "station_5_experience") {
    return (
      <div className="max-w-lg mx-auto">
        <p className="text-white/70 text-sm mb-6 text-center">
          {kitDialogue.experience_intro}
        </p>

        {/* Past project count */}
        <p className="text-white/50 text-xs mb-3">
          {kitDialogue.experience_count}
        </p>
        <div className="grid grid-cols-2 gap-2 mb-8">
          {pastProjectOptions.map((opt) => {
            const isSelected = station5.pastProjectCount === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => updateData({ pastProjectCount: opt.id })}
                className={`text-left rounded-xl p-3 transition-all duration-200 ${
                  isSelected
                    ? "ring-2 ring-emerald-400 bg-emerald-400/10"
                    : "bg-white/5 hover:bg-white/10 ring-1 ring-white/10 hover:ring-white/30"
                }`}
              >
                <span className="text-lg mr-2">{opt.icon}</span>
                <span className="text-xs text-white/80">{opt.label}</span>
              </button>
            );
          })}
        </div>

        {/* Last project outcome */}
        {station5.pastProjectCount && station5.pastProjectCount !== "first" && (
          <>
            <p className="text-white/50 text-xs mb-3">
              {kitDialogue.experience_outcome}
            </p>
            <div className="space-y-2">
              {lastProjectOptions.map((opt) => {
                const isSelected = station5.lastProjectOutcome === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() =>
                      updateData({ lastProjectOutcome: opt.id })
                    }
                    className={`w-full text-left rounded-xl p-3 transition-all duration-200 ${
                      isSelected
                        ? "ring-2 ring-emerald-400 bg-emerald-400/10"
                        : "bg-white/5 hover:bg-white/10 ring-1 ring-white/10 hover:ring-white/30"
                    }`}
                  >
                    <span className="text-lg mr-2">{opt.icon}</span>
                    <span className="text-xs text-white/80">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    );
  }

  // ─── Failure Response ───────────────────────────────────────
  if (current === "station_5_failure") {
    return (
      <div className="max-w-lg mx-auto">
        <p className="text-white/80 text-base mb-2 text-center">
          {kitDialogue.failure_intro}
        </p>
        <p className="text-white/50 text-xs mb-6 text-center">
          {kitDialogue.failure_prompt}
        </p>

        <div className="space-y-2.5">
          {failureOptions.map((opt) => {
            const isSelected = station5.failureResponse === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => updateData({ failureResponse: opt.id })}
                className={`w-full text-left rounded-xl p-4 transition-all duration-200 ${
                  isSelected
                    ? "ring-2 ring-emerald-400 bg-emerald-400/10"
                    : "bg-white/5 hover:bg-white/10 ring-1 ring-white/10 hover:ring-white/30"
                }`}
              >
                <span className="text-lg mr-2">{opt.icon}</span>
                <span className="text-sm text-white/80">{opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ─── Audience ───────────────────────────────────────────────
  if (current === "station_5_audience") {
    return (
      <div className="max-w-lg mx-auto">
        <p className="text-white/70 text-sm mb-6 text-center">
          {kitDialogue.audience_intro}
        </p>

        <div className="space-y-2.5">
          {audienceOptions.map((opt) => {
            const isSelected = station5.audience === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => updateData({ audience: opt.id })}
                className={`w-full text-left rounded-xl p-4 transition-all duration-200 ${
                  isSelected
                    ? "ring-2 ring-emerald-400 bg-emerald-400/10"
                    : "bg-white/5 hover:bg-white/10 ring-1 ring-white/10 hover:ring-white/30"
                }`}
              >
                <span className="text-lg mr-2">{opt.icon}</span>
                <span className="text-sm text-white/80">{opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ─── Time Horizon ───────────────────────────────────────────
  if (current === "station_5_time_horizon") {
    // timeHorizon is stored as string "0"-"100" representing the slider position
    const numValue = station5.timeHorizon !== null
      ? parseInt(station5.timeHorizon, 10)
      : 50;

    // Determine Kit reaction tier
    const reactionTier = numValue < 33 ? "low" : numValue < 67 ? "mid" : "high";
    const kitReaction =
      reactionTier === "low"
        ? kitDialogue.time_horizon_low
        : reactionTier === "mid"
          ? kitDialogue.time_horizon_mid
          : kitDialogue.time_horizon_high;

    return (
      <div className="max-w-md mx-auto text-center">
        <p className="text-white/70 text-sm mb-2">
          {kitDialogue.time_horizon_intro}
        </p>
        <p className="text-white/50 text-xs mb-6">
          {kitDialogue.time_horizon_prompt}
        </p>

        <input
          type="range"
          min={0}
          max={100}
          value={numValue}
          onChange={(e) =>
            updateData({ timeHorizon: e.target.value })
          }
          className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer accent-emerald-400"
        />
        <div className="flex justify-between mt-1 mb-4">
          <span className="text-[10px] text-white/30">
            {kitDialogue.time_horizon_left}
          </span>
          <span className="text-[10px] text-white/30">
            {kitDialogue.time_horizon_right}
          </span>
        </div>

        {station5.timeHorizon !== null && (
          <p className="text-emerald-300/50 text-xs italic mt-2">
            {kitReaction}
          </p>
        )}
      </div>
    );
  }

  // ─── Reveal ─────────────────────────────────────────────────
  if (current === "station_5_reveal") {
    const haveCount = station5.resources.have.length;
    const canGetCount = station5.resources.canGet.length;
    const nopeCount = station5.resources.dontHave.length;
    const peopleCount = station5.peopleIcons.length;

    // Compute average efficacy
    const efficacyValues = Object.values(station5.selfEfficacy) as number[];
    const avgEfficacy =
      efficacyValues.length > 0
        ? Math.round(
            efficacyValues.reduce((a: number, b: number) => a + b, 0) /
              efficacyValues.length,
          )
        : 0;

    // Find strongest skills
    const topSkills = (Object.entries(station5.selfEfficacy) as [string, number][])
      .sort(([, a], [, b]) => b - a)
      .slice(0, 2)
      .map(([id]) => efficacyDomains.find((d) => d.id === id))
      .filter(Boolean);

    return (
      <div className="text-center max-w-lg mx-auto">
        <p className="text-white/50 text-xs mb-6">{kitDialogue.reveal}</p>

        {/* Resource summary */}
        <div className="flex justify-center gap-4 mb-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-emerald-400">
              {haveCount}
            </div>
            <div className="text-[10px] text-white/40">have</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-amber-400">
              {canGetCount}
            </div>
            <div className="text-[10px] text-white/40">could get</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-400">
              {nopeCount}
            </div>
            <div className="text-[10px] text-white/40">nope</div>
          </div>
        </div>

        {/* People count */}
        <p className="text-white/50 text-xs mb-4">
          {peopleCount} {peopleCount === 1 ? "person" : "people"} in your
          corner
        </p>

        {/* Strongest skills */}
        {topSkills.length > 0 && (
          <div className="mb-4">
            <p className="text-white/40 text-[10px] mb-2">Strongest skills</p>
            <div className="flex justify-center gap-2">
              {topSkills.map(
                (domain) =>
                  domain && (
                    <span
                      key={domain.id}
                      className="inline-flex items-center px-3 py-1.5 rounded-full bg-emerald-400/10 border border-emerald-400/20 text-xs text-emerald-300"
                    >
                      {domain.label}
                    </span>
                  ),
              )}
            </div>
          </div>
        )}

        {/* Avg confidence bar */}
        <div className="mt-4 px-8">
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-white/40 w-20 text-right">
              Confidence
            </span>
            <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-400/50 transition-all duration-500"
                style={{ width: `${avgEfficacy}%` }}
              />
            </div>
            <span className="text-xs text-emerald-400/60 w-8">
              {avgEfficacy}
            </span>
          </div>
        </div>

        {/* Kit's AI reflection on the full toolkit picture */}
        <div className="mt-6 p-4 rounded-xl bg-emerald-400/5 border border-emerald-400/20">
          {revealLoading ? (
            <p className="text-emerald-300/50 text-xs italic">
              Kit is sizing up your toolkit...
            </p>
          ) : revealReflection ? (
            <p className="text-emerald-300 text-sm leading-relaxed italic">
              &ldquo;{revealReflection}&rdquo;
            </p>
          ) : (
            <p className="text-white/60 text-sm italic">
              Full picture captured. Two more stations to go.
            </p>
          )}
        </div>
      </div>
    );
  }

  return null;
}
