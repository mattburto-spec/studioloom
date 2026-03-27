"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import type { WizardState, WizardDispatch, WizardMode, SuggestedKeyword, KeywordPriority } from "@/hooks/useWizardState";
import { KeywordCard } from "./KeywordCard";
import { CompactConfig } from "./CompactConfig";
import { ModeSelector } from "./ModeSelector";
import { SuggestionLoading } from "./shared/SuggestionBadge";
import type { UnitType } from "@/lib/ai/unit-types";

const UNIT_TYPE_OPTIONS: Array<{
  type: UnitType;
  label: string;
  shortLabel: string;
  icon: string;
  description: string;
  color: string;
  bgColor: string;
  borderColor: string;
}> = [
  {
    type: "design",
    label: "Design Project",
    shortLabel: "Design",
    icon: "✏️",
    description: "MYP Design Cycle — create a product or solution",
    color: "text-teal-700",
    bgColor: "bg-teal-50",
    borderColor: "border-teal-300",
  },
  {
    type: "service",
    label: "Service Learning",
    shortLabel: "Service",
    icon: "🤝",
    description: "Community-focused — investigate, plan, act, reflect",
    color: "text-pink-700",
    bgColor: "bg-pink-50",
    borderColor: "border-pink-300",
  },
  {
    type: "personal_project",
    label: "Personal Project",
    shortLabel: "PP",
    icon: "🎯",
    description: "Extended self-directed project with process journal",
    color: "text-purple-700",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-300",
  },
  {
    type: "inquiry",
    label: "Inquiry Unit",
    shortLabel: "Inquiry",
    icon: "🔍",
    description: "Question-driven — research, analyse, communicate",
    color: "text-amber-700",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-300",
  },
];

interface Props {
  state: WizardState;
  dispatch: WizardDispatch;
  onSelectMode?: (mode: WizardMode) => void;
}

