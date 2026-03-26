"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { UseDiscoverySessionReturn } from "@/hooks/useDiscoverySession";
import { getStation4Content } from "@/lib/discovery/content";
import {
  STATION_4_KIT_DIALOGUE,
  analyzeClickPattern,
  getTextPrompt,
} from "@/lib/discovery/content/station-4-window";
import type { Station4Data, ProblemAnalysis } from "@/lib/discovery/types";

/**
 * Station 4: The Window — Community Scene Hotspots
 *
 * Sub-steps:
 * 1. Intro — Kit explains
 * 2. Story — Kit's crossing story
 * 3. Scene — Tap 3+ hotspots on a community scene
 * 4. Zoom — Pick the ONE that bothers you most
 * 5. Sliders — Scale, urgency, proximity
 * 6. Text prompt — "What shouldn't be this hard?"
 * 7. Reveal — Kit reflects on what you notice
 *
 * v1: Hotspots rendered as text cards in a grid.
 * v2 (future): Actual bird's-eye scene image with positioned hotspots.
 *
 * @see docs/specs/discovery-engine-build-plan.md Part 2, Station 4
 */

interface Station4WindowProps {
  session: UseDiscoverySessionReturn;
}

export function Station4Window({ session }: Station4WindowProps) {
  const { machine, profile } = session;
  const { current } = machine;
  const station4 = profile.station4;
  const { hotspots, kitDialogue } = getStation4Content();

  const updateData = useCallback(
    (updates: Partial<Station4Data>) => {
      session.updateStation("station4", { ...station4, ...updates });
    },
    [session, station4],
  );

  // AI analysis state for problem text
  const [kitProblemResponse, setKitProblemResponse] = useState<string | null>(
    station4.problemAiAnalysis?.kit_response ?? null,
  );
  const [isAnalyzingProblem, setIsAnalyzingProblem] = useState(false);
  const problemAnalyzedRef = useRef(!!station4.problemAiAnalysis);

  // ─── AI: Analyze problem text when entering reveal ──────────
  useEffect(() => {
    if (current !== "station_4_reveal") return;
    if (problemAnalyzedRef.current) return;
    if (!station4.problemText || station4.problemText.trim().length < 10) return;

    problemAnalyzedRef.current = true;
    setIsAnalyzingProblem(true);

    fetch("/api/discovery/reflect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "s4_problem",
        studentText: station4.problemText,
        context: {
          clickedHotspots: station4.sceneClicks,
          irritationSummary: profile.station3?.irritationFreeText ?? "none",
          currentArchetype: profile.archetypeResult?.primary ?? "unknown",
        },
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        const result = data.result as ProblemAnalysis | { response: string };
        if ("kit_response" in result) {
          setKitProblemResponse(result.kit_response);
          updateData({ problemAiAnalysis: result as ProblemAnalysis });
        } else if ("response" in result) {
          setKitProblemResponse(result.response);
        }
      })
      .catch((err) => {
        console.error("[S4] Problem analysis failed:", err);
        setKitProblemResponse(
          "There's something real in what you wrote. Hang onto that — it matters more than you think.",
        );
      })
      .finally(() => setIsAnalyzingProblem(false));
  }, [current]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Intro ─────────────────────────────────────────────────
  if (current === "station_4" || current === "station_4_intro") {
    return (
      <div className="text-center">
        <div className="text-5xl mb-4">🪟</div>
        <h2 className="text-2xl font-bold text-white mb-3">The Window</h2>
        <p className="text-white/70 text-base max-w-md mx-auto leading-relaxed">
          {kitDialogue.intro}
        </p>
      </div>
    );
  }

  // ─── Kit's Story ────────────────────────────────────────────
  if (current === "station_4_story") {
    return (
      <div className="text-center max-w-lg mx-auto">
        <div className="text-4xl mb-4">🚶</div>
        <p className="text-white/80 text-base leading-relaxed italic">
          &ldquo;{kitDialogue.story}&rdquo;
        </p>
      </div>
    );
  }

  // ─── Scene Hotspots ─────────────────────────────────────────
  if (current === "station_4_scene") {
    const clickCount = station4.sceneClicks.length;

    return (
      <div>
        <p className="text-white/80 text-base mb-2 text-center">
          {kitDialogue.scene_prompt}
        </p>
        <p className="text-white/60 text-sm mb-6 text-center">
          {clickCount} selected — tap at least 3
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-w-xl mx-auto">
          {hotspots.map((hotspot) => {
            const isSelected = station4.sceneClicks.includes(hotspot.id);
            return (
              <button
                key={hotspot.id}
                onClick={() => {
                  if (isSelected) {
                    updateData({
                      sceneClicks: station4.sceneClicks.filter(
                        (id) => id !== hotspot.id,
                      ),
                    });
                  } else {
                    updateData({
                      sceneClicks: [...station4.sceneClicks, hotspot.id],
                    });
                  }
                }}
                className={`text-left rounded-xl p-3 transition-all duration-200 ${
                  isSelected
                    ? "ring-2 ring-blue-400 bg-blue-400/10"
                    : "bg-white/5 hover:bg-white/10 ring-1 ring-white/10 hover:ring-white/30"
                }`}
              >
                <div className="flex items-start gap-2">
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded ${
                      hotspot.category === "people"
                        ? "bg-blue-400/20 text-blue-300"
                        : "bg-amber-400/20 text-amber-300"
                    }`}
                  >
                    {hotspot.category === "people" ? "👤" : "⚙️"}
                  </span>
                  <div>
                    <div className="text-xs font-medium text-white/80">
                      {hotspot.label}
                    </div>
                    <p className="text-[10px] text-white/40 leading-snug mt-0.5">
                      {hotspot.description}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ─── Zoom Choice ────────────────────────────────────────────
  if (current === "station_4_zoom") {
    const clicked = hotspots.filter((h) =>
      station4.sceneClicks.includes(h.id),
    );

    return (
      <div className="max-w-lg mx-auto">
        <p className="text-white/70 text-sm mb-6 text-center">
          {kitDialogue.zoom_prompt}
        </p>

        <div className="space-y-2.5">
          {clicked.map((hotspot) => {
            const isSelected = station4.zoomChoice === hotspot.id;
            return (
              <button
                key={hotspot.id}
                onClick={() => updateData({ zoomChoice: hotspot.id })}
                className={`w-full text-left rounded-xl p-4 transition-all duration-200 ${
                  isSelected
                    ? "ring-2 ring-blue-400 bg-blue-400/10"
                    : "bg-white/5 hover:bg-white/10 ring-1 ring-white/10 hover:ring-white/30"
                }`}
              >
                <div className="text-sm text-white/80 font-medium">
                  {hotspot.label}
                </div>
                <p className="text-xs text-white/40 mt-1">
                  {hotspot.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ─── Sliders ────────────────────────────────────────────────
  if (current === "station_4_sliders") {
    const sliderConfigs = [
      {
        key: "scale" as const,
        ...kitDialogue.slider_scale,
      },
      {
        key: "urgency" as const,
        ...kitDialogue.slider_urgency,
      },
      {
        key: "proximity" as const,
        ...kitDialogue.slider_proximity,
      },
    ];

    return (
      <div className="max-w-lg mx-auto">
        <p className="text-white/70 text-sm mb-6 text-center">
          {kitDialogue.sliders_intro}
        </p>

        <div className="space-y-8">
          {sliderConfigs.map(({ key, label, left, right }) => (
            <div key={key}>
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-medium text-white/60">
                  {label}
                </span>
                <span className="text-xs text-blue-400/60">
                  {station4.sliders[key]}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={station4.sliders[key]}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  updateData({
                    sliders: { ...station4.sliders, [key]: val },
                  });
                }}
                className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer accent-blue-400"
              />
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-white/30">{left}</span>
                <span className="text-[10px] text-white/30">{right}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ─── Text Prompt ────────────────────────────────────────────
  if (current === "station_4_text_prompt") {
    const pattern = analyzeClickPattern(station4.sceneClicks);
    const prompt = getTextPrompt(pattern, station4.sceneClicks);

    return (
      <div className="max-w-lg mx-auto">
        <p className="text-white/50 text-xs mb-2 text-center">
          {kitDialogue.text_intro}
        </p>
        <p className="text-white/70 text-sm mb-6 leading-relaxed text-center">
          {prompt}
        </p>

        <textarea
          value={station4.problemText ?? ""}
          onChange={(e) => updateData({ problemText: e.target.value })}
          placeholder="What shouldn't be this hard..."
          rows={5}
          className="w-full rounded-xl bg-white/5 border border-white/10 text-white/90 text-sm p-4 placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-blue-400/40 resize-none"
        />

        <div className="flex justify-between items-center mt-2">
          <p className="text-white/30 text-xs">
            Put it in your own words.
          </p>
          <p
            className={`text-xs ${
              (station4.problemText?.trim().length ?? 0) >= 10
                ? "text-blue-400/60"
                : "text-white/20"
            }`}
          >
            {station4.problemText?.trim().split(/\s+/).filter(Boolean)
              .length ?? 0}{" "}
            words
          </p>
        </div>
      </div>
    );
  }

  // ─── Reveal ─────────────────────────────────────────────────
  if (current === "station_4_reveal") {
    const pattern = analyzeClickPattern(station4.sceneClicks);
    const zoomLabel = hotspots.find(
      (h) => h.id === station4.zoomChoice,
    )?.label;

    return (
      <div className="text-center max-w-lg mx-auto">
        <p className="text-white/50 text-xs mb-6">{kitDialogue.reveal}</p>

        {/* Pattern badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-400/10 border border-blue-400/20 mb-4">
          <span className="text-sm">
            {pattern === "people"
              ? "👤"
              : pattern === "systems"
                ? "⚙️"
                : "🔀"}
          </span>
          <span className="text-xs font-medium text-blue-300 capitalize">
            {pattern === "people"
              ? "People-focused"
              : pattern === "systems"
                ? "Systems-focused"
                : "Both people & systems"}
          </span>
        </div>

        {/* Zoom focus */}
        {zoomLabel && (
          <p className="text-white/60 text-xs mt-4">
            What bothered you most: <strong className="text-white/80">{zoomLabel}</strong>
          </p>
        )}

        {/* Kit's AI response to problem text */}
        {(kitProblemResponse || isAnalyzingProblem) && (
          <div className="mt-5 p-4 rounded-xl bg-blue-400/5 border border-blue-400/10 text-left">
            {isAnalyzingProblem ? (
              <p className="text-white/60 text-sm italic animate-pulse text-center">
                Kit is reading what you wrote...
              </p>
            ) : (
              <p className="text-white/80 text-base leading-relaxed italic">
                &ldquo;{kitProblemResponse}&rdquo;
              </p>
            )}
          </div>
        )}

        {/* Problem text excerpt */}
        {station4.problemText && (
          <div className="mt-4 p-3 rounded-xl bg-white/5 border border-white/10">
            <p className="text-white/40 text-[10px] mb-1">
              In your words
            </p>
            <p className="text-white/60 text-xs italic leading-relaxed">
              &ldquo;
              {station4.problemText.length > 120
                ? station4.problemText.slice(0, 120) + "..."
                : station4.problemText}
              &rdquo;
            </p>
          </div>
        )}

        {/* Problem type badge from AI */}
        {station4.problemAiAnalysis?.problem_domain && (
          <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
            <span className="text-[10px] text-white/40">Problem type:</span>
            <span className="text-xs font-medium text-blue-300 capitalize">
              {station4.problemAiAnalysis.problem_domain.replace("_", " ")}
            </span>
          </div>
        )}
      </div>
    );
  }

  return null;
}
