"use client";

import { useState, useCallback, useEffect } from "react";
import type { UseDiscoverySessionReturn } from "@/hooks/useDiscoverySession";
import { getStation3Content } from "@/lib/discovery/content";
import { STATION_3_KIT_DIALOGUE } from "@/lib/discovery/content/station-3-collection";
import type { Station3Data, ValuesRanking, IrritationAnalysis } from "@/lib/discovery/types";

/**
 * Station 3: The Collection Wall — Interests & Values
 *
 * Sub-steps:
 * 1. Intro — Kit explains
 * 2. Interest grid — Pick 5-7 from ~20 icons
 * 3. Irritation — Pick 1-2 presets OR write own (highest signal)
 * 4. YouTube — Pick 2-3 rabbit hole topics
 * 5. Values sort — Drag 8 value cards into Core / Important / Nice tiers
 * 6. Reveal — Kit reflects on interests + irritation combo
 *
 * Must NOT feel like a form. Visual, tapable, fast.
 *
 * @see docs/specs/discovery-engine-build-plan.md Part 2, Station 3
 */

interface Station3CollectionWallProps {
  session: UseDiscoverySessionReturn;
}

export function Station3CollectionWall({ session }: Station3CollectionWallProps) {
  const { machine, profile } = session;
  const { current } = machine;
  const station3 = profile.station3;
  const { interests, irritations, youtubeTopics, valueCards, kitDialogue } =
    getStation3Content(profile.ageBand);

  const [showFreeText, setShowFreeText] = useState(
    !!station3.irritationFreeText,
  );
  const [draggingCard, setDraggingCard] = useState<string | null>(null);
  const [isAnalyzingIrritation, setIsAnalyzingIrritation] = useState(false);
  const [irritationAnalysis, setIrritationAnalysis] =
    useState<IrritationAnalysis | null>(null);
  const [revealReflection, setRevealReflection] = useState<string | null>(null);
  const [revealLoading, setRevealLoading] = useState(false);

  const updateData = useCallback(
    (updates: Partial<Station3Data>) => {
      session.updateStation("station3", { ...station3, ...updates });
    },
    [session, station3],
  );

  const analyzeIrritation = useCallback(
    async (freeText: string) => {
      if (freeText.length < 10) return;

      setIsAnalyzingIrritation(true);
      try {
        const response = await fetch("/api/discovery/reflect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "s3_irritation",
            studentText: freeText,
          }),
        });

        if (!response.ok) {
          console.error("[Station3] Irritation analysis failed:", response.status);
          setIsAnalyzingIrritation(false);
          return;
        }

        const data = await response.json();
        const analysisResult = data.result as IrritationAnalysis;

        setIrritationAnalysis(analysisResult);
        updateData({
          irritationFreeText: freeText,
          irritationAiAnalysis: analysisResult,
        });
      } catch (err) {
        console.error("[Station3] Irritation analysis error:", err);
      } finally {
        setIsAnalyzingIrritation(false);
      }
    },
    [updateData],
  );

  // ─── AI Reveal fetch ───────────────────────────────────────
  useEffect(() => {
    if (current !== "station_3_reveal") return;
    if (revealReflection || revealLoading) return;

    setRevealLoading(true);
    fetch("/api/discovery/reflect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "s3_reveal",
        context: {
          interests: station3.interests,
          irritationFreeText: station3.irritationFreeText ?? null,
          irritationPresets: station3.irritationPresets,
          irritationSummaryTag:
            station3.irritationAiAnalysis?.summary_tag ?? null,
          youtubeTopics: station3.youtubeTopics,
          coreValues: station3.valuesRanking.core,
          importantValues: station3.valuesRanking.important,
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
  }, [current, revealReflection, revealLoading, station3]);

  // ─── Intro ─────────────────────────────────────────────────
  if (current === "station_3" || current === "station_3_intro") {
    return (
      <div className="text-center">
        <div className="text-5xl mb-4">📌</div>
        <h2 className="text-2xl font-bold text-white mb-3">
          The Collection Wall
        </h2>
        <p className="text-white/70 text-base max-w-md mx-auto leading-relaxed">
          {kitDialogue.intro}
        </p>
      </div>
    );
  }

  // ─── Interest Grid ──────────────────────────────────────────
  if (current === "station_3_interest_grid") {
    const selectedCount = station3.interests.length;
    const atLimit = selectedCount >= 7;

    return (
      <div>
        <p className="text-white/80 text-base mb-2 text-center">
          {kitDialogue.interest_prompt}
        </p>
        <p className="text-white/60 text-sm mb-6 text-center">
          {kitDialogue.interest_subtitle} — {selectedCount}/7 selected
        </p>

        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 max-w-xl mx-auto">
          {interests.map((item) => {
            const isSelected = station3.interests.includes(item.id);
            return (
              <button
                key={item.id}
                onClick={() => {
                  if (isSelected) {
                    updateData({
                      interests: station3.interests.filter(
                        (i) => i !== item.id,
                      ),
                    });
                  } else if (!atLimit) {
                    updateData({
                      interests: [...station3.interests, item.id],
                    });
                  }
                }}
                disabled={!isSelected && atLimit}
                className={`rounded-xl p-3 text-center transition-all duration-200 ${
                  isSelected
                    ? "ring-2 ring-teal-400 bg-teal-400/10 scale-105"
                    : atLimit
                      ? "opacity-30 cursor-not-allowed bg-white/5"
                      : "bg-white/5 hover:bg-white/10 ring-1 ring-white/10 hover:ring-white/30"
                }`}
              >
                <div className="text-2xl mb-1">{item.icon}</div>
                <div className="text-xs text-white/80 leading-tight">
                  {item.label}
                </div>
              </button>
            );
          })}
        </div>

        {selectedCount >= 5 && (
          <p className="text-teal-300/50 text-sm text-center mt-4 italic">
            Good spread. I can work with this.
          </p>
        )}
      </div>
    );
  }

  // ─── Irritation Scenarios ───────────────────────────────────
  if (current === "station_3_irritation") {
    return (
      <div className="max-w-lg mx-auto">
        <p className="text-white/80 text-base mb-2 text-center">
          {kitDialogue.irritation_prompt}
        </p>
        <p className="text-white/60 text-sm mb-6 text-center">
          Pick 1-2 that resonate — or write your own
        </p>

        <div className="space-y-2.5 mb-6">
          {irritations.map((item) => {
            const isSelected = station3.irritationPresets.includes(item.id);
            const atLimit =
              station3.irritationPresets.length >= 2 && !isSelected;
            return (
              <button
                key={item.id}
                onClick={() => {
                  if (isSelected) {
                    updateData({
                      irritationPresets: station3.irritationPresets.filter(
                        (i) => i !== item.id,
                      ),
                    });
                  } else if (!atLimit) {
                    updateData({
                      irritationPresets: [
                        ...station3.irritationPresets,
                        item.id,
                      ],
                    });
                  }
                }}
                disabled={atLimit}
                className={`w-full text-left rounded-xl p-3.5 transition-all duration-200 ${
                  isSelected
                    ? "ring-2 ring-teal-400 bg-teal-400/10"
                    : atLimit
                      ? "opacity-30 cursor-not-allowed bg-white/5"
                      : "bg-white/5 hover:bg-white/10 ring-1 ring-white/10 hover:ring-white/30"
                }`}
              >
                <span className="text-base text-white/90 leading-relaxed">
                  {item.text}
                </span>
                <span className="block text-xs text-white/50 mt-1">
                  {item.category}
                </span>
              </button>
            );
          })}
        </div>

        {/* Free-text option */}
        <div className="border-t border-white/10 pt-4">
          {!showFreeText ? (
            <button
              onClick={() => setShowFreeText(true)}
              className="text-teal-400/60 text-sm hover:text-teal-400/80 transition-colors"
            >
              ✍️ {kitDialogue.irritation_freetext_prompt}
            </button>
          ) : (
            <div>
              <p className="text-white/60 text-sm mb-2">
                {kitDialogue.irritation_freetext_prompt}
              </p>
              <textarea
                value={station3.irritationFreeText ?? ""}
                onChange={(e) =>
                  updateData({ irritationFreeText: e.target.value })
                }
                onBlur={() => analyzeIrritation(station3.irritationFreeText ?? "")}
                placeholder="What genuinely bugs you..."
                rows={3}
                className="w-full rounded-xl bg-white/5 border border-white/10 text-white/90 text-base p-4 placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-teal-400/40 resize-none"
              />
              <p className="text-white/50 text-xs mt-1">
                This is the most valuable signal — your own words carry more
                weight than any preset.
              </p>

              {/* Analysis loading state */}
              {isAnalyzingIrritation && (
                <div className="mt-3 p-3 rounded-lg bg-teal-400/5 border border-teal-400/20">
                  <p className="text-teal-400/70 text-sm">Kit is reading...</p>
                </div>
              )}

              {/* Kit's response */}
              {irritationAnalysis && !isAnalyzingIrritation && (
                <div className="mt-3 p-3 rounded-lg bg-teal-400/5 border border-teal-400/20">
                  <p className="text-teal-300 text-sm italic leading-relaxed">
                    {irritationAnalysis.kit_response}
                  </p>
                  {irritationAnalysis.summary_tag && (
                    <p className="text-teal-400/50 text-xs mt-2">
                      → {irritationAnalysis.summary_tag}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── YouTube Topics ─────────────────────────────────────────
  if (current === "station_3_youtube") {
    const selectedCount = station3.youtubeTopics.length;
    const atLimit = selectedCount >= 3;

    return (
      <div>
        <p className="text-white/80 text-base mb-2 text-center">
          {kitDialogue.youtube_intro}
        </p>
        <p className="text-white/60 text-sm mb-6 text-center">
          {kitDialogue.youtube_subtitle} — {selectedCount}/3 selected
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-w-xl mx-auto">
          {youtubeTopics.map((topic) => {
            const isSelected = station3.youtubeTopics.includes(topic.id);
            return (
              <button
                key={topic.id}
                onClick={() => {
                  if (isSelected) {
                    updateData({
                      youtubeTopics: station3.youtubeTopics.filter(
                        (t) => t !== topic.id,
                      ),
                    });
                  } else if (!atLimit) {
                    updateData({
                      youtubeTopics: [...station3.youtubeTopics, topic.id],
                    });
                  }
                }}
                disabled={!isSelected && atLimit}
                className={`text-left rounded-xl p-3.5 transition-all duration-200 ${
                  isSelected
                    ? "ring-2 ring-teal-400 bg-teal-400/10"
                    : atLimit
                      ? "opacity-30 cursor-not-allowed bg-white/5"
                      : "bg-white/5 hover:bg-white/10 ring-1 ring-white/10 hover:ring-white/30"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{topic.icon}</span>
                  <span className="text-base text-white/90">{topic.label}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ─── Values Sort (drag-and-drop) ────────────────────────────
  if (current === "station_3_values_sort") {
    const tiers = station3.valuesRanking;
    const allPlaced = [
      ...tiers.core,
      ...tiers.important,
      ...tiers.nice,
    ];
    const unplaced = valueCards.filter((c) => !allPlaced.includes(c.id));

    const tierConfig = [
      { key: "core" as const, label: kitDialogue.values_tiers.core, border: "border-teal-400/40", bg: "bg-teal-400/10", hoverBg: "bg-teal-400/20", text: "text-teal-300", chipBg: "bg-teal-400/15" },
      { key: "important" as const, label: kitDialogue.values_tiers.important, border: "border-cyan-400/40", bg: "bg-cyan-400/10", hoverBg: "bg-cyan-400/20", text: "text-cyan-300", chipBg: "bg-cyan-400/15" },
      { key: "nice" as const, label: kitDialogue.values_tiers.nice, border: "border-white/30", bg: "bg-white/5", hoverBg: "bg-white/15", text: "text-white/80", chipBg: "bg-white/10" },
    ] as const;

    const moveCard = (cardId: string, toTier: keyof ValuesRanking | "unplaced") => {
      const newRanking: ValuesRanking = {
        core: tiers.core.filter((id) => id !== cardId),
        important: tiers.important.filter((id) => id !== cardId),
        nice: tiers.nice.filter((id) => id !== cardId),
      };
      if (toTier !== "unplaced") {
        newRanking[toTier] = [...newRanking[toTier], cardId];
      }
      updateData({ valuesRanking: newRanking });
    };

    const handleDragStart = (e: React.DragEvent, cardId: string) => {
      e.dataTransfer.setData("text/plain", cardId);
      e.dataTransfer.effectAllowed = "move";
      setDraggingCard(cardId);
    };

    const handleDragEnd = () => {
      setDraggingCard(null);
    };

    const handleDrop = (e: React.DragEvent, tier: keyof ValuesRanking) => {
      e.preventDefault();
      const cardId = e.dataTransfer.getData("text/plain");
      if (cardId) moveCard(cardId, tier);
      setDraggingCard(null);
    };

    const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    };

    return (
      <div className="max-w-xl mx-auto">
        <p className="text-white/80 text-base mb-2 text-center">
          {kitDialogue.values_intro}
        </p>
        <p className="text-white/60 text-sm mb-6 text-center">
          Drag cards into the tier that fits — or tap a card then tap a tier
        </p>

        {/* Tier drop zones */}
        <div className="space-y-3 mb-6">
          {tierConfig.map(({ key, label, border, bg, hoverBg, text, chipBg }) => {
            const isDragOver = draggingCard !== null;
            return (
              <div
                key={key}
                onDrop={(e) => handleDrop(e, key)}
                onDragOver={handleDragOver}
                className={`rounded-xl border-2 border-dashed p-3 transition-all duration-200 ${border} ${
                  isDragOver ? hoverBg : bg
                }`}
              >
                <div className={`text-sm font-medium mb-2 ${text}`}>
                  {label}
                </div>
                <div className="flex flex-wrap gap-1.5 min-h-[40px]">
                  {tiers[key].map((cardId) => {
                    const card = valueCards.find((c) => c.id === cardId);
                    if (!card) return null;
                    return (
                      <div
                        key={card.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, card.id)}
                        onDragEnd={handleDragEnd}
                        onClick={() => moveCard(card.id, "unplaced")}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full ${chipBg} text-sm text-white/80 cursor-grab active:cursor-grabbing hover:bg-red-400/10 hover:text-red-300 transition-colors select-none ${
                          draggingCard === card.id ? "opacity-40" : ""
                        }`}
                        title="Drag to move · Click to remove"
                      >
                        <span>{card.icon}</span>
                        <span>{card.label}</span>
                        <span className="text-white/30 ml-1">×</span>
                      </div>
                    );
                  })}
                  {tiers[key].length === 0 && (
                    <span className="text-white/30 text-xs py-2 px-1">
                      Drop cards here
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Unplaced cards — draggable + tap-to-place fallback */}
        {unplaced.length > 0 && (
          <div className="border-t border-white/10 pt-4">
            <p className="text-white/50 text-xs mb-3 text-center">
              {unplaced.length} value{unplaced.length !== 1 ? "s" : ""}{" "}
              remaining
            </p>
            <div className="grid grid-cols-2 gap-2">
              {unplaced.map((card) => (
                <div
                  key={card.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, card.id)}
                  onDragEnd={handleDragEnd}
                  className={`text-left rounded-xl p-3 transition-all duration-200 cursor-grab active:cursor-grabbing bg-white/5 hover:bg-white/10 ring-1 ring-white/10 hover:ring-white/30 select-none ${
                    draggingCard === card.id ? "opacity-40 scale-95" : ""
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{card.icon}</span>
                    <span className="text-xs font-medium text-white/80">
                      {card.label}
                    </span>
                  </div>
                  <p className="text-[10px] text-white/40 leading-snug">
                    {card.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── Reveal ─────────────────────────────────────────────────
  if (current === "station_3_reveal") {
    const topInterests = station3.interests
      .slice(0, 3)
      .map((id) => interests.find((i) => i.id === id))
      .filter(Boolean);

    const coreValues = station3.valuesRanking.core
      .map((id) => valueCards.find((c) => c.id === id))
      .filter(Boolean);

    return (
      <div className="text-center max-w-lg mx-auto">
        <p className="text-white/60 text-sm mb-6">{kitDialogue.reveal}</p>

        {/* Interest highlights */}
        {topInterests.length > 0 && (
          <div className="mb-4">
            <p className="text-white/60 text-xs mb-2">Top interests</p>
            <div className="flex justify-center gap-2">
              {topInterests.map(
                (item) =>
                  item && (
                    <span
                      key={item.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-teal-400/10 border border-teal-400/20 text-sm text-teal-300"
                    >
                      <span>{item.icon}</span> {item.label}
                    </span>
                  ),
              )}
            </div>
          </div>
        )}

        {/* Core values */}
        {coreValues.length > 0 && (
          <div className="mb-4">
            <p className="text-white/60 text-xs mb-2">Core values</p>
            <div className="flex justify-center gap-2 flex-wrap">
              {coreValues.map(
                (card) =>
                  card && (
                    <span
                      key={card.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm text-white/80"
                    >
                      <span>{card.icon}</span> {card.label}
                    </span>
                  ),
              )}
            </div>
          </div>
        )}

        {/* Free-text irritation highlight */}
        {station3.irritationFreeText && (
          <div className="mt-4 p-3 rounded-xl bg-white/5 border border-white/10">
            <p className="text-white/60 text-xs mb-1">
              What bugs you
            </p>
            <p className="text-white/70 text-sm italic leading-relaxed">
              &ldquo;{station3.irritationFreeText}&rdquo;
            </p>
          </div>
        )}

        {/* Kit's AI reflection on the combination */}
        <div className="mt-6 p-4 rounded-xl bg-teal-400/5 border border-teal-400/20">
          {revealLoading ? (
            <p className="text-teal-300/50 text-sm italic">
              Kit is thinking about what this all means together...
            </p>
          ) : revealReflection ? (
            <p className="text-teal-300 text-base leading-relaxed italic">
              &ldquo;{revealReflection}&rdquo;
            </p>
          ) : (
            <p className="text-white/60 text-sm italic">
              {kitDialogue.reveal}
            </p>
          )}
        </div>
      </div>
    );
  }

  return null;
}
