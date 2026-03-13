"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ACTIVITY_LIBRARY, type ActivityTemplate } from "@/lib/activity-library";
import type { CriterionKey } from "@/lib/constants";
import type { ActivityCard, CardAIHints, ModifierAxis } from "@/types/activity-cards";

interface ActivityBrowserProps {
  onInsert: (activity: ActivityTemplate) => void;
  filterCriterion?: CriterionKey;
  isOpen: boolean;
  onClose: () => void;
}

const CATEGORIES = [
  { value: "all", label: "All" },
  { value: "design-thinking", label: "Design Thinking" },
  { value: "visible-thinking", label: "Visible Thinking" },
  { value: "evaluation", label: "Evaluation" },
  { value: "brainstorming", label: "Brainstorming" },
  { value: "analysis", label: "Analysis" },
  { value: "skills", label: "Skills" },
] as const;

const DURATION_OPTIONS = [
  { value: "all", label: "Any" },
  { value: "10", label: "≤ 10 min" },
  { value: "15", label: "≤ 15 min" },
  { value: "20", label: "≤ 20 min" },
  { value: "30", label: "≤ 30 min" },
] as const;

const GROUP_SIZES = [
  { value: "all", label: "Any" },
  { value: "individual", label: "Individual" },
  { value: "pairs", label: "Pairs" },
  { value: "small-group", label: "Small Group" },
  { value: "whole-class", label: "Whole Class" },
  { value: "flexible", label: "Flexible" },
] as const;

const DESIGN_PHASES = [
  { value: "all", label: "All Phases" },
  { value: "research", label: "Research" },
  { value: "empathy", label: "Empathy" },
  { value: "define", label: "Define" },
  { value: "ideation", label: "Ideation" },
  { value: "prototyping", label: "Prototyping" },
  { value: "making", label: "Making" },
  { value: "testing", label: "Testing" },
  { value: "evaluation", label: "Evaluation" },
  { value: "reflection", label: "Reflection" },
] as const;

// Duration map for backward compat with hardcoded fallback
const MINUTES_TO_DURATION: Record<number, string> = {
  5: "5min", 10: "10min", 15: "15min", 20: "20min", 30: "30min+",
};

/**
 * Convert a DB ActivityCard to the ActivityTemplate interface
 * so onInsert stays backward-compatible with existing consumers.
 */
function cardToTemplate(card: ActivityCard): ActivityTemplate {
  const hints = card.ai_hints as CardAIHints;
  return {
    id: card.slug,
    name: card.name,
    description: card.description,
    category: card.category as ActivityTemplate["category"],
    tags: {
      criteria: card.criteria as CriterionKey[],
      phases: card.phases,
      thinkingType: card.thinking_type as ActivityTemplate["tags"]["thinkingType"],
      duration: (MINUTES_TO_DURATION[card.duration_minutes] || "15min") as ActivityTemplate["tags"]["duration"],
      groupSize: card.group_size as ActivityTemplate["tags"]["groupSize"],
    },
    template: {
      sections: card.template?.sections || [],
      vocabTerms: card.template?.vocabTerms,
      reflection: card.template?.reflection,
    },
    aiHints: {
      whenToUse: hints?.whenToUse || "",
      topicAdaptation: hints?.topicAdaptation || "",
    },
  };
}

