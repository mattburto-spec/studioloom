"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import type { WizardState, WizardDispatch, WizardMode, SuggestedKeyword, KeywordPriority } from "@/hooks/useWizardState";
import { KeywordCard } from "./KeywordCard";
import { CompactConfig } from "./CompactConfig";
import { ModeSelector } from "./ModeSelector";
import { SuggestionLoading } from "./shared/SuggestionBadge";
import type { UnitType } from "@/lib/ai/unit-types";

/* SVG icons for unit types — inline to avoid lucide-react dependency */
function DesignIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 19l7-7 3 3-7 7-3-3z" />
      <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
      <path d="M2 2l7.586 7.586" />
      <circle cx="11" cy="11" r="2" />
    </svg>
  );
}
function ServiceIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
function PPIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
      <path d="M8 12h8" />
      <path d="M12 2v4" />
      <path d="M12 18v4" />
    </svg>
  );
}
function InquiryIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
      <line x1="11" y1="8" x2="11" y2="14" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </svg>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const UNIT_TYPE_ICONS: Record<string, () => any> = {
  design: DesignIcon,
  service: ServiceIcon,
  personal_project: PPIcon,
  inquiry: InquiryIcon,
};

const UNIT_TYPE_OPTIONS: Array<{
  type: UnitType;
  label: string;
  shortLabel: string;
  description: string;
  accentColor: string;     // for selected icon bg + border
  accentBorder: string;    // border when selected
  accentText: string;      // text color when selected
  accentIconBg: string;    // icon background when selected
  accentStroke: string;    // SVG stroke when selected
}> = [
  {
    type: "design",
    label: "Design Project",
    shortLabel: "Design",
    description: "Create a product or solution",
    accentColor: "teal",
    accentBorder: "border-teal-400",
    accentText: "text-teal-700",
    accentIconBg: "bg-teal-100",
    accentStroke: "#0f766e",
  },
  {
    type: "service",
    label: "Service Learning",
    shortLabel: "Service",
    description: "Community-focused learning",
    accentColor: "pink",
    accentBorder: "border-pink-400",
    accentText: "text-pink-700",
    accentIconBg: "bg-pink-100",
    accentStroke: "#be185d",
  },
  {
    type: "personal_project",
    label: "Personal Project",
    shortLabel: "PP",
    description: "Self-directed extended project",
    accentColor: "purple",
    accentBorder: "border-purple-400",
    accentText: "text-purple-700",
    accentIconBg: "bg-purple-100",
    accentStroke: "#7e22ce",
  },
  {
    type: "inquiry",
    label: "Inquiry Unit",
    shortLabel: "Inquiry",
    description: "Question-driven research",
    accentColor: "amber",
    accentBorder: "border-amber-400",
    accentText: "text-amber-700",
    accentIconBg: "bg-amber-100",
    accentStroke: "#b45309",
  },
];

interface Props {
  state: WizardState;
  dispatch: WizardDispatch;
  onSelectMode?: (mode: WizardMode) => void;
}

/* ── Curriculum Context dropdown options per unit type ── */
const CURRICULUM_OPTIONS: Record<"service" | "personal_project" | "inquiry", { label: string; value: string }[]> = {
  service: [
    { label: "IB MYP Community Project", value: "IB MYP Community Project" },
    { label: "IB MYP Service as Action", value: "IB MYP Service as Action" },
    { label: "IB DP CAS (Creativity, Activity, Service)", value: "IB DP CAS" },
    { label: "Duke of Edinburgh Award", value: "Duke of Edinburgh Award" },
    { label: "National Community Service (General)", value: "National Community Service" },
  ],
  personal_project: [
    { label: "IB MYP Personal Project", value: "IB MYP Personal Project" },
    { label: "PYP Exhibition (Grade 5/6)", value: "PYP Exhibition" },
    { label: "IB DP Extended Essay", value: "IB DP Extended Essay" },
    { label: "Independent Study / Capstone", value: "Independent Study" },
  ],
  inquiry: [
    { label: "IB MYP Interdisciplinary Unit", value: "IB MYP Interdisciplinary Unit" },
    { label: "PYP Unit of Inquiry", value: "PYP Unit of Inquiry" },
    { label: "Project-Based Learning (PBL)", value: "Project-Based Learning" },
    { label: "STEM / STEAM Inquiry", value: "STEM Inquiry" },
  ],
};

function CurriculumContextPicker({
  unitType,
  value,
  onChange,
}: {
  unitType: "service" | "personal_project" | "inquiry";
  value: string;
  onChange: (v: string) => void;
}) {
  const options = CURRICULUM_OPTIONS[unitType] || [];
  const isCustom = value !== "" && !options.some((o) => o.value === value);
  const [showCustom, setShowCustom] = useState(isCustom);

  return (
    <div className="flex flex-col gap-1.5">
      <select
        value={showCustom ? "__custom__" : value}
        onChange={(e) => {
          if (e.target.value === "__custom__") {
            setShowCustom(true);
            onChange("");
          } else {
            setShowCustom(false);
            onChange(e.target.value);
          }
        }}
        className="w-full px-4 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:border-brand-purple/50 focus:ring-2 focus:ring-brand-purple/10 bg-white appearance-none"
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M2 4l4 4 4-4'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center" }}
      >
        <option value="">Curriculum context (optional)</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
        <option value="__custom__">Other (type your own)...</option>
      </select>
      {showCustom && (
        <input
          type="text"
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Type your curriculum context..."
          className="w-full px-4 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:border-brand-purple/50 focus:ring-2 focus:ring-brand-purple/10"
        />
      )}
    </div>
  );
}