export function GoalInput({ state, dispatch, onSelectMode }: Props) {
  const [keywordStatus, setKeywordStatus] = useState<"idle" | "loading" | "done">("idle");
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [dragOverBucket, setDragOverBucket] = useState<KeywordPriority | null>(null);

  const goalText = state.input.topic;
  const keywords = state.suggestedKeywords;

  // Partition keywords by priority
  const bankKeywords = keywords.map((kw, i) => ({ ...kw, originalIndex: i })).filter((kw) => kw.priority === "none");
  const niceToHave = keywords.map((kw, i) => ({ ...kw, originalIndex: i })).filter((kw) => kw.priority === "included");
  const mustHave = keywords.map((kw, i) => ({ ...kw, originalIndex: i })).filter((kw) => kw.priority === "essential");

  // Auto-focus the textarea
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Debounced keyword fetching
  const fetchKeywords = useCallback(async (text: string, placedLabels?: string[]) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setKeywordStatus("loading");

    try {
      const res = await fetch("/api/teacher/wizard-suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tier: 1,
          context: {
            topic: text,
            ...(placedLabels?.length ? { placedKeywords: placedLabels } : {}),
          },
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        setKeywordStatus("idle");
        return;
      }

      const data = await res.json();
      const suggestions = data.suggestions || {};

      // Convert suggestions into keyword cards
      const newKeywords: SuggestedKeyword[] = [];

      if (suggestions.globalContext) {
        for (const gc of suggestions.globalContext) {
          newKeywords.push({ label: gc, category: "context", priority: "none" });
        }
      }
      if (suggestions.keyConcept) {
        for (const kc of suggestions.keyConcept) {
          newKeywords.push({ label: kc, category: "concept", priority: "none" });
        }
      }
      if (suggestions.activities) {
        for (const a of suggestions.activities) {
          newKeywords.push({ label: a, category: "activity", priority: "none" });
        }
      }
      if (suggestions.tools) {
        for (const t of suggestions.tools) {
          newKeywords.push({ label: t, category: "tool", priority: "none" });
        }
      }
      if (suggestions.groupwork) {
        for (const g of suggestions.groupwork) {
          newKeywords.push({ label: g, category: "groupwork", priority: "none" });
        }
      }
      if (suggestions.resources) {
        for (const r of suggestions.resources) {
          newKeywords.push({ label: r, category: "resource", priority: "none" });
        }
      }

      // Preserve priority from existing keywords
      const existingPriority = new Map(
        state.suggestedKeywords
          .filter((k) => k.priority !== "none")
          .map((k) => [k.label, k.priority])
      );
      const merged = newKeywords.map((k) => ({
        ...k,
        priority: existingPriority.get(k.label) || k.priority,
      }));

      // Keep any selected keywords that aren't in the new set
      const newLabels = new Set(merged.map((k) => k.label));
      const keptSelected = state.suggestedKeywords.filter(
        (k) => k.priority !== "none" && !newLabels.has(k.label)
      );

      dispatch({ type: "SET_KEYWORDS", keywords: [...keptSelected, ...merged] });
      setKeywordStatus("done");
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setKeywordStatus("idle");
    }
  }, [dispatch, state.suggestedKeywords]);

  // Fetch keywords when goal text changes
  useEffect(() => {
    if (goalText.trim().length < 15) {
      dispatch({ type: "SET_KEYWORDS", keywords: [] });
      setKeywordStatus("idle");
      return;
    }

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => fetchKeywords(goalText), 300);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goalText]);

  // Re-fetch complementary keywords when keywords are placed into buckets
  const placedCount = keywords.filter((k) => k.priority !== "none").length;
  const prevPlacedCountRef = useRef(0);
  useEffect(() => {
    if (placedCount > prevPlacedCountRef.current && goalText.trim().length >= 15) {
      const placedLabels = keywords
        .filter((k) => k.priority !== "none")
        .map((k) => k.label);
      // Short debounce to batch rapid placements
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => fetchKeywords(goalText, placedLabels), 400);
    }
    prevPlacedCountRef.current = placedCount;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placedCount]);

  const handleTextChange = (text: string) => {
    dispatch({ type: "SET_INPUT", key: "topic", value: text });
  };

  const handleToggleKeyword = (index: number) => {
    dispatch({ type: "TOGGLE_KEYWORD", index });
  };

  const handleSetPriority = (index: number, priority: KeywordPriority) => {
    dispatch({ type: "SET_KEYWORD_PRIORITY", index, priority });
  };

  // Drag handlers for bucket zones
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const handleDrop = useCallback((targetPriority: KeywordPriority) => (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverBucket(null);
    const indexStr = e.dataTransfer.getData("text/plain");
    const index = parseInt(indexStr, 10);
    if (!isNaN(index)) {
      handleSetPriority(index, targetPriority);
    }
  }, []);

  const handleDragEnter = useCallback((bucket: KeywordPriority) => (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverBucket(bucket);
  }, []);

  const handleDragLeave = useCallback((bucket: KeywordPriority) => (e: React.DragEvent) => {
    // Only clear if leaving the bucket itself, not entering a child
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    if (dragOverBucket === bucket) setDragOverBucket(null);
  }, [dragOverBucket]);

  const showConfig = goalText.trim().length >= 30 || keywords.filter((k) => k.priority !== "none").length >= 2;

  // Show buckets as soon as text is long enough (stable — no flicker)
  const showKeywordSection = goalText.trim().length >= 15;
  const hasPlacedKeywords = niceToHave.length > 0 || mustHave.length > 0;

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-brand-purple/10 text-brand-purple rounded-full text-xs font-medium mb-4">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 0l1.5 5.5L15 7l-5.5 1.5L8 14l-1.5-5.5L1 7l5.5-1.5z" />
          </svg>
          AI Unit Builder
        </div>
        <h1 className="text-2xl font-bold text-text-primary mb-2">
          What will students make or achieve?
        </h1>
        <p className="text-sm text-text-secondary max-w-md mx-auto">
          Describe the final product or outcome. AI will plan the learning journey backwards from here.
        </p>
      </div>

      {/* Unit type selector */}
      <div className="max-w-2xl mx-auto mb-4">
        <div className="grid grid-cols-4 gap-2">
          {UNIT_TYPE_OPTIONS.map((opt) => {
            const selected = (state.input.unitType || "design") === opt.type;
            return (
              <button
                key={opt.type}
                onClick={() => {
                  dispatch({ type: "SET_INPUT", key: "unitType", value: opt.type });
                }}
                className={`relative flex flex-col items-center gap-1 px-2 py-3 rounded-xl border-2 transition-all duration-200 text-center ${
                  selected
                    ? `${opt.borderColor} ${opt.bgColor} shadow-sm scale-[1.02]`
                    : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                }`}
              >
                <span className="text-lg leading-none">{opt.icon}</span>
                <span className={`text-xs font-semibold ${selected ? opt.color : "text-text-secondary"}`}>
                  {opt.shortLabel}
                </span>
                {selected && (
                  <span className={`text-[10px] ${opt.color} opacity-70 leading-tight`}>
                    {opt.description}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Curriculum context — free-text, per architecture spec Phase 0 */}
      {(state.input.unitType || "design") !== "design" && (
        <div className="max-w-2xl mx-auto mb-3">
          <input
            type="text"
            value={state.input.curriculumContext || ""}
            onChange={(e) => dispatch({ type: "SET_INPUT", key: "curriculumContext", value: e.target.value })}
            placeholder="Curriculum context (optional) — e.g. IB MYP Community Project, PYP Exhibition Grade 5, GCSE D&T..."
            className="w-full px-4 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:border-brand-purple/50 focus:ring-2 focus:ring-brand-purple/10 placeholder:text-text-secondary/40"
          />
          <p className="text-[11px] text-text-secondary mt-1 ml-1">
            Helps the AI adapt vocabulary and assessment expectations to your specific curriculum.
          </p>
        </div>
      )}

      {/* Goal textarea */}
      <div className="max-w-2xl mx-auto">
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={goalText}
            onChange={(e) => handleTextChange(e.target.value)}
            placeholder="e.g. Design and 3D-print a phone stand that solves a real ergonomic problem for a client..."
            rows={4}
            className="w-full px-5 py-4 border-2 border-border rounded-2xl focus:outline-none focus:border-brand-purple/50 focus:ring-4 focus:ring-brand-purple/10 text-base resize-none transition-all duration-200 placeholder:text-text-secondary/40"
          />
          {goalText.length > 0 && (
            <span className={`absolute bottom-3 right-4 text-xs tabular-nums ${
              goalText.length >= 30 ? "text-accent-green" : "text-text-secondary/40"
            }`}>
              {goalText.length}
            </span>
          )}
        </div>

        {/* ── Lane Selector — the primary next step after topic entry ── */}
        {showConfig && onSelectMode && (
          <div className="mt-8 animate-slide-up">
            <div className="text-center mb-4">
              <h2 className="text-lg font-bold text-text-primary">How do you want to build this?</h2>
              <p className="text-xs text-text-secondary mt-1">Choose your level of control</p>
            </div>
            <ModeSelector onSelectMode={onSelectMode} />

            {/* Subtle link to switch journey/criterion mode */}
            <div className="mt-3 text-center">
              {state.journeyMode ? (
                <button
                  onClick={() => dispatch({ type: "SET_JOURNEY_MODE", enabled: false })}
                  className="text-[11px] text-text-secondary/50 hover:text-text-secondary transition-colors"
                >
                  Using a different structure? Switch to Design Cycle →
                </button>
              ) : (
                <button
                  onClick={() => dispatch({ type: "SET_JOURNEY_MODE", enabled: true })}
                  className="text-[11px] text-text-secondary/50 hover:text-text-secondary transition-colors"
                >
                  ← Switch back to Learning Journey
                </button>
              )}
            </div>
          </div>
        )}

        {/* Keyword suggestions — secondary, collapsible */}
        {showKeywordSection && keywords.length > 0 && (
          <details className="mt-5 group">
            <summary className="text-xs font-medium text-text-secondary cursor-pointer hover:text-text-primary transition-colors list-none flex items-center gap-1.5">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-open:rotate-90">
                <path d="M9 18l6-6-6-6" />
              </svg>
              AI-suggested keywords ({keywords.length})
            </summary>
            <div className="mt-3 space-y-3 animate-slide-up">
              {/* Buckets */}
              <div className="grid grid-cols-2 gap-2.5">
                <DropBucket
                  label="Must Have"
                  icon="star"
                  priority="essential"
                  keywords={mustHave}
                  compact={!hasPlacedKeywords}
                  isDragOver={dragOverBucket === "essential"}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop("essential")}
                  onDragEnter={handleDragEnter("essential")}
                  onDragLeave={handleDragLeave("essential")}
                  onToggle={handleToggleKeyword}
                  onChipTap={(idx) => handleSetPriority(idx, "none")}
                />
                <DropBucket
                  label="Nice to Have"
                  icon="check"
                  priority="included"
                  keywords={niceToHave}
                  compact={!hasPlacedKeywords}
                  isDragOver={dragOverBucket === "included"}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop("included")}
                  onDragEnter={handleDragEnter("included")}
                  onDragLeave={handleDragLeave("included")}
                  onToggle={handleToggleKeyword}
                  onChipTap={(idx) => handleSetPriority(idx, "essential")}
                />
              </div>

              {/* Word Bank */}
              <div
                onDragOver={handleDragOver}
                onDrop={handleDrop("none")}
                onDragEnter={handleDragEnter("none")}
                onDragLeave={handleDragLeave("none")}
              >
                {bankKeywords.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {bankKeywords.map((kw) => (
                      <KeywordCard
                        key={`${kw.label}-${kw.category}`}
                        label={kw.label}
                        category={kw.category}
                        priority={kw.priority}
                        index={kw.originalIndex}
                        onToggle={() => handleToggleKeyword(kw.originalIndex)}
                        delay={kw.originalIndex * 60}
                      />
                    ))}
                  </div>
                )}
                {keywordStatus === "loading" && (
                  <div className="flex gap-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-7 rounded-full bg-gray-100 animate-pulse" style={{ width: `${60 + i * 20}px` }} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </details>
        )}
      </div>
    </div>
  );
}

/* ─── Drop Bucket Component ─────────────────────────── */

interface DropBucketProps {
  label: string;
  icon: "star" | "check";
  priority: KeywordPriority;
  keywords: Array<{ label: string; category: string; priority: KeywordPriority; originalIndex: number }>;
  /** When true, bucket is shorter (no keywords placed yet) */
  compact?: boolean;
  isDragOver: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnter: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onToggle: (index: number) => void;
  /** What happens when a chip in this bucket is tapped */
  onChipTap: (index: number) => void;
}

function DropBucket({
  label,
  icon,
  priority,
  keywords,
  compact,
  isDragOver,
  onDragOver,
  onDrop,
  onDragEnter,
  onDragLeave,
  onToggle,
  onChipTap,
}: DropBucketProps) {
  const isEmpty = keywords.length === 0;
  const borderColor = priority === "essential"
    ? isDragOver ? "border-amber-400" : isEmpty ? "border-amber-300/40" : "border-amber-300/60"
    : isDragOver ? "border-brand-purple" : isEmpty ? "border-brand-purple/30" : "border-brand-purple/50";
  const bgColor = priority === "essential"
    ? isDragOver ? "bg-amber-50" : "bg-amber-50/30"
    : isDragOver ? "bg-brand-purple/5" : "bg-brand-purple/[0.02]";

  return (
    <div
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      className={`rounded-xl border-2 ${isEmpty ? "border-dashed" : ""} ${borderColor} ${bgColor} transition-all duration-300 ${isDragOver ? "scale-[1.02] shadow-md" : ""} ${compact && isEmpty ? "p-2 min-h-0" : "p-3 min-h-[60px]"}`}
    >
      {/* Bucket header */}
      <div className={`flex items-center gap-1.5 ${compact && isEmpty ? "" : "mb-2"}`}>
        {icon === "star" ? (
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" className="text-amber-500 flex-shrink-0">
            <path d="M8 .25a.75.75 0 01.673.418l1.882 3.815 4.21.612a.75.75 0 01.416 1.279l-3.046 2.97.719 4.192a.75.75 0 01-1.088.791L8 12.347l-3.766 1.98a.75.75 0 01-1.088-.79l.72-4.194L.818 6.374a.75.75 0 01.416-1.28l4.21-.611L7.327.668A.75.75 0 018 .25z" />
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" className="text-brand-purple flex-shrink-0">
            <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" />
          </svg>
        )}
        <span className={`text-xs font-semibold ${priority === "essential" ? "text-amber-700" : "text-brand-purple/80"}`}>
          {label}
        </span>
        {compact && isEmpty && (
          <span className={`text-[10px] ${priority === "essential" ? "text-amber-400" : "text-brand-purple/30"}`}>
            {isDragOver ? "Drop here" : "↓ drag here"}
          </span>
        )}
        {keywords.length > 0 && (
          <span className="text-[10px] text-text-secondary/50 ml-auto">{keywords.length}</span>
        )}
      </div>

      {/* Bucket contents — only show empty state text when not compact */}
      {isEmpty && !compact ? (
        <p className={`text-[10px] text-center py-1 ${priority === "essential" ? "text-amber-400" : "text-brand-purple/30"}`}>
          {isDragOver ? "Drop here" : "Drag keywords here"}
        </p>
      ) : !isEmpty ? (
        <div className="flex flex-wrap gap-1.5">
          {keywords.map((kw) => (
            <button
              key={`${kw.label}-${kw.category}`}
              onClick={() => onChipTap(kw.originalIndex)}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("text/plain", String(kw.originalIndex));
                e.dataTransfer.effectAllowed = "move";
              }}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium transition-all duration-150 cursor-grab active:cursor-grabbing hover:opacity-70 ${
                priority === "essential"
                  ? "bg-amber-100 text-amber-700 border border-amber-200"
                  : "bg-brand-purple/10 text-brand-purple border border-brand-purple/20"
              }`}
              title={priority === "essential" ? "Tap to remove" : "Tap to promote to Must Have"}
            >
              <span>{kw.label}</span>
              {priority === "essential" ? (
                <svg width="8" height="8" viewBox="0 0 16 16" fill="currentColor" className="opacity-40 flex-shrink-0">
                  <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z" />
                </svg>
              ) : (
                <svg width="8" height="8" viewBox="0 0 16 16" fill="currentColor" className="opacity-40 flex-shrink-0">
                  <path d="M8 1.5a.75.75 0 01.75.75v9.69l3.22-3.22a.75.75 0 111.06 1.06l-4.5 4.5a.75.75 0 01-1.06 0l-4.5-4.5a.75.75 0 111.06-1.06l3.22 3.22V2.25A.75.75 0 018 1.5z" transform="rotate(180 8 8)" />
                </svg>
              )}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