export function ActivityBrowser({
  onInsert,
  filterCriterion,
  isOpen,
  onClose,
}: ActivityBrowserProps) {
  const [search, setSearch] = useState("");
  const [phaseFilter, setPhaseFilter] = useState<string>("all");
  // Keep filterCriterion for backward compat with props but don't use in UI
  const criterionFilter: CriterionKey | "all" = filterCriterion ?? "all";
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [durationFilter, setDurationFilter] = useState<string>("all");
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  // DB-backed cards state
  const [cards, setCards] = useState<ActivityCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [usingFallback, setUsingFallback] = useState(false);

  // Modifier state per expanded card
  const [modifierValues, setModifierValues] = useState<Record<string, Record<string, string | boolean>>>({});

  // Adapting state
  const [adapting, setAdapting] = useState(false);

  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch cards from API
  const fetchCards = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (categoryFilter !== "all") params.set("category", categoryFilter);
      if (criterionFilter !== "all") params.set("criterion", criterionFilter);
      if (groupFilter !== "all") params.set("groupSize", groupFilter);
      if (durationFilter !== "all") params.set("maxDuration", durationFilter);

      const res = await fetch(`/api/teacher/activity-cards?${params}`);
      if (!res.ok) throw new Error("API error");

      const data = await res.json();
      // Client-side phase filter (phases are arrays, need contains check)
      let filtered = data.cards || [];
      if (phaseFilter !== "all") {
        filtered = filtered.filter(
          (c: ActivityCard) => c.phases?.includes(phaseFilter)
        );
      }
      setCards(filtered);
      setUsingFallback(false);
    } catch {
      // Fallback to hardcoded library
      setCards([]);
      setUsingFallback(true);
    } finally {
      setLoading(false);
    }
  }, [search, categoryFilter, criterionFilter, phaseFilter, groupFilter, durationFilter]);

  useEffect(() => {
    if (!isOpen) return;

    // Debounce search, fetch immediately for filter changes
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(fetchCards, search ? 300 : 0);

    return () => {
      if (searchDebounce.current) clearTimeout(searchDebounce.current);
    };
  }, [isOpen, fetchCards, search]);

  // Fallback: filter hardcoded library client-side
  const fallbackFiltered = usingFallback
    ? ACTIVITY_LIBRARY.filter((a) => {
        if (phaseFilter !== "all" && !a.tags.phases.includes(phaseFilter)) return false;
        if (criterionFilter !== "all" && !a.tags.criteria.includes(criterionFilter)) return false;
        if (categoryFilter !== "all" && a.category !== categoryFilter) return false;
        if (durationFilter !== "all") {
          const maxMin = parseInt(durationFilter, 10);
          const durationMap: Record<string, number> = { "5min": 5, "10min": 10, "15min": 15, "20min": 20, "30min+": 30 };
          if ((durationMap[a.tags.duration] || 15) > maxMin) return false;
        }
        if (groupFilter !== "all" && a.tags.groupSize !== groupFilter) return false;
        if (search) {
          const q = search.toLowerCase();
          return a.name.toLowerCase().includes(q) || a.description.toLowerCase().includes(q);
        }
        return true;
      })
    : [];

  // Display items — either from API or fallback
  const displayCards = usingFallback ? [] : cards;
  const displayTemplates = usingFallback ? fallbackFiltered : [];
  const totalCount = usingFallback ? displayTemplates.length : displayCards.length;

  // Initialize modifier defaults when a card is expanded
  const initModifiers = (card: ActivityCard) => {
    const hints = card.ai_hints as CardAIHints;
    if (!hints?.modifierAxes?.length) return;

    if (modifierValues[card.id]) return; // already initialized

    const defaults: Record<string, string | boolean> = {};
    for (const axis of hints.modifierAxes) {
      defaults[axis.id] = axis.default;
    }
    setModifierValues((prev) => ({ ...prev, [card.id]: defaults }));
  };

  const handleModifierChange = (cardId: string, axisId: string, value: string | boolean) => {
    setModifierValues((prev) => ({
      ...prev,
      [cardId]: { ...prev[cardId], [axisId]: value },
    }));
  };

  const handleInsertAsIs = (card: ActivityCard) => {
    onInsert(cardToTemplate(card));
  };

  const handleAdaptAndInsert = async (card: ActivityCard) => {
    setAdapting(true);
    try {
      const mods = modifierValues[card.id] || {};

      const res = await fetch("/api/teacher/activity-cards/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardId: card.id,
          modifiers: mods,
        }),
      });

      if (!res.ok) throw new Error("Adaptation failed");

      const data = await res.json();

      // Build a template from the adapted response
      const adapted: ActivityTemplate = {
        ...cardToTemplate(card),
        template: {
          sections: data.sections || [],
          vocabTerms: data.vocabTerms || [],
          reflection: data.reflection || undefined,
        },
      };

      onInsert(adapted);

      // Record usage (fire-and-forget)
      fetch("/api/teacher/activity-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardId: card.id,
          modifiersApplied: mods,
          sectionsBefore: card.template?.sections,
          sectionsAfter: data.sections,
        }),
      }).catch(() => {});
    } catch {
      // If adaptation fails, insert as-is
      onInsert(cardToTemplate(card));
    } finally {
      setAdapting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative w-full max-w-lg bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="text-lg font-bold text-text-primary">
              Activity Library
            </h2>
            <p className="text-xs text-text-secondary">
              {loading ? "Loading..." : `${totalCount} activit${totalCount === 1 ? "y" : "ies"}`}
              {usingFallback && " (offline)"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search + filters */}
        <div className="px-5 py-3 border-b border-border space-y-3">
          {/* Search */}
          <div className="relative">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="text"
              placeholder="Search activities..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-purple/30 focus:border-brand-purple"
            />
          </div>

          {/* Design phase pills */}
          <div className="flex gap-1.5 flex-wrap">
            {DESIGN_PHASES.map((phase) => (
              <button
                key={phase.value}
                onClick={() => setPhaseFilter(phase.value)}
                className={`px-2.5 py-1 text-xs rounded-full transition font-medium ${
                  phaseFilter === phase.value
                    ? "bg-gray-800 text-white"
                    : "bg-gray-100 text-text-secondary hover:bg-gray-200"
                }`}
              >
                {phase.label}
              </button>
            ))}
          </div>

          {/* Category / Duration / Group size row */}
          <div className="flex gap-2">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="flex-1 px-2 py-1.5 text-xs border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-purple"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            <select
              value={durationFilter}
              onChange={(e) => setDurationFilter(e.target.value)}
              className="flex-1 px-2 py-1.5 text-xs border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-purple"
            >
              {DURATION_OPTIONS.map((d) => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
            <select
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
              className="flex-1 px-2 py-1.5 text-xs border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-purple"
            >
              {GROUP_SIZES.map((g) => (
                <option key={g.value} value={g.value}>{g.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Activity list */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
          {!loading && totalCount === 0 && (
            <p className="text-sm text-text-secondary text-center py-8">
              No activities match your filters
            </p>
          )}

          {loading && (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-brand-purple/30 border-t-brand-purple rounded-full animate-spin" />
            </div>
          )}

          {/* DB-backed cards */}
          {displayCards.map((card) => (
            <ActivityCardItem
              key={card.id}
              card={card}
              isExpanded={expanded === card.id}
              onToggle={() => {
                const willExpand = expanded !== card.id;
                setExpanded(willExpand ? card.id : null);
                if (willExpand) initModifiers(card);
              }}
              modifierValues={modifierValues[card.id] || {}}
              onModifierChange={(axisId, value) => handleModifierChange(card.id, axisId, value)}
              onInsertAsIs={() => handleInsertAsIs(card)}
              onAdaptAndInsert={() => handleAdaptAndInsert(card)}
              adapting={adapting}
            />
          ))}

          {/* Fallback: hardcoded templates */}
          {displayTemplates.map((activity) => {
            const isExpanded = expanded === activity.id;
            return (
              <FallbackActivityItem
                key={activity.id}
                activity={activity}
                isExpanded={isExpanded}
                onToggle={() => setExpanded(isExpanded ? null : activity.id)}
                onInsert={() => onInsert(activity)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DB-backed card item with modifier support
// ---------------------------------------------------------------------------

function ActivityCardItem({
  card,
  isExpanded,
  onToggle,
  modifierValues,
  onModifierChange,
  onInsertAsIs,
  onAdaptAndInsert,
  adapting,
}: {
  card: ActivityCard;
  isExpanded: boolean;
  onToggle: () => void;
  modifierValues: Record<string, string | boolean>;
  onModifierChange: (axisId: string, value: string | boolean) => void;
  onInsertAsIs: () => void;
  onAdaptAndInsert: () => void;
  adapting: boolean;
}) {
  const hints = card.ai_hints as CardAIHints;
  const modifierAxes: ModifierAxis[] = hints?.modifierAxes || [];
  const hasModifiers = modifierAxes.length > 0;
  const hasSelectedNonDefault = hasModifiers && modifierAxes.some(
    (axis) => modifierValues[axis.id] !== undefined && modifierValues[axis.id] !== axis.default
  );

  return (
    <div className="border border-border rounded-xl overflow-hidden hover:border-brand-purple/30 transition">
      {/* Card header */}
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 text-left flex items-start gap-3 hover:bg-gray-50 transition"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-sm text-text-primary">{card.name}</span>
            <span className="px-1.5 py-0.5 text-[10px] rounded bg-gray-100 text-text-secondary">
              {card.duration_minutes} min
            </span>
            <span className="px-1.5 py-0.5 text-[10px] rounded bg-gray-100 text-text-secondary capitalize">
              {card.group_size?.replace("-", " ")}
            </span>
          </div>
          <p className="text-xs text-text-secondary line-clamp-2">{card.description}</p>
          <div className="flex gap-1 mt-1.5 flex-wrap">
            {card.phases?.map((phase) => (
              <span
                key={phase}
                className="px-1.5 py-0.5 text-[10px] rounded bg-blue-50 text-accent-blue capitalize"
              >
                {phase}
              </span>
            ))}
            <span className="px-1.5 py-0.5 text-[10px] rounded bg-gray-50 text-text-secondary capitalize">
              {card.category?.replace("-", " ")}
            </span>
            {hasModifiers && (
              <span className="px-1.5 py-0.5 text-[10px] rounded bg-brand-purple/10 text-brand-purple font-medium">
                {modifierAxes.length} modifier{modifierAxes.length > 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
          className={`flex-shrink-0 mt-1 text-text-secondary transition-transform ${isExpanded ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {/* Expanded: sections preview + modifiers + insert */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-border bg-gray-50">
          {/* Section previews */}
          <div className="mt-3 space-y-2">
            {card.template?.sections?.map((section: { prompt: string; responseType?: string; scaffolding?: { ell1?: { sentenceStarters?: string[] } } }, i: number) => (
              <div key={i} className="bg-white rounded-lg p-3 border border-border">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-brand-purple/10 text-brand-purple">
                    {section.responseType}
                  </span>
                  <span className="text-[10px] text-text-secondary">Section {i + 1}</span>
                </div>
                <p className="text-xs text-text-primary whitespace-pre-line line-clamp-4">
                  {section.prompt}
                </p>
                {section.scaffolding?.ell1?.sentenceStarters && (
                  <div className="mt-2 flex gap-1 flex-wrap">
                    {section.scaffolding.ell1.sentenceStarters.slice(0, 2).map((s: string, j: number) => (
                      <span key={j} className="text-[10px] bg-accent-blue/10 text-accent-blue px-1.5 py-0.5 rounded">
                        ELL1: {s}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Vocab terms */}
          {card.template?.vocabTerms && card.template.vocabTerms.length > 0 && (
            <div className="mt-2 flex gap-1 flex-wrap">
              {card.template.vocabTerms.map((v: { term: string }) => (
                <span key={v.term} className="text-[10px] bg-accent-green/10 text-accent-green px-1.5 py-0.5 rounded">
                  {v.term}
                </span>
              ))}
            </div>
          )}

          {/* Materials / Tools / Resources */}
          {(card.materials?.length > 0 || card.tools?.length > 0) && (
            <div className="mt-3 flex gap-2 flex-wrap">
              {card.materials?.map((m) => (
                <span key={m} className="text-[10px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded">
                  {m}
                </span>
              ))}
              {card.tools?.map((t) => (
                <span key={t} className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">
                  {t}
                </span>
              ))}
            </div>
          )}

          {/* Modifier controls */}
          {hasModifiers && (
            <div className="mt-4 space-y-3">
              <p className="text-[10px] font-semibold text-text-secondary uppercase tracking-wide">
                Customise
              </p>
              {modifierAxes.map((axis) => (
                <div key={axis.id}>
                  <label className="text-xs font-medium text-text-primary mb-1 block">
                    {axis.label}
                    <span className="text-text-secondary/60 font-normal ml-1">
                      — {axis.description}
                    </span>
                  </label>
                  {axis.type === "select" && axis.options ? (
                    <div className="flex gap-1.5 flex-wrap">
                      {axis.options.map((opt) => {
                        const isSelected = modifierValues[axis.id] === opt.value;
                        return (
                          <button
                            key={opt.value}
                            onClick={() => onModifierChange(axis.id, opt.value)}
                            className={`px-2.5 py-1.5 text-xs rounded-lg border transition ${
                              isSelected
                                ? "border-brand-purple bg-brand-purple/10 text-brand-purple font-medium"
                                : "border-border text-text-secondary hover:border-gray-300 hover:bg-gray-50"
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  ) : axis.type === "toggle" ? (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!modifierValues[axis.id]}
                        onChange={(e) => onModifierChange(axis.id, e.target.checked)}
                        className="w-4 h-4 rounded border-border text-brand-purple focus:ring-brand-purple/30"
                      />
                      <span className="text-xs text-text-secondary">Enable</span>
                    </label>
                  ) : null}
                </div>
              ))}
            </div>
          )}

          {/* Insert buttons */}
          <div className="mt-4 flex gap-2">
            <button
              onClick={onInsertAsIs}
              disabled={adapting}
              className="flex-1 py-2 bg-brand-purple text-white text-sm font-medium rounded-lg hover:bg-brand-purple/90 transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Insert as-is
            </button>
            {hasModifiers && hasSelectedNonDefault && (
              <button
                onClick={onAdaptAndInsert}
                disabled={adapting}
                className="flex-1 py-2 bg-accent-blue text-white text-sm font-medium rounded-lg hover:bg-accent-blue/90 transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {adapting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Adapting...
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.636 5.636l2.121 2.121m8.486 8.486l2.121 2.121M5.636 18.364l2.121-2.121m8.486-8.486l2.121-2.121" />
                    </svg>
                    Adapt &amp; Insert
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fallback: hardcoded template item (mirrors old behavior exactly)
// ---------------------------------------------------------------------------

function FallbackActivityItem({
  activity,
  isExpanded,
  onToggle,
  onInsert,
}: {
  activity: ActivityTemplate;
  isExpanded: boolean;
  onToggle: () => void;
  onInsert: () => void;
}) {
  return (
    <div className="border border-border rounded-xl overflow-hidden hover:border-brand-purple/30 transition">
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 text-left flex items-start gap-3 hover:bg-gray-50 transition"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-sm text-text-primary">{activity.name}</span>
            <span className="px-1.5 py-0.5 text-[10px] rounded bg-gray-100 text-text-secondary capitalize">
              {activity.tags.duration}
            </span>
            <span className="px-1.5 py-0.5 text-[10px] rounded bg-gray-100 text-text-secondary capitalize">
              {activity.tags.groupSize}
            </span>
          </div>
          <p className="text-xs text-text-secondary line-clamp-2">{activity.description}</p>
          <div className="flex gap-1 mt-1.5 flex-wrap">
            {activity.tags.phases.map((phase) => (
              <span key={phase} className="px-1.5 py-0.5 text-[10px] rounded bg-blue-50 text-accent-blue capitalize">
                {phase}
              </span>
            ))}
            <span className="px-1.5 py-0.5 text-[10px] rounded bg-gray-50 text-text-secondary capitalize">
              {activity.category.replace("-", " ")}
            </span>
          </div>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={`flex-shrink-0 mt-1 text-text-secondary transition-transform ${isExpanded ? "rotate-180" : ""}`}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 border-t border-border bg-gray-50">
          <div className="mt-3 space-y-2">
            {activity.template.sections.map((section, i) => (
              <div key={i} className="bg-white rounded-lg p-3 border border-border">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-brand-purple/10 text-brand-purple">{section.responseType}</span>
                  <span className="text-[10px] text-text-secondary">Section {i + 1}</span>
                </div>
                <p className="text-xs text-text-primary whitespace-pre-line line-clamp-4">{section.prompt}</p>
              </div>
            ))}
          </div>
          <button
            onClick={onInsert}
            className="mt-3 w-full py-2 bg-brand-purple text-white text-sm font-medium rounded-lg hover:bg-brand-purple/90 transition flex items-center justify-center gap-2"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Insert Activity
          </button>
        </div>
      )}
    </div>
  );
}
