"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import type { UseDiscoverySessionReturn } from "@/hooks/useDiscoverySession";
import {
  FEAR_CARDS,
  getTemplateDoors,
  S6_KIT_DIALOGUE,
  S6_GENERATING_MESSAGES,
} from "@/lib/discovery/content/station-6-crossroads";
import type { Station6Data, TemplateDoor, DoorExploration } from "@/lib/discovery/types";
import { DiscoveryImage } from "../DiscoveryImage";
import { FEAR_CARD_IMAGES, checkImageExists } from "@/lib/discovery/assets";

/**
 * Station 6: The Crossroads — Where students choose a project direction
 *
 * Flow: intro → generating doors → explore 3 doors → optional custom door →
 * fear card selection → door choice
 *
 * This is a high-stakes moment. Kit is mentor-like here. The fear card responses
 * are the most emotionally important dialogue in the entire Discovery.
 *
 * Sub-steps:
 * 1. Intro — Kit's intro about doors & choice
 * 2. Generating — Loading state while AI generates 3 custom doors (or fallback to templates)
 * 3. Explore 1, 2, 3 — One door per screen with excitement slider + optional notes
 * 4. Custom — Optional student-proposed alternative door
 * 5. Fear — Fear card selection (1-3 cards) with Kit responses
 * 6. Choose — Final door selection
 *
 * @see docs/specs/discovery-engine-build-plan.md Part 2, Station 6
 */

interface Station6CrossroadsProps {
  session: UseDiscoverySessionReturn;
}