const LANE_STORAGE_KEY = "studioloom_wizard_lane";

export function GoalInput({ state, dispatch, onSelectMode }: Props) {
  const [keywordStatus, setKeywordStatus] = useState<"idle" | "loading" | "done">("idle");
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [dragOverBucket, setDragOverBucket] = useState<KeywordPriority | null>(null);
  const [lastUsedLane, setLastUsedLane] = useState<WizardMode | null>(null);

  // Load last-used lane from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LANE_STORAGE_KEY);
      if (stored && ["build-for-me", "guide-me", "architect"].includes(stored)) {
        setLastUsedLane(stored as WizardMode);
      }
    } catch { /* SSR or private browsing */ }
  }, []);

  // Wrap onSelectMode to persist the choice
  const handleSelectMode = useCallback((mode: WizardMode) => {
    try { localStorage.setItem(LANE_STORAGE_KEY, mode); } catch { /* noop */ }
    setLastUsedLane(mode);
    onSelectMode?.(mode);
  }, [onSelectMode]);

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
      <div className="max-w-3xl mx-auto mb-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {UNIT_TYPE_OPTIONS.map((opt) => {
            const selected = (state.input.unitType || "design") === opt.type;
            const IconComponent = UNIT_TYPE_ICONS[opt.type];
            return (
              <button
                key={opt.type}
                onClick={() => {
                  dispatch({ type: "SET_INPUT", key: "unitType", value: opt.type });
                }}
                className={`group relative flex flex-col items-center gap-2.5 px-3 py-4 rounded-2xl border-2 transition-all duration-200 ${
                  selected
                    ? `${opt.accentBorder} bg-white shadow-md scale-[1.02]`
                    : "border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm"
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                    selected ? opt.accentIconBg : "bg-gray-100 group-hover:bg-gray-200/70"
                  }`}
                  style={selected ? { color: opt.accentStroke } : { color: "#9ca3af" }}
                >
                  {IconComponent && <IconComponent />}
                </div>
                <div className="text-center">
                  <div className={`text-sm font-bold transition-colors ${selected ? opt.accentText : "text-text-primary"}`}>
                    {opt.shortLabel}
                  </div>
                  <div className={`text-[10px] leading-tight mt-0.5 transition-all ${
                    selected ? `${opt.accentText} opacity-80` : "text-text-tertiary"
                  }`}>
                    {opt.description}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Curriculum context — dropdown with common options + custom */}
      {(state.input.unitType || "design") !== "design" && (
        <div className="max-w-2xl mx-auto mb-3">
          <CurriculumContextPicker
            unitType={(state.input.unitType || "design") as "service" | "personal_project" | "inquiry"}
            value={state.input.curriculumContext || ""}
            onChange={(v) => dispatch({ type: "SET_INPUT", key: "curriculumContext", value: v })}
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

        {/* ── Duration Picker — appears when topic is entered ── */}
        {showConfig && (
          <div className="mt-6 animate-fade-in">
            <div className="flex items-center justify-center gap-4 p-4 rounded-xl bg-surface-alt/50 border border-border/50">
              <div className="flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-secondary">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                <span className="text-sm font-medium text-text-primary">Unit duration</span>
              </div>
              <div className="flex items-center gap-2">
                {[4, 6, 8, 10, 12].map((w) => (
                  <button
                    key={w}
                    onClick={() => {
                      dispatch({ type: "SET_INPUT", key: "durationWeeks", value: w });
                      dispatch({ type: "SET_JOURNEY_INPUT", key: "durationWeeks", value: w });
                    }}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      state.input.durationWeeks === w
                        ? "bg-brand-purple text-white shadow-sm"
                        : "bg-white border border-border text-text-secondary hover:border-brand-purple/30 hover:text-text-primary"
                    }`}
                  >
                    {w}w
                  </button>
                ))}
              </div>
              <span className="text-xs text-text-secondary">
                ~{state.input.durationWeeks * (state.journeyInput.lessonsPerWeek || 3)} lessons
              </span>
            </div>
          </div>
        )}

        {/* ── Lane Selector — always visible, dims when topic too short ── */}
        {onSelectMode && (
          <div className={`mt-6 transition-opacity duration-300 ${showConfig ? "opacity-100" : "opacity-40 pointer-events-none"}`}>
            <div className="text-center mb-4">
              <h2 className="text-lg font-bold text-text-primary">
                {showConfig ? "How do you want to build this?" : "Next: choose your approach"}
              </h2>
              <p className="text-xs text-text-secondary mt-1">
                {showConfig ? "Choose your level of control" : "Describe your topic above to unlock"}
              </p>
            </div>
            <ModeSelector onSelectMode={handleSelectMode} lastUsed={lastUsedLane} />

            {/* Subtle link to switch journey/criterion mode */}
            {showConfig && (
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
            )}
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