export function Station6Crossroads({ session }: Station6CrossroadsProps) {
  const { machine, profile } = session;
  const { current } = machine;
  const station6 = profile.station6;

  const [generatingIndex, setGeneratingIndex] = useState(0);
  const [isLoadingDoors, setIsLoadingDoors] = useState(false);
  const [generationTimedOut, setGenerationTimedOut] = useState(false);
  const [selectedFears, setSelectedFears] = useState<Set<string>>(
    new Set(station6.fearCards),
  );
  const [fearShowTimer, setFearShowTimer] = useState<number | null>(null);
  const [selectedFearId, setSelectedFearId] = useState<string | null>(null);
  const [fearCardImages, setFearCardImages] = useState<Record<string, boolean>>({});
  const [fearAiResponses, setFearAiResponses] = useState<Record<string, string>>({});
  const [fearLoading, setFearLoading] = useState<string | null>(null);

  const updateData = useCallback(
    (updates: Partial<Station6Data>) => {
      session.updateStation("station6", { ...station6, ...updates });
    },
    [session, station6],
  );

  // ─── Generate doors (with 20s timeout + manual retry) ──────
  // Use refs for values needed in the fetch so the useEffect doesn't
  // depend on profile/session/updateData (which change every render
  // and would abort the inflight request via cleanup).
  const profileRef = useRef(profile);
  profileRef.current = profile;
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const updateDataRef = useRef(updateData);
  updateDataRef.current = updateData;

  const generateDoorsRef = useRef(false);
  const doorsAbortRef = useRef<AbortController | null>(null);

  const useFallbackDoors = useCallback(() => {
    const fallback = getTemplateDoors(
      profile.archetypeResult?.primary ?? "Maker",
      profile.mode,
    );
    updateData({ doors: fallback });
    setIsLoadingDoors(false);
    setGenerationTimedOut(false);
    setTimeout(() => session.goToStep("station_6_explore_1"), 800);
  }, [profile, session, updateData]);

  // Single-fire effect: generate doors when entering station_6_generating
  useEffect(() => {
    if (current !== "station_6_generating") return;
    if (station6.doors.length > 0) return; // Already have doors
    if (generateDoorsRef.current) return; // Already in-flight

    generateDoorsRef.current = true;
    setIsLoadingDoors(true);
    setGenerationTimedOut(false);

    const p = profileRef.current;
    const primaryArchetype = p.archetypeResult?.primary ?? "Maker";
    const secondaryArchetype = p.archetypeResult?.secondary;

    // 20-second soft timeout — show retry/fallback buttons
    const timeoutId = setTimeout(() => {
      if (generateDoorsRef.current) setGenerationTimedOut(true);
    }, 20_000);

    // 35-second hard timeout — auto-fallback to template doors
    const hardTimeoutId = setTimeout(() => {
      if (generateDoorsRef.current) {
        console.warn("[Station6] Hard timeout — auto-falling back to template doors");
        const fallback = getTemplateDoors(primaryArchetype, p.mode);
        updateDataRef.current({ doors: fallback });
        setIsLoadingDoors(false);
        setGenerationTimedOut(false);
        generateDoorsRef.current = false;
        setTimeout(() => sessionRef.current.goToStep("station_6_explore_1"), 800);
      }
    }, 35_000);

    const controller = new AbortController();
    doorsAbortRef.current = controller;

    fetch("/api/discovery/reflect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        type: "s6_doors",
        context: {
          primaryArchetype,
          secondaryArchetype,
          interests: p.station3.interests,
          irritationSummary: p.station3.irritationAiAnalysis?.summary_tag,
          problemText: p.station4.problemText,
          resources: p.station5.resources,
          mode: p.mode,
        },
      }),
    })
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error(`API ${res.status}`);
      })
      .then((data) => {
        if (!generateDoorsRef.current) return; // Stale
        // API returns { result: { doors: [...] }, usage: {...} }
        // If AI output didn't parse as { doors: [...] }, result will be { response: "..." }
        const doors = data.result?.doors ?? data.doors ?? [];
        if (!Array.isArray(doors) || doors.length === 0) {
          // AI returned something unexpected — fall back to template doors
          console.warn("[Station6] AI doors empty or invalid, using templates. data.result:", JSON.stringify(data.result).slice(0, 200));
          const fallback = getTemplateDoors(primaryArchetype, p.mode);
          updateDataRef.current({ doors: fallback });
        } else {
          updateDataRef.current({ doors });
        }
        setIsLoadingDoors(false);
        clearTimeout(timeoutId);
        clearTimeout(hardTimeoutId);
        generateDoorsRef.current = false;
        setTimeout(() => sessionRef.current.goToStep("station_6_explore_1"), 1500);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        console.error("[Station6] Door generation failed:", err);
        const fallback = getTemplateDoors(primaryArchetype, p.mode);
        updateDataRef.current({ doors: fallback });
        setIsLoadingDoors(false);
        clearTimeout(timeoutId);
        clearTimeout(hardTimeoutId);
        generateDoorsRef.current = false;
        setTimeout(() => sessionRef.current.goToStep("station_6_explore_1"), 1500);
      });

    // Cleanup only on unmount — do NOT abort on dependency changes
    return () => {
      clearTimeout(timeoutId);
      clearTimeout(hardTimeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  // Preload fear card images
  useEffect(() => {
    if (current !== "station_6_fear") return;
    FEAR_CARDS.forEach((card) => {
      const imagePath = FEAR_CARD_IMAGES[card.id];
      if (imagePath) {
        checkImageExists(imagePath).then((exists) => {
          setFearCardImages((prev) => ({ ...prev, [card.id]: exists }));
        });
      }
    });
  }, [current]);

  // Animate generating messages
  useEffect(() => {
    if (!isLoadingDoors) return;
    const id = setInterval(() => {
      setGeneratingIndex((prev) => (prev + 1) % S6_GENERATING_MESSAGES.length);
    }, 2000);
    return () => clearInterval(id);
  }, [isLoadingDoors]);

  // ─── Intro ──────────────────────────────────────────────────
  if (current === "station_6" || current === "station_6_intro") {
    return (
      <div className="text-center">
        <div className="text-5xl mb-4">🚪</div>
        <h2 className="text-2xl font-bold text-white mb-3">The Crossroads</h2>
        <p className="text-white/70 text-base max-w-md mx-auto leading-relaxed">
          {S6_KIT_DIALOGUE.intro}
        </p>
      </div>
    );
  }

  // ─── Generating ─────────────────────────────────────────────
  if (current === "station_6_generating") {
    return (
      <div className="text-center">
        <div className="text-4xl mb-6">✨</div>
        <div className="flex justify-center gap-1 mb-6">
          <div className="w-2 h-2 bg-white/40 rounded-full animate-pulse" />
          <div
            className="w-2 h-2 bg-white/40 rounded-full animate-pulse"
            style={{ animationDelay: "0.2s" }}
          />
          <div
            className="w-2 h-2 bg-white/40 rounded-full animate-pulse"
            style={{ animationDelay: "0.4s" }}
          />
        </div>
        <p className="text-white/70 text-sm">
          {S6_GENERATING_MESSAGES[generatingIndex]}
        </p>
        {isLoadingDoors && !generationTimedOut && (
          <p className="text-white/30 text-xs mt-3">Generating your doors...</p>
        )}
        {generationTimedOut && (
          <div className="mt-6 space-y-3">
            <p className="text-amber-400/80 text-xs">
              Taking longer than expected...
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => {
                  generateDoorsRef.current = false;
                  updateData({ doors: [] });
                  session.goToStep("station_6_generating");
                }}
                className="px-4 py-2 bg-purple-500/80 hover:bg-purple-500 text-white rounded-full text-xs font-medium transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={useFallbackDoors}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white/70 rounded-full text-xs font-medium transition-colors"
              >
                Use Suggested Doors
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── Door Exploration (1, 2, 3) ─────────────────────────────
  const exploreMatch = current.match(/station_6_explore_(\d)/);
  if (exploreMatch) {
    const doorIndex = parseInt(exploreMatch[1], 10) - 1;
    const door = station6.doors[doorIndex];

    if (!door) {
      return (
        <div className="text-center max-w-md mx-auto">
          <p className="text-white/70 text-base mb-4">
            Hmm, something went wrong loading this door. Let me take you back.
          </p>
          <button
            onClick={() => {
              // Reset guards so the generate effect can fire again
              generateDoorsRef.current = false;
              updateData({ doors: [] });
              session.goToStep("station_6_generating");
            }}
            className="px-4 py-2 bg-purple-500/80 hover:bg-purple-500 text-white rounded-full text-sm font-medium transition-colors"
          >
            Regenerate Doors
          </button>
        </div>
      );
    }

    const exploration = station6.doorExplorations[doorIndex] ?? {
      excitement: 50,
      notes: null,
    };

    const handleExcitementChange = (value: number) => {
      updateData({
        doorExplorations: {
          ...station6.doorExplorations,
          [doorIndex]: { ...exploration, excitement: value },
        },
      });
    };

    const handleNotesChange = (notes: string) => {
      updateData({
        doorExplorations: {
          ...station6.doorExplorations,
          [doorIndex]: { ...exploration, notes: notes.trim() || null },
        },
      });
    };

    // Determine color based on door type
    const colorMap: Record<typeof door.type, string> = {
      sweet_spot: "border-emerald-400/30 bg-emerald-400/5",
      stretch: "border-amber-400/30 bg-amber-400/5",
      surprise: "border-purple-400/30 bg-purple-400/5",
    };

    const typeColor = colorMap[door.type];

    return (
      <div className="max-w-lg mx-auto space-y-6">
        {/* Door Card */}
        <div className={`rounded-xl border p-6 ${typeColor}`}>
          <div className="flex items-start justify-between mb-3">
            <h3 className="text-lg font-bold text-white">{door.title}</h3>
            <span className="text-xs px-2 py-1 bg-white/10 rounded-full text-white/70 capitalize">
              {door.type.replace("_", " ")}
            </span>
          </div>
          <p className="text-white/80 text-sm mb-4 leading-relaxed">
            {door.description}
          </p>
          <div className="space-y-2 text-xs text-white/60 border-t border-white/10 pt-3">
            <p>
              <span className="text-white/40">First step:</span> {door.firstStep}
            </p>
            <p>
              <span className="text-white/40">Time:</span> {door.timeEstimate}
            </p>
          </div>
        </div>

        {/* Excitement Slider */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-white/70 text-sm">How excited are you?</label>
            <span className="text-white font-bold text-lg">
              {exploration.excitement}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={exploration.excitement}
            onChange={(e) => handleExcitementChange(parseInt(e.target.value, 10))}
            className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer accent-purple-400"
          />
          <div className="flex justify-between text-white/30 text-xs mt-1">
            <span>Not really</span>
            <span>Very much</span>
          </div>
        </div>

        {/* Optional Notes */}
        <div>
          <label className="text-white/70 text-sm block mb-2">
            Any thoughts about this direction? (optional)
          </label>
          <textarea
            value={exploration.notes ?? ""}
            onChange={(e) => handleNotesChange(e.target.value)}
            placeholder="What draws you to this... or what concerns you?"
            rows={3}
            className="w-full rounded-lg bg-white/5 border border-white/10 text-white/90 text-sm p-3 placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-purple-400/40 resize-none"
          />
        </div>
      </div>
    );
  }

  // ─── Custom Door ────────────────────────────────────────────
  if (current === "station_6_custom") {
    return (
      <div className="max-w-lg mx-auto space-y-4">
        <p className="text-white/70 text-sm text-center leading-relaxed">
          {S6_KIT_DIALOGUE.customDoorPrompt}
        </p>
        <textarea
          value={station6.customDoor ?? ""}
          onChange={(e) => updateData({ customDoor: e.target.value.trim() || null })}
          placeholder="Describe the project direction you're thinking about..."
          rows={5}
          className="w-full rounded-lg bg-white/5 border border-white/10 text-white/90 text-sm p-4 placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-purple-400/40 resize-none"
        />
        {/* Word count hint */}
        <div className="text-xs text-white/40 mb-2">
          {(station6.customDoor ?? "").trim().split(/\s+/).filter(Boolean).length} words
          {(station6.customDoor ?? "").trim().split(/\s+/).filter(Boolean).length < 10 && " (10+ recommended)"}
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => session.goToStep("station_6_fear")}
            disabled={(station6.customDoor ?? "").trim().split(/\s+/).filter(Boolean).length < 5}
            className="flex-1 bg-purple-500/80 hover:bg-purple-500 disabled:bg-white/10 disabled:text-white/40 text-white rounded-full px-4 py-2 text-sm font-medium transition-colors"
          >
            Use my idea
          </button>
          <button
            onClick={() => {
              updateData({ customDoor: null });
              session.goToStep("station_6_fear");
            }}
            className="flex-1 bg-white/10 hover:bg-white/20 text-white rounded-full px-4 py-2 text-sm font-medium transition-colors"
          >
            Skip
          </button>
        </div>
      </div>
    );
  }

  // ─── Fear Cards ─────────────────────────────────────────────
  if (current === "station_6_fear") {
    return (
      <div className="max-w-lg mx-auto space-y-6">
        <p className="text-white/70 text-sm text-center leading-relaxed">
          {S6_KIT_DIALOGUE.beforeFear}
        </p>

        {/* Fear Cards Grid */}
        <div className="grid grid-cols-1 gap-3">
          {FEAR_CARDS.map((card) => {
            const isSelected = selectedFears.has(card.id);
            const imagePath = FEAR_CARD_IMAGES[card.id];
            const hasImage = fearCardImages[card.id];
            return (
              <button
                key={card.id}
                onClick={() => {
                  const newSelected = new Set(selectedFears);
                  if (isSelected) {
                    newSelected.delete(card.id);
                  } else {
                    newSelected.add(card.id);
                  }
                  setSelectedFears(newSelected);
                  setSelectedFearId(card.id);
                  // Auto-save fear selections to profile
                  updateData({ fearCards: Array.from(newSelected) });

                  // Call AI for personalized fear response (if not already fetched)
                  if (!isSelected && !fearAiResponses[card.id]) {
                    setFearLoading(card.id);
                    fetch("/api/discovery/reflect", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        type: "s6_fear",
                        studentText: card.label,
                        context: {
                          fearId: card.id,
                          fearText: card.label,
                          primaryArchetype: profile.archetypeResult?.primary ?? "unknown",
                          projectStatement: profile.station7?.projectStatement ?? null,
                          chosenDoor: station6.doors[station6.chosenDoorIndex ?? 0]?.title ?? null,
                        },
                      }),
                    })
                      .then((res) => (res.ok ? res.json() : null))
                      .then((data) => {
                        if (data?.result?.response) {
                          setFearAiResponses((prev) => ({
                            ...prev,
                            [card.id]: data.result.response,
                          }));
                        }
                      })
                      .catch(() => {})
                      .finally(() => setFearLoading(null));
                  }
                }}
                className={`text-left p-4 rounded-lg border transition-all relative overflow-hidden ${
                  isSelected
                    ? "border-purple-400 bg-purple-400/10 ring-2 ring-purple-400/30"
                    : "border-white/10 bg-white/5 hover:bg-white/10"
                }`}
              >
                {/* Background image layer (if exists) */}
                {imagePath && hasImage && (
                  <div
                    className="absolute inset-0 opacity-20"
                    style={{
                      backgroundImage: `url(${imagePath})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }}
                  />
                )}
                {/* Content layer */}
                <div className="relative flex items-start gap-3">
                  <span className="text-2xl shrink-0">{card.icon}</span>
                  <span className="font-medium text-white">{card.label}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Kit Response to Selected Fear */}
        {selectedFearId && (
          <div className="bg-white/5 border border-purple-400/20 rounded-lg p-4">
            {fearLoading === selectedFearId ? (
              <p className="text-white/50 text-sm italic">Kit is thinking about this...</p>
            ) : (
              <p className="text-white/90 text-sm leading-relaxed italic">
                &ldquo;{fearAiResponses[selectedFearId] ?? FEAR_CARDS.find((c) => c.id === selectedFearId)?.kitResponse}&rdquo;
              </p>
            )}
          </div>
        )}

        {/* Continue Button (appears after 5 seconds or if multiple fears selected) */}
        <div className="flex gap-2">
          <button
            onClick={() => {
              updateData({ fearCards: Array.from(selectedFears) });
              session.goToStep("station_6_choose");
            }}
            disabled={selectedFears.size === 0}
            className="flex-1 bg-purple-500/80 hover:bg-purple-500 disabled:bg-white/10 disabled:text-white/40 text-white rounded-full px-4 py-2 text-sm font-medium transition-colors"
          >
            {selectedFears.size === 0 ? "Choose a fear" : "Keep going"}
          </button>
        </div>
      </div>
    );
  }

  // ─── Choose Door ────────────────────────────────────────────
  if (current === "station_6_choose") {
    if (station6.doors.length === 0) {
      return (
        <div className="text-center max-w-md mx-auto">
          <p className="text-white/60 text-sm mb-4">
            No doors available yet. Let's generate them first.
          </p>
          <button
            onClick={() => session.goToStep("station_6_generating")}
            className="px-4 py-2 bg-purple-500/80 hover:bg-purple-500 text-white rounded-full text-sm font-medium transition-colors"
          >
            Generate Doors
          </button>
        </div>
      );
    }

    const handleDoorSelect = (index: number | -1) => {
      updateData({ chosenDoorIndex: index });
      setTimeout(() => {
        session.goToStep("station_7");
      }, 500);
    };

    return (
      <div className="max-w-lg mx-auto space-y-4">
        <p className="text-white/70 text-sm text-center leading-relaxed">
          {S6_KIT_DIALOGUE.beforeChoose}
        </p>

        {/* Door Option Cards */}
        <div className="space-y-2">
          {station6.doors.map((door, idx) => {
            const exploration = station6.doorExplorations[idx];
            const isSelected = station6.chosenDoorIndex === idx;

            return (
              <button
                key={idx}
                onClick={() => handleDoorSelect(idx)}
                className={`w-full text-left p-4 rounded-lg border transition-all ${
                  isSelected
                    ? "border-purple-400 bg-purple-400/10 ring-2 ring-purple-400/30"
                    : "border-white/10 bg-white/5 hover:bg-white/10"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-medium text-white mb-1">{door.title}</h4>
                    <p className="text-white/60 text-xs">
                      Excitement: {exploration?.excitement ?? 50}%
                    </p>
                  </div>
                  <div
                    className={`w-5 h-5 rounded-full border-2 ${
                      isSelected
                        ? "border-purple-400 bg-purple-400"
                        : "border-white/30"
                    }`}
                  />
                </div>
              </button>
            );
          })}

          {/* Custom Door Option */}
          {station6.customDoor && (
            <button
              onClick={() => handleDoorSelect(-1)}
              className={`w-full text-left p-4 rounded-lg border transition-all ${
                station6.chosenDoorIndex === -1
                  ? "border-purple-400 bg-purple-400/10 ring-2 ring-purple-400/30"
                  : "border-white/10 bg-white/5 hover:bg-white/10"
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-medium text-white mb-1">My Own Direction</h4>
                  <p className="text-white/60 text-xs line-clamp-2">
                    {station6.customDoor}
                  </p>
                </div>
                <div
                  className={`w-5 h-5 rounded-full border-2 ${
                    station6.chosenDoorIndex === -1
                      ? "border-purple-400 bg-purple-400"
                      : "border-white/30"
                  }`}
                />
              </div>
            </button>
          )}
        </div>

        {/* Selected State Message */}
        {station6.chosenDoorIndex !== null && (
          <p className="text-white/50 text-xs text-center">
            Direction locked. Moving ahead...
          </p>
        )}
      </div>
    );
  }

  return null;
}
